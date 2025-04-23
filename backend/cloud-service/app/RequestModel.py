from pydantic import BaseModel

class RegisterRequest(BaseModel):
    email: str
    password: str
    username: str


class LoginRequest(BaseModel):
        email: str
        password: str       


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str        


class ManagePermissionRequest(BaseModel):
    new_permission_level: int

class UpdateVisibilityRequest(BaseModel):
    file_id: str
    is_public: bool
