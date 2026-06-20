from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.dependencies import get_db

router = APIRouter()

@router.put("/leads/{lead_id}")
def update_lead(
    lead_id: str,
    payload: dict,
    db: Session = Depends(get_db)
):

    db.execute(
        text(
            """
            UPDATE leads
            SET
                status = :status,
                notes = :notes
            WHERE id = :lead_id
            """
        ),
        {
            "status": payload.get("status"),
            "notes": payload.get("notes"),
            "lead_id": lead_id
        }
    )

    db.commit()

    return {
        "success": True,
        "lead_id": lead_id
    }