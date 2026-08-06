from fastapi.testclient import TestClient
import pytest
from backend.main import app
from backend.db.session import engine
from backend.db.base import Base

client = TestClient(app)

from backend.db.models import OrganizationModel, UserModel
from backend.db.session import TestingSessionLocal, engine, get_db

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    user = UserModel(id="u_seed", email="seed@test.com", username="seeduser", password_hash="h")
    db.add(user)
    org = OrganizationModel(
        id="org_seed",
        name="Seed Org",
        organization_id="org-seed-uuid",
        enrollment_key="cwek_seedkey1234567890123456789012345",
        owner_user_id=user.id,
    )
    db.add(org)
    db.commit()
    db.close()
    yield

def test_agent_registration_and_auth():
    # Enroll agent
    response = client.post(
        "/api/agent/enroll",
        json={
            "organization_id": "org-seed-uuid",
            "enrollment_key": "cwek_seedkey1234567890123456789012345",
            "hostname": "prod-sec-workstation-01",
            "device_uuid": "dev-uuid-001",
            "os": "Linux 6.5.0-x86_64",
            "agent_version": "1.2.0",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert "agent_id" in data
    assert "auth_token" in data
    agent_id = data["agent_id"]
    token = data["auth_token"]

    # Heartbeat with valid bearer token
    hb_resp = client.post(
        f"/api/agents/{agent_id}/heartbeat",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert hb_resp.status_code == 200
    assert hb_resp.json()["status"] == "ok"

    # Heartbeat with invalid bearer token -> 401
    bad_hb = client.post(
        f"/api/agents/{agent_id}/heartbeat",
        headers={"Authorization": "Bearer bad_token_123"},
    )
    assert bad_hb.status_code == 401


def test_agent_event_ingestion_and_threat_detection():
    # Enroll
    reg_resp = client.post(
        "/api/agent/enroll",
        json={
            "organization_id": "org-seed-uuid",
            "enrollment_key": "cwek_seedkey1234567890123456789012345",
            "hostname": "finance-node-03",
            "device_uuid": "dev-uuid-002",
            "os": "Windows 11 Enterprise",
            "agent_version": "1.2.0",
        },
    )
    data = reg_resp.json()
    agent_id = data["agent_id"]
    token = data["auth_token"]

    # Post batched events with suspicious process in /tmp and mass FS changes
    payload = {
        "metrics": {
            "cpu_percent": 94.5,
            "mem_percent": 88.2,
            "disk_percent": 65.0,
            "net_bytes_sent": 1048576,
            "net_bytes_recv": 2097152,
            "process_count": 142,
        },
        "process_events": [
            {
                "event_type": "start",
                "pid": 4812,
                "name": "updater.exe",
                "exe_path": "/tmp/updater.exe",
                "cmdline": "/tmp/updater.exe --silent",
                "user": "root",
                "cpu_percent": 45.0,
                "mem_rss": 52428800,
            }
        ],
        "fs_events": [
            {"event_type": "modified", "src_path": f"/home/user/docs/file_{i}.docx"}
            for i in range(20)
        ],
    }

    ingest_resp = client.post(
        f"/api/agents/{agent_id}/events",
        headers={"Authorization": f"Bearer {token}"},
        json=payload,
    )
    assert ingest_resp.status_code == 200
    ingest_data = ingest_resp.json()
    assert ingest_data["status"] == "success"
    assert ingest_data["metrics_ingested"] == 1
    assert ingest_data["process_events_ingested"] == 1
    assert ingest_data["fs_events_ingested"] == 20
    assert ingest_data["alerts_triggered"] > 0
