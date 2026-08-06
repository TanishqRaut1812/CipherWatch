import os
import sys
import time
import signal
import psutil
from typing import Optional, Tuple

from agent.paths import paths
from agent.config import setup_logger

logger = setup_logger("cipherwatch-process-manager")


class ProcessManager:
    """Manages single-instance PID locking and graceful Linux process termination."""

    @staticmethod
    def get_running_pid() -> Optional[int]:
        """Read PID from PID lock file if present and process is running. Automatically cleans stale lock files."""
        if not paths.pid_file.exists():
            return None
        try:
            with open(paths.pid_file, "r") as f:
                content = f.read().strip()
                if not content:
                    ProcessManager.release_pid_lock()
                    return None
                pid = int(content)

            if psutil.pid_exists(pid):
                try:
                    proc = psutil.Process(pid)
                    if proc.is_running() and proc.status() != psutil.STATUS_ZOMBIE:
                        return pid
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass
        except Exception:
            pass

        # Automatic stale PID file recovery
        logger.info("Detected stale PID lock file. Automatically recovering...")
        ProcessManager.release_pid_lock()
        return None

    @staticmethod
    def acquire_pid_lock() -> bool:
        """Write current process PID to PID lock file if no other instance is running."""
        running_pid = ProcessManager.get_running_pid()
        if running_pid is not None and running_pid != os.getpid():
            return False

        try:
            paths.base_dir.mkdir(parents=True, exist_ok=True)
            with open(paths.pid_file, "w") as f:
                f.write(str(os.getpid()))
            return True
        except Exception as e:
            logger.error(f"Failed to acquire PID lock at {paths.pid_file}: {e}")
            return False

    @staticmethod
    def release_pid_lock() -> None:
        """Remove PID lock file."""
        if paths.pid_file.exists():
            try:
                paths.pid_file.unlink()
            except Exception as e:
                logger.warning(f"Failed to remove PID lock file: {e}")

    @staticmethod
    def stop_running_instance(timeout_seconds: float = 6.0) -> Tuple[bool, str]:
        """
        Gracefully stop running CipherWatch Agent process via SIGTERM signal.
        Must stop monitors, heartbeat, flush queue, send events, release PID lock, and exit cleanly.
        Returns (success: bool, message: str).
        """
        pid = ProcessManager.get_running_pid()
        if pid is None:
            return True, "No running CipherWatch Agent instance was found."

        if pid == os.getpid():
            return False, "Cannot stop current process from within itself using ProcessManager."

        logger.info(f"Sending SIGTERM to running CipherWatch Agent process (PID: {pid})...")
        try:
            proc = psutil.Process(pid)
            os.kill(pid, signal.SIGTERM)

            # Wait for process to exit cleanly and release its lock
            start_wait = time.time()
            while time.time() - start_wait < timeout_seconds:
                if not proc.is_running() or proc.status() == psutil.STATUS_ZOMBIE:
                    ProcessManager.release_pid_lock()
                    return True, f"CipherWatch Agent (PID {pid}) stopped gracefully."
                time.sleep(0.2)

            # Force kill if still running after timeout
            logger.warning(f"Process PID {pid} did not exit within {timeout_seconds}s. Sending SIGKILL...")
            proc.kill()
            ProcessManager.release_pid_lock()
            return True, f"CipherWatch Agent (PID {pid}) terminated forcibly."

        except psutil.NoSuchProcess:
            ProcessManager.release_pid_lock()
            return True, f"CipherWatch Agent (PID {pid}) was already stopped."
        except Exception as e:
            return False, f"Failed to stop CipherWatch Agent process PID {pid}: {e}"
