import { Router } from "express";
import { prisma } from "../db/prisma.js";
import { LedgerService } from "../ledger/ledgerService.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { createSessionSchema } from "../utils/schemas.js";

export const sessionRouter = Router();
const ledgerService = new LedgerService(prisma);

/** Student starts a new exam session. */
sessionRouter.post("/", requireAuth, requireRole("STUDENT"), async (req, res) => {
  const parsed = createSessionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({ error: "Invalid request", details: parsed.error.flatten() });
  }

  const session = await prisma.examSession.create({
    data: {
      studentId: req.user!.id,
      examTitle: parsed.data.examTitle,
      status: "ACTIVE",
      startedAt: new Date(),
    },
  });

  const startEvent = await prisma.auditEvent.create({
    data: { sessionId: session.id, kind: "SESSION_START", payload: { examTitle: session.examTitle } },
  });
  await ledgerService.appendBlock(startEvent);

  return res.status(201).json({ session });
});

/** Student or instructor submits/ends a session. */
sessionRouter.post("/:id/submit", requireAuth, async (req, res) => {
  const session = await prisma.examSession.findUnique({ where: { id: req.params.id } });
  if (!session) return res.status(404).json({ error: "Session not found" });
  if (req.user!.role === "STUDENT" && session.studentId !== req.user!.id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const updated = await prisma.examSession.update({
    where: { id: session.id },
    data: { status: "SUBMITTED", submittedAt: new Date() },
  });

  const endEvent = await prisma.auditEvent.create({
    data: { sessionId: session.id, kind: "SESSION_END", payload: {} },
  });
  await ledgerService.appendBlock(endEvent);

  return res.json({ session: updated });
});

/** Instructor: verify the full cryptographic chain for a session. */
sessionRouter.get("/:id/verify", requireAuth, requireRole("INSTRUCTOR", "ADMIN"), async (req, res) => {
  const result = await ledgerService.verifyChain(req.params.id);
  return res.json(result);
});
