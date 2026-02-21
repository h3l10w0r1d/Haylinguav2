"""Render entrypoint.

Render commonly runs this service with `uvicorn main:app`.
This top-level module re-exports the FastAPI app defined in `backend/main.py`
so all API routes (e.g., /me/profile, /me/onboarding) are available regardless
of the working directory.
"""

from backend.main import app  # noqa: F401
