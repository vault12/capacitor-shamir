package com.vault12.plugins.shamir;


import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNotEquals;
import static org.junit.Assert.fail;

import org.junit.Test;

import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;

public class ShamirCoreUnitTest {

    @Test
    public void wrongShards() {

        try {
            ShamirCore.split(new byte[]{}, (short)10, (short)1, null);
            fail("T too low");
        } catch (SimpleException e) {}

        try {
            ShamirCore.split(new byte[]{}, (short)5, (short)7, null);
            fail("T > than all shares");
        } catch (SimpleException e) {}

        try {
            Map<Short, byte[]> shards = new HashMap<>();
            shards.put((short)1, new byte[]{1,2,3});
            shards.put((short)2, new byte[]{1,2,3,4});
            ShamirCore.restore(shards, null);
            fail("T > shards of different size");
        } catch (SimpleException e) {}

    }

    @Test
    public void SSS() throws SimpleException {
        String secret = "hello world";
        Map<Short, byte[]> shardsMap = ShamirCore.split(secret.getBytes(StandardCharsets.US_ASCII), (short) 5, (short) 3, null);

        // adopt shards data structure to copy range of shards later below
        // for each shard range tuple given, e.g. {2,4} which means subset of shards 2..4
        Map.Entry<Short, byte[]>[] shardsArray = new Map.Entry[shardsMap.size()];
        int i = 0;
        for (Map.Entry<Short, byte[]> entry : shardsMap.entrySet()) {
            shardsArray[i] = entry;
            i++;
        }

        // Not enough shards to restore
        int[][] shardRanges = new int[][]{ {2,3}, {0,1}, {1,2} };

        for (int[] shardRange : shardRanges) {
            // get shards subset
            Map.Entry<Short, byte[]>[] shardSubset =
                    Arrays.copyOfRange(shardsArray, shardRange[0], shardRange[1] + 1);

            Map<Short, byte[]> submap = new HashMap<>();
            for (Map.Entry<Short, byte[]> entry : shardSubset) {
                submap.put(entry.getKey(), entry.getValue());
            }

            byte[] r = ShamirCore.restore(submap, null);
            assertNotEquals(secret, new String(r, StandardCharsets.US_ASCII));
        }

        // Enough shards
        shardRanges = new int[][]{ {2,4}, {0,2}, {1,3} };
        for (int[] shardRange : shardRanges) {
            // get shards subset
            Map.Entry<Short, byte[]>[] shardSubset =
                    Arrays.copyOfRange(shardsArray, shardRange[0], shardRange[1] + 1);

            Map<Short, byte[]> submap = new HashMap<>();
            for (Map.Entry<Short, byte[]> entry : shardSubset) {
                submap.put(entry.getKey(), entry.getValue());
            }

            byte[] r = ShamirCore.restore(submap, null);
            assertEquals(secret, new String(r, StandardCharsets.US_ASCII));
        }

    }

    @Test
    public void speed() throws SimpleException {

        final int REPEAT_COUNT = 100;
        long[] timespent = new long[REPEAT_COUNT];

        for (int i = 0; i < REPEAT_COUNT; i++) {

            long start = System.currentTimeMillis();

            int size = 10000;
            byte[] secret = new byte[size];
            SecureRandom secureRandom = new SecureRandom();
            secureRandom.nextBytes(secret);

            Map<Short, byte[]> shards = ShamirCore.split(secret, (short) 2, (short) 2, null);

            byte[] r = ShamirCore.restore(shards, null);

            long end = System.currentTimeMillis();

            // assertEquals() can't compare raw arrays by value,
            // so construct strings and compare, excluding spent time from measurement
            assertEquals(
                    new String(secret, StandardCharsets.US_ASCII),
                    new String(r, StandardCharsets.US_ASCII)
            );

            timespent[i] = end - start;

        }

        // calculate avg
        long sum = 0;
        for (long t : timespent) { sum += t; }
        long avg = sum / timespent.length;

        System.out.println("speed() repeatCount: " + REPEAT_COUNT + ", avg ms: " + avg + ", all ms: ");
        // time stats look like f(x)=1/x, so let's print all stats
        for (long t : timespent) { System.out.print("" + t + ", "); }
    }

    @Test
    public void maximumArmor() throws SimpleException {
        String secret = "hello world";
        byte[] secretBytes = secret.getBytes(StandardCharsets.US_ASCII);
        Map<Short, byte[]> shards = ShamirCore.split(secretBytes, (short)255, (short)255, null);

        assertEquals(shards.size(), 255);

        // Not enough shards to restore
        Map<Short, byte[]> shardSubsetNotEnough = new HashMap<>(shards);
        shardSubsetNotEnough.remove((short)254);
        byte[] r = ShamirCore.restore(shardSubsetNotEnough, null);
        assertNotEquals(secret, new String(r, StandardCharsets.US_ASCII));

        // Enough shards
        Map<Short, byte[]> shardSubsetEnough = new HashMap<>(shards);
        r = ShamirCore.restore(shardSubsetEnough, null);
        assertEquals(secret, new String(r, StandardCharsets.US_ASCII));
    }

    @Test
    public void restoreShard() throws SimpleException {
        String secret = "hello world";
        Map<Short, byte[]> shardsMap = ShamirCore.split(secret.getBytes(StandardCharsets.US_ASCII), (short) 6, (short) 3, null);

        // adopt shards data structure to copy range of shards later below
        // for each shard range tuple given, e.g. {2,4} which means subset of shards 2..4
        Map.Entry<Short, byte[]>[] shardsArray = new Map.Entry[shardsMap.size()];
        int i = 0;
        for (Map.Entry<Short, byte[]> entry : shardsMap.entrySet()) {
            shardsArray[i] = entry;
            i++;
        }

        int[][] shardRanges = new int[][]{ {2,4}, {0,2}, {1,3} };
        for (int[] shardRange : shardRanges) {
            // get shards subset
            Map.Entry<Short, byte[]>[] shardSubset =
                    Arrays.copyOfRange(shardsArray, shardRange[0], shardRange[1] + 1);
            Map<Short, byte[]> submap = new HashMap<>();
            for (Map.Entry<Short, byte[]> entry : shardSubset) {
                submap.put(entry.getKey(), entry.getValue());
            }

            byte[] newShard = ShamirCore.restore(submap, (short)(shardRange[1] + 2), null);
            byte[] oldShard = shardsArray[shardRange[1] + 1].getValue();
            assertArrayEquals(newShard, oldShard);

            Map<Short, byte[]> newSubmap = new HashMap<>(submap);
            newSubmap.put(shardsArray[shardRange[1] + 1].getKey(), newShard);
            byte[] r = ShamirCore.restore(newSubmap, null);
            assertEquals(secret, new String(r, StandardCharsets.US_ASCII));
        }

    }



}
