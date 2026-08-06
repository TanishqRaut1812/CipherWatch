import pytest
from backend.analytics.risk_engine import CompositeRiskEngine


def test_low_risk_composite_score():
    """Verify low risk event produces score below threshold."""
    engine = CompositeRiskEngine()
    score = engine.calculate_composite_risk(
        event_type="filesystem",
        metadata={
            "is_encrypted_archive": False,
            "folder_category": "Standard",
        },
        timestamp_hour=14,  # Business hours
        ml_anomaly_score=0.10,
    )
    assert score < 0.30


def test_high_risk_composite_score():
    """Verify multi-factor high risk event produces score >= 0.70."""
    engine = CompositeRiskEngine()
    score = engine.calculate_composite_risk(
        event_type="usb",
        metadata={
            "is_encrypted_archive": True,
            "folder_category": "Executive",
            "destination_category": "PersonalCloud",
            "action": "mount",
        },
        timestamp_hour=2,  # Off hours (2 AM)
        ml_anomaly_score=0.85,
        current_metric_value=500.0,
        historical_metric_values=[10.0, 15.0, 12.0, 14.0],
    )
    assert score >= 0.70


def test_composite_score_bounded():
    """Verify composite risk score is strictly bounded in [0.0, 1.0]."""
    engine = CompositeRiskEngine()
    max_score = engine.calculate_composite_risk(
        event_type="usb",
        metadata={
            "is_encrypted_archive": True,
            "folder_category": "Executive",
        },
        timestamp_hour=1,
        ml_anomaly_score=1.5,
    )
    assert max_score <= 1.0

    min_score = engine.calculate_composite_risk(
        event_type="filesystem",
        metadata={},
        timestamp_hour=12,
        ml_anomaly_score=-0.5,
    )
    assert min_score >= 0.0
