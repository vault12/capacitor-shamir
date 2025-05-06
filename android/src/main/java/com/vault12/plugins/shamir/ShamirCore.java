package com.vault12.plugins.shamir;

import java.util.HashMap;
import java.util.Map;

import androidx.annotation.Nullable;

/**
 Shamir Algorithm over GF(2^8) finite field:
 Split data into bytes. Each byte is 0-255 GF(2^8) element
 Encrypt byte B:
 - call GF.generate(): fill array with random numbers. Verify that
     highest polynomial power (which determines threshold number of points
     to solve polynomial back) is non-zero coefficient.
     We get polynomial like f(x) = B + a*x + b*x^2 + c*x^3 where B is our
     secret byte and a,b,c are 0-255 elements of GF(2^8) choosen randomly.
     a and b can randomly be zero, but c must not be zero since we want
     polynomial of 3rd degree.
 - Let say we need 5 shards: we calculate f(1),f(2),f(3),f(4),f(5)
     Becase this is all in GF(2^8) the resulting value is always 0-255 - another
     byte. The value of that byte is totally random - it depends on random values
     a,b and c.
 - The sharding of byte B is 5 pairs (i,pᵢ) with random pᵢ calcuated from our
    polynomial according to rules of operations in GF(2^8)
 - These 5 buffers where every byte is replaced with "shard-byte" is our shares
 - Notice we dont record random coefficients which change between every byte
 and are not needed for restoration

 Restore byte B is simple interpolation operation GF256.interpolate() of
 calculating f(0) knowing some polynimial values, say f(1), f(3), f(5). As long
 as we have enough values to solve for polynomial of given power (which we enforced
 by making sure highest power coeff is non-zero) we can solve it back for f(0)
 value, which will be GF(2^8) element - our original secret byte in that position.
 */

public class ShamirCore {
    private static final String TAG = "ShamirCore";
    // Regulates progress updates frequency. Keep consistent with iOS impl (ShamirCore.swift)
    private static final int PROGRESS_REPORT_INTERVAL_BYTES = 10000;

    public static Map<Short, byte[]> split(byte[] secret, short totalShards, short threshold, @Nullable ProgressListener progressListener) throws SimpleException {
        if (threshold < 2) { throw new SimpleException(TAG, "split() threshold must be two or more"); }
        if (threshold > totalShards) { throw new SimpleException(TAG, "split() totalShards must be >= threshold"); }
        if (threshold > 255) { throw new SimpleException(TAG, "split() threshold must be <= 255"); }
        if (totalShards > 255) { throw new SimpleException(TAG, "split() totalShards must be <= 255>"); }
        int progressReportCounter = 0;
        byte [][] shards = new byte[totalShards][secret.length];
        for (int i = 0; i < secret.length; i++) {
            byte[] p = GF256.generate((short)(threshold - 1), secret[i]);
            for (int x = 1; x <= totalShards; x++) {
                shards[x - 1][i] = GF256.eval(p, (byte)x);
            }
            if (progressListener != null) {
                progressReportCounter += 1;
                if (progressReportCounter >= PROGRESS_REPORT_INTERVAL_BYTES) {
                    double progress = 1.0 * i / secret.length;
                    progressListener.onProgress(progress);
                    progressReportCounter = 0;
                }
            }
        }
        Map<Short, byte[]> map = new HashMap<>();
        for (int i = 0; i < totalShards; i++) {
            map.put((short)(i + 1), shards[i]);
        }
        return map;
    }

    public static byte[] restore(Map<Short, byte[]> shards, @Nullable ProgressListener progressListener) throws SimpleException {
        return restore(shards, (short)0, progressListener);
    }

    public static byte[] restore(Map<Short, byte[]> shards, short newIndex, @Nullable ProgressListener progressListener) throws SimpleException {
        if (newIndex < 0 || newIndex > 255) { throw new SimpleException(TAG, "restore() New index must be in [0...255]"); }
        if (shards.size() < 2) { throw new SimpleException(TAG, "restore() Need at least two Shamir's shards"); }
        boolean sizesEqual = shards.values().stream()
                .mapToInt(shard -> shard.length)
                .distinct()
                .count() == 1;
        if (!sizesEqual) { throw new SimpleException(TAG + " restore() Shards have varying lengths"); }
        int size = shards.values().iterator().next().length;

        int progressReportCounter = 0;
        byte[] result = new byte[size];
        for (int i = 0; i < result.length; i++) {
            byte[][] points = new byte[shards.size()][2];
            int j = 0;
            for (short idx : shards.keySet()) {
                points[j][0] = (byte)idx;
                byte[] shard = shards.get(idx);
                points[j][1] = shard[i];
                j += 1;
            }
            result[i] = GF256.interpolate(points, (byte)newIndex);
            if (progressListener != null) {
                progressReportCounter += 1;
                if (progressReportCounter >= PROGRESS_REPORT_INTERVAL_BYTES) {
                    double progress = 1.0 * i / size;
                    progressListener.onProgress(progress);
                    progressReportCounter = 0;
                }
            }
        }
        return result;
    }

}
