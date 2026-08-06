from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class AgentRegisterRequest(BaseModel):
    hostname: str = Field(..., min_length=1, max_length=128)
    os: str = Field(..., min_length=1, max_length=64)
    ip: str = Field(..., min_length=1, max_length=45)
    agent_version: str = Field(..., min_length=1, max_length=32)
    org_id: str = Field(..., min_length=1, max_length=64, description="Organization ID to register agent under")
    registration_key: str = Field(..., min_length=1, max_length=64, description="Organization registration key")


class AgentRegisterResponse(BaseModel):
    agent_id: str
    auth_token: str
    message: str = "Agent registered successfully."


class HeartbeatResponse(BaseModel):
    status: str = "ok"
    agent_id: str
    last_seen_at: datetime


class MetricsSnapshotSchema(BaseModel):
    timestamp: Optional[datetime] = None
    cpu_percent: float = Field(0.0, ge=0.0, le=100.0)
    mem_percent: float = Field(0.0, ge=0.0, le=100.0)
    disk_percent: float = Field(0.0, ge=0.0, le=100.0)
    net_bytes_sent: int = Field(0, ge=0)
    net_bytes_recv: int = Field(0, ge=0)
    process_count: int = Field(0, ge=0)


class ProcessEventSchema(BaseModel):
    timestamp: Optional[datetime] = None
    event_type: str = Field(..., description="start, stop, or snapshot")
    pid: int
    name: str
    exe_path: Optional[str] = None
    cmdline: Optional[str] = None
    user: Optional[str] = None
    cpu_percent: float = Field(0.0, ge=0.0)
    mem_rss: int = Field(0, ge=0)


class FSEventSchema(BaseModel):
    timestamp: Optional[datetime] = None
    event_type: str = Field(..., description="created, modified, deleted, or moved")
    src_path: str
    dest_path: Optional[str] = None
    is_directory: bool = False


class USBEventSchema(BaseModel):
    timestamp: Optional[datetime] = None
    action: str = Field(..., description="connected, disconnected, or transfer")
    vendor_id: Optional[str] = None
    product_id: Optional[str] = None
    device_name: Optional[str] = None
    mount_point: Optional[str] = None


class AgentIngestionPayload(BaseModel):
    metrics: Optional[MetricsSnapshotSchema] = None
    process_events: List[ProcessEventSchema] = []
    fs_events: List[FSEventSchema] = []
    usb_events: List[USBEventSchema] = []
    # raw_events: Intentional escape hatch for future un-typed or ad-hoc metadata events. Not default pattern.
    raw_events: List[Dict[str, Any]] = []


class AgentIngestionResponse(BaseModel):
    status: str = "success"
    agent_id: str
    metrics_ingested: int
    process_events_ingested: int
    fs_events_ingested: int
    usb_events_ingested: int = 0
    alerts_triggered: int


class AgentEnrollRequest(BaseModel):
    org_id: Optional[str] = Field(None, min_length=1, max_length=64)
    organization_id: Optional[str] = Field(None, min_length=1, max_length=64)
    enrollment_key: str = Field(..., min_length=1, max_length=64)
    hostname: str = Field(..., min_length=1, max_length=128)
    device_name: Optional[str] = Field(None, max_length=128)
    username: Optional[str] = Field(None, max_length=128)
    os: str = Field(..., min_length=1, max_length=64)
    os_version: Optional[str] = Field(None, max_length=64)
    architecture: Optional[str] = Field(None, max_length=64)
    machine_id: str = Field(..., min_length=1, max_length=128)
    agent_version: str = Field(..., min_length=1, max_length=32)
    device_uuid: Optional[str] = Field(None, max_length=64)


class AgentEnrollResponse(BaseModel):
    agent_id: str
    auth_token: str
    organization_id: Optional[str] = None
    backend_url: str = "http://localhost:8000"
    heartbeat_interval: int = 30


class AgentConfigResponse(BaseModel):
    organization_id: str
    agent_id: str
    machine_id: str
    watch_scope: str = "targeted"
    watch_exclude_dirs: List[str] = []
    poll_interval: float = 5.0
    heartbeat_interval: int = 30
    policy: Dict[str, Any] = {}

