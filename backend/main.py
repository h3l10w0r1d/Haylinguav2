# backend/main.py
import os
import sys

_BACKEND_DIR = os.path.dirname(__file__)
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

from middleware.rate_limit import RateLimitMiddleware

from routes import router as api_router
from routes_audio import router as audio_router  # NEW: Audio management
from db_utils import seed_alphabet_lessons
from ensure_schema import ensure_schema
from lesson_analytics import router as lesson_analytics_router
from routes_seo import router as seo_router


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


app = FastAPI()


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

app.mount("/static/avatars", StaticFiles(directory=AVATAR_UPLOAD_DIR), name="avatars")

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

app.mount("/static/banners", StaticFiles(directory=BANNER_UPLOAD_DIR), name="banners")

ensure_schema()

app.include_router(lesson_analytics_router)
app.include_router(api_router)
app.include_router(api_router, prefix="/api")
app.include_router(audio_router)  # NEW: Audio routes
app.include_router(audio_router, prefix="/api")

app.include_router(seo_router)
app.include_router(seo_router, prefix="/api")


# 🔒 Global rate limiting (in-memory). Applies to all endpoints; tighter rules for auth/security paths.
app.add_middleware(RateLimitMiddleware)

# 🔧 CORS – include your real frontend URLs (Vercel)
origins = [
    "https://haylinguav2.vercel.app",
    "https://haylingua.am",
    "https://www.haylingua.am",
    "http://localhost:5173",  # Added for local development
    "http://localhost:3000",    # Added for local development
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


@app.on_event("startup")
def on_startup():
    if os.getenv("SEED_ON_STARTUP", "false").lower() == "true":
        seed_alphabet_lessons()


@app.get("/health")
def health_check():
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
