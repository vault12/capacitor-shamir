package com.vault12.plugins.shamir;

import androidx.annotation.VisibleForTesting;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@CapacitorPlugin(name = "Shamir")
public class ShamirPlugin extends Plugin {

    private static final String TAG = "ShamirPlugin";
    private static final String PREFIX = "[" + TAG + "] ";

    /**
     * Plugin methods
     */

    @PluginMethod(returnType = PluginMethod.RETURN_CALLBACK)
    public void generateShards(PluginCall call) {
        PluginExecutorService.getExecutor().execute(() -> {
            int totalShards = call.getInt("totalShards");
            int threshold = call.getInt("threshold");
            if (threshold > 255 || totalShards > 255) {
                call.reject(PREFIX + "generateShards() Threshold and total shares must be <= 255");
                return;
            }
            String inputDataBase64 = call.getString("inputDataBase64", "");
            byte[] inputData = Base64Helper.bytesFromBase64String(inputDataBase64);
            if (inputData == null) {
                call.reject(PREFIX + "generateShards() invalid input data");
                return;
            }
            call.setKeepAlive(true);
            try {
                Map<Short, byte[]> shards = ShamirUtils.generateShards(inputData, (short) totalShards, (short) threshold, progress -> {
                    call.resolve(new JSObject().put("progress", progress));
                });
                JSObject result = new JSObject().put("progress", 1);
                JSArray shardsBase64 = new JSArray();
                for (Map.Entry<Short, byte[]> entry : shards.entrySet()) {
                    ByteArrayOutputStream stream = new ByteArrayOutputStream();
                    stream.write(entry.getKey());
                    stream.write(entry.getValue());
                    byte[] data = stream.toByteArray();
                    shardsBase64.put(Base64Helper.bytesToBase64String(data));
                }
                result.put("shardsBase64", shardsBase64);
                call.setKeepAlive(false);
                call.resolve(result);
            } catch (Exception e) {
                e.printStackTrace();
                call.setKeepAlive(false);
                call.reject(e.getMessage());
            }
        });
    }

    @PluginMethod(returnType = PluginMethod.RETURN_CALLBACK)
    public void restoreFromShards(PluginCall call) {
        PluginExecutorService.getExecutor().execute(() -> {
            try {
                JSArray shardsBase64 = call.getArray("inputShardsBase64");
                Map<Short, byte[]> shards = parseShardsWithIndexesFromBase64(shardsBase64);
                call.setKeepAlive(true);
                byte[] secret = ShamirUtils.restoreSecret(shards, progress -> {
                    call.resolve(new JSObject().put("progress", progress));
                });
                call.setKeepAlive(false);
                call.resolve(new JSObject()
                        .put("progress", 1.0)
                        .put("dataBase64", Base64Helper.bytesToBase64String(secret)));
            } catch (Exception e) {
                e.printStackTrace();
                call.setKeepAlive(false);
                call.reject(e.getMessage());
            }
        });
    }

    @PluginMethod(returnType = PluginMethod.RETURN_CALLBACK)
    public void restoreShard(PluginCall call) {
        PluginExecutorService.getExecutor().execute(() -> {
            try {
                JSArray shardsBase64 = call.getArray("inputShardsBase64");
                Map<Short, byte[]> shards = parseShardsWithIndexesFromBase64(shardsBase64);
                int newIndex = call.getInt("shardIndex", 0);
                if (newIndex < 1 || newIndex > 255) {
                    call.reject(PREFIX + "restoreShard() Shard index must be between 1 and 255, got: " + newIndex);
                    return;
                }
                call.setKeepAlive(true);
                byte[] shard = ShamirUtils.restoreShard(shards, (short) newIndex, progress -> {
                    call.resolve(new JSObject().put("progress", progress));
                });
                byte[] shardWithIndex = new byte[shard.length + 1];
                shardWithIndex[0] = (byte) newIndex;
                System.arraycopy(shard, 0, shardWithIndex, 1, shard.length);
                call.setKeepAlive(false);
                call.resolve(new JSObject()
                        .put("progress", 1.0)
                        .put("dataBase64", Base64Helper.bytesToBase64String(shardWithIndex)));
            } catch (Exception e) {
                e.printStackTrace();
                call.setKeepAlive(false);
                call.reject(e.getMessage());
            }
        });
    }

