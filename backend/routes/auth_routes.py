from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from backend.db.models import OrganizationModel, UserModel, UserOrganizationModel
from backend.db.session import get_db
from backend.logging_config import logger
from backend.schemas.auth_schemas import (
    LoginRequest,
    OrgCreateRequest,
    OrgCredentialsResponse,
    OrgResponse,
    SignupRequest,
    TokenResponse,
    UserMeResponse,
)
from backend.user_auth import (
    create_access_token,
    get_current_user,
    hash_password,
    require_org_membership,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, response: Response, db: Session = Depends(get_db)):
    """Create user account + organization in a single transaction."""
    # Check for duplicate email/username
    if db.query(UserModel).filter(UserModel.email == payload.email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered.")
    if db.query(UserModel).filter(UserModel.username == payload.username).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already taken.")

    # Create user
    user = UserModel(
        email=payload.email,
        username=payload.username,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.flush()  # Assign user.id

    # Create organization (required for v1)
    org = OrganizationModel(
        name=payload.org_name,
        owner_user_id=user.id,
    )
    db.add(org)
    db.flush()  # Assign org.id

    # Create membership
    membership = UserOrganizationModel(
        user_id=user.id,
        org_id=org.id,
        role="owner",
    )
    db.add(membership)
    db.commit()

    logger.info("User signup: user_id={}, username={}, org_id={}, org_name='{}'", user.id, user.username, org.id, org.name)

    # Issue JWT and set httpOnly cookie
    token = create_access_token(user.id, user.username)
    response.set_cookie(
        key="cw_access_token",
        value=token,
        httponly=True,
        samesite="lax",
        path="/",
        max_age=86400,  # 24h
    )

    return TokenResponse(
        access_token=token,
        user_id=user.id,
        username=user.username,
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    """Authenticate user credentials and return JWT access token."""
    user = db.query(UserModel).filter(UserModel.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        logger.warning("Login failure: email={}", payload.email)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password.")

    token = create_access_token(user.id, user.username)
    response.set_cookie(
        key="cw_access_token",
        value=token,
        httponly=True,
        samesite="lax",
        path="/",
        max_age=86400,
    )

    logger.info("User login: user_id={}, username={}", user.id, user.username)

    return TokenResponse(
        access_token=token,
        user_id=user.id,
        username=user.username,
    )


@router.post("/logout")
def logout(response: Response):
    """Clear the auth cookie."""
    response.delete_cookie("cw_access_token", path="/")
    return {"status": "logged_out"}


@router.get("/me", response_model=UserMeResponse)
def get_me(user: UserModel = Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    return UserMeResponse(user_id=user.id, username=user.username, email=user.email)


# ---------------------------------------------------------------------------
# Organization management
# ---------------------------------------------------------------------------

org_router = APIRouter(prefix="/api/orgs", tags=["organizations"])


@org_router.post("", response_model=OrgResponse, status_code=status.HTTP_201_CREATED)
def create_organization(
    payload: OrgCreateRequest,
    user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create an additional organization for the logged-in user."""
    org = OrganizationModel(
        name=payload.name,
        owner_user_id=user.id,
    )
    db.add(org)
    db.flush()

    membership = UserOrganizationModel(
        user_id=user.id,
        org_id=org.id,
        role="owner",
    )
    db.add(membership)
    db.commit()

    logger.info("Org created: org_id={}, name='{}', owner_user_id={}", org.id, org.name, user.id)

    return OrgResponse(id=org.id, name=org.name, role="owner", created_at=org.created_at)


@org_router.get("", response_model=list[OrgResponse])
def list_organizations(
    user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all organizations the current user belongs to."""
    memberships = (
        db.query(UserOrganizationModel)
        .filter(UserOrganizationModel.user_id == user.id)
        .all()
    )
    results = []
    for m in memberships:
        org = db.query(OrganizationModel).filter(OrganizationModel.id == m.org_id).first()
        if org:
            results.append(OrgResponse(id=org.id, name=org.name, role=m.role, created_at=org.created_at))
    return results


@org_router.get("/{org_id}/registration-credentials", response_model=OrgCredentialsResponse)
def get_registration_credentials(
    org_id: str,
    user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return org registration credentials. Enforces membership check."""
    require_org_membership(user, org_id, db)

    org = db.query(OrganizationModel).filter(OrganizationModel.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found.")

    return OrgCredentialsResponse(
        org_id=org.id,
        org_name=org.name,
        registration_key=org.registration_key,
        organization_id=org.organization_id or org.id,
        enrollment_key=org.enrollment_key or org.registration_key,
    )


@org_router.post("/{org_id}/rotate-registration-key", response_model=OrgCredentialsResponse)
def rotate_registration_key(
    org_id: str,
    user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Rotate the organization's registration key. Enforces owner role membership check."""
    require_org_membership(user, org_id, db)

    membership = db.query(UserOrganizationModel).filter(
        UserOrganizationModel.user_id == user.id,
        UserOrganizationModel.org_id == org_id
    ).first()
    if not membership or membership.role != "owner":
        raise HTTPException(status_code=403, detail="Only organization owners can rotate the registration key.")

    org = db.query(OrganizationModel).filter(OrganizationModel.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found.")

    import secrets
    org.registration_key = f"cwrk_{secrets.token_hex(16)}"
    org.enrollment_key = f"cwek_{secrets.token_urlsafe(32)}"
    db.commit()
    db.refresh(org)

    logger.info("Org registration key rotated: org_id={}", org.id)

    return OrgCredentialsResponse(
        org_id=org.id,
        org_name=org.name,
        registration_key=org.registration_key,
        organization_id=org.organization_id or org.id,
        enrollment_key=org.enrollment_key,
    )


@org_router.post("/{org_id}/rotate-enrollment-key", response_model=OrgCredentialsResponse)
def rotate_enrollment_key(
    org_id: str,
    user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Rotate the organization's enrollment key. Enforces owner role membership check."""
    require_org_membership(user, org_id, db)

    membership = db.query(UserOrganizationModel).filter(
        UserOrganizationModel.user_id == user.id,
        UserOrganizationModel.org_id == org_id
    ).first()
    if not membership or membership.role != "owner":
        raise HTTPException(status_code=403, detail="Only organization owners can rotate the enrollment key.")

    org = db.query(OrganizationModel).filter(OrganizationModel.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found.")

    import secrets
    org.enrollment_key = f"cwek_{secrets.token_urlsafe(32)}"
    org.registration_key = f"cwrk_{secrets.token_hex(16)}"
    db.commit()
    db.refresh(org)

    logger.info("Org enrollment key rotated: org_id={}", org.id)

    return OrgCredentialsResponse(
        org_id=org.id,
        org_name=org.name,
        registration_key=org.registration_key,
        organization_id=org.organization_id or org.id,
        enrollment_key=org.enrollment_key,
    )

