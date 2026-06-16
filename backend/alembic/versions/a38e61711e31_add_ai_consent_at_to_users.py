"""add ai_consent_at to users

Required by App Store Guideline 5.1.2(i) revised Nov 2025 — users must opt
in before their content is sent to a named third-party AI (Anthropic Claude).
NULL = no consent on record. Existing users keep their content private until
they opt in via the in-app modal.

Revision ID: a38e61711e31
Revises: 51f72bddf739
Create Date: 2026-06-16 18:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a38e61711e31'
down_revision: Union[str, None] = '51f72bddf739'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SCHEMA = "psydict"


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('ai_consent_at', sa.DateTime(timezone=True), nullable=True),
        schema=SCHEMA,
    )


def downgrade() -> None:
    op.drop_column('users', 'ai_consent_at', schema=SCHEMA)
