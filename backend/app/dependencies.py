import os
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.database import SessionLocal
SUPABASE_URL = os.getenv("SUPABASE_URL")
if not SUPABASE_URL:
    raise RuntimeError("SUPABASE_URL is not configured")
JWKS_URL = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"
security = HTTPBearer()
_jwk_client = jwt.PyJWKClient(JWKS_URL)
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    token = credentials.credentials
    try:
        signing_key = _jwk_client.get_signing_key_from_jwt(token)
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256"],
            audience="authenticated",
            leeway=60,
        )
    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
        )
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="Invalid token: missing user ID",
        )
    profile = db.execute(
        text(
            """
            SELECT
                id,
                email,
                full_name,
                role,
                is_active,
                subscription_tier
            FROM profiles
            WHERE id = :id
            """
        ),
        {"id": user_id},
    ).mappings().first()
    if not profile:
        raise HTTPException(
            status_code=401,
            detail="No matching profile",
        )
    if not profile["is_active"]:
        raise HTTPException(
            status_code=403,
            detail="Account inactive",
        )
    return profile
def require_admin(
    current_user=Depends(get_current_user),
):
    if current_user["role"] != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required",
        )
    return current_user
def get_current_team(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    team = db.execute(
        text(
            """
            SELECT
                t.id AS team_id,
                t.name AS team_name,
                t.owner_id,
                t.plan,
                t.member_limit,
                t.search_limit,
                t.searches_used,
                tm.role AS team_role
            FROM team_members tm
            INNER JOIN teams t
                ON t.id = tm.team_id
            WHERE tm.member_id = :user_id
              AND tm.status = 'active'
            LIMIT 1
            """
        ),
        {
            "user_id": current_user["id"],
        },
    ).mappings().first()
    return team
def require_team(
    team=Depends(get_current_team),
):
    if not team:
        raise HTTPException(
            status_code=404,
            detail="You do not belong to a team.",
        )
    return team
def require_team_leader(
    team=Depends(require_team),
):
    if team["team_role"] != "leader":
        raise HTTPException(
            status_code=403,
            detail="Only the team leader can perform this action.",
        )
    return team
def get_pending_team_membership(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    membership = db.execute(
        text(
            """
            SELECT status
            FROM team_members
            WHERE member_id = :user_id
              AND status = 'pending'
            LIMIT 1
            """
        ),
        {
            "user_id": current_user["id"],
        },
    ).mappings().first()
    return membership