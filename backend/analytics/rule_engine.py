from typing import Dict, Any


class RuleEngine:
    """Evaluates rule-based heuristic risk boosters on event metadata."""

    OFF_HOURS_BONUS = 0.25
    ENCRYPTED_ARCHIVE_BONUS = 0.30
    USB_MOUNT_BONUS = 0.15

    SENSITIVITY_BONUSES = {
        "Executive": 0.30,
        "Finance": 0.25,
        "Confidential": 0.25,
        "HR": 0.20,
        "SourceCode": 0.20,
        "Sensitive": 0.15,
        "Standard": 0.0,
        "Public": 0.0,
    }

    DESTINATION_BONUSES = {
        "PersonalCloud": 0.25,
        "ExternalUSB": 0.20,
        "SuspiciousIP": 0.30,
        "CorporateStorage": 0.0,
        "InternalNetwork": 0.0,
    }

    def compute_rule_bonus(
        self, event_type: str, metadata: Dict[str, Any], timestamp_hour: int
    ) -> float:
        """Calculate cumulative heuristic risk score bonus (capped between 0.0 and 1.0)."""
        bonus = 0.0

        # 1. Off-hours activity check (before 6 AM or after 8 PM)
        if timestamp_hour < 6 or timestamp_hour >= 20:
            bonus += self.OFF_HOURS_BONUS

        # 2. Encrypted archive check
        if metadata.get("is_encrypted_archive", False):
            bonus += self.ENCRYPTED_ARCHIVE_BONUS

        # 3. Folder / Data sensitivity classification
        folder_category = metadata.get("folder_category", "Standard")
        bonus += self.SENSITIVITY_BONUSES.get(folder_category, 0.0)

        # 4. Network / Storage destination risk
        destination_category = metadata.get("destination_category")
        if destination_category:
            bonus += self.DESTINATION_BONUSES.get(destination_category, 0.0)

        # 5. USB device mount action
        if event_type == "usb" and metadata.get("action") == "mount":
            bonus += self.USB_MOUNT_BONUS

        return min(1.0, bonus)
