from typing import List, Optional
from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from backend.db.models import AlertModel, UserModel, UserOrganizationModel, AgentModel
from backend.db.session import get_db
from backend.user_auth import get_current_user, require_org_membership

router = APIRouter(prefix="/api/alerts", tags=["alerts"])
ws_router = APIRouter(prefix="/ws", tags=["websocket"])


class ConnectionManager:
    """Manages active WebSocket connections for real-time alert broadcasts."""

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, data: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(data)
            except Exception:
                pass


ws_manager = ConnectionManager()


@router.get("", response_model=List[dict])
def get_alerts(
    org_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = Query(default=50, ge=1, le=500),
    user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Fetch historical security alerts for SOC analyst dashboard, filtered by organization."""
    query = db.query(AlertModel)
    
    if org_id:
        require_org_membership(user, org_id, db)
        query = query.join(AgentModel, AgentModel.id == AlertModel.agent_id).filter(AgentModel.org_id == org_id)
    else:
        # Return alerts for all organizations the user belongs to
        memberships = db.query(UserOrganizationModel).filter(UserOrganizationModel.user_id == user.id).all()
        org_ids = [m.org_id for m in memberships]
        query = query.join(AgentModel, AgentModel.id == AlertModel.agent_id).filter(AgentModel.org_id.in_(org_ids))

    if status:
        query = query.filter(AlertModel.status == status)

    alerts = query.order_by(AlertModel.timestamp.desc()).limit(limit).all()

    return [
        {
            "id": a.id,
            "session_id": a.session_id,
            "user_id": a.user_id,
            "device_id": a.device_id,
            "risk_score": a.risk_score,
            "severity": a.severity,
            "status": a.status,
            "message": a.message,
            "analyst_feedback": a.analyst_feedback or "UNREVIEWED",
            "feedback_comments": a.feedback_comments,
            "created_at": (
                a.timestamp.isoformat() if hasattr(a.timestamp, "isoformat")
                else a.timestamp if isinstance(a.timestamp, str)
                else None
            ),
        }
        for a in alerts
    ]


from pydantic import BaseModel

class FeedbackPayload(BaseModel):
    feedback: str  # "CONFIRMED_THREAT" or "FALSE_POSITIVE"
    comments: Optional[str] = None


@router.post("/{alert_id}/feedback")
def submit_alert_feedback(
    alert_id: int,
    payload: FeedbackPayload,
    user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submit analyst feedback (CONFIRMED_THREAT or FALSE_POSITIVE) for a given alert ID."""
    from fastapi import HTTPException, status

    valid_feedbacks = ["CONFIRMED_THREAT", "FALSE_POSITIVE", "RESOLVED", "UNREVIEWED"]
    feedback_str = payload.feedback.upper()
    if feedback_str not in valid_feedbacks:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid feedback '{payload.feedback}'. Must be one of {valid_feedbacks}",
        )

    alert = db.query(AlertModel).filter(AlertModel.id == alert_id).first()
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert with ID {alert_id} not found",
        )

    # Enforce multi-tenant isolation boundary
    agent = db.query(AgentModel).filter(AgentModel.id == alert.agent_id).first()
    if agent:
        require_org_membership(user, agent.org_id, db)

    alert.analyst_feedback = feedback_str
    if payload.comments:
        alert.feedback_comments = payload.comments
    
    if feedback_str == "RESOLVED" or feedback_str == "FALSE_POSITIVE":
        alert.status = "RESOLVED"
    elif feedback_str == "CONFIRMED_THREAT":
        alert.status = "CONFIRMED"

    db.commit()
    db.refresh(alert)

    # Automatically adjust baseline profile via FeedbackAdapter
    from backend.engine.feedback_adapter import FeedbackAdapter
    adapter = FeedbackAdapter()
    adjustment_res = adapter.process_feedback(alert.id, feedback_str, db)

    return {
        "id": alert.id,
        "session_id": alert.session_id,
        "status": alert.status,
        "analyst_feedback": alert.analyst_feedback,
        "feedback_comments": alert.feedback_comments,
        "baseline_adjustment": adjustment_res,
        "message": f"Feedback '{alert.analyst_feedback}' successfully recorded for alert #{alert.id}",
    }



