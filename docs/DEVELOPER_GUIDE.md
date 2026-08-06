# Developer Guide

## Code conventions

- **TypeScript strict mode** everywhere in `frontend/` and `backend/` — no
  `any` without a comment explaining why.
- **Zod / Pydantic at every trust boundary.** Any data crossing from the
  browser → backend, or backend → ML service, is validated before use.
  Never trust a payload shape from a type annotation alone.
- **Commit messages**: Conventional Commits (`feat:`, `fix:`, `docs:`,
  `refactor:`, `test:`, `chore:`). CI does not currently enforce this but it
  keeps the changelog generatable later.
- **Branch strategy**: `main` (protected, deploy-triggering) ← `develop`
  (integration) ← feature branches (`feat/anomaly-threshold-tuning`, etc.).
  Open PRs into `develop`; `develop` merges into `main` for releases.

## Auth

This reference build intentionally does **not** ship a login/registration
endpoint — issuing JWTs is treated as an integration point, not a library
concern, since most institutions already have an identity provider (SSO,
LMS-integrated auth, etc.) that should be the source of truth for who's a
student vs. instructor.

To wire in your own:
1. Implement `POST /api/auth/login` (or delegate to your IdP) that verifies
   credentials and returns a JWT shaped `{ id, role }`, signed with the same
   `JWT_SECRET` the backend already reads.
2. Nothing else needs to change — `requireAuth`/`requireRole` in
   `src/middleware/auth.ts` already consume that shape.

## Extending the anomaly model

`ml-service/app/model.py` isolates all model logic behind `SessionModel` and
`ModelRegistry`. To swap `MLPRegressor` for a Keras/TensorFlow autoencoder:

1. Replace the `model.fit` / `model.predict` calls in `train_baseline()` and
   `score()` — the rest of the class (baseline collection, threshold logic,
   registry) is framework-agnostic.
2. Keep `features_to_vector()`'s output shape (8 features) unless you also
   update `FEATURE_NAMES` and the frontend worker's feature computation.
3. Re-run `pytest tests/test_model.py` — the false-positive-rate and
   attack-detection assertions must still pass with the new model.

## Extending the ledger

`backend/src/ledger/ledgerService.ts` is deliberately small and pure where
possible (`computeBlockHash` has no side effects). If you need to change
what goes into a block's hash (e.g. adding a `nonce` or moving to a Merkle
tree of multiple events per block instead of one-event-per-block):

1. This is a **breaking change** for every previously-issued hash. Version
   it — e.g. add a `version` field to the canonical JSON so old and new
   blocks can both verify correctly against their own version's algorithm.
2. Update `computeBlockHash` and `verifyChain` together; they must stay in
   lockstep by construction (`verifyChain` re-derives via the exact same
   function).
3. Add a regression test proving old-format blocks still verify.

## Adding a new telemetry signal

1. `frontend/public/telemetry.worker.js`: add the new event type to the
   `onmessage` switch, aggregate it into `buildBatchPayload()`.
2. `frontend/hooks/useTelemetry.ts`: add the corresponding `window`
   listener that posts the raw event to the worker.
3. `backend/src/utils/schemas.ts`: extend `telemetryBatchSchema`.
4. `ml-service/app/schemas.py`: extend `BehaviorFeatures` if the ML model
   should consider it; `ml-service/app/model.py`'s `features_to_vector` if so.
5. Update `docs/API.md`'s telemetry payload example.

## Local development loop

```bash
docker compose up postgres ml-service -d   # keep infra running
cd backend && npm run dev                  # hot-reload via tsx watch
cd frontend && npm run dev                 # hot-reload via next dev
```
