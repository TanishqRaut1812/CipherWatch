import hashlib
import os
import platform
import subprocess
import uuid

def get_machine_id() -> str:
    """Retrieve a stable, unique machine identifier for the endpoint host and return its SHA-256 hash."""
    raw_id = ""
    system_os = platform.system()

    if system_os == "Linux":
        # 1. Try /etc/machine-id
        if os.path.exists("/etc/machine-id"):
            try:
                with open("/etc/machine-id", "r") as f:
                    raw_id = f.read().strip()
            except Exception:
                pass
        # 2. Try /var/lib/dbus/machine-id
        if not raw_id and os.path.exists("/var/lib/dbus/machine-id"):
            try:
                with open("/var/lib/dbus/machine-id", "r") as f:
                    raw_id = f.read().strip()
            except Exception:
                pass

    elif system_os == "Windows":
        # Try reading Windows Registry MachineGuid via winreg or PowerShell
        try:
            import winreg
            registry = winreg.ConnectRegistry(None, winreg.HKEY_LOCAL_MACHINE)
            key = winreg.OpenKey(registry, r"SOFTWARE\Microsoft\Cryptography")
            raw_id, _ = winreg.QueryValueEx(key, "MachineGuid")
        except Exception:
            pass

    elif system_os == "Darwin":  # macOS
        try:
            output = subprocess.check_output(["ioreg", "-rd1", "-c", "IOPlatformExpertDevice"], stderr=subprocess.DEVNULL)
            for line in output.decode("utf-8", errors="ignore").splitlines():
                if "IOPlatformUUID" in line:
                    parts = line.split("=")
                    if len(parts) > 1:
                        raw_id = parts[1].strip().replace('"', '')
                    break
        except Exception:
            pass

    # Fallback to MAC address + Node hostname hardware hash if OS-specific machine ID fails
    if not raw_id:
        mac_addr = hex(uuid.getnode())
        hostname = platform.node()
        raw_id = f"{hostname}-{mac_addr}"

    # Return 64-character SHA-256 hash
    return hashlib.sha256(raw_id.encode("utf-8")).hexdigest()
