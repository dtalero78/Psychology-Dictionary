from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.user import User, Plan
from ..models.project import Project
from ..schemas.projects import ProjectCreate, ProjectUpdate, ProjectOut, StepUpdate, StepResult
from ..schemas.common import ApiResponse
from ..dependencies import get_current_user
from ..services import claude_service

router = APIRouter(prefix="/projects", tags=["projects"])

FREE_PROJECT_LIMIT = 1


def _check_project_limit(user: User, db: Session):
    if user.plan == Plan.free:
        count = db.query(Project).filter(Project.user_id == user.id).count()
        if count >= FREE_PROJECT_LIMIT:
            raise HTTPException(status_code=402, detail="Free plan limited to 1 project. Upgrade to Pro.")


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
def list_projects(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    projects = db.query(Project).filter(Project.user_id == user.id).order_by(Project.updated_at.desc()).all()
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


@router.delete("/{project_id}", response_model=ApiResponse[dict])
def delete_project(project_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = _project_or_404(project_id, user, db)
    db.delete(project)
    db.commit()
    return ApiResponse.ok({"deleted": True})


@router.put("/{project_id}/steps/{step_number}", response_model=ApiResponse[StepResult])
async def save_step(
    project_id: str,
    step_number: int,
    body: StepUpdate,
    user: User = Depends(get_current_user),
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
