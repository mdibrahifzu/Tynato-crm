from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.dependencies import get_db, get_current_user

router = APIRouter()


@router.get("/search_history")
def get_search_history(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    if current_user["role"] == "admin":
        result = db.execute(
            text(
                """
                SELECT
                    id,
                    query,
                    user_email,
                    created_at
                FROM search_history
                ORDER BY created_at DESC
                """
            )
        )
    else:
        result = db.execute(
            text(
                """
                SELECT
                    id,
                    query,
                    user_email,
                    created_at
                FROM search_history
                WHERE owner_id = :owner_id
                ORDER BY created_at DESC
                """
            ),
            {"owner_id": current_user["id"]}
        )

    return result.mappings().all()