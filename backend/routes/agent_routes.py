from datetime import datetime
import time
from typing import Dict, List, Optional
import uuid
from fastapi import APIRouter, Depends, Header, HTTPException, status, Request
from sqlalchemy.orm import Session

from backend.logging_config import logger
from backend.auth_utils import generate_agent_token, hash_token, verify_token
from backend.db.models import (
    AgentModel,
    EventModel,
    FSEventModel,
    MetricsSnapshotModel,
    OrganizationModel,
    ProcessEventModel,
    USBEventModel,
    UserModel,
    UserOrganizationModel,
)
from backend.db.session import get_db
from backend.user_auth import get_current_user, require_org_membership
from backend.analytics.threat_engine import ThreatEngine
from backend.schemas.agent_schemas import (
    AgentIngestionPayload,
    AgentIngestionResponse,
    AgentRegisterRequest,
    AgentRegisterResponse,
    HeartbeatResponse,
    AgentEnrollRequest,
    AgentEnrollResponse,
)

router = APIRouter(prefix="/api/agents", tags=["agents"])
root_agent_router = APIRouter(tags=["agent-root"])
threat_engine = ThreatEngine()

# Simple in-memory rate limiting per agent (agent_id -> list of request timestamps)
RATE_LIMIT_WINDOW_SEC = 60
MAX_REQUESTS_PER_WINDOW = 120
request_history: Dict[str, List[float]] = {}


def check_rate_limit(agent_id: str):
    """Enforce per-agent request rate limits to prevent backend flooding."""
    now = time.time()
    timestamps = request_history.get(agent_id, [])
    # Remove timestamps older than window
    timestamps = [ts for ts in timestamps if now - ts < RATE_LIMIT_WINDOW_SEC]
    if len(timestamps) >= MAX_REQUESTS_PER_WINDOW:
        logger.warning("Agent rate limit exceeded: agent_id={}, requests_in_window={}", agent_id, len(timestamps))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Maximum {MAX_REQUESTS_PER_WINDOW} requests per minute allowed.",
            headers={"Retry-After": "5"},
        )
    timestamps.append(now)
    request_history[agent_id] = timestamps


def get_current_agent(
    id: str,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> AgentModel:
    """Validate Bearer auth token header for given agent ID."""
    if not authorization or not authorization.startswith("Bearer "):
        logger.warning("Agent auth failure: agent_id={}, missing or malformed bearer header", id)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization bearer header.",
        )
    token = authorization.split("Bearer ", 1)[1].strip()
    agent = db.query(AgentModel).filter(AgentModel.id == id).first()
    if not agent:
        logger.warning("Agent auth failure: agent_id={} not found in database", id)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent ID '{id}' not found.",
        )

    if not verify_token(token, agent.auth_token_hash):
        logger.warning("Agent auth failure: agent_id={}, invalid token hash", id)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token for agent.",
        )
    return agent




@router.post("/{id}/heartbeat", response_model=HeartbeatResponse)
def agent_heartbeat(
    id: str,
    agent: AgentModel = Depends(get_current_agent),
    db: Session = Depends(get_db),
):
    """Lightweight liveness ping, updating agent's last_seen_at timestamp."""
    check_rate_limit(id)
    agent.last_seen_at = datetime.utcnow()
    db.commit()

    logger.debug("Heartbeat received: agent_id={}", id)

    return HeartbeatResponse(
        status="ok",
        agent_id=agent.id,
        last_seen_at=agent.last_seen_at,
    )


