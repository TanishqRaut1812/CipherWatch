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

        if severity in ("CRITICAL", "HIGH"):
            try:
                from backend.db.models import AgentModel, OrganizationModel, UserModel
                from backend.services.email_service import send_high_threat_alert_email

                agent = db.query(AgentModel).filter(AgentModel.id == event.device_id).first()
                if agent:
                    org = db.query(OrganizationModel).filter(OrganizationModel.id == agent.org_id).first()
                    if org and org.owner_user_id:
                        owner = db.query(UserModel).filter(UserModel.id == org.owner_user_id).first()
                        if owner and owner.email:
                            send_high_threat_alert_email(
                                admin_email=owner.email,
                                org_name=org.name,
                                device_name=agent.device_name or agent.hostname,
                                hostname=agent.hostname,
                                severity=severity,
                                rule_id="ANOMALY_DETECTION",
                                risk_score=risk_score,
                                message=message,
                                alert_time=alert.timestamp.strftime("%Y-%m-%d %H:%M:%S UTC"),
                            )
            except Exception:
                pass

        return alert
