# backend/main.py
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
import os
from pathlib import Path
from fastapi.middleware.cors import CORSMiddleware

from routes import router as api_router
from routes_audio import router as audio_router  # NEW: Audio management
from db_utils import seed_alphabet_lessons
import os
from ensure_schema import ensure_schema

from lesson_analytics import router as lesson_analytics_router


app = FastAPI()

ensure_schema()

# Register all routers
app.include_router(lesson_analytics_router)
app.include_router(api_router)

# Serve uploaded assets (avatars) from the Render disk (or /tmp locally)
DISK_ROOT = os.getenv("RENDER_DISK_PATH", "/tmp")
AVATAR_DIR = Path(DISK_ROOT) / "avatars"
AVATAR_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/static/avatars", StaticFiles(directory=str(AVATAR_DIR)), name="avatars")
app.include_router(audio_router)  # NEW: Audio routes

# 🔧 CORS – include your real frontend URLs (Vercel)
origins = [
    "https://haylinguav2.vercel.app",
    "https://haylingua.am",
    "https://www.haylingua.am",
    "http://localhost:5173",  # Added for local development
    "http://localhost:3000",    # Added for local development
    "https://cms.haylingua.am"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.vercel\.app",  # ✅ allows Vercel preview URLs too
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],  # ✅ needed for Authorization header preflight
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
