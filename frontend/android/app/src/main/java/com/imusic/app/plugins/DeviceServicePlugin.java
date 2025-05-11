package com.imusic.app.plugins;

import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import okio.ByteString;
import org.json.JSONObject;

@CapacitorPlugin(name = "DeviceService")
public class DeviceServicePlugin extends Plugin {
    private static final String TAG = "DeviceServicePlugin";
    private static final String SERVICE_URL = "http://localhost:8201/local";
    private Process pythonProcess;
    private ScheduledExecutorService healthCheckExecutor;
    private boolean isServiceRunning = false;
    private OkHttpClient client;
    private WebSocket webSocket;
    private DeviceServiceManager deviceServiceManager;

    @Override
    public void load() {
        // 初始化健康检查执行器
        healthCheckExecutor = Executors.newSingleThreadScheduledExecutor();
        deviceServiceManager = new DeviceServiceManager(getContext());
        client = new OkHttpClient.Builder()
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .writeTimeout(30, TimeUnit.SECONDS)
                .build();
    }

    @PluginMethod
    public void startDeviceService(PluginCall call) {
        if (isServiceRunning) {
            call.resolve();
            return;
        }

        try {
            deviceServiceManager.startService();
            isServiceRunning = true;
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "Failed to start service", e);
            call.reject("Failed to start service: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopDeviceService(PluginCall call) {
        if (!isServiceRunning) {
            call.resolve();
            return;
        }

        try {
            deviceServiceManager.stopService();
            isServiceRunning = false;
            call.resolve();
        } catch (Exception e) {
            Log.e(TAG, "Failed to stop service", e);
            call.reject("Failed to stop service: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getAudioDevices(PluginCall call) {
        Request request = new Request.Builder()
                .url(SERVICE_URL + "/audio-devices")
                .build();

        client.newCall(request).enqueue(new okhttp3.Callback() {
            @Override
            public void onFailure(okhttp3.Call okhttpCall, IOException e) {
                Log.e(TAG, "Failed to get audio devices", e);
                bridge.executeOnMainThread(() -> {
                    call.reject("Failed to get audio devices");
                });
            }

            @Override
            public void onResponse(okhttp3.Call okhttpCall, Response response) throws IOException {
                if (response.isSuccessful()) {
                    try {
                        String responseBody = response.body().string();
                        JSObject result = new JSObject(responseBody);
                        bridge.executeOnMainThread(() -> {
                            call.resolve(result);
                        });
                    } catch (Exception e) {
                        bridge.executeOnMainThread(() -> {
                            call.reject("Failed to parse response");
                        });
                    }
                } else {
                    bridge.executeOnMainThread(() -> {
                        call.reject("Failed to get audio devices");
                    });
                }
            }
        });
    }

    @PluginMethod
    public void getMidiDevices(PluginCall call) {
        Request request = new Request.Builder()
                .url(SERVICE_URL + "/midi-devices")
                .build();

        client.newCall(request).enqueue(new okhttp3.Callback() {
            @Override
            public void onFailure(okhttp3.Call okhttpFailCall, IOException e) {
                Log.e(TAG, "Failed to get MIDI devices", e);
                bridge.executeOnMainThread(() -> {
                    call.reject("Failed to get MIDI devices");
                });
            }

            @Override
            public void onResponse(okhttp3.Call okhttpResCall, Response response) throws IOException {
                if (response.isSuccessful()) {
                    try {
                        String responseBody = response.body().string();
                        JSObject result = new JSObject(responseBody);
                        bridge.executeOnMainThread(() -> {
                            call.resolve(result);
                        });
                    } catch (Exception e) {
                        bridge.executeOnMainThread(() -> {
                            call.reject("Failed to parse response");
                        });
                    }
                } else {
                    bridge.executeOnMainThread(() -> {
                        call.reject("Failed to get MIDI devices");
                    });
                }
            }
        });
    }

    @PluginMethod
    public void connectWebSocket(PluginCall call) {
        String url = call.getString("url", SERVICE_URL + "/ws");
        Request request = new Request.Builder()
                .url(url)
                .build();

        webSocket = client.newWebSocket(request, new WebSocketListener() {
            @Override
            public void onOpen(WebSocket webSocket, Response response) {
                Log.d(TAG, "WebSocket connected");
                bridge.executeOnMainThread(() -> {
                    call.resolve();
                });
            }

            @Override
            public void onMessage(WebSocket webSocket, String text) {
                Log.d(TAG, "Received message: " + text);
                try {
                    JSObject message = new JSObject(text);
                    bridge.executeOnMainThread(() -> {
                        notifyListeners("message", message);
                    });
                } catch (Exception e) {
                    Log.e(TAG, "Failed to parse message", e);
                }
            }

            @Override
            public void onMessage(WebSocket webSocket, ByteString bytes) {
                Log.d(TAG, "Received bytes: " + bytes.hex());
            }

            @Override
            public void onClosing(WebSocket webSocket, int code, String reason) {
                Log.d(TAG, "WebSocket closing: " + reason);
                webSocket.close(1000, null);
            }

            @Override
            public void onClosed(WebSocket webSocket, int code, String reason) {
                Log.d(TAG, "WebSocket closed: " + reason);
            }

            @Override
            public void onFailure(WebSocket webSocket, Throwable t, Response response) {
                Log.e(TAG, "WebSocket failure", t);
                bridge.executeOnMainThread(() -> {
                    call.reject("WebSocket connection failed");
                });
            }
        });
    }

    @PluginMethod
    public void disconnectWebSocket(PluginCall call) {
        if (webSocket != null) {
            webSocket.close(1000, "Disconnected by client");
            webSocket = null;
        }
        call.resolve();
    }

    @PluginMethod
    public void sendWebSocketMessage(PluginCall call) {
        if (webSocket == null) {
            call.reject("WebSocket is not connected");
            return;
        }

        try {
            JSONObject message = call.getData();
            boolean sent = webSocket.send(message.toString());
            if (sent) {
                call.resolve();
            } else {
                call.reject("Failed to send message");
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to send message", e);
            call.reject("Failed to send message");
        }
    }

    @Override
    protected void handleOnDestroy() {
        stopDeviceService(null);
        super.handleOnDestroy();
    }
}
