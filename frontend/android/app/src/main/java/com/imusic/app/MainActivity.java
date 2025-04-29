package com.imusic.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.imusic.app.plugins.AudioDevicePlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registerPlugin(AudioDevicePlugin.class);
        PermissionManager.checkAndRequestPermissions(this);
    }
}
