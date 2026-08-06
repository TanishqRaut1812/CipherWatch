#!/usr/bin/env python3
"""
CipherWatch Database Migration Script for Multi-Endpoint Agent Architecture
Adds machine_id, device_name, username, os_version, architecture, status, created_at, updated_at columns to agents table.
"""

import os
import sqlite3
import uuid
import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "cipherwatch.db")

def migrate():
    print(f"🔄 Starting database migration on: {DB_PATH}")
    if not os.path.exists(DB_PATH):
        print(f"ℹ️ Database file {DB_PATH} does not exist yet. Schema will be auto-created on next backend launch.")
        return

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # Check agents table columns
    cursor.execute("PRAGMA table_info(agents);")
    existing_cols = {col[1] for col in cursor.fetchall()}

    columns_to_add = [
        ("machine_id", "VARCHAR(128)"),
        ("device_name", "VARCHAR(128)"),
        ("username", "VARCHAR(128)"),
        ("os_version", "VARCHAR(64)"),
        ("architecture", "VARCHAR(64)"),
        ("status", "VARCHAR(32) DEFAULT 'online'"),
        ("created_at", "DATETIME"),
        ("updated_at", "DATETIME"),
    ]

    for col_name, col_type in columns_to_add:
        if col_name not in existing_cols:
            print(f"   ➕ Adding column '{col_name}' ({col_type}) to agents table...")
            try:
                cursor.execute(f"ALTER TABLE agents ADD COLUMN {col_name} {col_type};")
            except Exception as e:
                print(f"      ⚠️ Warning adding '{col_name}': {e}")

    # Backfill missing values for existing rows
    cursor.execute("SELECT id, hostname, enrolled_at FROM agents;")
    rows = cursor.fetchall()
    now_str = datetime.datetime.utcnow().isoformat()

    for row in rows:
        agent_id, hostname, enrolled_at = row
        fallback_machine_id = f"migrated_{uuid.uuid4().hex[:16]}"
        enrolled_time = enrolled_at or now_str

        cursor.execute("""
            UPDATE agents
            SET machine_id = COALESCE(machine_id, ?),
                device_name = COALESCE(device_name, ?),
                username = COALESCE(username, 'system'),
                os_version = COALESCE(os_version, 'unknown'),
                architecture = COALESCE(architecture, 'x86_64'),
                status = COALESCE(status, 'online'),
                created_at = COALESCE(created_at, ?),
                updated_at = COALESCE(updated_at, ?)
            WHERE id = ?;
        """, (fallback_machine_id, hostname, enrolled_time, now_str, agent_id))

    conn.commit()
    conn.close()
    print("✅ Multi-endpoint agent database migration completed successfully!")

if __name__ == "__main__":
    migrate()
