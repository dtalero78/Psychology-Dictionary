from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from ..database import get_db
from ..models.user import User, Plan
from ..models.project import Project
from ..models.document import ApaDocument
from ..schemas.documents import DocumentRequest, DocumentOut
from ..schemas.common import ApiResponse
from ..dependencies import get_current_user
from ..services import claude_service, document_service

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("", response_model=ApiResponse[DocumentOut])
async def generate_document(body: DocumentRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == body.project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    content = await claude_service.generate_apa_document({
        "title": project.title,
        "steps": project.steps_json,
    })

    pdf_url = document_service.generate_pdf(content, project.id)

    docx_url = None
    if user.plan == Plan.pro:
        docx_url = document_service.generate_docx(content, project.id)

    doc = ApaDocument(
        project_id=project.id,
        content_json=content,
        pdf_url=pdf_url,
        docx_url=docx_url,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    return ApiResponse.ok(DocumentOut(
        id=doc.id,
        project_id=doc.project_id,
        content_json=doc.content_json,
        pdf_url=doc.pdf_url,
        docx_url=doc.docx_url,
        created_at=doc.created_at.isoformat(),
    ))


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
