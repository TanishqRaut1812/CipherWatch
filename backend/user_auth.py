from datetime import datetime, timedelta
from typing import Optional

import bcrypt
import jwt
from fastapi import Cookie, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from backend.config import settings
from backend.db.models import UserModel, UserOrganizationModel
from backend.db.session import get_db
from backend.logging_config import logger


# ---------------------------------------------------------------------------
# Password hashing (bcrypt — deliberately slow for low-entropy user passwords)
# ---------------------------------------------------------------------------

def hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt with default cost factor."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


# ---------------------------------------------------------------------------
# JWT token creation and validation
# ---------------------------------------------------------------------------

def create_access_token(user_id: str, username: str) -> str:
    """Create a signed JWT access token with configurable expiry."""
    payload = {
        "sub": user_id,
        "username": username,
        "exp": datetime.utcnow() + timedelta(hours=settings.JWT_EXPIRY_HOURS),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    """Decode and validate a JWT access token. Raises on expiry or tamper."""
    try:
        return jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid authentication token.")


# ---------------------------------------------------------------------------
# FastAPI dependency: extract current user from JWT (cookie or Authorization header)
# ---------------------------------------------------------------------------

def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
) -> UserModel:
    """
    Extract and validate JWT from httpOnly cookie or Authorization Bearer header.
    Returns the authenticated UserModel or raises 401.
    """
    token: Optional[str] = None

    # 1. Try httpOnly cookie first
    token = request.cookies.get("cw_access_token")

    # 2. Fallback to Authorization header
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split("Bearer ", 1)[1].strip()

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in.",
        )

    payload = decode_access_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Malformed token payload.")

    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User account not found.")

    return user


# ---------------------------------------------------------------------------
# Cross-org authorization boundary enforcement
# ---------------------------------------------------------------------------

def require_org_membership(
    user: UserModel,
    org_id: str,
    db: Session,
) -> UserOrganizationModel:
    """
    Verify user is a member of the given organization.
    Raises 403 Forbidden if the user has no membership record for this org.
    This is the critical multi-tenant isolation boundary.
    """
    membership = db.query(UserOrganizationModel).filter(
        UserOrganizationModel.user_id == user.id,
        UserOrganizationModel.org_id == org_id,
    ).first()
    if not membership:
        logger.warning(
            "Cross-org access denied: user_id={} attempted to access org_id={}",
            user.id,
            org_id,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not a member of this organization.",
        )
    return membership
