from typing import Any, Dict, List, Tuple


class IntentClassifier:
    """Reconstructs high-level user operational intent from aggregated session metadata events."""

    ROUTINE_ACTIVITY = "Routine Workspace Activity"
    MASS_ARCHIVING = "Mass Archive Staging"
    USB_EXFILTRATION = "USB Exfiltration Staging"
    CLOUD_EXFILTRATION = "Cloud Exfiltration Staging"
    SCREEN_CLIPBOARD_HARVESTING = "Screen Capture & Clipboard Harvesting"

    def classify_session_intent(self, events: List[Dict[str, Any]]) -> Tuple[str, float]:
        """
        Classifies reconstructed user intent for a session based on metadata event indicators.

        Returns:
            Tuple[str, float]: (intent_label, confidence_score [0.0, 1.0])
        """
        if not events:
            return self.ROUTINE_ACTIVITY, 0.50

        archive_count = 0
        has_sensitive_access = False
        has_usb = False
        has_cloud_upload = False
        capture_count = 0

        for event in events:
            event_type = event.get("event_type")
            meta = event.get("metadata") or event.get("event_metadata") or {}

            if event_type == "filesystem":
                folder_category = str(meta.get("folder_category", "")).lower()
                if folder_category in ["finance", "hr", "executive", "sourcecode"]:
                    has_sensitive_access = True

                extension = str(meta.get("extension", "")).lower()
                if meta.get("is_encrypted_archive") or extension in [".zip", ".7z", ".rar", ".tar", ".gz"]:
                    archive_count += 1

            elif event_type == "usb":
                action = str(meta.get("action", "")).lower()
                if action in ["connected", "mount", "transfer"]:
                    has_usb = True

            elif event_type == "network":
                dest_category = str(meta.get("destination_category", "")).lower()
                if dest_category in ["personal_cloud", "personal_webmail", "unrecognized"]:
                    has_cloud_upload = True

            elif event_type in ["screenshot_event", "clipboard_burst"]:
                capture_count += 1

        # Classify Intent based on composite indicators
        if has_sensitive_access and archive_count > 0 and has_usb:
            return self.USB_EXFILTRATION, 0.95

        if has_sensitive_access and archive_count > 0 and has_cloud_upload:
            return self.CLOUD_EXFILTRATION, 0.90

        if has_sensitive_access and has_usb:
            return self.USB_EXFILTRATION, 0.80

        if has_sensitive_access and has_cloud_upload:
            return self.CLOUD_EXFILTRATION, 0.75

        if capture_count >= 2 and (has_sensitive_access or has_cloud_upload or has_usb):
            return self.SCREEN_CLIPBOARD_HARVESTING, 0.85

        if archive_count >= 2:
            return self.MASS_ARCHIVING, 0.70

        return self.ROUTINE_ACTIVITY, 0.60
