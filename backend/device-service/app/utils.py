import logging
import traceback
from pathlib import Path
from typing import Optional
import tempfile
import shutil
from datetime import datetime

import mido
import partitura
import pyaudio
import aiohttp
import os
from matchmaker import Matchmaker
from partitura.score import Part

from .position_manager import position_manager
from .common import GetFileType
# 添加 cloud-service 的 URL
CLOUD_SERVICE_URL = os.getenv('NEXT_CLOUD_BACKEND_URL', 'http://localhost:8101')

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



