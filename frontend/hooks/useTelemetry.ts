"use client";

import { useEffect, useRef, useCallback, useState } from "react";

export type TelemetryStatus = "idle" | "active" | "error";

interface UseTelemetryOptions {
  sessionId: string;
  apiBaseUrl: string;
  authToken: string;
}

/**
 * Owns the telemetry Web Worker for the lifetime of the exam session.
 *
 * Responsibilities:
 *  - spins up /telemetry.worker.js and sends it an INIT message
 *  - attaches lightweight passthrough listeners on window/document that do
 *    nothing but forward a timestamp + non-identifying key bucket to the
 *    worker (all actual aggregation happens off-thread)
 *  - receives batched payloads from the worker and POSTs them to the
 *    Node.js gateway with retry-on-failure
 */
export function useTelemetry({ sessionId, apiBaseUrl, authToken }: UseTelemetryOptions) {
  const workerRef = useRef<Worker | null>(null);
  const [status, setStatus] = useState<TelemetryStatus>("idle");
  const [lastFlushAt, setLastFlushAt] = useState<number | null>(null);
  const [pendingHighSeverityFlags, setPendingHighSeverityFlags] = useState<number>(0);
  const retryQueueRef = useRef<unknown[]>([]);

  const sendBatch = useCallback(
    async (payload: unknown, attempt = 0): Promise<void> => {
      try {
        const res = await fetch(`${apiBaseUrl}/api/telemetry`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(payload),
          keepalive: true,
        });
        if (!res.ok) throw new Error(`Telemetry POST failed: ${res.status}`);
        setLastFlushAt(Date.now());
      } catch (err) {
        if (attempt < 3) {
          const backoffMs = 1000 * 2 ** attempt;
          setTimeout(() => sendBatch(payload, attempt + 1), backoffMs);
        } else {
          retryQueueRef.current.push(payload);
          setStatus("error");
        }
      }
    },
    [apiBaseUrl, authToken]
  );

  useEffect(() => {
    if (!sessionId) return;

    const worker = new Worker("/telemetry.worker.js");
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent) => {
      const { type, payload } = event.data || {};
      if (type === "TELEMETRY_BATCH") {
        sendBatch(payload);
      } else if (type === "HIGH_SEVERITY_FLAG") {
        setPendingHighSeverityFlags((n) => n + 1);
        // High severity events (e.g. paste) get flushed immediately rather
        // than waiting for the 30s window, so instructors see them live.
        sendBatch({ ...payload, immediate: true });
      }
    };

    worker.postMessage({ type: "INIT", data: { sessionId } });
    setStatus("active");

    const onKeyDown = (e: KeyboardEvent) =>
      worker.postMessage({ type: "KEYDOWN", data: { code: e.keyCode, ts: performance.now() } });
    const onKeyUp = (e: KeyboardEvent) =>
      worker.postMessage({ type: "KEYUP", data: { code: e.keyCode, ts: performance.now() } });
    const onBlur = () => worker.postMessage({ type: "BLUR", data: { ts: performance.now() } });
    const onFocus = () => worker.postMessage({ type: "FOCUS", data: { ts: performance.now() } });
    const onPaste = () => worker.postMessage({ type: "PASTE", data: { ts: performance.now() } });
    const onCopy = () => worker.postMessage({ type: "COPY", data: { ts: performance.now() } });

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    window.addEventListener("paste", onPaste);
    window.addEventListener("copy", onCopy);

    const flushOnUnload = () => worker.postMessage({ type: "FLUSH_NOW" });
    window.addEventListener("beforeunload", flushOnUnload);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("copy", onCopy);
      window.removeEventListener("beforeunload", flushOnUnload);
      worker.postMessage({ type: "FLUSH_NOW" });
      worker.terminate();
      workerRef.current = null;
    };
  }, [sessionId, sendBatch]);

  return { status, lastFlushAt, pendingHighSeverityFlags };
}
