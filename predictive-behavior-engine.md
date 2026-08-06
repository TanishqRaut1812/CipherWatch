# Task: Predictive Behavior Detection Engine Implementation

## Objective
Build a deterministic, modular Predictive Behavior Detection Engine for CipherWatch that reconstructs event sequences into behavioral sessions, tracks attack FSM state transitions, calculates dynamic risk and confidence progression, predicts likely next attacker steps, maps MITRE ATT&CK techniques, and displays threat sequences in the SOC dashboard.

---

## 1. Architecture Overview

```
Endpoint Agent
      ↓
Backend API (/api/events/ingest)
      ↓
Database Event Persistence
      ↓
Session Reconstruction Engine (BehavioralSessionManager)
      ↓
Behavior Template Auto-Loader (behavior_templates/*.json)
      ↓
Behavior State Machine (FSM Evaluator)
      ↓
Risk & Confidence Engine (Dynamic Stage & Time Decay Scorer)
      ↓
Prediction Engine (Next Action & Probability & Time Window)
      ↓
MITRE ATT&CK Mapper (Technique Sequence Tracker)
      ↓
Behavioral Sessions DB Model (BehavioralSessionModel)
      ↓
REST & WebSocket API Endpoints (/api/behavioral-sessions)
      ↓
Frontend Dashboard (Predictive Behavior Intelligence Component)
```

---

## 2. Component Design & Deliverables

### A. Behavior Templates (`backend/behavior_templates/`)
Create 6 standardized JSON templates:
1. `usb_data_exfiltration.json` (USB Connect → Sensitive Folder → Archive → USB Write → USB Removal)
2. `cloud_data_exfiltration.json` (Cloud Storage → Mass File Access → Encrypted Archive → High Egress → Logout)
3. `credential_theft.json` (LSASS / SAM Read → Registry Dump → Privilege Escalation → Credential Export)
4. `ransomware_attack.json` (Suspicious Exec → Shadow Copy Deletion → Rapid FS Encryption → Ransom Note)
5. `suspicious_reconnaissance.json` (Network Scanner → Port Scan → User Enumeration → AD Share Discovery)
6. `insider_data_collection.json` (Off-Hours Login → File Search → Confidential DB Query → Staging File)

### B. Backend Predictive Engine (`backend/analytics/predictive_engine.py`)
- `TemplateLoader`: Dynamically loads all `.json` files from `behavior_templates/`.
- `BehaviorFSM`: Finite State Machine evaluator matching event sequences to template stages.
- `BehaviorRiskEngine`: Non-linear risk scoring based on stage progression, velocity, and template match quality.
- `ConfidenceEngine`: Tracks sequence match probability separately from risk score.
- `PredictionEngine`: Calculates likely next action, probability percentage, and estimated time window.
- `MITREMapper`: Maps completed, current, and predicted stages to MITRE ATT&CK IDs (e.g., T1091, T1005, T1560, T1041).
- `SessionReconstructionEngine`: Manages multi-session tracking per agent/user, inactive 15-min decay, and DB persistence.

### C. Database Schema (`backend/db/models.py`)
- `BehavioralSessionModel`:
  - `id`, `session_uuid`, `org_id`, `agent_id`, `user_id`, `device_id`
  - `template_id`, `template_name`, `current_stage`, `total_stages`
  - `risk_score`, `confidence_score`
  - `predicted_next_action`, `predicted_probability`, `estimated_time_to_next_stage`
  - `current_mitre_technique`, `mitre_techniques_json`
  - `recent_events_json`, `status`, `start_time`, `last_activity`, `closed_at`

### D. Backend API Routes (`backend/routes/behavioral.py`)
- `GET /api/behavioral-sessions/active` (List active predictive sessions by org_id or agent_id)
- `GET /api/behavioral-sessions/templates` (List all loaded behavior templates)
- `POST /api/behavioral-sessions/evaluate` (Manually trigger evaluation or view predictions)
Hook into `backend/routes/events.py` for real-time evaluation upon event ingestion.

### E. Frontend Dashboard Component (`frontend/src/components/PredictiveBehaviorWidget.jsx`)
- Interactive, brutalist-styled Predictive Behavior Intelligence panel.
- Displays:
  - Active Threat Sequences with progress bars (Stage X / Y)
  - Risk Score gauge (0-100) & Confidence gauge (0-100%)
  - Predicted Next Action + Probability (%) + Estimated Time
  - MITRE ATT&CK technique breakdown (Completed → Current → Predicted)
  - Interactive event timeline for each behavioral session

---

## 3. Step-by-Step Implementation Plan

1. **Step 1**: Create `backend/behavior_templates/` directory and populate all 6 JSON attack chain templates.
2. **Step 2**: Add `BehavioralSessionModel` to `backend/db/models.py`.
3. **Step 3**: Build `backend/analytics/predictive_engine.py` with `TemplateLoader`, `BehaviorFSM`, `RiskEngine`, `ConfidenceEngine`, `PredictionEngine`, `MITREMapper`, and `SessionReconstructionEngine`.
4. **Step 4**: Create `backend/routes/behavioral.py` and register it in `backend/main.py`.
5. **Step 5**: Integrate `SessionReconstructionEngine.process_event()` into `backend/routes/events.py`.
6. **Step 6**: Build `frontend/src/components/PredictiveBehaviorWidget.jsx` and integrate into `AdminDashboard.jsx`, `OrganizationDashboard.jsx`, and `UserDetailDashboard.jsx`.
7. **Step 7**: Test engine functionality and verify multi-session execution, risk decay, prediction accuracy, and frontend rendering.
