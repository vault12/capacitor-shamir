package com.vault12.plugins.shamir;

import android.util.Base64;

public class Base64Helper {
    public static String bytesToBase64String(byte[] bytes) {
        return Base64.encodeToString(bytes, Base64.DEFAULT).trim();
    }

    public static byte[] bytesFromBase64String(String string) {
        return Base64.decode(string, Base64.DEFAULT);
    }

}
