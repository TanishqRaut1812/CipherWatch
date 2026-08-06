"""
Session Feature Extractor Module.

Transforms raw session metadata payloads into structured numerical feature vectors
for scikit-learn intent classification models.
"""

from datetime import datetime
import math
from typing import Any, Dict, List


class SessionFeatureExtractor:
    """Extracts numerical features from session event sequences for ML classification."""

    FEATURE_NAMES = [
        "has_archive",
        "has_usb",
        "is_off_hours",
        "file_count",
        "has_cloud_destination",
        "has_sensitive_folder",
        "has_screen_clipboard_burst",
        "total_bytes_log",
    ]

    @classmethod
    def feature_names(cls) -> List[str]:
        """Return ordered list of extracted feature names."""
        return cls.FEATURE_NAMES

    def extract_features(self, session_data: Dict[str, Any]) -> List[float]:
        """
        Transforms a session payload dictionary into an 8-dimensional numerical feature vector:
        [has_archive, has_usb, is_off_hours, file_count, has_cloud_destination,
         has_sensitive_folder, has_screen_clipboard_burst, total_bytes_log]
        """
        events = session_data.get("events", [])

        has_archive = 0.0
        has_usb = 0.0
        is_off_hours = 0.0
        file_count = 0.0
        has_cloud = 0.0
        has_sensitive = 0.0
        has_screen_clip = 0.0
        total_bytes = 0.0

        for evt in events:
            evt_type = evt.get("event_type", "")
            meta = evt.get("metadata") or evt.get("event_metadata") or {}
            ts_str = evt.get("timestamp")

            # Check timestamp off-hours (before 8 AM or after 7 PM or weekends)
            if ts_str:
                try:
                    ts = datetime.fromisoformat(str(ts_str).replace("Z", "+00:00"))
                    if ts.hour < 8 or ts.hour >= 19 or ts.weekday() >= 5:
                        is_off_hours = 1.0
                except Exception:
                    pass

            # Filesystem events
            if evt_type in ("FILE_CREATE", "FILE_MODIFY", "filesystem"):
                file_count += 1.0
                ext = str(meta.get("extension", "")).lower()
                is_enc = meta.get("is_encrypted_archive", False) or ext in (".zip", ".7z", ".rar", ".tar", ".gz")
                if is_enc:
                    has_archive = 1.0
                if meta.get("is_sensitive_folder") or meta.get("folder_category") in ("finance", "hr", "executive", "sourcecode"):
                    has_sensitive = 1.0
                total_bytes += float(meta.get("file_size_bytes", 0))

            # USB events
            elif evt_type in ("USB_INSERT", "usb"):
                has_usb = 1.0

            # Network / Cloud events
            elif evt_type in ("NETWORK_CONNECTION", "network"):
                has_cloud = 1.0
                total_bytes += float(meta.get("bytes_sent", 0))

            # Screen / Clipboard events
            elif evt_type in ("SCREENSHOT_TAKEN", "CLIPBOARD_BURST", "screenshot_event", "clipboard_burst"):
                has_screen_clip = 1.0

        total_bytes_log = math.log1p(total_bytes)

        return [
            has_archive,
            has_usb,
            is_off_hours,
            file_count,
            has_cloud,
            has_sensitive,
            has_screen_clip,
            total_bytes_log,
        ]
