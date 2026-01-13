# backend/database.py
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Render uses HAY_DB_URL – locally you can set the same
DATABASE_URL = os.getenv("HAY_DB_URL")

if not DATABASE_URL:
    # Fallback for local dev – adjust if needed
    DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/haylingua"

engine = create_engine(
    DATABASE_URL,
    future=True,
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

Base = declarative_base()
