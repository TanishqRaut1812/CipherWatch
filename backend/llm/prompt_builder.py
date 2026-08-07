from typing import Any, Dict, List


def build_incident_prompt(session_data: Dict[str, Any]) -> str:
    """
    Construct a structured LLM prompt from computed decision engine output.

    Strictly adheres to 0% content field policy (only metadata is included).
    The AI acts EXCLUSIVELY as an explainability layer. Risk, Verdict, and Confidence
    are pre-computed by deterministic engines.
    """
    user_id = session_data.get("user_id", "UNKNOWN_USER")
    device_id = session_data.get("device_id", "UNKNOWN_DEVICE")
    session_id = session_data.get("session_id", "N/A")
    behavior = session_data.get("template_name") or session_data.get("reconstructed_intent") or "Nominal Baseline Activity"
    
    raw_risk = session_data.get("risk_score", 15.0)
    risk_score = round(raw_risk if raw_risk > 1.0 else raw_risk * 100.0, 1)
    confidence = round(session_data.get("confidence_score", 85.0), 1)
    current_stage = session_data.get("current_stage", 1)
    total_stages = session_data.get("total_stages", 5)
    predicted_next = session_data.get("predicted_next_action", "N/A")

    # Deterministic Verdict calculation
    if risk_score < 25:
        verdict = "NOMINAL SECURITY POSTURE"
    elif risk_score < 50:
        verdict = "MONITORING & LOGGING ENFORCED"
    elif risk_score < 75:
        verdict = "ELEVATED SOC INVESTIGATION"
    elif risk_score <= 90:
        verdict = "HIGH RISK EXFILTRATION DETECTED"
    else:
        verdict = "CONTAINMENT & ISOLATION RECOMMENDED"

    events: List[Dict[str, Any]] = session_data.get("events") or session_data.get("recent_events", [])
    evidence_items = []
    for idx, evt in enumerate(events, 1):
        desc = evt.get("desc") or evt.get("name") or evt.get("src_path") or evt.get("event_type") or "Telemetry Event"
        note = evt.get("note") or evt.get("meta") or ""
        evidence_items.append(f"• Stage {idx} Evidence: {desc} ({note})" if note else f"• Stage {idx} Evidence: {desc}")

    evidence_str = "\n".join(evidence_items) if evidence_items else "• Baseline telemetry activity within normal parameters."

    prompt = f"""You are a Tier-3 SOC Analyst providing an Explainability Synthesis for an incident evaluated by CipherWatch.

### COMPUTED DECISION ENGINE OUTPUT
- Risk Score: {risk_score} / 100
- Confidence Score: {confidence}%
- Matched Behavior Template: {behavior}
- Current Stage: {current_stage} / {total_stages}
- Predicted Next Action: {predicted_next}
- Computed SOC Verdict: {verdict}

### RECORDED EVIDENCE
{evidence_str}

### INSTRUCTIONS FOR EXPLAINABILITY SYNTHESIS
You are a SOC analyst. Do NOT determine the risk or verdict. Those have ALREADY been computed by the deterministic backend engines.
Explain WHY this verdict was reached in clear, authoritative SOC language.

Format your response using Markdown with the following sections:
1. **Executive Overview**: A 2-sentence summary explaining why the computed verdict ({verdict}) was reached for {user_id} on {device_id}.
2. **Attack Progression & Evidence**: Summarize how the supplied evidence demonstrates progression through Stage {current_stage} of {total_stages} in the {behavior} template.
3. **Verdict Justification**: Explain why the {risk_score}/100 risk score and {confidence}% confidence justify the {verdict} action.

CRITICAL RULES:
- Use ONLY the supplied evidence listed above.
- Do NOT invent events, IPs, or file contents.
- Do NOT contradict the supplied scores, verdict, or stage.
"""
    return prompt.strip()

