# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import router as api_router
from db_utils import seed_alphabet_lessons

app = FastAPI()

# 🔧 CORS – make sure these match your real frontend URLs
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://haylingua.netlify.app",
    "https://www.haylingua.netlify.app",
    "https://haylingua.com",
    "https://www.haylingua.com",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,       # during dev you *can* temporarily use ["*"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    """
    Runs once when the app starts.

    We seed the alphabet lessons into the DB.
    This keeps all the old functionality that depended on seeded lessons.
    """
    try:
        print("[startup] Seeding alphabet lessons…")
        seed_alphabet_lessons()
        print("[startup] Seeding complete.")
    except Exception as exc:  # basic debug logging so you can see failures in Render logs
        print("[startup] Error while seeding lessons:", repr(exc))
        # Let it raise so you actually see the crash in logs instead of silently failing
        raise


# All routes are defined in backend/routes.py
app.include_router(api_router)


# Optional simple root for quick health checks
@app.get("/health")
def health_check():
    return {"status": "ok"}
