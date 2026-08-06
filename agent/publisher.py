import time
import queue
import threading
from typing import Any, Dict, List, Optional
import httpx

from agent.config import setup_logger
from shared.schemas import EventCreate, EventType

agent_logger = setup_logger("cipherwatch-agent-publisher")


class EventPublisher:
    """Thread-safe event queue buffer & batched HTTP publisher targeting /api/agents/{agent_id}/events."""

    def __init__(
        self,
        backend_url: str = "http://localhost:8000",
        agent_id: str = "",
        auth_token: Optional[str] = None,
        max_queue_size: int = 1000,
        batch_size: int = 20,
        flush_interval: float = 2.0,
    ):
        self.agent_id = agent_id
        self.auth_token = auth_token
        if not self.agent_id:
            agent_logger.warning("EventPublisher initialized without agent_id; agent_id must be provided before flushing.")
        self.ingest_endpoint = f"{self.backend_url}/api/agents/{self.agent_id}/events"
        self.queue: queue.Queue[Any] = queue.Queue(maxsize=max_queue_size)
        self.batch_size = batch_size
        self.flush_interval = flush_interval
        self.is_running = False
        self._thread: Optional[threading.Thread] = None

    def publish(self, event: Any) -> bool:
        """Enqueue event payload for batched HTTP transmission."""
        try:
            self.queue.put_nowait(event)
            return True
        except queue.Full:
            agent_logger.warning("Event queue full! Dropping oldest event.")
            try:
                self.queue.get_nowait()
                self.queue.put_nowait(event)
                return True
            except Exception:
                return False

    def send_batch(self, events_batch: List[Any]) -> bool:
        """Categorize events into process, fs, and raw events, then post batched AgentIngestionPayload."""
        if not events_batch:
            return True

        process_events: List[Dict[str, Any]] = []
        fs_events: List[Dict[str, Any]] = []
        usb_events: List[Dict[str, Any]] = []
        raw_events: List[Dict[str, Any]] = []
        metrics: Optional[Dict[str, Any]] = None

        for item in events_batch:
            if isinstance(item, EventCreate):
                data = item.model_dump(mode="json")
                ev_type = item.event_type.value if hasattr(item.event_type, "value") else str(item.event_type)
                meta = data.get("metadata", {})
                ts = data.get("timestamp")

                if ev_type == EventType.PROCESS.value:
                    process_events.append({
                        "timestamp": ts,
                        "event_type": meta.get("action", "snapshot"),
                        "pid": meta.get("pid", 0),
                        "name": meta.get("process_name", "unknown"),
                        "exe_path": meta.get("exe_path"),
                        "cmdline": meta.get("cmdline"),
                        "user": meta.get("user"),
                        "cpu_percent": meta.get("cpu_percent", 0.0),
                        "mem_rss": meta.get("mem_rss", 0),
                    })
                elif ev_type == EventType.FILESYSTEM.value:
                    fs_events.append({
                        "timestamp": ts,
                        "event_type": meta.get("action", "modified"),
                        "src_path": meta.get("src_path") or meta.get("file_path") or "/unknown",
                        "dest_path": meta.get("dest_path"),
                        "is_directory": meta.get("is_directory", False),
                    })
                elif ev_type == EventType.USB.value:
                    usb_events.append({
                        "timestamp": ts,
                        "action": meta.get("action", "connected"),
                        "vendor_id": meta.get("vendor_id"),
                        "product_id": meta.get("product_id"),
                        "device_name": meta.get("device_name"),
                        "mount_point": meta.get("mount_point"),
                    })
                else:
                    raw_events.append(data)
            elif isinstance(item, dict):
                ev_type = item.get("event_type", "")
                if ev_type in ("start", "stop", "snapshot") and "pid" in item:
                    process_events.append(item)
                elif ev_type in ("created", "modified", "deleted", "moved") and "src_path" in item:
                    fs_events.append(item)
                elif "action" in item and ("vendor_id" in item or "device_name" in item):
                    usb_events.append(item)
                elif "cpu_percent" in item and "mem_percent" in item:
                    metrics = item
                else:
                    raw_events.append(item)

        payload = {
            "metrics": metrics,
            "process_events": process_events,
            "fs_events": fs_events,
            "usb_events": usb_events,
            "raw_events": raw_events,
        }

        headers = {"Content-Type": "application/json"}
        if self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"

        retries = 3
        backoff = 0.5
        endpoint = f"{self.backend_url}/api/agents/{self.agent_id}/events" if self.agent_id else self.ingest_endpoint

        for attempt in range(retries):
            try:
                with httpx.Client(timeout=4.0) as client:
                    resp = client.post(endpoint, json=payload, headers=headers)
                    if resp.status_code in (200, 201):
                        agent_logger.debug(f"Batch payload delivered successfully ({len(events_batch)} items).")
                        return True
                    else:
                        agent_logger.warning(
                            f"HTTP {resp.status_code} posting batch ({len(events_batch)} items) (attempt {attempt+1}/{retries}): {resp.text}"
                        )
            except Exception as exc:
                agent_logger.warning(
                    f"Network exception posting batch: {exc} (attempt {attempt+1}/{retries})"
                )

            time.sleep(backoff)
            backoff *= 2

        return False

    def _worker_loop(self) -> None:
        """Worker thread accumulating items up to batch_size or flush_interval."""
        while self.is_running or not self.queue.empty():
            batch = []
            deadline = time.time() + self.flush_interval

            while len(batch) < self.batch_size and time.time() < deadline:
                try:
                    timeout = max(0.05, deadline - time.time())
                    item = self.queue.get(timeout=timeout)
                    batch.append(item)
                    self.queue.task_done()
                except queue.Empty:
                    break

            if batch:
                self.send_batch(batch)

    def start(self) -> None:
        """Start publisher background thread."""
        if self.is_running:
            return
        self.is_running = True
        self._thread = threading.Thread(target=self._worker_loop, daemon=True)
        self._thread.start()
        agent_logger.info(f"EventPublisher started targeting agent '{self.agent_id}' events endpoint.")

    def stop(self) -> None:
        """Stop publisher worker thread and wait for queue drain."""
        self.is_running = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2.0)
        agent_logger.info("EventPublisher stopped.")
