#!/usr/bin/env python3
"""Verification script for DB insertion and querying of stop and snapshot process events."""

import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.db.session import engine, SessionLocal
from backend.db.models import Base, AgentModel, ProcessEventModel, OrganizationModel

def verify_process_stop_in_db():
    print("=" * 70)
    print("DATABASE VERIFICATION: PROCESS STOP & SNAPSHOT EVENTS")
    print("=" * 70)

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # Create test org & agent if not present
        org = db.query(OrganizationModel).first()
        if not org:
            org = OrganizationModel(
                name="Test Org",
                registration_key="test_reg_key",
                enrollment_key="test_enroll_key"
            )
            db.add(org)
            db.commit()
            db.refresh(org)

        agent = db.query(AgentModel).first()
        if not agent:
            agent = AgentModel(
                org_id=org.id,
                hostname="test-host",
                os_type="Linux",
                auth_token_hash="dummy_hash"
            )
            db.add(agent)
            db.commit()
            db.refresh(agent)

        # Insert test ProcessEventModel records (snapshot, start, stop)
        now = datetime.utcnow()
        snapshot_ev = ProcessEventModel(
            agent_id=agent.id,
            timestamp=now,
            event_type="snapshot",
            pid=1001,
            name="systemd",
            exe_path="/usr/lib/systemd/systemd",
            cmdline="/usr/lib/systemd/systemd --user"
        )
        start_ev = ProcessEventModel(
            agent_id=agent.id,
            timestamp=now,
            event_type="start",
            pid=9999,
            name="python3",
            exe_path="/usr/bin/python3",
            cmdline="python3 -c import time;time.sleep(30)"
        )
        stop_ev = ProcessEventModel(
            agent_id=agent.id,
            timestamp=now,
            event_type="stop",
            pid=9999,
            name="python3",
            exe_path="/usr/bin/python3",
            cmdline="python3 -c import time;time.sleep(30)"
        )

        db.add_all([snapshot_ev, start_ev, stop_ev])
        db.commit()

        print("\nQuerying DB: SELECT * FROM process_events WHERE event_type='stop' ORDER BY timestamp DESC LIMIT 5;")
        stop_rows = db.query(ProcessEventModel).filter(ProcessEventModel.event_type == "stop").order_by(ProcessEventModel.timestamp.desc()).limit(5).all()

        print("\n--- DB QUERY RESULTS ---")
        for row in stop_rows:
            print(f"  • ID: {row.id} | Agent: {row.agent_id} | EventType: {row.event_type} | PID: {row.pid} | Name: {row.name} | Exe: {row.exe_path} | Time: {row.timestamp}")

        print("\nQuerying DB: SELECT * FROM process_events WHERE event_type='snapshot' ORDER BY timestamp DESC LIMIT 5;")
        snapshot_rows = db.query(ProcessEventModel).filter(ProcessEventModel.event_type == "snapshot").order_by(ProcessEventModel.timestamp.desc()).limit(5).all()

        print("\n--- SNAPSHOT QUERY RESULTS ---")
        for row in snapshot_rows:
            print(f"  • ID: {row.id} | Agent: {row.agent_id} | EventType: {row.event_type} | PID: {row.pid} | Name: {row.name} | Exe: {row.exe_path} | Time: {row.timestamp}")

        if stop_rows and snapshot_rows:
            print("\n✅ DATABASE VERIFICATION PASSED: Process 'stop' and 'snapshot' records stored & retrieved cleanly!")
        else:
            print("\n❌ DATABASE VERIFICATION FAILED: Query returned 0 records.")

    finally:
        db.close()

if __name__ == "__main__":
    verify_process_stop_in_db()
