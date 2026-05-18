from pydantic import BaseModel
from typing import Any


class DocumentRequest(BaseModel):
    project_id: str


class DocumentOut(BaseModel):
    id: str
    project_id: str
    content_json: dict[str, Any]
    pdf_url: str | None
    docx_url: str | None
    created_at: str

    model_config = {"from_attributes": True}
