# Cryptographic Exam Proctoring & Behavioral Integrity Auditor

A privacy-first alternative to video-based exam proctoring. Instead of
recording students, it establishes trust in a remote exam session using:

1. **Keystroke biometrics** captured off-thread in a Web Worker — hold time
   and flight time only, never the actual keys typed.
2. **A per-student autoencoder anomaly detector** (scikit-learn MLPRegressor)
   that flags rhythm changes consistent with someone else typing or
   automated text injection.
3. **A SHA-256 hash-chained audit ledger**, so the evidence trail itself is
   tamper-evident and independently verifiable by anyone with dashboard
   access — not just trusted by fiat.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full system design
and engineering rationale.

## Quickstart (Docker Compose)

```bash
git clone <repo-url>
cd exam-integrity-auditor
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
cp ml-service/.env.example ml-service/.env
# edit backend/.env and set a real JWT_SECRET
docker compose up --build
```

- Frontend (exam UI + dashboard): http://localhost:3000
- Backend API: http://localhost:4000
- ML service: http://localhost:8000
- Postgres: localhost:5432

See [`docs/INSTALLATION.md`](docs/INSTALLATION.md) for running each service
individually without Docker, and [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)
for production deployment to Vercel/Render/Neon.

## Project layout

```
exam-integrity-auditor/
├── frontend/       Next.js exam UI + instructor dashboard, Web Worker telemetry
├── backend/        Node/Express API gateway, Prisma schema, crypto ledger
├── ml-service/     Python FastAPI autoencoder anomaly detection
├── docs/           Architecture, API, deployment, troubleshooting docs
└── .github/        CI/CD workflows
```

Full breakdown in [`docs/FOLDER_STRUCTURE.md`](docs/FOLDER_STRUCTURE.md).

## Documentation index

| Doc | Covers |
|---|---|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, milestones, engineering decisions |
| [INSTALLATION.md](docs/INSTALLATION.md) | Local dev setup, per-service |
| [ENVIRONMENT_VARIABLES.md](docs/ENVIRONMENT_VARIABLES.md) | Every env var, what it does, where it's used |
| [API.md](docs/API.md) | REST endpoint reference |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Production deployment (Vercel/Render/Neon) |
| [DEVELOPER_GUIDE.md](docs/DEVELOPER_GUIDE.md) | Codebase conventions, how to extend |
| [USER_GUIDE.md](docs/USER_GUIDE.md) | For students & instructors |
| [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Common issues and fixes |

## Testing

```bash
cd backend && npm install && npm test        # 6 tests — hash chain correctness/tamper detection
cd ml-service && pip install -r requirements.txt pytest httpx && pytest tests/ -v  # 5 tests — anomaly detection
cd frontend && npm install && npm run lint && npm run build
```

## License

Add your license of choice here (MIT recommended for a reference build).
