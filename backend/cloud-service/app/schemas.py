from pydantic import BaseModel, EmailStr

class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: int
    email: EmailStr

    class Config:
        orm_mode = True

class UploadedFileResponse(BaseModel):
    id: str
    filename: str
    user_id: str

    class Config:
        orm_mode = True