import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";

import { telemetryRouter } from "./routes/telemetry.js";
import { sessionRouter } from "./routes/session.js";
import { dashboardRouter } from "./routes/dashboard.js";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN?.split(",") ?? ["http://localhost:3000"],
    credentials: true,
  })
);
app.use(express.json({ limit: "256kb" })); // telemetry batches are tiny; cap to blunt payload floods
app.use(pinoHttp());

// Telemetry ingestion is the highest-frequency endpoint (one call per
// student every 30s, plus immediate high-severity flags) — rate limit it
// per-IP to blunt accidental client bugs or abuse without punishing normal use.
const telemetryLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/telemetry", telemetryLimiter, telemetryRouter);
app.use("/api/session", sessionRouter);
app.use("/api/dashboard", dashboardRouter);

// Central error handler — never leak stack traces to clients.
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  req.log?.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[integrity-auditor-backend] listening on :${PORT}`);
});
