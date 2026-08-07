from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from datetime import datetime

from backend.db.models import (
    EventModel,
    SessionModel,
    AnomalyScoreModel,
    UserModel,
    UserOrganizationModel,
    AgentModel,
    ProcessEventModel,
    FSEventModel,
    USBEventModel,
)
from backend.db.session import get_db
from backend.user_auth import get_current_user, require_org_membership
from backend.auth_utils import hash_token

router = APIRouter(prefix="/api/events", tags=["events"])


def _format_ts(ts) -> Optional[str]:
    if not ts:
        return None
    if isinstance(ts, str):
        return ts
    return ts.isoformat()


@router.get("", response_model=List[Dict[str, Any]])
def get_events(
    org_id: Optional[str] = None,
    user_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve raw and structured ingested metadata events aggregated across all telemetry streams."""
    if org_id:
        require_org_membership(user, org_id, db)
        agents = db.query(AgentModel).filter(AgentModel.org_id == org_id).all()
    else:
        memberships = db.query(UserOrganizationModel).filter(UserOrganizationModel.user_id == user.id).all()
        org_ids = [m.org_id for m in memberships]
        agents = db.query(AgentModel).filter(AgentModel.org_id.in_(org_ids)).all()

    agent_map = {a.id: a for a in agents}
    agent_ids = list(agent_map.keys())

    if not agent_ids:
        return []

    events_list = []

    # 1. Generic EventModel (events table)
    e_query = db.query(EventModel).filter(EventModel.agent_id.in_(agent_ids))
    if user_id:
        e_query = e_query.filter(EventModel.user_id == user_id)
    raw_events = e_query.order_by(EventModel.timestamp.desc()).limit(limit).all()

    for e in raw_events:
        ag = agent_map.get(e.agent_id)
        org_id_val = e.org_id or (ag.org_id if ag else None)
        meta = dict(e.event_metadata or {})
        summary = meta.get("summary") or f"Event {e.event_type} on {e.device_id}"
        events_list.append({
            "id": f"evt-{e.id}",
            "event_id": e.event_id or f"evt-{e.id}",
            "timestamp": _format_ts(e.timestamp),
            "event_type": e.event_type,
            "type": e.event_type,
            "user_id": e.user_id,
            "device_id": e.device_id,
            "agent_id": e.agent_id or e.device_id,
            "organization_id": org_id_val,
            "org_id": org_id_val,
            "summary": summary,
            "severity": meta.get("severity", "info"),
            "metadata": meta,
            "session_id": e.session_id,
        })

    # 2. USBEventModel (usb_events table)
    u_query = db.query(USBEventModel).filter(USBEventModel.agent_id.in_(agent_ids))
    usb_db_events = u_query.order_by(USBEventModel.timestamp.desc()).limit(limit).all()

    for u in usb_db_events:
        ag = agent_map.get(u.agent_id)
        dev_name = u.device_name or "Storage Device"
        mnt_pt = u.mount_point or "N/A"
        act = u.action or "connected"
        summary = f"USB storage '{dev_name}' {act} at '{mnt_pt}'"
        ev_type = "USB_INSERT" if act == "connected" else ("USB_REMOVE" if act == "disconnected" else "usb")
        user_id_val = user_id or (ag.username if ag else None) or (ag.hostname if ag else None) or u.agent_id

        meta = {
            "action": act,
            "vendor_id": u.vendor_id,
            "product_id": u.product_id,
            "device_name": dev_name,
            "mount_point": mnt_pt,
            "summary": summary,
        }

        events_list.append({
            "id": f"usb-{u.id}",
            "event_id": f"usb-{u.id}",
            "timestamp": _format_ts(u.timestamp),
            "event_type": ev_type,
            "type": "usb",
            "action": act,
            "device_name": dev_name,
            "mount_point": mnt_pt,
            "vendor_id": u.vendor_id,
            "product_id": u.product_id,
            "user_id": user_id_val,
            "device_id": u.agent_id,
            "agent_id": u.agent_id,
            "organization_id": ag.org_id if ag else None,
            "org_id": ag.org_id if ag else None,
            "summary": summary,
            "severity": "warning" if act == "connected" else "info",
            "metadata": meta,
        })

    # 3. ProcessEventModel (process_events table)
    p_query = db.query(ProcessEventModel).filter(ProcessEventModel.agent_id.in_(agent_ids))
    if user_id:
        p_query = p_query.filter(ProcessEventModel.user == user_id)
    proc_db_events = p_query.order_by(ProcessEventModel.timestamp.desc()).limit(limit).all()

    for p in proc_db_events:
        ag = agent_map.get(p.agent_id)
        act = p.event_type or "start"
        summary = f"Process {p.name} (PID {p.pid}) {act}"
        ev_type = "PROCESS_LAUNCH" if act in ("start", "EXEC") else "process"
        user_id_val = p.user or (ag.username if ag else None) or (ag.hostname if ag else None) or p.agent_id

        meta = {
            "action": act,
            "process_name": p.name,
            "pid": p.pid,
            "exe_path": p.exe_path,
            "cmdline": p.cmdline,
            "user": p.user,
            "cpu_percent": p.cpu_percent,
            "mem_rss": p.mem_rss,
            "summary": summary,
        }

        events_list.append({
            "id": f"proc-{p.id}",
            "event_id": f"proc-{p.id}",
            "timestamp": _format_ts(p.timestamp),
            "event_type": ev_type,
            "type": "process",
            "action": act,
            "user_id": user_id_val,
            "device_id": p.agent_id,
            "agent_id": p.agent_id,
            "organization_id": ag.org_id if ag else None,
            "org_id": ag.org_id if ag else None,
            "summary": summary,
            "severity": "info",
            "metadata": meta,
        })

    # 4. FSEventModel (fs_events table)
    f_query = db.query(FSEventModel).filter(FSEventModel.agent_id.in_(agent_ids))
    fs_db_events = f_query.order_by(FSEventModel.timestamp.desc()).limit(limit).all()

    for f in fs_db_events:
        ag = agent_map.get(f.agent_id)
        act = f.event_type or "modified"
        summary = f"FS {act.upper()}: {f.src_path}"
        ev_type = f"FILE_{(act or 'modified').upper()}"
        user_id_val = user_id or (ag.username if ag else None) or (ag.hostname if ag else None) or f.agent_id

        meta = {
            "action": act,
            "src_path": f.src_path,
            "dest_path": f.dest_path,
            "is_directory": f.is_directory,
            "summary": summary,
        }

        events_list.append({
            "id": f"fs-{f.id}",
            "event_id": f"fs-{f.id}",
            "timestamp": _format_ts(f.timestamp),
            "event_type": ev_type,
            "type": "filesystem",
            "action": act,
            "user_id": user_id_val,
            "device_id": f.agent_id,
            "agent_id": f.agent_id,
            "organization_id": ag.org_id if ag else None,
            "org_id": ag.org_id if ag else None,
            "summary": summary,
            "severity": "high" if act == "deleted" else ("medium" if act == "modified" else "info"),
            "metadata": meta,
        })

    # Sort unified timeline by timestamp descending
    events_list.sort(key=lambda x: x.get("timestamp") or "", reverse=True)

    # Slice for pagination offset and limit
    return events_list[offset : offset + limit]


