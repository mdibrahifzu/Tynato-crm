from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.dependencies import get_db, get_current_user

router = APIRouter()


@router.get("/leads")
def get_leads(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    result = db.execute(
        text(
            """
            SELECT
                id,
                business_name,
                phone,
                website,
                address,
                status,
                notes
            FROM leads
            WHERE owner_id = :owner_id
            ORDER BY id DESC
            """
        ),
        {
            "owner_id": current_user["id"]
        }
    )

    return result.mappings().all()