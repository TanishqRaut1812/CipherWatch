import sys
import os
import shutil
import socket
import platform
import argparse
import getpass
import json
import time
import subprocess
from pathlib import Path
from datetime import datetime
from typing import Optional
import httpx

from agent.paths import paths
from agent.config import AgentConfig, setup_logger, load_agent_config, save_agent_config
from agent.utils.machine_id import get_machine_id
from agent.process_manager import ProcessManager
from agent.runtime import AgentRuntime
from agent.service import ServiceManager

VERSION = "1.0.0"
BUILD_DATE = "2026-08-06"


def get_git_commit_hash() -> str:
    """Attempt to retrieve git commit hash if running in a repository."""
    try:
        res = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            capture_output=True,
            text=True,
            timeout=2.0
        )
        if res.returncode == 0:
            return res.stdout.strip()
    except Exception:
        pass
    return "standalone-build"


def cmd_version(args) -> None:
    """Print agent version, build date, git commit hash, and runtime environment."""
    commit_hash = get_git_commit_hash()
    print("=" * 60)
    print(f"🛡️  CipherWatch Standalone Linux Endpoint Agent v{VERSION}")
    print("============================================================")
    print(f"   • Build Date:       {BUILD_DATE}")
    print(f"   • Git Commit:       {commit_hash}")
    print(f"   • Python Runtime:   {platform.python_version()}")
    print(f"   • System OS:        {platform.system()} ({platform.release()})")
    print(f"   • Architecture:     {platform.machine()}")
    print(f"   • Executable Path:  {sys.executable}")
    print(f"   • Base Config Dir:  {paths.base_dir}")
    print("============================================================")


def cmd_setup(args) -> None:
    """Interactive enrollment CLI wizard."""
    print("=" * 60)
    print("🛡️  CipherWatch Linux Endpoint Agent Enrollment")
    print("============================================================")

    server_url = getattr(args, "server_url", None)
    if not server_url:
        existing_cfg = load_agent_config()
        default_url = existing_cfg.get("backend_url", "http://localhost:8000") if existing_cfg else "http://localhost:8000"
        server_url = input(f"Enter Server URL [{default_url}]: ").strip() or default_url

    org_id = getattr(args, "org_id", None)
    if not org_id:
        existing_cfg = load_agent_config()
        default_org = existing_cfg.get("organization_id") or existing_cfg.get("org_id", "") if existing_cfg else ""
        prompt_txt = f"Enter Organization ID [{default_org}]: " if default_org else "Enter Organization ID: "
        org_id = input(prompt_txt).strip() or default_org

    enrollment_key = getattr(args, "enrollment_key", None) or getattr(args, "reg_key", None)
    if not enrollment_key:
        enrollment_key = input("Enter Enrollment Key: ").strip()

    if not server_url or not org_id or not enrollment_key:
        print("❌ Server URL, Organization ID, and Enrollment Key are required.")
        sys.exit(1)

    machine_id = get_machine_id()
    hostname = socket.gethostname()
    username = getpass.getuser()
    os_name = platform.system()
    os_version = platform.version() or platform.release()
    architecture = platform.machine() or platform.architecture()[0]

    payload = {
        "org_id": org_id,
        "organization_id": org_id,
        "enrollment_key": enrollment_key,
        "hostname": hostname,
        "username": username,
        "os": os_name,
        "os_version": os_version,
        "architecture": architecture,
        "machine_id": machine_id,
        "agent_version": VERSION,
        "device_name": hostname,
    }

    url = f"{server_url.rstrip('/')}/api/agent/enroll"
    print(f"\nConnecting to backend API at {url}...")
    try:
        resp = httpx.post(url, json=payload, timeout=6.0)
        if resp.status_code in (200, 201):
            data = resp.json()
            config_data = {
                "backend_url": data.get("backend_url", server_url),
                "org_id": data.get("organization_id", org_id),
                "organization_id": data.get("organization_id", org_id),
                "agent_id": data["agent_id"],
                "machine_id": machine_id,
                "auth_token": data["auth_token"],
                "enrolled_at": datetime.utcnow().isoformat() + "Z",
                "hostname": hostname,
            }
            save_agent_config(config_data)
            print("\n✅ Endpoint agent enrolled successfully!")
            print(f"   • Assigned Agent ID:  {data['agent_id']}")
            print(f"   • Organization ID:    {data.get('organization_id', org_id)}")
            print(f"   • Machine Identifier: {machine_id}")
            print(f"   • Config Saved To:    {paths.config_file}")
            print("============================================================")
            print("\nNext steps:")
            print("1. cipherwatch-agent setup")
            print("2. Development:")
            print("   cipherwatch-agent dev")
            print("   OR")
            print("   Production:")
            print("   sudo systemctl start cipherwatch-agent")
            print("============================================================")
        else:
            print(f"\n❌ Enrollment failed (HTTP {resp.status_code}): {resp.text}")
            sys.exit(1)
    except Exception as e:
        print(f"\n❌ Failed to connect to backend server: {e}")
        sys.exit(1)


