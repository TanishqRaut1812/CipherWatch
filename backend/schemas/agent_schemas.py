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


class AgentIngestionPayload(BaseModel):
    metrics: Optional[MetricsSnapshotSchema] = None
    process_events: List[ProcessEventSchema] = []
    fs_events: List[FSEventSchema] = []


class AgentIngestionResponse(BaseModel):
    status: str = "success"
    agent_id: str
    metrics_ingested: int
    process_events_ingested: int
    fs_events_ingested: int
    alerts_triggered: int


class AgentEnrollRequest(BaseModel):
    organization_id: str = Field(..., min_length=1, max_length=64)
    enrollment_key: str = Field(..., min_length=1, max_length=64)
    hostname: str = Field(..., min_length=1, max_length=128)
    device_uuid: Optional[str] = Field(None, max_length=64)
    os: str = Field(..., min_length=1, max_length=64)
    agent_version: str = Field(..., min_length=1, max_length=32)


class AgentEnrollResponse(BaseModel):
    agent_id: str
    auth_token: str
    backend_url: str
    heartbeat_interval: int = 30
