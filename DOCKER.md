# Docker

Containerizes the backend (and, for local dev/testing parity, the frontend)
without changing where anything is hosted. Backend still deploys to Render;
frontend still deploys to Vercel via its own build pipeline (`vercel.json`).
The only thing this changes on Render is *how* the existing backend service
gets built — from a Dockerfile instead of Render's native Python buildpack.

## Local development / testing

```bash
docker compose up --build
```

- Backend: http://localhost:8000 (Postgres at localhost:5434, disposable —
  unrelated to the real managed database)
- Frontend: http://localhost:8080 (static build, served by nginx, points at
  the local backend)

Run the backend test suite against the compose Postgres instead of a
manually-created local one:

```bash
docker compose up -d db
DATABASE_URL=postgresql://postgres:postgres@localhost:5434/haylingua \
EMAIL_CODE_PEPPER=test JWT_SECRET_KEY=test CRON_SECRET=test DISABLE_RATE_LIMIT=true \
python3 -m pytest backend/tests -q
```

Tear down: `docker compose down -v` (the `-v` also drops the local Postgres
volume — fine, it's disposable).

## Building the production backend image directly

```bash
docker build -f backend/Dockerfile -t haylingua-backend .
docker run --rm -p 8000:8000 \
  -e DATABASE_URL=postgresql://postgres:postgres@host.docker.internal:5434/haylingua \
  -e EMAIL_CODE_PEPPER=test -e JWT_SECRET_KEY=test -e CRON_SECRET=test \
  haylingua-backend
```

Build context is the **repo root** (not `backend/`) — the Dockerfile does
`COPY backend/ .`, so it needs to see the `backend/` directory relative to
where the build runs.

## Switching the Render service to Docker (manual, one-time)

This is the one step that has to happen in Render's dashboard — deploy
config isn't something to change without you looking at it directly:

1. Render dashboard → the `haylinguav2` backend service → **Settings**.
2. Under **Build & Deploy**, change **Runtime** from the current native
   environment to **Docker**.
3. Set **Dockerfile Path** to `backend/Dockerfile`.
4. Set **Docker Build Context Directory** to `.` (repo root) — required,
   since the Dockerfile copies `backend/` relative to that root.
5. Leave existing environment variables as-is — nothing needs to change
   there; the Docker image reads the same env vars the current buildpack
   deploy does (`DATABASE_URL`, `JWT_SECRET_KEY`, `EMAIL_CODE_PEPPER`,
   `SENTRY_DSN`, etc.).
6. Save, then trigger a manual deploy and watch the build logs for the
   first run — confirm `/health` returns `200` before considering it done.

Nothing else on Render needs to change: same service, same URL
(`haylinguav2.onrender.com`), same persistent disk mount (if configured),
same auto-deploy-on-push behavior. Only the build mechanism changes.

## Why no Kubernetes

Render doesn't run Kubernetes manifests — it's a PaaS that builds and runs
your container for you. True Kubernetes would mean provisioning and
operating a separate managed cluster (EKS/GKE/AKS/DigitalOcean Kubernetes)
alongside or instead of Render — a materially bigger, separate piece of
infrastructure. Not built here; ask if that's actually wanted and which
cloud provider to target.
