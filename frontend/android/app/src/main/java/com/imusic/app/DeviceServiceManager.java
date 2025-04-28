package com.imusic.app;

import android.content.Context;
import android.util.Log;
import org.python.core.PyObject;
import org.python.util.PythonInterpreter;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

public class DeviceServiceManager {
    private static final String TAG = "DeviceServiceManager";
    private Context context;
    private PythonInterpreter interpreter;
    private boolean isRunning = false;

    public DeviceServiceManager(Context context) {
        this.context = context;
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

    private void copyPythonFiles() throws Exception {
        // 复制 Python 文件从 assets 到应用私有目录
        String[] files = {
            "app/main.py",
            "app/utils.py",
            "app/common.py",
            "app/config.py",
            "app/position_manager.py"
        };

        for (String file : files) {
            File destFile = new File(context.getFilesDir(), file);
            destFile.getParentFile().mkdirs();
            
            try (InputStream in = context.getAssets().open(file);
                 OutputStream out = new FileOutputStream(destFile)) {
                byte[] buffer = new byte[1024];
                int read;
                while ((read = in.read(buffer)) != -1) {
                    out.write(buffer, 0, read);
                }
            }
        }
    }
} 