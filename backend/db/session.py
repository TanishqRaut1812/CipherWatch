from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from backend.config import settings

db_url = settings.normalized_database_url
is_sqlite = db_url.startswith("sqlite")

connect_args = {"check_same_thread": False} if is_sqlite else {}

engine_kwargs = {
    "connect_args": connect_args,
    "echo": settings.SQLALCHEMY_ECHO,
}

if not is_sqlite:
    engine_kwargs.update({
        "pool_pre_ping": True,
        "pool_size": 10,
        "max_overflow": 20,
        "pool_recycle": 300,
    })

engine = create_engine(db_url, **engine_kwargs)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency yielding a database session context."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Initialize database tables and seed default organization if needed."""
    from backend.db.models import Base, OrganizationModel, UserModel
    from sqlalchemy import text

    Base.metadata.create_all(bind=engine)

    # Migrate SQLite schema if tables exist without new columns (SQLite only)
    if engine.dialect.name == "sqlite":
        with engine.connect() as conn:
            try:
                res = conn.execute(text("PRAGMA table_info(organizations)")).fetchall()
                col_names = [r[1] for r in res]
                if "organization_id" not in col_names:
                    conn.execute(text("ALTER TABLE organizations ADD COLUMN organization_id VARCHAR(64)"))
                if "enrollment_key" not in col_names:
                    conn.execute(text("ALTER TABLE organizations ADD COLUMN enrollment_key VARCHAR(64)"))
                conn.execute(text("UPDATE organizations SET organization_id = id WHERE organization_id IS NULL"))
                conn.execute(text("UPDATE organizations SET enrollment_key = registration_key WHERE enrollment_key IS NULL"))
                
                res_agents = conn.execute(text("PRAGMA table_info(agents)")).fetchall()
                agent_cols = [r[1] for r in res_agents]
                if "device_uuid" not in agent_cols:
                    conn.execute(text("ALTER TABLE agents ADD COLUMN device_uuid VARCHAR(64)"))

                res_sessions = conn.execute(text("PRAGMA table_info(sessions)")).fetchall()
                sess_cols = [r[1] for r in res_sessions]
                if "device_id" not in sess_cols:
                    conn.execute(text("ALTER TABLE sessions ADD COLUMN device_id VARCHAR(64) DEFAULT 'unknown_device'"))
                if "org_id" not in sess_cols:
                    conn.execute(text("ALTER TABLE sessions ADD COLUMN org_id VARCHAR(64)"))
                if "agent_id" not in sess_cols:
                    conn.execute(text("ALTER TABLE sessions ADD COLUMN agent_id VARCHAR(64)"))

                res_events = conn.execute(text("PRAGMA table_info(events)")).fetchall()
                event_cols = [r[1] for r in res_events]
                if "org_id" not in event_cols:
                    conn.execute(text("ALTER TABLE events ADD COLUMN org_id VARCHAR(64)"))
                if "agent_id" not in event_cols:
                    conn.execute(text("ALTER TABLE events ADD COLUMN agent_id VARCHAR(64)"))

                conn.commit()
            except Exception:
                pass

    # Seed default org for testing/simulator if org-default-uuid is not present
    session = SessionLocal()
    try:
        org = session.query(OrganizationModel).filter(
            (OrganizationModel.organization_id == "org-default-uuid") |
            (OrganizationModel.id == "default_org")
        ).first()
        if not org:
            user = session.query(UserModel).filter(UserModel.id == "default_user").first()
            if not user:
                user = UserModel(
                    id="default_user",
                    email="admin@cipherwatch.local",
                    username="admin",
                    password_hash="disabled",
                )
                session.add(user)
                session.flush()
            org = OrganizationModel(
                id="default_org",
                name="Default Organization",
                organization_id="org-default-uuid",
                enrollment_key="cwek_defaultkey1234567890123456789012345",
                registration_key="cwrk_defaultkey1234567890123456",
                owner_user_id=user.id,
            )
            session.add(org)
            session.commit()
    except Exception:
        session.rollback()
    finally:
        session.close()

