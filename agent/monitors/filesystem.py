import os
from pathlib import Path
from typing import Callable, Dict, List, Optional, Set, Tuple
from watchdog.events import FileSystemEvent, FileSystemEventHandler
from watchdog.observers import Observer

from agent.config import AgentConfig, setup_logger
from agent.monitors.base import BaseMonitor
from shared.schemas import EventCreate, EventType, FilesystemMetadata

agent_logger = setup_logger("cipherwatch-agent-fs")

ENCRYPTED_ARCHIVE_EXTENSIONS = {".zip", ".7z", ".rar", ".tar.gz", ".tgz", ".gpg", ".enc"}


def classify_folder_category(
    file_path: str,
    tiers: Dict[str, str],
    file_keywords: Optional[Dict[str, str]] = None,
) -> str:
    """Classify sensitivity tier based on folder path components, with filename keyword fallback."""
    p = Path(file_path)
    # 1. Check parent folder segments (excluding generic/location folders like Desktop/Downloads if file keyword matches)
    for part in p.parent.parts:
        part_lower = part.lower()
        if part_lower in tiers:
            tier = tiers[part_lower]
            # If folder matches a high-value tier (Finance, HR, SourceCode), return immediately
            if tier in ("Finance", "HR", "SourceCode"):
                return tier

    # 2. Check filename keywords (e.g., salary_export.csv -> HR, budget_2026.xlsx -> Finance)
    filename_lower = p.name.lower()
    if file_keywords:
        for kw, tier in file_keywords.items():
            if kw in filename_lower:
                return tier

    # 3. Fallback to location-based folder tier (Desktop, Downloads, Documents, etc.) or General
    for part in p.parent.parts:
        part_lower = part.lower()
        if part_lower in tiers:
            return tiers[part_lower]

    return "General"


def is_excluded(file_path: str, exclude_dirs: List[str]) -> bool:
    """Check if a file path matches any exclusion pattern (case-insensitive segment match)."""
    path_lower = file_path.lower()
    for excl in exclude_dirs:
        # Match as a path segment: /excl/ or /excl at end
        excl_lower = excl.lower()
        if f"/{excl_lower}/" in path_lower or path_lower.endswith(f"/{excl_lower}"):
            return True
    return False


class FilesystemMetadataHandler(FileSystemEventHandler):
    """Watchdog event handler capturing file event metadata ONLY. ZERO content inspection."""

    def __init__(
        self,
        user_id: str,
        device_id: str,
        emit_callback: Callable[[EventCreate], None],
        exclude_dirs: Optional[List[str]] = None,
        sensitive_tiers: Optional[Dict[str, str]] = None,
        sensitive_keywords: Optional[Dict[str, str]] = None,
    ):
        super().__init__()
        self.user_id = user_id
        self.device_id = device_id
        self.emit_callback = emit_callback
        self.exclude_dirs = [e.lower() for e in (exclude_dirs or [])]
        self.sensitive_tiers = sensitive_tiers or {}
        self.sensitive_keywords = sensitive_keywords or {}

    def process_event(self, event: FileSystemEvent, action: str) -> None:
        try:
            if event.is_directory:
                return

            src_path = event.src_path

            # Exclude noisy paths
            if self.exclude_dirs and is_excluded(src_path, self.exclude_dirs):
                return

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
            folder_category = classify_folder_category(
                src_path, self.sensitive_tiers, self.sensitive_keywords
            )

            metadata = FilesystemMetadata(
                action=action,
                extension=extension or None,
                file_size_bytes=file_size,
                is_encrypted_archive=is_encrypted,
                folder_category=folder_category,
            )

            meta_dict = metadata.model_dump()
            meta_dict["src_path"] = src_path
            if hasattr(event, "dest_path"):
                meta_dict["dest_path"] = event.dest_path

            event_payload = EventCreate(
                user_id=self.user_id,
                device_id=self.device_id,
                event_type=EventType.FILESYSTEM,
                metadata=meta_dict,
            )

            agent_logger.debug(f"FS event emitted: {action} {src_path} (size={file_size}, ext={extension}, tier={folder_category})")
            self.emit_callback(event_payload)
        except PermissionError as pe:
            agent_logger.warning(f"PermissionError processing filesystem event '{action}' on {event.src_path}: {pe}")
        except Exception as exc:
            agent_logger.warning(f"Unexpected error processing filesystem event '{action}' on {event.src_path}: {exc}")

    def on_created(self, event: FileSystemEvent) -> None:
        agent_logger.info(f"FS handler triggered: created {event.src_path}")
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
        agent_logger.info(f"FS handler triggered: deleted {event.src_path}")
        try:
            self.process_event(event, "deleted")
        except Exception as exc:
            agent_logger.debug(f"Ignored error in on_deleted: {exc}")

    def on_moved(self, event: FileSystemEvent) -> None:
        agent_logger.info(f"FS handler triggered: moved {event.src_path}")
        try:
            self.process_event(event, "moved")
        except Exception as exc:
            agent_logger.debug(f"Ignored error in on_moved: {exc}")


