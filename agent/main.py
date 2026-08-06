import argparse
import sys
import socket
import platform
import json
import time
import os
import threading
import signal
import uuid
from typing import Optional
import httpx

from agent.config import AgentConfig, setup_logger
from agent.publisher import EventPublisher
from agent.monitors.process import ProcessMonitor
from agent.monitors.filesystem import FilesystemMonitor
from agent.monitors.usb import USBMonitor
from agent.monitors.network import NetworkMonitor

logger = setup_logger("cipherwatch-agent", debug=True)

def parse_args() -> argparse.Namespace:
    """Parse command line arguments for the endpoint agent CLI."""
    parser = argparse.ArgumentParser(
        description="CipherWatch Endpoint Agent — Metadata-only insider threat monitoring"
    )
    parser.add_argument(
        "-b",
        "--backend-url",
        type=str,
        default="http://localhost:8000",
        help="Backend REST API ingestion base URL (default: http://localhost:8000)",
    )
    parser.add_argument(
        "-u",
        "--user-id",
        type=str,
        default="user-local-01",
        help="Monitored endpoint user identifier (default: user-local-01)",
    )
    parser.add_argument(
        "-d",
        "--debug",
        action="store_true",
        default=True,
        help="Enable verbose debug logging mode",
    )
    parser.add_argument(
        "--setup",
        action="store_true",
        help="Enroll and register the agent with an organization using enrollment key",
    )
    parser.add_argument(
        "--org-id",
        type=str,
        help="Organization ID for registration",
    )
    parser.add_argument(
        "--reg-key",
        type=str,
        help="Organization registration/enrollment key (legacy alias)",
    )
    parser.add_argument(
        "--enrollment-key",
        type=str,
        help="Organization enrollment key",
    )
    return parser.parse_args()


def run_setup(args) -> None:
    print("=" * 60)
    print("🛡️  CipherWatch Endpoint Agent Enrollment Wizard")
    print("=" * 60)

    org_id = args.org_id
    if not org_id:
        org_id = input("Enter Organization ID (organization_id): ").strip()
    
    enrollment_key = args.enrollment_key or args.reg_key
    if not enrollment_key:
        enrollment_key = input("Enter Organization Enrollment Key: ").strip()

    if not org_id or not enrollment_key:
        print("❌ Organization ID and Enrollment Key are required.")
        sys.exit(1)

    # Resolve device_uuid (check existing config or generate new)
    device_uuid = None
    config_path = "agent_config.json"
    if os.path.exists(config_path):
        try:
            with open(config_path, "r") as f:
                old_config = json.load(f)
                device_uuid = old_config.get("device_uuid")
        except Exception:
            pass
    if not device_uuid:
        device_uuid = str(uuid.uuid4())

    hostname = socket.gethostname()
    os_name = platform.system()

    payload = {
        "organization_id": org_id,
        "enrollment_key": enrollment_key,
        "hostname": hostname,
        "device_uuid": device_uuid,
        "os": os_name,
        "agent_version": "1.0.0"
    }

    url = f"{args.backend_url.rstrip('/')}/api/agent/enroll"
    print(f"\nEnrolling agent with backend at {url}...")
    try:
        resp = httpx.post(url, json=payload, timeout=5.0)
        if resp.status_code == 201:
            data = resp.json()
            config_data = {
                "agent_id": data["agent_id"],
                "auth_token": data["auth_token"],
                "backend_url": data.get("backend_url", args.backend_url),
                "org_id": org_id,
                "device_uuid": device_uuid
            }
            with open(config_path, "w") as f:
                json.dump(config_data, f, indent=2)
            print("\n✓ Agent registered successfully!")
            print(f"   • Assigned Agent ID: {data['agent_id']}")
            print("   • Configuration saved to agent_config.json")
            print("=" * 60)
            return
        else:
            print(f"\n❌ Enrollment failed (HTTP {resp.status_code}): {resp.text}")
            sys.exit(1)
    except Exception as e:
        print(f"\n❌ Failed to connect to backend API: {e}")
        sys.exit(1)


def heartbeat_loop(backend_url: str, agent_id: str, auth_token: str, stop_event: threading.Event) -> None:
    url = f"{backend_url.rstrip('/')}/api/agents/{agent_id}/heartbeat"
    headers = {"Authorization": f"Bearer {auth_token}"}
    
    while not stop_event.is_set():
        try:
            resp = httpx.post(url, headers=headers, timeout=3.0)
            if resp.status_code == 200:
                logger.debug("Heartbeat ping success.")
            else:
                logger.warning(f"Heartbeat ping failed (HTTP {resp.status_code}): {resp.text}")
        except Exception as e:
            logger.warning(f"Heartbeat exception: {e}")
        
        # Sleep for 30 seconds or until stopped
        stop_event.wait(30.0)


