#!/usr/bin/env python3
"""Live verification test for non-recursive top-level drops and full_home scope measurements."""
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from agent.config import AgentConfig
from agent.monitors.filesystem import FilesystemMonitor, is_excluded

def run_non_recursive_boundary_test():
    print("=" * 70)
    print("1. VERIFYING NON-RECURSIVE HOME ROOT WATCH (ITEM #2)")
    print("=" * 70)
    
    captured_events = []
    def on_event(event_create):
        meta = event_create.metadata
        src = meta.get("src_path", "")
        captured_events.append(src)
        print(f"   ⚡ [FS EVENT EMITTED] action={meta.get('action')} path={src}")

    config = AgentConfig(watch_scope="targeted")
    monitor = FilesystemMonitor(config=config, callback=on_event)
    
    print("\nStarting FilesystemMonitor in targeted mode...")
    monitor.start()
    time.sleep(1)

    home = os.path.expanduser("~")
    top_level_file = os.path.join(home, "cipherwatch_top_level_drop.txt")
    nested_dir = os.path.join(home, "random_unwatched_folder", "nested")
    nested_file = os.path.join(nested_dir, "cipherwatch_nested_drop.txt")

    try:
        # Action A: Top-level drop directly in ~
        print(f"\n[Test A] Creating top-level file: {top_level_file}")
        with open(top_level_file, "w") as f:
            f.write("top-level test drop")
        time.sleep(1.5)

        # Action B: Nested drop inside ~/random_unwatched_folder/nested/
        print(f"[Test B] Creating nested file: {nested_file}")
        os.makedirs(nested_dir, exist_ok=True)
        with open(nested_file, "w") as f:
            f.write("nested test drop")
        time.sleep(1.5)

    finally:
        print("\nStopping FilesystemMonitor...")
        monitor.stop()

        # Clean up created files
        if os.path.exists(top_level_file):
            os.remove(top_level_file)
        if os.path.exists(nested_file):
            os.remove(nested_file)
        if os.path.exists(nested_dir):
            os.removedirs(nested_dir)

    print("\n--- TEST RESULTS ---")
    top_captured = any("cipherwatch_top_level_drop.txt" in path for path in captured_events)
    nested_captured = any("cipherwatch_nested_drop.txt" in path for path in captured_events)

    print(f"  • Top-level drop detected?  {'✅ YES (Passed)' if top_captured else '❌ NO (Failed)'}")
    print(f"  • Nested drop detected?     {'❌ YES (Unintended)' if nested_captured else '✅ NO (Passed - Properly Ignored)'}")
    
    if top_captured and not nested_captured:
        print("\nSUCCESS: Non-recursive boundary on ~ is strictly enforced!")
    else:
        print("\nWARNING: Unexpected behavior in top-level vs nested event capture.")


def run_full_home_scope_measurement():
    print("\n" + "=" * 70)
    print("2. VERIFYING FULL_HOME WATCH SCOPE (ITEM #3)")
    print("=" * 70)

    config = AgentConfig(watch_scope="full_home")
    
    inotify_limit = 65536
    try:
        with open("/proc/sys/fs/inotify/max_user_watches", "r") as f:
            inotify_limit = int(f.read().strip())
    except Exception:
        pass

    home = os.path.expanduser("~")
    total_dirs = 0
    excluded_dirs = 0

    print(f"\nScanning full home directory tree: {home} ...")
    start_time = time.time()

    for root, dirs, files in os.walk(home, followlinks=False):
        if is_excluded(root, config.watch_exclude_dirs):
            excluded_dirs += 1
            dirs[:] = []  # Skip descending into excluded trees
            continue
        total_dirs += 1

    elapsed = time.time() - start_time
    pct = (total_dirs / inotify_limit) * 100

    print(f"\n--- FULL HOME MEASUREMENT RESULTS ---")
    print(f"  • Scan time:                   {elapsed:.2f} seconds")
    print(f"  • Total watched directories:   {total_dirs}")
    print(f"  • Total excluded directories:  {excluded_dirs}")
    print(f"  • System inotify limit:        {inotify_limit}")
    print(f"  • System inotify utilization:  {pct:.1f}%")
    
    if pct > 80:
        print(f"\n  ⚠️ WARNING: full_home mode uses {pct:.1f}% of available inotify watches!")
        print("  Recommendation: Stick to 'targeted' mode on this machine unless inotify limit is increased.")
    else:
        print(f"\n  ✅ OK: full_home mode fits within current inotify limit.")

    print("=" * 70)


if __name__ == "__main__":
    run_non_recursive_boundary_test()
    run_full_home_scope_measurement()
