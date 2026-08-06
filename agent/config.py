import logging
import sys
from dataclasses import dataclass, field


@dataclass
class AgentConfig:
    """Endpoint agent configuration parameters."""

    backend_url: str = "http://localhost:8000"
    user_id: str = "user-local-01"
    poll_interval: float = 5.0
    debug: bool = True
    enabled_monitors: list[str] = field(
        default_factory=lambda: ["filesystem", "usb", "process", "network"]
    )
    # Privacy Toggles (DISABLED by default for zero-privacy invasion guarantee)
    enable_screenshot_event_monitor: bool = False  # Records event presence ONLY (NO image pixel capture)
    enable_clipboard_burst_monitor: bool = False   # Records copy event count ONLY (NO text content capture)

    # --- Filesystem Watch Configuration ---

    # "targeted" = watch specific directories (lower resource cost, recommended default)
    # "full_home" = recursive watch on entire home directory (thorough, high inotify cost)
    watch_scope: str = "targeted"

    # Directories to watch in "targeted" mode (~ expanded at runtime).
    # Each entry is (path, recursive). Non-existent paths are silently skipped.
    watch_paths: list[tuple[str, bool]] = field(default_factory=lambda: [
        ("~/Downloads", True),
        ("~/Documents", True),
        ("~/Desktop", True),
        ("~/Pictures", True),
        ("~/Finance", True),
        ("~/HR", True),
        ("~/src", True),
        ("~/source", True),
        ("~/code", True),
        ("~", False),  # Home root — non-recursive, catches top-level drops
    ])

    # Directory name segments to exclude from monitoring (case-insensitive substring match).
    # Events from paths containing any of these segments are silently dropped.
    watch_exclude_dirs: list[str] = field(default_factory=lambda: [
        ".git",
        "node_modules",
        "__pycache__",
        ".cache",
        ".venv",
        "venv",
        ".local/share/Trash",
        ".thumbnails",
        ".mozilla",
        ".config/google-chrome",
        ".config/chromium",
        "snap",
        ".DS_Store",
        "AppData/Local/Temp",
        ".npm",
        ".yarn",
        ".cargo",
        ".rustup",
        ".next",
        ".turbo",
        ".gradle",
        ".pytest_cache",
        ".mypy_cache",
        ".idea",
        ".vscode",
        "dist",
        "build",
        "coverage",
    ])

    # Sensitive folder tier classification (keyword in path segment -> category label)
    sensitive_folder_tiers: dict[str, str] = field(default_factory=lambda: {
        "finance": "Finance",
        "payroll": "Finance",
        "hr": "HR",
        "personnel": "HR",
        "src": "SourceCode",
        "source": "SourceCode",
        "code": "SourceCode",
        "downloads": "Downloads",
        "documents": "Documents",
        "desktop": "Desktop",
        "pictures": "Pictures",
    })

    # Sensitive filename keywords (keyword in filename -> category label fallback)
    sensitive_file_keywords: dict[str, str] = field(default_factory=lambda: {
        "salary": "HR",
        "ssn": "HR",
        "payroll": "Finance",
        "budget": "Finance",
        "tax": "Finance",
        "invoice": "Finance",
        "password": "Credentials",
        "credential": "Credentials",
        "secret": "Credentials",
        "private_key": "Credentials",
    })



def setup_logger(name: str = "cipherwatch-agent", debug: bool = True) -> logging.Logger:
    """Initialize structured logging format for agent operations."""
    logger = logging.getLogger(name)
    level = logging.DEBUG if debug else logging.INFO
    logger.setLevel(level)

    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(level)
        formatter = logging.Formatter(
            fmt="[%(asctime)s] [%(levelname)s] [%(name)s]: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)

    return logger
