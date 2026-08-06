from datetime import datetime
from enum import Enum
from typing import Any, Dict, Optional
from uuid import uuid4
from pydantic import BaseModel, Field


class EventType(str, Enum):
    """Supported metadata event categories."""

    FILESYSTEM = "filesystem"
    USB = "usb"
    NETWORK = "network"
    PROCESS = "process"
    SCREENSHOT_EVENT = "screenshot_event"
    CLIPBOARD_BURST = "clipboard_burst"


class FilesystemMetadata(BaseModel):
    """Metadata for filesystem operations. STRICTLY NO FILE CONTENTS."""

    action: str = Field(..., description="created, modified, deleted, renamed, archived")
    extension: Optional[str] = Field(None, description="File extension (e.g. .zip, .pdf)")
    file_size_bytes: int = Field(0, ge=0, description="Size of file in bytes")
    is_encrypted_archive: bool = Field(False, description="Flag if file is an encrypted archive")
    folder_category: str = Field("General", description="Folder sensitivity tier (e.g. Finance, HR, SourceCode, Downloads)")


class USBMetadata(BaseModel):
    """Metadata for USB hardware events."""

    action: str = Field(..., description="connected, disconnected, transfer")
    vendor_id: Optional[str] = Field(None, description="USB Vendor ID")
    product_id: Optional[str] = Field(None, description="USB Product ID")
    device_name: Optional[str] = Field(None, description="Human readable device label")
    mount_point: Optional[str] = Field(None, description="Mount directory (e.g. /media/usb0)")


class NetworkMetadata(BaseModel):
    """Metadata for network activity. STRICTLY NO PAYLOAD/BODY CONTENT."""

    destination_host: str = Field(..., description="Target hostname or IP")
    destination_port: int = Field(..., ge=1, le=65535)
    destination_category: str = Field("unrecognized", description="enterprise_cloud, personal_cloud, personal_webmail, unrecognized")
    bytes_sent: int = Field(0, ge=0)
    bytes_received: int = Field(0, ge=0)


class ProcessMetadata(BaseModel):
    """Metadata for executing processes."""

    process_name: str = Field(..., description="Executable binary name")
    pid: int = Field(...)
    category: str = Field("general", description="sync_app, compression_tool, mail_client, browser, general")


class ScreenshotEventMetadata(BaseModel):
    """Metadata flag for screen capture occurrence. STRICTLY NO PIXEL/IMAGE DATA."""

    triggered_by_process: Optional[str] = Field(None, description="Process capturing screen")
    capture_count: int = Field(1, ge=1)


class ClipboardBurstMetadata(BaseModel):
    """Metadata flag for high-frequency clipboard copies. STRICTLY NO COPIED TEXT CONTENT."""

    copy_count: int = Field(..., ge=1, description="Number of copy operations in burst window")
    source_process: Optional[str] = Field(None, description="Process clipboard was copied from")


class EventCreate(BaseModel):
    """Privacy-compliant event ingestion payload schema."""

    event_id: str = Field(default_factory=lambda: str(uuid4()))
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    user_id: str = Field(..., min_length=1)
    device_id: str = Field(..., min_length=1)
    event_type: EventType
    metadata: Dict[str, Any] = Field(..., description="Metadata key-value mapping")


class EventResponse(EventCreate):
    """Database representation of ingested metadata event."""

    id: Optional[int] = None
    session_id: Optional[int] = None

    class Config:
        from_attributes = True

