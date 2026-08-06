# Deployment Guide

Target stack (all free-tier-friendly, matching the original brief):
**Vercel** (frontend) · **Render or Railway** (backend + ML service) ·
**Supabase or Neon** (Postgres).

## 1. Database — Neon or Supabase

1. Create a new Postgres project.
2. Copy the connection string (use the **pooled** connection string if
   offered — the backend uses short-lived Prisma connections well suited to
   pooling).
3. Run migrations against it once, from your machine or CI:
   ```bash
   DATABASE_URL="<connection-string>" npx prisma migrate deploy
   ```

## 2. ML service — Render/Railway

1. New Web Service, root directory `ml-service/`, Docker runtime (uses the
   provided `Dockerfile`).
2. Set `ALLOWED_ORIGIN` to the backend's public URL once you have it (step 3).
3. Health check path: `/health`.
4. Note the resulting public URL — you'll need it for `ML_SERVICE_URL`.

## 3. Backend — Render/Railway

1. New Web Service, root directory `backend/`, Docker runtime.
2. Environment variables: `DATABASE_URL`, `JWT_SECRET` (generate fresh —
   don't reuse a dev secret), `ML_SERVICE_URL` (from step 2),
   `FRONTEND_ORIGIN` (from step 4, you'll circle back and update this).
3. Start command is already `npx prisma migrate deploy && node dist/index.js`
   via the Dockerfile — migrations run automatically on deploy.
4. Health check path: `/health`.

## 4. Frontend — Vercel

1. Import the repo, set root directory to `frontend/`.
2. Environment variable: `NEXT_PUBLIC_API_BASE_URL` = backend's public URL
   from step 3.
3. Deploy. Then go back to the backend service and set `FRONTEND_ORIGIN` to
   the resulting `*.vercel.app` URL (or custom domain), and redeploy the
   backend so CORS allows it.

## 5. Wire up CI/CD

`.github/workflows/deploy.yml` triggers on push to `main` and expects these
repo secrets:

| Secret | From |
|---|---|
| `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` | Vercel dashboard → Settings → Tokens |
| `RENDER_BACKEND_DEPLOY_HOOK` | Render service → Settings → Deploy Hook |
| `RENDER_ML_DEPLOY_HOOK` | Render service → Settings → Deploy Hook |

`.github/workflows/ci.yml` runs on every push/PR and gates merges on: backend
tests passing, ML service tests passing, frontend lint+build succeeding, and
all three Docker images building cleanly.

## 6. Post-deploy checklist

- [ ] Hit `/health` on both backend and ML service public URLs
- [ ] Start a test exam session end-to-end from the deployed frontend
- [ ] Confirm a telemetry batch produces a ledger block (`GET /api/dashboard/sessions/:id/timeline`)
- [ ] Run "Verify cryptographic integrity" on the dashboard for that session — should return `valid: true`
- [ ] Confirm `ml-service` is **not** reachable from the public internet directly (only via the backend's private network URL, if your host supports internal networking — otherwise rely on the CORS + no-browser-facing-usage boundary)
- [ ] Rotate `JWT_SECRET` away from any value used during local development

## Scaling notes

- The ML service keeps trained per-session models in memory
  (`ModelRegistry`). This is fine for a single instance; if you need to
  scale the ML service horizontally, models must move to a shared store
  (see the `NOTE` in `ml-service/app/model.py`) or you must ensure
  session-affinity/sticky routing so a given session always hits the same
  instance.
- The backend is stateless and horizontally scalable as-is — all state lives
  in Postgres.
- `LedgerService.appendBlock` uses a DB transaction with an implicit
  read-then-write on the last block per session; under very high concurrent
  write volume for a *single* session (unlikely — one student, one worker,
  one batch every 30s) consider adding an explicit row lock via
  `SELECT ... FOR UPDATE` on the session row.
