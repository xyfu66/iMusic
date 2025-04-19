import uuid
import shutil
import base64

from pathlib import Path
from fastapi import FastAPI, File, Form, UploadFile, WebSocket, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from .utils import (
    preprocess_score,
    has_permission,
)
from .dependencies import get_current_user, get_db
from .models import UploadedFile, User, UserRole, Role, Permission, RolePermission
from .auth import (hash_password, verify_password, create_token, decode_token)  # Import hash_password if defined in utils
from .RequestModel import LoginRequest, RegisterRequest, ChangePasswordRequest, ManagePermissionRequest
from .response_utils import success_response, error_response

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:50003", "http://127.0.0.1:50003", "http://localhost:8101", "http://127.0.0.1:8101"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ================== API ==================
@app.get("cloud/")
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
        upload_dir = Path("./uploads")
        upload_dir.mkdir(exist_ok=True)

        file_path = upload_dir / f"{file_id}_{file.filename}"
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # 调用预处理函数
        score_midi_path, score_audio_path = preprocess_score(file_path)

        # 保存文件信息到数据库
        uploaded_file = UploadedFile(
            id=file_id,
            filename=file.filename,
            filepath='./' + str(file_path),
            midi_path=score_midi_path,  # 保存 MIDI 路径
            audio_path=score_audio_path,  # 保存音频路径
            user_id=user.id,  # 使用当前用户的 ID
            is_public=is_public,
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
def publish_file(file_id: str, user_id: str = Depends(get_current_user), db: Session = Depends(get_db)):
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
        db.commit()

        return success_response(data={}, message="File published successfully")
    except Exception as e:
        return error_response(message=f"Failed to publish file: {str(e)}", status_code=500)


# 曲目库浏览接口，所有曲目
@app.get("/cloud/library")
def get_library(db: Session = Depends(get_db)):
    """
    返回所有公开的文件
    """
    try:
        public_files = db.query(UploadedFile).filter(UploadedFile.is_public == True).all()
        if not public_files:
            return success_response(data=[], message="No public files found")

        result = [
            {
                "id": file.id,
                "filename": file.filename,
                "user_id": file.user_id,
                "username": file.user.name,  # 添加上传者的用户名
                "uploaded_at": file.created_at,
            }
            for file in public_files
        ]
        return success_response(data=result, message="Library fetched successfully")
    except Exception as e:
        return error_response(message=f"Failed to fetch library: {str(e)}", status_code=500)


# 我的曲谱接口
@app.get("/cloud/my-library")
def get_my_library(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        user_files = db.query(UploadedFile).filter(UploadedFile.user_id == user.id).all()
        if not user_files:
            return success_response(data=[], message="No files found for the current user")

        result = [
            {
                "id": file.id,
                "filename": file.filename,
                "filepath": file.filepath,
                "is_public": file.is_public,
                "uploaded_at": file.created_at,
            }
            for file in user_files
        ]
        return success_response(data=result, message="User library fetched successfully")
    except Exception as e:
        return error_response(message=f"Failed to fetch user library: {str(e)}", status_code=500)


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
                        "uploaded_at": uploaded_file.created_at,
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
                    "uploaded_at": uploaded_file.created_at,
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
    

@app.patch("/cloud/update-visibility/{file_id}")
def update_visibility(
    file_id: str,
    is_public: bool,
    user_id: str = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    更新文件的公开状态
    """
    try:
        # 检查当前用户是否有权限
        if not has_permission(user_id, "manage_files", db):
            raise HTTPException(status_code=403, detail="Permission denied")

        # 查找文件
        uploaded_file = db.query(UploadedFile).filter(UploadedFile.id == file_id).first()
        if not uploaded_file:
            raise HTTPException(status_code=404, detail="File not found")

        # 更新文件的公开状态
        uploaded_file.is_public = is_public
        db.commit()

        return success_response(data={}, message="File visibility updated successfully")
    except Exception as e:
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

        # 删除文件记录
        db.delete(uploaded_file)
        db.commit()

        # 删除文件本身
        file_path = Path(uploaded_file.filepath)
        if file_path.exists():
            file_path.unlink()

        return success_response(message="File deleted successfully")
    except Exception as e:
        return error_response(message=f"Failed to delete file: {str(e)}", status_code=500)