def cmd_dev(args) -> None:
    """Development mode: Runs in foreground with verbose console logging. Ctrl+C supported. Used only during development."""
    running_pid = ProcessManager.get_running_pid()
    if running_pid is not None:
        print("❌ CipherWatch Agent is already running.")
        print(f"   • Active Process PID: {running_pid}")
        print("   • Stop existing instance before running in dev mode.")
        sys.exit(1)

    cfg = load_agent_config()
    if not cfg:
        print("❌ CipherWatch Agent is not enrolled.")
        print("Please run: cipherwatch-agent setup")
        sys.exit(1)

    # Enable console logging for dev mode
    setup_logger("cipherwatch-agent-dev", debug=True, console_output=True)

    runtime = AgentRuntime(config_data=cfg, dev_mode=True)
    runtime.start(dev_mode=True)


def cmd_start(args) -> None:
    """Start installed systemd service (equivalent to sudo systemctl start cipherwatch-agent)."""
    running_pid = ProcessManager.get_running_pid()
    if running_pid is not None:
        print(f"CipherWatch Agent systemd service is already active (PID: {running_pid}).")
        return

    cfg = load_agent_config()
    if not cfg:
        print("❌ CipherWatch Agent is not enrolled.")
        print("Please run: cipherwatch-agent setup")
        sys.exit(1)

    print("Starting cipherwatch-agent systemd service...")
    ok, msg = ServiceManager.start_service()
    if ok:
        print(f"✅ {msg}")
    else:
        print(f"⚠️ Service control: {msg}")
        print("You can also run manually: sudo systemctl start cipherwatch-agent")


def cmd_stop(args) -> None:
    """Stop installed service (equivalent to sudo systemctl stop cipherwatch-agent)."""
    print("Stopping cipherwatch-agent systemd service...")
    ok, msg = ServiceManager.stop_service()
    if ok:
        print(f"✅ {msg}")
    else:
        # Fallback to direct process termination if systemctl was unprivileged
        running_pid = ProcessManager.get_running_pid()
        if running_pid is not None:
            ok_proc, msg_proc = ProcessManager.stop_running_instance(timeout_seconds=6.0)
            if ok_proc:
                print(f"✅ {msg_proc}")
            else:
                print(f"❌ {msg_proc}")
                sys.exit(1)
        else:
            print("CipherWatch Agent is not running.")


def cmd_restart(args) -> None:
    """Restart installed service (equivalent to sudo systemctl restart cipherwatch-agent)."""
    print("Restarting cipherwatch-agent systemd service...")
    ok, msg = ServiceManager.restart_service()
    if ok:
        print(f"✅ {msg}")
    else:
        print(f"⚠️ {msg}")
        print("You can also run manually: sudo systemctl restart cipherwatch-agent")


