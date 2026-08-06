# CipherWatch 🛡️

> **Privacy-Preserving Metadata-Only Insider Threat Intelligence & Intent Reconstruction Platform**

CipherWatch detects insider threat data exfiltration (USB transfers, unauthorized cloud uploads, off-hours archive staging) using **metadata strictly** — timestamps, transfer volumes, file extensions, process trees, network endpoints, and device IDs — **without ever inspecting user file contents or capturing screen images**.

---

## 🔍 Key Architecture & Capabilities

1. **Endpoint Agent & Scenario Simulator (Metadata-Only):**
   - Monitors filesystem events, USB insertions, process launches, and network connections (`watchdog`, `psutil`).
   - Configurable watch scope (`targeted` vs `full_home`) with noise exclusion lists (`.git`, `node_modules`, `.venv`, `.next`, etc.) and automated inotify limit safety checks.
   - *Note on benchmarking & inotify*: Baseline directory counts on developer machines (e.g. `~/Desktop` containing code repositories) will be significantly higher than on standard end-user endpoints. In `full_home` mode, inotify watch consumption (e.g. ~57% on dev setups) shares system limits with IDEs and sync tools — evaluate per-deployment to prevent `ENOSPC` watch exhaustion.
   - Features robust `PermissionError` handling in filesystem monitors to gracefully bypass restricted paths without crashing.
   - Enforces an organization-scoped agent enrollment flow (`/api/agent/enroll`) with secure bearer token authentication and periodic heartbeats (`/api/heartbeat`).
   - Asynchronously batches telemetry payloads and flushes them directly to `POST /api/agents/{agent_id}/events`.
   - Ingests USB events into a dedicated, schema-compliant `usb_events` database table.
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

- **Package Manager:** `uv` / `pip`
- **Backend Service:** Python 3.10+, FastAPI, SQLAlchemy (SQLite ORM), Pydantic v2
- **Analytics & ML:** `scikit-learn` (Isolation Forest, Random Forest Intent Classifier), `NetworkX`
- **LLM Integration:** Anthropic API (Claude 3.5 Sonnet / Haiku)
- **Frontend Dashboard:** React, Vite, SVG Time-Series Risk Charts, Dark Cyber-Security CSS Tokens

---

## 🚀 Quickstart Guide

### Prerequisites
- Python 3.10+
- Node.js (v18+) & npm

---

### Option A: One-Command Automated Launch (Backend + Frontend)

Run `start.py` to automatically initialize the database, start the FastAPI backend server on port 8000, inject synthetic security event scenarios, and start the Vite frontend dashboard:

```bash
# Install Python dependencies
pip install -r requirements.txt

# Install Frontend dependencies
cd frontend && npm install && cd ..

# Launch everything
python start.py
```
Open **`http://localhost:5173`** in your browser to view the SOC dashboard.

---

### Option B: Manual Component Execution (Backend, Frontend & Agent)

#### 1. Backend Server Setup & Run

1. Activate your virtual environment and install requirements:
   ```bash
   source .venv/bin/activate
   pip install -r requirements.txt
   ```
2. Start the FastAPI backend server:
   ```bash
   python main.py
   # or with uvicorn directly:
   uvicorn backend.main:app --reload --port 8000
   ```
   * The REST API will be live at `http://localhost:8000` (API Docs at `http://localhost:8000/docs`).

#### 2. Frontend Dashboard Setup & Run

1. Navigate to the `frontend/` directory and install packages:
   ```bash
   cd frontend
   npm install
   ```
2. Start the Vite development server:
   ```bash
   npm run dev
   ```
   * Open `http://localhost:5173` to access the CipherWatch SOC Analyst Dashboard.

---

#### 3. Endpoint Agent Setup & Execution

The Endpoint Agent runs on client machines to monitor local system metadata events (filesystem changes in `./monitored_folder`, process launches, USB mounts, network connections) and stream them to the backend.

##### Step 3.1: Enroll / Register the Agent
If running in an enterprise workspace, enroll the agent with your organization's backend endpoint:

```bash
# Interactive setup wizard:
python -m agent.main --setup --backend-url http://localhost:8000

# Or via non-interactive CLI flags:
python -m agent.main --setup \
  --backend-url http://localhost:8000 \
  --org-id default_org \
  --enrollment-key demo_key
```
This generates `agent_config.json` containing the assigned `agent_id` and authentication token.

##### Step 3.2: Run the Endpoint Agent
Once enrolled, start the monitoring agent daemon:

```bash
python -m agent.main --backend-url http://localhost:8000 --user-id demo_user
```
The agent will:
- Establish a background heartbeat with the backend (`POST /api/heartbeat`).
- Monitor events in `./monitored_folder` (creates directory automatically), process launches, and USB mounts.
- Stream metadata payloads asynchronously to `POST /api/agents/{agent_id}/events`.

---

## 🧪 Running Synthetic Scenario Simulations

If you don't want to generate physical endpoint events, run the standalone scenario simulator to inject synthetic security sequences directly into the backend REST API:

```bash
# Scenario A: Routine Developer Day (Low Risk < 20%)
python -m simulator.main --scenario normal_day

# Scenario B: High-Risk Bulk Exfiltration Burst (Critical Risk > 85%)
python -m simulator.main --scenario exfil_burst

# Scenario C: Low-and-Slow Exfiltration Sequence (Elevated Risk)
python -m simulator.main --scenario slow_drip
```

---

## 📋 Test Suite Execution

Run all automated unit and end-to-end integration tests using pytest:

```bash
pytest
# or using uv:
uv run pytest
```

---

## 🛡️ Zero-Privacy Invasion Guarantee

CipherWatch operates strictly under enterprise privacy boundaries:
- 🚫 **NEVER COLLECTED:** File contents, text body, screen renders/pixels, keystrokes, audio, or email bodies.
- ✅ **METADATA ONLY:** Timestamps, file size (bytes), file extensions, process names/hashes, IP/domains, and USB vendor IDs.

