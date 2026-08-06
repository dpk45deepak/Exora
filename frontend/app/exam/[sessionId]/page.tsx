"use client";

import { useState } from "react";
import { useTelemetry } from "@/hooks/useTelemetry";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

export default function ExamPage({ params }: { params: { sessionId: string } }) {
  const [answer, setAnswer] = useState("");
  const [authToken] = useState<string>(() =>
    typeof window !== "undefined" ? window.localStorage.getItem("examToken") || "" : ""
  );

  const { status, pendingHighSeverityFlags } = useTelemetry({
    sessionId: params.sessionId,
    apiBaseUrl: API_BASE_URL,
    authToken,
  });

  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-ink-100 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-ink-500">Session</span>
          <span className="text-sm font-mono text-ink-900">{params.sessionId}</span>
        </div>
        <SessionStatusPill status={status} flagCount={pendingHighSeverityFlags} />
      </header>

      <section className="flex-1 max-w-3xl mx-auto w-full px-6 py-12">
        <p className="text-xs uppercase tracking-wide text-ink-500 mb-2">Question 1 of 12</p>
        <h1 className="text-2xl font-semibold text-ink-900 mb-6">
          Explain the tradeoffs between optimistic and pessimistic locking in a
          distributed transaction system.
        </h1>

        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          rows={16}
          className="w-full resize-none rounded-lg border border-ink-100 bg-white p-4 text-ink-900
                     leading-relaxed shadow-sm focus:border-verify-500 focus:ring-1 focus:ring-verify-500"
          placeholder="Type your answer here…"
          spellCheck={false}
        />

        <div className="mt-6 flex items-center justify-between text-xs text-ink-500">
          <span>{answer.length} characters</span>
          <button
            type="button"
            className="rounded-md bg-ink-900 px-4 py-2 text-sm font-medium text-white
                       hover:bg-ink-800 transition-colors"
          >
            Save &amp; continue
          </button>
        </div>
      </section>
    </main>
  );
}

function SessionStatusPill({
  status,
  flagCount,
}: {
  status: "idle" | "active" | "error";
  flagCount: number;
}) {
  const config = {
    idle: { label: "Connecting…", dot: "bg-ink-300" },
    active: { label: "Session monitored", dot: "bg-verify-500" },
    error: { label: "Reconnecting…", dot: "bg-flag-600" },
  }[status];

  return (
    <div className="flex items-center gap-3">
      {flagCount > 0 && (
        <span className="text-xs font-mono text-flag-600 bg-flag-100 rounded px-2 py-1">
          {flagCount} flagged event{flagCount > 1 ? "s" : ""}
        </span>
      )}
      <div className="flex items-center gap-1.5 text-xs text-ink-500">
        <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
        {config.label}
      </div>
    </div>
  );
}