@router.post("/{id}/events", response_model=AgentIngestionResponse)
def ingest_agent_events(
    id: str,
    payload: AgentIngestionPayload,
    agent: AgentModel = Depends(get_current_agent),
    db: Session = Depends(get_db),
):
    """Batched upload endpoint for agent process events, filesystem watchdog events, and resource metrics."""
    check_rate_limit(id)
    now = datetime.utcnow()
    agent.last_seen_at = now

    metrics_count = 0
    if payload.metrics:
        m = payload.metrics
        metric_rec = MetricsSnapshotModel(
            agent_id=agent.id,
            timestamp=m.timestamp or now,
            cpu_percent=m.cpu_percent,
            mem_percent=m.mem_percent,
            disk_percent=m.disk_percent,
            net_bytes_sent=m.net_bytes_sent,
            net_bytes_recv=m.net_bytes_recv,
            process_count=m.process_count,
        )
        db.add(metric_rec)
        metrics_count = 1

    proc_events_count = 0
    proc_eval_data = []
    for proc in payload.process_events:
        proc_rec = ProcessEventModel(
            agent_id=agent.id,
            timestamp=proc.timestamp or now,
            event_type=proc.event_type,
            pid=proc.pid,
            name=proc.name,
            exe_path=proc.exe_path,
            cmdline=proc.cmdline,
            user=proc.user,
            cpu_percent=proc.cpu_percent,
            mem_rss=proc.mem_rss,
        )
        db.add(proc_rec)
        db.flush()  # assign proc_rec.id
        proc_events_count += 1
        proc_eval_data.append({
            "db_id": proc_rec.id,
            "event_type": proc.event_type,
            "pid": proc.pid,
            "name": proc.name,
            "exe_path": proc.exe_path,
            "cmdline": proc.cmdline,
            "user": proc.user,
        })

    fs_events_count = 0
    fs_eval_data = []
    for fs in payload.fs_events:
        fs_rec = FSEventModel(
            agent_id=agent.id,
            timestamp=fs.timestamp or now,
            event_type=fs.event_type,
            src_path=fs.src_path,
            dest_path=fs.dest_path,
            is_directory=fs.is_directory,
        )
        db.add(fs_rec)
        fs_events_count += 1
        fs_eval_data.append({
            "event_type": fs.event_type,
            "src_path": fs.src_path,
            "dest_path": fs.dest_path,
        })

    usb_events_count = 0
    usb_eval_data = []
    for usb in payload.usb_events:
        usb_rec = USBEventModel(
            agent_id=agent.id,
            timestamp=usb.timestamp or now,
            action=usb.action,
            vendor_id=usb.vendor_id,
            product_id=usb.product_id,
            device_name=usb.device_name,
            mount_point=usb.mount_point,
        )
        db.add(usb_rec)
        db.flush()
        usb_events_count += 1
        usb_eval_data.append({
            "db_id": usb_rec.id,
            "action": usb.action,
            "vendor_id": usb.vendor_id,
            "product_id": usb.product_id,
            "device_name": usb.device_name,
            "mount_point": usb.mount_point,
        })

    raw_events_count = 0
    raw_eval_data = []
    for raw in payload.raw_events:
        event_id = raw.get("event_id") or str(uuid.uuid4())
        event_type = raw.get("event_type") or "generic"
        user_id = raw.get("user_id") or agent.hostname
        meta = raw.get("metadata") or {}
        
        event_rec = EventModel(
            event_id=event_id,
            org_id=agent.org_id,
            agent_id=agent.id,
            timestamp=now,
            user_id=user_id,
            device_id=agent.id,
            event_type=str(event_type),
            event_metadata=meta,
        )
        db.add(event_rec)
        raw_events_count += 1
        raw_eval_data.append({
            "event_id": event_id,
            "event_type": str(event_type),
            "metadata": meta,
        })

    db.commit()

    # Pass payload into threat engine rules
    threat_payload = {
        "metrics": payload.metrics.model_dump() if payload.metrics else None,
        "process_events": proc_eval_data,
        "fs_events": fs_eval_data,
        "usb_events": usb_eval_data,
        "raw_events": raw_eval_data,
    }
    alerts_created = threat_engine.evaluate_payload(db, agent, threat_payload)

    logger.info(
        "Telemetry ingested: agent_id={}, metrics={}, procs={}, fs_events={}, usb_events={}, raw_events={}, alerts_triggered={}",
        agent.id,
        metrics_count,
        proc_events_count,
        fs_events_count,
        usb_events_count,
        raw_events_count,
        len(alerts_created),
    )

    return AgentIngestionResponse(
        status="success",
        agent_id=agent.id,
        metrics_ingested=metrics_count,
        process_events_ingested=proc_events_count,
        fs_events_ingested=fs_events_count,
        usb_events_ingested=usb_events_count,
        alerts_triggered=len(alerts_created),
    )


