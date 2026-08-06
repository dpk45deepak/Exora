import sys
import os

import numpy as np
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.model import ModelRegistry, features_to_vector, MIN_BASELINE_SAMPLES  # noqa: E402


def make_features(hold_mean, flight_mean, rng, noise=1.0):
    return {
        "holdTime": {
            "mean": hold_mean + rng.standard_normal() * noise,
            "stddev": 15.0,
            "min": hold_mean - 20,
            "max": hold_mean + 30,
        },
        "flightTime": {
            "mean": flight_mean + rng.standard_normal() * noise,
            "stddev": 40.0,
            "min": flight_mean - 50,
            "max": flight_mean + 80,
        },
    }


@pytest.fixture
def trained_session_model():
    rng = np.random.default_rng(42)
    registry = ModelRegistry()
    session_model = registry.get_or_create("test-session")

    for _ in range(MIN_BASELINE_SAMPLES):
        vector = features_to_vector(make_features(110, 180, rng))
        session_model.add_sample(vector)
        if session_model.ready_to_train():
            session_model.train_baseline()

    assert session_model.is_trained
    return session_model, rng


def test_baseline_trains_after_minimum_samples():
    rng = np.random.default_rng(1)
    registry = ModelRegistry()
    m = registry.get_or_create("s1")

    for i in range(MIN_BASELINE_SAMPLES - 1):
        m.add_sample(features_to_vector(make_features(110, 180, rng)))
        assert not m.is_trained

    m.add_sample(features_to_vector(make_features(110, 180, rng)))
    assert m.ready_to_train()
    m.train_baseline()
    assert m.is_trained
    assert m.threshold is not None and m.threshold > 0


def test_normal_typing_rhythm_does_not_trigger_false_positive(trained_session_model):
    session_model, rng = trained_session_model

    false_positives = 0
    trials = 40
    for _ in range(trials):
        v = features_to_vector(make_features(110, 180, rng))
        _, is_anomaly = session_model.score(v)
        if is_anomaly:
            false_positives += 1

    # Allow a small tolerance rather than demanding zero, since this is a
    # statistical detector, but the false-positive rate must stay low.
    assert false_positives / trials < 0.1, (
        f"False positive rate too high: {false_positives}/{trials}"
    )


def test_drastically_different_rhythm_is_flagged_as_anomaly(trained_session_model):
    session_model, _ = trained_session_model

    # Simulates a different person (or automated injection) typing much
    # faster and with a completely different hold/flight signature.
    attack_vector = features_to_vector({
        "holdTime": {"mean": 40, "stddev": 3, "min": 30, "max": 45},
        "flightTime": {"mean": 900, "stddev": 300, "min": 400, "max": 1500},
    })

    mse, is_anomaly = session_model.score(attack_vector)
    assert is_anomaly is True
    assert mse > session_model.threshold


def test_scoring_before_training_raises():
    registry = ModelRegistry()
    m = registry.get_or_create("untrained-session")
    with pytest.raises(AssertionError):
        m.score(np.zeros(8))


def test_model_registry_evicts_stale_sessions():
    registry = ModelRegistry()
    registry.get_or_create("stale-session")
    evicted = registry.evict_stale(max_age_seconds=-1)  # everything is "stale"
    assert evicted == 1
