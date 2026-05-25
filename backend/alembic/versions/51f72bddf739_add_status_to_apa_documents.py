"""add status + error to apa_documents

Revision ID: 51f72bddf739
Revises: 2e159076af57
Create Date: 2026-05-25 19:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '51f72bddf739'
down_revision: Union[str, None] = '2e159076af57'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SCHEMA = "psydict"


def upgrade() -> None:
    # `pending` while the async task is running; `ready` once content_json and
    # pdf_url are populated; `failed` if the task raises. Default existing rows
    # to `ready` so historical docs keep working.
    op.add_column(
        'apa_documents',
        sa.Column('status', sa.String(length=20), nullable=False, server_default='ready'),
        schema=SCHEMA,
    )
    op.add_column(
        'apa_documents',
        sa.Column('error', sa.Text(), nullable=True),
        schema=SCHEMA,
    )


def downgrade() -> None:
    op.drop_column('apa_documents', 'error', schema=SCHEMA)
    op.drop_column('apa_documents', 'status', schema=SCHEMA)
