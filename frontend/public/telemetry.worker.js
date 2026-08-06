/**
 * telemetry.worker.js
 *
 * Runs entirely off the main render thread. Receives raw, already-anonymized
 * timing events posted from the window (main thread listeners forward
 * events here — a Worker cannot attach DOM listeners itself), aggregates
 * keystroke biometric features, and flushes a batch every FLUSH_INTERVAL_MS.
 *
 * PRIVACY CONTRACT: this worker never receives and never emits the actual
 * character/key value. Only `keyCode` bucket ("letter" | "digit" | "space" |
 * "backspace" | "other") and high-resolution timestamps are processed, so a
 * captured payload can never be reconstructed into the text the student typed.
 */

const FLUSH_INTERVAL_MS = 30_000;

/** @type {{code: number, downAt: number}[]} */
let openKeyDowns = [];
let holdTimes = [];
let flightTimes = [];
let lastKeyUpAt = null;

let focusLossCount = 0;
let pasteCount = 0;
let copyCount = 0;
let windowBlurEvents = [];

let batchStartedAt = Date.now();
let sessionId = null;

function classifyKey(code) {
  if (code >= 65 && code <= 90) return "letter";
  if (code >= 48 && code <= 57) return "digit";
  if (code === 32) return "space";
  if (code === 8) return "backspace";
  return "other";
}

function resetBatch() {
  holdTimes = [];
  flightTimes = [];
  focusLossCount = 0;
  pasteCount = 0;
  copyCount = 0;
  windowBlurEvents = [];
  batchStartedAt = Date.now();
}

function mean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((a, b) => a + (b - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

function buildBatchPayload() {
  return {
    sessionId,
    windowStart: batchStartedAt,
    windowEnd: Date.now(),
    keystrokeCount: holdTimes.length,
    holdTime: {
      mean: mean(holdTimes),
      stddev: stddev(holdTimes),
      min: holdTimes.length ? Math.min(...holdTimes) : 0,
      max: holdTimes.length ? Math.max(...holdTimes) : 0,
    },
    flightTime: {
      mean: mean(flightTimes),
      stddev: stddev(flightTimes),
      min: flightTimes.length ? Math.min(...flightTimes) : 0,
      max: flightTimes.length ? Math.max(...flightTimes) : 0,
    },
    focusLossCount,
    pasteCount,
    copyCount,
    blurEvents: windowBlurEvents,
  };
}

function flush() {
  if (!sessionId) return;
  const payload = buildBatchPayload();
  // Only emit if there's something meaningful to report, to avoid noise.
  if (
    payload.keystrokeCount > 0 ||
    payload.focusLossCount > 0 ||
    payload.pasteCount > 0 ||
    payload.copyCount > 0
  ) {
    postMessage({ type: "TELEMETRY_BATCH", payload });
  }
  resetBatch();
}

setInterval(flush, FLUSH_INTERVAL_MS);

self.onmessage = (event) => {
  const { type, data } = event.data || {};

  switch (type) {
    case "INIT": {
      sessionId = data.sessionId;
      resetBatch();
      break;
    }

    case "KEYDOWN": {
      const bucket = classifyKey(data.code);
      openKeyDowns.push({ code: data.code, bucket, downAt: data.ts });
      break;
    }

    case "KEYUP": {
      const idx = openKeyDowns.findIndex((k) => k.code === data.code);
      if (idx !== -1) {
        const down = openKeyDowns[idx];
        const hold = data.ts - down.downAt;
        if (hold >= 0 && hold < 5000) holdTimes.push(hold);
        openKeyDowns.splice(idx, 1);

        if (lastKeyUpAt !== null) {
          const flight = down.downAt - lastKeyUpAt;
          if (flight >= 0 && flight < 10000) flightTimes.push(flight);
        }
        lastKeyUpAt = data.ts;
      }
      break;
    }

    case "BLUR": {
      focusLossCount += 1;
      windowBlurEvents.push({ ts: data.ts, kind: "blur" });
      break;
    }

    case "FOCUS": {
      windowBlurEvents.push({ ts: data.ts, kind: "focus" });
      break;
    }

    case "PASTE": {
      pasteCount += 1;
      postMessage({
        type: "HIGH_SEVERITY_FLAG",
        payload: { kind: "paste", ts: data.ts, sessionId },
      });
      break;
    }

    case "COPY": {
      copyCount += 1;
      break;
    }

    case "FLUSH_NOW": {
      flush();
      break;
    }

    default:
      break;
  }
};
