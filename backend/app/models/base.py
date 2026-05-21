import uuid
from datetime import datetime, timezone
from sqlalchemy import DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import MetaData
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# Explicit schema keeps psydict tables isolated from other projects
# sharing the same PostgreSQL cluster. All queries become psydict.tablename,
# so search_path doesn't matter.
_metadata = MetaData(schema="psydict")


class Base(DeclarativeBase):
    metadata = _metadata


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


def new_uuid() -> str:
    return str(uuid.uuid4())
