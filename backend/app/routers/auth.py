from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.user import User
from ..schemas.auth import (
    RegisterRequest, LoginRequest, AppleAuthRequest,
    TokenResponse, RefreshRequest, UserOut, APNsTokenRequest, AIConsentRequest,
)
from ..schemas.common import ApiResponse
from ..services.auth_service import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    decode_refresh_token, verify_apple_identity_token,
)
from ..dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=ApiResponse[TokenResponse])
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=409, detail="Email already registered")
    user = User(email=body.email, hashed_password=hash_password(body.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return ApiResponse.ok(TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    ))


@router.post("/login", response_model=ApiResponse[TokenResponse])
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not user.hashed_password or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return ApiResponse.ok(TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    ))


@router.post("/apple", response_model=ApiResponse[TokenResponse])
async def apple_signin(body: AppleAuthRequest, db: Session = Depends(get_db)):
    claims = await verify_apple_identity_token(body.identity_token)
    if not claims:
        raise HTTPException(status_code=401, detail="Invalid Apple identity token")

    apple_sub = claims.get("sub")
    email = claims.get("email")

    user = db.query(User).filter(User.apple_sub == apple_sub).first()
    if not user:
        user = db.query(User).filter(User.email == email).first() if email else None
        if user:
            user.apple_sub = apple_sub
        else:
            user = User(apple_sub=apple_sub, email=email)
            db.add(user)
    db.commit()
    db.refresh(user)
    return ApiResponse.ok(TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    ))


@router.post("/refresh", response_model=ApiResponse[TokenResponse])
def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    user_id = decode_refresh_token(body.refresh_token)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    user = db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found")
    return ApiResponse.ok(TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    ))


def _user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        email=user.email,
        plan=user.plan.value,
        created_at=user.created_at.isoformat(),
        ai_consent_at=user.ai_consent_at.isoformat() if user.ai_consent_at else None,
    )


@router.get("/me", response_model=ApiResponse[UserOut])
def me(user: User = Depends(get_current_user)):
    return ApiResponse.ok(_user_out(user))


@router.put("/apns-token", response_model=ApiResponse[dict])
def update_apns_token(body: APNsTokenRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    user.apns_token = body.apns_token
    db.commit()
    return ApiResponse.ok({"updated": True})


@router.put("/ai-consent", response_model=ApiResponse[UserOut])
def update_ai_consent(
    body: AIConsentRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Record (or revoke) the user's explicit consent for Anthropic Claude
    processing. Required by App Store Guideline 5.1.2(i) revised Nov 2025."""
    if body.consent:
        user.ai_consent_at = datetime.now(timezone.utc)
    else:
        user.ai_consent_at = None
    db.commit()
    db.refresh(user)
    return ApiResponse.ok(_user_out(user))


@router.delete("/me", response_model=ApiResponse[dict])
def delete_account(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    db.delete(user)
    db.commit()
    return ApiResponse.ok({"deleted": True})
