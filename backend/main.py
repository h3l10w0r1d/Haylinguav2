# backend/main.py
import os
import sys

_BACKEND_DIR = os.path.dirname(__file__)
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

import secrets
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response
from fastapi.openapi.docs import get_redoc_html, get_swagger_ui_html
from fastapi.openapi.utils import get_openapi
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from middleware.rate_limit import RateLimitMiddleware


class CachedStaticFiles(StaticFiles):
    """StaticFiles with a long-lived Cache-Control header. Every upload gets
    a fresh UUID-based filename (never reused/overwritten in place), so a
    URL's content never changes once served — safe to cache aggressively
    and skip re-fetching on every mount, unlike the no-cache-header default
    that was making mobile re-download the same avatar repeatedly."""

    def file_response(self, *args, **kwargs):
        response = super().file_response(*args, **kwargs)
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
        return response

from routes import router as api_router, _prune_stale_tts_cache
from routes_cms import router as cms_router  # CMS ("Content Studio") admin routes
from routes_social import router as social_router  # Friends, leaderboard, public profiles
from routes_trades import router as trades_router  # Friends-only cosmetic trading
from routes_emotes import router as emotes_router  # Friends-only emote sending
from routes_audio import router as audio_router  # NEW: Audio management
from routes_conversation import router as conversation_router  # NEW: AI Conversation
from db_utils import seed_alphabet_lessons
from seed_curriculum import seed_curriculum
from ensure_schema import ensure_schema
from lesson_analytics import router as lesson_analytics_router
from routes_seo import router as seo_router
from routes_autofix import router as autofix_router
from database import Base, engine
from sqlalchemy import text
import models  # noqa: F401 — registers users/lessons/exercises/exercise_options on Base.metadata


# Error tracking — no-op unless SENTRY_DSN is set. Init before the app so the
# FastAPI/Starlette integrations auto-instrument requests.
_SENTRY_DSN = (os.getenv("SENTRY_DSN") or "").strip()
if _SENTRY_DSN:
    try:
        import sentry_sdk

        sentry_sdk.init(
            dsn=_SENTRY_DSN,
            environment=os.getenv("SENTRY_ENVIRONMENT", "production"),
            traces_sample_rate=float(os.getenv("SENTRY_TRACES_RATE") or "0.1"),
            send_default_pii=False,
        )
        print("[sentry] error tracking enabled")
    except Exception as e:  # never let observability break startup
        print(f"[sentry] init skipped: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    if os.getenv("SEED_ON_STARTUP", "false").lower() == "true":
        seed_alphabet_lessons()
        try:
            seed_curriculum()
        except Exception as e:
            print(f"[seed_curriculum] failed: {e}")
    try:
        _prune_stale_tts_cache()
    except Exception as e:  # disk cleanup must never block startup
        print(f"[tts_cache] prune skipped: {e}")
    yield


app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)

_DOCS_USER = (os.getenv("DOCS_USERNAME") or "").strip()
_DOCS_PASS = (os.getenv("DOCS_PASSWORD") or "").strip()


def _check_basic_auth(request: Request) -> bool:
    """Return True if the request carries valid Basic credentials."""
    if not _DOCS_USER or not _DOCS_PASS:
        return False
    auth = request.headers.get("Authorization", "")
    if not auth.lower().startswith("basic "):
        return False
    import base64
    try:
        decoded = base64.b64decode(auth[6:]).decode()
        user, _, pwd = decoded.partition(":")
    except Exception:
        return False
    return (
        secrets.compare_digest(user.encode(), _DOCS_USER.encode()) and
        secrets.compare_digest(pwd.encode(), _DOCS_PASS.encode())
    )


_CHALLENGE = Response(
    status_code=401,
    headers={"WWW-Authenticate": 'Basic realm="Haylingua API docs"'},
)


@app.get("/docs", include_in_schema=False)
async def _docs(request: Request):
    if not _check_basic_auth(request):
        return _CHALLENGE
    return get_swagger_ui_html(openapi_url="/openapi.json", title="Haylingua API")


@app.get("/redoc", include_in_schema=False)
async def _redoc(request: Request):
    if not _check_basic_auth(request):
        return _CHALLENGE
    return get_redoc_html(openapi_url="/openapi.json", title="Haylingua API")


@app.get("/openapi.json", include_in_schema=False)
async def _openapi(request: Request):
    if not _check_basic_auth(request):
        return _CHALLENGE
    return get_openapi(title=app.title, version=app.version, routes=app.routes)


def _uploads_dir() -> str:
    """Return a writable uploads directory.

    Render instances have an ephemeral filesystem. If a Persistent Disk is mounted,
    we want to store uploads on it so they survive redeploys.

    IMPORTANT: Do not assume /var/data is writable just because it exists.
    Some environments include /var/data as a system directory without a disk mount.
    """

    def _try_dir(p: str) -> bool:
        try:
            os.makedirs(p, exist_ok=True)
        except PermissionError:
            return False
        except OSError:
            return False
        return os.access(p, os.W_OK)

    candidates: list[str] = []
    env = os.getenv("UPLOADS_DIR")
    if env:
        candidates.append(env)
    # Common Render Persistent Disk mount path
    candidates.append("/var/data/uploads")
    # Local dev fallback
    candidates.append("uploads")

    for p in candidates:
        if _try_dir(p):
            return p

    return "uploads"


