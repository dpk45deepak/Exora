# Installation Guide

## Prerequisites

- Node.js 20+
- Python 3.12+
- PostgreSQL 16 (or use the Docker Compose Postgres container)
- Docker + Docker Compose (recommended path — see root README)

## Option A: Docker Compose (recommended)

Covered in the root [README.md](../README.md#quickstart-docker-compose).
This runs all four services (Postgres, ML service, backend, frontend) with
one command and is the fastest way to get a working system.

## Option B: Run each service individually

### 1. PostgreSQL

```bash
docker run -d --name integrity-postgres \
  -e POSTGRES_USER=integrity \
  -e POSTGRES_PASSWORD=integrity_dev_password \
  -e POSTGRES_DB=integrity_auditor \
  -p 5432:5432 postgres:16-alpine
```

### 2. ML service (Python FastAPI)

```bash
cd ml-service
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

Verify: `curl http://localhost:8000/health` → `{"status":"ok"}`

### 3. Backend (Node/Express)

```bash
cd backend
npm install
cp .env.example .env
# edit .env: set JWT_SECRET, confirm DATABASE_URL matches your Postgres instance
npx prisma migrate dev --name init
npm run dev
```

Verify: `curl http://localhost:4000/health` → `{"status":"ok"}`

### 4. Frontend (Next.js)

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000

## Seeding a test student + instructor account

The schema does not ship with a seed script by default since password
hashing/auth provider choice is deployment-specific. A minimal seed via
Prisma Studio:

```bash
cd backend
npx prisma studio
```

Create a `User` row with `role: STUDENT` and another with `role: INSTRUCTOR`.
Password hashes must be bcrypt (or your chosen hashing) — see
[DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md#auth) for wiring up a real
registration/login endpoint, which is intentionally left as an integration
point rather than baked in (auth provider choice — Auth0, Clerk, homegrown —
is an institutional decision, not a library one).

## Running tests

```bash
cd backend && npm test          # ledger hash-chain tests
cd ml-service && pytest tests/ -v  # autoencoder anomaly detection tests
cd frontend && npm run lint && npm run build
```
