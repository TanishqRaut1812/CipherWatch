import os
from pathlib import Path
from typing import Callable, Optional
from watchdog.events import FileSystemEvent, FileSystemEventHandler
from watchdog.observers import Observer

from agent.config import setup_logger
from agent.monitors.base import BaseMonitor
from shared.schemas import EventCreate, EventType, FilesystemMetadata

agent_logger = setup_logger("cipherwatch-agent-fs")

ENCRYPTED_ARCHIVE_EXTENSIONS = {".zip", ".7z", ".rar", ".tar.gz", ".tgz", ".gpg", ".enc"}

SENSITIVE_FOLDER_TIERS = {
    "finance": "Finance",
    "payroll": "Finance",
    "hr": "HR",
    "personnel": "HR",
    "src": "SourceCode",
    "source": "SourceCode",
    "code": "SourceCode",
    "downloads": "Downloads",
}


def classify_folder_category(file_path: str) -> str:
    """Classify folder sensitivity tier based on path components."""
    path_lower = file_path.lower()
    for keyword, tier in SENSITIVE_FOLDER_TIERS.items():
        if keyword in path_lower:
            return tier
    return "General"


class FilesystemMetadataHandler(FileSystemEventHandler):
    """Watchdog event handler capturing file event metadata ONLY. ZERO content inspection."""

    def __init__(self, user_id: str, device_id: str, emit_callback: Callable[[EventCreate], None]):
        super().__init__()
        self.user_id = user_id
        self.device_id = device_id
        self.emit_callback = emit_callback

    def process_event(self, event: FileSystemEvent, action: str) -> None:
        try:
            if event.is_directory:
                return

            src_path = event.src_path
            extension = Path(src_path).suffix.lower()
            file_size = 0
            try:
                if os.path.exists(src_path):
                    file_size = os.path.getsize(src_path)
            except (PermissionError, OSError) as pe:
                agent_logger.warning(f"Permission denied/OSError accessing file stats for {src_path}: {pe}")
                file_size = 0
            except Exception as exc:
                agent_logger.warning(f"Could not retrieve file stats for {src_path}: {exc}")
                file_size = 0

            is_encrypted = extension in ENCRYPTED_ARCHIVE_EXTENSIONS
            folder_category = classify_folder_category(src_path)

            metadata = FilesystemMetadata(
                action=action,
                extension=extension or None,
                file_size_bytes=file_size,
                is_encrypted_archive=is_encrypted,
                folder_category=folder_category,
            )

            event_payload = EventCreate(
                user_id=self.user_id,
                device_id=self.device_id,
                event_type=EventType.FILESYSTEM,
                metadata=metadata.model_dump(),
            )

            self.emit_callback(event_payload)
        except PermissionError as pe:
            agent_logger.warning(f"PermissionError processing filesystem event '{action}' on {event.src_path}: {pe}")
        except Exception as exc:
            agent_logger.warning(f"Unexpected error processing filesystem event '{action}' on {event.src_path}: {exc}")

    def on_created(self, event: FileSystemEvent) -> None:
        try:
            self.process_event(event, "created")
        except Exception as exc:
            agent_logger.debug(f"Ignored error in on_created: {exc}")

    def on_modified(self, event: FileSystemEvent) -> None:
        try:
            self.process_event(event, "modified")
        except Exception as exc:
            agent_logger.debug(f"Ignored error in on_modified: {exc}")

    def on_deleted(self, event: FileSystemEvent) -> None:
        try:
            self.process_event(event, "deleted")
        except Exception as exc:
            agent_logger.debug(f"Ignored error in on_deleted: {exc}")

    def on_moved(self, event: FileSystemEvent) -> None:
        try:
            self.process_event(event, "moved")
        except Exception as exc:
            agent_logger.debug(f"Ignored error in on_moved: {exc}")


class FilesystemMonitor(BaseMonitor):
    """Watchdog-backed filesystem metadata observer."""

    def __init__(
        self,
        watch_path: str,
        user_id: str = "user-local-01",
        device_id: str = "dev-local-01",
        callback: Optional[Callable[[EventCreate], None]] = None,
    ):
        super().__init__(callback=callback)
        self.watch_path = watch_path
        self.user_id = user_id
        self.device_id = device_id
        self.observer: Optional[Observer] = None

    def start(self) -> None:
        if self.is_running:
            return

        if not os.path.exists(self.watch_path):
            os.makedirs(self.watch_path, exist_ok=True)

        handler = FilesystemMetadataHandler(
            user_id=self.user_id,
            device_id=self.device_id,
            emit_callback=self.emit_event,
        )
        self.observer = Observer()
        self.observer.schedule(handler, path=self.watch_path, recursive=True)
        self.observer.start()
        self.is_running = True

    def stop(self) -> None:
        if self.observer and self.is_running:
            self.observer.stop()
            self.observer.join()
            self.is_running = False
