import uuid
from datetime import datetime
from typing import Dict, Any, Optional
from agent.config import AgentConfig
from agent.monitors.base import BaseMonitor


class PrivacyToggleMonitor(BaseMonitor):
    """
    Monitor for optional privacy-sensitive events (screenshot triggers & clipboard bursts).
    
    GUARANTEE:
    - Disabled by default in AgentConfig.
    - NEVER captures image pixels, screen renders, or clipboard text content.
    - Emits privacy-compliant numerical metadata counts and event flags ONLY.
    """

    def __init__(self, config: Optional[AgentConfig] = None):
        super().__init__(name="privacy_toggles")
        self.config = config or AgentConfig()

    def record_screenshot_event(self, display_id: str = "DISPLAY_01") -> Optional[Dict[str, Any]]:
        """
        Record a screenshot event presence flag if enabled in configuration.
        NO pixel content or visual images are ever recorded.
        """
        if not self.config.enable_screenshot_event_monitor:
            self.logger.debug("Screenshot monitor disabled via AgentConfig privacy toggle.")
            return None

        event_payload = {
            "event_id": str(uuid.uuid4()),
            "timestamp": datetime.utcnow().isoformat(),
            "event_type": "SCREENSHOT_TAKEN",
            "metadata": {
                "display_id": display_id,
                "pixel_content_captured": False,
                "privacy_mode": "METADATA_ONLY",
            },
        }
        self.logger.info(f"Recorded screenshot presence flag for display '{display_id}' (NO image captured).")
        return event_payload

    def record_clipboard_burst(self, copy_count: int) -> Optional[Dict[str, Any]]:
        """
        Record a clipboard activity count burst if enabled in configuration.
        NO string text content or sensitive clipboard payloads are ever recorded.
        """
        if not self.config.enable_clipboard_burst_monitor:
            self.logger.debug("Clipboard burst monitor disabled via AgentConfig privacy toggle.")
            return None

        event_payload = {
            "event_id": str(uuid.uuid4()),
            "timestamp": datetime.utcnow().isoformat(),
            "event_type": "CLIPBOARD_BURST",
            "metadata": {
                "copy_event_count": copy_count,
                "text_content_captured": False,
                "privacy_mode": "METADATA_ONLY",
            },
        }
        self.logger.info(f"Recorded clipboard burst count ({copy_count} items) (NO text recorded).")
        return event_payload
