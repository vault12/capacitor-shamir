package com.vault12.plugins.shamir;

public interface ReadableBlobSource {
    byte[] read(long offset, long count) throws Exception;
}
