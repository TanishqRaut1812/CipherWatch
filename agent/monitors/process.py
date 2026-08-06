import time
import threading
from typing import Callable, Dict, Optional, Set, Any
import psutil

from agent.config import setup_logger
from agent.monitors.base import BaseMonitor
from shared.schemas import EventCreate, EventType, ProcessMetadata

agent_logger = setup_logger("cipherwatch-agent-proc")

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
        # Maps PID -> Dict of process details {'name': str, 'category': str, 'exe_path': str, 'cmdline': str}
        self._known_pids: Dict[int, Dict[str, Any]] = {}
        self._is_first_poll: bool = True

    @staticmethod
    def classify_process(name: str) -> tuple[bool, bool]:
        """Classify process into cloud sync or browser categories."""
        name_lower = name.lower()
        is_cloud = name_lower in CLOUD_SYNC_PROCESS_NAMES
        is_browser = name_lower in BROWSER_PROCESS_NAMES
        return is_cloud, is_browser

    def _get_process_info(self, proc: psutil.Process) -> Dict[str, Any]:
        """Safely extract metadata dict from psutil.Process instance."""
        name = "unknown"
        exe_path = None
        cmdline = None
        try:
            name = proc.name() or "unknown"
        except Exception:
            pass

        try:
            exe_path = proc.exe()
        except Exception:
            pass

        try:
            cmd = proc.cmdline()
            if cmd:
                cmdline = " ".join(cmd)
        except Exception:
            pass

        is_cloud, is_browser = self.classify_process(name)
        category = "sync_app" if is_cloud else ("browser" if is_browser else "general")

        return {
            "name": name,
            "category": category,
            "exe_path": exe_path,
            "cmdline": cmdline,
        }

    def _emit_process_event(self, pid: int, info: Dict[str, Any], action: str) -> None:
        """Emit ProcessMetadata event payload."""
        metadata = ProcessMetadata(
            process_name=info["name"],
            pid=pid,
            category=info["category"],
            action=action,
            exe_path=info.get("exe_path"),
            cmdline=info.get("cmdline"),
        )

        event = EventCreate(
            user_id=self.user_id,
            device_id=self.device_id,
            event_type=EventType.PROCESS,
            metadata=metadata.model_dump(),
        )
        agent_logger.debug(f"Process event emitted: {action} {info['name']} (PID {pid})")
        self.emit_event(event)

    def _monitor_loop(self) -> None:
        """Poll for process snapshots, starts, and stops."""
        while self.is_running:
            try:
                current_procs: Dict[int, psutil.Process] = {}
                for p in psutil.process_iter(['pid']):
                    current_procs[p.pid] = p

                current_pids = set(current_procs.keys())

                if self._is_first_poll:
                    # Initial Snapshot of all running processes
                    agent_logger.info(f"Taking initial process snapshot ({len(current_pids)} processes)...")
                    for pid, proc in current_procs.items():
                        info = self._get_process_info(proc)
                        self._known_pids[pid] = info
                        self._emit_process_event(pid, info, action="snapshot")
                    self._is_first_poll = False
                else:
                    known_pid_set = set(self._known_pids.keys())
                    new_pids = current_pids - known_pid_set
                    stopped_pids = known_pid_set - current_pids

                    # Emit START events for new processes
                    for pid in new_pids:
                        proc = current_procs[pid]
                        info = self._get_process_info(proc)
                        self._known_pids[pid] = info
                        self._emit_process_event(pid, info, action="start")

                    # Emit STOP events for terminated processes
                    for pid in stopped_pids:
                        info = self._known_pids.pop(pid, {"name": "unknown", "category": "general"})
                        self._emit_process_event(pid, info, action="stop")

            except Exception as exc:
                agent_logger.warning(f"Error in process monitor poll loop: {exc}")

            time.sleep(self.poll_interval)

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
