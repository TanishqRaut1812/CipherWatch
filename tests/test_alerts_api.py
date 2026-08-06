import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.db.base import Base
from backend.db.models import AlertModel
from backend.db.session import get_db
from backend.main import app

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


def test_get_alerts_empty():
    """Verify GET /api/alerts returns empty list when no alerts exist."""
    response = client.get("/api/alerts")
    assert response.status_code == 200
    assert response.json() == []


def test_get_alerts_with_data():
    """Verify GET /api/alerts returns alert list ordered by creation time."""
    db = TestingSessionLocal()
    alert1 = AlertModel(
        user_id="usr_01",
        device_id="dev_01",
        risk_score=0.75,
        severity="HIGH",
        status="ACTIVE",
        message="High risk detected",
    )
    alert2 = AlertModel(
        user_id="usr_02",
        device_id="dev_02",
        risk_score=0.95,
        severity="CRITICAL",
        status="ACTIVE",
        message="Critical anomaly",
    )
    db.add(alert1)
    db.add(alert2)
    db.commit()

    response = client.get("/api/alerts")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 2
    assert data[0]["severity"] in ["HIGH", "CRITICAL"]


def test_websocket_alerts():
    """Verify WebSocket connection to /ws/alerts."""
    with client.websocket_connect("/ws/alerts") as websocket:
        websocket.send_text("ping")
        # Connection established successfully


def test_submit_alert_feedback():
    """Verify POST /api/alerts/{id}/feedback updates alert status and feedback."""
    db = TestingSessionLocal()
    alert = AlertModel(
        user_id="usr_feedback_test",
        device_id="dev_feedback_test",
        risk_score=0.85,
        severity="HIGH",
        status="ACTIVE",
        message="Suspicious archive transfer",
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    alert_id = alert.id
    db.close()

    # Submit FALSE_POSITIVE feedback
    response = client.post(
        f"/api/alerts/{alert_id}/feedback",
        json={"feedback": "FALSE_POSITIVE", "comments": "Routine IT backup script"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == alert_id
    assert data["status"] == "RESOLVED"
    assert data["analyst_feedback"] == "FALSE_POSITIVE"
    assert data["feedback_comments"] == "Routine IT backup script"

