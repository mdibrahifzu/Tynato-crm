import io
from typing import Dict, List, Optional

import pandas as pd

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import text
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from uuid import UUID

from app.dependencies import (
    get_current_team,
    get_current_user,
    get_db,
    get_pending_team_membership,
)

router = APIRouter()


# ============================================================
# CONFIGURATION
# ============================================================

MAX_FILE_SIZE = 10 * 1024 * 1024
MAX_ROWS = 5000

CUSTOM_COLUMNS = (
    "ad_name",
    "form_name",
    "full_name",
    "phone_number",
    "email",
    "project_location?",
    "created_time",
)

DB_COLUMNS = {
    "ad_name": "ad_name",
    "form_name": "form_name",
    "full_name": "full_name",
    "phone_number": "phone_number",
    "email": "email",
    "project_location?": "project_location",
    "created_time": "created_time",
}

ALLOWED_STATUSES = {
    "new",
    "converted",
    "not_interested",
    "interested",
    "follow_up",
    "junk",
}


class CustomLeadUpdateRequest(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = Field(default=None, max_length=5000)


# ============================================================
# SECURITY
# ============================================================

def _check_custom_lead_access(
    current_user,
    team,
    pending_membership,
):
    if (
        pending_membership
        and current_user["role"] != "admin"
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                "Your team invitation is pending."
            ),
        )


def _team_id_for_create(
    current_user,
    team,
):
    if current_user["role"] == "admin":
        return (
            team["team_id"]
            if team
            else None
        )

    return (
        team["team_id"]
        if team
        else None
    )


# ============================================================
# FILE PARSING
# ============================================================

def _normalize_header(value) -> str:
    if value is None:
        return ""

    return (
        str(value)
        .replace("\ufeff", "")
        .strip()
        .lower()
    )


def _read_custom_file(
    file: UploadFile,
) -> pd.DataFrame:

    filename = (
        file.filename or ""
    ).lower()

    if not filename.endswith(
        (".csv", ".xlsx", ".xls")
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported file type. "
                "Upload CSV, XLSX or XLS."
            ),
        )

    contents = file.file.read()

    if not contents:
        raise HTTPException(
            status_code=400,
            detail="The uploaded file is empty.",
        )

    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=(
                "File is too large. "
                "Maximum size is 10 MB."
            ),
        )

    try:
        if filename.endswith(".xlsx"):
            df = pd.read_excel(
                io.BytesIO(contents),
                engine="openpyxl",
                dtype=object,
            )

        elif filename.endswith(".xls"):
            df = pd.read_excel(
                io.BytesIO(contents),
                dtype=object,
            )

        else:
            if contents.startswith(
                (b"\xff\xfe", b"\xfe\xff")
            ):
                encoding = "utf-16"
            else:
                encoding = "utf-8-sig"

            df = pd.read_csv(
                io.BytesIO(contents),
                encoding=encoding,
                sep=None,
                engine="python",
                dtype=object,
            )

    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=400,
            detail=(
                "Could not decode the uploaded CSV."
            ),
        ) from exc

    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=(
                "Could not parse the uploaded file."
            ),
        ) from exc

    if len(df) > MAX_ROWS:
        raise HTTPException(
            status_code=413,
            detail=(
                "File contains too many rows. "
                "Maximum is 5000 rows."
            ),
        )

    return df


# ============================================================
# CUSTOM FIELD EXTRACTION
# ============================================================

def _prepare_rows(
    df: pd.DataFrame,
) -> List[Dict[str, str]]:

    header_map: Dict[str, object] = {}

    for column in df.columns:
        normalized = _normalize_header(column)

        if (
            normalized
            and normalized not in header_map
        ):
            header_map[normalized] = column

    rows: List[Dict[str, str]] = []

    for _, source_row in df.iterrows():

        output: Dict[str, str] = {}

        for column in CUSTOM_COLUMNS:

            source_column = header_map.get(
                _normalize_header(column)
            )

            if source_column is None:
                output[column] = ""
                continue

            value = source_row.get(
                source_column
            )

            if (
                value is None
                or pd.isna(value)
            ):
                output[column] = ""
            else:
                output[column] = str(
                    value
                ).strip()

        rows.append(output)

    return rows


# ============================================================
# PREVIEW
# ============================================================

@router.post("/leads/custom/preview")
def custom_lead_preview(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
    team=Depends(get_current_team),
    pending_membership=Depends(
        get_pending_team_membership
    ),
):
    _check_custom_lead_access(
        current_user,
        team,
        pending_membership,
    )

    df = _read_custom_file(file)

    if df.empty:
        raise HTTPException(
            status_code=400,
            detail="The uploaded file contains no rows.",
        )

    rows = _prepare_rows(df)

    return {
        "filename": file.filename,
        "columns": list(CUSTOM_COLUMNS),
        "total_rows": len(df),
        "skipped_rows": 0,
        "preview": rows[:500],
    }


# ============================================================
# IMPORT
# ============================================================

