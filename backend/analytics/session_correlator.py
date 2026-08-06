from datetime import datetime, timedelta, timezone
from typing import Optional
from sqlalchemy.orm import Session

from backend.db.models import EventModel, SessionModel


class SessionCorrelator:
    """Sliding idle-window event correlation engine.

    Groups continuous sequence of events into cohesive user activity sessions.
    If inactivity between events exceeds `idle_threshold_minutes`, a new session is created.
    """

    def __init__(self, idle_threshold_minutes: int = 15):
        self.idle_threshold = timedelta(minutes=idle_threshold_minutes)

    def correlate_event(self, db: Session, event: EventModel) -> SessionModel:
        """Assign event to existing active session or instantiate a new session."""
        # Normalize event timestamp
        event_time = event.timestamp
        if event_time.tzinfo is not None:
            event_time = event_time.astimezone(timezone.utc).replace(tzinfo=None)

        # Look for existing open session for this user/device
        query = db.query(SessionModel).filter(
            SessionModel.user_id == event.user_id,
            SessionModel.device_id == event.device_id,
            SessionModel.is_closed.is_(False),
        )
        if event.org_id:
            query = query.filter(SessionModel.org_id == event.org_id)

        active_session = query.order_by(SessionModel.end_time.desc()).first()

        if active_session:
            session_end = active_session.end_time
            if session_end.tzinfo is not None:
                session_end = session_end.astimezone(timezone.utc).replace(tzinfo=None)

            idle_duration = event_time - session_end

            # If within idle threshold, extend active session
            if idle_duration <= self.idle_threshold:
                active_session.end_time = max(session_end, event_time)
                active_session.event_count += 1
                event.session_id = active_session.id
                db.add(active_session)
                db.add(event)
                db.commit()
                db.refresh(active_session)
                return active_session
            else:
                # Mark previous session closed
                active_session.is_closed = True
                db.add(active_session)

        # Create new session
        new_session = SessionModel(
            user_id=event.user_id,
            device_id=event.device_id,
            org_id=event.org_id,
            agent_id=event.agent_id,
            start_time=event_time,
            end_time=event_time,
            event_count=1,
            is_closed=False,
        )
        db.add(new_session)
        db.commit()
        db.refresh(new_session)

        event.session_id = new_session.id
        db.add(event)
        db.commit()

        return new_session
