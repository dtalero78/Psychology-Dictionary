from pydantic import BaseModel
from typing import Any


class AnalysisRequest(BaseModel):
    project_id: str
    test_type: str
    data: dict[str, Any]


class AnalysisResult(BaseModel):
    id: str
    test_type: str
    statistic: float
    p_value: float
    effect_size: float | None
    effect_label: str | None
    ci_95: list[float] | None
    interpretation_apa: str
    result_json: dict[str, Any]
    created_at: str | None = None

    model_config = {"from_attributes": True}
