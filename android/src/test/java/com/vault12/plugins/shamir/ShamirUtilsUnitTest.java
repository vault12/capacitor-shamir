package com.vault12.plugins.shamir;

import static org.junit.Assert.assertThrows;

import org.junit.Test;

import java.io.File;
import java.io.FileOutputStream;

public class ShamirUtilsUnitTest {

    @Test
    public void restoreFromFileShardsRejectsShardFilesWithoutData() throws Exception {
        // A shard file is an index byte followed by shard data: index-only files used to slip
        // through as srcLength == 0 and "restore" an empty secret with a NaN progress report
        String[] srcPaths = { shardFile(1), shardFile(2) };
        assertThrows(SimpleException.class, () -> ShamirUtils.restoreFromFileShardsToData(srcPaths, progress -> {}));
    }

    private static String shardFile(int index) throws Exception {
        File file = File.createTempFile("shard_" + index, ".bin");
        file.deleteOnExit();
        try (FileOutputStream out = new FileOutputStream(file)) {
            out.write(index);
        }
        return file.getAbsolutePath();
    }

}
