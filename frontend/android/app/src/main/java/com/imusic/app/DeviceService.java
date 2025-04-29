package com.imusic.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.media.AudioDeviceInfo;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;
import java.util.List;

public class DeviceService extends Service {
    private static final String CHANNEL_ID = "DeviceServiceChannel";
    private static final int NOTIFICATION_ID = 1;
    private DeviceServiceManager deviceServiceManager;

    @Override
    public void onCreate() {
        super.onCreate();
        deviceServiceManager = new DeviceServiceManager(this);
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("iMusic Device Service")
                .setContentText("设备服务正在运行")
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .build();

        startForeground(NOTIFICATION_ID, notification);
        
        deviceServiceManager.startService();
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        deviceServiceManager.stopService();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    public List<AudioDeviceInfo> getAudioInputDevices() {
        return deviceServiceManager.getAudioInputDevices();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel serviceChannel = new NotificationChannel(
                    CHANNEL_ID,
                    "Device Service Channel",
                    NotificationManager.IMPORTANCE_DEFAULT
            );
            NotificationManager manager = getSystemService(NotificationManager.class);
            manager.createNotificationChannel(serviceChannel);
        }
    }
} 