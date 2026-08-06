const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

export interface SessionRow {
  sessionId: string;
  studentEmail: string;
  examTitle: string;
  status: "PENDING" | "ACTIVE" | "SUBMITTED" | "FLAGGED" | "CLOSED";
  startedAt: string | null;
  submittedAt: string | null;
  eventCount: number;
  ledgerBlockCount: number;
  anomalyCount: number;
  totalFocusLoss: number;
}

export interface TimelineEntry {
  id: string;
  kind: string;
  createdAt: string;
  anomalyScore: number | null;
  isAnomaly: boolean;
  ledgerHash: string | null;
  sequence: number | null;
}

export interface VerificationResult {
  valid: boolean;
  sessionId: string;
  blockCount: number;
  brokenAtSequence: number | null;
  reason: string | null;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export async function fetchSessions(token: string): Promise<SessionRow[]> {
  const res = await fetch(`${API_BASE_URL}/api/dashboard/sessions`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`Failed to fetch sessions: ${res.status}`);
  const data = await res.json();
  return data.sessions;
}

export async function fetchTimeline(token: string, sessionId: string): Promise<TimelineEntry[]> {
  const res = await fetch(`${API_BASE_URL}/api/dashboard/sessions/${sessionId}/timeline`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`Failed to fetch timeline: ${res.status}`);
  const data = await res.json();
  return data.timeline;
}

export async function verifySessionChain(token: string, sessionId: string): Promise<VerificationResult> {
  const res = await fetch(`${API_BASE_URL}/api/session/${sessionId}/verify`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`Failed to verify chain: ${res.status}`);
  return res.json();
}
