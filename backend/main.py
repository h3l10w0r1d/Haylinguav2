# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import router as api_router
from db_utils import seed_alphabet_lessons
# I need os for getting free from seeding and relying only on the DB!!
import os


app = FastAPI()

# 🔧 CORS – include your real frontend URLs (Vercel)
origins = [
    'haylinguav2.vercel.app
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


app.include_router(api_router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