    @PluginMethod(returnType = PluginMethod.RETURN_CALLBACK)
    public void generateFileShards(PluginCall call) {
        PluginExecutorService.getExecutor().execute(() -> {
            int totalShards = call.getInt("totalShards");
            int threshold = call.getInt("threshold");
            if (threshold > 255 || totalShards > 255) {
                call.reject(PREFIX + "generateFileShards() Threshold and total shares must be <= 255");
                return;
            }
            String srcPath = call.getString("srcPath", "");
            String dstPathRoot = call.getString("dstPathRoot", "");
            if (dstPathRoot.isEmpty()) {
                dstPathRoot = getCacheDir();
            }
            call.setKeepAlive(true);
            try {
                String[] paths = ShamirUtils.generateFileShards((short) totalShards, (short) threshold, srcPath, dstPathRoot, progress -> {
                    call.resolve(new JSObject().put("progress", progress));
                });
                call.setKeepAlive(false);
                call.resolve(new JSObject()
                        .put("progress", 1.0)
                        .put("shardsPaths", new JSArray(paths)));
            } catch (Exception e) {
                e.printStackTrace();
                call.setKeepAlive(false);
                call.reject(e.getMessage());
            }
        });
    }

    @PluginMethod(returnType = PluginMethod.RETURN_CALLBACK)
    public void generateShardsToFiles(PluginCall call) {
        PluginExecutorService.getExecutor().execute(() -> {
            int totalShards = call.getInt("totalShards");
            int threshold = call.getInt("threshold");
            if (threshold > 255 || totalShards > 255) {
                call.reject(PREFIX + "generateFileShards() Threshold and total shares must be <= 255");
                return;
            }
            String dstPathRoot = call.getString("dstPathRoot", "");
            if (dstPathRoot.isEmpty()) {
                dstPathRoot = getCacheDir();
            }
            String inputDataBase64 = call.getString("inputDataBase64", "");
            byte[] inputData = Base64Helper.bytesFromBase64String(inputDataBase64);
            if (inputData == null) {
                call.reject(PREFIX + "generateShards() invalid input data");
                return;
            }
            call.setKeepAlive(true);
            try {
                String[] paths = ShamirUtils.generateShardsToFiles((short) totalShards, (short) threshold, inputData, dstPathRoot, progress -> {
                    call.resolve(new JSObject().put("progress", progress));
                });
                call.setKeepAlive(false);
                call.resolve(new JSObject()
                        .put("progress", 1.0)
                        .put("shardsPaths", new JSArray(paths)));
            } catch (Exception e) {
                e.printStackTrace();
                call.setKeepAlive(false);
                call.reject(e.getMessage());
            }
        });
    }

    @PluginMethod(returnType = PluginMethod.RETURN_CALLBACK)
    public void restoreFromFileShards(PluginCall call) {
        PluginExecutorService.getExecutor().execute(() -> {
            try {
                List<String> shardsPathList = call.getArray("shardsPaths").toList();
                String[] shardsPaths = shardsPathList.toArray(new String[0]);
                String dstPath = call.getString("dstPath", "");
                call.setKeepAlive(true);
                ShamirUtils.restoreFromFileShardsToFile(shardsPaths, dstPath, progress -> {
                    call.resolve(new JSObject().put("progress", progress));
                });
                call.setKeepAlive(false);
                call.resolve(new JSObject()
                        .put("progress", 1.0)
                        .put("dstPath", dstPath)
                );
            } catch (Exception e) {
                e.printStackTrace();
                call.setKeepAlive(false);
                call.reject(e.getMessage());
            }
        });
    }

