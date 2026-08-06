"""
Longitudinal Tracker Module.

Tracks user activity volume over a 14-day rolling window to detect low-and-slow
"slow-drip" exfiltration patterns across sessions that evade single-session threshold alerts.
"""

from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional


class LongitudinalTracker:
    """Tracks cumulative transfer volumes and calculates longitudinal risk scores."""

    def __init__(self, window_days: int = 14):
        self.window_days = window_days
        # Memory buffer: user_id -> List of daily record dicts
        self._user_history: Dict[str, List[Dict[str, Any]]] = {}

    def record_activity(
        self,
        user_id: str,
        timestamp: Optional[datetime] = None,
        bytes_transferred: int = 0,
        destination_type: str = "local",
        event_type: str = "FILE_CREATE",
    ) -> None:
        """Record an activity event into the user's longitudinal tracking window."""
        ts = timestamp or datetime.now(timezone.utc)
        date_str = ts.strftime("%Y-%m-%d") if isinstance(ts, datetime) else str(ts)[:10]

        if user_id not in self._user_history:
            self._user_history[user_id] = []

        history = self._user_history[user_id]

        # Find or create daily record
        day_record = next((r for r in history if r["date"] == date_str), None)
        if not day_record:
            day_record = {
                "date": date_str,
                "total_bytes": 0,
                "usb_bytes": 0,
                "cloud_bytes": 0,
                "event_count": 0,
            }
            history.append(day_record)

        day_record["total_bytes"] += bytes_transferred
        day_record["event_count"] += 1

        dest_lower = destination_type.lower()
        if dest_lower in ("usb", "removable"):
            day_record["usb_bytes"] += bytes_transferred
        elif dest_lower in ("cloud", "webmail", "external_host", "unrecognized_storage"):
            day_record["cloud_bytes"] += bytes_transferred

        # Prune records older than window_days
        cutoff_date = (ts - timedelta(days=self.window_days)).strftime("%Y-%m-%d")
        self._user_history[user_id] = [r for r in history if r["date"] >= cutoff_date]

    def get_user_summary(self, user_id: str) -> Dict[str, Any]:
        """Get multi-day volume summary for a given user."""
        history = self._user_history.get(user_id, [])
        return {
            "user_id": user_id,
            "active_days": len(history),
            "total_bytes": sum(r["total_bytes"] for r in history),
            "usb_bytes": sum(r["usb_bytes"] for r in history),
            "cloud_bytes": sum(r["cloud_bytes"] for r in history),
            "total_events": sum(r["event_count"] for r in history),
        }

    def compute_longitudinal_risk_score(self, user_id: str) -> float:
        """Calculate longitudinal risk score (0.0 to 1.0) based on historical cumulative drift

        and slow-drip exfiltration indicators over the 14-day window.
        """
        history = self._user_history.get(user_id, [])
        if not history:
            return 0.0

        usb_window_bytes = sum(r["usb_bytes"] for r in history)
        cloud_window_bytes = sum(r["cloud_bytes"] for r in history)
        exfil_bytes = usb_window_bytes + cloud_window_bytes

        score = 0.0

        # Slow-drip volume cumulative thresholds
        if exfil_bytes >= 500 * 1024 * 1024:  # >= 500 MB
            score += 0.50
        elif exfil_bytes >= 100 * 1024 * 1024:  # >= 100 MB
            score += 0.30
        elif exfil_bytes >= 25 * 1024 * 1024:  # >= 25 MB
            score += 0.15

        # Multi-day persistent exfiltration bonus (exfiltrating across distinct days)
        exfil_days = sum(
            1 for r in history if (r["usb_bytes"] + r["cloud_bytes"]) >= 1 * 1024 * 1024
        )
        if exfil_days >= 5:
            score += 0.35
        elif exfil_days >= 3:
            score += 0.20

        # High event count drift bonus
        total_events = sum(r["event_count"] for r in history)
        if total_events >= 1000:
            score += 0.15

        return min(1.0, round(score, 2))
