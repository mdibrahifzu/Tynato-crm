from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.dependencies import (
    get_db,
    get_current_user,
    get_current_team,
    get_pending_team_membership,
)


router = APIRouter()


@router.get("/dashboard")
def dashboard(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    team=Depends(get_current_team),
    pending_membership=Depends(get_pending_team_membership),
):
    if pending_membership and current_user["role"] != "admin":
        return {
            "status": "pending",
            "message": "Your team invitation is pending approval.",
        }

    # =====================================================
    # ADMIN
    # =====================================================

    if current_user["role"] == "admin":
        lead_filter = ""
        params = {}

    # =====================================================
    # TEAM USER
    # =====================================================

    elif team:
        lead_filter = "WHERE team_id = :team_id"
        params = {
            "team_id": team["team_id"],
        }

    # =====================================================
    # PERSONAL USER
    # =====================================================

    else:
        lead_filter = """
            WHERE owner_id = :owner_id
              AND team_id IS NULL
        """
        params = {
            "owner_id": current_user["id"],
        }

    total_leads = db.execute(
        text(
            f"""
            SELECT COUNT(*)
            FROM leads
            {lead_filter}
            """
        ),
        params,
    ).scalar() or 0

    interested = db.execute(
        text(
            f"""
            SELECT COUNT(*)
            FROM leads
            {lead_filter}
            {"AND" if lead_filter else "WHERE"}
            status = 'interested'
            """
        ),
        params,
    ).scalar() or 0

    follow_up = db.execute(
        text(
            f"""
            SELECT COUNT(*)
            FROM leads
            {lead_filter}
            {"AND" if lead_filter else "WHERE"}
            status = 'follow_up'
            """
        ),
        params,
    ).scalar() or 0

    converted = db.execute(
        text(
            f"""
            SELECT COUNT(*)
            FROM leads
            {lead_filter}
            {"AND" if lead_filter else "WHERE"}
            status = 'converted'
            """
        ),
        params,
    ).scalar() or 0

    if current_user["role"] == "admin":
        recent_searches = db.execute(
            text(
                """
                SELECT query
                FROM search_history
                ORDER BY created_at DESC
                LIMIT 5
                """
            )
        ).fetchall()

    elif team:
        recent_searches = db.execute(
            text(
                """
                SELECT query
                FROM search_history
                WHERE team_id = :team_id
                ORDER BY created_at DESC
                LIMIT 5
                """
            ),
            {
                "team_id": team["team_id"],
            },
        ).fetchall()

    else:
        recent_searches = db.execute(
            text(
                """
                SELECT query
                FROM search_history
                WHERE owner_id = :owner_id
                  AND team_id IS NULL
                ORDER BY created_at DESC
                LIMIT 5
                """
            ),
            {
                "owner_id": current_user["id"],
            },
        ).fetchall()

    response = {
        "total_leads": total_leads,
        "interested": interested,
        "follow_up": follow_up,
        "converted": converted,
        "recent_searches": [
            row[0] for row in recent_searches
        ],
    }

    if team:
        response.update(
            {
                "team_id": team["team_id"],
                "team_name": team["team_name"],
                "team_role": team["team_role"],
                "plan": team["plan"],
                "searches_used": team["searches_used"],
                "search_limit": team["search_limit"],
                "member_limit": team["member_limit"],
            }
        )

    return response