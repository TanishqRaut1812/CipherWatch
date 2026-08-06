import os
import sys
from pathlib import Path

def get_base_dir() -> Path:
    """
    Return Linux OS-standard directory for CipherWatch config, logs, and state.
    System location (attempted first if writable):
      - /etc/cipherwatch
    Fallback user location (if /etc/cipherwatch is not writable):
      - ~/.config/cipherwatch
    """
    sys_path = Path("/etc/cipherwatch")
    try:
        sys_path.mkdir(parents=True, exist_ok=True)
        test_file = sys_path / ".perm_check"
        test_file.touch()
        test_file.unlink()
        return sys_path
    except Exception:
        user_path = Path.home() / ".config" / "cipherwatch"
        user_path.mkdir(parents=True, exist_ok=True)
        return user_path


class AgentPaths:
    """Resolved directory paths for CipherWatch Agent on Linux."""

    def __init__(self, base_dir: Path = None):
        self.base_dir = base_dir or get_base_dir()
        self.base_dir.mkdir(parents=True, exist_ok=True)

        self.config_file = self.base_dir / "config.json"
        self.pid_file = self.base_dir / "cipherwatch-agent.pid"
        self.state_file = self.base_dir / "state.json"

        self.logs_dir = self.base_dir / "logs"
        self.cache_dir = self.base_dir / "cache"
        self.keys_dir = self.base_dir / "keys"

        self.logs_dir.mkdir(parents=True, exist_ok=True)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.keys_dir.mkdir(parents=True, exist_ok=True)

        self.main_log_file = self.logs_dir / "cipherwatch.log"


# Global Linux paths instance
paths = AgentPaths()