def run_agent(args) -> None:
    config_path = "agent_config.json"
    if not os.path.exists(config_path):
        print("❌ Agent is not enrolled.")
        print("Please run: python -m agent.main --setup")
        sys.exit(1)

    try:
        with open(config_path, "r") as f:
            config_data = json.load(f)
    except Exception as e:
        print(f"❌ Failed to load agent_config.json: {e}")
        sys.exit(1)

    agent_id = config_data.get("agent_id")
    auth_token = config_data.get("auth_token")
    backend_url = config_data.get("backend_url", args.backend_url)
    org_id = config_data.get("org_id")

    if not agent_id or not auth_token:
        print("❌ Invalid configuration file structure in agent_config.json.")
        print("Please re-enroll the agent using --setup.")
        sys.exit(1)

    logger.info("Initializing CipherWatch Endpoint Agent...")
    logger.info(f"   • Agent ID:    {agent_id}")
    logger.info(f"   • Workspace:   {org_id}")
    logger.info(f"   • Backend API: {backend_url}")

    # Test connectivity with a heartbeat
    test_url = f"{backend_url.rstrip('/')}/api/agents/{agent_id}/heartbeat"
    headers = {"Authorization": f"Bearer {auth_token}"}
    try:
        resp = httpx.post(test_url, headers=headers, timeout=5.0)
        if resp.status_code != 200:
            print(f"❌ Authentication failed (HTTP {resp.status_code}): {resp.text}")
            sys.exit(1)
        print("✓ Connected successfully to CipherWatch Backend.")
    except Exception as e:
        print(f"❌ Connection test failed: {e}")
        sys.exit(1)

    # Start Heartbeat Thread
    stop_event = threading.Event()
    hb_thread = threading.Thread(
        target=heartbeat_loop,
        args=(backend_url, agent_id, auth_token, stop_event),
        daemon=True
    )
    hb_thread.start()

    # Start Event Publisher
    publisher = EventPublisher(backend_url=backend_url, agent_id=agent_id, auth_token=auth_token)
    publisher.start()

    # Define common callback for event ingestion
    def on_event_emitted(event):
        # Override device_id with the registered agent_id
        event.device_id = agent_id
        event.user_id = args.user_id
        logger.debug(f"Event captured: type={event.event_type.value if hasattr(event.event_type, 'value') else event.event_type}, user={event.user_id}")
        publisher.publish(event)

    # Start monitors
    monitors = []
    agent_config = AgentConfig()
    
    # 1. Process Monitor
    pm = ProcessMonitor(
        poll_interval=agent_config.poll_interval,
        user_id=args.user_id,
        device_id=agent_id,
        callback=on_event_emitted
    )
    monitors.append(pm)

    # 2. Filesystem Monitor (config-driven multi-path scope)
    fm = FilesystemMonitor(
        config=agent_config,
        user_id=args.user_id,
        device_id=agent_id,
        callback=on_event_emitted,
    )
    monitors.append(fm)

    # 3. USB Monitor
    um = USBMonitor(
        poll_interval=agent_config.poll_interval,
        user_id=args.user_id,
        device_id=agent_id,
        callback=on_event_emitted
    )
    monitors.append(um)

    # 4. Network Monitor
    nm = NetworkMonitor(
        poll_interval=agent_config.poll_interval,
        user_id=args.user_id,
        device_id=agent_id,
        callback=on_event_emitted
    )
    monitors.append(nm)

    # Start all monitors
    logger.info("Starting system event monitors...")
    for monitor in monitors:
        try:
            monitor.start()
        except Exception as e:
            logger.error(f"Failed to start monitor {monitor.__class__.__name__}: {e}")

    logger.info(f"Watch scope: {agent_config.watch_scope}")
    logger.info("Agent running. Press Ctrl+C to terminate.")

    shutdown_triggered = threading.Event()

    def signal_handler(signum, frame):
        logger.info(f"Received shutdown signal ({signal.Signals(signum).name}). Initiating graceful teardown...")
        shutdown_triggered.set()

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    # Keep alive loop
    try:
        while not shutdown_triggered.is_set():
            time.sleep(0.5)
    except KeyboardInterrupt:
        logger.info("KeyboardInterrupt received.")
    finally:
        logger.info("Cleaning up agent resources...")
        # Stop all monitors
        for monitor in monitors:
            try:
                monitor.stop()
            except Exception:
                pass
        # Stop publisher (flushes queued events)
        publisher.stop()
        # Stop heartbeat
        stop_event.set()
        hb_thread.join(timeout=2.0)
        logger.info("Endpoint agent cleanly shut down.")


def main() -> None:
    args = parse_args()
    if args.setup:
        run_setup(args)
    else:
        run_agent(args)


if __name__ == "__main__":
    main()
