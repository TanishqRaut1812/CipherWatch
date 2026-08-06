"""
Database Migration Script: SQLite -> Supabase (PostgreSQL)

This script migrates all existing records (Users, Organizations, Memberships, Agents, Sessions, Events, Incidents, Alerts, Baselines)
from local SQLite (`cipherwatch.db`) to a remote Supabase PostgreSQL database.

Usage:
    1. Set DATABASE_URL in your `.env` file to your Supabase Connection String, e.g.:
       DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
    2. Run this script:
       python scripts/migrate_sqlite_to_supabase.py
"""

import os
import sys
from pathlib import Path

# Add project root directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.config import settings
from backend.db.models import (
    Base,
    UserModel,
    OrganizationModel,
    UserOrganizationModel,
    AgentModel,
    MetricsSnapshotModel,
    ProcessEventModel,
    FSEventModel,
    USBEventModel,
    EventModel,
    SessionModel,
    AnomalyScoreModel,
    IncidentModel,
    AlertModel,
    UserBaselineModel,
)


def migrate():
    sqlite_db_path = Path(__file__).resolve().parent.parent / "cipherwatch.db"
    sqlite_url = f"sqlite:///{sqlite_db_path}"

    target_url = settings.normalized_database_url

    if target_url.startswith("sqlite"):
        print("❌ Target DATABASE_URL is set to SQLite.")
        print("   Please set DATABASE_URL in your .env file to your Supabase PostgreSQL URL first.")
        print("   Example: DATABASE_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres")
        sys.exit(1)

    print(f"🔄 Source Database: SQLite ({sqlite_db_path})")
    print(f"🚀 Target Database: Supabase PostgreSQL ({target_url.split('@')[-1] if '@' in target_url else target_url})")

    # Connect to SQLite
    sqlite_engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})
    SqliteSession = sessionmaker(bind=sqlite_engine)
    sqlite_session = SqliteSession()

    # Connect to Supabase
    pg_engine = create_engine(target_url, pool_pre_ping=True)
    PgSession = sessionmaker(bind=pg_engine)
    pg_session = PgSession()

    # Create target tables
    print("\n[1/3] Ensuring target schema tables exist on Supabase...")
    Base.metadata.create_all(bind=pg_engine)
    print("✓ Schema initialized on Supabase PostgreSQL.")

    print("\n[2/3] Migrating data records...")

    models = [
        ("Users", UserModel),
        ("Organizations", OrganizationModel),
        ("User-Org Memberships", UserOrganizationModel),
        ("Agents", AgentModel),
        ("Sessions", SessionModel),
        ("Events", EventModel),
        ("Metrics Snapshots", MetricsSnapshotModel),
        ("Process Events", ProcessEventModel),
        ("FS Events", FSEventModel),
        ("USB Events", USBEventModel),
        ("Anomaly Scores", AnomalyScoreModel),
        ("Incidents", IncidentModel),
        ("Alerts", AlertModel),
        ("User Baselines", UserBaselineModel),
    ]

    total_migrated = 0

    for name, model_cls in models:
        try:
            records = sqlite_session.query(model_cls).all()
            if not records:
                print(f"  • {name}: 0 records to migrate.")
                continue

            count = 0
            for item in records:
                # Convert row attributes to dict for clean re-insertion
                data = {col.name: getattr(item, col.name) for col in item.__table__.columns}
                
                # Check for existing record by primary key
                pk_attr = getattr(model_cls, "id", None)
                if pk_attr is not None and "id" in data:
                    existing = pg_session.query(model_cls).filter(model_cls.id == data["id"]).first()
                    if existing:
                        continue

                new_obj = model_cls(**data)
                pg_session.add(new_obj)
                count += 1

            pg_session.commit()
            print(f"  ✓ {name}: {count} records migrated successfully.")
            total_migrated += count
        except Exception as e:
            pg_session.rollback()
            print(f"  ⚠️  Notice migrating {name}: {e}")

    print(f"\n[3/3] Migration completed! Total {total_migrated} records transferred to Supabase.")
    sqlite_session.close()
    pg_session.close()


if __name__ == "__main__":
    migrate()
