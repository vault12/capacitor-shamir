package com.vault12.plugins.shamir;

public interface WriteableBlobSource {
    void write(byte[] data) throws Exception;
}
