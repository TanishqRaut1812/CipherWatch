# CipherWatch 🛡️

> **Privacy-Preserving Metadata-Only Insider Threat Intelligence & Intent Reconstruction Platform**

CipherWatch detects insider threat data exfiltration (USB transfers, unauthorized cloud uploads, off-hours archive staging) using **metadata strictly** — timestamps, transfer volumes, file extensions, process trees, network endpoints, and device IDs — **without ever inspecting user file contents or capturing screen images**.

---

## 🔍 Key Architecture & Capabilities

1. **Endpoint Agent & Scenario Simulator (Metadata-Only):**
   - Monitors filesystem events, USB insertions, process launches, and network connections (`watchdog`, `psutil`).
   - Includes a synthetic scenario injector CLI (`simulator/main.py`) for reproducible testing.
2. **Session Correlator & Timeline Visualizer:**
   - Automatically groups raw system events into logical user operational sessions based on configurable idle windows.
3. **Session Relationship Graph Engine:**
   - Uses NetworkX topological graph analysis to trace multi-hop exfiltration sequences (e.g. `FILE_CREATE (.7z)` -> `USB_INSERT` -> `NETWORK_CONNECTION (anonfiles.com)`).
4. **Hybrid Anomaly & Intent Classifier Engine:**
   - Multi-stage risk scoring combining scikit-learn Isolation Forest anomaly scoring, per-user Z-score baseline deviation, rule multipliers, and Random Forest intent classification.
5. **AI Incident Explainability Loop:**
   - Anthropic LLM prompt builder generating plain-English SOC analyst incident summaries from structured session telemetry without exposing raw user data.
6. **Analyst Feedback & Baseline Auto-Adjustment Engine:**
   - Feedback API (`POST /api/alerts/{id}/feedback`) allowing analysts to mark `CONFIRMED_THREAT` or `FALSE_POSITIVE`, dynamically tuning baseline sensitivity.
7. **Disclosed Surveillance & Privacy Guarantee Modal:**
   - Top persistent UI Privacy Banner and interactive audit modal detailing exact items **Never Collected** vs **Metadata Only Collected**.

---

## 🛠️ Technical Stack

- **Package Manager:** `uv`
- **Backend Service:** Python 3.10+, FastAPI, SQLAlchemy (SQLite ORM), Pydantic v2
- **Analytics & ML:** `scikit-learn` (Isolation Forest, Random Forest Intent Classifier), `NetworkX`
- **LLM Integration:** Anthropic API (Claude 3.5 Sonnet / Haiku)
- **Frontend Dashboard:** React, Vite, SVG Time-Series Risk Charts, Dark Cyber-Security CSS Tokens

---

## 🚀 Quickstart & Demo Runner

### Prerequisites
- Python 3.10+
- Node.js & npm

### 1. Install Dependencies
```bash
# Python dependencies
pip install -r requirements.txt

# Frontend dependencies
cd frontend && npm install && cd ..
```

### 2. Run Entire Platform (Single Command)
Run `start.py` to automatically initialize the database, start the FastAPI backend server on port 8000, inject synthetic security event scenarios, and start the Vite frontend dashboard:

```bash
python start.py
```


Open `http://localhost:5173` in your browser to view live alerts, timeline event visualizers, risk breakdown bars, AI incident summaries, and analyst controls.

---

## 🧪 Running Scenario Simulations

The scenario simulator supports three synthetic security event sequences:

```bash
# Scenario A: Routine Developer Day (Low Risk < 20%)
uv run python -m simulator.main --scenario normal_day

# Scenario B: High-Risk Bulk Exfiltration Burst (Critical Risk > 85%)
uv run python -m simulator.main --scenario exfil_burst

# Scenario C: Low-and-Slow Exfiltration Sequence (Elevated Risk)
uv run python -m simulator.main --scenario slow_drip
```

---

## 📋 Test Suite Execution

Run all automated unit and end-to-end integration tests using pytest:

```bash
uv run pytest
```

---

## 🛡️ Zero-Privacy Invasion Guarantee

CipherWatch operates strictly under enterprise privacy boundaries:
- 🚫 **NEVER COLLECTED:** File contents, text body, screen renders/pixels, keystrokes, audio, or email bodies.
- ✅ **METADATA ONLY:** Timestamps, file size (bytes), file extensions, process names/hashes, IP/domains, and USB vendor IDs.
