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

    # All psydict tables live in the "psydict" schema so they don't collide
    # with other projects sharing the same PostgreSQL cluster (e.g. BRS).
    # doadmin (superuser) can CREATE SCHEMA, so this works on DO managed DBs.
    with connectable.connect().execution_options(isolation_level="AUTOCOMMIT") as setup_conn:
        setup_conn.execute(text("CREATE SCHEMA IF NOT EXISTS psydict"))

    with connectable.connect() as connection:
        connection.execute(text("SET search_path TO psydict, public"))
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
