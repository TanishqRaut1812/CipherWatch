from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.db.base import Base
from backend.db.models import AlertModel, EventModel, SessionModel
from backend.db.session import get_db
from backend.llm.incident_explainer import IncidentExplainer
from backend.llm.prompt_builder import build_incident_prompt
from backend.main import app

# In-memory SQLite DB for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=Base)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


def test_build_incident_prompt():
    session_payload = {
        "user_id": "test_user_99",
        "device_id": "dev_mac_01",
        "session_id": 42,
        "reconstructed_intent": "USB Exfiltration Staging",
        "risk_score": 0.88,
        "severity": "CRITICAL",
        "risk_breakdown": {
            "isolation_forest_score": 0.35,
            "rule_bonus_score": 0.40,
            "z_score_deviation": 0.13,
            "graph_pattern_score": 0.0,
        },
        "events": [
            {
                "timestamp": "2026-08-01T12:00:00",
                "event_type": "USB_INSERT",
                "metadata": {"vendor_id": "0x0781", "product_id": "0x5581"},
            },
            {
                "timestamp": "2026-08-01T12:02:00",
                "event_type": "FILE_CREATE",
                "metadata": {"extension": ".zip", "is_encrypted_archive": True, "file_size_bytes": 10485760},
            },
        ],
    }

    prompt = build_incident_prompt(session_payload)

    assert "test_user_99" in prompt
    assert "USB Exfiltration Staging" in prompt
    assert "0.88" in prompt
    assert "CRITICAL" in prompt
    assert "USB_INSERT" in prompt
    assert "FILE_CREATE" in prompt
    assert "vendor_id=0x0781" in prompt

    # Verify zero-content compliance
    assert "file_content" not in prompt.lower()
    assert "pixel_data" not in prompt.lower()


def test_incident_explainer_fallback():
    explainer = IncidentExplainer(api_key="")
    session_payload = {
        "user_id": "test_user_88",
        "device_id": "dev_win_02",
        "session_id": 10,
        "reconstructed_intent": "Mass Archive Staging",
        "risk_score": 0.75,
        "severity": "HIGH",
        "events": [
            {
                "event_type": "FILE_CREATE",
                "metadata": {"extension": ".7z", "is_encrypted_archive": True},
            }
        ],
    }

    explanation = explainer.generate_explanation(session_payload)

    assert "CipherWatch detected" in explanation
    assert "HIGH" in explanation
    assert "Mass Archive Staging" in explanation
    assert "Executive Overview" in explanation
    assert "Recommended SOC Actions" in explanation


def test_incident_explainer_with_mock_gemini_api():
    explainer = IncidentExplainer(api_key="mock_key_12345")

    mock_response = MagicMock()
    mock_response.text = "### Executive Overview\nMocked Gemini incident analysis report."

    with patch("google.genai.Client") as mock_genai_client_class:
        mock_client = MagicMock()
        mock_client.models.generate_content.return_value = mock_response
        mock_genai_client_class.return_value = mock_client

        session_payload = {
            "user_id": "test_user_77",
            "device_id": "dev_01",
            "session_id": 5,
            "reconstructed_intent": "Routine Workspace Activity",
            "risk_score": 0.20,
            "severity": "LOW",
            "events": [],
        }

        explanation = explainer.generate_explanation(session_payload)

        assert "Mocked Gemini incident analysis report." in explanation
        mock_client.models.generate_content.assert_called_once()


def test_alert_explanation_api_endpoint():
    db = TestingSessionLocal()
    session = SessionModel(
        session_uuid="sess_test_123",
        user_id="user_api_test",
        event_count=1,
        reconstructed_intent="Cloud Exfiltration Staging",
        risk_score=0.90,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    alert = AlertModel(
        session_id=session.id,
        user_id="user_api_test",
        device_id="dev_test",
        risk_score=0.90,
        severity="CRITICAL",
        status="ACTIVE",
        message="Critical anomaly detected",
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    db.close()

    response = client.get(f"/api/alerts/{alert.id}/explanation")

    assert response.status_code == 200
    data = response.json()
    assert data["alert_id"] == alert.id
    assert data["session_id"] == session.id
    assert data["severity"] == "CRITICAL"
    assert "explanation" in data
    assert "CipherWatch detected" in data["explanation"] or "Cloud Exfiltration Staging" in data["explanation"]
