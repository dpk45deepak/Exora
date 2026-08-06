import { Router } from "express";
import { prisma } from "../db/prisma.js";
import { LedgerService } from "../ledger/ledgerService.js";
import { analyzeBehavior } from "../services/mlClient.js";
import { telemetryBatchSchema } from "../utils/schemas.js";
import { requireAuth } from "../middleware/auth.js";

export const telemetryRouter = Router();
const ledgerService = new LedgerService(prisma);

telemetryRouter.post("/", requireAuth, async (req, res) => {
  const parsed = telemetryBatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({ error: "Invalid telemetry payload", details: parsed.error.flatten() });
  }
  const batch = parsed.data;

  // A student may only submit telemetry for their own active session.
  const session = await prisma.examSession.findUnique({ where: { id: batch.sessionId } });
  if (!session) return res.status(404).json({ error: "Session not found" });
  if (req.user!.role === "STUDENT" && session.studentId !== req.user!.id) {
    return res.status(403).json({ error: "Cannot submit telemetry for another student's session" });
  }
  if (session.status !== "ACTIVE" && session.status !== "PENDING") {
    return res.status(409).json({ error: `Session is ${session.status}, not accepting telemetry` });
  }

  // 1. Ask the ML service for an anomaly assessment (non-blocking on failure).
  const anomaly = await analyzeBehavior({
    sessionId: batch.sessionId,
    keystrokeCount: batch.keystrokeCount,
    holdTime: batch.holdTime,
    flightTime: batch.flightTime,
    focusLossCount: batch.focusLossCount,
    pasteCount: batch.pasteCount,
  });

  // 2. Persist the raw event — evidence is written regardless of ML outcome.
  const event = await prisma.auditEvent.create({
    data: {
      sessionId: batch.sessionId,
      kind: "TELEMETRY_BATCH",
      payload: batch as object,
      anomalyScore: anomaly?.anomaly_score ?? null,
      isAnomaly: anomaly?.is_anomaly ?? false,
    },
  });

  // 3. Chain it into the cryptographic ledger.
  const { hash, sequence } = await ledgerService.appendBlock(event);

  // 4. Flag the session if anomaly or high paste count crosses threshold.
  if (anomaly?.is_anomaly || batch.pasteCount > 0) {
    await prisma.examSession.update({
      where: { id: batch.sessionId },
      data: { status: "FLAGGED" },
    });
  }

  return res.status(201).json({
    eventId: event.id,
    ledger: { sequence, hash },
    anomaly,
  });
});
