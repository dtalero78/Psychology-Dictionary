from sqlalchemy import String, ForeignKey, Enum as SAEnum, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base, TimestampMixin, new_uuid
import enum


class ProjectStatus(str, enum.Enum):
    in_progress = "in_progress"
    completed = "completed"
    archived = "archived"


class Project(Base, TimestampMixin):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    status: Mapped[ProjectStatus] = mapped_column(SAEnum(ProjectStatus), default=ProjectStatus.in_progress, nullable=False)
    current_step: Mapped[int] = mapped_column(default=1, nullable=False)
    steps_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)

    user: Mapped["User"] = relationship(back_populates="projects")  # noqa: F821
    surveys: Mapped[list["Survey"]] = relationship(back_populates="project", cascade="all, delete-orphan")  # noqa: F821
    analyses: Mapped[list["Analysis"]] = relationship(back_populates="project", cascade="all, delete-orphan")  # noqa: F821
    apa_documents: Mapped[list["ApaDocument"]] = relationship(back_populates="project", cascade="all, delete-orphan")  # noqa: F821
