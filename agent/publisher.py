import time
import queue
import threading
from typing import Optional
import httpx

from agent.config import setup_logger
from shared.schemas import EventCreate

agent_logger = setup_logger("cipherwatch-agent-publisher")

class EventPublisher:
    """Thread-safe event queue buffer & async HTTP publisher with exponential backoff retry."""

    def __init__(
        self,
        backend_url: str = "http://localhost:8000",
        auth_token: Optional[str] = None,
        max_queue_size: int = 1000,
        batch_size: int = 10,
        flush_interval: float = 1.0,
    ):
        self.backend_url = backend_url.rstrip("/")
        self.ingest_endpoint = f"{self.backend_url}/api/events"
        self.auth_token = auth_token
        self.queue: queue.Queue[EventCreate] = queue.Queue(maxsize=max_queue_size)
        self.batch_size = batch_size
        self.flush_interval = flush_interval
        self.is_running = False
        self._thread: Optional[threading.Thread] = None

    def publish(self, event: EventCreate) -> bool:
        """Enqueue event payload for HTTP transmission."""
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

    def send_payload(self, event: EventCreate) -> bool:
        """Send single event payload with exponential backoff retries."""
        payload = event.model_dump(mode="json")
        retries = 3
        backoff = 0.5

        headers = {}
        if self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"

        for attempt in range(retries):
            try:
                with httpx.Client(timeout=3.0) as client:
                    resp = client.post(self.ingest_endpoint, json=payload, headers=headers)
                    if resp.status_code in (200, 201):
                        return True
                    else:
                        agent_logger.warning(
                            f"HTTP {resp.status_code} posting event (attempt {attempt+1}/{retries})"
                        )
            except Exception as exc:
                agent_logger.warning(
                    f"Network exception posting event: {exc} (attempt {attempt+1}/{retries})"
                )

            time.sleep(backoff)
            backoff *= 2

        return False

    def _worker_loop(self) -> None:
        """Worker thread loop draining event queue."""
        while self.is_running or not self.queue.empty():
            try:
                event = self.queue.get(timeout=self.flush_interval)
                self.send_payload(event)
                self.queue.task_done()
            except queue.Empty:
                continue

    def start(self) -> None:
        """Start publisher background thread."""
        if self.is_running:
            return
        self.is_running = True
        self._thread = threading.Thread(target=self._worker_loop, daemon=True)
        self._thread.start()
        agent_logger.info(f"EventPublisher started targeting {self.ingest_endpoint}")

    def stop(self) -> None:
        """Stop publisher worker thread and wait for queue drain."""
        self.is_running = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2.0)
        agent_logger.info("EventPublisher stopped.")
