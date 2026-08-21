# Cubicle

Self-hosted, open-source multi-agent harness with a 3D office UI, social agent behavior, voice calling, and multi-engine support. See [`cubicle_spec.md`](cubicle_spec.md) for full architecture and scope.

**Status: Phase 1 — Foundation.** FastAPI backend, Postgres + Redis, health check, and the `agents`/`tasks`/`settings` schema are in place. Frontend, engines, Celery workers, and social behavior land in later phases.

## Quick start

```bash
cp .env.example .env
docker compose up -d --build
curl http://localhost:8000/healthz
```

## Development

```bash
make dev          # build + run with logs attached
make migrate      # apply Alembic migrations
make test         # run the backend test suite with coverage
make psql         # open a psql shell against the cubicle DB
```
