package com.imusic.app.plugins;

import android.content.Context;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "AudioDevice")
public class AudioDevicePlugin extends Plugin {
    private AudioManager audioManager;

    @Override
    public void load() {
        audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
    }

    @PluginMethod
    public void getAudioInputDevices(PluginCall call) {
        List<JSObject> deviceList = new ArrayList<>();
        if (audioManager != null) {
            AudioDeviceInfo[] devices = audioManager.getDevices(AudioManager.GET_DEVICES_INPUTS);
            if (devices != null) {
                for (int i = 0; i < devices.length; i++) {
                    AudioDeviceInfo device = devices[i];
                    JSObject deviceObj = new JSObject();
                    deviceObj.put("index", i);
                    deviceObj.put("name", device.getProductName().toString());
                    
                    deviceList.add(deviceObj);
                }
            }
        }

        JSObject ret = new JSObject();
        ret.put("devices", deviceList);
        call.resolve(ret);
    }
} 