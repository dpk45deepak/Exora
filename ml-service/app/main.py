import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .model import ModelRegistry, features_to_vector, MIN_BASELINE_SAMPLES
from .schemas import BehaviorFeatures, AnomalyResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("integrity-auditor-ml")

app = FastAPI(
    title="Behavioral Integrity ML Service",
    description="Autoencoder-based keystroke biometric anomaly detection.",
    version="1.0.0",
)

# Locked down to the Node gateway only in production via env-driven origin
# list — this service should never be reachable directly from the browser.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4000"],
    allow_methods=["POST"],
    allow_headers=["*"],
)

registry = ModelRegistry()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/analyze-behavior", response_model=AnomalyResponse)
def analyze_behavior(features: BehaviorFeatures) -> AnomalyResponse:
    if features.keystrokeCount == 0:
        # No keystroke data in this window (e.g. a pure focus-loss batch) —
        # nothing to score against the typing-rhythm model.
        return AnomalyResponse(
            anomaly_score=None,
            is_anomaly=False,
            threshold=None,
            baseline_ready=False,
            samples_collected=0,
            message="No keystroke data in this batch; skipped scoring.",
        )

    session_model = registry.get_or_create(features.sessionId)

    try:
        vector = features_to_vector(features.model_dump())
    except (KeyError, ValueError) as exc:
        logger.exception("Failed to vectorize features for session %s", features.sessionId)
        raise HTTPException(status_code=422, detail=f"Malformed feature vector: {exc}") from exc

    if not session_model.is_trained:
        session_model.add_sample(vector)

        if session_model.ready_to_train():
            logger.info(
                "Training baseline autoencoder for session %s on %d samples",
                features.sessionId, len(session_model.samples),
            )
            session_model.train_baseline()
        else:
            return AnomalyResponse(
                anomaly_score=None,
                is_anomaly=False,
                threshold=None,
                baseline_ready=False,
                samples_collected=len(session_model.samples),
                message=(
                    f"Collecting baseline ({len(session_model.samples)}/"
                    f"{MIN_BASELINE_SAMPLES} samples) — no score yet."
                ),
            )

    mse, is_anomaly = session_model.score(vector)

    if is_anomaly:
        logger.warning(
            "Anomaly flagged for session %s: score=%.5f threshold=%.5f",
            features.sessionId, mse, session_model.threshold,
        )

    return AnomalyResponse(
        anomaly_score=mse,
        is_anomaly=is_anomaly,
        threshold=session_model.threshold,
        baseline_ready=True,
        samples_collected=len(session_model.samples),
        message="Scored against trained baseline." if not is_anomaly else "Reconstruction loss exceeds baseline threshold.",
    )


@app.post("/admin/evict-stale")
def evict_stale():
    """Housekeeping endpoint — removes in-memory models for sessions idle
    beyond the retention window, so the service doesn't leak memory across
    a long-running deployment. Wire to a periodic job in production."""
    evicted = registry.evict_stale()
    return {"evicted": evicted}
