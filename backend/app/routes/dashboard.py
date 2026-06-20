from fastapi import APIRouter
from sqlalchemy import text

from app.database import engine

router = APIRouter()

@router.get("/dashboard")
def dashboard():

    with engine.connect() as conn:

        leads = conn.execute(
            text("SELECT COUNT(*) FROM leads")
        ).scalar()

        users = conn.execute(
            text("SELECT COUNT(*) FROM profiles")
        ).scalar()

        return {
            "total_leads": leads,
            "total_users": users
        }