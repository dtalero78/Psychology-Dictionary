from sqlalchemy import String, JSON, Text
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base, TimestampMixin, new_uuid


class Instrument(Base, TimestampMixin):
    __tablename__ = "instruments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    abbreviation: Mapped[str | None] = mapped_column(String(50), nullable=True)
    construct: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    items_json: Mapped[list] = mapped_column(JSON, default=list, nullable=False)
    scoring_json: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    apa_ref: Mapped[str | None] = mapped_column(Text, nullable=True)
    num_items: Mapped[int] = mapped_column(default=0, nullable=False)
    response_format: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_validated: Mapped[bool] = mapped_column(default=True, nullable=False)
