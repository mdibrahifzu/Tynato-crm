from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.schemas.search import SearchRequest
from app.services.google_places import search_places
from app.dependencies import get_db
from app.repositories.lead_repository import save_lead

router = APIRouter()

@router.post("/search")
def search(
    data: SearchRequest,
    db: Session = Depends(get_db)
):

    print("SEARCH RECEIVED")
    print("Query:", data.query)
    print("User Email:", data.user_email)

    leads = search_places(data.query)

    saved_count = 0

    for lead in leads:

        save_lead(
            db=db,
            business_name=lead.get("business_name"),
            phone=lead.get("phone"),
            website=lead.get("website"),
            address=lead.get("address"),
            search_query=data.query
        )

        saved_count += 1

    try:

        print("Saving search history...")

        db.execute(
            text(
                """
                INSERT INTO search_history
                (
                    query,
                    user_email
                )
                VALUES
                (
                    :query,
                    :user_email
                )
                """
            ),
            {
                "query": data.query,
                "user_email": data.user_email
            }
        )

        db.commit()

        print("Search history saved successfully")

    except Exception as e:

        print("SEARCH HISTORY ERROR:")
        print(str(e))

    return {
        "query": data.query,
        "saved_leads": saved_count,
        "results": leads
    }