# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import router as api_router
from db_utils import seed_alphabet_lessons

app = FastAPI()

# 🔧 CORS – include your real frontend URLs (Vercel)
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",

    # Vercel production
    "https://haylinguav2.vercel.app",

    # (optional) your domains if you also use them
    "https://haylingua.netlify.app",
    "https://www.haylingua.netlify.app",
    "https://haylingua.com",
    "https://www.haylingua.com",
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
def on_startup() -> None:
    """
    Runs once when the app starts.
    We seed the alphabet lessons into the DB.
    """
    try:
        print("[startup] Seeding alphabet lessons…")
        seed_alphabet_lessons()
        print("[startup] Seeding complete.")
    except Exception as exc:
        print("[startup] Error while seeding lessons:", repr(exc))
        raise


app.include_router(api_router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
