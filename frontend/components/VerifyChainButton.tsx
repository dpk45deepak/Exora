"use client";

import { useState } from "react";
import { verifySessionChain, type VerificationResult } from "@/lib/api";

export function VerifyChainButton({ sessionId, token }: { sessionId: string; token: string }) {
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    setChecking(true);
    setError(null);
    try {
      const res = await verifySessionChain(token, sessionId);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleVerify}
        disabled={checking}
        className="self-start rounded-md border border-ink-700 bg-ink-900 px-4 py-2 text-sm font-medium
                   text-white hover:bg-ink-800 disabled:opacity-50 transition-colors"
      >
        {checking ? "Verifying chain…" : "Verify cryptographic integrity"}
      </button>

      {error && <p className="text-sm text-flag-600">{error}</p>}

      {result && (
        <div
          className={`rounded-lg border p-4 text-sm font-mono ${
            result.valid ? "border-verify-500 bg-verify-100 text-verify-600" : "border-flag-600 bg-flag-100 text-flag-600"
          }`}
        >
          <p className="font-semibold">
            {result.valid ? "✓ Chain verified — no tampering detected" : "✗ Chain verification FAILED"}
          </p>
          <p className="mt-1 text-xs opacity-80">
            {result.blockCount} block{result.blockCount === 1 ? "" : "s"} checked
          </p>
          {!result.valid && result.reason && <p className="mt-2 text-xs">{result.reason}</p>}
        </div>
      )}
    </div>
  );
}
