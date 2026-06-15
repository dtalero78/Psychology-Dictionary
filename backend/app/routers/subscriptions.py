import hmac
from datetime import datetime, timezone
import httpx
from fastapi import APIRouter, Depends, HTTPException, Header, Request
from sqlalchemy.orm import Session
from ..database import get_db, SessionLocal
from ..models.user import User, Plan
from ..models.subscription import Subscription, SubscriptionStatus
from ..schemas.subscriptions import VerifyReceiptRequest, SubscriptionStatusOut
from ..schemas.common import ApiResponse
from ..dependencies import get_current_user
from ..config import get_settings

settings = get_settings()
router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])

REVENUECAT_BASE = "https://api.revenuecat.com/v1"


def _parse_rc_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


@router.post("/verify", response_model=ApiResponse[SubscriptionStatusOut])
async def verify_receipt(
    body: VerifyReceiptRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # SECURITY: query RevenueCat using the authenticated user's id as the
    # appUserID. We deliberately do NOT trust a client-supplied customer_id —
    # otherwise any caller could upgrade themselves to Pro by passing the
    # customer_id of an actual paying user.
    rc_customer_id = user.id
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            f"{REVENUECAT_BASE}/subscribers/{rc_customer_id}",
            headers={"Authorization": f"Bearer {settings.REVENUECAT_API_KEY}"},
        )

    if resp.status_code >= 500:
        raise HTTPException(status_code=503, detail="RevenueCat temporarily unavailable")
    if resp.status_code != 200:
        raise HTTPException(status_code=400, detail="RevenueCat verification failed")

    rc_data = resp.json()
    entitlements = rc_data.get("subscriber", {}).get("entitlements", {})
    pro_entitlement = entitlements.get("pro")

    if not (pro_entitlement and pro_entitlement.get("is_active")):
        # Verified, but this user has no active Pro entitlement.
        return ApiResponse.ok(SubscriptionStatusOut(
            plan=user.plan.value,
            is_pro=user.plan == Plan.pro,
            expires_at=None,
            product_id=body.product_id,
        ))

    expires_at = _parse_rc_datetime(pro_entitlement.get("expires_date"))

    sub = db.query(Subscription).filter(Subscription.user_id == user.id).first()
    if sub:
        sub.status = SubscriptionStatus.active
        sub.expires_at = expires_at
        sub.rc_customer_id = rc_customer_id
        sub.product_id = body.product_id
    else:
        sub = Subscription(
            user_id=user.id,
            provider="revenuecat",
            product_id=body.product_id,
            rc_customer_id=rc_customer_id,
            expires_at=expires_at,
            status=SubscriptionStatus.active,
        )
        db.add(sub)

    user.plan = Plan.pro
    db.commit()

    return ApiResponse.ok(SubscriptionStatusOut(
        plan=user.plan.value,
        is_pro=True,
        expires_at=expires_at.isoformat() if expires_at else None,
        product_id=body.product_id,
    ))


@router.get("/status", response_model=ApiResponse[SubscriptionStatusOut])
def subscription_status(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    sub = db.query(Subscription).filter(
        Subscription.user_id == user.id,
        Subscription.status == SubscriptionStatus.active,
    ).first()

    if sub and sub.expires_at and sub.expires_at < datetime.now(timezone.utc):
        sub.status = SubscriptionStatus.expired
        user.plan = Plan.free
        db.commit()
        sub = None

    return ApiResponse.ok(SubscriptionStatusOut(
        plan=user.plan.value,
        is_pro=user.plan == Plan.pro,
        expires_at=sub.expires_at.isoformat() if sub and sub.expires_at else None,
        product_id=sub.product_id if sub else None,
    ))


# ---------------------------------------------------------------------------
# RevenueCat webhook
# ---------------------------------------------------------------------------
# RC delivers lifecycle events server-side: RENEWAL, CANCELLATION, EXPIRATION,
# BILLING_ISSUE, etc. Without this endpoint, cancellations and refunds never
# reach us and users keep `Plan.pro` forever after they stop paying.
#
# RC authenticates webhooks by sending whatever string you put in the
# "Authorization header value" field of the webhook config back as the
# Authorization header. We compare it with constant-time equality.


_PRO_ACTIVATING = {"INITIAL_PURCHASE", "RENEWAL", "PRODUCT_CHANGE", "UNCANCELLATION"}
_PRO_REVOKING = {"EXPIRATION", "CANCELLATION", "BILLING_ISSUE", "SUBSCRIPTION_PAUSED"}
_PRO_REFUND = {"REFUND"}


def _resolve_user(db, app_user_id: str | None) -> User | None:
    if not app_user_id:
        return None
    return db.query(User).filter(User.id == app_user_id).first()


@router.post("/webhook", response_model=ApiResponse[dict])
async def revenuecat_webhook(
    request: Request,
    authorization: str | None = Header(default=None),
):
    secret = settings.REVENUECAT_WEBHOOK_SECRET
    if not secret:
        # If the secret is unset, refuse rather than process unauthenticated.
        raise HTTPException(status_code=503, detail="Webhook not configured")
    if not authorization or not hmac.compare_digest(authorization, secret):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    payload = await request.json()
    event = (payload or {}).get("event") or {}
    event_type = event.get("type", "")
    app_user_id = event.get("app_user_id") or event.get("original_app_user_id")
    product_id = event.get("product_id", "") or ""
    expires_ms = event.get("expiration_at_ms")
    expires_at = None
    if expires_ms:
        expires_at = datetime.fromtimestamp(int(expires_ms) / 1000, tz=timezone.utc)

    # Use our own session — webhook handler has no JWT scope.
    db = SessionLocal()
    try:
        user = _resolve_user(db, app_user_id)
        if not user:
            # Unknown user (e.g. event for a different app under the same RC
            # project). Acknowledge so RC doesn't keep retrying.
            return ApiResponse.ok({"handled": False, "reason": "unknown user"})

        sub = db.query(Subscription).filter(Subscription.user_id == user.id).first()

        if event_type in _PRO_ACTIVATING:
            if sub:
                sub.status = SubscriptionStatus.active
                sub.expires_at = expires_at
                sub.rc_customer_id = app_user_id
                if product_id:
                    sub.product_id = product_id
            else:
                sub = Subscription(
                    user_id=user.id,
                    provider="revenuecat",
                    product_id=product_id or "unknown",
                    rc_customer_id=app_user_id,
                    expires_at=expires_at,
                    status=SubscriptionStatus.active,
                )
                db.add(sub)
            user.plan = Plan.pro

        elif event_type in _PRO_REVOKING or event_type in _PRO_REFUND:
            # Revoke entitlement immediately on refund; for cancellation/
            # expiration we trust RC's expires_at so the user keeps access
            # through the paid-for period.
            if sub:
                sub.status = (
                    SubscriptionStatus.expired
                    if event_type in _PRO_REFUND
                    else SubscriptionStatus.cancelled
                )
                if event_type in _PRO_REFUND or (expires_at and expires_at <= datetime.now(timezone.utc)):
                    user.plan = Plan.free

        db.commit()
        return ApiResponse.ok({"handled": True, "event_type": event_type})
    finally:
        db.close()
