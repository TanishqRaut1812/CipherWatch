from fastapi.testclient import TestClient
import pytest
import secrets
from backend.main import app
from backend.db.session import engine
from backend.db.base import Base
from backend.db.models import OrganizationModel, AgentModel
from backend.auth_utils import hash_token

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield

def test_secure_agent_enrollment_and_ingestion():
    # 1. Create a user and organization
    signup_resp = client.post("/api/auth/signup", json={
        "email": "owner@corp.com",
        "username": "owner",
        "password": "ownerpassword123",
        "org_name": "SecureCorp",
    })
    assert signup_resp.status_code == 201
    user_data = signup_resp.json()
    user_token = user_data["access_token"]

    # 2. Get Organization details/credentials
    orgs_resp = client.get("/api/orgs", headers={"Authorization": f"Bearer {user_token}"})
    assert orgs_resp.status_code == 200
    org_id = orgs_resp.json()[0]["id"]

    creds_resp = client.get(
        f"/api/orgs/{org_id}/registration-credentials",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert creds_resp.status_code == 200
    creds = creds_resp.json()
    org_uuid = creds["organization_id"]
    enrollment_key = creds["enrollment_key"]

    assert org_uuid is not None
    assert enrollment_key.startswith("cwek_")

    # 3. Enroll agent using new secure handshake
    enroll_resp = client.post("/api/agent/enroll", json={
        "organization_id": org_uuid,
        "enrollment_key": enrollment_key,
        "device_uuid": "device-uuid-123",
        "hostname": "workstation-alpha",
        "os": "Linux",
        "agent_version": "1.0.0",
    })
    assert enroll_resp.status_code == 201
    enroll_data = enroll_resp.json()
    agent_id = enroll_data["agent_id"]
    agent_token = enroll_data["auth_token"]

    # 4. Heartbeat using the new endpoint with token
    hb_resp = client.post(
        "/api/heartbeat",
        headers={"Authorization": f"Bearer {agent_token}"},
    )
    assert hb_resp.status_code == 200
    assert hb_resp.json()["status"] == "ok"

    # 5. Heartbeat with invalid token should fail
    bad_hb = client.post(
        "/api/heartbeat",
        headers={"Authorization": "Bearer bad-token-abc"},
    )
    assert bad_hb.status_code == 401

    # 6. Ingest event using token
    event_payload = {
        "event_id": f"evt-{secrets.token_hex(8)}",
        "user_id": "test-user",
        "device_id": "device-uuid-123", # client-supplied
        "event_type": "process",
        "timestamp": "2026-08-04T12:00:00Z",
        "metadata": {"name": "curl", "exe_path": "/usr/bin/curl"},
    }
    event_resp = client.post(
        "/api/events",
        headers={"Authorization": f"Bearer {agent_token}"},
        json=event_payload,
    )
    assert event_resp.status_code == 201

    # 7. Rotate enrollment key
    rotate_resp = client.post(
        f"/api/orgs/{org_id}/rotate-enrollment-key",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert rotate_resp.status_code == 200
    new_creds = rotate_resp.json()
    new_enrollment_key = new_creds["enrollment_key"]
    assert new_enrollment_key != enrollment_key

    # Old enrollment key should now fail for new enrollment
    failed_enroll_resp = client.post("/api/agent/enroll", json={
        "organization_id": org_uuid,
        "enrollment_key": enrollment_key,
        "device_uuid": "device-uuid-456",
        "hostname": "workstation-beta",
        "os": "Linux",
        "agent_version": "1.0.0",
    })
    assert failed_enroll_resp.status_code == 401

    # New enrollment key should work
    success_enroll_resp = client.post("/api/agent/enroll", json={
        "organization_id": org_uuid,
        "enrollment_key": new_enrollment_key,
        "device_uuid": "device-uuid-456",
        "hostname": "workstation-beta",
        "os": "Linux",
        "agent_version": "1.0.0",
    })
    assert success_enroll_resp.status_code == 201

    # 8. Test Revocation
    # Owner revokes first agent
    revoke_resp = client.post(
        f"/api/agents/{agent_id}/revoke",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert revoke_resp.status_code == 200

    # Revoked agent's heartbeat should fail
    revoked_hb = client.post(
        "/api/heartbeat",
        headers={"Authorization": f"Bearer {agent_token}"},
    )
    assert revoked_hb.status_code == 401
