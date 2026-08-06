import logging
import os
from typing import Any, Dict, Optional

from backend.config import settings
from backend.llm.prompt_builder import build_incident_prompt

logger = logging.getLogger("cipherwatch.llm")


class IncidentExplainer:
    """
    Generates plain-English SOC analyst incident explanations using Google Gemini API (google-genai SDK),
    with automatic fallback to deterministic rule-based synthesis.
    """

    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None,
    ):
        self.api_key = (
            api_key
            or getattr(settings, "GEMINI_API_KEY", "")
            or os.environ.get("GEMINI_API_KEY", "")
            or os.environ.get("GOOGLE_API_KEY", "")
        )
        self.model = (
            model
            or getattr(settings, "GEMINI_MODEL", "")
            or os.environ.get("GEMINI_MODEL", "")
            or "gemini-2.5-flash"
        )

    def generate_explanation(self, session_data: Dict[str, Any]) -> str:
        """
        Generate incident explanation for SOC analysts.
        Attempts LLM generation if API key is configured; otherwise uses deterministic fallback.
        """
        prompt = build_incident_prompt(session_data)

        if self.api_key:
            try:
                from google import genai

                client = genai.Client(api_key=self.api_key)
                response = client.models.generate_content(
                    model=self.model,
                    contents=prompt,
                )
                if response and response.text:
                    return response.text
            except Exception as exc:
                logger.warning(f"Gemini API execution failed ({exc}). Falling back to rule-based explainer.")

        return self._generate_fallback_explanation(session_data)

    def _generate_fallback_explanation(self, session_data: Dict[str, Any]) -> str:
        """Generate a structured, deterministic plain-English report when LLM API is unavailable."""
        user_id = session_data.get("user_id", "Unknown User")
        intent = session_data.get("reconstructed_intent", "Unclassified Activity")
        risk_score = session_data.get("risk_score", 0.0)
        severity = session_data.get("severity", "MEDIUM")
        events = session_data.get("events", [])
        event_count = len(events)

        # Highlight key metadata features
        has_usb = any(e.get("event_type") == "USB_INSERT" for e in events)
        has_archive = any(
            e.get("event_type") == "FILE_CREATE" and e.get("metadata", {}).get("is_encrypted_archive")
            for e in events
        )
        has_network = any(e.get("event_type") == "NETWORK_CONNECTION" for e in events)

        highlights = []
        if has_usb:
            highlights.append("- External USB storage device insertion recorded during active session.")
        if has_archive:
            highlights.append("- Creation of encrypted archive file (.zip/.7z/.tar) detected.")
        if has_network:
            highlights.append("- Outbound network metadata transfer to cloud endpoint identified.")
        if not highlights:
            highlights.append(f"- Sequence of {event_count} endpoint telemetry events recorded.")

        highlights_str = "\n".join(highlights)

        return f"""### Executive Overview
CipherWatch detected a **{severity}** severity security incident (Risk Score: **{risk_score:.2f}**) for user `{user_id}`. The correlated endpoint session matches operational pattern: **{intent}**.

### Key Telemetry Highlights
{highlights_str}

### Risk Analysis & Intent Assessment
The hybrid composite risk scoring engine flagged this session due to anomalous sequence timing and policy deviations. The sequence aligns with **{intent}**, driven by rule boosters and baseline volume variations.

### Recommended SOC Actions
1. **Host Isolation**: Inspect workstation `{session_data.get('device_id', 'Device')}` for unauthorized data transfers.
2. **User Audit**: Contact user `{user_id}` to verify business justification for observed activity sequence.
3. **Log Retention**: Preserve endpoint telemetry and network connection logs for forensic review.
"""
