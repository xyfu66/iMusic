import os
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import create_engine
from app.config import DATABASE_URL

# 定义 Base 和 engine
Base = declarative_base()
engine = create_engine(DATABASE_URL)