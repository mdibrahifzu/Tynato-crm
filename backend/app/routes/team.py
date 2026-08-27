from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.dependencies import get_db, get_current_user
from app.schemas.team import TeamMemberCreate
from app.config import FREE_SUB_USER_LIMIT

router = APIRouter()


@router.get("/team/members")
def list_team_members(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    result = db.execute(
        text(
            """
            SELECT id, member_email, member_id, status, created_at
            FROM team_members
            WHERE owner_id = :owner_id
            ORDER BY created_at DESC
            """
        ),
        {"owner_id": current_user["id"]}
    )
    return result.mappings().all()


@router.post("/team/members")
def add_team_member(
    payload: TeamMemberCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    tier = current_user.get("subscription_tier") or "free"

    if current_user["role"] != "admin" and tier == "free":
        count = db.execute(
            text(
                """
                SELECT COUNT(*)
                FROM team_members
                WHERE owner_id = :owner_id
                """
            ),
            {"owner_id": current_user["id"]}
        ).scalar() or 0

        if count >= FREE_SUB_USER_LIMIT:
            raise HTTPException(
                status_code=402,
                detail={
                    "message": "Free team-member limit reached.",
                    "upgrade_required": True,
                    "limit": FREE_SUB_USER_LIMIT
                }
            )

    existing = db.execute(
        text(
            """
            SELECT id
            FROM team_members
            WHERE owner_id = :owner_id
              AND lower(member_email) = lower(:member_email)
              AND status IN ('pending', 'active')
            LIMIT 1
            """
        ),
        {
            "owner_id": current_user["id"],
            "member_email": str(payload.email)
        }
    ).first()

    if existing:
        raise HTTPException(
            status_code=409,
            detail="This email is already a team member or has a pending invitation."
        )

    result = db.execute(
        text(
            """
            INSERT INTO team_members (owner_id, member_email, status)
            VALUES (:owner_id, :member_email, 'pending')
            RETURNING id, member_email, status, created_at
            """
        ),
        {
            "owner_id": current_user["id"],
            "member_email": str(payload.email)
        }
    )
    db.commit()

    return result.mappings().first()


@router.delete("/team/members/{member_id}")
def remove_team_member(
    member_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    result = db.execute(
        text(
            """
            DELETE FROM team_members
            WHERE id = :member_id
              AND owner_id = :owner_id
            """
        ),
        {
            "member_id": member_id,
            "owner_id": current_user["id"]
        }
    )
    db.commit()

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Team member not found")

    return {
        "success": True,
        "member_id": member_id
    }
