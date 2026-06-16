from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from .database import get_db
from .models.user import User
from .services.auth_service import decode_access_token

bearer = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    user = db.get(User, payload.get("sub"))
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def get_current_active_user(user: User = Depends(get_current_user)) -> User:
    return user


def require_pro(user: User = Depends(get_current_user)) -> User:
    from .models.user import Plan
    if user.plan != Plan.pro:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Pro subscription required",
        )
    return user


def require_ai_consent(user: User = Depends(get_current_user)) -> User:
    """Gate every endpoint that forwards user content to Anthropic Claude.

    App Store Guideline 5.1.2(i) (revised Nov 2025) requires explicit user
    consent BEFORE personal data is transmitted to a named third-party AI.
    Endpoints returning 403 here let the mobile client trigger the consent
    modal and retry once the user opts in.
    """
    if user.ai_consent_at is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="AI_CONSENT_REQUIRED",
        )
    return user
