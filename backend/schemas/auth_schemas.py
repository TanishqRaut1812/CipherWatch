from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, EmailStr


class SignupRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=256)
    username: str = Field(..., min_length=3, max_length=64)
    password: str = Field(..., min_length=8, max_length=128)
    org_name: Optional[str] = Field(None, max_length=128, description="Optional organization name")


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=256)
    password: str = Field(..., min_length=1, max_length=128)


class ForgotPasswordRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=256)


class ResetPasswordRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=256)
    otp: str = Field(..., min_length=6, max_length=6)
    new_password: str = Field(..., min_length=8, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    username: str


class UserMeResponse(BaseModel):
    user_id: str
    username: str
    email: str


class OrgCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=128)


class OrgResponse(BaseModel):
    id: str
    name: str
    role: str
    created_at: datetime


class OrgCredentialsResponse(BaseModel):
    org_id: str
    org_name: str
    registration_key: str
    organization_id: str
    enrollment_key: str
