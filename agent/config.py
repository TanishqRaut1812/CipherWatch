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