def cmd_sync(args) -> None:
    """Force immediate synchronization (heartbeat, backend connectivity check, state refresh)."""
    cfg = load_agent_config()
    if not cfg:
        print("❌ CipherWatch Agent is not enrolled.")
        sys.exit(1)

    print("🔄 Forcing immediate agent synchronization...")
    runtime = AgentRuntime(config_data=cfg)
    success = runtime.send_heartbeat_sync()
    if success:
        print("✅ Immediate agent heartbeat and backend connectivity verified.")
    else:
        print("⚠️ Synchronization completed with warnings.")


def cmd_status(args) -> None:
    """Display status dashboard including service status, enrollment status, IDs, PID, heartbeat, event, paths."""
    print("=" * 60)
    print("🛡️  CipherWatch Linux Endpoint Agent Status")
    print("============================================================")

    cfg = load_agent_config()
    enrolled = cfg is not None and bool(cfg.get("agent_id")) and bool(cfg.get("auth_token"))

    running_pid = ProcessManager.get_running_pid()
    pid_str = str(running_pid) if running_pid else "None (Stopped)"

    print(f"   • Service Status:    {ServiceManager.get_service_status()}")
    print(f"   • Enrollment Status: { 'ENROLLED ✓' if enrolled else 'NOT ENROLLED ❌' }")
    if enrolled:
        print(f"   • Agent ID:          {cfg.get('agent_id')}")
        print(f"   • Organization ID:   {cfg.get('organization_id') or cfg.get('org_id')}")
        print(f"   • Hostname:          {socket.gethostname()}")
        print(f"   • Server URL:        {cfg.get('backend_url')}")

    print(f"   • Process PID:       {pid_str}")

    # Read state file metrics if present
    last_hb = "None"
    last_ev = "None"
    if paths.state_file.exists():
        try:
            with open(paths.state_file, "r") as f:
                state = json.load(f)
                last_hb = state.get("last_heartbeat") or "None"
                last_ev = state.get("last_event_sent") or "None"
        except Exception:
            pass

    print(f"   • Last Heartbeat:    {last_hb}")
    print(f"   • Last Event:        {last_ev}")
    print(f"   • Config Path:       {paths.config_file}")
    print(f"   • Log Path:          {paths.main_log_file}")
    print("============================================================")