# Serve uploaded avatars from disk (custom avatars).
# Default avatars are shipped by the frontend.
UPLOADS_DIR = _uploads_dir()
AVATAR_UPLOAD_DIR = os.path.join(UPLOADS_DIR, "avatars")
try:
    os.makedirs(AVATAR_UPLOAD_DIR, exist_ok=True)
except PermissionError:
    # Fall back to a local directory so the app can still boot.
    UPLOADS_DIR = "uploads"
    AVATAR_UPLOAD_DIR = os.path.join(UPLOADS_DIR, "avatars")
    os.makedirs(AVATAR_UPLOAD_DIR, exist_ok=True)

app.mount("/static/avatars", CachedStaticFiles(directory=AVATAR_UPLOAD_DIR), name="avatars")

# Serve uploaded banners from disk (custom banners).
# Preset banners can be shipped by the frontend and stored as "/banners/...".
BANNER_UPLOAD_DIR = os.path.join(UPLOADS_DIR, "banners")
try:
    os.makedirs(BANNER_UPLOAD_DIR, exist_ok=True)
except PermissionError:
    # Fall back to a local directory so the app can still boot.
    UPLOADS_DIR = "uploads"
    BANNER_UPLOAD_DIR = os.path.join(UPLOADS_DIR, "banners")
    os.makedirs(BANNER_UPLOAD_DIR, exist_ok=True)

app.mount("/static/banners", CachedStaticFiles(directory=BANNER_UPLOAD_DIR), name="banners")

# Serve TTS audio files used by AI Conversation (SadTalker needs a public URL).
CONV_AUDIO_DIR = os.path.join(UPLOADS_DIR, "conversation_audio")
try:
    os.makedirs(CONV_AUDIO_DIR, exist_ok=True)
except (PermissionError, OSError):
    CONV_AUDIO_DIR = os.path.join("uploads", "conversation_audio")
    os.makedirs(CONV_AUDIO_DIR, exist_ok=True)

app.mount("/static/conv-audio", StaticFiles(directory=CONV_AUDIO_DIR), name="conv_audio")

# Base ORM tables (users, lessons, exercises, exercise_options) — every other
# table ensure_schema() manages assumes these already exist (columns get
# ALTER'd onto them, or they're FOREIGN KEY targets). Only the test suite's
# conftest.py did this bootstrap before; a genuinely fresh database booting
# main.py directly (a new deploy target, disaster recovery, this Docker
# image) had nothing create these tables and crashed on the first
# ensure_table() call that references them. create_all() is a no-op for
# tables that already exist, so this changes nothing for the current,
# long-running production database.
Base.metadata.create_all(engine)

ensure_schema()

app.include_router(lesson_analytics_router)
app.include_router(api_router)
app.include_router(api_router, prefix="/api")
app.include_router(cms_router)  # CMS ("Content Studio") admin routes
app.include_router(cms_router, prefix="/api")
app.include_router(social_router)  # Friends, leaderboard, public profiles
app.include_router(social_router, prefix="/api")
app.include_router(trades_router)  # Friends-only cosmetic trading
app.include_router(trades_router, prefix="/api")
app.include_router(emotes_router)  # Friends-only emote sending
app.include_router(emotes_router, prefix="/api")
app.include_router(audio_router)  # NEW: Audio routes
app.include_router(audio_router, prefix="/api")

app.include_router(seo_router)
app.include_router(seo_router, prefix="/api")

app.include_router(conversation_router)
app.include_router(conversation_router, prefix="/api")

app.include_router(autofix_router)


# 🔒 Global rate limiting (in-memory). Applies to all endpoints; tighter rules for auth/security paths.
app.add_middleware(RateLimitMiddleware)

# 🔧 CORS – include your real frontend URLs (Vercel)
origins = [
    "https://haylinguav2.vercel.app",
    "https://haylingua.am",
    "https://www.haylingua.am",
    "http://localhost:5173",  # Added for local development
    "http://localhost:3000",    # Added for local development
    "http://localhost:8080",  # docker-compose frontend container (Dockerfile.frontend/nginx)
    "https://cms.haylingua.am",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    # 🔒 Scope Vercel previews to THIS project only. The previous
    # `https://.*\.vercel\.app` combined with allow_credentials=True let any
    # site hosted on *.vercel.app make credentialed cross-origin requests.
    allow_origin_regex=r"https://haylinguav2[a-z0-9-]*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],  # needed for Authorization header preflight
)


@app.get("/health")
def health_check(response: Response):
    """Ping target for external uptime monitors (UptimeRobot / Better Stack).
    Returns 503 on DB failure so a monitor's HTTP-status check actually
    catches a database outage, not just "the process is alive". Uses the
    engine directly (not the Depends(get_db) request dependency) so a
    connection failure is caught here instead of raising during dependency
    resolution, before this function's body would even run."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:
        response.status_code = 503
        return {"status": "down", "detail": str(exc)[:200]}
    return {"status": "ok"}


@app.get("/")
def root():
    return {
        "message": "Haylingua API",
        "version": "2.0",
        "features": [
            "User authentication with email verification",
            "Lesson management",
            "Exercise audio with TTS caching",
            "Progress tracking",
            "Social features"
        ]
    }
