from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.user import User, Plan
from ..models.project import Project, ProjectStatus
from ..models.survey import Survey, SurveyResponse, SurveyStatus
from ..models.analysis import Analysis
from ..models.document import ApaDocument
from ..schemas.projects import ProjectCreate, ProjectUpdate, ProjectOut, StepUpdate, StepResult
from ..schemas.common import ApiResponse
from ..dependencies import get_current_user, require_ai_consent
from ..services import claude_service

router = APIRouter(prefix="/projects", tags=["projects"])

FREE_PROJECT_LIMIT = 1


def _check_project_limit(user: User, db: Session):
    """Archived projects do NOT count against the free-tier limit, so a free
    user can park an old study and start a fresh one without upgrading."""
    if user.plan == Plan.free:
        count = (
            db.query(Project)
            .filter(Project.user_id == user.id, Project.status != ProjectStatus.archived)
            .count()
        )
        if count >= FREE_PROJECT_LIMIT:
            raise HTTPException(
                status_code=402,
                detail="Free plan limited to 1 active project. Archive your current one or upgrade to Pro.",
            )


def _project_or_404(project_id: str, user: User, db: Session) -> Project:
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _project_out(p: Project) -> ProjectOut:
    return ProjectOut(
        id=p.id,
        title=p.title,
        status=p.status.value,
        current_step=p.current_step,
        steps_json=p.steps_json,
        created_at=p.created_at.isoformat(),
        updated_at=p.updated_at.isoformat(),
    )


@router.get("", response_model=ApiResponse[list[ProjectOut]])
def list_projects(
    status: str = Query("active", description="'active' (in_progress + completed) or 'archived'"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Project).filter(Project.user_id == user.id)
    if status == "archived":
        q = q.filter(Project.status == ProjectStatus.archived)
    else:
        # Default 'active' view excludes archived; preserves backward compat
        # with old clients that don't send the param.
        q = q.filter(Project.status != ProjectStatus.archived)
    projects = q.order_by(Project.updated_at.desc()).all()
    return ApiResponse.ok([_project_out(p) for p in projects])


@router.post("", response_model=ApiResponse[ProjectOut])
def create_project(body: ProjectCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    _check_project_limit(user, db)
    project = Project(user_id=user.id, title=body.title)
    db.add(project)
    db.commit()
    db.refresh(project)
    return ApiResponse.ok(_project_out(project))


@router.get("/{project_id}", response_model=ApiResponse[ProjectOut])
def get_project(project_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = _project_or_404(project_id, user, db)
    return ApiResponse.ok(_project_out(project))


@router.put("/{project_id}", response_model=ApiResponse[ProjectOut])
def update_project(project_id: str, body: ProjectUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = _project_or_404(project_id, user, db)
    if body.title is not None:
        project.title = body.title
    db.commit()
    db.refresh(project)
    return ApiResponse.ok(_project_out(project))


@router.post("/{project_id}/archive", response_model=ApiResponse[ProjectOut])
def archive_project(project_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Soft-archive a project: hides it from the active list and auto-closes
    every active survey so no more responses come in. Data is preserved and
    the project can be restored at any time. Free-tier limit ignores archived
    projects (see _check_project_limit)."""
    project = _project_or_404(project_id, user, db)
    now = datetime.now(timezone.utc)
    closed_count = 0
    for survey in project.surveys:
        if survey.status == SurveyStatus.active:
            survey.status = SurveyStatus.closed
            survey.closed_at = now
            closed_count += 1
    project.status = ProjectStatus.archived
    db.commit()
    db.refresh(project)
    return ApiResponse.ok(_project_out(project))


@router.post("/{project_id}/restore", response_model=ApiResponse[ProjectOut])
def restore_project(project_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Bring an archived project back to the active list. Surveys closed at
    archive time stay closed — the researcher must re-open them deliberately
    if they want to collect more responses."""
    project = _project_or_404(project_id, user, db)
    if project.status != ProjectStatus.archived:
        # Idempotent: already active, just return current state.
        return ApiResponse.ok(_project_out(project))

    # Restoring would push a free user past the limit — refuse with a clear
    # message so the UI can prompt them to archive something else first.
    if user.plan == Plan.free:
        active_count = (
            db.query(Project)
            .filter(
                Project.user_id == user.id,
                Project.status != ProjectStatus.archived,
                Project.id != project.id,
            )
            .count()
        )
        if active_count >= FREE_PROJECT_LIMIT:
            raise HTTPException(
                status_code=402,
                detail="Restoring would exceed your free-tier limit. Archive another project or upgrade to Pro.",
            )

    # Restore to in_progress unless the project was already on its last leg.
    if project.current_step >= 8:
        project.status = ProjectStatus.completed
    else:
        project.status = ProjectStatus.in_progress
    db.commit()
    db.refresh(project)
    return ApiResponse.ok(_project_out(project))


@router.get("/{project_id}/deletion-preview", response_model=ApiResponse[dict])
def deletion_preview(project_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Counts what `DELETE /projects/{id}` will destroy. Used by the mobile
    confirmation modal so the user sees what they're about to lose."""
    project = _project_or_404(project_id, user, db)
    surveys = db.query(Survey).filter(Survey.project_id == project.id).count()
    responses = (
        db.query(SurveyResponse)
        .join(Survey, Survey.id == SurveyResponse.survey_id)
        .filter(Survey.project_id == project.id)
        .count()
    )
    analyses = db.query(Analysis).filter(Analysis.project_id == project.id).count()
    documents = db.query(ApaDocument).filter(ApaDocument.project_id == project.id).count()
    return ApiResponse.ok({
        "title": project.title,
        "surveys": surveys,
        "responses": responses,
        "analyses": analyses,
        "apa_documents": documents,
    })


@router.delete("/{project_id}", response_model=ApiResponse[dict])
def delete_project(project_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Hard delete. Cascades to all surveys, responses, analyses and APA
    documents (FK ON DELETE CASCADE). Irreversible — UI must show the counts
    from /deletion-preview before calling this."""
    project = _project_or_404(project_id, user, db)
    db.delete(project)
    db.commit()
    return ApiResponse.ok({"deleted": True})


@router.put("/{project_id}/steps/{step_number}", response_model=ApiResponse[StepResult])
async def save_step(
    project_id: str,
    step_number: int,
    body: StepUpdate,
    # require_ai_consent ⇒ this endpoint forwards user content to Claude.
    user: User = Depends(require_ai_consent),
    db: Session = Depends(get_db),
):
    if step_number < 1 or step_number > 8:
        raise HTTPException(status_code=400, detail="Step number must be between 1 and 8")

    project = _project_or_404(project_id, user, db)
    prior_steps = {int(k): v for k, v in project.steps_json.items()}

    user_message = body.data.get("user_input", str(body.data))
    ai_response = await claude_service.run_step(step_number, user_message, prior_steps)

    steps = dict(project.steps_json)
    steps[str(step_number)] = {
        "user_input": body.data,
        "ai_response": ai_response,
    }
    project.steps_json = steps
    if step_number > project.current_step:
        project.current_step = step_number
    db.commit()
    db.refresh(project)

    return ApiResponse.ok(StepResult(
        step_number=step_number,
        ai_response=ai_response,
        step_data=steps[str(step_number)],
    ))
