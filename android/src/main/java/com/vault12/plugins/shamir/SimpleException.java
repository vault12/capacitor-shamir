package com.vault12.plugins.shamir;

import androidx.annotation.Nullable;

public class SimpleException extends Exception {
    private String tag = null;
    private final String message;

    public SimpleException(String message) {
        super(message);
        this.message = message;
    }

    public SimpleException(String tag, String message) {
        super(message);
        this.tag = tag;
        this.message = message;
    }

    @Nullable
    @Override
    public String getMessage() {
        if (tag != null) {
            return "[" + tag + "] " + message;
        }
        return message;
    }
}