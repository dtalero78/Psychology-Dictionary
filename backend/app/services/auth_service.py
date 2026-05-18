from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
import httpx
from passlib.context import CryptContext
from ..config import get_settings

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode({"sub": user_id, "exp": expire, "type": "access"}, settings.SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    return jwt.encode({"sub": user_id, "exp": expire, "type": "refresh"}, settings.SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "access":
            return None
        return payload
    except JWTError:
        return None


def decode_refresh_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "refresh":
            return None
        return payload.get("sub")
    except JWTError:
        return None


async def verify_apple_identity_token(identity_token: str) -> dict | None:
    """Verify Apple identity token and return claims. Returns None if invalid."""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get("https://appleid.apple.com/auth/keys")
            resp.raise_for_status()
            keys = resp.json()["keys"]

        header = jwt.get_unverified_header(identity_token)
        key = next((k for k in keys if k["kid"] == header["kid"]), None)
        if not key:
            return None

        from jose.backends import RSAKey
        from jose import jwk
        public_key = jwk.construct(key)
        claims = jwt.decode(
            identity_token,
            public_key,
            algorithms=["RS256"],
            audience="com.psychologydictionary.app",
            issuer="https://appleid.apple.com",
        )
        return claims
    except Exception:
        return None
