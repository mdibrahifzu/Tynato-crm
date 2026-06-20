from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.dependencies import get_db

router = APIRouter()

@router.get("/dashboard")
def dashboard(
    db: Session = Depends(get_db)
):

    total_leads = db.execute(
        text("SELECT COUNT(*) FROM leads")
    ).scalar()

    interested = db.execute(
        text(
            "SELECT COUNT(*) FROM leads WHERE status='interested'"
        )
    ).scalar()

    follow_up = db.execute(
        text(
            "SELECT COUNT(*) FROM leads WHERE status='follow_up'"
        )
    ).scalar()

    converted = db.execute(
        text(
            "SELECT COUNT(*) FROM leads WHERE status='converted'"
        )
    ).scalar()

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

    return {
        "total_leads": total_leads,
        "interested": interested,
        "follow_up": follow_up,
        "converted": converted,
        "recent_searches": [
            row[0]
            for row in recent_searches
        ]
    }