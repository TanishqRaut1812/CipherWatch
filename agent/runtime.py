import os
import sys
import time
import json
import socket
import signal
import threading
from datetime import datetime
from typing import Dict, Any, Optional

import httpx

from agent.paths import paths
from agent.config import AgentConfig, setup_logger, load_agent_config
from agent.publisher import EventPublisher
from agent.monitors.process import ProcessMonitor
from agent.monitors.filesystem import FilesystemMonitor
from agent.monitors.usb import USBMonitor
from agent.monitors.network import NetworkMonitor
from agent.process_manager import ProcessManager

logger = setup_logger("cipherwatch-agent-runtime")


class AgentRuntime:
    """
    Dedicated Agent Runtime owning:
      - EventPublisher
      - Heartbeat thread
      - Filesystem Monitor
      - USB Monitor
      - Process Monitor
      - Network Monitor
      - Reusable Graceful Shutdown Manager
    """

    def __init__(self, config_data: Optional[Dict[str, Any]] = None, dev_mode: bool = False):
        self.config_data = config_data or load_agent_config()
        if not self.config_data:
            raise RuntimeError("Agent configuration not found. Please run 'cipherwatch-agent setup' first.")

        self.dev_mode = dev_mode
        self.agent_id = self.config_data.get("agent_id", "")
        self.org_id = self.config_data.get("organization_id") or self.config_data.get("org_id", "")
        self.machine_id = self.config_data.get("machine_id", "")
        self.auth_token = self.config_data.get("auth_token", "")
        self.backend_url = self.config_data.get("backend_url", "http://localhost:8000").rstrip("/")

        if not self.agent_id or not self.auth_token:
            raise RuntimeError("Invalid agent credentials in configuration. Please re-run setup.")

        self.agent_config = AgentConfig(
            backend_url=self.backend_url,
            org_id=self.org_id,
            organization_id=self.org_id,
            agent_id=self.agent_id,
            machine_id=self.machine_id,
            auth_token=self.auth_token,
            debug=self.dev_mode,
        )

        self.publisher = EventPublisher(
            backend_url=self.backend_url,
            agent_id=self.agent_id,
            auth_token=self.auth_token,
            batch_size=10 if self.dev_mode else 20,
            flush_interval=1.0 if self.dev_mode else 2.0,
        )

        self.monitors = []
        self.stop_event = threading.Event()
        self.hb_thread: Optional[threading.Thread] = None
        self.is_running = False

        self.state_data = {
            "agent_id": self.agent_id,
            "org_id": self.org_id,
            "machine_id": self.machine_id,
            "hostname": socket.gethostname(),
            "status": "stopped",
            "last_heartbeat": None,
            "last_event_sent": None,
            "total_events_sent": 0,
            "started_at": None,
            "stopped_at": None,
        }

    def update_state(self, updates: Dict[str, Any]) -> None:
        """Persist state updates to Linux standard state.json."""
        self.state_data.update(updates)
        try:
            with open(paths.state_file, "w") as f:
                json.dump(self.state_data, f, indent=2)
        except Exception as e:
            logger.warning(f"Could not write state.json: {e}")

    def send_heartbeat_sync(self) -> bool:
        """Send a single synchronous heartbeat ping to the backend."""
        url = f"{self.backend_url}/api/agents/{self.agent_id}/heartbeat"
        headers = {"Authorization": f"Bearer {self.auth_token}"}
        try:
            resp = httpx.post(url, headers=headers, timeout=5.0)
            if resp.status_code == 200:
                now_iso = datetime.utcnow().isoformat() + "Z"
                self.update_state({"last_heartbeat": now_iso})
                logger.info("✓ Heartbeat ping successful.")
                return True
            else:
                logger.warning(f"Heartbeat ping returned HTTP {resp.status_code}: {resp.text}")
                return False
        except Exception as e:
            logger.warning(f"Heartbeat exception: {e}")
            return False

    def _heartbeat_loop(self) -> None:
        """Background thread posting periodic liveness pings to backend."""
        while not self.stop_event.is_set():
            self.send_heartbeat_sync()
            self.stop_event.wait(30.0)

    def initialize_monitors(self) -> None:
        """Instantiate enabled Linux endpoint monitors."""
        cb = self.publisher.publish

        self.monitors = [
            FilesystemMonitor(callback=cb, config=self.agent_config),
            USBMonitor(callback=cb, poll_interval=self.agent_config.poll_interval),
            ProcessMonitor(callback=cb, poll_interval=self.agent_config.poll_interval),
            NetworkMonitor(callback=cb, poll_interval=self.agent_config.poll_interval),
        ]

    def start(self, dev_mode: bool = False) -> None:
        """Start agent runtime components and handle Linux shutdown signals."""
        if not ProcessManager.acquire_pid_lock():
            print("CipherWatch Agent is already running.")
            logger.warning("Attempted to start agent while another instance is running.")
            sys.exit(1)

        self.is_running = True
        self.dev_mode = dev_mode
        started_iso = datetime.utcnow().isoformat() + "Z"
        self.update_state({
            "status": "running",
            "pid": os.getpid(),
            "started_at": started_iso,
            "stopped_at": None,
        })

        banner_mode = "DEVELOPMENT (VERBOSE FOREGROUND)" if dev_mode else "PRODUCTION"
        logger.info("============================================================")
        logger.info(f"🛡️  Starting CipherWatch Endpoint Agent [{banner_mode}]")
        logger.info("============================================================")
        logger.info(f"   • Agent ID:       {self.agent_id}")
        logger.info(f"   • Machine ID:     {self.machine_id[:16]}...")
        logger.info(f"   • Organization:   {self.org_id}")
        logger.info(f"   • Server URL:     {self.backend_url}")
        logger.info(f"   • Process PID:    {os.getpid()}")
        logger.info(f"   • Config File:    {paths.config_file}")
        logger.info(f"   • Log File:       {paths.main_log_file}")
        logger.info("============================================================")

        # 1. Start Event Publisher
        self.publisher.start()

        # 2. Start Heartbeat Thread
        self.stop_event.clear()
        self.hb_thread = threading.Thread(target=self._heartbeat_loop, daemon=True)
        self.hb_thread.start()

        # 3. Initialize & Start Monitors
        self.initialize_monitors()
        for monitor in self.monitors:
            try:
                monitor.start()
            except Exception as e:
                logger.error(f"Failed to start monitor {monitor.__class__.__name__}: {e}")

        logger.info("✓ All Linux endpoint monitors active. Telemetry pipeline running.")

        # 4. Register Linux signal handlers for graceful shutdown (Ctrl+C, systemd stop, SIGTERM)
        def signal_handler(signum, frame):
            sig_name = signal.Signals(signum).name if hasattr(signal, "Signals") else str(signum)
            logger.info(f"Received signal {sig_name}. Triggering graceful shutdown sequence...")
            self.stop()
            sys.exit(0)

        try:
            signal.signal(signal.SIGINT, signal_handler)
            signal.signal(signal.SIGTERM, signal_handler)
        except Exception:
            pass

        try:
            while self.is_running and not self.stop_event.is_set():
                time.sleep(1.0)
        except (KeyboardInterrupt, SystemExit):
            logger.info("Interruption signal received. Shutting down...")
            self.stop()

    def stop(self) -> None:
        """
        Reusable Graceful Shutdown Manager:
          1. Stop all monitors
          2. Stop heartbeat thread
          3. Flush publisher queue & send remaining queued events
          4. Update state.json
          5. Release PID lock file
          6. Exit cleanly
        """
        if not self.is_running:
            return

        logger.info("Initiating CipherWatch Agent graceful shutdown sequence...")
        self.is_running = False
        self.stop_event.set()

        # 1. Stop Monitors
        logger.info("Stopping endpoint monitors...")
        for monitor in self.monitors:
            try:
                monitor.stop()
            except Exception as e:
                logger.warning(f"Error stopping monitor {monitor.__class__.__name__}: {e}")

        # 2. Stop Publisher & Flush Queued Events
        logger.info("Flushing queued telemetry events and stopping publisher...")
        try:
            self.publisher.stop()
        except Exception as e:
            logger.warning(f"Error stopping publisher: {e}")

        # 3. Join Heartbeat Thread
        if self.hb_thread and self.hb_thread.is_alive():
            self.hb_thread.join(timeout=2.0)

        # 4. Update State & Clean PID
        stopped_iso = datetime.utcnow().isoformat() + "Z"
        self.update_state({
            "status": "stopped",
            "pid": None,
            "stopped_at": stopped_iso,
        })
        ProcessManager.release_pid_lock()

        logger.info("✅ CipherWatch Endpoint Agent shutdown completed cleanly.")
