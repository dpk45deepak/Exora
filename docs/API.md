# API Reference

Base URL (local): `http://localhost:4000`
All endpoints except `/health` require `Authorization: Bearer <JWT>`.

## Auth

Endpoints expect a JWT with `{ id: string, role: "STUDENT" | "INSTRUCTOR" | "ADMIN" }`
in the payload, signed with `JWT_SECRET`. This reference implementation does
not include a login/registration endpoint — plug in your institution's SSO
or auth provider and mint tokens with that shape. See
[DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md#auth).

---

## `GET /health`

No auth required. Liveness check.

**Response `200`**
```json
{ "status": "ok" }
```

---

## `POST /api/session`

Role: `STUDENT`. Starts a new exam session. Writes a `SESSION_START` ledger block.

**Request**
```json
{ "examTitle": "CS 401 Midterm" }
```

**Response `201`**
```json
{
  "session": {
    "id": "uuid",
    "studentId": "uuid",
    "examTitle": "CS 401 Midterm",
    "status": "ACTIVE",
    "startedAt": "2026-08-06T12:00:00.000Z"
  }
}
```

---

## `POST /api/session/:id/submit`

Role: `STUDENT` (own session only) or `INSTRUCTOR`. Marks a session
`SUBMITTED` and writes a `SESSION_END` ledger block.

**Response `200`** — `{ "session": { ...updated fields... } }`

---

## `GET /api/session/:id/verify`

Role: `INSTRUCTOR` or `ADMIN`. Re-walks the full cryptographic chain for a
session, re-deriving each block's hash from its stored event data.

**Response `200`**
```json
{
  "valid": true,
  "sessionId": "uuid",
  "blockCount": 42,
  "brokenAtSequence": null,
  "reason": null
}
```

If tampering is detected, `valid` is `false`, `brokenAtSequence` names the
first bad block, and `reason` explains whether it's a broken link
(`previousHash` mismatch) or a mutated event (recomputed hash mismatch).

---

## `POST /api/telemetry`

Role: `STUDENT` (own session only). Rate limited to 20 requests/minute/IP.
Ingests one batched telemetry window from the frontend Web Worker.

**Request**
```json
{
  "sessionId": "uuid",
  "windowStart": 1733500000000,
  "windowEnd": 1733500030000,
  "keystrokeCount": 214,
  "holdTime": { "mean": 108.2, "stddev": 14.1, "min": 62, "max": 190 },
  "flightTime": { "mean": 176.4, "stddev": 39.8, "min": 40, "max": 610 },
  "focusLossCount": 0,
  "pasteCount": 0,
  "copyCount": 1,
  "blurEvents": []
}
```

**Response `201`**
```json
{
  "eventId": "uuid",
  "ledger": { "sequence": 7, "hash": "a1b2c3…" },
  "anomaly": {
    "anomaly_score": 0.0182,
    "is_anomaly": false,
    "threshold": 0.486,
    "baseline_ready": true
  }
}
```

`anomaly` is `null` if the ML service was unreachable — the raw event and
ledger block are still written; evidence is never dropped even if scoring
fails.

---

## `GET /api/dashboard/sessions`

Role: `INSTRUCTOR` or `ADMIN`. Rollup list of every session for the table view.

**Response `200`**
```json
{
  "sessions": [
    {
      "sessionId": "uuid",
      "studentEmail": "student@school.edu",
      "examTitle": "CS 401 Midterm",
      "status": "FLAGGED",
      "startedAt": "2026-08-06T12:00:00.000Z",
      "submittedAt": null,
      "eventCount": 18,
      "ledgerBlockCount": 18,
      "anomalyCount": 2,
      "totalFocusLoss": 3
    }
  ]
}
```

---

## `GET /api/dashboard/sessions/:id/timeline`

Role: `INSTRUCTOR` or `ADMIN`. Full ordered event timeline for one session.

**Response `200`**
```json
{
  "timeline": [
    {
      "id": "uuid",
      "kind": "TELEMETRY_BATCH",
      "createdAt": "2026-08-06T12:00:30.000Z",
      "anomalyScore": 0.0182,
      "isAnomaly": false,
      "ledgerHash": "a1b2c3…",
      "sequence": 7
    }
  ]
}
```

---

## ML Service — internal only (`http://ml-service:8000`)

Not exposed publicly; called by the backend only. See
[ARCHITECTURE.md](ARCHITECTURE.md) for why.

### `POST /analyze-behavior`

**Request** — same feature shape as the telemetry batch's stat blocks:
```json
{
  "sessionId": "uuid",
  "keystrokeCount": 214,
  "holdTime": { "mean": 108.2, "stddev": 14.1, "min": 62, "max": 190 },
  "flightTime": { "mean": 176.4, "stddev": 39.8, "min": 40, "max": 610 },
  "focusLossCount": 0,
  "pasteCount": 0
}
```

**Response `200`**
```json
{
  "anomaly_score": 0.0182,
  "is_anomaly": false,
  "threshold": 0.486,
  "baseline_ready": true,
  "samples_collected": 15,
  "message": "Scored against trained baseline."
}
```

While the per-session baseline is still collecting samples (first ~15
batches, ≈7.5 minutes), `anomaly_score` and `threshold` are `null` and
`baseline_ready` is `false`.

### `GET /health`

Liveness check, `{ "status": "ok" }`.
