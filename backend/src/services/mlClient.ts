import fetch from "node-fetch";

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";
const ML_SERVICE_TIMEOUT_MS = 4000;

export interface BehaviorFeatures {
  sessionId: string;
  keystrokeCount: number;
  holdTime: { mean: number; stddev: number; min: number; max: number };
  flightTime: { mean: number; stddev: number; min: number; max: number };
  focusLossCount: number;
  pasteCount: number;
}

export interface AnomalyResult {
  anomaly_score: number;
  is_anomaly: boolean;
  threshold: number;
  baseline_ready: boolean;
}

export class MlServiceError extends Error {}

/**
 * Forwards a behavioral feature vector to the Python FastAPI autoencoder
 * service and returns its anomaly assessment. Fails closed but non-fatally:
 * if the ML service is unreachable, the caller should still persist the
 * raw event (evidence is never dropped) and simply flag anomaly_score as
 * null rather than blocking the exam session.
 */
export async function analyzeBehavior(features: BehaviorFeatures): Promise<AnomalyResult | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ML_SERVICE_TIMEOUT_MS);

  try {
    const res = await fetch(`${ML_SERVICE_URL}/analyze-behavior`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(features),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new MlServiceError(`ML service returned ${res.status}`);
    }

    return (await res.json()) as AnomalyResult;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[mlClient] analyze-behavior failed, degrading gracefully:", err);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