@router.get("/{alert_id}/explanation")
def get_alert_explanation(
    alert_id: int,
    user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate or retrieve plain-English LLM incident explanation for a given alert ID."""
    from fastapi import HTTPException, status
    from backend.db.models import AlertModel, SessionModel, IncidentModel, AnomalyScoreModel
    from backend.llm.incident_explainer import IncidentExplainer
    from backend.analytics.risk_engine import CompositeRiskEngine
    from backend.analytics.longitudinal_tracker import LongitudinalTracker

    risk_engine = CompositeRiskEngine()
    longitudinal_tracker = LongitudinalTracker()

    alert = db.query(AlertModel).filter(AlertModel.id == alert_id).first()
    if not alert:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Alert with ID {alert_id} not found",
        )

    # Enforce multi-tenant isolation boundary
    agent = db.query(AgentModel).filter(AgentModel.id == alert.agent_id).first()
    if agent:
        require_org_membership(user, agent.org_id, db)

    if alert.session_id:
        existing_incident = db.query(IncidentModel).filter(IncidentModel.session_id == alert.session_id).first()
        if existing_incident:
            return {
                "alert_id": alert.id,
                "session_id": alert.session_id,
                "title": existing_incident.title,
                "severity": existing_incident.severity,
                "explanation": existing_incident.llm_explanation,
            }

    # Fetch session telemetry and events
    events_data = []
    reconstructed_intent = "Unclassified Activity"
    ml_anomaly_score = 0.0
    historical_metric_values = []
    
    if alert.session_id:
        session_obj = db.query(SessionModel).filter(SessionModel.id == alert.session_id).first()
        if session_obj:
            reconstructed_intent = session_obj.reconstructed_intent or reconstructed_intent
            events_data = [
                {
                    "event_type": e.event_type,
                    "timestamp": e.timestamp.isoformat() if e.timestamp else "",
                    "metadata": e.event_metadata or {},
                }
                for e in session_obj.events
            ]
            if session_obj.anomaly_score:
                ml_anomaly_score = session_obj.anomaly_score.isolation_forest_score or 0.0

            # Query historical event counts for baseline deviation calculation
            past_sessions = (
                db.query(SessionModel)
                .filter(SessionModel.user_id == alert.user_id, SessionModel.id != alert.session_id)
                .all()
            )
            historical_metric_values = [float(s.event_count or 0) for s in past_sessions]

            # Record activities into LongitudinalTracker to calculate 14-day slow-drip drift
            for e in session_obj.events:
                meta = e.event_metadata or {}
                bytes_tx = meta.get("bytes_sent", 0) or meta.get("file_size_bytes", 0)
                dest_type = meta.get("destination_category", "") or meta.get("mount_point", "") or "local"
                longitudinal_tracker.record_activity(
                    user_id=alert.user_id,
                    timestamp=e.timestamp,
                    bytes_transferred=bytes_tx,
                    destination_type=dest_type,
                    event_type=e.event_type,
                )

    longitudinal_drift_score = longitudinal_tracker.compute_longitudinal_risk_score(alert.user_id)

    session_payload = {
        "user_id": alert.user_id,
        "device_id": alert.device_id,
        "session_id": alert.session_id or "N/A",
        "reconstructed_intent": reconstructed_intent,
        "risk_score": alert.risk_score,
        "severity": alert.severity,
        "events": events_data,
    }

    # Evaluate canonical session risk score & 6-component factor breakdown
    risk_eval = risk_engine.evaluate_risk_with_breakdown(
        session_payload=session_payload,
        ml_anomaly_score=ml_anomaly_score,
        historical_metric_values=historical_metric_values if historical_metric_values else None,
        longitudinal_drift_score=longitudinal_drift_score,
    )

    # Overwrite risk_score and inject breakdown into session payload so score and breakdown never diverge
    session_payload["risk_score"] = risk_eval["risk_score"]
    session_payload["breakdown"] = risk_eval["breakdown"]
    session_payload["risk_breakdown"] = risk_eval["breakdown"]

    explainer = IncidentExplainer()
    explanation = explainer.generate_explanation(session_payload)
    title = f"Security Incident - {reconstructed_intent} ({alert.severity})"

    if alert.session_id:
        new_incident = IncidentModel(
            session_id=alert.session_id,
            title=title,
            severity=alert.severity,
            llm_explanation=explanation,
        )
        db.add(new_incident)
        db.commit()

    return {
        "alert_id": alert.id,
        "session_id": alert.session_id,
        "title": title,
        "severity": alert.severity,
        "explanation": explanation,
    }



@ws_router.websocket("/alerts")
async def websocket_alerts_endpoint(websocket: WebSocket):
    """WebSocket endpoint broadcasting real-time security alerts."""
    await ws_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
