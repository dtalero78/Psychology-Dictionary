import secrets
from datetime import datetime
from sqlalchemy import String, ForeignKey, Enum as SAEnum, JSON, DateTime, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base, TimestampMixin, new_uuid
import enum


class SurveyStatus(str, enum.Enum):
    active = "active"
    closed = "closed"
    draft = "draft"


def new_token() -> str:
    return secrets.token_urlsafe(12)


class Survey(Base, TimestampMixin):
    __tablename__ = "surveys"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    token: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, default=new_token, index=True)
    status: Mapped[SurveyStatus] = mapped_column(SAEnum(SurveyStatus), default=SurveyStatus.active, nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    config_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    project: Mapped["Project"] = relationship(back_populates="surveys")  # noqa: F821
    responses: Mapped[list["SurveyResponse"]] = relationship(back_populates="survey", cascade="all, delete-orphan")


class SurveyResponse(Base):
    __tablename__ = "survey_responses"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    survey_id: Mapped[str] = mapped_column(String(36), ForeignKey("surveys.id", ondelete="CASCADE"), nullable=False, index=True)
    answers_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ip_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)

    survey: Mapped["Survey"] = relationship(back_populates="responses")
