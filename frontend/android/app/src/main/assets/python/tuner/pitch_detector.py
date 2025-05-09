import numpy as np
import librosa
import asyncio
from fastapi import WebSocket
from fastapi.websockets import WebSocketState
import pyaudio

class PitchDetector:
    def __init__(self, sample_rate=44100, frame_size=1024):
        self.sample_rate = sample_rate
        self.frame_size = frame_size
        self.p = None
        self.stream = None

    def initialize_stream(self, device_index):
        """初始化音频流"""
        self.p = pyaudio.PyAudio()
        self.stream = self.p.open(
            format=pyaudio.paFloat32,
            channels=1,
            rate=self.sample_rate,
            input=True,
            frames_per_buffer=self.frame_size,
            input_device_index=device_index,
        )

    def cleanup(self):
        """清理资源"""
        if self.stream:
            self.stream.stop_stream()
            self.stream.close()
        if self.p:
            self.p.terminate()

    async def detect_pitch(self, websocket: WebSocket):
        """音高检测循环"""
        try:
            while websocket.client_state == WebSocketState.CONNECTED:
                # 读取音频数据
                data = self.stream.read(self.frame_size, exception_on_overflow=False)
                samples = np.frombuffer(data, dtype=np.float32)

                # 计算音量
                volume = np.sqrt(np.mean(samples**2))

                if volume <= 0.01 or len(samples) == 0:
                    await websocket.send_json({
                        "no_sound": True
                    })
                    continue

                # 使用librosa检测音高
                if len(samples) > 0 and volume > 0.01:
                    # 应用汉宁窗
                    window = np.hanning(len(samples))
                    samples = samples * window

                    # 计算短时傅里叶变换
                    D = librosa.stft(samples, n_fft=2048, hop_length=512)
                    # 计算频谱
                    S = np.abs(D)
                    # 找到最大幅度的频率
                    max_freq_idx = np.argmax(S, axis=0)
                    # 转换为频率
                    freqs = librosa.fft_frequencies(sr=self.sample_rate, n_fft=2048)
                    frequency = freqs[max_freq_idx[-1]]

                    # 应用频率范围过滤（小提琴的频率范围大约在196Hz到659Hz之间）
                    if 100 <= frequency <= 1000:
                        await websocket.send_json({
                            "frequency": float(frequency),
                            "volume": float(volume)
                        })
                        print(f"[DEBUG] Frequency: {frequency}, Volume: {volume}")
                    else:
                        await websocket.send_json({
                            "no_sound": True
                        })
                        print(f"[DEBUG] Frequency out of range: {frequency}")

                await asyncio.sleep(0.01)
        except Exception as e:
            print(f"[DEBUG] Error in pitch detection loop: {e}")
            if websocket.client_state == WebSocketState.CONNECTED:
                await websocket.send_json({"error": str(e)}) 