import uuid
import shutil
import base64
import logging

from pathlib import Path
from fastapi import FastAPI, File, Form, UploadFile, WebSocket, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from datetime import datetime
from sqlalchemy.sql import select, func

from .utils import (
    preprocess_score,
    has_permission,
)
from .database import AsyncSession, get_async_db
from .dependencies import get_current_user, get_db
from .models import UploadedFile, User, UserRole, Role, Permission, RolePermission
from .auth import (hash_password, verify_password, create_token, decode_token)  # Import hash_password if defined in utils
from .RequestModel import LoginRequest, RegisterRequest, ChangePasswordRequest, ManagePermissionRequest, UpdateVisibilityRequest
from .response_utils import success_response, error_response
from .evaluator import PerformanceEvaluator
from .utils import TEMP_DIR
from .config import UPLOAD_DIR, init_config

# 初始化配置
init_config()

# 创建评测器实例
evaluator = PerformanceEvaluator()

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许所有来源
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],  # 明确指定允许的方法
    allow_headers=["*"],  # 允许所有请求头
    expose_headers=["*"],  # 允许暴露所有响应头
    max_age=3600,  # 预检请求的缓存时间
)


# ================== API ==================
@app.get("/cloud")
async def root():
    return {"message": "Hello Cloud"}

@app.get("/cloud/auth/validate-token")
def validate_token(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        # 直接使用 user 对象
        roles = [role.name for role in user.roles]
        permissions = [
            perm.name
            for role in user.roles
            for perm in role.permissions
        ]

        return success_response(
            data={
                "userId": user.id,
                "username": user.name,
                "roles": roles,
                "permissions": permissions,
            },
            message="Token is valid",
        )
    except Exception as e:
        return error_response(message=f"Token validation failed: {str(e)}", status_code=401)
    
# 文件上传接口
@app.post("/cloud/upload")
async def upload_file(
    file: UploadFile = File(...),
    is_public: bool = Form(False),
    user: User = Depends(get_current_user),  # 获取当前用户对象
    db: Session = Depends(get_db),
):
    """
    文件上传接口
    """
    try:
        file_id = str(uuid.uuid4())[:8]
        
        # 使用配置文件中的上传目录
        file_path = UPLOAD_DIR / f"{file_id}_{file.filename}"
        with open(str(file_path), "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # 调用预处理函数
        score_midi_path, score_audio_path = preprocess_score(file_path)

        # 统一处理所有路径
        file_path = str(file_path)
        score_midi_path = str(Path(score_midi_path))
        score_audio_path = str(Path(score_audio_path))

        # 保存文件信息到数据库
        uploaded_file = UploadedFile(
            id=file_id,
            filename=file.filename,
            filepath=file_path,
            midi_path=score_midi_path,  # 保存 MIDI 路径
            audio_path=score_audio_path,  # 保存音频路径
            user_id=user.id,  # 使用当前用户的 ID
            is_public=is_public,
            created_by=user.name,
            updated_by=user.name,
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        db.add(uploaded_file)
        db.commit()

        return success_response(
            data={"file_id": file_id},
            message="File uploaded and preprocessed successfully",
        )
    except Exception as e:
        return error_response(message=f"Failed to upload file: {str(e)}", status_code=500)


# 公开文件接口
@app.post("/cloud/publish/{file_id}")
def publish_file(file_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        # 检查文件是否存在
        uploaded_file = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
        if not uploaded_file:
            raise HTTPException(status_code=404, detail="File not found")

        # 检查文件是否已经公开
        if uploaded_file.is_public:
            return success_response(data={}, message="File is already public")

        # 更新文件的公开状态
        uploaded_file.is_public = True
        uploaded_file.updated_by = user.id
        uploaded_file.updated_at = datetime.now()
        db.commit()

        return success_response(data={}, message="File published successfully")
    except Exception as e:
        return error_response(message=f"Failed to publish file: {str(e)}", status_code=500)


# 曲目库浏览接口，所有曲目
@app.get("/cloud/library")
async def get_library(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: AsyncSession = Depends(get_async_db)
):
    """
    获取公开乐谱库，支持分页
    """
    try:
        # 查询公开文件总数
        stmt = select(func.count()).select_from(UploadedFile).where(UploadedFile.is_public == True)
        total = await db.scalar(stmt)
        if total is None:
            total = 0
        
        # 分页查询文件
        stmt = (
            select(UploadedFile)
            .where(UploadedFile.is_public == True)
            .order_by(UploadedFile.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        result = await db.execute(stmt)
        files = result.scalars().all()
        
        data = [
            {
                "id": f.id,
                "filename": f.filename,
                "user_id": f.user_id,
                "username": f.created_by if f.created_by else None,
                "created_at": f.created_at.isoformat() if f.created_at else None
            }
            for f in files
        ]
        
        pagination = {
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size if total > 0 else 1
        }
        
        return success_response(data=data, pagination=pagination, message="fetch library successfully.")
    except Exception as e:
        return error_response(message=f"Failed to fetch library: {str(e)}", status_code=500)


# 我的曲谱接口
@app.get("/cloud/my-library")
async def get_my_library(
    current_user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: AsyncSession = Depends(get_async_db)
):
    """
    获取用户的乐谱库，支持分页
    """
    try:
        # 查询用户文件总数
        stmt = select(func.count()).select_from(UploadedFile).where(UploadedFile.user_id == current_user.id)
        total = await db.scalar(stmt)
        if total is None:
            total = 0
        
        # 分页查询文件
        stmt = (
            select(UploadedFile)
            .where(UploadedFile.user_id == current_user.id)
            .order_by(UploadedFile.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        result = await db.execute(stmt)
        files = result.scalars().all()
        
        data = [
            {
                "id": f.id,
                "filename": f.filename,
                "created_at": f.created_at.isoformat() if f.created_at else None,
                "is_public": f.is_public
            }
            for f in files
        ]
        
        pagination = {
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size if total > 0 else 1
        }
        
        return success_response(data=data, pagination=pagination, message="fetch my library successfully.")
    except Exception as e:
        return error_response(message=f"Failed to fetch my library: {str(e)}", status_code=500)


# 选择曲目进行跟音练习
@app.post("/cloud/practice/{file_id}")
def practice(file_id: str, db: Session = Depends(get_db)):
    try:
        # 检查文件是否存在
        uploaded_file = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
        if not uploaded_file:
            raise HTTPException(status_code=404, detail="File not found")

        # 读取文件路径
        file_path = Path(uploaded_file.filepath)
        midi_path = Path(uploaded_file.midi_path)
        audio_path = Path(uploaded_file.audio_path)

        # 检查文件大小
        file_size_mb = file_path.stat().st_size / (1024 * 1024)
        midi_size_mb = midi_path.stat().st_size / (1024 * 1024)
        audio_size_mb = audio_path.stat().st_size / (1024 * 1024)

        # 如果任意文件大于 5MB，返回 URL 和标志
        if file_size_mb > 5 or midi_size_mb > 5 or audio_size_mb > 5:
            return success_response(
                data={
                    "file_info": {
                        "id": uploaded_file.id,
                        "filename": uploaded_file.filename,
                        "created_at": uploaded_file.created_at,
                    },
                    "use_url": True,
                    "file_url": uploaded_file.filepath,
                    "midi_url": uploaded_file.midi_path,
                    "audio_url": uploaded_file.audio_path,
                },
                message="Large file, returning URLs",
            )

        # 如果文件较小，返回 Base64 编码的内容
        with open(file_path, "r", encoding="utf-8") as file:
            file_content = base64.b64encode(file.read().encode("utf-8")).decode("utf-8")

        with open(midi_path, "rb") as midi_file:
            midi_content = base64.b64encode(midi_file.read()).decode("utf-8")

        with open(audio_path, "rb") as audio_file:
            audio_content = base64.b64encode(audio_file.read()).decode("utf-8")

        return success_response(
            data={
                "file_info": {
                    "id": uploaded_file.id,
                    "filename": uploaded_file.filename,
                    "created_at": uploaded_file.created_at,
                },
                "use_url": False,
                "file_content": file_content,
                "midi_content": midi_content,
                "audio_content": audio_content,
            },
            message="Practice data fetched successfully",
        )
    except Exception as e:
        return error_response(message=f"Failed to start practice: {str(e)}", status_code=500)

@app.post("/cloud/register")
def register_user(request: RegisterRequest, db: Session = Depends(get_db)):
    try:
        existing_user = db.query(User).filter(User.email == request.email).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="Email already registered")

        hashed_password = hash_password(request.password)
        new_user = User(
            email=request.email,
            name=request.username,
            hashed_password=hashed_password,
            created_by=request.username,
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        # 分配默认角色
        default_role = db.query(Role).filter(Role.name == "user").first()
        if not default_role:
            raise HTTPException(status_code=500, detail="Default role 'user' not found")
        user_role = UserRole(user_id=new_user.id, role_id=default_role.id)
        db.add(user_role)
        db.commit()

        return success_response(
            data={"user_id": new_user.id},
            message="User registered successfully",
        )
    except Exception as e:
        return error_response(message=f"Failed to register user: {str(e)}", status_code=500)

@app.post("/cloud/login")
def login_user(request: LoginRequest, db: Session = Depends(get_db)):
    try:
        user = db.query(User).filter(User.email == request.email).first()
        if not user or not verify_password(request.password, user.hashed_password):
            return error_response(message="Invalid email or password", status_code=401)

        # 获取用户角色和权限
        roles = db.query(Role).join(UserRole).filter(UserRole.user_id == user.id).all()
        permissions = db.query(Permission).join(RolePermission).join(Role).filter(Role.id.in_([role.id for role in roles])).all()

        # 生成身份令牌
        token = create_token({"sub": user.id})

        return success_response(
            data={
                "user_id": user.id,
                "username": user.name,
                "roles": [role.name for role in roles],
                "permissions": [permission.name for permission in permissions],
                "token": token,
            },
            message="Login successful",
        )
    except Exception as e:
        return error_response(message=f"Failed to login: {str(e)}", status_code=500)


@app.post("/cloud/change-password")
def change_password(request: ChangePasswordRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    修改密码接口
    """
    try:
        # 查找当前用户
        user = db.query(User).filter(User.id == user.id).first()
        if not user or not verify_password(request.old_password, user.hashed_password):
            return error_response(message="Invalid old password", status_code=401)

        # 更新密码
        user.hashed_password = hash_password(request.new_password)
        db.commit()

        return success_response(data={}, message="Password changed successfully")
    except Exception as e:
        return error_response(message=f"Failed to change password: {str(e)}", status_code=500)

@app.post("/cloud/manage-permission/{user_id}")
def manage_permission(user_id: str, request: ManagePermissionRequest, current_user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    管理权限接口
    """
    try:
        # 检查当前用户是否有管理权限
        if not has_permission(current_user_id, "manage_users", db):
            raise HTTPException(status_code=403, detail="Permission denied")

        # 查找目标用户
        target_user = db.query(User).filter(User.id == user_id).first()
        if not target_user:
            raise HTTPException(status_code=404, detail="User not found")

        # 更新用户角色
        new_role = db.query(Role).filter(Role.id == request.new_permission_level).first()
        if not new_role:
            raise HTTPException(status_code=404, detail="Role not found")

        # 删除旧角色并分配新角色
        db.query(UserRole).filter(UserRole.user_id == user_id).delete()
        user_role = UserRole(user_id=user_id, role_id=new_role.id)
        db.add(user_role)
        db.commit()

        return {"message": f"User {user_id}'s role updated to {new_role.name}"}
    except Exception as e:
        return error_response(message=f"Failed to manage permission: {str(e)}", status_code=500)
    

@app.put("/cloud/update-visibility")
def update_visibility(
    request: UpdateVisibilityRequest, 
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    更新文件的公开状态
    """
    try:
        # 查找文件
        uploaded_file = db.query(UploadedFile).filter(UploadedFile.id == request.file_id).first()
        if not uploaded_file:
            raise HTTPException(status_code=404, detail="File not found")
        

        # 检查权限：用户是否有管理权限或是文件的上传者
        if not (has_permission(current_user.id, "delete_file", db) or uploaded_file.user_id == current_user.id):
            print(f"Permission denied.")
            raise HTTPException(status_code=403, detail="Permission denied")
        

        # 更新文件的公开状态
        uploaded_file.is_public = request.is_public
        uploaded_file.updated_by = current_user.id
        uploaded_file.updated_at = func.now()
        
        db.commit()
        print("Successfully updated file visibility")

        return success_response(data={}, message="File visibility updated successfully")

    except Exception as e:
        print(f"Error updating visibility: {str(e)}")
        return error_response(message=f"Failed to update visibility: {str(e)}", status_code=500)


@app.get("/cloud/get-file-by-path/{file_path:path}")
def get_file(file_path: str):
    """
    获取文件接口
    """
    try:
        # 直接使用文件路径
        file_path = Path(file_path)
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")
        return FileResponse(file_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/cloud/get-score-file-by-id/{file_id}")
def get_score_file_by_id(file_id: str, db: Session = Depends(get_db)):
    """
    获取乐谱文件接口
    """
    try:
        # 查找文件
        uploaded_file = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
        if not uploaded_file:
            raise HTTPException(status_code=404, detail="File not found")
        
        # 返回文件内容
        file_path = Path(uploaded_file.filepath)
        return FileResponse(file_path, filename=file_path.name)
    except Exception as e:
        return error_response(message=f"Failed to get score file: {str(e)}", status_code=500)


@app.get("/cloud/get-audio-file-by-id/{file_id}")
def get_audio_file_by_id(file_id: str, db: Session = Depends(get_db)):
    """
    获取演奏文件接口
    """
    try:
        # 查找文件
        uploaded_file = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
        if not uploaded_file:
            raise HTTPException(status_code=404, detail="File not found")
        
        # 返回文件内容
        file_path = Path(uploaded_file.audio_path)
        return FileResponse(file_path, filename=file_path.name)
    except Exception as e:
        return error_response(message=f"Failed to get audio file: {str(e)}", status_code=500)


@app.get("/cloud/get-midi-file-by-id/{file_id}")
def get_midi_file_by_id(file_id: str, db: Session = Depends(get_db)):
    """
    获取MIDI文件接口
    """
    try:
        # 查找文件
        uploaded_file = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
        if not uploaded_file:
            raise HTTPException(status_code=404, detail="File not found")
        
        # 返回文件内容
        file_path = Path(uploaded_file.midi_path)
        return FileResponse(file_path, filename=file_path.name)
    except Exception as e:
        return error_response(message=f"Failed to get midi file: {str(e)}", status_code=500)


@app.delete("/cloud/delete/{file_id}")
def delete_file(file_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """
    删除文件接口
    """
    try:
        # 查找文件
        uploaded_file = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
        if not uploaded_file:
            raise HTTPException(status_code=404, detail="File not found")

        # 检查权限：用户是否有删除权限或是文件的上传者
        if not (has_permission(user.id, "delete_file", db) or uploaded_file.user_id == user.id):
            raise HTTPException(status_code=403, detail="Permission denied")

        # 获取所有需要删除的文件路径
        file_paths = [
            Path(uploaded_file.filepath),  # 原始文件
            Path(uploaded_file.midi_path),  # MIDI文件
            Path(uploaded_file.audio_path)  # 音频文件
        ]

        # 记录要删除的文件路径
        print(f"Attempting to delete files for file_id {file_id}:")
        for file_path in file_paths:
            print(f"  - {file_path} (exists: {file_path.exists()})")

        # 删除所有相关文件
        for file_path in file_paths:
            try:
                if file_path.exists():
                    file_path.unlink()
                    print(f"Successfully deleted file: {file_path}")
                else:
                    print(f"File does not exist: {file_path}")
            except Exception as e:
                print(f"Failed to delete file {file_path}: {str(e)}")
                # 继续删除其他文件，不中断流程

        # 删除数据库记录
        db.delete(uploaded_file)
        db.commit()
        print(f"Successfully deleted database record for file_id {file_id}")

        return success_response(message="File deleted successfully")
    except Exception as e:
        print(f"Error in delete_file: {str(e)}")
        return error_response(message=f"Failed to delete file: {str(e)}", status_code=500)



@app.post("/local/evaluate")
async def evaluate_performance(file_id: str, audio_data: UploadFile, user: User = Depends(get_current_user)):
    """
    评测用户的演奏表现
    """
    try:
        # 1. 保存录音文件
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        recording_path = TEMP_DIR / user.id / f"evaluation_{file_id}_{timestamp}.wav"
        with open(recording_path, "wb") as f:
            content = await audio_data.read()
            f.write(content)

        # 2. 进行评测
        result = await evaluator.evaluate_performance(file_id, recording_path)

        # 3. 清理临时文件
        if recording_path.exists():
            recording_path.unlink()

        return result

    except Exception as e:
        print(f"评测过程发生错误: {str(e)}")
        return {"success": False, "error": str(e)}