def cmd_logs(args) -> None:
    """Show recent logs."""
    num_lines = getattr(args, "lines", 30)
    log_file = paths.main_log_file

    if not log_file.exists():
        print(f"ℹ️ No log file found at {log_file}")
        return

    print(f"📋 Showing recent logs ({log_file}):")
    print("-" * 60)
    try:
        with open(log_file, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()
            for line in lines[-num_lines:]:
                print(line.rstrip())
    except Exception as e:
        print(f"❌ Could not read log file: {e}")
    print("-" * 60)


def cmd_uninstall(args) -> None:
    """Uninstall agent (stop/disable service, remove unit file & binary, optionally purge config)."""
    print("=" * 60)
    print("🗑️  Uninstalling CipherWatch Standalone Linux Endpoint Agent")
    print("============================================================")

    # 1. Stop service & process if running
    try:
        subprocess.run(["systemctl", "stop", "cipherwatch-agent.service"], capture_output=True)
    except Exception:
        pass

    running_pid = ProcessManager.get_running_pid()
    if running_pid is not None:
        ProcessManager.stop_running_instance(timeout_seconds=6.0)

    # 2. Disable systemd service and remove unit file
    try:
        subprocess.run(["systemctl", "disable", "cipherwatch-agent.service"], capture_output=True)
        service_file = Path("/etc/systemd/system/cipherwatch-agent.service")
        if service_file.exists():
            service_file.unlink()
            subprocess.run(["systemctl", "daemon-reload"], capture_output=True)
            print("✓ Removed systemd service cipherwatch-agent.service")
    except Exception as e:
        print(f"⚠️ Warning during systemd service cleanup: {e}")

    # 3. Remove installed binary
    binary_path = Path("/usr/local/bin/cipherwatch-agent")
    if binary_path.exists():
        try:
            binary_path.unlink()
            print("✓ Removed installed binary at /usr/local/bin/cipherwatch-agent")
        except Exception as e:
            print(f"⚠️ Warning removing binary at {binary_path}: {e}")

    # 4. Handle --purge option
    if getattr(args, "purge", False):
        base_dir = paths.base_dir
        if base_dir.exists():
            try:
                shutil.rmtree(base_dir, ignore_errors=True)
                print(f"✓ Purged configuration, logs, cache, state, and PID file at {base_dir}")
            except Exception as e:
                print(f"⚠️ Warning purging {base_dir}: {e}")
    else:
        print(f"ℹ️ Configuration preserved at {paths.base_dir}. Use --purge to remove configuration.")

    print("============================================================")
    print("✅ Uninstall completed successfully.")
    print("============================================================")


def run_internal_service_mode() -> None:
    """Internal service mode invoked by systemd via cipherwatch-agent --service.

    Bypasses interactive CLI prompts and directly launches AgentRuntime background process.
    """
    running_pid = ProcessManager.get_running_pid()
    if running_pid is not None:
        sys.exit(0)

    cfg = load_agent_config()
    if not cfg:
        sys.exit(1)

    setup_logger("cipherwatch-agent-service", debug=False, console_output=False)
    runtime = AgentRuntime(config_data=cfg, dev_mode=False)
    runtime.start(dev_mode=False)


def main():
    """Main CLI entrypoint for cipherwatch-agent on Linux."""
    # Check for top-level internal service mode flag (--service)
    if "--service" in sys.argv:
        run_internal_service_mode()
        return

    parser = argparse.ArgumentParser(
        prog="cipherwatch-agent",
        description="CipherWatch Standalone Linux Endpoint Security Agent CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    subparsers = parser.add_subparsers(dest="command", help="Agent operational command")

    # cipherwatch-agent setup
    p_setup = subparsers.add_parser("setup", help="Interactive enrollment wizard")
    p_setup.add_argument("-s", "--server-url", help="CipherWatch backend server URL")
    p_setup.add_argument("-o", "--org-id", help="Organization ID")
    p_setup.add_argument("-k", "--enrollment-key", help="Organization enrollment key")
    p_setup.add_argument("--reg-key", help="Legacy enrollment key alias")

    # cipherwatch-agent dev
    subparsers.add_parser("dev", help="Developer mode (foreground, verbose, systemd not required)")

    # cipherwatch-agent start
    subparsers.add_parser("start", help="Start cipherwatch-agent systemd service")

    # cipherwatch-agent stop
    subparsers.add_parser("stop", help="Stop cipherwatch-agent systemd service")

    # cipherwatch-agent restart
    subparsers.add_parser("restart", help="Restart cipherwatch-agent systemd service")

    # cipherwatch-agent status
    subparsers.add_parser("status", help="Display agent status dashboard")

    # cipherwatch-agent sync
    subparsers.add_parser("sync", help="Force immediate agent heartbeat and status sync")

    # cipherwatch-agent logs
    p_logs = subparsers.add_parser("logs", help="Display recent log entries")
    p_logs.add_argument("-n", "--lines", type=int, default=30, help="Number of log lines to show (default: 30)")

    # cipherwatch-agent uninstall
    p_uninst = subparsers.add_parser("uninstall", help="Uninstall agent and systemd service")
    p_uninst.add_argument("--purge", action="store_true", help="Purge configuration and logs directory (/etc/cipherwatch)")

    # cipherwatch-agent version
    subparsers.add_parser("version", help="Print version, build date, and git commit")

    # Global flags
    parser.add_argument("-v", "--version-flag", action="store_true", help="Print agent version")

    args = parser.parse_args()

    if args.version_flag:
        cmd_version(args)
        return

    if not args.command:
        parser.print_help()
        sys.exit(0)

    commands = {
        "setup": cmd_setup,
        "dev": cmd_dev,
        "start": cmd_start,
        "stop": cmd_stop,
        "restart": cmd_restart,
        "status": cmd_status,
        "sync": cmd_sync,
        "logs": cmd_logs,
        "uninstall": cmd_uninstall,
        "version": cmd_version,
    }

    handler = commands.get(args.command)
    if handler:
        handler(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
