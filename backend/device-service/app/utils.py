import logging
import traceback
import tempfile
import shutil
import asyncio
import math
import mido
import partitura
import pyaudio
import aiohttp
import os
import platform

from datetime import datetime
from pathlib import Path
from typing import Optional
from matchmaker import Matchmaker
from partitura.score import Part
from fastapi import WebSocket
from starlette.websockets import WebSocketState

from .position_manager import position_manager
from .common import GetFileType

# 打印所有环境信息
print("Environment Information:")
print(f"NODE_ENV: {os.getenv('NODE_ENV', 'not set')}")
print(f"IS_ANDROID: {os.getenv('IS_ANDROID', 'not set')}")
print(f"Platform: {platform.system()}")

# 获取环境变量
ENV = os.getenv('NODE_ENV', 'development')
IS_ANDROID = os.getenv('IS_ANDROID', 'false').lower() == 'true'
IS_WINDOWS = platform.system().lower() == 'windows'

# 根据环境设置 cloud-service 的 URL
if ENV == 'development':
    if IS_ANDROID:
        # Android 模拟器环境
        CLOUD_SERVICE_URL = os.getenv('NEXT_CLOUD_BACKEND_URL', 'http://10.0.2.2:8101')
    elif IS_WINDOWS:
        # Windows 开发环境
        CLOUD_SERVICE_URL = os.getenv('NEXT_CLOUD_BACKEND_URL', 'http://localhost:8101')
    else:
        # Linux/Mac 开发环境
        CLOUD_SERVICE_URL = os.getenv('NEXT_CLOUD_BACKEND_URL', 'http://localhost:8101')
else:
    # 生产环境
    CLOUD_SERVICE_URL = os.getenv('NEXT_CLOUD_BACKEND_URL', 'http://192.168.68.53:8101')

print(f"CLOUD_SERVICE_URL: {os.getenv('NEXT_CLOUD_BACKEND_URL', 'not set')}")


# 创建临时目录
TEMP_DIR = Path(tempfile.gettempdir()) / "score_following"
TEMP_DIR.mkdir(exist_ok=True)


def cleanup_temp_files():
    """清理临时目录中的所有文件"""
    try:
        if TEMP_DIR.exists():
            shutil.rmtree(TEMP_DIR)
            TEMP_DIR.mkdir(exist_ok=True)
    except Exception as e:
        logging.error(f"Error cleaning up temp files: {e}")


def convert_beat_to_quarter(score_part: Part, current_beat: float) -> float:
    timeline_time = score_part.inv_beat_map(current_beat)
    quarter_position = score_part.quarter_map(timeline_time)
    return float(quarter_position)


async def find_file_by_id(file_id: str, file_type: GetFileType) -> Optional[Path]:
    """从 cloud-service 获取文件内容并保存到临时目录"""
    try:
        async with aiohttp.ClientSession() as session:
            if file_type == GetFileType.SCORE_FILE:
                url = f"{CLOUD_SERVICE_URL}/cloud/get-score-file-by-id/{file_id}"
            elif file_type == GetFileType.AUDIO_FILE:
                url = f"{CLOUD_SERVICE_URL}/cloud/get-audio-file-by-id/{file_id}"
            elif file_type == GetFileType.MIDI_FILE:
                url = f"{CLOUD_SERVICE_URL}/cloud/get-midi-file-by-id/{file_id}"
            
            async with session.get(url) as response:
                if response.status == 200:
                    # 获取原始文件名
                    content_disposition = response.headers.get('content-disposition')
                    original_filename = None
                    if content_disposition:
                        import re
                        filename_match = re.search(r'filename="([^"]+)"', content_disposition)
                        if filename_match:
                            original_filename = filename_match.group(1)
                    
                    # 如果没有获取到原始文件名，使用默认名称
                    if not original_filename:
                        logging.error(f"no original filename: {response.status}")
                        return None
                    
                    # 添加时间戳
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    temp_filename = f"{file_type.value}_{timestamp}_{original_filename}"
                    temp_file = TEMP_DIR / temp_filename
                    
                    # 保存文件内容
                    with open(temp_file, "wb") as f:
                        f.write(await response.read())
                    return temp_file
                else:
                    logging.error(f"Failed to get file from cloud: {response.status}")
                    return None
    except Exception as e:
        logging.error(f"Error getting file from cloud: {e}")
        return None


