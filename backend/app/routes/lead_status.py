from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.dependencies import (
    get_db,
    get_current_user,
    get_current_team,
)


router = APIRouter()


@router.put("/leads/{lead_id}/status")
def update_lead_status(
    lead_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    team=Depends(get_current_team),
):
    status = payload.get("status", "new")
    notes = payload.get("notes", "")

    if team:
        result = db.execute(
            text(
                """
                UPDATE leads
                SET
                    status = :status,
                    notes = :notes,
                    last_updated = NOW()
                WHERE id = :lead_id
                  AND team_id = :team_id
                """
            ),
            {
                "status": status,
                "notes": notes,
                "lead_id": lead_id,
                "team_id": team["team_id"],
            },
        )

    else:
        result = db.execute(
            text(
                """
                UPDATE leads
                SET
                    status = :status,
                    notes = :notes,
                    last_updated = NOW()
                WHERE id = :lead_id
                  AND owner_id = :owner_id
                  AND team_id IS NULL
                """
            ),
            {
                "status": status,
                "notes": notes,
                "lead_id": lead_id,
                "owner_id": current_user["id"],
            },
        )

    db.commit()

    if result.rowcount == 0:
        raise HTTPException(
            status_code=404,
            detail="Lead not found",
        )

    return {
        "success": True,
        "lead_id": lead_id,
    }