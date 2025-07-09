package com.vault12.plugins.shamir;

import android.system.ErrnoException;
import android.system.OsConstants;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.stream.IntStream;

public class ShamirUtils {
    private static final String TAG = "ShamirUtils";
    private final static String SHARD_NAME_PREFIX = "shard";
    // Regulates chunk size of split/restore + file I/O + progress reporting. Keep consistent with iOS impl (ShamirUtils.swift)
    private final static int BUFFER_SIZE = 100000;

    /**
     * In-memory API
     */

    public static Map<Short, byte[]> generateShards(byte[] secret, short totalShards, short threshold, ProgressListener progressListener) throws SimpleException {
        return ShamirCore.split(secret, totalShards, threshold, progressListener);
    }

    public static byte[] restoreSecret(Map<Short, byte[]> shards, ProgressListener progressListener) throws SimpleException {
        return ShamirCore.restore(shards, progressListener);
    }

    public static byte[] restoreShard(Map<Short, byte[]> shards, short shardIndex, ProgressListener progressListener) throws SimpleException {
        return ShamirCore.restore(shards, shardIndex, progressListener);
    }

    /**
     * File API
     */

    public static String[] generateFileShards(short totalShards, short threshold, String srcPath, String dstPathRoot, ProgressListener progressListener) throws Exception {
        if (!new File(srcPath).exists()) {
            throw new SimpleException(TAG, "generateFileShards() source file does not exist");
        }
        FileInputStream srcStream = null;
        try {
            long srcLength = new File(srcPath).length();
            srcStream = new FileInputStream(srcPath);
            FileInputStream finalSrcStream = srcStream;
            ReadableBlobSource readableSource = (offset, count) -> {
                byte[] srcBuffer = new byte[(int)count];
                finalSrcStream.read(srcBuffer);
                return srcBuffer;
            };
            return generateFileShardsFromReadableSource(totalShards, threshold, srcLength, readableSource, dstPathRoot, progressListener);
        } finally {
            if (srcStream != null) {
                srcStream.close();
            }
        }
    }

    public static String[] generateShardsToFiles(short totalShards, short threshold, byte[] srcData, String dstPathRoot, ProgressListener progressListener) throws Exception {
        ReadableBlobSource readableSource = (offset, count) -> Arrays.copyOfRange(srcData, (int)offset, (int)(offset + count));
        return generateFileShardsFromReadableSource(totalShards, threshold, srcData.length, readableSource, dstPathRoot, progressListener);
    }

    private static String[] generateFileShardsFromReadableSource(short totalShards, short threshold, long srcLength, ReadableBlobSource readableSource, String dstPathRoot, ProgressListener progressListener) throws Exception {
        int[] indexes = IntStream.rangeClosed(1, totalShards).toArray();
        List<FileOutputStreamModel> shardFiles = Collections.emptyList();
        try {
            shardFiles = prepareShardFiles(indexes, dstPathRoot, generateIdString());
            String[] filePaths = shardFiles.stream().map(FileOutputStreamModel::getPath).toArray(String[]::new);
            long offset = 0;
            do {
                long end = Math.min(offset + BUFFER_SIZE, srcLength);
                byte[] srcBuffer = readableSource.read(offset, end - offset);
                Map<Short, byte[]> bufferShards = ShamirCore.split(srcBuffer, totalShards, threshold, null);
                offset = end;
                for (Map.Entry<Short, byte[]> entry : bufferShards.entrySet()) {
                    int i = entry.getKey() - 1;
                    try {
                        shardFiles.get(i).getStream().write(entry.getValue());
                    } catch (IOException e) {
                        throw processedException(e);
                    }
                }
                progressListener.onProgress(1.0 * offset / srcLength);
            } while (offset < srcLength);
            return filePaths;
        } finally {
            for (FileOutputStreamModel shardFile : shardFiles) {
                shardFile.getStream().close();
            }
        }
    }

    public static void restoreFromFileShardsToFile(String[] srcPaths, String dstPath, ProgressListener progressListener) throws Exception {
        long srcLength = validateShardFilesAndGetSrcLength(srcPaths);
        createParentDirForPath(dstPath);
        final FileOutputStream dstStream = new FileOutputStream(dstPath);
        try (dstStream) {
            WriteableBlobSource dstSource = data -> {
                try {
                    dstStream.write(data);
                } catch (IOException e) {
                    throw processedException(e);
                }
            };
            restoreFromFileShards(srcPaths, srcLength, dstSource, progressListener);
        }
    }

    public static byte[] restoreFromFileShardsToData(String[] srcPaths, ProgressListener progressListener) throws Exception {
        long srcLength = validateShardFilesAndGetSrcLength(srcPaths);
        final ByteArrayOutputStream dstStream = new ByteArrayOutputStream();
        try (dstStream) {
            WriteableBlobSource dstSource = dstStream::write;
            restoreFromFileShards(srcPaths, srcLength, dstSource, progressListener);
            return dstStream.toByteArray();
        }
    }