class FilesystemMonitor(BaseMonitor):
    """Multi-path watchdog-backed filesystem metadata observer with configurable scope and exclusions."""

    def __init__(
        self,
        config: Optional[AgentConfig] = None,
        user_id: str = "user-local-01",
        device_id: str = "dev-local-01",
        callback: Optional[Callable[[EventCreate], None]] = None,
        # Legacy single-path support for backward compatibility
        watch_path: Optional[str] = None,
    ):
        super().__init__(callback=callback)
        self.config = config or AgentConfig()
        self.user_id = user_id
        self.device_id = device_id
        self.observer: Optional[Observer] = None
        self._legacy_watch_path = watch_path

    def _resolve_watch_targets(self) -> List[Tuple[str, bool]]:
        """Resolve watch targets based on scope config. Returns list of (abs_path, recursive)."""
        if self._legacy_watch_path:
            return [(os.path.abspath(self._legacy_watch_path), True)]

        if self.config.watch_scope == "full_home":
            home = os.path.expanduser("~")
            return [(home, True)]

        # Targeted mode: expand and filter to existing paths
        targets = []
        seen: Set[str] = set()
        for raw_path, recursive in self.config.watch_paths:
            abs_path = os.path.abspath(os.path.expanduser(raw_path))
            if abs_path in seen:
                continue
            seen.add(abs_path)
            if os.path.isdir(abs_path):
                targets.append((abs_path, recursive))
        return targets

    def _count_subdirs(self, path: str) -> int:
        """Count subdirectories under a path (each dir = 1 inotify watch)."""
        count = 1  # The directory itself
        try:
            for entry in os.scandir(path):
                if entry.is_dir(follow_symlinks=False):
                    # Skip excluded dirs from the count too
                    if is_excluded(entry.path, self.config.watch_exclude_dirs):
                        continue
                    try:
                        count += self._count_subdirs(entry.path)
                    except PermissionError:
                        pass
        except PermissionError:
            pass
        return count

    def start(self) -> None:
        if self.is_running:
            return

        targets = self._resolve_watch_targets()
        if not targets:
            agent_logger.warning("No valid filesystem watch targets found. FilesystemMonitor not started.")
            return

        handler = FilesystemMetadataHandler(
            user_id=self.user_id,
            device_id=self.device_id,
            emit_callback=self.emit_event,
            exclude_dirs=self.config.watch_exclude_dirs,
            sensitive_tiers=self.config.sensitive_folder_tiers,
            sensitive_keywords=getattr(self.config, "sensitive_file_keywords", {}),
        )

        self.observer = Observer()
        total_watch_dirs = 0

        # Read inotify limit (Linux-specific, fallback to 65536)
        inotify_limit = 65536
        try:
            with open("/proc/sys/fs/inotify/max_user_watches", "r") as f:
                inotify_limit = int(f.read().strip())
        except (FileNotFoundError, PermissionError, ValueError):
            pass

        for abs_path, recursive in targets:
            dir_count = self._count_subdirs(abs_path) if recursive else 1
            total_watch_dirs += dir_count
            self.observer.schedule(handler, path=abs_path, recursive=recursive)
            scope_label = "recursive" if recursive else "top-level only"
            agent_logger.info(f"Watching: {abs_path} ({scope_label}, ~{dir_count} dirs)")

        agent_logger.info(
            f"Filesystem monitor scope: {self.config.watch_scope} | "
            f"Total watch dirs: ~{total_watch_dirs} | "
            f"inotify limit: {inotify_limit} | "
            f"Excludes: {len(self.config.watch_exclude_dirs)} patterns"
        )

        if total_watch_dirs > inotify_limit * 0.8:
            agent_logger.warning(
                f"Watch directory count ({total_watch_dirs}) approaches inotify limit ({inotify_limit}). "
                f"Consider switching to 'targeted' scope or increasing fs.inotify.max_user_watches."
            )

        self.observer.start()
        self.is_running = True

    def stop(self) -> None:
        if self.observer and self.is_running:
            self.observer.stop()
            self.observer.join()
            self.is_running = False
