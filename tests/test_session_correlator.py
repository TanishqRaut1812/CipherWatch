from datetime import datetime, timedelta, timezone
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.analytics.session_correlator import SessionCorrelator
from backend.db.base import Base
from backend.db.models import EventModel, SessionModel

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)


def test_session_correlation_idle_window():
    """Verify events within idle threshold group into same session; events past threshold create new session."""
    db = TestingSessionLocal()
    correlator = SessionCorrelator(idle_threshold_minutes=15)
    base_time = datetime(2026, 7, 31, 12, 0, 0)

    # Event 1: Start
    e1 = EventModel(
        user_id="u1",
        device_id="d1",
        event_type="filesystem",
        timestamp=base_time,
        metadata_payload={"action": "created"},
    )
    db.add(e1)
    db.commit()

    s1 = correlator.correlate_event(db, e1)
    assert s1.event_count == 1
    assert s1.is_closed is False

    # Event 2: 5 mins later (within threshold)
    e2 = EventModel(
        user_id="u1",
        device_id="d1",
        event_type="usb",
        timestamp=base_time + timedelta(minutes=5),
        metadata_payload={"action": "connected"},
    )
    db.add(e2)
    db.commit()

    s2 = correlator.correlate_event(db, e2)
    assert s2.id == s1.id
    assert s2.event_count == 2

    # Event 3: 30 mins later (exceeds 15 min threshold)
    e3 = EventModel(
        user_id="u1",
        device_id="d1",
        event_type="network",
        timestamp=base_time + timedelta(minutes=35),
        metadata_payload={"destination_host": "example.com"},
    )
    db.add(e3)
    db.commit()

    s3 = correlator.correlate_event(db, e3)
    assert s3.id != s1.id
    assert s3.event_count == 1

    # Verify first session is marked closed
    db.refresh(s1)
    assert s1.is_closed is True
