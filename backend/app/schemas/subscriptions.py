from pydantic import BaseModel
from typing import Any


class VerifyReceiptRequest(BaseModel):
    # `rc_customer_id` is intentionally NOT accepted from the client.
    # We always use the JWT subject (user.id) as RevenueCat's appUserID;
    # accepting a client-supplied id would let any caller upgrade themselves
    # by passing a known paying customer's id.
    product_id: str


class SubscriptionStatusOut(BaseModel):
    plan: str
    is_pro: bool
    expires_at: str | None
    product_id: str | None


class RevenueCatWebhookEvent(BaseModel):
    # Subset of the RC webhook payload we consume. Full schema:
    # https://www.revenuecat.com/docs/webhooks#section-event-types
    event: dict[str, Any]
