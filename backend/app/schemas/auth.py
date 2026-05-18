from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AppleAuthRequest(BaseModel):
    identity_token: str
    authorization_code: str
    full_name: str | None = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    id: str
    email: str | None
    plan: str
    created_at: str

    model_config = {"from_attributes": True}


class APNsTokenRequest(BaseModel):
    apns_token: str
