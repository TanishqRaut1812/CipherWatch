import pytest
from backend.analytics.isolation_forest import AnomalyDetector


def test_anomaly_detector_feature_extraction():
    """Verify feature vector extraction from event metadata."""
    detector = AnomalyDetector()
    meta = {
        "file_size_bytes": 1048576,
        "is_encrypted_archive": True,
        "folder_category": "Finance",
    }
    vec = detector.extract_features("filesystem", meta, timestamp_hour=2)
    assert vec[0] == 1048576.0  # Size
    assert vec[1] == 2.0        # Off-hours (2 AM)
    assert vec[2] == 1.0        # Encrypted
    assert vec[3] == 2.0        # Finance sensitivity tier


def test_anomaly_detector_scoring():
    """Verify normal vs anomalous event scoring."""
    detector = AnomalyDetector()

    # Normal daytime event
    normal_meta = {
        "file_size_bytes": 2048,
        "is_encrypted_archive": False,
        "folder_category": "Standard",
    }
    normal_score = detector.predict_anomaly_score("filesystem", normal_meta, timestamp_hour=14)

    # Highly anomalous off-hours large encrypted file event
    anomalous_meta = {
        "file_size_bytes": 50000000,
        "is_encrypted_archive": True,
        "folder_category": "Finance",
        "destination_category": "CloudStorage",
    }
    anomalous_score = detector.predict_anomaly_score("filesystem", anomalous_meta, timestamp_hour=3)

    assert 0.0 <= normal_score <= 1.0
    assert 0.0 <= anomalous_score <= 1.0
    assert anomalous_score > normal_score


def test_anomaly_detector_lowercase_folder_category():
    """Verify lowercase folder_category matches sensitivity tiers consistent with risk_engine.py."""
    detector = AnomalyDetector()
    from backend.analytics.risk_engine import CompositeRiskEngine
    risk_engine = CompositeRiskEngine()

    for folder_cat in ["finance", "Finance", "hr", "HR", "legal", "Legal"]:
        meta = {"folder_category": folder_cat}
        vec = detector.extract_features("filesystem", meta)
        assert vec[3] == 2.0
        assert risk_engine.evaluate_folder_sensitivity(folder_cat) == 0.25

    for folder_cat in ["sourcecode", "SourceCode", "confidential", "Confidential"]:
        meta = {"folder_category": folder_cat}
        vec = detector.extract_features("filesystem", meta)
        assert vec[3] == 1.0
        assert risk_engine.evaluate_folder_sensitivity(folder_cat) == 0.25

