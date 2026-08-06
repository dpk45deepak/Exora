# Folder Structure

```
exam-integrity-auditor/
│
├── frontend/                       Next.js 14 App Router application
│   ├── app/
│   │   ├── exam/[sessionId]/       Student exam-taking page
│   │   ├── dashboard/              Instructor dashboard (list view)
│   │   │   └── [sessionId]/        Session drill-down (timeline + verify)
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── StatusBadge.tsx
│   │   └── VerifyChainButton.tsx
│   ├── hooks/
│   │   └── useTelemetry.ts         Web Worker lifecycle + batch POST logic
│   ├── lib/
│   │   └── api.ts                  Typed fetch wrappers for backend endpoints
│   ├── public/
│   │   └── telemetry.worker.js     Off-main-thread keystroke biometric capture
│   ├── Dockerfile
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── package.json
│
├── backend/                        Node.js/Express API gateway
│   ├── src/
│   │   ├── routes/
│   │   │   ├── session.ts          Start/submit/verify session endpoints
│   │   │   ├── telemetry.ts        Telemetry ingestion endpoint
│   │   │   └── dashboard.ts        Instructor read endpoints
│   │   ├── services/
│   │   │   └── mlClient.ts         HTTP client to the Python ML service
│   │   ├── ledger/
│   │   │   └── ledgerService.ts    SHA-256 hash-chain append + verify logic
│   │   ├── middleware/
│   │   │   └── auth.ts             JWT verification + role-based access control
│   │   ├── utils/
│   │   │   └── schemas.ts          Zod request validation schemas
│   │   ├── db/
│   │   │   └── prisma.ts           Prisma client singleton
│   │   └── index.ts                App entrypoint, middleware wiring
│   ├── prisma/
│   │   └── schema.prisma           Users, ExamSession, AuditEvent, LedgerBlock, BiometricBaseline
│   ├── tests/
│   │   └── ledgerService.test.ts   Hash-chain determinism + tamper-detection tests
│   ├── Dockerfile
│   └── package.json
│
├── ml-service/                     Python FastAPI ML microservice
│   ├── app/
│   │   ├── main.py                 FastAPI app, /analyze-behavior endpoint
│   │   ├── model.py                MLPRegressor autoencoder, ModelRegistry
│   │   └── schemas.py              Pydantic request/response models
│   ├── tests/
│   │   └── test_model.py           Anomaly detection correctness tests
│   ├── Dockerfile
│   └── requirements.txt
│
├── docs/                           All project documentation (this file included)
├── scripts/                        One-off ops/maintenance scripts (empty — add as needed)
├── tests/                          Reserved for cross-service integration tests
├── .github/workflows/              CI (test+build) and CD (deploy) pipelines
├── docker-compose.yml              Local multi-service orchestration
├── .gitignore
└── README.md
```

## Design rationale

- **Service boundaries mirror deployment boundaries.** `frontend/`,
  `backend/`, and `ml-service/` are each independently deployable (Vercel,
  Render, Render) and independently testable — no shared `node_modules` or
  cross-imports between them.
- **`ledger/` is separated from `routes/`** in the backend deliberately: the
  cryptographic chaining logic is the most security-sensitive code in the
  system and is kept as a small, independently unit-testable module rather
  than inlined into request handlers.
- **`docs/` is exhaustive on purpose** — an audit trail product needs its own
  operational trail: anyone evaluating whether to trust this system's
  output should be able to read exactly how it works without reading code.
