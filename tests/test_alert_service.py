import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.analytics.alert_service import AlertService
from backend.db.base import Base
from backend.db.models import AlertModel, EventModel

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)


def test_alert_severity_classification():
    """Verify risk score to severity mapping."""
    service = AlertService(threshold=0.5)
    assert service.compute_severity(0.90) == "CRITICAL"
    assert service.compute_severity(0.75) == "HIGH"
    assert service.compute_severity(0.60) == "MEDIUM"
    assert service.compute_severity(0.30) == "LOW"


def test_alert_generation_trigger():
    """Verify alert generation when score exceeds threshold."""
    db = TestingSessionLocal()
    service = AlertService(threshold=0.5)

    event = EventModel(
        user_id="user_alert_test",
        device_id="dev_01",
        event_type="filesystem",
        metadata_payload={"file_size_bytes": 1000000},
    )
    db.add(event)
    db.commit()

    # Below threshold -> No alert
    no_alert = service.evaluate_event_alert(db, event, risk_score=0.4)
    assert no_alert is None

    # Above threshold -> Alert created
    alert = service.evaluate_event_alert(db, event, risk_score=0.8)
    assert alert is not None
    assert alert.severity == "HIGH"
    assert alert.user_id == "user_alert_test"
    assert alert.status == "ACTIVE"
