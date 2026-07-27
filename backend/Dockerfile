# backend/Dockerfile
# Production image for the FastAPI backend. Built from the repo root so it
# can COPY only backend/ — keep the build context there (see docker-compose.yml
# and DOCKER.md for the exact `docker build -f backend/Dockerfile .` invocation).
FROM python:3.12-slim AS base

# psycopg2-binary/bcrypt/pillow ship manylinux wheels for this base image, so
# no compiler toolchain is needed at runtime. libpq5 is still required at
# runtime for psycopg2-binary's bundled libpq to link against on some slim
# images; installing it explicitly avoids relying on an implicit transitive dep.
# ffmpeg: Azure Speech-to-Text's REST API only accepts WAV/PCM or OGG/Opus —
# browser recordings come in as WebM/Opus (a different container, same
# codec), which Azure rejects outright. Used to transcode before forwarding.
# libcairo2: cairosvg (mobile's server-side avatar SVG->PNG rasterization,
# since React Native has no <canvas>) shells out to the system Cairo lib via
# cairocffi rather than bundling it — pip alone can't satisfy this.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq5 ffmpeg libcairo2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

# Render (and most PaaS Docker runtimes) inject PORT at runtime; default to
# 8000 for local `docker run` / docker-compose parity with the existing
# non-Docker Render config.
ENV PORT=8000
EXPOSE 8000

# Un-privileged runtime user — the app doesn't need root, and Render's Docker
# runtime doesn't require it either. Owns /app so the local "uploads"
# fallback dir (see main.py's _uploads_dir()) is actually writable — without
# a Render Persistent Disk mounted at /var/data, that's the path used.
RUN useradd --create-home --uid 10001 appuser && chown -R appuser:appuser /app
USER appuser

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
