import os
import sys
import time
import subprocess
import signal
import urllib.request
import urllib.error


def wait_for_backend(url: str = "http://127.0.0.1:8000/api/health", timeout_seconds: float = 30.0) -> bool:
    """Poll backend API until it responds with HTTP 200 OK or times out."""
    print(f"Waiting for backend server at {url} to accept connections...")
    start_time = time.time()
    while time.time() - start_time < timeout_seconds:
        try:
            with urllib.request.urlopen(url, timeout=2.0) as response:
                if response.status == 200:
                    print("✓ Backend server is ready and accepting requests.")
                    return True
        except (urllib.error.URLError, ConnectionError, OSError):
            pass
        time.sleep(0.5)

    print("⚠️ Timeout waiting for backend server to become ready.")
    return False


def main():
    if hasattr(sys.stdout, 'reconfigure'):
        try:
            sys.stdout.reconfigure(encoding='utf-8')
            sys.stderr.reconfigure(encoding='utf-8')
        except Exception:
            pass

    print("=" * 70)
    print("🛡️  Starting CipherWatch Insider Threat Intelligence Platform...")
    print("=" * 70)

    # 1. Initialize DB Schema
    print("\n[1/4] Initializing database schema...")
    try:
        from backend.db.session import init_db
        init_db()
        print("✓ Database schema initialized.")
    except Exception as e:
        print(f"⚠️  Database initialization warning: {e}")

    # 2. Start FastAPI Backend Server
    print("\n[2/4] Starting FastAPI backend server on http://127.0.0.1:8000 ...")
    if os.name == 'nt':
        try:
            out = subprocess.check_output("netstat -ano | findstr :8000", shell=True, text=True)
            for line in out.strip().splitlines():
                parts = line.strip().split()
                if len(parts) >= 5 and "LISTENING" in parts:
                    pid = parts[-1]
                    subprocess.run(f"taskkill /F /PID {pid}", shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            pass
    else:
        try:
            subprocess.run(["fuser", "-k", "8000/tcp"], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception:
            pass

    backend_cmd = [sys.executable, "-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1", "--port", "8000", "--reload"]
    backend_proc = subprocess.Popen(backend_cmd)

    # Wait for backend server to be fully active and accepting HTTP requests
    wait_for_backend("http://127.0.0.1:8000/api/health", timeout_seconds=30.0)

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
    
    npm_cmd = "npm.cmd" if os.name == 'nt' else "npm"
    use_shell = os.name == 'nt'

    # Check node_modules & vite package
    if not os.path.exists(os.path.join(frontend_dir, "node_modules", "vite")):
        print("Installing frontend dependencies (npm install)...")
        subprocess.run([npm_cmd, "install"], cwd=frontend_dir, check=False, shell=use_shell)

    print("\n" + "=" * 70)
    print("🚀 CipherWatch Backend & Frontend Active!")
    print("   • Backend API:  http://127.0.0.1:8000")
    print("   • Frontend UI:  http://localhost:5173 (Opening Vite dev server...)")
    print("======================================================================\n")

    frontend_cmd = [npm_cmd, "run", "dev"]
    frontend_proc = subprocess.Popen(frontend_cmd, cwd=frontend_dir, shell=use_shell)

    def shutdown_handler(sig, frame):
        print("\nStopping CipherWatch services...")
        try:
            if os.name == 'nt':
                subprocess.run(["taskkill", "/F", "/T", "/PID", str(frontend_proc.pid)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            else:
                frontend_proc.terminate()
        except Exception:
            pass
        try:
            backend_proc.terminate()
        except Exception:
            pass
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown_handler)
    signal.signal(signal.SIGTERM, shutdown_handler)

    try:
        frontend_proc.wait()
    except KeyboardInterrupt:
        shutdown_handler(None, None)

if __name__ == "__main__":
    main()
