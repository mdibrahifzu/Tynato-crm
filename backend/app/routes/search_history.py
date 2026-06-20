from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.dependencies import get_db

router = APIRouter()

@router.get("/search_history")
def get_search_history(
    db: Session = Depends(get_db)
):

    try:

        print("Fetching search history...")

        result = db.execute(
            text(
                """
                SELECT *
                FROM search_history
                ORDER BY created_at DESC
                """
            )
        )

        rows = result.mappings().all()

        print(f"Rows Found: {len(rows)}")

        return rows

    except Exception as e:

        print("SEARCH HISTORY ERROR:")
        print(str(e))

        return {
            "error": str(e)
        }