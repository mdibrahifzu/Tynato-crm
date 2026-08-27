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

    total_leads = db.execute(
        text("SELECT COUNT(*) FROM leads WHERE owner_id = :owner_id"),
        {"owner_id": owner_id}
    ).scalar()

    interested = db.execute(
        text(
            "SELECT COUNT(*) FROM leads "
            "WHERE owner_id = :owner_id AND status = 'interested'"
        ),
        {"owner_id": owner_id}
    ).scalar()

    follow_up = db.execute(
        text(
            "SELECT COUNT(*) FROM leads "
            "WHERE owner_id = :owner_id AND status = 'follow_up'"
        ),
        {"owner_id": owner_id}
    ).scalar()

    converted = db.execute(
        text(
            "SELECT COUNT(*) FROM leads "
            "WHERE owner_id = :owner_id AND status = 'converted'"
        ),
        {"owner_id": owner_id}
    ).scalar()

    recent_searches = db.execute(
        text(
            """
            SELECT query
            FROM search_history
            WHERE user_email = :user_email
            ORDER BY created_at DESC
            LIMIT 5
            """
        ),
        {"user_email": current_user["email"]}
    ).fetchall()

    leads = db.execute(
        text(
            """
            SELECT
                id,
                business_name,
                phone,
                website,
                address,
                search_query,
                status,
                notes
            FROM leads
            WHERE owner_id = :owner_id
            ORDER BY id DESC
            """
        ),
        {"owner_id": owner_id}
    ).mappings().all()

    return {
        "total_leads": total_leads,
        "interested": interested,
        "follow_up": follow_up,
        "converted": converted,
        "recent_searches": [row[0] for row in recent_searches],
        "leads": leads
    }
