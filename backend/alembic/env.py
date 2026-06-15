import os
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool, text
from alembic import context
from dotenv import load_dotenv

load_dotenv()

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

database_url = os.getenv("DATABASE_URL")
if database_url:
    config.set_main_option("sqlalchemy.url", database_url)

from app.models.base import Base
from app.models import *  # noqa: F401, F403 — ensures all models are registered

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_schemas=True,
        version_table_schema="psydict",
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect().execution_options(isolation_level="AUTOCOMMIT") as setup_conn:
        # Ensure the schema exists; alembic versioning then takes over.
        #
        # NOTE: This used to also DROP SCHEMA psydict CASCADE when an early-
        # deploy column check failed, which silently destroyed every row in
        # users/projects/surveys/responses/analyses/apa_documents/etc on a
        # legitimately-stale boot. That recovery path is now gated behind an
        # explicit env var (ALEMBIC_NUKE_PSYDICT=1) so it can never fire
        # automatically in production. Use it only as a one-time recovery on a
        # fresh dev DB.
        if os.getenv("ALEMBIC_NUKE_PSYDICT") == "1":
            print("[migrate] ALEMBIC_NUKE_PSYDICT=1 — dropping psydict schema (DESTRUCTIVE)")
            setup_conn.execute(text("DROP SCHEMA IF EXISTS psydict CASCADE"))

        setup_conn.execute(text("CREATE SCHEMA IF NOT EXISTS psydict"))

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_schemas=True,
            version_table_schema="psydict",
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
