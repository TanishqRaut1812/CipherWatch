from datetime import datetime
import json
import secrets
from typing import Any, Dict, List
import uuid
from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    TypeDecorator,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from backend.db.base import Base


class JSONEncodedDict(TypeDecorator):
    """Represents an immutable structure as a json-encoded string in SQLite."""

    impl = Text

    def process_bind_param(self, value: Any, dialect: Any) -> Any:
        if value is not None:
            return json.dumps(value)
        return None

    def process_result_value(self, value: Any, dialect: Any) -> Any:
        if value is not None:
            return json.loads(value)
        return None


class UserModel(Base):
    """User account for dashboard access and organization membership."""

    __tablename__ = "users"

    id = Column(String(64), primary_key=True, default=lambda: uuid.uuid4().hex)
    email = Column(String(256), unique=True, nullable=False, index=True)
    username = Column(String(64), unique=True, nullable=False, index=True)
    password_hash = Column(String(256), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    memberships = relationship("UserOrganizationModel", back_populates="user", cascade="all, delete-orphan")


class OrganizationModel(Base):
    """Tenant organization that owns agents and scopes all telemetry."""

    __tablename__ = "organizations"

    id = Column(String(64), primary_key=True, default=lambda: f"org_{uuid.uuid4().hex[:12]}")
    name = Column(String(128), nullable=False)
    organization_id = Column(String(64), unique=True, nullable=False, index=True, default=lambda: str(uuid.uuid4()))
    enrollment_key = Column(String(64), unique=True, nullable=False, index=True, default=lambda: f"cwek_{secrets.token_urlsafe(32)}")
    registration_key = Column(String(64), unique=True, nullable=False, index=True, default=lambda: f"cwrk_{secrets.token_hex(16)}")
    owner_user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    members = relationship("UserOrganizationModel", back_populates="organization", cascade="all, delete-orphan")
    agents = relationship("AgentModel", back_populates="organization", cascade="all, delete-orphan")


class UserOrganizationModel(Base):
    """Join table for user-organization membership. Supports future team invites."""

    __tablename__ = "user_organizations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(64), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    org_id = Column(String(64), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(32), default="owner", nullable=False)

    __table_args__ = (UniqueConstraint("user_id", "org_id", name="uq_user_org"),)

    user = relationship("UserModel", back_populates="memberships")
    organization = relationship("OrganizationModel", back_populates="members")


class AgentModel(Base):
    """SQLAlchemy model for enrolled endpoint agents."""

    __tablename__ = "agents"

    id = Column(String(64), primary_key=True, index=True)
    org_id = Column(String(64), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    hostname = Column(String(128), nullable=False)
    device_uuid = Column(String(64), nullable=True)
    os = Column(String(64), nullable=False)
    ip = Column(String(45), nullable=False)
    agent_version = Column(String(32), nullable=False)
    auth_token_hash = Column(String(256), nullable=False, unique=True, index=True)
    enrolled_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    last_seen_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    organization = relationship("OrganizationModel", back_populates="agents")
    metrics = relationship("MetricsSnapshotModel", back_populates="agent", cascade="all, delete-orphan")
    process_events = relationship("ProcessEventModel", back_populates="agent", cascade="all, delete-orphan")
    fs_events = relationship("FSEventModel", back_populates="agent", cascade="all, delete-orphan")
    alerts = relationship("AlertModel", back_populates="agent", cascade="all, delete-orphan")

    def get_status(self, threshold_seconds: int = 90) -> str:
        """Compute agent status dynamically based on last_seen_at."""
        if not self.last_seen_at:
            return "offline"
        delta = (datetime.utcnow() - self.last_seen_at).total_seconds()
        return "online" if delta <= threshold_seconds else "offline"


class MetricsSnapshotModel(Base):
    """SQLAlchemy model for agent system resource snapshots."""

    __tablename__ = "metrics_snapshots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    agent_id = Column(String(64), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    cpu_percent = Column(Float, nullable=False, default=0.0)
    mem_percent = Column(Float, nullable=False, default=0.0)
    disk_percent = Column(Float, nullable=False, default=0.0)
    net_bytes_sent = Column(BigInteger, nullable=False, default=0)
    net_bytes_recv = Column(BigInteger, nullable=False, default=0)
    process_count = Column(Integer, nullable=False, default=0)

    __table_args__ = (Index("idx_metrics_agent_ts", "agent_id", "timestamp"),)

    agent = relationship("AgentModel", back_populates="metrics")


class ProcessEventModel(Base):
    """SQLAlchemy model for agent process lifecycle events and snapshot dumps."""

    __tablename__ = "process_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    agent_id = Column(String(64), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    event_type = Column(String(16), nullable=False)  # start | stop | snapshot
    pid = Column(Integer, nullable=False)
    name = Column(String(128), nullable=False)
    exe_path = Column(String(512), nullable=True)
    cmdline = Column(Text, nullable=True)
    user = Column(String(64), nullable=True)
    cpu_percent = Column(Float, default=0.0)
    mem_rss = Column(BigInteger, default=0)

    __table_args__ = (Index("idx_process_events_agent_ts", "agent_id", "timestamp"),)

    agent = relationship("AgentModel", back_populates="process_events")


class FSEventModel(Base):
    """SQLAlchemy model for agent filesystem watchdog events."""

    __tablename__ = "fs_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    agent_id = Column(String(64), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    event_type = Column(String(16), nullable=False)  # created | modified | deleted | moved
    src_path = Column(String(512), nullable=False)
    dest_path = Column(String(512), nullable=True)
    is_directory = Column(Boolean, default=False)

    __table_args__ = (Index("idx_fs_events_agent_ts", "agent_id", "timestamp"),)

    agent = relationship("AgentModel", back_populates="fs_events")


class EventModel(Base):
    """SQLAlchemy model for raw privacy-compliant metadata events."""

    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    event_id = Column(String(36), unique=True, index=True, nullable=False)
    org_id = Column(String(64), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True)
    agent_id = Column(String(64), ForeignKey("agents.id", ondelete="CASCADE"), nullable=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True, nullable=False)
    user_id = Column(String(64), index=True, nullable=False)
    device_id = Column(String(64), nullable=False)
    event_type = Column(String(32), index=True, nullable=False)
    event_metadata = Column(JSONEncodedDict, nullable=False, default={})
    
    session_id = Column(Integer, ForeignKey("sessions.id", ondelete="SET NULL"), nullable=True)
    session = relationship("SessionModel", back_populates="events")


class SessionModel(Base):
    """SQLAlchemy model for correlated user activity sessions."""

    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    session_uuid = Column(String(36), unique=True, index=True, nullable=False, default=lambda: str(uuid.uuid4()))
    org_id = Column(String(64), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True)
    agent_id = Column(String(64), ForeignKey("agents.id", ondelete="CASCADE"), nullable=True, index=True)
    user_id = Column(String(64), index=True, nullable=False)
    device_id = Column(String(64), nullable=False, default="unknown_device")
    start_time = Column(DateTime, default=datetime.utcnow, nullable=False)
    end_time = Column(DateTime, default=datetime.utcnow, nullable=False)
    event_count = Column(Integer, default=0, nullable=False)
    reconstructed_intent = Column(String(128), nullable=True)
    risk_score = Column(Float, default=0.0, nullable=False)
    status = Column(String(32), default="active", nullable=False)
    is_closed = Column(Boolean, default=False, nullable=False)

    events = relationship("EventModel", back_populates="session", cascade="all, delete-orphan")
    anomaly_score = relationship("AnomalyScoreModel", back_populates="session", uselist=False, cascade="all, delete-orphan")
    incident = relationship("IncidentModel", back_populates="session", uselist=False, cascade="all, delete-orphan")


class AnomalyScoreModel(Base):
    """SQLAlchemy model for hybrid anomaly risk score breakdowns."""

    __tablename__ = "anomaly_scores"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("sessions.id", ondelete="CASCADE"), unique=True, nullable=False)
    isolation_forest_score = Column(Float, default=0.0, nullable=False)
    rule_bonus_score = Column(Float, default=0.0, nullable=False)
    z_score_deviation = Column(Float, default=0.0, nullable=False)
    graph_pattern_score = Column(Float, default=0.0, nullable=False)
    final_score = Column(Float, default=0.0, nullable=False)
    breakdown_json = Column(JSONEncodedDict, nullable=False, default={})

    session = relationship("SessionModel", back_populates="anomaly_score")


class IncidentModel(Base):
    """SQLAlchemy model for SOC analyst explainable security incidents."""

    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("sessions.id", ondelete="CASCADE"), unique=True, nullable=False)
    title = Column(String(256), nullable=False)
    severity = Column(String(32), default="LOW", nullable=False)
    llm_explanation = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    session = relationship("SessionModel", back_populates="incident")


