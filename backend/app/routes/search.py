from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.schemas.search import SearchRequest
from app.services.google_places import search_places
from app.dependencies import get_db, get_current_user
from app.repositories.lead_repository import save_lead
from app.config import FREE_SEARCH_LIMIT

router = APIRouter()


@router.post("/search")
def search(
    data: SearchRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    owner_id = current_user["id"]
    tier = current_user.get("subscription_tier", "free")

    # Free users: maximum 2 searches.
    # Admins are not restricted.
    if current_user["role"] != "admin" and tier == "free":
        search_count = db.execute(
            text(
                """
                SELECT COUNT(*)
                FROM search_history
                WHERE owner_id = :owner_id
                """
            ),
            {"owner_id": owner_id}
        ).scalar() or 0

        if search_count >= FREE_SEARCH_LIMIT:
            raise HTTPException(
                status_code=402,
                detail={
                    "message": "Free search limit reached.",
                    "upgrade_required": True,
                    "limit": FREE_SEARCH_LIMIT
                }
            )

    leads = search_places(data.query)

    saved_count = 0

    for lead in leads:
        save_lead(
            db=db,
            owner_id=current_user["id"],
            business_name=lead.get("business_name"),
            phone=lead.get("phone"),
            website=lead.get("website"),
            address=lead.get("address"),
            search_query=data.query
        )
        saved_count += 1

    # IMPORTANT:
    # Ownership comes from the authenticated JWT/profile,
    # never from an email supplied by the browser.
    db.execute(
        text(
            """
            INSERT INTO search_history
                (query, user_email, owner_id)
            VALUES
                (:query, :user_email, :owner_id)
            """
        ),
        {
            "query": data.query,
            "user_email": current_user["email"],
            "owner_id": owner_id
        }
    )

    db.commit()

    return {
        "query": data.query,
        "saved_leads": saved_count,
        "results": leads
    }