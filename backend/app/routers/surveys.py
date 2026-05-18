from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.user import User
from ..models.survey import Survey, SurveyResponse, SurveyStatus
from ..models.project import Project
from ..schemas.surveys import SurveyCreate, SurveyOut, ResponsesPage, SurveyResponseOut
from ..schemas.common import ApiResponse
from ..dependencies import get_current_user
from ..config import get_settings

settings = get_settings()
router = APIRouter(prefix="/surveys", tags=["surveys"])

FREE_RESPONSE_LIMIT = 50


def _survey_out(s: Survey) -> SurveyOut:
    return SurveyOut(
        id=s.id,
        project_id=s.project_id,
        token=s.token,
        status=s.status.value,
        title=s.title,
        config_json=s.config_json,
        created_at=s.created_at.isoformat(),
        survey_url=f"{settings.BASE_URL}/s/{s.token}",
    )


@router.post("", response_model=ApiResponse[SurveyOut])
def create_survey(body: SurveyCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == body.project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    survey = Survey(project_id=body.project_id, title=body.title, config_json=body.config_json)
    db.add(survey)
    db.commit()
    db.refresh(survey)
    return ApiResponse.ok(_survey_out(survey))


@router.get("/{survey_id}", response_model=ApiResponse[SurveyOut])
def get_survey(survey_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    survey = db.get(Survey, survey_id)
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    project = db.query(Project).filter(Project.id == survey.project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(status_code=403, detail="Forbidden")
    return ApiResponse.ok(_survey_out(survey))


@router.get("/{survey_id}/responses", response_model=ApiResponse[ResponsesPage])
def get_responses(
    survey_id: str,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    survey = db.get(Survey, survey_id)
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    project = db.query(Project).filter(Project.id == survey.project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(status_code=403, detail="Forbidden")

    total = db.query(SurveyResponse).filter(SurveyResponse.survey_id == survey_id).count()
    responses = (
        db.query(SurveyResponse)
        .filter(SurveyResponse.survey_id == survey_id)
        .order_by(SurveyResponse.completed_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return ApiResponse.ok(ResponsesPage(
        total=total,
        responses=[
            SurveyResponseOut(
                id=r.id,
                survey_id=r.survey_id,
                answers_json=r.answers_json,
                completed_at=r.completed_at.isoformat(),
            )
            for r in responses
        ],
    ))


@router.delete("/{survey_id}", response_model=ApiResponse[dict])
def delete_survey(survey_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    survey = db.get(Survey, survey_id)
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    project = db.query(Project).filter(Project.id == survey.project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(status_code=403, detail="Forbidden")
    db.delete(survey)
    db.commit()
    return ApiResponse.ok({"deleted": True})


@router.put("/{survey_id}/close", response_model=ApiResponse[SurveyOut])
def close_survey(survey_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    survey = db.get(Survey, survey_id)
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    project = db.query(Project).filter(Project.id == survey.project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(status_code=403, detail="Forbidden")
    survey.status = SurveyStatus.closed
    survey.closed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(survey)
    return ApiResponse.ok(_survey_out(survey))
