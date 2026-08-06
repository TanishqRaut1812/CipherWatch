from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from backend.config import settings

# SQLite requires check_same_thread=False for multi-threaded FastAPI workers
connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    echo=settings.DEBUG,
)

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
    Base.metadata.create_all(bind=engine)

    # Seed default org for testing/simulator if database is empty
    session = SessionLocal()
    try:
        if not session.query(OrganizationModel).first():
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

