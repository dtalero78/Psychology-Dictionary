from pydantic import BaseModel
from typing import Any


class SurveyCreate(BaseModel):
    project_id: str
    title: str
    config_json: dict[str, Any] = {}


class SurveyOut(BaseModel):
    id: str
    project_id: str
    token: str
    status: str
    title: str
    config_json: dict[str, Any]
    created_at: str
    survey_url: str

    model_config = {"from_attributes": True}


class SurveyResponseOut(BaseModel):
    id: str
    survey_id: str
    answers_json: dict[str, Any]
    completed_at: str


class ResponsesPage(BaseModel):
    total: int
    responses: list[SurveyResponseOut]


class SubmitResponse(BaseModel):
    answers: dict[str, Any]
