# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import Base, engine
from models import *  # noqa: F401, ensures all tables are registered
from seed_data import seed_alphabet_lessons  # or from db_utils import seed_alphabet_lessons
from routes import router as api_router


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


@app.on_event("startup")
def on_startup() -> None:
    # Create tables if they don't exist
    Base.metadata.create_all(bind=engine)
    # Seed alphabet lessons only (idempotent)
    seed_alphabet_lessons()


# Mount all API routes
app.include_router(api_router)