@router.post("/leads/custom/import")
def custom_lead_import(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    team=Depends(get_current_team),
    pending_membership=Depends(
        get_pending_team_membership
    ),
):
    _check_custom_lead_access(
        current_user,
        team,
        pending_membership,
    )

    df = _read_custom_file(file)

    if df.empty:
        raise HTTPException(
            status_code=400,
            detail="The uploaded file contains no rows.",
        )

    rows = _prepare_rows(df)

    team_id = _team_id_for_create(
        current_user,
        team,
    )

    saved_count = 0

    try:
        for row in rows:

            created_time = (
                row["created_time"]
                or None
            )

            # Validate timestamp if supplied.
            if created_time:
                try:
                    parsed_time = pd.to_datetime(
                        created_time,
                        errors="raise",
                        utc=True,
                    )

                    created_time = (
                        parsed_time.to_pydatetime()
                    )

                except Exception:
                    created_time = None

            db.execute(
                text(
                    """
                    INSERT INTO custom_leads (
                        ad_name,
                        form_name,
                        full_name,
                        phone_number,
                        email,
                        project_location,
                        created_time,
                        status,
                        owner_id,
                        team_id
                    )
                    VALUES (
                        :ad_name,
                        :form_name,
                        :full_name,
                        :phone_number,
                        :email,
                        :project_location,
                        :created_time,
                        'new',
                        :owner_id,
                        :team_id
                    )
                    """
                ),
                {
                    "ad_name":
                        row["ad_name"] or None,

                    "form_name":
                        row["form_name"] or None,

                    "full_name":
                        row["full_name"] or None,

                    "phone_number":
                        row["phone_number"] or None,

                    "email":
                        row["email"] or None,

                    "project_location":
                        row["project_location?"]
                        or None,

                    "created_time":
                        created_time,

                    "owner_id":
                        current_user["id"],

                    "team_id":
                        team_id,
                },
            )

            saved_count += 1

        db.commit()

    except Exception:
        db.rollback()

        raise HTTPException(
            status_code=500,
            detail="Custom lead import failed.",
        )

    return {
        "filename": file.filename,
        "saved_leads": saved_count,
        "skipped_rows": 0,
        "team_id": team_id,
    }


# ============================================================
# ACCESSIBLE CUSTOM LEADS
# ============================================================

@router.get("/custom-leads")
def get_custom_leads(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    team=Depends(get_current_team),
    pending_membership=Depends(
        get_pending_team_membership
    ),
):
    _check_custom_lead_access(
        current_user,
        team,
        pending_membership,
    )

    base_query = """
        SELECT
            id,
            ad_name,
            form_name,
            full_name,
            phone_number,
            email,
            project_location,
            created_time,
            status,
            notes,
            owner_id,
            team_id,
            created_at,
            updated_at
        FROM custom_leads
    """

    if current_user["role"] == "admin":
        query = (
            base_query
            + """
            ORDER BY
                created_time DESC NULLS LAST,
                created_at DESC
            """
        )

        params = {}

    elif team:
        query = (
            base_query
            + """
            WHERE team_id = :team_id
            ORDER BY
                created_time DESC NULLS LAST,
                created_at DESC
            """
        )

        params = {
            "team_id": team["team_id"],
        }

    else:
        query = (
            base_query
            + """
            WHERE owner_id = :owner_id
              AND team_id IS NULL
            ORDER BY
                created_time DESC NULLS LAST,
                created_at DESC
            """
        )

        params = {
            "owner_id": current_user["id"],
        }

    result = db.execute(
        text(query),
        params,
    )

    return result.mappings().all()


# ============================================================
# UPDATE STATUS + NOTES
# ============================================================

@router.patch("/custom-leads/{custom_lead_id}")
def update_custom_lead(
    custom_lead_id: UUID,
    payload: CustomLeadUpdateRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    team=Depends(get_current_team),
    pending_membership=Depends(get_pending_team_membership),
):
    _check_custom_lead_access(
        current_user,
        team,
        pending_membership,
    )

    if payload.status is None and payload.notes is None:
        raise HTTPException(
            status_code=400,
            detail="No changes supplied.",
        )

    status = (
        payload.status.strip().lower()
        if payload.status is not None
        else None
    )
    notes = (
        payload.notes.strip()
        if payload.notes is not None
        else None
    )

    if status is not None and status not in ALLOWED_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="Invalid custom lead status.",
        )

    params = {"id": str(custom_lead_id)}
    set_parts = []

    if status is not None:
        set_parts.append("status = :status")
        params["status"] = status

    if notes is not None:
        set_parts.append("notes = :notes")
        params["notes"] = notes or None

    if current_user["role"] == "admin":
        access_clause = ""
    elif team:
        access_clause = "AND team_id = :team_id"
        params["team_id"] = team["team_id"]
    else:
        access_clause = "AND owner_id = :owner_id AND team_id IS NULL"
        params["owner_id"] = current_user["id"]

    set_clause = ", ".join(set_parts)

    result = db.execute(
        text(
            f"""
            UPDATE custom_leads
            SET {set_clause}
            WHERE id = :id
            {access_clause}
            RETURNING
                id,
                ad_name,
                form_name,
                full_name,
                phone_number,
                email,
                project_location,
                created_time,
                status,
                notes,
                owner_id,
                team_id,
                created_at,
                updated_at
            """
        ),
        params,
    )

    updated = result.mappings().first()

    if not updated:
        db.rollback()
        raise HTTPException(
            status_code=404,
            detail="Custom lead not found.",
        )

    db.commit()
    return dict(updated)
