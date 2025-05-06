package com.vault12.plugins.shamir;

import java.io.FileOutputStream;

public class FileOutputStreamModel {
    private final String path;
    private final FileOutputStream stream;

    public FileOutputStreamModel(String thePath, FileOutputStream theStream) {
        this.path = thePath;
        this.stream = theStream;
    }

    public String getPath() {
        return path;
    }

    public FileOutputStream getStream() {
        return stream;
    }
}