"use client";

import { useEffect, useState } from "react";
import { fetchTimeline, type TimelineEntry } from "@/lib/api";
import { VerifyChainButton } from "@/components/VerifyChainButton";

export default function SessionDetailPage({ params }: { params: { sessionId: string } }) {
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [token] = useState<string>(() =>
    typeof window !== "undefined" ? window.localStorage.getItem("instructorToken") || "" : ""
  );

  useEffect(() => {
    fetchTimeline(token, params.sessionId)
      .then(setTimeline)
      .finally(() => setLoading(false));
  }, [token, params.sessionId]);

  return (
    <main className="min-h-screen px-8 py-10 max-w-4xl mx-auto">
      <p className="text-xs uppercase tracking-wide text-ink-500 mb-1">Session detail</p>
      <h1 className="text-2xl font-semibold text-ink-900 mb-6 font-mono">{params.sessionId}</h1>

      <section className="mb-8">
        <VerifyChainButton sessionId={params.sessionId} token={token} />
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500 mb-3">
          Event timeline
        </h2>
        {loading && <p className="text-ink-500 text-sm">Loading…</p>}
        <ol className="space-y-2">
          {timeline.map((entry) => (
            <li
              key={entry.id}
              className={`rounded-lg border px-4 py-3 text-sm flex items-center justify-between ${
                entry.isAnomaly ? "border-flag-600 bg-flag-100" : "border-ink-100 bg-white"
              }`}
            >
              <div>
                <p className="font-medium text-ink-900">{entry.kind.replace(/_/g, " ")}</p>
                <p className="text-xs text-ink-500">{new Date(entry.createdAt).toLocaleString()}</p>
              </div>
              <div className="text-right">
                {entry.anomalyScore !== null && (
                  <p className={`font-mono text-xs ${entry.isAnomaly ? "text-flag-600" : "text-ink-500"}`}>
                    score {entry.anomalyScore.toFixed(4)}
                  </p>
                )}
                {entry.ledgerHash && (
                  <p className="font-mono text-[10px] text-ink-300" title={entry.ledgerHash}>
                    block #{entry.sequence} · {entry.ledgerHash.slice(0, 10)}…
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
