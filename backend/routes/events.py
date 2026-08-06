from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session

from backend.db.models import EventModel, SessionModel, AnomalyScoreModel, UserModel, UserOrganizationModel, AgentModel
from backend.db.session import get_db
from backend.user_auth import get_current_user, require_org_membership
from backend.auth_utils import hash_token
from shared.schemas import EventCreate, EventResponse
from backend.analytics.session_correlator import SessionCorrelator
from backend.analytics.risk_engine import CompositeRiskEngine
from backend.analytics.alert_service import AlertService
from backend.analytics.intent_classifier import IntentClassifier
from backend.analytics.isolation_forest import AnomalyDetector

router = APIRouter(prefix="/api/events", tags=["events"])

correlator = SessionCorrelator(idle_threshold_minutes=15)
risk_engine = CompositeRiskEngine()
alert_service = AlertService(threshold=0.5)
intent_classifier = IntentClassifier()
anomaly_detector = AnomalyDetector()


@router.post("", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
def create_event(
    event: EventCreate,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Ingest raw endpoint event metadata payload into persistent database, correlate into activity session, evaluate hybrid risk score, and trigger alerts if threshold exceeded."""
    agent_id = None
    org_id = None
    device_id = event.device_id

    if authorization and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ", 1)[1].strip()
        token_hash = hash_token(token)
        agent = db.query(AgentModel).filter(AgentModel.auth_token_hash == token_hash).first()
        if not agent:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or revoked agent authentication token.",
            )
        agent_id = agent.id
        org_id = agent.org_id
        device_id = agent.id

    db_event = EventModel(
        event_id=event.event_id,
        user_id=event.user_id,
        device_id=device_id,
        agent_id=agent_id,
        org_id=org_id,
        event_type=event.event_type.value,
        timestamp=event.timestamp,
        event_metadata=event.metadata,
    )
    db.add(db_event)
    db.commit()
    db.refresh(db_event)

    # Correlate event into active user session
    session = correlator.correlate_event(db, db_event)

    # Reconstruct session intent label
    session_events = [
        {"event_type": e.event_type, "metadata": e.event_metadata}
        for e in session.events
    ]
    intent_label, _ = intent_classifier.classify_session_intent(session_events)
    session.reconstructed_intent = intent_label
    db.commit()

    # Calculate hybrid composite risk score
    timestamp_hour = db_event.timestamp.hour if db_event.timestamp else 12
    ml_anomaly_score = anomaly_detector.predict_anomaly_score(
        event_type=db_event.event_type,
        metadata=db_event.event_metadata or {},
        timestamp_hour=timestamp_hour,
    )

    risk_score = risk_engine.calculate_composite_risk(
        event_type=db_event.event_type,
        metadata=db_event.event_metadata or {},
        timestamp_hour=timestamp_hour,
        ml_anomaly_score=ml_anomaly_score,
    )

    # Update session max risk score if current event risk is higher
    if risk_score > session.risk_score:
        session.risk_score = risk_score
        db.commit()

    # Save or update AnomalyScoreModel record
    anomaly_record = db.query(AnomalyScoreModel).filter_by(session_id=session.id).first()
    rule_bonus = risk_engine.rule_engine.compute_rule_bonus(
        db_event.event_type, db_event.event_metadata or {}, timestamp_hour
    )
    if not anomaly_record:
        anomaly_record = AnomalyScoreModel(
            session_id=session.id,
            isolation_forest_score=ml_anomaly_score,
            rule_bonus_score=rule_bonus,
            z_score_deviation=0.0,
            graph_pattern_score=0.0,
            final_score=risk_score,
            breakdown_json={"last_event_type": db_event.event_type, "composite_score": risk_score},
        )
        db.add(anomaly_record)
    else:
        if risk_score > anomaly_record.final_score:
            anomaly_record.final_score = risk_score
            anomaly_record.rule_bonus_score = rule_bonus
            anomaly_record.isolation_forest_score = ml_anomaly_score
    db.commit()

    # Evaluate alert trigger
    alert_service.evaluate_event_alert(
        db=db,
        event=db_event,
        risk_score=risk_score,
        session_id=session.id,
    )

    return EventResponse(
        id=db_event.id,
        event_id=db_event.event_id,
        user_id=db_event.user_id,
        device_id=db_event.device_id,
        event_type=event.event_type,
        timestamp=db_event.timestamp,
        metadata=db_event.event_metadata,
        session_id=session.id,
    )


@router.get("", response_model=List[EventResponse])
def get_events(
    org_id: Optional[str] = None,
    user_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve raw ingested metadata events scoped by organization membership."""
    query = db.query(EventModel)
    
    if org_id:
        require_org_membership(user, org_id, db)
        query = query.join(AgentModel, AgentModel.id == EventModel.device_id).filter(AgentModel.org_id == org_id)
    else:
        memberships = db.query(UserOrganizationModel).filter(UserOrganizationModel.user_id == user.id).all()
        org_ids = [m.org_id for m in memberships]
        query = query.join(AgentModel, AgentModel.id == EventModel.device_id).filter(AgentModel.org_id.in_(org_ids))

    if user_id:
        query = query.filter(EventModel.user_id == user_id)

    db_events = query.order_by(EventModel.timestamp.desc()).offset(offset).limit(limit).all()

    return [
        EventResponse(
            id=e.id,
            event_id=e.event_id,
            user_id=e.user_id,
            device_id=e.device_id,
            event_type=e.event_type,
            timestamp=e.timestamp,
            metadata=e.event_metadata,
            session_id=e.session_id,
        )
        for e in db_events
    ]

