package com.imusic.app.plugins;

import android.content.Context;
import android.media.AudioManager;
import android.media.AudioDeviceInfo;
import android.os.Build;
import android.util.Log;

import com.chaquo.python.PyObject;
import com.chaquo.python.Python;
import com.chaquo.python.android.AndroidPlatform;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class DeviceServiceManager {
    private static final String TAG = "DeviceServiceManager";
    private static final String SERVICE_URL = "http://localhost:8201/local";
    private final Context context;
    private boolean isRunning = false;
    private final AudioManager audioManager;
    private ExecutorService executorService;
    private PyObject mainModule;

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
            
            // 复制 Python 文件到应用私有目录
            Log.d(TAG, "Copying Python files...");
            copyPythonFiles();
            
            // 初始化 Python
            if (!Python.isStarted()) {
                Python.start(new AndroidPlatform(context));
            }
            
            // 获取 Python 模块
            Python py = Python.getInstance();
            mainModule = py.getModule("main");
            
            // 启动服务
            executorService.execute(() -> {
                try {
                    mainModule.callAttr("start_service");
                    isRunning = true;
                    Log.d(TAG, "Device service started successfully");
                } catch (Exception e) {
                    Log.e(TAG, "Error starting Python service", e);
                    isRunning = false;
                }
            });

            // 启动健康检查
            startHealthCheck();
            
            Log.d(TAG, "Device service started successfully");
            
        } catch (Exception e) {
            Log.e(TAG, "Failed to start device service", e);
            e.printStackTrace();
            isRunning = false;
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

            if (mainModule != null) {
                mainModule.callAttr("stop_service");
                mainModule = null;
            }
            executorService.shutdown();
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
            File pythonDir = new File(context.getFilesDir(), "app");
            if (!pythonDir.exists()) {
                boolean created = pythonDir.mkdirs();
                Log.d(TAG, "Created app directory: " + created);
            }

            // 创建 tuner 子目录
            File tunerDir = new File(pythonDir, "tuner");
            if (!tunerDir.exists()) {
                boolean created = tunerDir.mkdirs();
                Log.d(TAG, "Created tuner directory: " + created);
            }

            // 复制主目录下的 Python 文件
            String[] mainFiles = {
                "main.py",
                "utils.py",
                "common.py",
                "config.py",
                "position_manager.py"
            };
            
            // 复制 tuner 目录下的文件
            String[] tunerFiles = {
                "tuner/pitch_detector.py"
            };

            // 合并所有需要复制的文件
            String[] allFiles = new String[mainFiles.length + tunerFiles.length];
            System.arraycopy(mainFiles, 0, allFiles, 0, mainFiles.length);
            System.arraycopy(tunerFiles, 0, allFiles, mainFiles.length, tunerFiles.length);

            // 复制所有文件
            for (String file : allFiles) {
                Log.d(TAG, "Copying file: " + file);
                try {
                    InputStream in = context.getAssets().open("python/" + file);
                    File outFile = new File(pythonDir, file);
                    
                    // 确保目标文件的父目录存在
                    File parentDir = outFile.getParentFile();
                    if (!parentDir.exists()) {
                        boolean created = parentDir.mkdirs();
                        Log.d(TAG, "Created parent directory for: " + file + ", success: " + created);
                    }
                    
                    OutputStream out = new FileOutputStream(outFile);
                    byte[] buffer = new byte[1024];
                    int read;
                    while ((read = in.read(buffer)) != -1) {
                        out.write(buffer, 0, read);
                    }
                    in.close();
                    out.close();
                    Log.d(TAG, "Successfully copied file: " + file);
                } catch (Exception e) {
                    Log.e(TAG, "Failed to copy file: " + file, e);
                    e.printStackTrace();
                }
            }
            Log.d(TAG, "Python files copy completed");
        } catch (Exception e) {
            Log.e(TAG, "Failed to copy Python files", e);
            e.printStackTrace();
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