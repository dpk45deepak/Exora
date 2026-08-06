import { Router } from "express";
import { prisma } from "../db/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const dashboardRouter = Router();

/** List all sessions with rollup stats, for the instructor table view. */
dashboardRouter.get("/sessions", requireAuth, requireRole("INSTRUCTOR", "ADMIN"), async (_req, res) => {
  const sessions = await prisma.examSession.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      student: { select: { email: true } },
      _count: { select: { events: true, ledgerBlocks: true } },
    },
  });

  const rows = await Promise.all(
    sessions.map(async (s) => {
      const anomalyCount = await prisma.auditEvent.count({
        where: { sessionId: s.id, isAnomaly: true },
      });
      const focusLossEvents = await prisma.auditEvent.findMany({
        where: { sessionId: s.id, kind: "TELEMETRY_BATCH" },
        select: { payload: true, createdAt: true },
      });
      const totalFocusLoss = focusLossEvents.reduce((sum, e) => {
        const p = e.payload as { focusLossCount?: number };
        return sum + (p.focusLossCount ?? 0);
      }, 0);

      return {
        sessionId: s.id,
        studentEmail: s.student.email,
        examTitle: s.examTitle,
        status: s.status,
        startedAt: s.startedAt,
        submittedAt: s.submittedAt,
        eventCount: s._count.events,
        ledgerBlockCount: s._count.ledgerBlocks,
        anomalyCount,
        totalFocusLoss,
      };
    })
  );

  return res.json({ sessions: rows });
});

/** Timeline of flagged events for one session, for the drill-down view. */
dashboardRouter.get("/sessions/:id/timeline", requireAuth, requireRole("INSTRUCTOR", "ADMIN"), async (req, res) => {
  const events = await prisma.auditEvent.findMany({
    where: { sessionId: req.params.id },
    orderBy: { createdAt: "asc" },
    include: { ledgerBlock: true },
  });

  return res.json({
    timeline: events.map((e) => ({
      id: e.id,
      kind: e.kind,
      createdAt: e.createdAt,
      anomalyScore: e.anomalyScore,
      isAnomaly: e.isAnomaly,
      ledgerHash: e.ledgerBlock?.hash ?? null,
      sequence: e.ledgerBlock?.sequence ?? null,
    })),
  });
});
