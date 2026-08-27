from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.dependencies import get_db, get_current_user

router = APIRouter()


@router.put("/leads/{lead_id}")
def update_lead(
    lead_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    result = db.execute(
        text(
            """
            UPDATE leads
            SET
                status = :status,
                notes = :notes
            WHERE id = :lead_id AND owner_id = :owner_id
            """
        ),
        {
            "status": payload.get("status"),
            "notes": payload.get("notes"),
            "lead_id": lead_id,
            "owner_id": current_user["id"]
        }
    )

    db.commit()

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Lead not found")

    return {
        "success": True,
        "lead_id": lead_id
    }