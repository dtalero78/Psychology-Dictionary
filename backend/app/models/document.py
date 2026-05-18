from sqlalchemy import String, ForeignKey, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base, TimestampMixin, new_uuid


class ApaDocument(Base, TimestampMixin):
    __tablename__ = "apa_documents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    content_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    pdf_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    docx_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    project: Mapped["Project"] = relationship(back_populates="apa_documents")  # noqa: F821
