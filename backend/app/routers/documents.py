import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from ..database import SessionLocal, get_db
from ..models.user import User, Plan
from ..models.project import Project
from ..models.document import ApaDocument
from ..schemas.documents import DocumentRequest, DocumentOut
from ..schemas.common import ApiResponse
from ..dependencies import get_current_user, require_ai_consent
from ..services import claude_service, document_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/documents", tags=["documents"])


def _doc_out(d: ApaDocument) -> DocumentOut:
    return DocumentOut(
        id=d.id,
        project_id=d.project_id,
        status=d.status,
        error=d.error,
        content_json=d.content_json,
        pdf_url=d.pdf_url,
        docx_url=d.docx_url,
        created_at=d.created_at.isoformat(),
    )


async def _run_generation(document_id: str, project_id: str, user_plan: str) -> None:
    """Heavy work: Claude → PDF/DOCX → Spaces → mark ready. Runs detached from
    the HTTP request so we survive the 90s DO App Platform gateway timeout."""
    db = SessionLocal()
    try:
        project = db.get(Project, project_id)
        if not project:
            raise RuntimeError("project disappeared mid-generation")
        content = await claude_service.generate_apa_document({
            "title": project.title,
            "steps": project.steps_json,
        })
        # reportlab/python-docx/boto3 are sync — offload to a thread so the
        # event loop can keep serving GET /documents/{id} polls in parallel.
        pdf_url = await asyncio.to_thread(document_service.generate_pdf, content, project_id)
        docx_url = await asyncio.to_thread(document_service.generate_docx, content, project_id) if user_plan == Plan.pro.value else None

        doc = db.get(ApaDocument, document_id)
        if doc is None:
            return
        doc.content_json = content
        doc.pdf_url = pdf_url
        doc.docx_url = docx_url
        doc.status = "ready"
        doc.error = None
        db.commit()
    except Exception as e:
        logger.exception("APA generation failed for document %s", document_id)
        doc = db.get(ApaDocument, document_id)
        if doc is not None:
            doc.status = "failed"
            doc.error = str(e)[:500]
            db.commit()
    finally:
        db.close()


@router.get("/by-project/{project_id}", response_model=ApiResponse[list[DocumentOut]])
def list_documents(project_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    docs = (
        db.query(ApaDocument)
        .filter(ApaDocument.project_id == project_id)
        .order_by(ApaDocument.created_at.desc())
        .all()
    )
    return ApiResponse.ok([_doc_out(d) for d in docs])


@router.get("/{document_id}", response_model=ApiResponse[DocumentOut])
def get_document(document_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = db.get(ApaDocument, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    project = db.query(Project).filter(Project.id == doc.project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(status_code=403, detail="Forbidden")
    return ApiResponse.ok(_doc_out(doc))


@router.post("", response_model=ApiResponse[DocumentOut])
async def generate_document(body: DocumentRequest, user: User = Depends(require_ai_consent), db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == body.project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Insert pending row first so the client gets an id immediately and can
    # start polling GET /documents/{id} for completion.
    doc = ApaDocument(
        project_id=project.id,
        status="pending",
        content_json={},
        pdf_url=None,
        docx_url=None,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # Fire-and-forget. The task runs in the worker's event loop and outlives
    # this request. user.plan is captured by value (not by ORM object) because
    # the session closes once this handler returns.
    asyncio.create_task(_run_generation(doc.id, project.id, user.plan.value))

    return ApiResponse.ok(_doc_out(doc))


@router.get("/{document_id}/pdf")
def download_pdf(document_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = db.get(ApaDocument, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    project = db.query(Project).filter(Project.id == doc.project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(status_code=403, detail="Forbidden")
    if not doc.pdf_url:
        raise HTTPException(status_code=404, detail="PDF not available")
    return RedirectResponse(url=doc.pdf_url)


@router.get("/{document_id}/docx")
def download_docx(document_id: str, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if user.plan != Plan.pro:
        raise HTTPException(status_code=402, detail="Pro subscription required for .docx export")
    doc = db.get(ApaDocument, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    project = db.query(Project).filter(Project.id == doc.project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(status_code=403, detail="Forbidden")
    if not doc.docx_url:
        raise HTTPException(status_code=404, detail=".docx not available")
    return RedirectResponse(url=doc.docx_url)
