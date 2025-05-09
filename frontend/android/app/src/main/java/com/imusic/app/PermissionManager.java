package com.imusic.app;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import java.util.ArrayList;
import java.util.List;

public class PermissionManager {
    private static final String TAG = "PermissionManager";
    private static final String[] REQUIRED_PERMISSIONS = {
        Manifest.permission.RECORD_AUDIO,
        Manifest.permission.READ_EXTERNAL_STORAGE,
        Manifest.permission.MODIFY_AUDIO_SETTINGS
    };

    private static final String[] BLUETOOTH_PERMISSIONS = {
        Manifest.permission.BLUETOOTH,
        Manifest.permission.BLUETOOTH_ADMIN,
        Manifest.permission.BLUETOOTH_SCAN,
        Manifest.permission.BLUETOOTH_ADVERTISE,
        Manifest.permission.BLUETOOTH_CONNECT
    };

    public static boolean checkAndRequestPermissions(Activity activity) {
        List<String> permissionsToRequest = new ArrayList<>();

        // 检查基本权限
        for (String permission : REQUIRED_PERMISSIONS) {
            try {
                if (ContextCompat.checkSelfPermission(activity, permission)
                        != PackageManager.PERMISSION_GRANTED) {
                    Log.d(TAG, "Permission not granted: " + permission);
                    permissionsToRequest.add(permission);
                } else {
                    Log.d(TAG, "Permission already granted: " + permission);
                }
            } catch (SecurityException e) {
                Log.w(TAG, "Permission not available on this device: " + permission);
            }
        }

        // 检查蓝牙权限（Android 12及以上版本需要）
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            for (String permission : BLUETOOTH_PERMISSIONS) {
                if (ContextCompat.checkSelfPermission(activity, permission)
                        != PackageManager.PERMISSION_GRANTED) {
                    Log.d(TAG, "Bluetooth permission not granted: " + permission);
                    permissionsToRequest.add(permission);
                } else {
                    Log.d(TAG, "Bluetooth permission already granted: " + permission);
                }
            }
        }

        // 即使所有权限都已授予，也请求一次权限以触发回调
        if (permissionsToRequest.isEmpty()) {
            Log.d(TAG, "All permissions are already granted, requesting again to trigger callback");
            permissionsToRequest.add(REQUIRED_PERMISSIONS[0]); // 添加一个已授予的权限
        }

        Log.d(TAG, "Requesting permissions: " + String.join(", ", permissionsToRequest));
        ActivityCompat.requestPermissions(
            activity,
            permissionsToRequest.toArray(new String[0]),
            1
        );
        return true;
    }

    public static boolean hasAudioPermissions(Activity activity) {
        boolean hasRecordAudio = ContextCompat.checkSelfPermission(activity, Manifest.permission.RECORD_AUDIO)
                == PackageManager.PERMISSION_GRANTED;
        boolean hasModifyAudio = ContextCompat.checkSelfPermission(activity, Manifest.permission.MODIFY_AUDIO_SETTINGS)
                == PackageManager.PERMISSION_GRANTED;
        return hasRecordAudio && hasModifyAudio;
    }
} 