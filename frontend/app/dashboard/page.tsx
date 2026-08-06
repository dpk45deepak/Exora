"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { fetchSessions, type SessionRow } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";

const POLL_INTERVAL_MS = 10_000;

export default function DashboardPage() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token] = useState<string>(() =>
    typeof window !== "undefined" ? window.localStorage.getItem("instructorToken") || "" : ""
  );

  const load = useCallback(async () => {
    try {
      const data = await fetchSessions(token);
      setSessions(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sessions");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  const flaggedCount = sessions.filter((s) => s.status === "FLAGGED").length;
  const activeCount = sessions.filter((s) => s.status === "ACTIVE").length;

  return (
    <main className="min-h-screen px-8 py-10 max-w-6xl mx-auto">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-500 mb-1">Instructor console</p>
          <h1 className="text-2xl font-semibold text-ink-900">Exam Integrity Dashboard</h1>
        </div>
        <div className="flex gap-6 text-sm">
          <Stat label="Active" value={activeCount} tone="verify" />
          <Stat label="Flagged" value={flaggedCount} tone="flag" />
          <Stat label="Total sessions" value={sessions.length} tone="ink" />
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-md border border-flag-600 bg-flag-100 px-4 py-3 text-sm text-flag-600">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-ink-100 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
            <tr>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Exam</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Anomalies</th>
              <th className="px-4 py-3 text-right">Focus losses</th>
              <th className="px-4 py-3 text-right">Ledger blocks</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-100">
            {!loading && sessions.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-ink-500">
                  No exam sessions yet.
                </td>
              </tr>
            )}
            {sessions.map((s) => (
              <tr key={s.sessionId} className="hover:bg-ink-50/60">
                <td className="px-4 py-3 font-medium text-ink-900">{s.studentEmail}</td>
                <td className="px-4 py-3 text-ink-700">{s.examTitle}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={s.status} />
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {s.anomalyCount > 0 ? (
                    <span className="text-flag-600">{s.anomalyCount}</span>
                  ) : (
                    <span className="text-ink-300">0</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono text-ink-700">{s.totalFocusLoss}</td>
                <td className="px-4 py-3 text-right font-mono text-ink-700">{s.ledgerBlockCount}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/dashboard/${s.sessionId}`} className="text-verify-600 hover:underline">
                    View session →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "verify" | "flag" | "ink" }) {
  const toneClass = { verify: "text-verify-600", flag: "text-flag-600", ink: "text-ink-900" }[tone];
  return (
    <div className="text-right">
      <p className={`text-2xl font-semibold ${toneClass}`}>{value}</p>
      <p className="text-xs text-ink-500">{label}</p>
    </div>
  );
}
