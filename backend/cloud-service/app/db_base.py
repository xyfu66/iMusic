import os
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import create_engine

# 使用环境变量或默认值
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://imusicuser:ipwd@localhost/imusicdb"
)

# 定义 Base 和 engine
Base = declarative_base()
engine = create_engine(DATABASE_URL)