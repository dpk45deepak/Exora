# Troubleshooting Guide

## "JWT_SECRET must be set — refusing to start"

The backend deliberately crashes on boot rather than falling back to an
insecure default. Set `JWT_SECRET` in `backend/.env` (or the Compose/Render
environment). Generate one with `openssl rand -base64 48`.

## Telemetry batches never arrive at the dashboard

1. Check the browser console on the exam page for fetch errors — likely a
   CORS mismatch (`FRONTEND_ORIGIN` on the backend must exactly match the
   frontend's origin, including scheme and port).
2. Confirm the Web Worker actually started:
   `DevTools → Application → Frames → top → Workers` should show
   `telemetry.worker.js` running.
3. Batches only flush every 30 seconds (or immediately for a `paste` event)
   — give it time, or trigger a paste to force an immediate flush.
4. Check `POST /api/telemetry` isn't hitting the rate limit (20/min/IP) —
   unlikely in normal use, but possible during rapid manual testing.

## `anomaly_score` is always `null`

The per-session baseline needs 15 batches (~7.5 minutes of active typing)
before scoring begins. Check the `message` field in the telemetry response —
it will read `"Collecting baseline (N/15 samples)…"` until then. If it's
been much longer than that with no keystrokes at all in any batch
(`keystrokeCount: 0`), scoring is correctly being skipped — the model has
nothing to compare.

## "Verify cryptographic integrity" reports `valid: false`

This means either:
- **A broken link** (`reason` mentions "Chain link broken") — a block's
  `previousHash` doesn't match the prior block's `hash`. This should never
  happen through normal API use; it indicates a block was deleted or
  inserted out of band, or the DB was restored from an inconsistent backup.
- **A hash mismatch** (`reason` mentions "Hash mismatch") — an event's
  stored `payload` was modified after its ledger block was created. Since
  the app only grants `INSERT` on `ledger_blocks` in production (see
  ARCHITECTURE.md → Security Notes), this should require direct DB access
  outside the application to occur — treat it as a serious signal and
  investigate DB access logs immediately.

If you hit this in local development, it usually means you manually edited
a row in Prisma Studio — expected behavior, not a bug.

## ML service returns 422 on `/analyze-behavior`

The Pydantic schema (`ml-service/app/schemas.py`) rejects malformed feature
blocks — check that `holdTime`/`flightTime` each include all four of
`mean`, `stddev`, `min`, `max`, and that `stddev` is non-negative.

## `npx prisma migrate deploy` fails with a connection error

- Confirm `DATABASE_URL` is reachable from wherever the command is running
  (if running from your host machine against the Docker Compose Postgres,
  use `localhost:5432`, not `postgres:5432` — that hostname only resolves
  inside the Compose network).
- Managed Postgres providers (Neon/Supabase) often require `?sslmode=require`
  appended to the connection string.

## Docker Compose: `backend` container restarts in a loop

Almost always means migrations failed or Postgres wasn't ready yet — check
`docker compose logs backend`. The Compose file already waits on Postgres's
healthcheck before starting the backend; if this still races, increase
`start_period`/`retries` on the `postgres` healthcheck.

## Frontend builds but the dashboard shows no sessions

Check that `NEXT_PUBLIC_API_BASE_URL` was set **at build time**, not just
runtime — Next.js inlines `NEXT_PUBLIC_*` vars during `next build`. If you
changed it after building, rebuild the frontend image/deployment.
