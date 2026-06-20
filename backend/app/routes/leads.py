from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.dependencies import get_db

router = APIRouter()

@router.get("/leads")
def get_leads(
    db: Session = Depends(get_db)
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
            ORDER BY business_name
            """
        )
    )

    return result.mappings().all()