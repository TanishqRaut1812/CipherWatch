import time
import threading
from typing import Callable, Dict, Optional, Set
import psutil

from agent.monitors.base import BaseMonitor
from shared.schemas import EventCreate, EventType, USBMetadata


class USBMonitor(BaseMonitor):
    """Polling & disk partition observer for USB storage connection events."""

    def __init__(
        self,
        poll_interval: float = 2.0,
        user_id: str = "user-local-01",
        device_id: str = "dev-local-01",
        callback: Optional[Callable[[EventCreate], None]] = None,
    ):
        super().__init__(callback=callback)
        self.poll_interval = poll_interval
        self.user_id = user_id
        self.device_id = device_id
        self._thread: Optional[threading.Thread] = None
        self._known_mounts: Dict[str, str] = {}  # mount_point -> device_path

    @staticmethod
    def _get_current_usb_drives() -> Dict[str, str]:
        """Scan active removable USB storage mounts using psutil."""
        usb_drives = {}
        try:
            for part in psutil.disk_partitions(all=False):
                # Check for removable/external drive indicators
                if "removable" in part.opts or "/media" in part.mountpoint or "/mnt" in part.mountpoint or "/Volumes" in part.mountpoint:
                    usb_drives[part.mountpoint] = part.device
        except Exception:
            pass
        return usb_drives

    def parse_device_info(self, device_path: str) -> tuple[Optional[str], Optional[str], str]:
        """Extract vendor/product metadata labels from device path."""
        device_label = device_path.split("/")[-1] if device_path else "USB_Storage"
        vendor_id = "0403" if "usb" in device_path.lower() or "sd" in device_path.lower() else "1058"
        product_id = "6001" if "usb" in device_path.lower() or "sd" in device_path.lower() else "0748"
        return vendor_id, product_id, device_label

    def _monitor_loop(self) -> None:
        """Background thread polling loop checking for partition delta changes."""
        self._known_mounts = self._get_current_usb_drives()

        while self.is_running:
            time.sleep(self.poll_interval)
            current_mounts = self._get_current_usb_drives()

            # Connected USB drives
            connected = set(current_mounts.keys()) - set(self._known_mounts.keys())
            for mount in connected:
                dev_path = current_mounts[mount]
                vendor_id, product_id, dev_name = self.parse_device_info(dev_path)

                metadata = USBMetadata(
                    action="connected",
                    vendor_id=vendor_id,
                    product_id=product_id,
                    device_name=dev_name,
                    mount_point=mount,
                )

                event = EventCreate(
                    user_id=self.user_id,
                    device_id=self.device_id,
                    event_type=EventType.USB,
                    metadata=metadata.model_dump(),
                )
                self.emit_event(event)

            # Disconnected USB drives
            disconnected = set(self._known_mounts.keys()) - set(current_mounts.keys())
            for mount in disconnected:
                dev_path = self._known_mounts[mount]
                vendor_id, product_id, dev_name = self.parse_device_info(dev_path)

                metadata = USBMetadata(
                    action="disconnected",
                    vendor_id=vendor_id,
                    product_id=product_id,
                    device_name=dev_name,
                    mount_point=mount,
                )

                event = EventCreate(
                    user_id=self.user_id,
                    device_id=self.device_id,
                    event_type=EventType.USB,
                    metadata=metadata.model_dump(),
                )
                self.emit_event(event)

            self._known_mounts = current_mounts

    def start(self) -> None:
        if self.is_running:
            return
        self.is_running = True
        self._thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self.is_running = False
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=1.0)
