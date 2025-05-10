import os
import shutil
import subprocess
import sys
import platform

def build_app():
    # 确保在正确的目录中
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    
    # 清理旧的构建文件
    if os.path.exists('dist'):
        shutil.rmtree('dist')
    if os.path.exists('build'):
        shutil.rmtree('build')
    
    # 使用 PyInstaller 打包应用
    subprocess.run([
        'pyinstaller',
        '--onefile',
        '--name', 'device_service',
        '--add-data', 'app:app',
        '--hidden-import', 'uvicorn.logging',
        '--hidden-import', 'uvicorn.loops',
        '--hidden-import', 'uvicorn.loops.auto',
        '--hidden-import', 'uvicorn.protocols',
        '--hidden-import', 'uvicorn.protocols.http',
        '--hidden-import', 'uvicorn.protocols.http.auto',
        '--hidden-import', 'uvicorn.protocols.websockets',
        '--hidden-import', 'uvicorn.protocols.websockets.auto',
        '--hidden-import', 'uvicorn.lifespan',
        '--hidden-import', 'uvicorn.lifespan.on',
        '--hidden-import', 'numpy',
        '--hidden-import', 'scipy',
        '--hidden-import', 'librosa',
        '--hidden-import', 'mido',
        '--hidden-import', 'python-rtmidi',
        '--hidden-import', 'partitura',
        '--hidden-import', 'progressbar2',
        '--hidden-import', 'pyaudio',
        '--hidden-import', 'python-hiddenmarkov',
        '--hidden-import', 'pyfluidsynth',
        '--hidden-import', 'pymatchmaker',
        '--hidden-import', 'fastapi',
        '--hidden-import', 'websockets',
        '--hidden-import', 'debugpy',
        '--hidden-import', 'python-multipart',
        '--hidden-import', 'aiohttp',
        '--hidden-import', 'python-dotenv',
        '--clean',  # 清理临时文件
        '--noconfirm',  # 不询问确认
        'app/main.py'
    ], check=True)
    
    # 复制到 Android 项目的 assets 目录
    android_assets_dir = os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
        'frontend',
        'android',
        'app',
        'src',
        'main',
        'assets',
        'python'
    )
    
    # 确保目标目录存在
    os.makedirs(android_assets_dir, exist_ok=True)
    
    # 根据操作系统确定可执行文件扩展名
    exe_ext = '.exe' if platform.system() == 'Windows' else ''
    source_file = os.path.join('dist', f'device_service{exe_ext}')
    
    if not os.path.exists(source_file):
        print(f"错误：找不到源文件 {source_file}")
        print("请检查 PyInstaller 是否成功生成了可执行文件")
        sys.exit(1)
    
    # 复制可执行文件
    try:
        shutil.copy2(
            source_file,
            os.path.join(android_assets_dir, 'device_service')
        )
        print("构建完成！文件已复制到 Android 项目。")
    except Exception as e:
        print(f"复制文件时出错：{str(e)}")
        sys.exit(1)

if __name__ == '__main__':
    try:
        build_app()
    except Exception as e:
        print(f"构建过程中出错：{str(e)}")
        sys.exit(1) 