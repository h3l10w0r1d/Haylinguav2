# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base
from db_utils import seed_alphabet_lessons
from routes import router as api_router

# Import models so SQLAlchemy knows about the tables before create_all
from models import User, Lesson, Exercise, ExerciseOption  # noqa: F401


app = FastAPI()

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

# Attach all API routes (tts, auth, lessons, etc.)
app.include_router(api_router)


@app.on_event("startup")
def on_startup():
    # make sure all tables exist
    Base.metadata.create_all(bind=engine)
    # seed alphabet lessons
    seed_alphabet_lessons()


@app.get("/")
def root():
    return {"status": "Backend is running"}
