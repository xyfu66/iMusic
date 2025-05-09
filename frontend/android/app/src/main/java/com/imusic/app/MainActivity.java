package com.imusic.app;

import android.os.Bundle;
import android.util.Log;
import android.content.Intent;
import com.getcapacitor.BridgeActivity;
import com.imusic.app.plugins.DeviceServicePlugin;
import com.imusic.app.plugins.DeviceService;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // 首先检查权限
        Log.d(TAG, "Checking permissions...");
        boolean permissionsRequested = PermissionManager.checkAndRequestPermissions(this);
        Log.d(TAG, "Permission check completed, permissions requested: " + permissionsRequested);
        
        // 注册插件
        Log.d(TAG, "Registering plugins...");
        try {
            registerPlugin(DeviceServicePlugin.class);
            Log.d(TAG, "Plugins registered successfully");
        } catch (Exception e) {
            Log.e(TAG, "Error registering plugins: " + e.getMessage(), e);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        Log.d(TAG, "onRequestPermissionsResult called with requestCode: " + requestCode);
        Log.d(TAG, "Permissions requested: " + String.join(", ", permissions));
        
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        
        if (requestCode == 1) {
            boolean allGranted = true;
            for (int i = 0; i < permissions.length; i++) {
                String permission = permissions[i];
                int result = grantResults[i];
                Log.d(TAG, "Permission " + permission + " result: " + 
                    (result == android.content.pm.PackageManager.PERMISSION_GRANTED ? "GRANTED" : "DENIED"));
                
                if (result != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    allGranted = false;
                }
            }
            
            Log.d(TAG, "All permissions granted: " + allGranted);
            
            // 如果所有权限都已授予，启动设备服务
            if (allGranted) {
                Log.d(TAG, "Starting device service after permissions granted...");
                Intent serviceIntent = new Intent(this, DeviceService.class);
                startService(serviceIntent);
                Log.d(TAG, "Device service started after permissions granted");
            } else {
                Log.w(TAG, "Some permissions were denied");
            }
        }
    }
}
