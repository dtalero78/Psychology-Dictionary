import hashlib
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from pathlib import Path
from ..database import get_db
from ..models.survey import Survey, SurveyResponse, SurveyStatus
from ..models.project import Project
from ..models.user import User
from ..schemas.surveys import SubmitResponse
from ..schemas.common import ApiResponse
from ..services.push_service import send_new_response_notification
from slowapi import Limiter
from slowapi.util import get_remote_address

templates = Jinja2Templates(directory=str(Path(__file__).parent.parent.parent / "web" / "templates"))

limiter = Limiter(key_func=get_remote_address)
router = APIRouter(tags=["public"])


@router.get("/s/{token}", response_class=HTMLResponse)
def survey_page(token: str, request: Request, db: Session = Depends(get_db)):
    survey = db.query(Survey).filter(Survey.token == token).first()
    if not survey or survey.status != SurveyStatus.active:
        return templates.TemplateResponse("survey_closed.html", {"request": request, "token": token})
    return templates.TemplateResponse("survey.html", {
        "request": request,
        "survey": survey,
        "token": token,
    })


@router.post("/s/{token}/respond", response_model=ApiResponse[dict])
@limiter.limit("100/minute")
async def submit_response(token: str, body: SubmitResponse, request: Request, db: Session = Depends(get_db)):
    survey = db.query(Survey).filter(Survey.token == token).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Survey not found")
    if survey.status != SurveyStatus.active:
        raise HTTPException(status_code=409, detail="Survey is closed")

    ip = request.client.host if request.client else "unknown"
    ip_hash = hashlib.sha256(ip.encode()).hexdigest()

    response = SurveyResponse(
        survey_id=survey.id,
        answers_json=body.answers,
        completed_at=datetime.now(timezone.utc),
        ip_hash=ip_hash,
    )
    db.add(response)
    db.commit()

    total = db.query(SurveyResponse).filter(SurveyResponse.survey_id == survey.id).count()

    project = db.get(Project, survey.project_id)
    if project:
        researcher = db.get(User, project.user_id)
        if researcher and researcher.apns_token:
            send_new_response_notification(researcher.apns_token, total)

    return ApiResponse.ok({"submitted": True, "total_responses": total})
