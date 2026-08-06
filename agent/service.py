import os
import sys
import subprocess
from pathlib import Path
from typing import Tuple

from agent.paths import paths
from agent.config import setup_logger

logger = setup_logger("cipherwatch-service-manager")

SYSTEMD_SERVICE_TEMPLATE = """[Unit]
Description=CipherWatch Standalone Endpoint Security Agent
Documentation=https://github.com/TanishqRaut1812/CipherWatch
After=network.target network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/local/bin/cipherwatch-agent --service
ExecStop=/usr/local/bin/cipherwatch-agent stop
Restart=always
RestartSec=5s
User=root
WorkingDirectory=/etc/cipherwatch
StandardOutput=journal+console
StandardError=journal+console
KillMode=mixed
TimeoutStopSec=10s

[Install]
WantedBy=multi-user.target
"""


class ServiceManager:
    """Manages Linux systemd service registration, installation, and status."""

    @staticmethod
    def install_systemd_service() -> Tuple[bool, str]:
        """Generate and install systemd unit file on Linux systems."""
        service_path = Path("/etc/systemd/system/cipherwatch-agent.service")
        content = SYSTEMD_SERVICE_TEMPLATE

        try:
            with open(service_path, "w") as f:
                f.write(content)

            subprocess.run(["systemctl", "daemon-reload"], check=True)
            subprocess.run(["systemctl", "enable", "cipherwatch-agent.service"], check=True)
            logger.info("Systemd service cipherwatch-agent.service installed and enabled.")
            return True, "Systemd service installed and enabled successfully."
        except Exception as e:
            return False, f"Failed to install systemd service: {e}"

    @staticmethod
    def get_service_status() -> str:
        """Check systemd daemon status for cipherwatch-agent.service."""
        try:
            res = subprocess.run(
                ["systemctl", "is-active", "cipherwatch-agent.service"],
                capture_output=True,
                text=True
            )
            status = res.stdout.strip()
            if status == "active":
                return "active (running)"
            elif status == "inactive":
                return "inactive (stopped)"
            return status or "unknown"
        except Exception:
            return "not installed / standalone mode"

    @staticmethod
    def start_service() -> Tuple[bool, str]:
        """Start the systemd service via systemctl."""
        try:
            res = subprocess.run(["systemctl", "start", "cipherwatch-agent.service"], capture_output=True, text=True)
            if res.returncode == 0:
                return True, "Started cipherwatch-agent systemd service."
            return False, res.stderr.strip() or "systemctl start failed."
        except Exception as e:
            return False, str(e)

    @staticmethod
    def stop_service() -> Tuple[bool, str]:
        """Stop the systemd service via systemctl."""
        try:
            res = subprocess.run(["systemctl", "stop", "cipherwatch-agent.service"], capture_output=True, text=True)
            if res.returncode == 0:
                return True, "Stopped cipherwatch-agent systemd service."
            return False, res.stderr.strip() or "systemctl stop failed."
        except Exception as e:
            return False, str(e)

    @staticmethod
    def restart_service() -> Tuple[bool, str]:
        """Restart the systemd service via systemctl."""
        try:
            res = subprocess.run(["systemctl", "restart", "cipherwatch-agent.service"], capture_output=True, text=True)
            if res.returncode == 0:
                return True, "Restarted cipherwatch-agent systemd service."
            return False, res.stderr.strip() or "systemctl restart failed."
        except Exception as e:
            return False, str(e)
