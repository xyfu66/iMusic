import os
from pathlib import Path

# 基础配置
UPLOAD_DIR = Path("uploads")

# 数据库配置
# 使用环境变量或默认值
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://imusicuser:ipwd@localhost/imusicdb"
)

def init_config():
    """
    初始化配置
    在应用启动时调用此函数
    """
    # 确保上传目录存在
    UPLOAD_DIR.mkdir(exist_ok=True)
    
    # 其他初始化逻辑可以在这里添加

# 其他配置可以在这里添加 