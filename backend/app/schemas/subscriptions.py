from pydantic import BaseModel


class VerifyReceiptRequest(BaseModel):
    rc_customer_id: str
    product_id: str


class SubscriptionStatusOut(BaseModel):
    plan: str
    is_pro: bool
    expires_at: str | None
    product_id: str | None
