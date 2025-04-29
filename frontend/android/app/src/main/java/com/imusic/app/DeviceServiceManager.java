package com.imusic.app;

import android.content.Context;
import android.media.AudioManager;
import android.media.AudioDeviceInfo;
import android.util.Log;
import org.python.core.PyObject;
import org.python.util.PythonInterpreter;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;

public class DeviceServiceManager {
    private static final String TAG = "DeviceServiceManager";
    private Context context;
    private PythonInterpreter interpreter;
    private boolean isRunning = false;
    private AudioManager audioManager;

    public DeviceServiceManager(Context context) {
        this.context = context;
        this.audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
    }

    public List<AudioDeviceInfo> getAudioInputDevices() {
        List<AudioDeviceInfo> inputDevices = new ArrayList<>();
        if (audioManager != null) {
            AudioDeviceInfo[] devices = audioManager.getDevices(AudioManager.GET_DEVICES_INPUTS);
            if (devices != null) {
                for (AudioDeviceInfo device : devices) {
                    inputDevices.add(device);
                    Log.d(TAG, "Found input device: " + device.getProductName());
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
            // 复制 Python 文件到应用私有目录
            copyPythonFiles();
            
            // 初始化 Python 解释器
            interpreter = new PythonInterpreter();
            
            // 设置 Python 路径
            String pythonPath = context.getFilesDir().getAbsolutePath();
            interpreter.exec("import sys\nsys.path.append('" + pythonPath + "')");
            
            // 导入并运行主程序
            interpreter.exec("from app.main import start_service");
            interpreter.exec("start_service()");
            
            isRunning = true;
            Log.d(TAG, "Device service started successfully");
        } catch (Exception e) {
            Log.e(TAG, "Failed to start device service", e);
        }
    }

    public void stopService() {
        if (!isRunning) {
            Log.d(TAG, "Service is not running");
            return;
        }

        try {
            if (interpreter != null) {
                interpreter.exec("from app.main import stop_service");
                interpreter.exec("stop_service()");
                interpreter.cleanup();
                interpreter = null;
            }
            isRunning = false;
            Log.d(TAG, "Device service stopped successfully");
        } catch (Exception e) {
            Log.e(TAG, "Failed to stop device service", e);
        }
    }

    private void copyPythonFiles() {
        try {
            // 确保目标目录存在
            File pythonDir = new File(context.getFilesDir(), "app");
            if (!pythonDir.exists()) {
                pythonDir.mkdirs();
            }

            // 复制 Python 文件
            String[] files = {"main.py", "utils.py", "tuner.py"};
            for (String file : files) {
                InputStream in = context.getAssets().open("python/" + file);
                File outFile = new File(pythonDir, file);
                OutputStream out = new FileOutputStream(outFile);
                byte[] buffer = new byte[1024];
                int read;
                while ((read = in.read(buffer)) != -1) {
                    out.write(buffer, 0, read);
                }
                in.close();
                out.close();
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to copy Python files", e);
        }
    }
} 