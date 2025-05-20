package com.vault12.plugins.shamir;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayOutputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@CapacitorPlugin(name = "Shamir")
public class ShamirPlugin extends Plugin {

    private static final String TAG = "ShamirPlugin";
    private static final String PREFIX = "[" + TAG + "] ";

    /**
     * Plugin methods
     */

    @PluginMethod(returnType = PluginMethod.RETURN_CALLBACK)
    public void generateShards(PluginCall call) {
        PluginExecutorService.getExecutor().execute(() -> {
            int totalShards = call.getInt("totalShards");
            int threshold = call.getInt("threshold");
            if (threshold > 255 || totalShards > 255) {
                call.reject(PREFIX + "generateShards() Threshold and total shares must be <= 255");
                return;
            }
            String inputDataBase64 = call.getString("inputDataBase64", "");
            byte[] inputData = Base64Helper.bytesFromBase64String(inputDataBase64);
            if (inputData == null) {
                call.reject(PREFIX + "generateShards() invalid input data");
                return;
            }
            call.setKeepAlive(true);
            try {
                Map<Short, byte[]> shards = ShamirUtils.generateShards(inputData, (short) totalShards, (short) threshold, progress -> {
                    call.resolve(new JSObject().put("progress", progress));
                });
                JSObject result = new JSObject().put("progress", 1);
                JSArray shardsBase64 = new JSArray();
                for (Map.Entry<Short, byte[]> entry : shards.entrySet()) {
                    ByteArrayOutputStream stream = new ByteArrayOutputStream();
                    stream.write(entry.getKey());
                    stream.write(entry.getValue());
                    byte[] data = stream.toByteArray();
                    shardsBase64.put(Base64Helper.bytesToBase64String(data));
                }
                result.put("shardsBase64", shardsBase64);
                call.setKeepAlive(false);
                call.resolve(result);
            } catch (Exception e) {
                e.printStackTrace();
                call.setKeepAlive(false);
                call.reject(e.getMessage());
            }
        });
    }

    @PluginMethod(returnType = PluginMethod.RETURN_CALLBACK)
    public void restoreFromShards(PluginCall call) {
        PluginExecutorService.getExecutor().execute(() -> {
            try {
                JSArray shardsBase64 = call.getArray("inputShardsBase64");
                Map<Short, byte[]> shards = parseShardsWithIndexesFromBase64(shardsBase64);
                call.setKeepAlive(true);
                byte[] secret = ShamirUtils.restoreSecret(shards, progress -> {
                    call.resolve(new JSObject().put("progress", progress));
                });
                call.setKeepAlive(false);
                call.resolve(new JSObject()
                        .put("progress", 1.0)
                        .put("dataBase64", Base64Helper.bytesToBase64String(secret)));
            } catch (Exception e) {
                e.printStackTrace();
                call.setKeepAlive(false);
                call.reject(e.getMessage());
            }
        });
    }

    @PluginMethod(returnType = PluginMethod.RETURN_CALLBACK)
    public void restoreShard(PluginCall call) {
        PluginExecutorService.getExecutor().execute(() -> {
            try {
                JSArray shardsBase64 = call.getArray("inputShardsBase64");
                Map<Short, byte[]> shards = parseShardsWithIndexesFromBase64(shardsBase64);
                int newIndex = call.getInt("shardIndex");
                if (newIndex < 0 || newIndex > 255) {
                    call.reject(PREFIX + "restoreShard() Shard index must be between 0 and 255");
                    return;
                }
                call.setKeepAlive(true);
                byte[] shard = ShamirUtils.restoreShard(shards, (short) newIndex, progress -> {
                    call.resolve(new JSObject().put("progress", progress));
                });
                byte[] shardWithIndex = new byte[shard.length + 1];
                shardWithIndex[0] = (byte) newIndex;
                System.arraycopy(shard, 0, shardWithIndex, 1, shard.length);
                call.setKeepAlive(false);
                call.resolve(new JSObject()
                        .put("progress", 1.0)
                        .put("dataBase64", Base64Helper.bytesToBase64String(shardWithIndex)));
            } catch (Exception e) {
                e.printStackTrace();
                call.setKeepAlive(false);
                call.reject(e.getMessage());
            }
        });
    }

    @PluginMethod(returnType = PluginMethod.RETURN_CALLBACK)
    public void generateFileShards(PluginCall call) {
        PluginExecutorService.getExecutor().execute(() -> {
            int totalShards = call.getInt("totalShards");
            int threshold = call.getInt("threshold");
            if (threshold > 255 || totalShards > 255) {
                call.reject(PREFIX + "generateFileShards() Threshold and total shares must be <= 255");
                return;
            }
            String srcPath = call.getString("srcPath", "");
            String dstPathRoot = call.getString("dstPathRoot", "");
            if (dstPathRoot.isEmpty()) {
                dstPathRoot = getCacheDir();
            }
            call.setKeepAlive(true);
            try {
                String[] paths = ShamirUtils.generateFileShards((short) totalShards, (short) threshold, srcPath, dstPathRoot, progress -> {
                    call.resolve(new JSObject().put("progress", progress));
                });
                call.setKeepAlive(false);
                call.resolve(new JSObject()
                        .put("progress", 1.0)
                        .put("shardsPaths", new JSArray(paths)));
            } catch (Exception e) {
                e.printStackTrace();
                call.setKeepAlive(false);
                call.reject(e.getMessage());
            }
        });
    }

