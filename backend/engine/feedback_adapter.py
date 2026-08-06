import logging
from typing import Dict, Any, Optional
from sqlalchemy.orm import Session

from backend.db.models import AlertModel, UserBaselineModel, SessionModel

logger = logging.getLogger("cipherwatch.feedback_adapter")


class FeedbackAdapter:
    """
    Handles dynamic baseline profile adjustment and risk factor tuning based on SOC analyst feedback.
    
    When an analyst marks an alert as FALSE_POSITIVE, the system automatically expands the user's
    baseline tolerance and reduces the risk score multiplier to prevent repeat false alarms.
    """

    def process_feedback(self, alert_id: int, feedback_type: str, db: Session) -> Dict[str, Any]:
        """Process analyst feedback for an alert and update user baseline profile."""
        alert = db.query(AlertModel).filter(AlertModel.id == alert_id).first()
        if not alert:
            logger.warning(f"Alert #{alert_id} not found for baseline feedback processing.")
            return {"status": "error", "message": f"Alert {alert_id} not found"}

        user_id = alert.user_id
        feedback_str = feedback_type.upper()

        # Fetch or create baseline record for user
        baseline = db.query(UserBaselineModel).filter(UserBaselineModel.user_id == user_id).first()
        if not baseline:
            baseline = UserBaselineModel(
                user_id=user_id,
                mean_events_per_session=10.0,
                std_events_per_session=3.0,
                false_positive_count=0,
                confirmed_threat_count=0,
                risk_tolerance_factor=1.0,
            )
            db.add(baseline)
            db.commit()
            db.refresh(baseline)

        old_tolerance = baseline.risk_tolerance_factor

        if feedback_str == "FALSE_POSITIVE":
            baseline.false_positive_count += 1
            # Reduce risk sensitivity factor by 15% (floor at 0.40) to suppress repeat false alarms
            baseline.risk_tolerance_factor = max(0.40, round(baseline.risk_tolerance_factor * 0.85, 3))
            # Expand normal baseline mean event count tolerance
            baseline.mean_events_per_session += 2.0
            logger.info(
                f"Adjusted baseline for user {user_id} after FALSE_POSITIVE. "
                f"Tolerance factor: {old_tolerance} -> {baseline.risk_tolerance_factor}"
            )

        elif feedback_str == "CONFIRMED_THREAT":
            baseline.confirmed_threat_count += 1
            # Increase risk sensitivity factor by 15% (cap at 1.50)
            baseline.risk_tolerance_factor = min(1.50, round(baseline.risk_tolerance_factor * 1.15, 3))
            logger.info(
                f"Tightened baseline for user {user_id} after CONFIRMED_THREAT. "
                f"Tolerance factor: {old_tolerance} -> {baseline.risk_tolerance_factor}"
            )

        db.commit()
        db.refresh(baseline)

        return {
            "status": "success",
            "user_id": user_id,
            "feedback": feedback_str,
            "old_tolerance_factor": old_tolerance,
            "new_tolerance_factor": baseline.risk_tolerance_factor,
            "false_positive_count": baseline.false_positive_count,
            "confirmed_threat_count": baseline.confirmed_threat_count,
        }

    def get_adjusted_risk_score(self, user_id: str, raw_risk_score: float, db: Session) -> float:
        """Apply user-specific risk tolerance factor adjustment to a raw risk score."""
        baseline = db.query(UserBaselineModel).filter(UserBaselineModel.user_id == user_id).first()
        if not baseline:
            return raw_risk_score

        adjusted_score = round(raw_risk_score * baseline.risk_tolerance_factor, 2)
        return min(100.0 if raw_risk_score > 1.0 else 1.0, max(0.0, adjusted_score))
