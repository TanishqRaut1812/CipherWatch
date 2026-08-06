import json
import logging
from logging.handlers import RotatingFileHandler
import os
import sys
from dataclasses import dataclass, field, asdict
from typing import Optional, Dict, Any

from agent.paths import paths


@dataclass
class AgentConfig:
    """Endpoint agent configuration parameters."""

    backend_url: str = "http://localhost:8000"
    org_id: str = ""
    organization_id: str = ""
    agent_id: str = ""
    machine_id: str = ""
    auth_token: str = ""
    enrolled_at: str = ""
    poll_interval: float = 5.0
    heartbeat_interval: int = 30
    debug: bool = True
    enabled_monitors: list[str] = field(
        default_factory=lambda: ["filesystem", "usb", "process", "network"]
    )
    # Privacy Toggles
    enable_screenshot_event_monitor: bool = False
    enable_clipboard_burst_monitor: bool = False

    # --- Filesystem Watch Configuration ---
    watch_scope: str = "targeted"
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
        ("~", False),
    ])

    watch_exclude_dirs: list[str] = field(default_factory=lambda: [
        ".git", "node_modules", "__pycache__", ".cache", ".venv", "venv",
        ".local/share/Trash", ".thumbnails", ".mozilla", ".config/google-chrome",
        ".config/chromium", "snap", ".DS_Store", "AppData/Local/Temp", ".npm",
        ".yarn", ".cargo", ".rustup", ".next", ".turbo", ".gradle",
        ".pytest_cache", ".mypy_cache", ".idea", ".vscode", "dist", "build", "coverage",
    ])

    sensitive_folder_tiers: dict[str, str] = field(default_factory=lambda: {
        "finance": "Finance", "payroll": "Finance", "hr": "HR", "personnel": "HR",
        "src": "SourceCode", "source": "SourceCode", "code": "SourceCode",
        "downloads": "Downloads", "documents": "Documents", "desktop": "Desktop", "pictures": "Pictures",
    })

    sensitive_file_keywords: dict[str, str] = field(default_factory=lambda: {
        "salary": "HR", "ssn": "HR", "payroll": "Finance", "budget": "Finance",
        "tax": "Finance", "invoice": "Finance", "password": "Credentials",
        "credential": "Credentials", "secret": "Credentials", "private_key": "Credentials",
    })


def load_agent_config() -> Optional[Dict[str, Any]]:
    """Load configuration dictionary from Linux standard config.json if present."""
    if paths.config_file.exists():
        try:
            with open(paths.config_file, "r") as f:
                return json.load(f)
        except Exception:
            pass
    # Fallback to local execution directory for dev mode
    local_cfg = "agent_config.json"
    if os.path.exists(local_cfg):
        try:
            with open(local_cfg, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return None


def save_agent_config(config_dict: Dict[str, Any]) -> None:
    """Save configuration dictionary to Linux standard config.json."""
    paths.logs_dir.mkdir(parents=True, exist_ok=True)
    with open(paths.config_file, "w") as f:
        json.dump(config_dict, f, indent=2)


def setup_logger(name: str = "cipherwatch-agent", debug: bool = True, console_output: bool = False) -> logging.Logger:
    """Initialize structured logging with rotating file handler and optional console handler."""
    logger = logging.getLogger(name)
    level = logging.DEBUG if debug else logging.INFO
    logger.setLevel(level)

    # Re-configure handlers if needed or setup initial handlers
    formatter = logging.Formatter(
        fmt="[%(asctime)s] [%(levelname)s] [%(name)s]: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # Clear existing handlers to prevent duplicate lines when switching modes
    if not logger.handlers:
        # 1. Rotating File Handler (logs/cipherwatch.log)
        try:
            paths.logs_dir.mkdir(parents=True, exist_ok=True)
            file_handler = RotatingFileHandler(
                filename=str(paths.main_log_file),
                maxBytes=10 * 1024 * 1024,  # 10 MB per log file
                backupCount=5,
                encoding="utf-8",
            )
            file_handler.setLevel(level)
            file_handler.setFormatter(formatter)
            logger.addHandler(file_handler)
        except Exception as exc:
            pass

        # 2. Console Handler (for dev mode or CLI output)
        if console_output or "pytest" in sys.modules:
            console_handler = logging.StreamHandler(sys.stdout)
            console_handler.setLevel(level)
            console_handler.setFormatter(formatter)
            logger.addHandler(console_handler)

    return logger
