import os
import sys
import time
import subprocess
import signal

def main():
    print("=" * 70)
    print("🛡️  Starting CipherWatch Insider Threat Intelligence Platform...")
    print("=" * 70)

    # 1. Initialize SQLite DB
    print("\n[1/4] Initializing SQLite database schema...")
    try:
        from backend.db.session import init_db
        init_db()
        print("✓ Database schema initialized.")
    except Exception as e:
        print(f"⚠️  Database initialization warning: {e}")

    # 2. Start FastAPI Backend Server
    print("\n[2/4] Starting FastAPI backend server on http://127.0.0.1:8000 ...")
    try:
        subprocess.run(["fuser", "-k", "8000/tcp"], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        pass
    backend_cmd = [sys.executable, "-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1", "--port", "8000"]
    backend_proc = subprocess.Popen(backend_cmd)

    # Wait for backend server to spin up
    time.sleep(2.5)

    # 3. Inject Initial Synthetic Security Scenario
    print("\n[3/4] Injecting High-Risk Security Event Scenario into backend...")
    try:
        inject_cmd = [sys.executable, "-m", "simulator.main", "--scenario", "exfil_burst", "--delay", "0.1"]
        subprocess.run(inject_cmd, check=False)
        print("✓ Synthetic security scenario injected.")
    except Exception as e:
        print(f"⚠️  Scenario injection notice: {e}")

    # 4. Start Vite Frontend Dashboard
    print("\n[4/4] Starting Frontend Dashboard...")
    frontend_dir = os.path.join(os.path.dirname(__file__), "frontend")
    
    # Check node_modules
    if not os.path.exists(os.path.join(frontend_dir, "node_modules")):
        print("Installing frontend dependencies (npm install)...")
        subprocess.run(["npm", "install"], cwd=frontend_dir, check=False)

    print("\n" + "=" * 70)
    print("🚀 CipherWatch Backend & Frontend Active!")
    print("   • Backend API:  http://127.0.0.1:8000")
    print("   • Frontend UI:  http://localhost:5173 (Opening Vite dev server...)")
    print("======================================================================\n")

    frontend_cmd = ["npm", "run", "dev"]
    frontend_proc = subprocess.Popen(frontend_cmd, cwd=frontend_dir)

    def shutdown_handler(sig, frame):
        print("\nStopping CipherWatch services...")
        frontend_proc.terminate()
        backend_proc.terminate()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown_handler)
    signal.signal(signal.SIGTERM, shutdown_handler)

    try:
        frontend_proc.wait()
    except KeyboardInterrupt:
        shutdown_handler(None, None)

if __name__ == "__main__":
    main()
