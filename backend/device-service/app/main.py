import asyncio
import math
import warnings
import debugpy
import os
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, Optional

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

