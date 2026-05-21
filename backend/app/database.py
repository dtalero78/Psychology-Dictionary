from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import sessionmaker, Session
from .config import get_settings

settings = get_settings()

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

# Belt-and-suspenders: MetaData(schema="psydict") in base.py makes every query
# reference psydict explicitly, but we also set search_path so unqualified
# references (e.g. alembic_version) land in psydict too.
@event.listens_for(engine, "connect")
def _set_search_path(dbapi_conn, _record):
    with dbapi_conn.cursor() as cur:
        cur.execute("SET search_path TO psydict, public")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
