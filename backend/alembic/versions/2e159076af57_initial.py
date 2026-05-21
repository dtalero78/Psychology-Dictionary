"""initial

Revision ID: 2e159076af57
Revises:
Create Date: 2026-05-18 13:58:55.180356

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '2e159076af57'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SCHEMA = "psydict"


def upgrade() -> None:
    op.create_table(
        'instruments',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('name', sa.String(length=500), nullable=False),
        sa.Column('abbreviation', sa.String(length=50), nullable=True),
        sa.Column('construct', sa.String(length=500), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('items_json', sa.JSON(), nullable=False),
        sa.Column('scoring_json', sa.JSON(), nullable=False),
        sa.Column('apa_ref', sa.Text(), nullable=True),
        sa.Column('num_items', sa.Integer(), nullable=False),
        sa.Column('response_format', sa.String(length=100), nullable=True),
        sa.Column('is_validated', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        schema=SCHEMA,
    )
    op.create_index(op.f('ix_instruments_construct'), 'instruments', ['construct'], unique=False, schema=SCHEMA)
    op.create_index(op.f('ix_instruments_name'), 'instruments', ['name'], unique=False, schema=SCHEMA)

    op.create_table(
        'users',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('apple_sub', sa.String(length=255), nullable=True),
        sa.Column('hashed_password', sa.String(length=255), nullable=True),
        sa.Column('plan', sa.Enum('free', 'pro', name='plan', schema=SCHEMA), nullable=False),
        sa.Column('apns_token', sa.String(length=255), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        schema=SCHEMA,
    )
    op.create_index(op.f('ix_users_apple_sub'), 'users', ['apple_sub'], unique=True, schema=SCHEMA)
    op.create_index(op.f('ix_users_email'), 'users', ['email'], unique=True, schema=SCHEMA)

    op.create_table(
        'projects',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('title', sa.String(length=500), nullable=False),
        sa.Column('status', sa.Enum('in_progress', 'completed', 'archived', name='projectstatus', schema=SCHEMA), nullable=False),
        sa.Column('current_step', sa.Integer(), nullable=False),
        sa.Column('steps_json', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], [f'{SCHEMA}.users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        schema=SCHEMA,
    )
    op.create_index(op.f('ix_projects_user_id'), 'projects', ['user_id'], unique=False, schema=SCHEMA)

    op.create_table(
        'subscriptions',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=36), nullable=False),
        sa.Column('provider', sa.String(length=50), nullable=False),
        sa.Column('product_id', sa.String(length=200), nullable=False),
        sa.Column('rc_customer_id', sa.String(length=255), nullable=True),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.Enum('active', 'expired', 'cancelled', 'grace_period', name='subscriptionstatus', schema=SCHEMA), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], [f'{SCHEMA}.users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        schema=SCHEMA,
    )
    op.create_index(op.f('ix_subscriptions_user_id'), 'subscriptions', ['user_id'], unique=False, schema=SCHEMA)

    op.create_table(
        'analyses',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('project_id', sa.String(length=36), nullable=False),
        sa.Column('test_type', sa.String(length=100), nullable=False),
        sa.Column('input_json', sa.JSON(), nullable=False),
        sa.Column('result_json', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], [f'{SCHEMA}.projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        schema=SCHEMA,
    )
    op.create_index(op.f('ix_analyses_project_id'), 'analyses', ['project_id'], unique=False, schema=SCHEMA)

    op.create_table(
        'apa_documents',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('project_id', sa.String(length=36), nullable=False),
        sa.Column('content_json', sa.JSON(), nullable=False),
        sa.Column('pdf_url', sa.Text(), nullable=True),
        sa.Column('docx_url', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], [f'{SCHEMA}.projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        schema=SCHEMA,
    )
    op.create_index(op.f('ix_apa_documents_project_id'), 'apa_documents', ['project_id'], unique=False, schema=SCHEMA)

    op.create_table(
        'surveys',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('project_id', sa.String(length=36), nullable=False),
        sa.Column('token', sa.String(length=50), nullable=False),
        sa.Column('status', sa.Enum('active', 'closed', 'draft', name='surveystatus', schema=SCHEMA), nullable=False),
        sa.Column('title', sa.String(length=500), nullable=False),
        sa.Column('config_json', sa.JSON(), nullable=False),
        sa.Column('closed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['project_id'], [f'{SCHEMA}.projects.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        schema=SCHEMA,
    )
    op.create_index(op.f('ix_surveys_project_id'), 'surveys', ['project_id'], unique=False, schema=SCHEMA)
    op.create_index(op.f('ix_surveys_token'), 'surveys', ['token'], unique=True, schema=SCHEMA)

    op.create_table(
        'survey_responses',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('survey_id', sa.String(length=36), nullable=False),
        sa.Column('answers_json', sa.JSON(), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('ip_hash', sa.String(length=64), nullable=True),
        sa.ForeignKeyConstraint(['survey_id'], [f'{SCHEMA}.surveys.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        schema=SCHEMA,
    )
    op.create_index(op.f('ix_survey_responses_survey_id'), 'survey_responses', ['survey_id'], unique=False, schema=SCHEMA)


def downgrade() -> None:
    op.drop_index(op.f('ix_survey_responses_survey_id'), table_name='survey_responses', schema=SCHEMA)
    op.drop_table('survey_responses', schema=SCHEMA)
    op.drop_index(op.f('ix_surveys_token'), table_name='surveys', schema=SCHEMA)
    op.drop_index(op.f('ix_surveys_project_id'), table_name='surveys', schema=SCHEMA)
    op.drop_table('surveys', schema=SCHEMA)
    op.drop_index(op.f('ix_apa_documents_project_id'), table_name='apa_documents', schema=SCHEMA)
    op.drop_table('apa_documents', schema=SCHEMA)
    op.drop_index(op.f('ix_analyses_project_id'), table_name='analyses', schema=SCHEMA)
    op.drop_table('analyses', schema=SCHEMA)
    op.drop_index(op.f('ix_subscriptions_user_id'), table_name='subscriptions', schema=SCHEMA)
    op.drop_table('subscriptions', schema=SCHEMA)
    op.drop_index(op.f('ix_projects_user_id'), table_name='projects', schema=SCHEMA)
    op.drop_table('projects', schema=SCHEMA)
    op.drop_index(op.f('ix_users_email'), table_name='users', schema=SCHEMA)
    op.drop_index(op.f('ix_users_apple_sub'), table_name='users', schema=SCHEMA)
    op.drop_table('users', schema=SCHEMA)
    op.drop_index(op.f('ix_instruments_name'), table_name='instruments', schema=SCHEMA)
    op.drop_index(op.f('ix_instruments_construct'), table_name='instruments', schema=SCHEMA)
    op.drop_table('instruments', schema=SCHEMA)
