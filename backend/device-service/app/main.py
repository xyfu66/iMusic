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

@asynccontextmanager
async def lifespan(app: FastAPI):
    upload_dir = Path("./uploads")
    # Clean up at the start
    if upload_dir.exists() and upload_dir.is_dir():
        for file in upload_dir.iterdir():
            if file.is_file():
                file.unlink()
    yield
    # Clean up at the end
    if upload_dir.exists() and upload_dir.is_dir():
        for file in upload_dir.iterdir():
            if file.is_file():
                file.unlink()


app = FastAPI(lifespan=lifespan)
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

        # 使用线程池执行阻塞操作
        loop = asyncio.get_event_loop()
        with ThreadPoolExecutor(max_workers=1) as executor:
            # 创建异步任务
            task = loop.run_in_executor(
                executor,
                lambda: asyncio.run(run_score_following(file_id, input_type, is_performce_model, device))
            )

            prev_position = 0
            iteration_count = 0
            
            while websocket.client_state == WebSocketState.CONNECTED:
                try:
                    # 非阻塞地检查任务状态
                    if task.done():
                        result = task.result()
                        if isinstance(result, dict) and "error" in result:
                            await websocket.send_json({"error": result["error"]})
                        else:
                            await websocket.send_json({"status": "completed"})
                        break

                    # 获取并更新位置
                    current_position = position_manager.get_position(file_id)
                    iteration_count += 1
                    print(f"[DEBUG] Iteration {iteration_count}: Current position: {current_position}")
                    
                    if not math.isclose(current_position, prev_position, abs_tol=0.001):
                        await websocket.send_json({"beat_position": current_position})
                        prev_position = current_position

                    await asyncio.sleep(0.1)
                    
                except Exception as e:
                    print(f"[DEBUG] Error in main loop: {e}")
                    await websocket.send_json({"error": str(e)})
                    break

    except Exception as e:
        print(f"[DEBUG] WebSocket error: {e}")
        if websocket.client_state == WebSocketState.CONNECTED:
            await websocket.send_json({"error": str(e)})
    finally:
        print("[DEBUG] Cleaning up...")
        if websocket.client_state == WebSocketState.CONNECTED:
            await websocket.close()
        position_manager.reset()
        cleanup_temp_files()

