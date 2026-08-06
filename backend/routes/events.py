from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session

from backend.db.models import EventModel, SessionModel, AnomalyScoreModel, UserModel, UserOrganizationModel, AgentModel
from backend.db.session import get_db
from backend.user_auth import get_current_user, require_org_membership
from backend.auth_utils import hash_token
from shared.schemas import EventCreate, EventResponse
router = APIRouter(prefix="/api/events", tags=["events"])


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

