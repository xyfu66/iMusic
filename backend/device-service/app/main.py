import asyncio
import math
import warnings
import debugpy
import os
import numpy as np
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, Optional
import pyaudio
import librosa

warnings.filterwarnings("ignore", module="partitura")

from fastapi import FastAPI, File, UploadFile, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from starlette.websockets import WebSocketState

from .position_manager import position_manager
from .utils import (
    get_audio_devices,
    get_midi_devices,
    run_score_following,
    cleanup_temp_files,
)

# 在 FastAPI 应用启动前添加
# 获取环境变量，默认为 production
ENV = os.getenv("APP_ENV", "production")

# 只在开发环境启用 debugpy
if ENV == "development":
    debugpy.listen(5678)
    print("Waiting for debugger to attach...")
    debugpy.wait_for_client()
    print("Debugger attached!")


app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:50003", "http://127.0.0.1:50003"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
executor = ThreadPoolExecutor(max_workers=1)


# ================== API ==================
@app.get("/")
async def root():
    return {"message": "Hello World"}


@app.get("/local/")
async def root():
    return {"message": "Hello local"}


@app.get("/local/audio-devices")
async def audio_devices():
    """
    获取音频设备列表
    """
    devices = get_audio_devices()
    return {"devices": devices}


@app.get("/local/midi-devices")
async def midi_devices():
    """
    获取 MIDI 设备列表
    """
    devices = get_midi_devices()
    return {"devices": devices}



@app.websocket("/local/ws")
async def websocket_endpoint(websocket: WebSocket):
    tasks = []  # 存储所有需要管理的任务
    main_task = None
    
    async def listen_for_stop():
        try:
            while True:
                data = await websocket.receive_json()
                if data.get("action") == "stop":
                    print("[DEBUG] Received stop signal")
                    return True
        except Exception as e:
            print(f"[DEBUG] Error in stop listener: {e}")
            return True

    async def update_position(file_id):
        prev_position = 0
        iteration_count = 0
        try:
            while websocket.client_state == WebSocketState.CONNECTED:
                current_position = position_manager.get_position(file_id)
                iteration_count += 1
                print(f"[DEBUG] Iteration {iteration_count}: Current position: {current_position}")
                
                if not math.isclose(current_position, prev_position, abs_tol=0.001):
                    await websocket.send_json({"beat_position": current_position})
                    prev_position = current_position

                await asyncio.sleep(0.1)
        except Exception as e:
            print(f"[DEBUG] Error in position updater: {e}")

    try:
        position_manager.reset()
        await websocket.accept()
        print("[DEBUG] WebSocket connection accepted")
        
        data = await websocket.receive_json()
        file_id = data.get("file_id")
        input_type = data.get("input_type", "audio")
        is_performce_model = data.get("isPerformceModel", False)
        device = data.get("device")
        print(f"[DEBUG] Received data: {data}")

        # 使用线程池执行主要任务
        loop = asyncio.get_event_loop()
        with ThreadPoolExecutor(max_workers=1) as executor:
            main_task = loop.run_in_executor(
                executor,
                lambda: asyncio.run(run_score_following(file_id, input_type, is_performce_model, device))
            )
            
            # 创建并启动所有任务
            stop_listener = asyncio.create_task(listen_for_stop())
            position_updater = asyncio.create_task(update_position(file_id))
            tasks.extend([stop_listener, position_updater])

            # 等待任意一个任务完成
            done, pending = await asyncio.wait(
                [stop_listener, position_updater, main_task],
                return_when=asyncio.FIRST_COMPLETED
            )

            # 如果是停止信号或者出错，取消所有任务
            should_stop = any(
                t in done and (
                    (t == stop_listener and t.result()) or  # 停止信号
                    (t == main_task and isinstance(t.result(), dict) and "error" in t.result())  # 错误
                )
                for t in done
            )

            if should_stop:
                print("[DEBUG] Stopping all tasks...")
                # 取消所有未完成的任务
                for task in pending:
                    if not task.done():
                        task.cancel()
                # 取消主任务
                if not main_task.done():
                    main_task.cancel()
                
                # 等待所有任务完成取消
                await asyncio.gather(*pending, return_exceptions=True)

    except Exception as e:
        print(f"[DEBUG] WebSocket error: {e}")
        if websocket.client_state == WebSocketState.CONNECTED:
            await websocket.send_json({"error": str(e)})
    finally:
        print("[DEBUG] Cleaning up...")
        # 确保所有任务都被取消
        for task in tasks:
            if not task.done():
                task.cancel()
        if main_task and not main_task.done():
            main_task.cancel()
        
        # 等待所有任务完成取消
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        
        if websocket.client_state == WebSocketState.CONNECTED:
            await websocket.close()
        position_manager.reset()
        cleanup_temp_files()


@app.websocket("/local/ws/tuner/violin")
async def violin_tuner(websocket: WebSocket):
    """
    小提琴调音器的WebSocket端点
    """
    audio_stream = None
    p = None
    
    try:
        await websocket.accept()
        print("[DEBUG] Violin tuner WebSocket connected")
        
        # 初始化音频流
        p = pyaudio.PyAudio()
        stream = p.open(
            format=pyaudio.paFloat32,
            channels=1,
            rate=44100,
            input=True,
            frames_per_buffer=1024,
        )
        audio_stream = stream

        # 开始音高检测循环
        while websocket.client_state == WebSocketState.CONNECTED:
            try:
                # 读取音频数据
                data = stream.read(1024, exception_on_overflow=False)
                samples = np.frombuffer(data, dtype=np.float32)

                # 使用librosa检测音高
                if len(samples) > 0:
                    # 计算短时傅里叶变换
                    D = librosa.stft(samples, n_fft=2048, hop_length=512)
                    # 计算频谱
                    S = np.abs(D)
                    # 找到最大幅度的频率
                    max_freq_idx = np.argmax(S, axis=0)
                    # 转换为频率
                    freqs = librosa.fft_frequencies(sr=44100, n_fft=2048)
                    frequency = freqs[max_freq_idx[-1]]

                    if frequency > 0 and websocket.client_state == WebSocketState.CONNECTED:
                        # 发送频率数据
                        await websocket.send_json({
                            "frequency": float(frequency),
                            "timestamp": datetime.now().isoformat()
                        })

                # 检查是否有停止信号
                try:
                    data = await websocket.receive_json()
                    if data.get("action") == "stop":
                        break
                except:
                    # 如果没有收到消息，继续循环
                    pass

                await asyncio.sleep(0.01)

            except Exception as e:
                print(f"[DEBUG] Error in pitch detection loop: {e}")
                break

    except Exception as e:
        print(f"[DEBUG] WebSocket error: {e}")
        if websocket.client_state == WebSocketState.CONNECTED:
            await websocket.send_json({"error": str(e)})
    finally:
        # 清理资源
        if audio_stream:
            audio_stream.stop_stream()
            audio_stream.close()
        if p:
            p.terminate()
        if websocket.client_state == WebSocketState.CONNECTED:
            await websocket.close()
        print("[DEBUG] Violin tuner WebSocket closed")

