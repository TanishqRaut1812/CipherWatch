import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from backend.main import app
from backend.db.session import init_db, TestingSessionLocal
from backend.db.models import OrganizationModel, UserModel

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_database():
    """Ensure database schema is initialized before E2E run."""
    init_db()
    db = TestingSessionLocal()
    user = UserModel(id="u_e2e", email="e2e@test.com", username="e2euser", password_hash="h")
    db.add(user)
    org = OrganizationModel(
        id="org_e2e",
        name="E2E Org",
        organization_id="org-e2e-uuid",
        enrollment_key="cwek_e2ekey1234567890123456789012345",
        owner_user_id=user.id,
    )
    db.add(org)
    db.commit()
    db.close()


def test_full_e2e_pipeline():
    """
    Master End-to-End Integration Test:
    1. Enroll agent via /api/agent/enroll.
    2. Ingest telemetry via batched endpoint /api/agents/{agent_id}/events.
    3. Verify alerts generated.
    4. Submit analyst feedback via POST /api/alerts/{id}/feedback.
    """
    # Step 1: Enroll Agent
    enroll_resp = client.post(
        "/api/agent/enroll",
        json={
            "organization_id": "org-e2e-uuid",
            "enrollment_key": "cwek_e2ekey1234567890123456789012345",
            "hostname": "e2e-host",
            "device_uuid": "dev-uuid-e2e",
            "os": "Linux",
            "agent_version": "1.0.0",
        },
    )
    assert enroll_resp.status_code == 201
    agent_data = enroll_resp.json()
    agent_id = agent_data["agent_id"]
    token = agent_data["auth_token"]

    # Step 2: Ingest Batched Telemetry Payload
    payload = {
        "metrics": {
            "cpu_percent": 95.0,
            "mem_percent": 90.0,
            "disk_percent": 70.0,
            "net_bytes_sent": 1048576,
            "net_bytes_recv": 2097152,
            "process_count": 120,
        },
        "process_events": [
            {
                "timestamp": datetime.utcnow().isoformat(),
                "event_type": "start",
                "pid": 9999,
                "name": "exfil.exe",
                "exe_path": "/tmp/exfil.exe",
                "cmdline": "/tmp/exfil.exe --all",
                "user": "usr_e2e_test",
                "cpu_percent": 80.0,
                "mem_rss": 100000000,
            }
        ],
        "fs_events": [
            {
                "timestamp": datetime.utcnow().isoformat(),
                "event_type": "created",
                "src_path": f"/home/usr_e2e_test/sensitive_{i}.docx",
                "is_directory": False,
            }
            for i in range(15)
        ],
        "usb_events": [
            {
                "timestamp": datetime.utcnow().isoformat(),
                "action": "connected",
                "vendor_id": "0951",
                "product_id": "1666",
                "device_name": "Kingston DataTraveler 3.0",
                "mount_point": "/media/usr_e2e_test/KINGSTON",
            }
        ],
    }

    ingest_resp = client.post(
        f"/api/agents/{agent_id}/events",
        headers={"Authorization": f"Bearer {token}"},
        json=payload,
    )
    assert ingest_resp.status_code == 200
    assert ingest_resp.json()["status"] == "success"
    assert ingest_resp.json()["alerts_triggered"] >= 1

    # Step 3: Check generated alerts
    alerts_resp = client.get("/api/alerts")
    assert alerts_resp.status_code == 200
    alerts = alerts_resp.json()
    assert len(alerts) > 0

    target_alert = alerts[0]

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
