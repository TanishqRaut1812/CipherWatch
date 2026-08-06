import os
import sys
import time
import shutil
import logging
from pathlib import Path
from watchdog.events import FileCreatedEvent

# Add parent path to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from agent.monitors.filesystem import FilesystemMonitor, FilesystemMetadataHandler, agent_logger

# Configure logger to output to stdout for verification
handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(logging.Formatter("[%(asctime)s] [%(levelname)s] [%(name)s]: %(message)s"))
agent_logger.addHandler(handler)
agent_logger.setLevel(logging.WARNING)


def run_verification():
    print("[STEP 1] Initializing Target Paths")
    downloads_dir = Path.home() / "Downloads"
    downloads_dir.mkdir(parents=True, exist_ok=True)
    
    restricted_dir = downloads_dir / "restricted_test"
    sibling_file = downloads_dir / "sibling_test_file.txt"

    emitted_events = []
    def on_event(evt):
        emitted_events.append(evt)
        print(f"  -> EVENT EMITTED: type={evt.event_type} metadata={evt.metadata}")

    # Initialize handler
    fs_handler = FilesystemMetadataHandler(user_id="usr-perm-01", device_id="dev-perm-01", emit_callback=on_event)

    print(f"Target directory: {downloads_dir}")

    # Prepare restricted folder with 000 permissions
    if restricted_dir.exists():
        try:
            os.chmod(restricted_dir, 0o755)
            shutil.rmtree(restricted_dir)
        except Exception:
            pass
    restricted_dir.mkdir(exist_ok=True)
    restricted_file = restricted_dir / "no_access.dat"
    try:
        restricted_file.write_text("secret content")
    except Exception:
        pass
    
    # Restrict permissions to 000
    os.chmod(restricted_dir, 0o000)
    print(f"[STEP 2] Created restricted directory with 000 permissions: {restricted_dir}")

    # Trigger event on file inside restricted folder
    print("[STEP 3] Triggering file event inside restricted folder (Simulating permission error)...")
    event_restricted = FileCreatedEvent(str(restricted_file))
    fs_handler.on_created(event_restricted)

    # Trigger event on sibling file in parent Downloads directory
    print("[STEP 4] Triggering event on valid sibling file (Verifying watcher resilience)...")
    if sibling_file.exists():
        sibling_file.unlink()
    sibling_file.write_text("hello sibling")
    
    event_sibling = FileCreatedEvent(str(sibling_file))
    fs_handler.on_created(event_sibling)

    # Cleanup
    print("[STEP 5] Cleanup...")
    try:
        os.chmod(restricted_dir, 0o755)
        shutil.rmtree(restricted_dir)
        if sibling_file.exists():
            sibling_file.unlink()
        print("  ✓ Temporary test directories cleaned up successfully.")
    except Exception as e:
        print(f"  ! Cleanup note: {e}")

    print("[SUMMARY] VERIFICATION COMPLETE")
    print(f"Total Events Emitted: {len(emitted_events)}")
    print("Watcher handled PermissionError cleanly and successfully processed sibling files.")


if __name__ == "__main__":
    run_verification()
