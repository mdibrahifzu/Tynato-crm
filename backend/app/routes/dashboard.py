from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.dependencies import get_db, get_current_user

router = APIRouter()


@router.get("/dashboard")
def dashboard(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    owner_id = current_user["id"]
    is_admin = current_user["role"] == "admin"

    # --------------------------------------------------
    # Lead statistics
    # Admins see all leads.
    # Normal users see only their own leads.
    # --------------------------------------------------

    if is_admin:
        total_leads = db.execute(
            text("SELECT COUNT(*) FROM leads")
        ).scalar() or 0

        interested = db.execute(
            text(
                "SELECT COUNT(*) FROM leads "
                "WHERE status = 'interested'"
            )
        ).scalar() or 0

        follow_up = db.execute(
            text(
                "SELECT COUNT(*) FROM leads "
                "WHERE status = 'follow_up'"
            )
        ).scalar() or 0

        converted = db.execute(
            text(
                "SELECT COUNT(*) FROM leads "
                "WHERE status = 'converted'"
            )
        ).scalar() or 0

        # Admin can see all search history.
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

    else:
        total_leads = db.execute(
            text(
                "SELECT COUNT(*) FROM leads "
                "WHERE owner_id = :owner_id"
            ),
            {"owner_id": owner_id}
        ).scalar() or 0

        interested = db.execute(
            text(
                "SELECT COUNT(*) FROM leads "
                "WHERE owner_id = :owner_id "
                "AND status = 'interested'"
            ),
            {"owner_id": owner_id}
        ).scalar() or 0

        follow_up = db.execute(
            text(
                "SELECT COUNT(*) FROM leads "
                "WHERE owner_id = :owner_id "
                "AND status = 'follow_up'"
            ),
            {"owner_id": owner_id}
        ).scalar() or 0

        converted = db.execute(
            text(
                "SELECT COUNT(*) FROM leads "
                "WHERE owner_id = :owner_id "
                "AND status = 'converted'"
            ),
            {"owner_id": owner_id}
        ).scalar() or 0

        # Normal user sees ONLY their own search history.
        recent_searches = db.execute(
            text(
                """
                SELECT query
                FROM search_history
                WHERE owner_id = :owner_id
                ORDER BY created_at DESC
                LIMIT 5
                """
            ),
            {"owner_id": owner_id}
        ).fetchall()

    return {
        "total_leads": total_leads,
        "interested": interested,
        "follow_up": follow_up,
        "converted": converted,
        "recent_searches": [
            row[0] for row in recent_searches
        ]
    }