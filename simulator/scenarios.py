from datetime import datetime, timedelta
import uuid
from typing import List, Dict, Any


def get_scenario_normal_day(user_id: str = "usr_alice", device_id: str = "MAC-DEV-01") -> List[Dict[str, Any]]:
    """
    Scenario A: Routine Developer Day
    Expected Outcome: Low risk score (< 0.25), intent classified as 'Routine Workspace Activity'.
    """
    base_time = datetime.utcnow()
    return [
        {
            "event_id": str(uuid.uuid4()),
            "timestamp": (base_time - timedelta(minutes=60)).isoformat(),
            "user_id": user_id,
            "device_id": device_id,
            "event_type": "filesystem",
            "metadata": {
                "action": "modified",
                "extension": ".py",
                "file_size_bytes": 4096,
                "is_encrypted_archive": False,
                "folder_category": "SourceCode",
            },
        },
        {
            "event_id": str(uuid.uuid4()),
            "timestamp": (base_time - timedelta(minutes=45)).isoformat(),
            "user_id": user_id,
            "device_id": device_id,
            "event_type": "network",
            "metadata": {
                "destination_host": "github.com",
                "destination_port": 443,
                "destination_category": "enterprise_cloud",
                "bytes_sent": 2048,
                "bytes_received": 10240,
            },
        },
        {
            "event_id": str(uuid.uuid4()),
            "timestamp": (base_time - timedelta(minutes=30)).isoformat(),
            "user_id": user_id,
            "device_id": device_id,
            "event_type": "filesystem",
            "metadata": {
                "action": "modified",
                "extension": ".md",
                "file_size_bytes": 1024,
                "is_encrypted_archive": False,
                "folder_category": "General",
            },
        },
        {
            "event_id": str(uuid.uuid4()),
            "timestamp": (base_time - timedelta(minutes=10)).isoformat(),
            "user_id": user_id,
            "device_id": device_id,
            "event_type": "process",
            "metadata": {
                "process_name": "vscode",
                "pid": 1420,
                "category": "general",
            },
        },
    ]


def get_scenario_bulk_exfiltration(user_id: str = "usr_eve", device_id: str = "WIN-FINANCE-02") -> List[Dict[str, Any]]:
    """
    Scenario B: Mass USB & Cloud Exfiltration Burst
    Expected Outcome: High risk score (> 0.85), intent classified as 'Exfiltration Staging'.
    """
    base_time = datetime.utcnow()
    return [
        {
            "event_id": str(uuid.uuid4()),
            "timestamp": (base_time - timedelta(minutes=15)).isoformat(),
            "user_id": user_id,
            "device_id": device_id,
            "event_type": "usb",
            "metadata": {
                "action": "connected",
                "vendor_id": "0x0781",
                "product_id": "0x5581",
                "device_name": "SanDisk Ultra",
                "mount_point": "/Volumes/EXT_DRIVE_EXFIL",
            },
        },
        {
            "event_id": str(uuid.uuid4()),
            "timestamp": (base_time - timedelta(minutes=12)).isoformat(),
            "user_id": user_id,
            "device_id": device_id,
            "event_type": "filesystem",
            "metadata": {
                "action": "archived",
                "extension": ".7z",
                "file_size_bytes": 157286400,
                "is_encrypted_archive": True,
                "folder_category": "Finance",
            },
        },
        {
            "event_id": str(uuid.uuid4()),
            "timestamp": (base_time - timedelta(minutes=8)).isoformat(),
            "user_id": user_id,
            "device_id": device_id,
            "event_type": "network",
            "metadata": {
                "destination_host": "anonfiles.com",
                "destination_port": 443,
                "destination_category": "unrecognized",
                "bytes_sent": 157286400,
                "bytes_received": 512,
            },
        },
        {
            "event_id": str(uuid.uuid4()),
            "timestamp": (base_time - timedelta(minutes=2)).isoformat(),
            "user_id": user_id,
            "device_id": device_id,
            "event_type": "clipboard_burst",
            "metadata": {
                "copy_count": 45,
                "source_process": "excel.exe",
            },
        },
    ]


def get_scenario_slow_drip(user_id: str = "usr_mallory", device_id: str = "LINUX-OPS-03") -> List[Dict[str, Any]]:
    """
    Scenario C: Slow-Drip Low-and-Slow Exfiltration
    Expected Outcome: Elevated risk score via Longitudinal Tracker & Graph engine.
    """
    base_time = datetime.utcnow()
    events = []
    for i in range(8):
        events.append({
            "event_id": str(uuid.uuid4()),
            "timestamp": (base_time - timedelta(hours=8 - i)).isoformat(),
            "user_id": user_id,
            "device_id": device_id,
            "event_type": "filesystem",
            "metadata": {
                "action": "archived",
                "extension": ".tar.gz",
                "file_size_bytes": 10485760,
                "is_encrypted_archive": True,
                "folder_category": "HR",
            },
        })
    return events
