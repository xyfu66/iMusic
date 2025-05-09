package com.imusic.app.plugins;

import android.content.Intent;
import android.media.AudioDeviceInfo;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "DeviceService")
public class DeviceServicePlugin extends Plugin {
    private DeviceServiceManager deviceServiceManager;

    @Override
    public void load() {
        deviceServiceManager = new DeviceServiceManager(getContext());
    }

    @PluginMethod
    public void startDeviceService(PluginCall call) {
        try {
            Intent serviceIntent = new Intent(getContext(), DeviceService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(serviceIntent);
            } else {
                getContext().startService(serviceIntent);
            }
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to start device service", e);
        }
    }

    @PluginMethod
    public void stopDeviceService(PluginCall call) {
        try {
            Intent serviceIntent = new Intent(getContext(), DeviceService.class);
            getContext().stopService(serviceIntent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to stop device service", e);
        }
    }

}
