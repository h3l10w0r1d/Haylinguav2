# backend/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import Base, engine, SessionLocal
from routes import router as api_router
from seed_data import seed_alphabet_lessons  # <- NOTE: from seed_data, not db_utils


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

app.include_router(api_router)


@app.on_event("startup")
def on_startup():
    # Create tables if they don't exist
    Base.metadata.create_all(bind=engine)

    # Seed alphabet lessons
    db = SessionLocal()
    try:
        seed_alphabet_lessons(db)
        db.commit()
    finally:
        db.close()
