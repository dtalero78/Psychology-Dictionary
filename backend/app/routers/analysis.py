from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.user import User
from ..models.project import Project
from ..models.analysis import Analysis
from ..schemas.analysis import AnalysisRequest, AnalysisResult
from ..schemas.common import ApiResponse
from ..dependencies import get_current_user
from ..services import stats_service, claude_service

router = APIRouter(prefix="/analysis", tags=["analysis"])


def _analysis_out(record: Analysis) -> AnalysisResult:
    result = record.result_json
    return AnalysisResult(
        id=record.id,
        test_type=record.test_type,
        statistic=result.get("statistic", 0.0),
        p_value=result.get("p_value", 1.0),
        effect_size=result.get("effect_size"),
        effect_label=result.get("effect_label"),
        ci_95=result.get("ci_95"),
        interpretation_apa=result.get("interpretation_apa", ""),
        result_json=result,
        created_at=record.created_at.isoformat(),
    )


@router.get("/by-project/{project_id}", response_model=ApiResponse[list[AnalysisResult]])
def list_analyses(project_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    records = (
        db.query(Analysis)
        .filter(Analysis.project_id == project_id)
        .order_by(Analysis.created_at.desc())
        .all()
    )
    return ApiResponse.ok([_analysis_out(r) for r in records])


@router.get("/{analysis_id}", response_model=ApiResponse[AnalysisResult])
def get_analysis(analysis_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    record = db.query(Analysis).filter(Analysis.id == analysis_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Analysis not found")
    project = db.query(Project).filter(Project.id == record.project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Analysis not found")
    return ApiResponse.ok(_analysis_out(record))


@router.post("", response_model=ApiResponse[AnalysisResult])
async def run_analysis(body: AnalysisRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == body.project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    try:
        result = stats_service.run_analysis(body.test_type, body.data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Analysis failed: {e}")

    project_context = f"Title: {project.title}. Steps: {project.steps_json}"
    interpretation = await claude_service.interpret_analysis(body.test_type, result, project_context)
    result["interpretation_apa"] = interpretation

    record = Analysis(
        project_id=body.project_id,
        test_type=body.test_type,
        input_json=body.data,
        result_json=result,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    return ApiResponse.ok(_analysis_out(record))
