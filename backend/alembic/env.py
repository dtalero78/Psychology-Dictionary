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
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True, dialect_opts={"paramstyle": "named"})
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(config.get_section(config.config_ini_section, {}), prefix="sqlalchemy.", poolclass=pool.NullPool)

    # DO App Platform dev databases run PostgreSQL 15+ which revokes CREATE on
    # the public schema from non-owner users. We create a user-owned schema
    # "psydict" and set search_path so all tables land there instead.
    with connectable.connect().execution_options(isolation_level="AUTOCOMMIT") as setup_conn:
        try:
            setup_conn.execute(text("CREATE SCHEMA IF NOT EXISTS psydict"))
            print("[migrate] Schema psydict ready")
        except Exception as exc:
            print(f"[migrate] Schema creation warning (continuing): {exc}")

    with connectable.connect() as connection:
        connection.execute(text("SET search_path TO psydict, public"))
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
