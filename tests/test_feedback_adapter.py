import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.db.base import Base
from backend.db.models import AlertModel, UserBaselineModel
from backend.engine.feedback_adapter import FeedbackAdapter

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


def test_feedback_adapter_false_positive():
    """Verify marking FALSE_POSITIVE reduces tolerance factor and increases false_positive_count."""
    db = TestingSessionLocal()
    alert = AlertModel(
        user_id="user_fp_test",
        device_id="dev_01",
        risk_score=0.82,
        severity="HIGH",
        status="ACTIVE",
        message="Anomalous network connection",
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)

    adapter = FeedbackAdapter()
    result = adapter.process_feedback(alert.id, "FALSE_POSITIVE", db)

    assert result["status"] == "success"
    assert result["user_id"] == "user_fp_test"
    assert result["feedback"] == "FALSE_POSITIVE"
    assert result["new_tolerance_factor"] < 1.0  # 0.85
    assert result["false_positive_count"] == 1

    # Verify future risk score is reduced by tolerance factor
    raw_risk = 80.0
    adjusted_risk = adapter.get_adjusted_risk_score("user_fp_test", raw_risk, db)
    assert adjusted_risk < raw_risk
    assert adjusted_risk == 68.0  # 80 * 0.85

    db.close()


def test_feedback_adapter_confirmed_threat():
    """Verify marking CONFIRMED_THREAT increases tolerance factor."""
    db = TestingSessionLocal()
    alert = AlertModel(
        user_id="user_ct_test",
        device_id="dev_02",
        risk_score=0.90,
        severity="CRITICAL",
        status="ACTIVE",
        message="Mass encrypted archive creation",
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)

    adapter = FeedbackAdapter()
    result = adapter.process_feedback(alert.id, "CONFIRMED_THREAT", db)

    assert result["status"] == "success"
    assert result["feedback"] == "CONFIRMED_THREAT"
    assert result["new_tolerance_factor"] > 1.0  # 1.15
    assert result["confirmed_threat_count"] == 1

    db.close()
