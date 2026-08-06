import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.db.base import Base
from backend.db.session import get_db
from backend.main import app
from backend.db.models import (
    AgentModel,
    AlertModel,
    EventModel,
    FSEventModel,
    OrganizationModel,
    ProcessEventModel,
    USBEventModel,
    UserModel,
    UserOrganizationModel,
)
from backend.auth_utils import generate_agent_token, hash_token
from agent.monitors.filesystem import FilesystemMetadataHandler
from watchdog.events import FileCreatedEvent

# Setup test DB in memory
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


def test_agent_enrollment_route_reconciliation():
    """Item #1: Verify /api/agent/enroll is canonical and /api/agents/register is removed."""
    db = TestingSessionLocal()
    
    user = UserModel(id="user_test_01", email="test@example.com", username="testuser", password_hash="hash")
    db.add(user)
    org = OrganizationModel(
        id="org_test_01",
        name="Test Security Corp",
        organization_id="org-uuid-12345",
        enrollment_key="cwek_testkey1234567890123456789012345",
        registration_key="cwrk_testkey1234567890123456789012345",
        owner_user_id=user.id,
    )
    db.add(org)
    db.commit()

    # 1. /api/agent/enroll succeeds
    enroll_payload = {
        "organization_id": org.organization_id,
        "enrollment_key": org.enrollment_key,
        "hostname": "test-host-01",
        "device_uuid": "dev-uuid-9999",
        "os": "Linux",
        "agent_version": "1.0.0",
    }
    resp = client.post("/api/agent/enroll", json=enroll_payload)
    assert resp.status_code == 201, f"Enrollment failed: {resp.text}"
    data = resp.json()
    assert "agent_id" in data
    assert "auth_token" in data
    
    agent_id = data["agent_id"]
    auth_token = data["auth_token"]

    # 2. Heartbeat via /api/agents/{id}/heartbeat
    headers = {"Authorization": f"Bearer {auth_token}"}
    hb_resp = client.post(f"/api/agents/{agent_id}/heartbeat", headers=headers)
    assert hb_resp.status_code == 200, f"Heartbeat failed: {hb_resp.text}"
    assert hb_resp.json()["status"] == "ok"

    # 3. /api/agents/register should return 404 (removed)
    reg_resp = client.post("/api/agents/register", json={"org_id": org.id, "registration_key": org.registration_key, "hostname": "h", "os": "L", "ip": "1"})
    assert reg_resp.status_code == 404

    db.close()


def test_usb_first_class_table_and_batched_ingestion():
    """Item #2: USB as first-class table (usb_events / USBEventModel)."""
    db = TestingSessionLocal()
    org = db.query(OrganizationModel).first()
    
    agent_id = f"agent_usb_{datetime.utcnow().timestamp()}"
    raw_token = generate_agent_token()
    agent = AgentModel(
        id=agent_id,
        org_id=org.id,
        hostname="usb-host",
        os="Linux",
        ip="127.0.0.1",
        agent_version="1.0.0",
        auth_token_hash=hash_token(raw_token),
    )
    db.add(agent)
    db.commit()

    headers = {"Authorization": f"Bearer {raw_token}"}

    batched_payload = {
        "metrics": {
            "cpu_percent": 10.0,
            "mem_percent": 30.0,
            "disk_percent": 40.0,
            "net_bytes_sent": 512,
            "net_bytes_recv": 1024,
            "process_count": 80,
        },
        "process_events": [
            {
                "timestamp": datetime.utcnow().isoformat(),
                "event_type": "start",
                "pid": 1024,
                "name": "python3",
                "exe_path": "/usr/bin/python3",
                "cmdline": "python3 main.py",
                "user": "koanoir",
                "cpu_percent": 1.0,
                "mem_rss": 20000000,
            }
        ],
        "fs_events": [],
        "usb_events": [
            {
                "timestamp": datetime.utcnow().isoformat(),
                "action": "connected",
                "vendor_id": "0781",
                "product_id": "5581",
                "device_name": "SanDisk Ultra USB 3.0",
                "mount_point": "/media/koanoir/SANDISK",
            }
        ],
        "raw_events": [],
    }

    ingest_resp = client.post(f"/api/agents/{agent_id}/events", json=batched_payload, headers=headers)
    assert ingest_resp.status_code == 200, f"Ingestion failed: {ingest_resp.text}"
    ingest_data = ingest_resp.json()
    
    assert ingest_data["status"] == "success"
    assert ingest_data["usb_events_ingested"] == 1
    assert ingest_data["alerts_triggered"] >= 1

    # Verify USBEventModel record in database
    usb_rec = db.query(USBEventModel).filter_by(agent_id=agent_id).first()
    assert usb_rec is not None
    assert usb_rec.device_name == "SanDisk Ultra USB 3.0"
    assert usb_rec.mount_point == "/media/koanoir/SANDISK"

    # Verify threat alert generated
    alert_rec = db.query(AlertModel).filter_by(agent_id=agent_id, rule_id="USB_REMOVABLE_STORAGE_MOUNT").first()
    assert alert_rec is not None
    assert "SanDisk Ultra USB 3.0" in alert_rec.message

    db.close()


def test_legacy_events_post_route_removed():
    """Item #2: Verify POST /api/events ingestion route is completely removed (returns 405)."""
    resp = client.post("/api/events", json={})
    assert resp.status_code == 405, f"Expected 405 Method Not Allowed, got {resp.status_code}"

    db.close()


def test_filesystem_permission_error_resilience(monkeypatch):
    """Item #4: Verify filesystem watcher catches PermissionError without crashing."""
    emitted = []
    def mock_emit(evt):
        emitted.append(evt)

    handler = FilesystemMetadataHandler(user_id="u1", device_id="d1", emit_callback=mock_emit)
    
    # Mock os.path.getsize to raise PermissionError
    def mock_getsize(path):
        raise PermissionError("Access denied to restricted subfolder file")

    monkeypatch.setattr("os.path.getsize", mock_getsize)
    monkeypatch.setattr("os.path.exists", lambda p: True)

    event = FileCreatedEvent("/home/koanoir/Downloads/restricted_dir/secret.pdf")
    # Should not raise exception
    handler.on_created(event)
    
    assert len(emitted) == 1
    assert emitted[0].metadata["file_size_bytes"] == 0
