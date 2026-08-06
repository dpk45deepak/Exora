"""
Behavioral anomaly detection via a bottlenecked autoencoder.

Design: a single scikit-learn MLPRegressor trained to reconstruct its own
input (input -> 8 -> 4 -> 8 -> output) learns a compressed representation
of "normal" typing rhythm for one student. Once trained on baseline
batches, the reconstruction error (MSE between input and output) on new
batches is the anomaly score: rhythm the model has never seen reconstructs
poorly, which is exactly the signature of a different typist (dictation,
someone else typing, or automated text injection) taking over mid-exam.

This is intentionally per-student, not global — comparing one student's
typing speed against another's baseline would produce meaningless
false positives, since typing rhythm varies enormously between individuals.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field

import numpy as np
from sklearn.neural_network import MLPRegressor
from sklearn.preprocessing import StandardScaler

# Number of baseline batches to collect before training. At one batch per
# 30s window, 15 batches is ~7.5 minutes — slightly over the spec's "first
# 5 minutes" target, but empirically the smallest sample count that keeps
# the false-positive rate on the student's own normal typing near zero
# (see ml-service/tests/test_model.py). Fewer samples underfits the
# baseline's natural variance and flags the student against themselves.
MIN_BASELINE_SAMPLES = 15

# Safety multiplier applied over the WORST (max) reconstruction error seen
# among the student's own baseline samples. We deliberately anchor to max
# rather than mean+stddev: with only ~10 baseline samples, stddev can be
# near-zero even though the network hasn't fully converged to zero error on
# every point, which would make a mean+stddev threshold reject the
# student's own normal typing. Anchoring to "worst normal case, with margin"
# is more conservative and avoids that class of false positive.
THRESHOLD_SAFETY_MULTIPLIER = 2.5
# Absolute floor so a suspiciously "perfect" baseline (near-zero error on
# every training point) doesn't produce a threshold of ~0, which would flag
# almost any future batch.
MIN_THRESHOLD_FLOOR = 0.05

FEATURE_NAMES = [
    "hold_mean", "hold_stddev", "hold_min", "hold_max",
    "flight_mean", "flight_stddev", "flight_min", "flight_max",
]


def features_to_vector(features: dict) -> np.ndarray:
    hold = features["holdTime"]
    flight = features["flightTime"]
    return np.array([
        hold["mean"], hold["stddev"], hold["min"], hold["max"],
        flight["mean"], flight["stddev"], flight["min"], flight["max"],
    ], dtype=np.float64)


@dataclass
class SessionModel:
    """Holds the training-in-progress state and, once trained, the fitted
    autoencoder + scaler for a single exam session."""

    session_id: str
    samples: list = field(default_factory=list)
    scaler: StandardScaler | None = None
    model: MLPRegressor | None = None
    baseline_mse: float | None = None
    threshold: float | None = None
    is_trained: bool = False
    last_updated: float = field(default_factory=time.time)

    def add_sample(self, vector: np.ndarray) -> None:
        self.samples.append(vector)
        self.last_updated = time.time()

    def ready_to_train(self) -> bool:
        return not self.is_trained and len(self.samples) >= MIN_BASELINE_SAMPLES

    def train_baseline(self) -> None:
        X = np.vstack(self.samples)

        self.scaler = StandardScaler()
        X_scaled = self.scaler.fit_transform(X)

        self.model = MLPRegressor(
            hidden_layer_sizes=(8, 4, 8),
            activation="relu",
            solver="adam",
            alpha=1e-2,  # L2 regularization — deliberately mild-underfit rather
                         # than memorize the ~10 baseline points exactly, so
                         # reconstruction error on held-out *normal* variation
                         # stays comparable to the training error.
            max_iter=2000,
            random_state=42,
            early_stopping=False,
        )
        # Autoencoder: target == input.
        self.model.fit(X_scaled, X_scaled)

        reconstructed = self.model.predict(X_scaled)
        per_sample_mse = np.mean((X_scaled - reconstructed) ** 2, axis=1)
        self.baseline_mse = float(np.mean(per_sample_mse))
        worst_case = float(np.max(per_sample_mse))
        self.threshold = max(
            worst_case * THRESHOLD_SAFETY_MULTIPLIER,
            MIN_THRESHOLD_FLOOR,
        )
        self.is_trained = True

    def score(self, vector: np.ndarray) -> tuple[float, bool]:
        assert self.model is not None and self.scaler is not None and self.threshold is not None
        x_scaled = self.scaler.transform(vector.reshape(1, -1))
        reconstructed = self.model.predict(x_scaled)
        mse = float(np.mean((x_scaled - reconstructed) ** 2))
        is_anomaly = mse > self.threshold
        return mse, is_anomaly


class ModelRegistry:
    """In-memory registry of per-session models.

    NOTE: for horizontal scaling beyond a single ML service instance, this
    would need to move to a shared store (e.g. joblib-serialized models in
    S3/GCS keyed by session_id, loaded on demand) — flagged here rather than
    silently baked in as a scaling limitation of this reference implementation.
    """

    def __init__(self) -> None:
        self._sessions: dict[str, SessionModel] = {}

    def get_or_create(self, session_id: str) -> SessionModel:
        if session_id not in self._sessions:
            self._sessions[session_id] = SessionModel(session_id=session_id)
        return self._sessions[session_id]

    def evict_stale(self, max_age_seconds: int = 6 * 3600) -> int:
        now = time.time()
        stale = [sid for sid, m in self._sessions.items() if now - m.last_updated > max_age_seconds]
        for sid in stale:
            del self._sessions[sid]
        return len(stale)
