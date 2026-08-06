import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.db.base import Base
from backend.db.session import get_db
from backend.main import app

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
Base.metadata.create_all(bind=engine)
client = TestClient(app)


def test_create_and_read_event_api():
    """Verify HTTP POST /api/events creates event and GET /api/events retrieves it."""
    payload = {
        "user_id": "test_user_01",
        "device_id": "test_dev_01",
        "event_type": "filesystem",
        "metadata": {
            "action": "created",
            "extension": ".zip",
            "file_size_bytes": 1024,
            "is_encrypted_archive": True,
            "folder_category": "Finance",
        },
    }

    # Test Creation
    response = client.post("/api/events", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["user_id"] == "test_user_01"
    assert data["event_type"] == "filesystem"
    assert data["metadata"]["folder_category"] == "Finance"
    assert "id" in data

    # Test Fetching
    get_resp = client.get("/api/events?user_id=test_user_01")
    assert get_resp.status_code == 200
    events = get_resp.json()
    assert len(events) >= 1
    assert events[0]["user_id"] == "test_user_01"


def test_high_risk_event_triggers_alert():
    """Verify ingesting a high-risk event calculates risk score and triggers an alert."""
    payload = {
        "user_id": "suspect_user_99",
        "device_id": "dev_exec_01",
        "event_type": "usb",
        "metadata": {
            "action": "mount",
            "is_encrypted_archive": True,
            "folder_category": "Executive",
            "destination_category": "PersonalCloud",
        },
    }
    response = client.post("/api/events", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "session_id" in data

    # Check alert feed endpoint
    alerts_resp = client.get("/api/alerts")
    assert alerts_resp.status_code == 200
    alerts = alerts_resp.json()
    assert len(alerts) >= 1
    suspect_alert = next((a for a in alerts if a["user_id"] == "suspect_user_99"), None)
    assert suspect_alert is not None
    assert suspect_alert["risk_score"] >= 0.50

