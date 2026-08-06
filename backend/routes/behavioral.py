"""
API routes for CipherWatch Predictive Behavior Detection Engine.
Exposes endpoints to query active threat sessions, loaded templates, and triggering events.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.analytics.predictive_engine import predictive_engine
from backend.db.session import get_db
from backend.routes.auth import get_current_user
from backend.db.models import UserModel

router = APIRouter(prefix="/api/behavioral-sessions", tags=["Behavioral Intelligence"])


@router.get("/active")
def get_active_behavioral_sessions(
    org_id: Optional[str] = Query(None, description="Filter by Organization ID"),
    agent_id: Optional[str] = Query(None, description="Filter by Agent ID"),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
) -> Dict[str, Any]:
    """Retrieve all active predictive behavioral sessions with threat progression & predictions."""
    sessions = predictive_engine.get_active_sessions(db=db, org_id=org_id, agent_id=agent_id)
    return {
        "success": True,
        "count": len(sessions),
        "sessions": sessions
    }


@router.get("/templates")
def get_behavior_templates(
    current_user: UserModel = Depends(get_current_user)
) -> Dict[str, Any]:
    """Retrieve all loaded attack chain behavior templates."""
    templates = predictive_engine.loader.get_all_templates()
    return {
        "success": True,
        "count": len(templates),
        "templates": templates
    }


@router.post("/reload-templates")
def reload_behavior_templates(
    current_user: UserModel = Depends(get_current_user)
) -> Dict[str, Any]:
    """Reload all behavior templates dynamically from disk."""
    count = predictive_engine.reload_templates()
    return {
        "success": True,
        "message": f"Successfully reloaded {count} behavior templates.",
        "count": count
    }


@router.post("/simulate-event")
def simulate_behavior_event(
    payload: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
) -> Dict[str, Any]:
    """Ingest a synthetic telemetry event directly into the Predictive Behavior Detection Engine."""
    updated = predictive_engine.process_event(db=db, event_data=payload)
    active_all = predictive_engine.get_active_sessions(db=db, org_id=payload.get("org_id"), agent_id=payload.get("agent_id"))
    return {
        "success": True,
        "updated_count": len(updated),
        "updated_sessions": updated,
        "all_active_sessions": active_all
    }
