from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.dependencies import (
    get_db,
    get_current_user,
    get_current_team,
)


router = APIRouter()


@router.get("/search_history")
def get_search_history(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    team=Depends(get_current_team),
):
    if current_user["role"] == "admin":
        result = db.execute(
            text(
                """
                SELECT
                    id,
                    query,
                    user_email,
                    owner_id,
                    team_id,
                    created_at
                FROM search_history
                ORDER BY created_at DESC
                """
            )
        )

    elif team:
        result = db.execute(
            text(
                """
                SELECT
                    id,
                    query,
                    user_email,
                    owner_id,
                    team_id,
                    created_at
                FROM search_history
                WHERE team_id = :team_id
                ORDER BY created_at DESC
                """
            ),
            {
                "team_id": team["team_id"],
            },
        )

    else:
        result = db.execute(
            text(
                """
                SELECT
                    id,
                    query,
                    user_email,
                    owner_id,
                    team_id,
                    created_at
                FROM search_history
                WHERE owner_id = :owner_id
                  AND team_id IS NULL
                ORDER BY created_at DESC
                """
            ),
            {
                "owner_id": current_user["id"],
            },
        )

    return result.mappings().all()