@root_agent_router.post("/api/agent/enroll", response_model=AgentEnrollResponse, status_code=status.HTTP_201_CREATED)
def enroll_agent(payload: AgentEnrollRequest, request: Request, db: Session = Depends(get_db)):
    """Enroll an agent using the new organization credentials (organization_id and enrollment_key)."""
    # 1. Find organization by organization_id (UUID) or org.id (for compatibility)
    org = db.query(OrganizationModel).filter(
        (OrganizationModel.organization_id == payload.organization_id) | 
        (OrganizationModel.id == payload.organization_id)
    ).first()
    if not org:
        logger.warning("Enrollment failed: organization not found for organization_id={}", payload.organization_id)
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found.")
        
    # 2. Verify enrollment key
    # Check both enrollment_key and registration_key to be backward compatible
    if (org.enrollment_key != payload.enrollment_key) and (org.registration_key != payload.enrollment_key):
        logger.warning("Enrollment failed: invalid enrollment_key for organization_id={}", payload.organization_id)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid enrollment key.")
        
    # 3. Register agent
    agent_id = f"agent_{uuid.uuid4().hex[:12]}"
    raw_token = generate_agent_token()
    token_hash = hash_token(raw_token)
    
    # Get client IP
    client_ip = request.client.host if request.client else "127.0.0.1"
    
    agent = AgentModel(
        id=agent_id,
        org_id=org.id,
        hostname=payload.hostname,
        device_uuid=payload.device_uuid,
        os=payload.os,
        ip=client_ip,
        agent_version=payload.agent_version,
        auth_token_hash=token_hash,
        enrolled_at=datetime.utcnow(),
        last_seen_at=datetime.utcnow(),
    )
    db.add(agent)
    db.commit()
    db.refresh(agent)
    
    logger.info("Agent enrolled: id={}, org_id={}, hostname={}, ip={}", agent.id, org.id, agent.hostname, agent.ip)
    
    # Determine base backend URL from request
    backend_url = str(request.base_url).rstrip("/")
    
    return AgentEnrollResponse(
        agent_id=agent.id,
        auth_token=raw_token,
        backend_url=backend_url,
        heartbeat_interval=30
    )


@root_agent_router.post("/api/heartbeat", response_model=HeartbeatResponse)
def root_agent_heartbeat(
    request: Request,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    """Liveness ping for enrolled agents using bearer token auth."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization bearer header.",
        )
    token = authorization.split("Bearer ", 1)[1].strip()
    token_hash = hash_token(token)
    agent = db.query(AgentModel).filter(AgentModel.auth_token_hash == token_hash).first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or revoked agent authentication token.",
        )
    
    agent.last_seen_at = datetime.utcnow()
    # Update client IP dynamically on heartbeat if changed
    if request.client:
        agent.ip = request.client.host
    db.commit()
    
    logger.debug("Heartbeat received via root endpoint: agent_id={}", agent.id)
    
    return HeartbeatResponse(
        status="ok",
        agent_id=agent.id,
        last_seen_at=agent.last_seen_at,
    )


@router.get("", response_model=List[dict])
def list_all_agents(
    org_id: Optional[str] = None,
    user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all agents for an organization. Enforces organization membership check."""
    if not org_id:
        membership = db.query(UserOrganizationModel).filter(UserOrganizationModel.user_id == user.id).first()
        if not membership:
            raise HTTPException(status_code=403, detail="User is not a member of any organization.")
        org_id = membership.org_id
    else:
        require_org_membership(user, org_id, db)

    agents = db.query(AgentModel).filter(AgentModel.org_id == org_id).all()
    
    results = []
    for agent in agents:
        computed_status = agent.get_status(threshold_seconds=90)
        results.append({
            "id": agent.id,
            "hostname": agent.hostname,
            "device_uuid": agent.device_uuid,
            "os": agent.os,
            "ip": agent.ip,
            "agent_version": agent.agent_version,
            "enrolled_at": agent.enrolled_at,
            "last_seen_at": agent.last_seen_at,
            "status": computed_status,
        })
    return results


@router.post("/{id}/revoke")
def revoke_agent(
    id: str,
    user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Revoke an agent's access by deleting its record (cascading all associated events)."""
    agent = db.query(AgentModel).filter(AgentModel.id == id).first()
    if not agent:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found.")
    
    require_org_membership(user, agent.org_id, db)
    
    db.delete(agent)
    db.commit()
    
    logger.info("Agent revoked and deleted successfully: id={}, host={}", id, agent.hostname)
    return {"status": "success", "message": f"Agent {id} has been revoked successfully."}
