import os

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import text
from sqlalchemy.orm import Session

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
                platform_role,
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


def require_sales_scheduler(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Dedicated internal scheduling permission.

    Access is granted only when the authenticated profile has an
    active row in the private sales_scheduler_users table. No customer
    team role (user/admin) is treated as scheduler access.
    """
    scheduler = db.execute(
        text(
            """
            SELECT 1
            FROM public.sales_scheduler_users s
            INNER JOIN public.profiles p
                ON p.id = s.user_id
            WHERE s.user_id = :user_id
              AND s.is_active = TRUE
              AND p.is_active = TRUE
            LIMIT 1
            """
        ),
        {"user_id": current_user["id"]},
    ).first()

    if not scheduler:
        raise HTTPException(
            status_code=403,
            detail="Sales Scheduler access required.",
        )

    return current_user


def require_super_admin(
    current_user=Depends(get_current_user),
):
    if current_user["platform_role"] != "super_admin":
        raise HTTPException(
            status_code=403,
            detail="Super Admin access required",
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
                t.status AS team_status,
                tm.role AS team_role
            FROM public.team_members tm
            INNER JOIN public.teams t
                ON t.id = tm.team_id
            WHERE tm.member_id = :user_id
              AND tm.status = 'active'
              AND t.status = 'active'
            LIMIT 1
            """
        ),
        {
            "user_id": current_user["id"],
        },
    ).mappings().first()

    return team


def require_admin(
    current_user=Depends(get_current_user),
):
    if current_user["role"] != "admin":
        raise HTTPException(
            status_code=403,
            detail="Admin access required",
        )

    return current_user


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
            FROM public.team_members
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


def require_module(module_key: str):
    """
    Backend module authorization.

    Priority:
    1. Suspended organization -> deny
    2. Explicit access_override -> use it
    3. Otherwise preserve the existing module behavior
    """

def require_module(module_key: str):
    """
    Backend module authorization.

    Priority:
    1. Suspended organization -> deny
    2. Explicit access_override -> use it
    3. Otherwise preserve the existing module behavior
    """

    def dependency(
        db: Session = Depends(get_db),
        current_user=Depends(get_current_user),
    ):
        access = db.execute(
            text(
                """
                SELECT
                    m.module_key,
                    m.module_name,
                    m.is_enabled AS global_enabled,

                    t.id AS team_id,
                    t.status AS team_status,

                    ctm.is_enabled AS legacy_org_enabled,
                    ctm.access_override AS organization_override,

                    CASE
                        WHEN t.id IS NULL THEN
                            m.is_enabled

                        WHEN t.status <> 'active' THEN
                            FALSE

                        ELSE
                            COALESCE(
                                ctm.access_override,
                                (
                                    m.is_enabled
                                    AND COALESCE(ctm.is_enabled, TRUE)
                                )
                            )
                    END AS effective_enabled

                FROM public.crm_module_settings m

                LEFT JOIN LATERAL (
                    SELECT
                        t.id,
                        t.status
                    FROM public.team_members tm
                    INNER JOIN public.teams t
                        ON t.id = tm.team_id
                    WHERE tm.member_id = :user_id
                      AND tm.status = 'active'
                    ORDER BY
                        (t.status = 'active') DESC
                    LIMIT 1
                ) t
                    ON TRUE

                LEFT JOIN public.crm_team_module_settings ctm
                    ON ctm.team_id = t.id
                   AND ctm.module_key = m.module_key

                WHERE m.module_key = :module_key

                LIMIT 1
                """
            ),
            {
                "user_id": current_user["id"],
                "module_key": module_key,
            },
        ).mappings().first()

        if not access:
            raise HTTPException(
                status_code=404,
                detail=f"Module '{module_key}' is not configured.",
            )

        if (
            access["team_id"] is not None
            and access["team_status"] != "active"
        ):
            raise HTTPException(
                status_code=403,
                detail={
                    "code": "ORGANIZATION_SUSPENDED",
                    "module": module_key,
                    "message": (
                        "Your organization is currently suspended. "
                        "Contact Tynato Support for assistance."
                    ),
                },
            )

        if access["effective_enabled"] is not True:
            raise HTTPException(
                status_code=403,
                detail={
                    "code": "FEATURE_DISABLED",
                    "module": module_key,
                    "message": (
                        f"{access['module_name']} is not enabled "
                        "for your organization. "
                        "Contact Tynato Support for access or more details."
                    ),
                },
            )

        return current_user

    return dependency