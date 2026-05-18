from pydantic import BaseModel
from typing import Any


class ProjectCreate(BaseModel):
    title: str


class ProjectUpdate(BaseModel):
    title: str | None = None
    status: str | None = None


class StepUpdate(BaseModel):
    data: dict[str, Any]


class ProjectOut(BaseModel):
    id: str
    title: str
    status: str
    current_step: int
    steps_json: dict[str, Any]
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class StepResult(BaseModel):
    step_number: int
    ai_response: str
    step_data: dict[str, Any]
