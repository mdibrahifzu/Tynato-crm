from io import StringIO

import pandas as pd
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.dependencies import (
    get_db,
    get_current_user,
    get_current_team,
)

router = APIRouter()


EXPORT_COLUMNS = [
    "id",
    "business_name",
    "phone",
    "website",
    "address",
    "search_query",
    "created_at",
    "status",
    "notes",
    "last_updated",
    "follow_up_date",
    "assigned_to",
    "owner_id",
    "user_id",
    "team_id",
    "attachment_url",
    "attachment_name",
]


@router.get("/export")
def export_leads(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    team=Depends(get_current_team),
):
    columns_sql = ", ".join(EXPORT_COLUMNS)

    if current_user["role"] == "admin":
        query = f"""
            SELECT {columns_sql}
            FROM leads
            ORDER BY created_at DESC NULLS LAST, id DESC
        """
        params = {}

    elif team:
        query = f"""
            SELECT {columns_sql}
            FROM leads
            WHERE team_id = :team_id
            ORDER BY created_at DESC NULLS LAST, id DESC
        """
        params = {
            "team_id": team["team_id"],
        }

    else:
        query = f"""
            SELECT {columns_sql}
            FROM leads
            WHERE owner_id = :owner_id
              AND team_id IS NULL
            ORDER BY created_at DESC NULLS LAST, id DESC
        """
        params = {
            "owner_id": current_user["id"],
        }

    result = db.execute(
        text(query),
        params,
    )

    rows = result.mappings().all()

    df = pd.DataFrame(
        rows,
        columns=EXPORT_COLUMNS,
    )

    output = StringIO()

    df.to_csv(
        output,
        index=False,
    )

    output.seek(0)

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": (
                'attachment; filename="leads.csv"'
            )
        },
    )