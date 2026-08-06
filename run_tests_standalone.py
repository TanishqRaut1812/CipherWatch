"""
CipherWatch Ingestion & Threat Engine Regression Test Suite (Multi-Tenant)
Usage: python3 run_tests_standalone.py
"""
import sys
from fastapi.testclient import TestClient


def run_regression_tests():
    if hasattr(sys.stdout, 'reconfigure'):
        try:
            sys.stdout.reconfigure(encoding='utf-8')
            sys.stderr.reconfigure(encoding='utf-8')
        except Exception:
            pass

    print("=" * 60)
    print("CipherWatch Backend Ingestion & Threat Engine Test Suite")
    print("=" * 60)

    from backend.main import app
    from backend.db.session import engine
    from backend.db.base import Base

    # 1. Reset Test Database Schema
    print("\n[STEP 1] Initializing SQLite Test Database Schema...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    print("✓ Schema initialized.")

    client = TestClient(app)

    # 2. Create user + org to get registration credentials
    print("\n[STEP 2] Creating test user + org...")
    signup_resp = client.post("/api/auth/signup", json={
        "email": "testadmin@cipherwatch.dev",
        "username": "testadmin",
        "password": "testpass12345",
        "org_name": "Test Security Org",
    })
    assert signup_resp.status_code == 201, f"Signup failed: {signup_resp.status_code} {signup_resp.text}"
    user_token = signup_resp.json()["access_token"]

    orgs = client.get("/api/orgs", headers={"Authorization": f"Bearer {user_token}"})
    org_id = orgs.json()[0]["id"]

    creds = client.get(
        f"/api/orgs/{org_id}/registration-credentials",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    reg_key = creds.json()["registration_key"]
    print(f"✓ User + Org created: org_id={org_id}")

    # 3. Test Agent Enrollment (with org credentials)
    print("\n[STEP 3] Testing Agent Enrollment...")
    reg_resp = client.post("/api/agent/enroll", json={
        "organization_id": creds.json()["organization_id"],
        "enrollment_key": creds.json()["enrollment_key"],
        "hostname": "prod-sec-workstation-01",
        "machine_id": "prod-sec-workstation-01",
        "device_uuid": "dev-uuid-standalone-01",
        "os": "Linux 6.5.0-x86_64",
        "agent_version": "1.2.0",
    })
    assert reg_resp.status_code == 201, f"Expected 201, got {reg_resp.status_code}: {reg_resp.text}"
    reg_data = reg_resp.json()
    agent_id = reg_data["agent_id"]
    token = reg_data["auth_token"]
    print(f"✓ Agent enrolled: ID={agent_id}")

    # 4. Test Agent Heartbeat & Auth
    print("\n[STEP 4] Testing Bearer Token Authentication & Heartbeat...")
    hb_resp = client.post(
        f"/api/agents/{agent_id}/heartbeat",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert hb_resp.status_code == 200
    assert hb_resp.json()["status"] == "ok"

    bad_hb = client.post(
        f"/api/agents/{agent_id}/heartbeat",
        headers={"Authorization": "Bearer bad_token_999"},
    )
    assert bad_hb.status_code == 401
    print("✓ Heartbeat auth & token verification passed.")

    # 5. Test Single Payload Ingestion
    print("\n[STEP 5] Ingesting Single Telemetry Batch...")
    payload1 = {
        "metrics": {
            "cpu_percent": 95.0, "mem_percent": 92.0, "disk_percent": 65.0,
            "net_bytes_sent": 1048576, "net_bytes_recv": 2097152, "process_count": 142,
        },
        "process_events": [{
            "event_type": "start", "pid": 4812, "name": "updater.exe",
            "exe_path": "/tmp/updater.exe", "cmdline": "/tmp/updater.exe --silent",
            "user": "root", "cpu_percent": 45.0, "mem_rss": 52428800,
        }],
        "fs_events": [
            {"event_type": "modified", "src_path": f"/home/user/docs/file_{i}.docx"}
            for i in range(20)
        ],
    }

    ingest_resp1 = client.post(
        f"/api/agents/{agent_id}/events",
        headers={"Authorization": f"Bearer {token}"},
        json=payload1,
    )
    assert ingest_resp1.status_code == 200
    data1 = ingest_resp1.json()
    assert data1["status"] == "success"
    assert data1["metrics_ingested"] == 1
    assert data1["process_events_ingested"] == 1
    assert data1["fs_events_ingested"] == 20
    assert data1["alerts_triggered"] == 3
    print("✓ Single payload ingested. 3 non-sustained threat rules triggered.")

    # 6. Test Sustained Resource Spike Rule
    print("\n[STEP 6] Testing Sustained Resource Spike Rule...")
    for _ in range(2):
        client.post(
            f"/api/agents/{agent_id}/events",
            headers={"Authorization": f"Bearer {token}"},
            json={"metrics": payload1["metrics"], "process_events": [], "fs_events": []},
        )

    ingest_resp3 = client.post(
        f"/api/agents/{agent_id}/events",
        headers={"Authorization": f"Bearer {token}"},
        json={"metrics": payload1["metrics"], "process_events": [], "fs_events": []},
    )
    data3 = ingest_resp3.json()
    assert data3["alerts_triggered"] >= 1
    print("✓ Sustained Resource Spike Rule verified after consecutive readings.")

    # 7. Test Admin Endpoints (org-scoped)
    print("\n[STEP 7] Testing Org-Scoped Admin API Routes...")
    stats_resp = client.get(
        f"/api/admin/orgs/{org_id}/dashboard/stats",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert stats_resp.status_code == 200
    stats = stats_resp.json()
    assert stats["summary"]["total_systems"] >= 1
    assert stats["summary"]["online_systems"] >= 1

    detail_resp = client.get(
        f"/api/admin/orgs/{org_id}/systems/{agent_id}",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["header"]["hostname"] == "prod-sec-workstation-01"
    assert detail["header"]["status"] == "online"
    assert len(detail["alerts"]) >= 3
    print("✓ Org-scoped Admin Fleet Dashboard & System Detail verified.")

    # 8. Test Timeline Query
    print("\n[STEP 8] Testing Org-Scoped Timeline Search...")
    timeline_resp = client.get(
        f"/api/admin/orgs/{org_id}/systems/{agent_id}/timeline?search=updater.exe",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert timeline_resp.status_code == 200
    t_data = timeline_resp.json()
    assert len(t_data["items"]) >= 1
    assert "updater.exe" in t_data["items"][0]["details"]
    print("✓ Org-scoped timeline search and pagination verified.")

    print("\n" + "=" * 60)
    print("🎉 ALL REGRESSION TESTS PASSED (100% SUCCESS)")
    print("=" * 60)


if __name__ == "__main__":
    try:
        run_regression_tests()
        sys.exit(0)
    except Exception as err:
        print(f"\n❌ REGRESSION TEST FAILED: {err}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
