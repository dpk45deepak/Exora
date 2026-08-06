# Environment Variables

## Backend (`backend/.env`)

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | Postgres connection string, Prisma format |
| `JWT_SECRET` | Yes | — | Signs/verifies auth tokens. App refuses to boot without it. Generate with `openssl rand -base64 48` |
| `ML_SERVICE_URL` | No | `http://localhost:8000` | Base URL of the Python FastAPI service |
| `FRONTEND_ORIGIN` | No | `http://localhost:3000` | Comma-separated allowed CORS origins |
| `PORT` | No | `4000` | HTTP port |
| `NODE_ENV` | No | `development` | Affects logging verbosity and Prisma log level |

## Frontend (`frontend/.env.local`)

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Yes | `http://localhost:4000` | Backend gateway URL. Prefixed `NEXT_PUBLIC_` so it's available client-side (the exam page and dashboard both fetch directly from the browser) |

## ML Service (`ml-service/.env`)

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `ALLOWED_ORIGIN` | No | `http://localhost:4000` | CORS allowlist — should be the backend gateway only, never the browser origin |

## Docker Compose

`docker-compose.yml` reads `JWT_SECRET` from the host shell environment
(`${JWT_SECRET:-dev_only_change_me}`) — export it before running
`docker compose up` in any environment that isn't purely local scratch use:

```bash
export JWT_SECRET=$(openssl rand -base64 48)
docker compose up --build
```

## Security notes

- Never commit filled-in `.env` files — `.gitignore` already excludes them.
- `JWT_SECRET` must be a high-entropy random string, rotated per environment
  (dev/staging/prod should never share one).
- In production, set `DATABASE_URL` to a connection string with SSL enabled
  (`?sslmode=require` for most managed Postgres providers).
