import time
import pytest
from backend.classifier.intent_model import RandomForestIntentClassifier


def test_random_forest_intent_classifier_prediction():
    classifier = RandomForestIntentClassifier()

    session_payload = {
        "events": [
            {
                "event_type": "FILE_CREATE",
                "timestamp": "2026-08-01T23:00:00Z",
                "metadata": {"extension": ".7z", "is_encrypted_archive": True, "file_size_bytes": 10485760},
            },
            {
                "event_type": "USB_INSERT",
                "timestamp": "2026-08-01T23:02:00Z",
                "metadata": {"vendor_id": "0x0781"},
            },
        ]
    }

    intent = classifier.predict_intent(session_payload)
    assert intent in classifier.INTENT_CLASSES
    assert intent != "Routine Workspace Activity"


def test_random_forest_intent_classifier_probabilities():
    classifier = RandomForestIntentClassifier()

    session_payload = {
        "events": [
            {
                "event_type": "FILE_CREATE",
                "timestamp": "2026-08-01T10:00:00Z",
                "metadata": {"extension": ".py", "file_size_bytes": 1024},
            }
        ]
    }

    probs = classifier.predict_proba(session_payload)
    assert len(probs) == len(classifier.INTENT_CLASSES)
    assert sum(probs.values()) == pytest.approx(1.0, abs=1e-2)
    assert "Routine Workspace Activity" in probs


def test_random_forest_intent_classifier_performance():
    classifier = RandomForestIntentClassifier()
    session_payload = {"events": []}

    start = time.perf_counter()
    for _ in range(100):
        classifier.predict_intent(session_payload)
    duration_ms = (time.perf_counter() - start) * 1000

    # 100 predictions should take under 500ms total (< 5ms each)
    assert duration_ms < 500.0
