package com.vault12.plugins.shamir;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class PluginExecutorService {
    private static ExecutorService mExecutor;

    private PluginExecutorService() {};

    public static ExecutorService getExecutor() {
        if (mExecutor == null) {
            mExecutor = Executors.newCachedThreadPool();
        }
        return mExecutor;
    }
}
