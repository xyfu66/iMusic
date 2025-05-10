package com.imusic.app.plugins;

import android.content.Context;
import android.media.AudioManager;
import android.media.AudioDeviceInfo;
import android.os.Build;
import android.util.Log;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.io.IOException;

public class DeviceServiceManager {
    private static final String TAG = "DeviceServiceManager";
    private static final String SERVICE_URL = "http://localhost:8201/local";
    private final Context context;
    private final AudioManager audioManager;
    private ExecutorService executorService;
    private Process pythonProcess;
    private boolean isRunning = false;

    public DeviceServiceManager(Context context) {
        this.context = context;
        this.audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        this.executorService = Executors.newSingleThreadExecutor();
    }

    public List<AudioDeviceInfo> getAudioInputDevices() {
        List<AudioDeviceInfo> inputDevices = new ArrayList<>();
        if (audioManager != null) {
            AudioDeviceInfo[] devices = null;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                devices = audioManager.getDevices(AudioManager.GET_DEVICES_INPUTS);
                if (devices != null) {
                    for (AudioDeviceInfo device : devices) {
                        inputDevices.add(device);
                        Log.d(TAG, "Found input device: " + device.getProductName());
                    }
                }
            }
        }
        return inputDevices;
    }

    public void startService() {
        if (isRunning) {
            Log.d(TAG, "Service is already running");
            return;
        }

        try {
            Log.d(TAG, "Starting device service...");
            
            // 复制 Python 可执行文件到应用私有目录
            Log.d(TAG, "Copying Python executable...");
            copyPythonFiles();
            
            // 获取 Python 可执行文件路径
            File pythonDir = new File(context.getFilesDir(), "python");
            File pythonExe = new File(pythonDir, "device_service");
            
            // 再次确保可执行权限
            try {
                Process process = Runtime.getRuntime().exec("chmod 755 " + pythonExe.getAbsolutePath());
                int exitCode = process.waitFor();
                if (exitCode != 0) {
                    throw new RuntimeException("Failed to set executable permission");
                }
                Log.d(TAG, "Successfully set executable permission before starting service");
            } catch (Exception e) {
                Log.e(TAG, "Failed to set executable permission", e);
                throw new RuntimeException("Failed to set executable permission", e);
            }
            
            // 启动 Python 进程
            ProcessBuilder processBuilder = new ProcessBuilder(
                "sh", "-c",
                "cd " + pythonDir.getAbsolutePath() + " && " +
                "chmod 755 device_service && " +
                "chmod u+x device_service && " +
                "LD_LIBRARY_PATH=" + pythonDir.getAbsolutePath() + " " +
                "PYTHONPATH=" + pythonDir.getAbsolutePath() + " " +
                "PYTHONHOME=" + pythonDir.getAbsolutePath() + " " +
                "PYTHONUNBUFFERED=1 " +
                pythonDir.getAbsolutePath() + "/device_service --host 0.0.0.0 --port 8201"
            );
            processBuilder.directory(pythonDir);
            processBuilder.redirectErrorStream(true);
            
            // 设置环境变量
            processBuilder.environment().put("PYTHONPATH", pythonDir.getAbsolutePath());
            processBuilder.environment().put("PYTHONHOME", pythonDir.getAbsolutePath());
            processBuilder.environment().put("LD_LIBRARY_PATH", pythonDir.getAbsolutePath());
            processBuilder.environment().put("PYTHONUNBUFFERED", "1");
            
            pythonProcess = processBuilder.start();
            isRunning = true;
            
            // 读取进程输出
            new Thread(() -> {
                try {
                    BufferedReader reader = new BufferedReader(new InputStreamReader(pythonProcess.getInputStream()));
                    String line;
                    while ((line = reader.readLine()) != null) {
                        Log.d(TAG, "Python process: " + line);
                    }
                } catch (IOException e) {
                    Log.e(TAG, "Error reading Python process output", e);
                }
            }).start();
            
            // 启动健康检查
            startHealthCheck();
            
            Log.d(TAG, "Device service started successfully");
        } catch (Exception e) {
            Log.e(TAG, "Failed to start device service", e);
            e.printStackTrace();
            isRunning = false;
            throw new RuntimeException("Failed to start device service", e);
        }
    }

    public void stopService() {
        if (!isRunning) {
            Log.d(TAG, "Service is not running");
            return;
        }

        try {
            // 停止健康检查
            stopHealthCheck();
            
            // 终止 Python 进程
            if (pythonProcess != null) {
                pythonProcess.destroy();
                pythonProcess = null;
            }
            
            isRunning = false;
            Log.d(TAG, "Device service stopped successfully");
        } catch (Exception e) {
            Log.e(TAG, "Failed to stop device service", e);
        }
    }

    private void copyPythonFiles() {
        try {
            Log.d(TAG, "Starting Python files copy process...");
            
            // 确保目标目录存在
            File pythonDir = new File(context.getFilesDir(), "python");
            if (!pythonDir.exists()) {
                boolean created = pythonDir.mkdirs();
                Log.d(TAG, "Created python directory: " + created);
            }

            // 从 assets 复制可执行文件
            try {
                InputStream in = context.getAssets().open("python/device_service");
                File outFile = new File(pythonDir, "device_service");
                
                OutputStream out = new FileOutputStream(outFile);
                byte[] buffer = new byte[1024];
                int read;
                while ((read = in.read(buffer)) != -1) {
                    out.write(buffer, 0, read);
                }
                in.close();
                out.close();

                // 设置 SELinux 上下文
                try {
                    Process process = Runtime.getRuntime().exec("chcon u:object_r:app_data_file:s0 " + outFile.getAbsolutePath());
                    int exitCode = process.waitFor();
                    if (exitCode != 0) {
                        Log.w(TAG, "Failed to set SELinux context");
                    } else {
                        Log.d(TAG, "Successfully set SELinux context");
                    }
                } catch (Exception e) {
                    Log.w(TAG, "Failed to set SELinux context", e);
                }

                // 设置目录权限
                try {
                    Process process = Runtime.getRuntime().exec("chmod 755 " + pythonDir.getAbsolutePath());
                    int exitCode = process.waitFor();
                    if (exitCode != 0) {
                        Log.w(TAG, "Failed to set directory permission using chmod");
                    } else {
                        Log.d(TAG, "Successfully set directory permission using chmod");
                    }
                } catch (Exception e) {
                    Log.w(TAG, "Failed to set directory permission", e);
                }

                // 设置可执行权限
                if (!outFile.setExecutable(true, true)) {
                    Log.e(TAG, "Failed to set executable permission using Java API");
                    // 尝试使用 chmod 命令
                    try {
                        Process process = Runtime.getRuntime().exec("chmod 755 " + outFile.getAbsolutePath());
                        int exitCode = process.waitFor();
                        if (exitCode != 0) {
                            throw new RuntimeException("Failed to set executable permission using chmod");
                        }
                        Log.d(TAG, "Successfully set executable permission using chmod");
                    } catch (Exception e) {
                        Log.e(TAG, "Failed to set executable permission using chmod", e);
                        throw new RuntimeException("Failed to set executable permission", e);
                    }
                } else {
                    Log.d(TAG, "Successfully set executable permission using Java API");
                }

                Log.d(TAG, "Successfully copied device_service executable");
            } catch (Exception e) {
                Log.e(TAG, "Failed to copy device_service executable", e);
                throw e;
            }
            
            Log.d(TAG, "Python files copy completed");
        } catch (Exception e) {
            Log.e(TAG, "Failed to copy Python files", e);
            e.printStackTrace();
            throw new RuntimeException("Failed to copy Python files", e);
        }
    }

    private void startHealthCheck() {
        executorService.execute(() -> {
            int retryCount = 0;
            final int MAX_RETRIES = 3;
            final int RETRY_DELAY_MS = 2000;
            final int INITIAL_DELAY_MS = 3000;

            try {
                // 等待服务启动
                Thread.sleep(INITIAL_DELAY_MS);
                Log.d(TAG, "开始健康检查...");

                while (isRunning && retryCount < MAX_RETRIES) {
                    try {
                        Log.d(TAG, "尝试健康检查，第 " + (retryCount + 1) + " 次");
                        Process process = Runtime.getRuntime().exec("curl -s " + SERVICE_URL + "/health");
                        BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
                        String response = reader.readLine();
                        int exitCode = process.waitFor();

                        if (exitCode == 0 && response != null && response.contains("ok")) {
                            Log.d(TAG, "健康检查成功");
                            retryCount = 0;
                            Thread.sleep(5000); // 成功后等待5秒再检查
                        } else {
                            Log.w(TAG, "健康检查失败: exitCode=" + exitCode + ", response=" + response);
                            retryCount++;
                            if (retryCount < MAX_RETRIES) {
                                Log.d(TAG, "等待 " + RETRY_DELAY_MS + "ms 后重试...");
                                Thread.sleep(RETRY_DELAY_MS);
                            }
                        }
                    } catch (Exception e) {
                        Log.e(TAG, "健康检查出错: " + e.getMessage());
                        retryCount++;
                        if (retryCount < MAX_RETRIES) {
                            Log.d(TAG, "等待 " + RETRY_DELAY_MS + "ms 后重试...");
                            Thread.sleep(RETRY_DELAY_MS);
                        }
                    }
                }

                if (retryCount >= MAX_RETRIES) {
                    Log.e(TAG, "健康检查失败，停止服务");
                    stopService();
                }
            } catch (InterruptedException e) {
                Log.e(TAG, "健康检查线程被中断: " + e.getMessage());
            }
        });
    }

    private void stopHealthCheck() {
        if (executorService != null) {
            executorService.shutdown();
            executorService = Executors.newSingleThreadExecutor();
        }
    }
} 