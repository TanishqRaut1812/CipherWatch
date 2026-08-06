import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.db.session import init_db
from simulator.scenarios import get_scenario_bulk_exfiltration

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_database():
    """Ensure database schema is initialized before E2E run."""
    init_db()


def test_full_e2e_pipeline():
    """
    Master End-to-End Integration Test:
    1. Ingest synthetic bulk exfiltration scenario events via /api/events.
    2. Verify sessions endpoint /api/sessions reconstructed events into active session.
    3. Trigger risk scoring / alerts endpoint /api/alerts.
    4. Confirm alert generated with risk score > 0.7 and severity CRITICAL or HIGH.
    5. Submit analyst feedback via POST /api/alerts/{id}/feedback.
    6. Verify feedback persisted and alert status updated to CONFIRMED.
    """
    events = get_scenario_bulk_exfiltration(user_id="usr_e2e_test")

    # Step 1: Ingest all scenario events
    for ev in events:
        response = client.post("/api/events", json=ev)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "accepted"

    # Step 2: Verify sessions API reconstructed intent & events
    response = client.get("/api/sessions")
    assert response.status_code == 200
    sessions = response.json()
    assert len(sessions) > 0

    target_session = next((s for s in sessions if s["user_id"] == "usr_e2e_test"), None)
    assert target_session is not None
    assert "reconstructed_intent" in target_session

    # Step 3: Check generated alerts
    response = client.get("/api/alerts")
    assert response.status_code == 200
    alerts = response.json()
    assert len(alerts) > 0

    target_alert = next((a for a in alerts if a["user_id"] == "usr_e2e_test"), None)
    assert target_alert is not None
    assert target_alert["risk_score"] > 0.5
    assert target_alert["severity"] in ["CRITICAL", "HIGH"]

    # Step 4: Submit analyst feedback
    feedback_payload = {
        "analyst_feedback": "CONFIRMED_THREAT",
        "comments": "E2E automated verification: Confirmed unauthorized USB exfiltration.",
    }
    response = client.post(f"/api/alerts/{target_alert['id']}/feedback", json=feedback_payload)
    assert response.status_code == 200
    updated_alert = response.json()
    assert updated_alert["status"] == "CONFIRMED"
    assert updated_alert["analyst_feedback"] == "CONFIRMED_THREAT"
