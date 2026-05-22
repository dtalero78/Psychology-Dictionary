from pydantic import BaseModel
from typing import Any


class AnalysisRequest(BaseModel):
    project_id: str
    test_type: str
    data: dict[str, Any]


class FromSurveyMapping(BaseModel):
    """Maps survey question keys (e.g. "q_0") to test inputs.

    Only the fields relevant to the chosen test_type need to be provided:
      - independent_ttest / chi_square: outcome_q + grouping_q (+ optional group_values pair)
      - one_way_anova: outcome_q + grouping_q (groups auto-detected, 2-6 allowed)
      - paired_ttest: pre_q + post_q
      - pearson / spearman: x_q + y_q
      - multiple_regression: y_q + x_qs (list of predictors)
    """
    outcome_q: str | None = None
    grouping_q: str | None = None
    group_values: list[str] | None = None
    pre_q: str | None = None
    post_q: str | None = None
    x_q: str | None = None
    y_q: str | None = None
    x_qs: list[str] | None = None


class FromSurveyRequest(BaseModel):
    project_id: str
    survey_id: str
    test_type: str
    mapping: FromSurveyMapping


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
