# backend/database.py
import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Render / Railway / etc usually expose DATABASE_URL
DATABASE_URL = os.getenv("DATABASE_URL")

# --- Extra: prefer HAY_DB_URL if it's set (your custom env var) ---
# This *adds* behavior without removing the old one.
HAY_DB_URL = os.getenv("HAY_DB_URL")
if HAY_DB_URL:
    DATABASE_URL = HAY_DB_URL

if not DATABASE_URL:
    # For local dev – change if you use something else
    # Example: "postgresql://user:password@localhost:5432/haylinguav2"
    raise RuntimeError("DATABASE_URL / HAY_DB_URL is not set")

# Engine is used BOTH by:
# - Raw SQL: with engine.connect() / engine.begin()
# - ORM sessions: via SessionLocal
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,  # helps avoid stale connections on Render
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()
