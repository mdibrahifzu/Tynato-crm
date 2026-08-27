from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse
import pandas as pd

from app.database import engine
from app.dependencies import require_admin

router = APIRouter()


@router.get("/export")
def export_leads(
    current_user=Depends(require_admin)
):
    query = """
    SELECT *
    FROM leads
    """

    df = pd.read_sql(
        query,
        engine
    )

    file_name = "leads.csv"

    df.to_csv(
        file_name,
        index=False
    )

    return FileResponse(
        file_name,
        filename=file_name
    )