def get_audio_devices() -> list[dict]:
    """
    Get the list of audio devices available on the system
    The default device is always the first one in the list.

    Returns
    -------
    devices: list[dict]
        List of audio devices with index and name

    """
    try:
        p = pyaudio.PyAudio()
        device_count = p.get_device_count()
        default_device = p.get_default_input_device_info()
        devices = []
        for i in range(device_count):
            device_info = p.get_device_info_by_index(i)
            if device_info == default_device:
                continue
            devices.append({"index": device_info["index"], "name": device_info["name"]})
        devices.insert(
            0, {"index": default_device["index"], "name": default_device["name"]}
        )
        p.terminate()
    except Exception as e:
        logging.error(f"Error: {e}")
        devices = [{"index": 0, "name": "No audio devices found"}]
    return devices


def get_midi_devices() -> list[dict]:
    """
    Get the list of midi devices available on the system
    The default device is always the first one in the list.

    Returns
    -------
    devices: list[dict]
        List of midi devices with index and name

    """
    try:
        devices = []
        for i, device in enumerate(mido.get_input_names()):
            devices.append({"index": i, "name": device})
    except Exception as e:
        logging.error(f"Error: {e}")
        devices = [{"index": 0, "name": "No midi devices found"}]
    return devices


async def run_score_following(file_id: str, input_type: str, is_performce_model: bool, device: int) -> None:
    score_file = await find_file_by_id(file_id, GetFileType.SCORE_FILE)  # .xml

    # 确保 score_midi 是字符串类型
    if isinstance(score_file, Path):
        score_file = str(score_file)

    score_part = partitura.load_score_as_part(score_file)
    print(f"Running score following with {score_file}")

    actual_input_type = GetFileType.AUDIO_FILE.value
    performance_file = None

    if is_performce_model:
        if input_type == GetFileType.AUDIO_FILE:
            performance_file = await find_file_by_id(file_id, GetFileType.AUDIO_FILE)
        elif input_type == GetFileType.MIDI_FILE:
            performance_file = await find_file_by_id(file_id, GetFileType.MIDI_FILE)
            actual_input_type = GetFileType.MIDI_FILE.value

    print(f"Using input type: {actual_input_type}")

    alignment_in_progress = True
    if is_performce_model:
        # 使用 performance 文件进行测试
        mm = Matchmaker(
            score_file = score_file,
            performance_file = performance_file,
            input_type = actual_input_type,
            frame_rate = 86,
        )
    else:
        # 使用特定输入设备进行测试
        mm = Matchmaker(
            score_file = score_file,
            input_type = actual_input_type,
            device_name_or_index = device,
            frame_rate = 86,
        )

    try:
        while alignment_in_progress:
            print(f"Running score following... (input type: {actual_input_type})")
            for current_position in mm.run():
                quarter_position = convert_beat_to_quarter(score_part, current_position)
                position_manager.set_position(file_id, quarter_position)
            alignment_in_progress = False
    except Exception as e:
        logging.error(f"Error: {e}")
        traceback.print_exc()
        return {"error": str(e)}


async def listen_for_stop(websocket: WebSocket) -> bool:
    """监听停止信号的协程函数"""
    try:
        while True:
            data = await websocket.receive_json()
            if data.get("action") == "stop":
                print("[DEBUG] Received stop signal")
                return True
    except Exception as e:
        print(f"[DEBUG] Error in stop listener: {e}")
        return True

async def update_position(file_id, websocket: WebSocket):
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


