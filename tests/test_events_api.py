import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.db.base import Base
from backend.db.session import get_db
from backend.main import app

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
Base.metadata.create_all(bind=engine)
client = TestClient(app)


def test_post_events_is_removed():
    """Verify legacy HTTP POST /api/events returns 405 Method Not Allowed."""
    response = client.post("/api/events", json={})
    assert response.status_code == 405


def test_get_events_endpoint():
    """Verify GET /api/events returns HTTP 200 list."""
    get_resp = client.get("/api/events")
    assert get_resp.status_code == 200
    assert isinstance(get_resp.json(), list)