    @PluginMethod(returnType = PluginMethod.RETURN_CALLBACK)
    public void generateShardsToFiles(PluginCall call) {
        PluginExecutorService.getExecutor().execute(() -> {
            int totalShards = call.getInt("totalShards");
            int threshold = call.getInt("threshold");
            if (threshold > 255 || totalShards > 255) {
                call.reject(PREFIX + "generateFileShards() Threshold and total shares must be <= 255");
                return;
            }
            String dstPathRoot = call.getString("dstPathRoot", "");
            if (dstPathRoot.isEmpty()) {
                dstPathRoot = getCacheDir();
            }
            String inputDataBase64 = call.getString("inputDataBase64", "");
            byte[] inputData = Base64Helper.bytesFromBase64String(inputDataBase64);
            if (inputData == null) {
                call.reject(PREFIX + "generateShards() invalid input data");
                return;
            }
            call.setKeepAlive(true);
            try {
                String[] paths = ShamirUtils.generateShardsToFiles((short) totalShards, (short) threshold, inputData, dstPathRoot, progress -> {
                    call.resolve(new JSObject().put("progress", progress));
                });
                call.setKeepAlive(false);
                call.resolve(new JSObject()
                        .put("progress", 1.0)
                        .put("shardsPaths", new JSArray(paths)));
            } catch (Exception e) {
                e.printStackTrace();
                call.setKeepAlive(false);
                call.reject(e.getMessage());
            }
        });
    }

    @PluginMethod(returnType = PluginMethod.RETURN_CALLBACK)
    public void restoreFromFileShards(PluginCall call) {
        PluginExecutorService.getExecutor().execute(() -> {
            try {
                List<String> shardsPathList = call.getArray("shardsPaths").toList();
                String[] shardsPaths = shardsPathList.toArray(new String[0]);
                String dstPath = call.getString("dstPath", "");
                call.setKeepAlive(true);
                ShamirUtils.restoreFromFileShardsToFile(shardsPaths, dstPath, progress -> {
                    call.resolve(new JSObject().put("progress", progress));
                });
                call.setKeepAlive(false);
                call.resolve(new JSObject()
                        .put("progress", 1.0)
                        .put("dstPath", dstPath)
                );
            } catch (Exception e) {
                e.printStackTrace();
                call.setKeepAlive(false);
                call.reject(e.getMessage());
            }
        });
    }

    @PluginMethod(returnType = PluginMethod.RETURN_CALLBACK)
    public void restoreFromFileShardsToData(PluginCall call) {
        PluginExecutorService.getExecutor().execute(() -> {
            try {
                List<String> shardsPathList = call.getArray("shardsPaths").toList();
                String[] shardsPaths = shardsPathList.toArray(new String[0]);
                call.setKeepAlive(true);
                byte[] data = ShamirUtils.restoreFromFileShardsToData(shardsPaths, progress -> {
                    call.resolve(new JSObject().put("progress", progress));
                });
                call.setKeepAlive(false);
                call.resolve(new JSObject()
                        .put("progress", 1.0)
                        .put("dataBase64", Base64Helper.bytesToBase64String(data))
                );
            } catch (Exception e) {
                e.printStackTrace();
                call.setKeepAlive(false);
                call.reject(e.getMessage());
            }
        });
    }

    @PluginMethod(returnType = PluginMethod.RETURN_CALLBACK)
    public void restoreFileShard(PluginCall call) {
        PluginExecutorService.getExecutor().execute(() -> {
            try {
                int shardIndex = call.getInt("shardIndex");
                if (shardIndex > 255) {
                    call.reject(PREFIX + "restoreFileShard() Shard index must be <= 255");
                    return;
                }
                List<String> shardsPathList = call.getArray("shardsPaths").toList();
                String[] shardsPaths = shardsPathList.toArray(new String[0]);
                String dstPathRoot = call.getString("dstPathRoot", "");
                if (dstPathRoot.isEmpty()) {
                    dstPathRoot = getCacheDir();
                }
                call.setKeepAlive(true);
                String shardPath = ShamirUtils.restoreShardFromFileShards(shardsPaths, dstPathRoot, (short) shardIndex, progress -> {
                    call.resolve(new JSObject().put("progress", progress));
                });
                call.setKeepAlive(false);
                call.resolve(new JSObject()
                        .put("progress", 1.0)
                        .put("shardPath", shardPath)
                );
            } catch (Exception e) {
                e.printStackTrace();
                call.setKeepAlive(false);
                call.reject(e.getMessage());
            }
        });
    }

    /**
     * Helpers
     */

    private Map<Short, byte[]> parseShardsWithIndexesFromBase64(JSArray shardsBase64) throws SimpleException {
        Map<Short, byte[]> shards = new HashMap<>();
        for (int i = 0; i < shardsBase64.length(); i++) {
            byte[] data = Base64Helper.bytesFromBase64String(shardsBase64.optString(i, ""));
            if (data == null || data.length < 2) {
                throw new SimpleException(TAG, "restoreSecret() invalid shard data");
            }
            byte[] shard = new byte[data.length - 1];
            System.arraycopy(data, 1, shard, 0, shard.length);
            shards.put((short) data[0], shard);
        }
        return shards;
    }

    private String getCacheDir() {
        return bridge.getContext().getCacheDir().getAbsolutePath();
    }
}