    public static String restoreShardFromFileShards(String[] srcPaths, String dstPathRoot, short newShardIndex, ProgressListener progressListener) throws Exception {
        long srcLength = validateShardFilesAndGetSrcLength(srcPaths);
        List<FileOutputStreamModel> shardFiles = Collections.emptyList();
        int[] indexes = { newShardIndex };
        try {
            shardFiles = prepareShardFiles(indexes, dstPathRoot, generateIdString());
            if (shardFiles.isEmpty()) {
                throw new SimpleException(TAG, "restoreShardFromFileShards() failed to prepare shard file");
            }
            FileOutputStreamModel shardFile = shardFiles.get(0);
            WriteableBlobSource dstSource = data -> {
                try {
                    shardFile.getStream().write(data);
                } catch (IOException e) {
                    throw processedException(e);
                }
            };
            restoreFromFileShards(srcPaths, srcLength, newShardIndex, dstSource, progressListener);
        } finally {
            for (FileOutputStreamModel shardFile : shardFiles) {
                shardFile.getStream().close();
            }
        }
        return shardFiles.get(0).getPath();
    }

    private static long validateShardFilesAndGetSrcLength(String[] srcPaths) throws SimpleException {
        if (srcPaths.length < 2) { throw new SimpleException(TAG, "Need at least two Shamir's shard files"); }
        boolean sizesAreEqual = Arrays.stream(srcPaths)
                .map(File::new)
                .map(File::length)
                .distinct()
                .count() == 1;
        if (!sizesAreEqual) { throw new SimpleException(TAG, "Shard files have varying sizes"); }
        return new File(srcPaths[0]).length() - 1;
    }

    /**
     * Helpers
     */

    private static List<FileOutputStreamModel> prepareShardFiles(int[] indexes, String dstPathRoot, String idString) throws SimpleException, IOException {
        File rootDir = new File(dstPathRoot);
        if (!rootDir.exists()) {
            boolean isCreated = rootDir.mkdirs();
            if (!isCreated) {
                throw new SimpleException(TAG, "failed to create directory at path: " + dstPathRoot);
            }
        }
        List<FileOutputStreamModel> result = new ArrayList<>();
        for (int i : indexes) {
            String fileName = rootDir.getAbsolutePath() + "/" + idString + "_" + SHARD_NAME_PREFIX + "_" + i + ".bin";
            FileOutputStream fOut = new FileOutputStream(fileName);
            fOut.write(i);
            result.add(new FileOutputStreamModel(fileName, fOut));
        }
        return result;
    }

    private static void restoreFromFileShards(String[] srcPaths, long srcLength, WriteableBlobSource dstSource, ProgressListener progressListener) throws Exception {
        restoreFromFileShards(srcPaths, srcLength, (short)0, dstSource, progressListener);
    }

    private static void restoreFromFileShards(String[] srcPaths, long srcLength, short newShardIndex, WriteableBlobSource dstSource, ProgressListener progressListener) throws Exception {
        List<FileInputStream> srcInputStreams = new ArrayList<>();
        try {
            for (String srcPath : srcPaths) {
                srcInputStreams.add(new FileInputStream(srcPath));
            }
            short[] shardIds = new short[srcInputStreams.size()];
            int i = 0;
            for (FileInputStream srcInputStream : srcInputStreams) {
                shardIds[i] = (short) srcInputStream.read();
                i++;
            }
            long offset = 0;
            do {
                long end = Math.min(offset + BUFFER_SIZE, srcLength);
                int len = (int) (end - offset);
                Map<Short, byte[]> shards = new HashMap<>();
                int index = 0;
                for (FileInputStream srcInputStream : srcInputStreams) {
                    byte[] data = new byte[len];
                    srcInputStream.read(data);
                    short shardID = shardIds[index];
                    shards.put(shardID, data);
                    index++;
                }
                byte[] secret = ShamirCore.restore(shards, newShardIndex, null);
                dstSource.write(secret);
                offset = end;
                progressListener.onProgress(1.0 * offset / srcLength);
            } while (offset < srcLength);
        } finally {
            for (FileInputStream srcInputStream : srcInputStreams) {
                srcInputStream.close();
            }
        }
    }

    private static void createParentDirForPath(String filePath) throws SimpleException {
        File file = new File(filePath);
        File parentDir = file.getParentFile();
        if (parentDir != null && !parentDir.exists()) {
            boolean isCreated = parentDir.mkdirs();
            if (!isCreated) {
                throw new SimpleException(TAG, "failed to create directory at path: " + parentDir.getAbsolutePath());
            }
        }
    }

    private static String generateIdString() {
        long currentTime = System.currentTimeMillis();
        Random random = new Random();
        int randomNumber = random.nextInt() & Integer.MAX_VALUE;
        return currentTime + "_" + randomNumber;
    }

    private static Exception processedException(Exception e) {
        if (e.getCause() instanceof ErrnoException && ((ErrnoException) e.getCause()).errno == OsConstants.ENOSPC) {
            return new SimpleException("Not enough disk space");
        }
        return e;
    }

}