class AlertModel(Base):
    """SQLAlchemy model for security and agent telemetry alerts."""

    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    agent_id = Column(String(64), ForeignKey("agents.id", ondelete="CASCADE"), nullable=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=True)
    user_id = Column(String(64), index=True, nullable=True)
    device_id = Column(String(64), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    risk_score = Column(Float, default=0.0, nullable=False)
    severity = Column(String(32), default="warning", nullable=False)  # info | warning | critical
    rule_id = Column(String(64), nullable=True)
    message = Column(String(512), nullable=False)
    related_event_id = Column(Integer, nullable=True)
    status = Column(String(32), default="ACTIVE", nullable=False)
    acknowledged = Column(Boolean, default=False, nullable=False)
    analyst_feedback = Column(String(32), default="UNREVIEWED", nullable=False)
    feedback_comments = Column(Text, nullable=True)

    __table_args__ = (Index("idx_alerts_agent_ts", "agent_id", "timestamp"),)

    agent = relationship("AgentModel", back_populates="alerts")


class UserBaselineModel(Base):
    """SQLAlchemy model for storing user activity baseline statistics and feedback adjustments."""

    __tablename__ = "user_baselines"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(String(64), unique=True, index=True, nullable=False)
    mean_events_per_session = Column(Float, default=10.0, nullable=False)
    std_events_per_session = Column(Float, default=3.0, nullable=False)
    false_positive_count = Column(Integer, default=0, nullable=False)
    confirmed_threat_count = Column(Integer, default=0, nullable=False)
    risk_tolerance_factor = Column(Float, default=1.0, nullable=False)  # Multiplier (< 1.0 reduces future risk scores)
    updated_at = Column(DateTime, default=datetime.utcnow, nullable=False)




