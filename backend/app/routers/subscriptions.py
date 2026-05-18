from datetime import datetime, timezone
import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.user import User, Plan
from ..models.subscription import Subscription, SubscriptionStatus
from ..schemas.subscriptions import VerifyReceiptRequest, SubscriptionStatusOut
from ..schemas.common import ApiResponse
from ..dependencies import get_current_user
from ..config import get_settings

settings = get_settings()
router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])

REVENUECAT_BASE = "https://api.revenuecat.com/v1"


@router.post("/verify", response_model=ApiResponse[SubscriptionStatusOut])
async def verify_receipt(body: VerifyReceiptRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{REVENUECAT_BASE}/subscribers/{body.rc_customer_id}",
            headers={"Authorization": f"Bearer {settings.REVENUECAT_API_KEY}"},
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=400, detail="RevenueCat verification failed")

    rc_data = resp.json()
    entitlements = rc_data.get("subscriber", {}).get("entitlements", {})
    pro_entitlement = entitlements.get("pro")

    if pro_entitlement and pro_entitlement.get("is_active"):
        expires_str = pro_entitlement.get("expires_date")
        expires_at = datetime.fromisoformat(expires_str.replace("Z", "+00:00")) if expires_str else None

        sub = db.query(Subscription).filter(Subscription.user_id == user.id).first()
        if sub:
            sub.status = SubscriptionStatus.active
            sub.expires_at = expires_at
            sub.rc_customer_id = body.rc_customer_id
        else:
            sub = Subscription(
                user_id=user.id,
                provider="revenuecat",
                product_id=body.product_id,
                rc_customer_id=body.rc_customer_id,
                expires_at=expires_at,
                status=SubscriptionStatus.active,
            )
            db.add(sub)

        user.plan = Plan.pro
        db.commit()

    return ApiResponse.ok(SubscriptionStatusOut(
        plan=user.plan.value,
        is_pro=user.plan == Plan.pro,
        expires_at=None,
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
