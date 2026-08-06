# Cryptographic Exam Proctoring & Behavioral Integrity Auditor
## Architecture & Implementation Roadmap

## 1. Problem Analysis

**What we're actually building:** a system that establishes trust in remote exam
sessions using three independent, privacy-preserving signals instead of video:

1. **Keystroke biometrics** (hold time, flight time) captured client-side in a
   Web Worker — raw keys never leave the browser, only timing statistics do.
2. **Behavioral telemetry** (focus loss, paste events) as coarse-grained flags.
3. **An immutable, cryptographically-chained audit log** so the *evidence itself*
   can't be tampered with after the fact, and both student and professor can
   verify the chain independently.

**Non-goals (explicitly out of scope for this build):** webcam/video proctoring,
screen recording, browser lockdown/kiosk mode, biometric identity verification
(this is anomaly detection against the student's *own* baseline, not face ID).

## 2. System Architecture

```
┌─────────────────────────┐        ┌──────────────────────────┐
│   Next.js Frontend       │        │   Professor Dashboard     │
│   (Exam-taking UI)        │        │   (Next.js, separate route)│
│                          │        └──────────────┬────────────┘
│  ┌────────────────────┐ │                       │
│  │ telemetry.worker.js │ │                       │
│  │ (off main thread)   │ │                       │
│  └──────────┬──────────┘ │                       │
└─────────────┼────────────┘                       │
              │ batched POST every 30s              │
              ▼                                     ▼
      ┌───────────────────────────────────────────────────┐
      │        Node.js API Gateway (Express)               │
      │  /api/session  /api/telemetry  /api/dashboard      │
      │  ┌───────────────┐   ┌───────────────────────────┐ │
      │  │ Ledger Service │   │ ML Client (forwards to    │ │
      │  │ (SHA-256 chain)│   │ FastAPI, caches score)    │ │
      │  └───────┬────────┘   └─────────────┬─────────────┘ │
      └──────────┼───────────────────────────┼──────────────┘
                 ▼                           ▼
      ┌────────────────────┐    ┌────────────────────────────┐
      │ PostgreSQL          │    │ Python FastAPI ML service   │
      │ (Prisma ORM)        │    │ /analyze-behavior            │
      │ sessions, events,    │    │ MLPRegressor autoencoder     │
      │ ledger_blocks        │    │ per-student baseline model    │
      └────────────────────┘    └────────────────────────────┘
```

**Data flow for one telemetry batch:**
1. Worker aggregates ~30s of keystroke timing + focus/paste events into a
   compact JSON payload (no raw text, ever).
2. Frontend POSTs to `Node /api/telemetry`.
3. Node persists a raw event row, forwards the feature vector to the
   Python service.
4. Python computes reconstruction-loss anomaly score against the student's
   baseline autoencoder (trained online from the first ~5 minutes) and
   returns `{ anomaly_score, is_anomaly, threshold }`.
5. Node writes a new **ledger block**: `hash = SHA256(prevHash + JSON(event) + timestamp)`,
   linking it to the previous block for that session — this is what makes the
   trail tamper-evident.
6. Dashboard polls/subscribes to session state and can re-walk the entire
   chain to verify no block was altered or removed.

## 3. Milestones

| # | Milestone | Deliverable |
|---|-----------|-------------|
| 1 | Repo scaffold, shared contracts | folder structure, .env templates, OpenAPI-ish types |
| 2 | Frontend exam UI + Web Worker telemetry | Next.js app, worker, batching client |
| 3 | Node API gateway + Prisma schema | sessions/events/ledger endpoints |
| 4 | Cryptographic ledger service | SHA-256 hash chaining + verifier |
| 5 | Python FastAPI autoencoder service | MLPRegressor baseline + scoring endpoint |
| 6 | Professor dashboard | live table, timeline, verify-chain button |
| 7 | Docker Compose + CI/CD + docs | one-command local run, GitHub Actions |

## 4. Key Engineering Decisions (and why)

- **Web Worker, not main thread**: keystroke listeners on the main thread
  risk jank during typing-heavy exams; the worker also acts as a privacy
  boundary — it can be audited to prove raw keys are never serialized.
- **MLPRegressor over full Keras**: keeps the ML service lightweight (no GPU,
  fast cold start on free-tier hosting), while still being a genuine
  bottlenecked autoencoder (input → 8 → 4 → 8 → output). Swapping in Keras
  later only touches `ml-service/app/model.py`.
- **Hash chain, not a real blockchain**: we don't need consensus or
  decentralization, just tamper-evidence and independent verifiability —
  a linked SHA-256 chain gives us that with none of the operational
  overhead of a distributed ledger.
- **Prisma over raw SQL**: type-safe migrations, and the schema doubles as
  living documentation of the data model.
- **Anomaly threshold is per-student, not global**: reconstruction loss is
  compared against *that student's* trained baseline, so typing speed
  differences between students never cause false positives against each
  other.

## 5. Security Notes

- Telemetry payloads carry timing numbers only — never key values/characters.
- All session/dashboard endpoints require JWT auth; dashboard routes require
  an `instructor` role claim.
- Rate limiting on `/api/telemetry` (per session token) to prevent flooding.
- Ledger blocks are append-only at the DB layer (no UPDATE/DELETE grants on
  `ledger_blocks` for the app role — only INSERT).
