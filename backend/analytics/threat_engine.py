from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from backend.logging_config import logger
from backend.db.models import AgentModel, AlertModel, FSEventModel, ProcessEventModel, MetricsSnapshotModel, OrganizationModel, UserModel
from backend.services.email_service import send_high_threat_alert_email

SUSPICIOUS_PATHS = [
    "/tmp",
    "/var/tmp",
    "/dev/shm",
    "appdata\\local\\temp",
    "appdata/local/temp",
    "c:\\windows\\temp",
]

ELEVATED_USERS = ["root", "system", "administrator", "NT AUTHORITY\\SYSTEM"]


class BaseThreatRule(ABC):
    """Abstract base class for pluggable threat detection rules."""

    rule_id: str
    name: str
    default_severity: str = "warning"

    @abstractmethod
    def evaluate(self, db: Session, agent: AgentModel, payload: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Evaluate incoming event batch or telemetry payload.
        Returns a list of alert dicts: [{"rule_id": str, "severity": str, "message": str, "related_event_id": int}]
        """
        pass


class FSRapidBurstRule(BaseThreatRule):
    """Detects bursts of filesystem modifications/deletions in a short window (ransomware-like pattern)."""

    rule_id = "FS_RAPID_BURST"
    name = "Rapid Filesystem Activity Burst"
    default_severity = "critical"

    def __init__(self, burst_threshold: int = 15, window_seconds: int = 30):
        self.burst_threshold = burst_threshold
        self.window_seconds = window_seconds

    def evaluate(self, db: Session, agent: AgentModel, payload: Dict[str, Any]) -> List[Dict[str, Any]]:
        alerts = []
        fs_events = payload.get("fs_events", [])
        
        # Check payload event batch
        if len(fs_events) >= self.burst_threshold:
            modified_or_deleted = [e for e in fs_events if e.get("event_type") in ("created", "modified", "deleted")]
            if len(modified_or_deleted) >= self.burst_threshold:
                alerts.append({
                    "rule_id": self.rule_id,
                    "severity": self.default_severity,
                    "message": f"Mass filesystem activity detected: {len(modified_or_deleted)} file operations in single payload (possible ransomware behavior).",
                    "related_event_id": None,
                })
                return alerts

        # Check DB history within time window
        cutoff = datetime.utcnow() - timedelta(seconds=self.window_seconds)
        recent_fs_count = db.query(FSEventModel).filter(
            FSEventModel.agent_id == agent.id,
            FSEventModel.timestamp >= cutoff,
        ).count()

        if recent_fs_count >= self.burst_threshold:
            alerts.append({
                "rule_id": self.rule_id,
                "severity": self.default_severity,
                "message": f"Suspicious burst of {recent_fs_count} file events on {agent.hostname} in past {self.window_seconds}s.",
                "related_event_id": None,
            })

        return alerts


class SuspiciousPathProcessRule(BaseThreatRule):
    """Detects processes executed from temporary or unusual directory locations."""

    rule_id = "PROC_SUSPICIOUS_PATH"
    name = "Process Spawned from Suspicious Location"
    default_severity = "warning"

    def evaluate(self, db: Session, agent: AgentModel, payload: Dict[str, Any]) -> List[Dict[str, Any]]:
        alerts = []
        process_events = payload.get("process_events", [])

        for proc in process_events:
            exe_path = (proc.get("exe_path") or "").lower()
            cmdline = (proc.get("cmdline") or "").lower()
            
            for sus_path in SUSPICIOUS_PATHS:
                if sus_path in exe_path or sus_path in cmdline:
                    alerts.append({
                        "rule_id": self.rule_id,
                        "severity": self.default_severity,
                        "message": f"Process '{proc.get('name')}' (PID {proc.get('pid')}) executed from temporary/unusual directory: {exe_path or cmdline}",
                        "related_event_id": proc.get("db_id"),
                    })
                    break
        return alerts


class SustainedResourceSpikeRule(BaseThreatRule):
    """
    Detects sustained high CPU or memory utilization across multiple consecutive readings over a rolling window.
    NOTE: window_minutes defaults to 10 to comfortably fit min_snapshots=3 even if agent reporting cadence slows to 60-90s.
    """

    rule_id = "RESOURCE_SUSTAINED_SPIKE"
    name = "Sustained Resource Spike"
    default_severity = "warning"

    def __init__(self, cpu_threshold: float = 90.0, mem_threshold: float = 90.0, min_snapshots: int = 3, window_minutes: int = 10):
        self.cpu_threshold = cpu_threshold
        self.mem_threshold = mem_threshold
        self.min_snapshots = min_snapshots
        self.window_minutes = window_minutes

    def evaluate(self, db: Session, agent: AgentModel, payload: Dict[str, Any]) -> List[Dict[str, Any]]:
        alerts = []
        metrics = payload.get("metrics")
        if not metrics:
            return alerts

        # Query recent snapshots for this agent within the rolling window
        cutoff = datetime.utcnow() - timedelta(minutes=self.window_minutes)
        recent_snapshots = (
            db.query(MetricsSnapshotModel)
            .filter(
                MetricsSnapshotModel.agent_id == agent.id,
                MetricsSnapshotModel.timestamp >= cutoff,
            )
            .order_by(MetricsSnapshotModel.timestamp.desc())
            .limit(self.min_snapshots)
            .all()
        )

        # Must have at least min_snapshots readings to prove sustained elevation
        if len(recent_snapshots) < self.min_snapshots:
            return alerts

        # Check if all recent consecutive snapshots exceed CPU threshold
        cpu_sustained = all(s.cpu_percent >= self.cpu_threshold for s in recent_snapshots)
        mem_sustained = all(s.mem_percent >= self.mem_threshold for s in recent_snapshots)

        avg_cpu = sum(s.cpu_percent for s in recent_snapshots) / len(recent_snapshots)
        avg_mem = sum(s.mem_percent for s in recent_snapshots) / len(recent_snapshots)

        if cpu_sustained:
            alerts.append({
                "rule_id": self.rule_id,
                "severity": "warning" if avg_cpu < 95.0 else "critical",
                "message": f"Sustained high CPU utilization on {agent.hostname}: avg {avg_cpu:.1f}% across last {len(recent_snapshots)} snapshots.",
                "related_event_id": None,
            })
        if mem_sustained:
            alerts.append({
                "rule_id": self.rule_id,
                "severity": "warning" if avg_mem < 95.0 else "critical",
                "message": f"Sustained high memory utilization on {agent.hostname}: avg {avg_mem:.1f}% across last {len(recent_snapshots)} snapshots.",
                "related_event_id": None,
            })

        return alerts


class ElevatedProcessRule(BaseThreatRule):
    """Detects new processes running with elevated system user privileges."""

    rule_id = "PROC_ELEVATED_PRIVILEGES"
    name = "New Process with Elevated Privileges"
    default_severity = "info"

    def evaluate(self, db: Session, agent: AgentModel, payload: Dict[str, Any]) -> List[Dict[str, Any]]:
        alerts = []
        process_events = payload.get("process_events", [])

        for proc in process_events:
            user = (proc.get("user") or "").lower()
            if proc.get("event_type") == "start" and any(elevated in user for elevated in ELEVATED_USERS):
                alerts.append({
                    "rule_id": self.rule_id,
                    "severity": self.default_severity,
                    "message": f"Elevated process '{proc.get('name')}' (PID {proc.get('pid')}) started by user '{proc.get('user')}' on {agent.hostname}.",
                    "related_event_id": proc.get("db_id"),
                })
        return alerts


class USBStorageMountRule(BaseThreatRule):
    """Detects connection of removable USB storage devices from typed usb_events table data."""

    rule_id = "USB_REMOVABLE_STORAGE_MOUNT"
    name = "Removable USB Storage Drive Connected"
    default_severity = "warning"

    def evaluate(self, db: Session, agent: AgentModel, payload: Dict[str, Any]) -> List[Dict[str, Any]]:
        alerts = []
        # Check typed usb_events
        usb_events = payload.get("usb_events", [])
        for ev in usb_events:
            action = ev.get("action") if isinstance(ev, dict) else getattr(ev, "action", None)
            if action == "connected":
                dev_name = ev.get("device_name") if isinstance(ev, dict) else getattr(ev, "device_name", "USB Device")
                mount_pt = ev.get("mount_point") if isinstance(ev, dict) else getattr(ev, "mount_point", "Unknown Mount")
                alerts.append({
                    "rule_id": self.rule_id,
                    "severity": self.default_severity,
                    "message": f"Removable USB drive '{dev_name}' mounted at '{mount_pt}' on host {agent.hostname}.",
                    "related_event_id": ev.get("db_id") if isinstance(ev, dict) else None,
                })
        # Check raw_events fallback
        raw_events = payload.get("raw_events", [])
        for ev in raw_events:
            if ev.get("event_type") == "usb":
                meta = ev.get("metadata", {})
                if meta.get("action") == "connected":
                    dev_name = meta.get("device_name", "USB Device")
                    mount_pt = meta.get("mount_point", "Unknown Mount")
                    alerts.append({
                        "rule_id": self.rule_id,
                        "severity": self.default_severity,
                        "message": f"Removable USB drive '{dev_name}' mounted at '{mount_pt}' on host {agent.hostname}.",
                        "related_event_id": None,
                    })
        return alerts


class ThreatEngine:
    """Pluggable threat engine that evaluates registered rules against agent telemetry."""

    def __init__(self):
        self.rules: List[BaseThreatRule] = [
            FSRapidBurstRule(),
            SuspiciousPathProcessRule(),
            SustainedResourceSpikeRule(),
            ElevatedProcessRule(),
            USBStorageMountRule(),
        ]

    def register_rule(self, rule: BaseThreatRule):
        """Add a custom pluggable rule to the threat engine."""
        self.rules.append(rule)

    def evaluate_payload(self, db: Session, agent: AgentModel, payload: Dict[str, Any]) -> List[AlertModel]:
        """Evaluate all rules on an incoming telemetry payload and persist created alerts."""
        created_alerts = []
        for rule in self.rules:
            try:
                rule_alerts = rule.evaluate(db, agent, payload)
                for a in rule_alerts:
                    alert_entry = AlertModel(
                        agent_id=agent.id,
                        device_id=agent.id,
                        user_id=agent.hostname,
                        severity=a["severity"],
                        rule_id=a["rule_id"],
                        message=a["message"],
                        related_event_id=a.get("related_event_id"),
                        acknowledged=False,
                        status="ACTIVE",
                    )
                    db.add(alert_entry)
                    created_alerts.append(alert_entry)
                    logger.warning(
                        "Threat alert triggered: rule={}, agent_id={}, hostname={}, severity={}, message='{}'",
                        a["rule_id"],
                        agent.id,
                        agent.hostname,
                        a["severity"],
                        a["message"],
                    )
            except Exception as e:
                # Pluggable rule isolation: rule failure shouldn't crash ingestion
                logger.error("Threat engine rule {} failed on agent {}: {}", rule.rule_id, agent.id, e)

        if created_alerts:
            db.commit()

            # Find organization owner to send high-severity threat notification email
            try:
                org = db.query(OrganizationModel).filter(OrganizationModel.id == agent.org_id).first()
                if org and org.owner_user_id:
                    owner = db.query(UserModel).filter(UserModel.id == org.owner_user_id).first()
                    if owner and owner.email:
                        for alert in created_alerts:
                            sev = alert.severity.upper()
                            if sev in ("CRITICAL", "HIGH", "WARNING"):
                                send_high_threat_alert_email(
                                    admin_email=owner.email,
                                    org_name=org.name,
                                    device_name=agent.device_name or agent.hostname,
                                    hostname=agent.hostname,
                                    severity=alert.severity,
                                    rule_id=alert.rule_id or "THREAT_RULE",
                                    risk_score=alert.risk_score or 0.85,
                                    message=alert.message,
                                    alert_time=alert.timestamp.strftime("%Y-%m-%d %H:%M:%S UTC"),
                                )
            except Exception as e:
                logger.error("Failed to process email alerts for agent {}: {}", agent.id, e)

        return created_alerts
