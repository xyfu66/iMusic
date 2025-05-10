# -*- mode: python ; coding: utf-8 -*-

block_cipher = None

a = Analysis(
    ['app/main.py'],  # 主程序入口
    pathex=[],
    binaries=[],
    datas=[
        ('app/config', 'config'),  # 配置文件
        ('app/core', 'core'),      # 核心模块
        ('app/services', 'services'),  # 服务模块
        ('app/utils', 'utils'),    # 工具模块
    ],
    hiddenimports=[
        'uvicorn.logging',
        'uvicorn.loops',
        'uvicorn.loops.auto',
        'uvicorn.protocols',
        'uvicorn.protocols.http',
        'uvicorn.protocols.http.auto',
        'uvicorn.protocols.websockets',
        'uvicorn.protocols.websockets.auto',
        'uvicorn.lifespan',
        'uvicorn.lifespan.on',
        'numpy',
        'scipy',
        'librosa',
        'mido',
        'python-rtmidi',
        'partitura',
        'progressbar2',
        'pyaudio',
        'python-hiddenmarkov',
        'pyfluidsynth',
        'pymatchmaker',
        'fastapi',
        'websockets',
        'debugpy',
        'python-multipart',
        'aiohttp',
        'python-dotenv',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(
    a.pure,
    a.zipped_data,
    cipher=block_cipher
)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='device_service',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='device_service',
) 