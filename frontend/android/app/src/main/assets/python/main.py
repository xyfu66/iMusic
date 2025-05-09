import asyncio
import warnings
import debugpy
import os
import logging
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
from fastapi import WebSocket, WebSocketDisconnect
from app.tuner.pitch_detector import PitchDetector

# 创建日志目录
log_dir = "logs"
if not os.path.exists(log_dir):
    os.makedirs(log_dir)

# 生成带时间戳的日志文件名
timestamp = datetime.now().strftime("%Y%m%d")
log_file = os.path.join(log_dir, f"device-service_{timestamp}.log")

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),  # 输出到控制台
        logging.FileHandler(log_file, encoding='utf-8')  # 输出到文件，使用 UTF-8 编码
    ]
)

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
    listen_for_stop,
    update_position,
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
    allow_origins=["*"],
    allow_credentials=False,
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
            stop_listener = asyncio.create_task(listen_for_stop(websocket))
            position_updater = asyncio.create_task(update_position(file_id, websocket))
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
    tasks = []

    try:
        await websocket.accept()
        print("[DEBUG] Violin tuner WebSocket connected")

        # 等待接收设备索引
        data = await websocket.receive_json()
        device_index = data.get("device_index", 0)
        print(f"[DEBUG] Using audio device index: {device_index}")

        # 初始化音高检测器
        pitch_detector = PitchDetector()
        pitch_detector.initialize_stream(device_index)

        # 创建音高检测任务
        pitch_detection_task = asyncio.create_task(
            pitch_detector.detect_pitch(websocket)
        )

        # 创建停止信号监听任务
        stop_listener = asyncio.create_task(listen_for_stop(websocket))
        tasks.extend([pitch_detection_task, stop_listener])

        # 等待任意一个任务完成
        done, pending = await asyncio.wait(
            tasks,
            return_when=asyncio.FIRST_COMPLETED
        )

        # 如果是停止信号或者出错，取消所有任务
        should_stop = any(
            t in done and (
                (t == stop_listener and t.result())  # 停止信号
            )
            for t in done
        )

        if should_stop:
            print("[DEBUG] Stopping all tasks...")
            # 取消所有未完成的任务
            for task in pending:
                if not task.done():
                    task.cancel()
            # 取消音高检测任务
            if not pitch_detection_task.done():
                pitch_detection_task.cancel()

            # 等待所有任务完成取消
            await asyncio.gather(*pending, return_exceptions=True)

    except Exception as e:
        print(f"[DEBUG] WebSocket error: {e}")
        if websocket.client_state == WebSocketState.CONNECTED:
            await websocket.send_json({"error": str(e)})
    finally:
        # 清理资源
        if pitch_detection_task:
            pitch_detection_task.cancel()
            try:
                await pitch_detection_task
            except asyncio.CancelledError:
                pass
        if pitch_detector:
            pitch_detector.cleanup()
        if websocket.client_state == WebSocketState.CONNECTED:
            await websocket.close()
        print("[DEBUG] Violin tuner WebSocket closed")

