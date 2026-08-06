import time
import threading
from typing import Callable, Optional, Set
import psutil

from agent.monitors.base import BaseMonitor
from shared.schemas import EventCreate, EventType, ProcessMetadata

CLOUD_SYNC_PROCESS_NAMES = {
    "dropbox", "dropbox.exe",
    "googledrivefs", "googledrivefs.exe", "gdrive",
    "onedrive", "onedrive.exe",
    "megasync", "megasync.exe",
    "nextcloud", "nextcloud.exe",
}

BROWSER_PROCESS_NAMES = {
    "chrome", "chrome.exe",
    "firefox", "firefox.exe",
    "msedge", "msedge.exe",
    "brave", "brave.exe",
    "safari",
}


class ProcessMonitor(BaseMonitor):
    """Process execution monitor observing process metadata only. ZERO memory inspection."""

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
        self._known_pids: Set[int] = set()

    @staticmethod
    def classify_process(name: str) -> tuple[bool, bool]:
        """Classify process into cloud sync or browser categories."""
        name_lower = name.lower()
        is_cloud = name_lower in CLOUD_SYNC_PROCESS_NAMES
        is_browser = name_lower in BROWSER_PROCESS_NAMES
        return is_cloud, is_browser

    def _monitor_loop(self) -> None:
        """Poll for new process creations."""
        try:
            self._known_pids = set(p.pid for p in psutil.process_iter(['pid']))
        except Exception:
            self._known_pids = set()

        while self.is_running:
            time.sleep(self.poll_interval)
            try:
                current_procs = {p.pid: p for p in psutil.process_iter(['pid', 'name', 'ppid'])}
                new_pids = set(current_procs.keys()) - self._known_pids

                for pid in new_pids:
                    proc = current_procs[pid]
                    try:
                        name = proc.info.get('name') or "unknown"
                        ppid = proc.info.get('ppid')
                        parent_name = "unknown"
                        if ppid:
                            try:
                                parent_name = psutil.Process(ppid).name()
                            except Exception:
                                pass

                        is_cloud, is_browser = self.classify_process(name)

                        category = "sync_app" if is_cloud else ("browser" if is_browser else "general")
                        metadata = ProcessMetadata(
                            process_name=name,
                            pid=pid,
                            category=category,
                        )

                        event = EventCreate(
                            user_id=self.user_id,
                            device_id=self.device_id,
                            event_type=EventType.PROCESS,
                            metadata=metadata.model_dump(),
                        )
                        self.emit_event(event)
                    except Exception:
                        continue

                self._known_pids = set(current_procs.keys())
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
