import time
import logging
from pathlib import Path
import httpx
import jwt as pyjwt
from ..config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

APNS_HOST_PROD = "https://api.push.apple.com"
APNS_HOST_SANDBOX = "https://api.sandbox.push.apple.com"


def _make_apns_jwt() -> str:
    """Create a signed JWT for APNs token-based auth."""
    private_key = Path(settings.APNS_CERT_PATH).read_text() if settings.APNS_CERT_PATH else ""
    payload = {"iss": settings.APNS_TEAM_ID, "iat": int(time.time())}
    return pyjwt.encode(payload, private_key, algorithm="ES256", headers={"alg": "ES256", "kid": settings.APNS_KEY_ID})


def send_new_response_notification(apns_token: str, response_count: int) -> bool:
    """Send APNs push notification when a new survey response arrives."""
    if not apns_token or not settings.APNS_KEY_ID or not settings.APNS_CERT_PATH:
        return False
    try:
        host = APNS_HOST_SANDBOX if settings.APNS_USE_SANDBOX else APNS_HOST_PROD
        token_str = _make_apns_jwt()
        url = f"{host}/3/device/{apns_token}"
        payload = {
            "aps": {
                "alert": "New survey response received",
                "badge": response_count,
                "sound": "default",
            }
        }
        with httpx.Client(http2=True) as client:
            resp = client.post(
                url,
                json=payload,
                headers={
                    "authorization": f"bearer {token_str}",
                    "apns-topic": settings.APNS_BUNDLE_ID,
                    "apns-push-type": "alert",
                },
                timeout=10,
            )
        return resp.status_code == 200
    except Exception as e:
        logger.warning(f"APNs push failed: {e}")
        return False
