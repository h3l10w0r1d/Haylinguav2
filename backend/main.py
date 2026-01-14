# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base
from seed_data import seed_alphabet_lessons, ensure_lesson_progress_table
from routes import router as api_router

app = FastAPI(
    title="Haylingua API",
    version="1.0.0",
)

origins = [
    "http://localhost:5173",
    "https://haylinguav2.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    # Create ORM tables if they don't exist (users, lessons, exercises, etc.)
    Base.metadata.create_all(bind=engine)

    # Raw-sql tables + seeding
    ensure_lesson_progress_table(engine)
    seed_alphabet_lessons(engine)


app.include_router(api_router)


@app.get("/")
def root():
    return {"status": "Backend is running"}
