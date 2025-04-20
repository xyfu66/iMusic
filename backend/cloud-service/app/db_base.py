from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import create_engine

DATABASE_URL = "postgresql://imusicuser:ipwd@postgres/imusicdb"

# 定义 Base 和 engine
Base = declarative_base()
engine = create_engine(DATABASE_URL)