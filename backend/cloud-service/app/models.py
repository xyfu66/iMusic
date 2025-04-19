from app.db_base import Base
import uuid
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

class BaseModel(Base):
    __abstract__ = True  # 让这个类成为抽象类，不会创建对应的表

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))  # 文件 ID
    created_by = Column(String, nullable=True)  # 创建者
    updated_by = Column(String, nullable=True)  # 更新者
    created_at = Column(DateTime(timezone=True), server_default=func.now())  # 创建时间
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())  # 更新时间

class Permission(BaseModel):
    __tablename__ = "permissions"

    name = Column(String, unique=True, nullable=False)  # 权限名称
    description = Column(String, nullable=True)  # 权限描述

    # 多对多关系
    roles = relationship(
        "Role",
        secondary="role_permissions",  # 指定中间表
        back_populates="permissions"
    )

# 用于定义系统中的角色。
class Role(BaseModel):
    __tablename__ = "roles"

    name = Column(String, unique=True, nullable=False)  # 角色名称
    description = Column(String, nullable=True)  # 角色描述

    # 多对多关系
    permissions = relationship(
        "Permission",
        secondary="role_permissions",  # 指定中间表
        back_populates="roles"
    )

    # 关系
    users = relationship(
        "User",
        secondary="user_roles",  # 指定中间表
        back_populates="roles"
    )

# 用于建立角色与权限的多对多关系。
class RolePermission(Base):
    __tablename__ = "role_permissions"

    role_id = Column(String, ForeignKey("roles.id"), primary_key=True)  # 角色 ID
    permission_id = Column(String, ForeignKey("permissions.id"), primary_key=True)  # 权限 ID

    # 不需要定义关系，因为关系已经在 Role 和 Permission 模型中定义
    
class User(BaseModel):
    __tablename__ = "users"

    name = Column(String, unique=True, nullable=False)  # 用户名
    email = Column(String, unique=False, index=True)  # 邮箱
    hashed_password = Column(String, nullable=False)  # 哈希密码
    is_latest = Column(Boolean, default=True)  # 是否是最新记录

    # 多对多关系
    roles = relationship(
        "Role",
        secondary="user_roles",  # 指定中间表
        back_populates="users"
    )

    # 一对多关系
    uploaded_files = relationship(
        "UploadedFile",
        back_populates="user",  # 反向关系
        cascade="all, delete-orphan"  # 删除用户时删除关联文件
    )

# 用于建立用户与角色的多对多关系。
class UserRole(Base):
    __tablename__ = "user_roles"

    user_id = Column(String, ForeignKey("users.id"), primary_key=True)  # 用户 ID
    role_id = Column(String, ForeignKey("roles.id"), primary_key=True)  # 角色 ID

class UploadedFile(BaseModel):
    __tablename__ = "uploaded_files"

    filename = Column(String, nullable=False)  # 文件名
    filepath = Column(String, nullable=False)  # 文件路径 sorce file path
    midi_path = Column(String, nullable=True)  # 新增 MIDI 路径字段
    audio_path = Column(String, nullable=True)  # 新增音频路径字段
    is_public = Column(Boolean, default=False)  # 是否公开
    user_id = Column(String, ForeignKey("users.id"), nullable=False)  # 上传者外键

    # 关系
    user = relationship("User", back_populates="uploaded_files")  # 关联用户表
