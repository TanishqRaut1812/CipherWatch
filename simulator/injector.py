import time
import requests
import logging
from typing import List, Dict, Any, Optional

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("cipherwatch.simulator")

DEFAULT_BACKEND_URL = "http://localhost:8000"


class EventInjector:
    """
    HTTP event injector utility that transmits privacy-compliant metadata event sequences
    directly into the CipherWatch backend ingestion pipeline, simulating agent activities.
    """

    def __init__(self, api_url: str = DEFAULT_BACKEND_URL, backend_url: Optional[str] = None):
        target = backend_url or api_url
        self.backend_url = target.rstrip("/")
        self.agent_id: Optional[str] = None
        self.auth_token: Optional[str] = None

    def _ensure_enrolled(self) -> bool:
        """Enroll simulator agent with the backend using seed organization credentials."""
        if self.agent_id and self.auth_token:
            return True

        enroll_url = f"{self.backend_url}/api/agent/enroll"
        candidates = [
            ("org-default-uuid", "cwek_defaultkey1234567890123456789012345"),
            ("default_org", "cwek_defaultkey1234567890123456789012345"),
            ("default_org", "cwrk_defaultkey1234567890123456"),
        ]
        for org_id, key in candidates:
            payload = {
                "organization_id": org_id,
                "enrollment_key": key,
                "device_uuid": "sim-device-001",
                "hostname": "simulator-workstation",
                "os": "Linux",
                "agent_version": "1.0.0",
            }
            try:
                res = requests.post(enroll_url, json=payload, timeout=5)
                if res.status_code == 201:
                    data = res.json()
                    self.agent_id = data["agent_id"]
                    self.auth_token = data["auth_token"]
                    logger.info(f"Simulator enrolled agent successfully: agent_id={self.agent_id}")
                    return True
            except Exception as e:
                logger.error(f"Simulator failed to connect for enrollment: {e}")
                return False

        logger.error("Simulator enrollment failed with all candidate credentials.")
        return False

    def inject_sequence(self, event_list: List[Dict[str, Any]], delay_sec: float = 0.5) -> List[Dict[str, Any]]:
        """Group events into an AgentIngestionPayload and post to the agent telemetry endpoint."""
        if not self._ensure_enrolled():
            logger.error("Aborting injection: Agent not enrolled.")
            return []

        ingest_url = f"{self.backend_url}/api/agents/{self.agent_id}/events"
        headers = {"Authorization": f"Bearer {self.auth_token}"}

        # Transform scenario events into AgentIngestionPayload format
        metrics = {
            "cpu_percent": 45.0,
            "mem_percent": 60.0,
            "disk_percent": 50.0,
            "net_bytes_sent": 1048576,
            "net_bytes_recv": 2097152,
            "process_count": 110,
        }
        process_events = []
        fs_events = []
        usb_events = []
        raw_events = []

        for ev in event_list:
            ev_type = ev.get("event_type")
            meta = ev.get("metadata", {})
            ts = ev.get("timestamp")

            if ev_type == "usb":
                usb_events.append({
                    "timestamp": ts,
                    "action": meta.get("action", "connected"),
                    "vendor_id": meta.get("vendor_id", "0x0000"),
                    "product_id": meta.get("product_id", "0x0000"),
                    "device_name": meta.get("device_name", "USB Storage"),
                    "mount_point": meta.get("mount_point", "/media/usb"),
                })
            elif ev_type == "filesystem":
                fs_events.append({
                    "timestamp": ts,
                    "event_type": meta.get("action", "modified"),
                    "src_path": f"/home/user/{meta.get('folder_category', 'General')}/sample{meta.get('extension', '.dat')}",
                    "is_directory": False,
                })
            elif ev_type == "process":
                process_events.append({
                    "timestamp": ts,
                    "event_type": "start",
                    "pid": meta.get("pid", 1000),
                    "name": meta.get("process_name", "app"),
                    "exe_path": f"/usr/bin/{meta.get('process_name', 'app')}",
                    "cmdline": meta.get("process_name", "app"),
                    "user": ev.get("user_id", "sim_user"),
                    "cpu_percent": 10.0,
                    "mem_rss": 50000000,
                })
            else:
                raw_events.append(ev)

        payload = {
            "metrics": metrics,
            "process_events": process_events,
            "fs_events": fs_events,
            "usb_events": usb_events,
            "raw_events": raw_events,
        }

        try:
            logger.info(f"Posting scenario telemetry payload ({len(event_list)} events) to agent ingestion API...")
            response = requests.post(ingest_url, json=payload, headers=headers, timeout=5)
            if response.status_code == 200:
                data = response.json()
                logger.info(f"Scenario injection success! Status: {data.get('status')}, Alerts triggered: {data.get('alerts_triggered')}")
                return [data]
            else:
                logger.error(f"Scenario injection failed: {response.status_code} - {response.text}")
                return []
        except Exception as e:
            logger.error(f"Unable to post scenario payload: {e}")
            return []
