#!/usr/bin/env python3
# backend/scripts/bootstrap_scratch_db.py — stand up a throwaway Postgres
# schema for local/CI verification (reproduce a bug, test a fix, before
# committing). Formalizes the manual steps used to verify the SQL-syntax
# fixes and /health check in this repo's history.
#
# Usage:
#   DATABASE_URL=postgresql://user@/scratch_db?host=/tmp \
#     python3 backend/scripts/bootstrap_scratch_db.py
#
# What it does:
#   1. Base.metadata.create_all() — creates the core ORM tables (users,
#      lessons, exercises, ...) from models.py.
#   2. ensure_schema() — runs the same incremental migration the real app
#      runs on every startup, bringing the scratch DB to the current schema.
#
# After this, DATABASE_URL points at a fully-migrated, empty database you
# can safely reproduce bugs against and throw away.
import os
import sys

_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)


def main() -> int:
    if not os.getenv("DATABASE_URL"):
        print("[bootstrap_scratch_db] DATABASE_URL is not set; aborting.")
        return 1

    from database import Base, engine
    import models  # noqa: F401 — registers tables on Base.metadata
    from ensure_schema import ensure_schema

    Base.metadata.create_all(engine)
    print("[bootstrap_scratch_db] base ORM schema created")

    ensure_schema()
    return 0


if __name__ == "__main__":
    sys.exit(main())
