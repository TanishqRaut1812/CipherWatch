from abc import ABC, abstractmethod
from typing import Callable, Optional
from shared.schemas import EventCreate


class BaseMonitor(ABC):
    """Abstract base class for all endpoint event monitors."""

    def __init__(self, callback: Optional[Callable[[EventCreate], None]] = None):
        self.callback = callback
        self.is_running = False

    @abstractmethod
    def start(self) -> None:
        """Start monitoring operations."""
        self.is_running = True

    @abstractmethod
    def stop(self) -> None:
        """Stop monitoring operations."""
        self.is_running = False

    def emit_event(self, event: EventCreate) -> None:
        """Emit a parsed metadata event payload to the callback handler."""
        if self.callback:
            self.callback(event)
