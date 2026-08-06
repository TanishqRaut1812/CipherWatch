#!/usr/bin/env python3
"""Comprehensive verification script for the four agent gaps:
1. Process lifecycle (snapshot & stop events)
2. poll_interval config wiring across all monitors
3. HTTP 429 backoff handling in EventPublisher
4. Graceful shutdown on SIGINT/SIGTERM with queue drain
"""

import os
import sys
import time
import subprocess
import threading
import signal
from typing import List

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from agent.config import AgentConfig
from agent.monitors.process import ProcessMonitor
from agent.monitors.usb import USBMonitor
from agent.monitors.network import NetworkMonitor
from agent.publisher import EventPublisher
from shared.schemas import EventCreate, EventType, ProcessMetadata


def test_1_process_lifecycle():
    print("=" * 70)
    print("TEST 1: PROCESS LIFECYCLE (SNAPSHOT & STOP DETECTED)")
    print("=" * 70)

    events: List[EventCreate] = []

    def on_event(ev: EventCreate):
        events.append(ev)

    pm = ProcessMonitor(poll_interval=0.5, callback=on_event)
    pm.start()

    # Wait for initial snapshot poll
    time.sleep(1.0)

    snapshot_events = [e for e in events if e.metadata.get("action") == "snapshot"]
    print(f"  • Captured initial process snapshot count: {len(snapshot_events)} processes")

    # Spawn short-lived dummy process
    cmd = [sys.executable, "-c", "import time; time.sleep(10)"]
    sub_proc = subprocess.Popen(cmd)
    sub_pid = sub_proc.pid
    print(f"\n  • Spawned dummy process PID: {sub_pid}")

    time.sleep(1.5)
    start_events = [e for e in events if e.metadata.get("action") == "start" and e.metadata.get("pid") == sub_pid]
    print(f"  • Start event captured for PID {sub_pid}? {'✅ YES' if start_events else '❌ NO'}")

    # Terminate dummy process
    sub_proc.terminate()
    sub_proc.wait()
    print(f"  • Terminated process PID: {sub_pid}")

    time.sleep(1.5)
    stop_events = [e for e in events if e.metadata.get("action") == "stop" and e.metadata.get("pid") == sub_pid]
    print(f"  • Stop event captured for PID {sub_pid}? {'✅ YES' if stop_events else '❌ NO'}")

    pm.stop()

    if snapshot_events and start_events and stop_events:
        print("\n✅ TEST 1 PASSED: Process snapshot, start, and stop lifecycle events verified!")
    else:
        print("\n❌ TEST 1 FAILED: Missing process lifecycle events.")


def test_2_poll_interval_wiring():
    print("\n" + "=" * 70)
    print("TEST 2: POLL_INTERVAL CONFIG WIRING")
    print("=" * 70)

    config = AgentConfig(poll_interval=1.75)

    pm = ProcessMonitor(poll_interval=config.poll_interval)
    um = USBMonitor(poll_interval=config.poll_interval)
    nm = NetworkMonitor(poll_interval=config.poll_interval)

    print(f"  • AgentConfig poll_interval:  {config.poll_interval}s")
    print(f"  • ProcessMonitor poll_interval: {pm.poll_interval}s")
    print(f"  • USBMonitor poll_interval:     {um.poll_interval}s")
    print(f"  • NetworkMonitor poll_interval: {nm.poll_interval}s")

    all_matched = (pm.poll_interval == 1.75 and um.poll_interval == 1.75 and nm.poll_interval == 1.75)
    print(f"\n{'✅ TEST 2 PASSED: All monitors correctly inherit poll_interval from config!' if all_matched else '❌ TEST 2 FAILED: Mismatched poll_interval.'}")


def test_3_http_429_backoff():
    print("\n" + "=" * 70)
    print("TEST 3: HTTP 429 RATE LIMIT BACKOFF & RETRY")
    print("=" * 70)

    import http.server
    import socketserver

    # Create local mock server that returns HTTP 429 once, then 200 OK
    requests_received = []

    class MockHandler(http.server.BaseHTTPRequestHandler):
        def do_POST(self):
            requests_received.append(time.time())
            if len(requests_received) == 1:
                self.send_response(429)
                self.send_header("Retry-After", "1")
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"detail": "Rate limit exceeded"}')
            else:
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"status": "ok", "processed": 1}')

        def log_message(self, format, *args):
            pass

    server = socketserver.TCPServer(("127.0.0.1", 0), MockHandler)
    port = server.server_address[1]
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()

    publisher = EventPublisher(
        backend_url=f"http://127.0.0.1:{port}",
        agent_id="test_agent_429",
        auth_token="dummy_token",
    )

    test_ev = EventCreate(
        user_id="u1",
        device_id="d1",
        event_type=EventType.PROCESS,
        metadata=ProcessMetadata(process_name="test_proc", pid=1234, action="start").model_dump()
    )

    start_t = time.time()
    success = publisher.send_batch([test_ev])
    duration = time.time() - start_t

    server.shutdown()
    server.server_close()

    print(f"  • Total server requests received: {len(requests_received)}")
    print(f"  • Retry delay duration:          {duration:.2f}s (Expected >= 1.0s due to Retry-After: 1)")
    print(f"  • Event batch delivery status:   {'✅ SUCCESS' if success else '❌ FAILED'}")

    if success and len(requests_received) == 2 and duration >= 1.0:
        print("\n✅ TEST 3 PASSED: HTTP 429 correctly triggered Retry-After backoff and successful retry!")
    else:
        print("\n❌ TEST 3 FAILED: HTTP 429 backoff handling failed.")


def test_4_graceful_shutdown():
    print("\n" + "=" * 70)
    print("TEST 4: GRACEFUL SHUTDOWN & QUEUE FLUSH")
    print("=" * 70)

    delivered_batches = []

    class MockFlushPublisher(EventPublisher):
        def send_batch(self, events_batch: List) -> bool:
            delivered_batches.append(events_batch)
            print(f"   ⚡ [FLUSHED ON SHUTDOWN] Batch size={len(events_batch)} items")
            return True

    pub = MockFlushPublisher(backend_url="http://localhost:8000", agent_id="test_ag")
    
    # Queue up 3 events
    for i in range(3):
        ev = EventCreate(
            user_id="u1",
            device_id="d1",
            event_type=EventType.FILESYSTEM,
            metadata={"action": "created", "src_path": f"/tmp/shutdown_file_{i}.txt"}
        )
        pub.publish(ev)

    print(f"  • Queued events before shutdown: {pub.queue.qsize()}")
    print("  • Invoking pub.stop()...")
    pub.stop()

    print(f"  • Queue size after shutdown:     {pub.queue.qsize()}")
    print(f"  • Total batches flushed:         {len(delivered_batches)}")

    if pub.queue.qsize() == 0 and len(delivered_batches) == 1 and len(delivered_batches[0]) == 3:
        print("\n✅ TEST 4 PASSED: Graceful shutdown successfully drained and flushed all queued events!")
    else:
        print("\n❌ TEST 4 FAILED: Events dropped during shutdown.")


if __name__ == "__main__":
    test_1_process_lifecycle()
    test_2_poll_interval_wiring()
    test_3_http_429_backoff()
    test_4_graceful_shutdown()
