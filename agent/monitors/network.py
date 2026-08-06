import time
import threading
from typing import Callable, Optional, Set
import psutil

from agent.monitors.base import BaseMonitor
from shared.schemas import EventCreate, EventType, NetworkMetadata


class NetworkMonitor(BaseMonitor):
    """Network connection monitor recording connection endpoints only. ZERO packet content inspection."""

    def __init__(
        self,
        poll_interval: float = 3.0,
        user_id: str = "user-local-01",
        device_id: str = "dev-local-01",
        callback: Optional[Callable[[EventCreate], None]] = None,
    ):
        super().__init__(callback=callback)
        self.poll_interval = poll_interval
        self.user_id = user_id
        self.device_id = device_id
        self._thread: Optional[threading.Thread] = None
        self._seen_connections: Set[str] = set()

    @staticmethod
    def classify_destination(host: str, port: int) -> str:
        """Classify network connection into endpoint category."""
        host_lower = host.lower()
        if any(cloud in host_lower for cloud in ["dropbox", "drive.google", "onedrive", "mega.nz", "box.com"]):
            return "CloudStorage"
        elif any(mail in host_lower for mail in ["gmail", "mail.yahoo", "outlook.live", "proton.me"]):
            return "PersonalWebmail"
        elif any(msg in host_lower for msg in ["telegram", "discord", "whatsapp", "slack"]):
            return "Messaging"
        elif port in (443, 80):
            return "WebHTTPS"
        return "General"

    def _monitor_loop(self) -> None:
        """Poll active network connections."""
        while self.is_running:
            time.sleep(self.poll_interval)
            try:
                conns = psutil.net_connections(kind="inet")
                current_seen = set()

                for conn in conns:
                    if conn.status == "ESTABLISHED" and conn.raddr:
                        ip = conn.raddr.ip
                        port = conn.raddr.port
                        conn_key = f"{ip}:{port}"
                        current_seen.add(conn_key)

                        if conn_key not in self._seen_connections:
                            category = self.classify_destination(ip, port)

                            metadata = NetworkMetadata(
                                destination_host=ip,
                                destination_port=port,
                                destination_category=category,
                                bytes_sent=1024,
                                bytes_received=1024,
                            )

                            event = EventCreate(
                                user_id=self.user_id,
                                device_id=self.device_id,
                                event_type=EventType.NETWORK,
                                metadata=metadata.model_dump(),
                            )
                            self.emit_event(event)

                self._seen_connections = current_seen
            except Exception:
                pass

    def start(self) -> None:
        if self.is_running:
            return
        self.is_running = True
        self._thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self.is_running = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=1.0)
