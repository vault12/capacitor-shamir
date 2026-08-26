package com.vault12.plugins.shamir;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;

import org.junit.Test;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Shard parsing is the single validation site for the in-memory restore path. */
public class ShamirPluginUnitTest {

    @Test
    public void parseShardIndexReadsIndexByteAsUnsigned() throws SimpleException {
        // indexes 128...255 have the high bit set and must not arrive sign extended
        for (int index : new int[]{ 1, 127, 128, 200, 255 }) {
            assertEquals(index, ShamirPlugin.parseShardIndex(new byte[]{ (byte) index, 42 }));
        }
    }

    @Test
    public void parseShardIndexRejectsReservedIndexZeroAndShortShards() {
        assertThrows(SimpleException.class, () -> ShamirPlugin.parseShardIndex(new byte[]{ 0, 42 }));
        assertThrows(SimpleException.class, () -> ShamirPlugin.parseShardIndex(new byte[]{ 1 }));
        assertThrows(SimpleException.class, () -> ShamirPlugin.parseShardIndex(null));
    }

    @Test
    public void parseShardsWithIndexesRejectsDuplicateIndexes() throws SimpleException {
        List<byte[]> shardsData = new ArrayList<>();
        shardsData.add(new byte[]{ 1, 42 });
        shardsData.add(new byte[]{ 2, 43 });
        assertEquals(2, ShamirPlugin.parseShardsWithIndexes(shardsData).size());

        shardsData.add(new byte[]{ 1, 44 });
        assertThrows(SimpleException.class, () -> ShamirPlugin.parseShardsWithIndexes(shardsData));
    }

    @Test
    public void parsedShardsRestoreThroughTheCore() throws SimpleException {
        byte[] secretBytes = "hello world".getBytes(StandardCharsets.US_ASCII);
        Map<Short, byte[]> shardsMap = ShamirCore.split(secretBytes, (short) 255, (short) 2, null);

        // wire format round trip at high indexes: index byte + payload, parsed back and restored
        List<byte[]> shardsData = new ArrayList<>();
        for (int index : new int[]{ 128, 255 }) {
            byte[] payload = shardsMap.get((short) index);
            byte[] wire = new byte[payload.length + 1];
            wire[0] = (byte) index;
            System.arraycopy(payload, 0, wire, 1, payload.length);
            shardsData.add(wire);
        }
        assertArrayEquals(secretBytes, ShamirCore.restore(ShamirPlugin.parseShardsWithIndexes(shardsData), null));
    }

}