    @PluginMethod(returnType = PluginMethod.RETURN_CALLBACK)
    public void restoreFromFileShardsToData(PluginCall call) {
        PluginExecutorService.getExecutor().execute(() -> {
            try {
                List<String> shardsPathList = call.getArray("shardsPaths").toList();
                String[] shardsPaths = shardsPathList.toArray(new String[0]);
                call.setKeepAlive(true);
                byte[] data = ShamirUtils.restoreFromFileShardsToData(shardsPaths, progress -> {
                    call.resolve(new JSObject().put("progress", progress));
                });
                call.setKeepAlive(false);
                call.resolve(new JSObject()
                        .put("progress", 1.0)
                        .put("dataBase64", Base64Helper.bytesToBase64String(data))
                );
            } catch (Exception e) {
                e.printStackTrace();
                call.setKeepAlive(false);
                call.reject(e.getMessage());
            }
        });
    }

    @PluginMethod(returnType = PluginMethod.RETURN_CALLBACK)
    public void restoreFileShard(PluginCall call) {
        PluginExecutorService.getExecutor().execute(() -> {
            try {
                int shardIndex = call.getInt("shardIndex", 0);
                if (shardIndex < 1 || shardIndex > 255) {
                    call.reject(PREFIX + "restoreFileShard() Shard index must be between 1 and 255, got: " + shardIndex);
                    return;
                }
                List<String> shardsPathList = call.getArray("shardsPaths").toList();
                String[] shardsPaths = shardsPathList.toArray(new String[0]);
                String dstPathRoot = call.getString("dstPathRoot", "");
                if (dstPathRoot.isEmpty()) {
                    dstPathRoot = getCacheDir();
                }
                call.setKeepAlive(true);
                String shardPath = ShamirUtils.restoreShardFromFileShards(shardsPaths, dstPathRoot, (short) shardIndex, progress -> {
                    call.resolve(new JSObject().put("progress", progress));
                });
                call.setKeepAlive(false);
                call.resolve(new JSObject()
                        .put("progress", 1.0)
                        .put("shardPath", shardPath)
                );
            } catch (Exception e) {
                e.printStackTrace();
                call.setKeepAlive(false);
                call.reject(e.getMessage());
            }
        });
    }

    /**
     * Helpers
     */

    private Map<Short, byte[]> parseShardsWithIndexesFromBase64(JSArray shardsBase64) throws SimpleException {
        List<byte[]> shardsData = new ArrayList<>();
        for (int i = 0; i < shardsBase64.length(); i++) {
            shardsData.add(Base64Helper.bytesFromBase64String(shardsBase64.optString(i, "")));
        }
        return parseShardsWithIndexes(shardsData);
    }

    /**
     * Turns decoded shards into the index keyed map ShamirCore expects.
     *
     * @param shardsData decoded shards, each one an index byte followed by the shard payload
     * @return the shards keyed by their unsigned index in [1...255]
     * @throws SimpleException on invalid, reserved or repeated shard indexes
     */
    @VisibleForTesting
    static Map<Short, byte[]> parseShardsWithIndexes(List<byte[]> shardsData) throws SimpleException {
        Map<Short, byte[]> shards = new HashMap<>();
        for (byte[] data : shardsData) {
            short index = parseShardIndex(data);
            byte[] shard = new byte[data.length - 1];
            System.arraycopy(data, 1, shard, 0, shard.length);
            // Shards are keyed by their coordinate, so a repeated index would silently evict a
            // genuine shard and leave fewer distinct points than the caller supplied
            if (shards.put(index, shard) != null) {
                throw new SimpleException(TAG, "parseShardsWithIndexes() duplicate shard index: " + index + ", every shard must carry its own index");
            }
        }
        return shards;
    }

    /**
     * Reads the leading index byte of a shard.
     *
     * @param data a decoded shard: an index byte followed by the shard payload
     * @return the shard index as an unsigned value in [1...255]
     */
    @VisibleForTesting
    static short parseShardIndex(byte[] data) throws SimpleException {
        if (data == null || data.length < 2) {
            throw new SimpleException(TAG, "parseShardIndex() invalid shard data: a shard must be an index byte followed by shard data");
        }
        // read as UNSIGNED, or indexes 128...255 would arrive sign extended as negative
        short index = (short) (data[0] & 0xFF);
        if (index == 0) {
            throw new SimpleException(TAG, "parseShardIndex() invalid shard index: 0 is reserved for the secret, valid shard indexes are [1...255]");
        }
        return index;
    }

    private String getCacheDir() {
        return bridge.getContext().getCacheDir().getAbsolutePath();
    }
}
