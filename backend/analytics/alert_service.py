from typing import Optional
from sqlalchemy.orm import Session

from backend.db.models import AlertModel, EventModel, SessionModel


class AlertService:
    """Evaluates anomaly risk scores and creates persistent security alerts when thresholds are exceeded."""

    def __init__(self, threshold: float = 0.5):
        self.threshold = threshold

    def compute_severity(self, risk_score: float) -> str:
        """Classify numerical risk score into alert severity level."""
        if risk_score >= 0.85:
            return "CRITICAL"
        elif risk_score >= 0.70:
            return "HIGH"
        elif risk_score >= 0.50:
            return "MEDIUM"
        return "LOW"

    def evaluate_event_alert(
        self,
        db: Session,
        event: EventModel,
        risk_score: float,
        session_id: Optional[int] = None,
    ) -> Optional[AlertModel]:
        """Trigger alert creation if event risk score exceeds threshold."""
        if risk_score < self.threshold:
            return None

        severity = self.compute_severity(risk_score)
        message = (
            f"Anomalous telemetry detected for user '{event.user_id}' "
            f"({event.event_type} event, risk score: {risk_score:.2f})"
        )

        alert = AlertModel(
            session_id=session_id or event.session_id,
            user_id=event.user_id,
            device_id=event.device_id,
            risk_score=risk_score,
            severity=severity,
            status="ACTIVE",
            message=message,
        )
        db.add(alert)
        db.commit()
        db.refresh(alert)
        return alert
