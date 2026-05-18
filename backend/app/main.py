from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from pathlib import Path

from .config import get_settings
from .routers import auth, projects, instruments, surveys, public, analysis, documents, subscriptions

settings = get_settings()

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="Psychology Dictionary: AI Tutor API",
    version="1.0.0",
    docs_url="/docs" if not settings.is_production else None,
    redoc_url=None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

static_dir = Path(__file__).parent.parent.parent / "web" / "static"
if static_dir.exists():
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(instruments.router)
app.include_router(surveys.router)
app.include_router(public.router)
app.include_router(analysis.router)
app.include_router(documents.router)
app.include_router(subscriptions.router)


@app.get("/health")
def health():
    return {"status": "ok", "version": "1.0.0"}
