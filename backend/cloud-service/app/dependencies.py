from fastapi import Depends, HTTPException, Header
from sqlalchemy.orm import Session
from .database import SessionLocal
from .models import User
from .auth import decode_token

def get_db():
    """
    获取数据库会话
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(authorization: str = Header(...), db: Session = Depends(get_db)) -> User:
    """
    从 Authorization 头中解析用户身份
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    
    token = authorization.split(" ")[1]
    user_id = decode_token(token)  # 解码 Token 获取用户 ID
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not authenticated")
    return user