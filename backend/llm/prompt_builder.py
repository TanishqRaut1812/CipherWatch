from typing import Any, Dict, List


def build_incident_prompt(session_data: Dict[str, Any]) -> str:
    """
    Construct a structured LLM prompt from session telemetry and risk analysis metadata.

    Strictly adheres to 0% content field policy (only metadata is included).
    """
    user_id = session_data.get("user_id", "UNKNOWN_USER")
    device_id = session_data.get("device_id", "UNKNOWN_DEVICE")
    session_id = session_data.get("session_id", "N/A")
    intent = session_data.get("reconstructed_intent") or session_data.get("predicted_intent", "Unclassified Activity")
    
    raw_risk = session_data.get("risk_score", 0.0)
    risk_score_100 = raw_risk if raw_risk > 1.0 else round(raw_risk * 100.0, 1)
    severity = session_data.get("severity", "CRITICAL" if risk_score_100 >= 70 else "HIGH" if risk_score_100 >= 50 else "MEDIUM")
    
    risk_breakdown = session_data.get("breakdown") or session_data.get("risk_breakdown", {})
    events: List[Dict[str, Any]] = session_data.get("events", [])

    event_timeline_str = ""
    for idx, evt in enumerate(events, 1):
        ts = evt.get("timestamp", "")
        etype = evt.get("event_type", "UNKNOWN")
        meta = evt.get("metadata") or evt.get("event_metadata") or {}
        meta_details = ", ".join(f"{k}={v}" for k, v in meta.items())
        event_timeline_str += f"{idx}. [{ts}] {etype}: {meta_details}\n"

    if not event_timeline_str:
        event_timeline_str = "No detailed event telemetry recorded.\n"

    ml_pts = risk_breakdown.get("isolation_forest_ml", risk_breakdown.get("isolation_forest_score", 0.0))
    rule_pts = risk_breakdown.get("rule_heuristics", risk_breakdown.get("rule_bonus_score", 0.0))
    folder_pts = risk_breakdown.get("folder_sensitivity", 0.0)
    baseline_pts = risk_breakdown.get("baseline_deviation", risk_breakdown.get("z_score_deviation", 0.0))
    graph_pts = risk_breakdown.get("graph_topology", risk_breakdown.get("graph_pattern_score", 0.0))
    drift_pts = risk_breakdown.get("longitudinal_drift", 0.0)

    prompt = f"""You are an expert Tier-3 SOC Analyst reviewing an automated insider threat detection incident from CipherWatch.

### INCIDENT CONTEXT
- User ID: {user_id}
- Device ID: {device_id}
- Session ID: {session_id}
- Reconstructed Operational Intent: {intent}
- Composite Risk Score: {risk_score_100:.1f} / 100.0
- Severity Level: {severity}

### HYBRID RISK BREAKDOWN
- ML Isolation Forest Anomaly Score: {ml_pts} pts
- Heuristic Rule Bonuses: {rule_pts} pts
- Folder Sensitivity Boost: {folder_pts} pts
- Baseline Deviation (Z-Score): {baseline_pts} pts
- Graph Topology Pattern Score: {graph_pts} pts
- 14-Day Longitudinal Slow-Drip Drift: {drift_pts} pts

### CHRONOLOGICAL EVENT TELEMETRY TIMELINE
{event_timeline_str}

### INSTRUCTIONS FOR SOC ANALYST REPORT
Synthesize the technical telemetry above into a clear, executive-ready Incident Explanation.
Format your response using Markdown with the following structured sections:

1. **Executive Overview**: A 2-3 sentence high-level summary of what activity occurred, the severity, and why it triggered an alert.
2. **Key Telemetry Highlights**: Bulleted list of suspicious sequential actions observed in the session timeline.
3. **Risk Analysis & Intent Assessment**: Explain how the metadata correlates to the reconstructed operational intent ('{intent}') and why the composite risk score reached {risk_score_100:.1f}/100.
4. **Recommended SOC Actions**: 3 actionable next steps for incident responders (e.g., isolate host, interview user, revoke credentials).

IMPORTANT: Base your analysis EXCLUSIVELY on the provided metadata timeline. Never invent or speculate about unrecorded payload contents.
"""
    return prompt.strip()

