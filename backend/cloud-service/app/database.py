from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.db_base import DATABASE_URL, Base, engine  # 使用从 db_base 导入的 Base
import app.models  # 导入模块以注册所有模型
from sqlalchemy.orm import Session
from .config import DATABASE_URL

# 同步引擎和会话
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 异步引擎和会话
async_engine = create_async_engine(
    DATABASE_URL.replace('postgresql://', 'postgresql+asyncpg://'),
    echo=True,
    future=True,
    pool_size=5,
    max_overflow=10,
    pool_timeout=30,
    pool_recycle=1800,
)

async_session = async_sessionmaker(
    async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

async def get_async_db():
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def seed_permissions(db: Session):
    permissions = [
        {"name": "upload_file", "description": "允许上传文件"},
        {"name": "delete_file", "description": "允许删除文件"},
        {"name": "manage_users", "description": "允许管理用户"},
    ]
    for perm in permissions:
        existing = db.query(app.models.Permission).filter(app.models.Permission.name == perm["name"]).first()
        if not existing:
            new_perm = app.models.Permission(name=perm["name"], description=perm["description"], created_by="system")
            db.add(new_perm)
    db.commit()

def seed_roles(db: Session):
    roles = [
        {"name": "user", "description": "普通用户"},
        {"name": "admin", "description": "管理员"},
        {"name": "super_admin", "description": "超级管理员"},
    ]
    for role in roles:
        existing = db.query(app.models.Role).filter(app.models.Role.name == role["name"]).first()
        if not existing:
            new_role = app.models.Role(name=role["name"], description=role["description"], created_by="system")
            db.add(new_role)
    db.commit()

def seed_role_permissions(db: Session):
    role_permissions = {
        "user": ["upload_file"],
        "admin": ["upload_file", "delete_file", "manage_files"],
        "super_admin": ["upload_file", "delete_file", "manage_files", "manage_users"],
    }
    for role_name, permission_names in role_permissions.items():
        role = db.query(app.models.Role).filter(app.models.Role.name == role_name).first()
        for perm_name in permission_names:
            permission = db.query(app.models.Permission).filter(app.models.Permission.name == perm_name).first()
            if permission and role:
                existing = db.query(app.models.RolePermission).filter(
                    app.models.RolePermission.role_id == role.id,
                    app.models.RolePermission.permission_id == permission.id,
                ).first()
                if not existing:
                    role_permission = app.models.RolePermission(role_id=role.id, permission_id=permission.id)
                    db.add(role_permission)
    db.commit()


# 创建所有表并初始化数据
if __name__ == "__main__":
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)  # 创建表
    print("Database tables created successfully.")

    # 初始化种子数据
    db = SessionLocal()
    try:
        seed_permissions(db)
        seed_roles(db)
        seed_role_permissions(db)
        print("Permissions and roles seeded successfully.")
    finally:
        db.close()