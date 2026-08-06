from datetime import datetime
from uuid import uuid4
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.db.base import Base
from backend.db.models import AnomalyScoreModel, EventModel, IncidentModel, SessionModel


def test_sqlite_tables_creation_and_relationships():
    """Verify in-memory SQLite table creation and SQLAlchemy model relationships."""
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(bind=engine)
    db = TestingSession()

    # 1. Create a SessionModel
    session_obj = SessionModel(
        session_uuid=str(uuid4()),
        user_id="user-test-01",
        start_time=datetime.utcnow(),
        end_time=datetime.utcnow(),
        event_count=2,
        reconstructed_intent="Potential USB Exfiltration",
        risk_score=85.5,
        status="flagged",
    )
    db.add(session_obj)
    db.commit()
    db.refresh(session_obj)

    # 2. Add an EventModel associated with the session
    event_obj = EventModel(
        event_id=str(uuid4()),
        user_id="user-test-01",
        device_id="dev-01",
        event_type="usb",
        event_metadata={"action": "connected", "device_name": "UltraDrive"},
        session_id=session_obj.id,
    )
    db.add(event_obj)

    # 3. Add AnomalyScoreModel
    anomaly_obj = AnomalyScoreModel(
        session_id=session_obj.id,
        isolation_forest_score=0.8,
        rule_bonus_score=25.0,
        z_score_deviation=3.2,
        graph_pattern_score=15.0,
        final_score=85.5,
        breakdown_json={"usb_burst": True, "off_hours": False},
    )
    db.add(anomaly_obj)

    # 4. Add IncidentModel
    incident_obj = IncidentModel(
        session_id=session_obj.id,
        title="High Severity USB Data Exfiltration",
        severity="HIGH",
        llm_explanation="User copied sensitive archives to a newly attached USB device.",
    )
    db.add(incident_obj)

    db.commit()

    # 5. Query and Assert Relationships
    queried_session = db.query(SessionModel).filter_by(id=session_obj.id).first()
    assert queried_session is not None
    assert queried_session.user_id == "user-test-01"
    assert len(queried_session.events) == 1
    assert queried_session.events[0].event_type == "usb"
    assert queried_session.anomaly_score.final_score == 85.5
    assert queried_session.incident.severity == "HIGH"

    db.close()
