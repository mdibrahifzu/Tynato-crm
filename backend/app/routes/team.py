from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.dependencies import (
    get_db,
    get_current_user,
    get_current_team,
    require_team,
    require_team_leader,
)

from app.schemas.team import TeamCreate, TeamMemberCreate
from app.config import FREE_SUB_USER_LIMIT, FREE_SEARCH_LIMIT


router = APIRouter()


# =========================================================
# GET CURRENT TEAM
# =========================================================

@router.get("/team/me")
def get_my_team(
    team=Depends(get_current_team),
):
    if not team:
        return {
            "has_team": False,
            "team": None,
        }

    return {
        "has_team": True,
        "team": team,
    }


# =========================================================
# CREATE TEAM
# =========================================================

@router.post("/team")
def create_team(
    payload: TeamCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    team_name = payload.name.strip()

    if not team_name:
        raise HTTPException(
            status_code=400,
            detail="Team name cannot be empty.",
        )

    # A user can belong to only one active team.
    existing_membership = db.execute(
        text(
            """
            SELECT id
            FROM team_members
            WHERE member_id = :user_id
              AND status = 'active'
            LIMIT 1
            """
        ),
        {
            "user_id": current_user["id"],
        },
    ).first()

    if existing_membership:
        raise HTTPException(
            status_code=409,
            detail="You already belong to a team.",
        )

    # Create team.
    team = db.execute(
        text(
            """
            INSERT INTO teams (
                name,
                owner_id,
                plan,
                member_limit,
                search_limit,
                searches_used
            )
            VALUES (
                :name,
                :owner_id,
                'free',
                :member_limit,
                :search_limit,
                0
            )
            RETURNING
                id,
                name,
                owner_id,
                plan,
                member_limit,
                search_limit,
                searches_used,
                created_at
            """
        ),
        {
            "name": team_name,
            "owner_id": current_user["id"],
            "member_limit": FREE_SUB_USER_LIMIT,
            "search_limit": FREE_SEARCH_LIMIT,
        },
    ).mappings().first()

    if not team:
        raise HTTPException(
            status_code=500,
            detail="Failed to create team.",
        )

    # Creator becomes the team leader.
    db.execute(
        text(
            """
            INSERT INTO team_members (
                team_id,
                owner_id,
                member_email,
                member_id,
                role,
                status
            )
            VALUES (
                :team_id,
                :owner_id,
                :email,
                :member_id,
                'leader',
                'active'
            )
            """
        ),
        {
            "team_id": team["id"],
            "owner_id": current_user["id"],
            "email": current_user["email"],
            "member_id": current_user["id"],
        },
    )

    # --------------------------------------------------
    # Existing personal leads/searches belonging to the
    # owner become part of the newly created team.
    #
    # They do NOT consume the team's search allowance.
    # --------------------------------------------------

    db.execute(
        text(
            """
            UPDATE leads
            SET team_id = :team_id
            WHERE owner_id = :user_id
              AND team_id IS NULL
            """
        ),
        {
            "team_id": team["id"],
            "user_id": current_user["id"],
        },
    )

    db.execute(
        text(
            """
            UPDATE search_history
            SET team_id = :team_id
            WHERE owner_id = :user_id
              AND team_id IS NULL
            """
        ),
        {
            "team_id": team["id"],
            "user_id": current_user["id"],
        },
    )

    db.commit()

    return {
        "success": True,
        "team": team,
    }


# =========================================================
# LIST TEAM MEMBERS
# =========================================================

@router.get("/team/members")
def list_team_members(
    db: Session = Depends(get_db),
    team=Depends(require_team),
):
    result = db.execute(
        text(
            """
            SELECT
                tm.id,
                tm.member_email,
                tm.member_id,
                tm.role,
                tm.status,
                tm.created_at,
                p.full_name
            FROM team_members tm
            LEFT JOIN profiles p
                ON p.id = tm.member_id
            WHERE tm.team_id = :team_id
              AND tm.status IN ('pending', 'active')
            ORDER BY
                CASE
                    WHEN tm.role = 'leader' THEN 0
                    ELSE 1
                END,
                tm.created_at ASC
            """
        ),
        {
            "team_id": team["team_id"],
        },
    )

    return result.mappings().all()


# =========================================================
# INVITE MEMBER
# =========================================================

@router.post("/team/members")
def add_team_member(
    payload: TeamMemberCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    team=Depends(require_team_leader),
):
    email = str(payload.email).strip().lower()

    if email == str(current_user["email"]).lower():
        raise HTTPException(
            status_code=400,
            detail="You cannot invite yourself.",
        )

    # Count only actual/pending members, not the leader.
    member_count = db.execute(
        text(
            """
            SELECT COUNT(*)
            FROM team_members
            WHERE team_id = :team_id
              AND role = 'member'
              AND status IN ('pending', 'active')
            """
        ),
        {
            "team_id": team["team_id"],
        },
    ).scalar() or 0

    if member_count >= team["member_limit"]:
        raise HTTPException(
            status_code=402,
            detail={
                "message": "Team member limit reached.",
                "upgrade_required": True,
                "limit": team["member_limit"],
            },
        )

    # If the invited email already belongs to a profile,
    # use its user ID immediately.
    profile = db.execute(
        text(
            """
            SELECT
                id,
                email
            FROM profiles
            WHERE lower(email) = lower(:email)
            LIMIT 1
            """
        ),
        {
            "email": email,
        },
    ).mappings().first()

    member_id = profile["id"] if profile else None

    # Existing active team membership is not allowed.
    if member_id:
        active_membership = db.execute(
            text(
                """
                SELECT team_id
                FROM team_members
                WHERE member_id = :member_id
                  AND status = 'active'
                LIMIT 1
                """
            ),
            {
                "member_id": member_id,
            },
        ).first()

        if active_membership:
            raise HTTPException(
                status_code=409,
                detail="This user already belongs to a team.",
            )

    duplicate = db.execute(
        text(
            """
            SELECT id
            FROM team_members
            WHERE team_id = :team_id
              AND lower(member_email) = lower(:email)
              AND status IN ('pending', 'active')
            LIMIT 1
            """
        ),
        {
            "team_id": team["team_id"],
            "email": email,
        },
    ).first()

    if duplicate:
        raise HTTPException(
            status_code=409,
            detail="This user already has a pending or active invitation.",
        )

    invitation = db.execute(
        text(
            """
            INSERT INTO team_members (
                team_id,
                owner_id,
                member_email,
                member_id,
                role,
                status
            )
            VALUES (
                :team_id,
                :owner_id,
                :member_email,
                :member_id,
                'member',
                'pending'
            )
            RETURNING
                id,
                team_id,
                member_email,
                member_id,
                role,
                status,
                created_at
            """
        ),
        {
            "team_id": team["team_id"],
            "owner_id": current_user["id"],
            "member_email": email,
            "member_id": member_id,
        },
    ).mappings().first()

    db.commit()

    return {
        "success": True,
        "invitation": invitation,
    }


# =========================================================
# REMOVE MEMBER
# =========================================================

@router.delete("/team/members/{membership_id}")
def remove_team_member(
    membership_id: str,
    db: Session = Depends(get_db),
    team=Depends(require_team_leader),
):
    result = db.execute(
        text(
            """
            UPDATE team_members
            SET status = 'removed'
            WHERE id = :membership_id
              AND team_id = :team_id
              AND role = 'member'
              AND status IN ('pending', 'active')
            """
        ),
        {
            "membership_id": membership_id,
            "team_id": team["team_id"],
        },
    )

    db.commit()

    if result.rowcount == 0:
        raise HTTPException(
            status_code=404,
            detail="Team member not found.",
        )

    return {
        "success": True,
        "membership_id": membership_id,
    }


# =========================================================
# INCOMING INVITATIONS
# =========================================================

@router.get("/team/invitations")
def get_invitations(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = db.execute(
        text(
            """
            SELECT
                tm.id,
                tm.team_id,
                tm.member_email,
                tm.member_id,
                tm.role,
                tm.status,
                tm.created_at,
                t.name AS team_name,
                t.owner_id
            FROM team_members tm
            INNER JOIN teams t
                ON t.id = tm.team_id
            WHERE tm.status = 'pending'
              AND (
                    lower(tm.member_email) = lower(:email)
                    OR tm.member_id = :user_id
                  )
            ORDER BY tm.created_at DESC
            """
        ),
        {
            "email": current_user["email"],
            "user_id": current_user["id"],
        },
    )

    return result.mappings().all()


# =========================================================
# ACCEPT INVITATION
# =========================================================

@router.post("/team/invitations/{invitation_id}/accept")
def accept_invitation(
    invitation_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    # One active team maximum.
    active_team = db.execute(
        text(
            """
            SELECT team_id
            FROM team_members
            WHERE member_id = :user_id
              AND status = 'active'
            LIMIT 1
            """
        ),
        {
            "user_id": current_user["id"],
        },
    ).first()

    if active_team:
        raise HTTPException(
            status_code=409,
            detail="You already belong to a team.",
        )

    invitation = db.execute(
        text(
            """
            SELECT
                tm.id,
                tm.team_id,
                t.member_limit
            FROM team_members tm
            INNER JOIN teams t
                ON t.id = tm.team_id
            WHERE tm.id = :invitation_id
              AND tm.status = 'pending'
              AND (
                    lower(tm.member_email) = lower(:email)
                    OR tm.member_id = :user_id
                  )
            LIMIT 1
            """
        ),
        {
            "invitation_id": invitation_id,
            "email": current_user["email"],
            "user_id": current_user["id"],
        },
    ).mappings().first()

    if not invitation:
        raise HTTPException(
            status_code=404,
            detail="Invitation not found.",
        )

    member_count = db.execute(
        text(
            """
            SELECT COUNT(*)
            FROM team_members
            WHERE team_id = :team_id
              AND role = 'member'
              AND status IN ('pending', 'active')
            """
        ),
        {
            "team_id": invitation["team_id"],
        },
    ).scalar() or 0

    if member_count > invitation["member_limit"]:
        raise HTTPException(
            status_code=402,
            detail="The team member limit has been reached.",
        )

    db.execute(
        text(
            """
            UPDATE team_members
            SET
                member_id = :user_id,
                member_email = :email,
                status = 'active'
            WHERE id = :invitation_id
            """
        ),
        {
            "user_id": current_user["id"],
            "email": current_user["email"],
            "invitation_id": invitation_id,
        },
    )

    # Existing personal leads become part of the team.
    db.execute(
        text(
            """
            UPDATE leads
            SET team_id = :team_id
            WHERE owner_id = :user_id
              AND team_id IS NULL
            """
        ),
        {
            "team_id": invitation["team_id"],
            "user_id": current_user["id"],
        },
    )

    # Existing personal search history becomes team history.
    db.execute(
        text(
            """
            UPDATE search_history
            SET team_id = :team_id
            WHERE owner_id = :user_id
              AND team_id IS NULL
            """
        ),
        {
            "team_id": invitation["team_id"],
            "user_id": current_user["id"],
        },
    )

    db.commit()

    return {
        "success": True,
        "team_id": invitation["team_id"],
    }


# =========================================================
# REJECT INVITATION
# =========================================================

@router.post("/team/invitations/{invitation_id}/reject")
def reject_invitation(
    invitation_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = db.execute(
        text(
            """
            UPDATE team_members
            SET status = 'rejected'
            WHERE id = :invitation_id
              AND status = 'pending'
              AND (
                    lower(member_email) = lower(:email)
                    OR member_id = :user_id
                  )
            """
        ),
        {
            "invitation_id": invitation_id,
            "email": current_user["email"],
            "user_id": current_user["id"],
        },
    )

    db.commit()

    if result.rowcount == 0:
        raise HTTPException(
            status_code=404,
            detail="Invitation not found.",
        )

    return {
        "success": True,
    }