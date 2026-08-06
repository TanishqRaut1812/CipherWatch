#!/usr/bin/env bash
# ==============================================================================
# CipherWatch Master Demo & End-to-End System Runner
# ==============================================================================

set -e

echo "======================================================================"
echo "🛡️  Starting CipherWatch Insider Threat Intelligence Platform Demo..."
echo "======================================================================"

# Step 1: Initialize Database
echo "[1/4] Initializing SQLite database schema & seeds..."
uv run python -c "from backend.db.session import init_db; init_db()"

# Step 2: Start Backend Server in Background
echo "[2/4] Starting FastAPI backend ingestion server (http://localhost:8000)..."
uv run uvicorn backend.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

sleep 2

# Cleanup handler on script exit
cleanup() {
  echo ""
  echo "Shutting down CipherWatch services (PID: $BACKEND_PID)..."
  kill $BACKEND_PID 2>/dev/null || true
  echo "CipherWatch demo stopped."
}
trap cleanup EXIT

# Step 3: Inject Synthetic Security Scenario
echo "[3/4] Injecting High-Risk Bulk Exfiltration Scenario (Scenario B)..."
uv run python -m simulator.main --scenario exfil_burst --delay 0.2

# Step 4: System Readiness Summary
echo "======================================================================"
echo "✅ CipherWatch Backend & Scenario Injection Ready!"
echo "   - Backend API: http://localhost:8000"
echo "   - Health Check: http://localhost:8000/health"
echo "   - Alerts API: http://localhost:8000/api/alerts"
echo ""
echo "To view the SOC Analyst Dashboard, open a second terminal and run:"
echo "   npm --prefix frontend run dev"
echo "======================================================================"
echo "Press Ctrl+C to stop the demo."

# Keep background backend running until user exits
wait $BACKEND_PID
