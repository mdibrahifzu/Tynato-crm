import io

import pandas as pd

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    UploadFile,
    File,
)
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.dependencies import (
    get_db,
    get_current_user,
    get_current_team,
    get_pending_team_membership,
)


router = APIRouter()


# ============================================================
# NORMAL LEAD UPLOAD
# ============================================================

COLUMN_ALIASES = {
    "business_name": [
        "business_name",
        "business name",
        "company",
        "name",
    ],
    "phone": [
        "phone",
        "phone number",
        "phone_number",
    ],
    "website": [
        "website",
        "url",
        "site",
    ],
    "address": [
        "address",
        "location",
    ],
}


def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    normalized = {
        column: str(column).strip().lower()
        for column in df.columns
    }

    df = df.rename(columns=normalized)

    resolved = {}

    for target, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            if alias in df.columns:
                resolved[alias] = target
                break

    return df.rename(columns=resolved)


# ============================================================
# NORMAL LEAD UPLOAD — UNCHANGED BEHAVIOUR
# ============================================================

@router.post("/leads/upload")
def upload_leads(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    team=Depends(get_current_team),
    pending_membership=Depends(get_pending_team_membership),
):
    if pending_membership:
        raise HTTPException(
            status_code=403,
            detail=(
                "Your team invitation is pending. "
                "This action is not available until you're "
                "an active team member."
            ),
        )

    filename = (file.filename or "").lower()

    if not filename.endswith((".csv", ".xlsx", ".xls")):
        raise HTTPException(
            status_code=400,
            detail=(
                "Unsupported file type. "
                "Upload a .csv, .xlsx, or .xls file."
            ),
        )

    contents = file.file.read()

    try:
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(contents))
        else:
            df = pd.read_excel(io.BytesIO(contents))
    except Exception:
        raise HTTPException(
            status_code=400,
            detail=(
                "Could not parse file. "
                "Check the format and try again."
            ),
        )

    df = _normalize_columns(df)

    if "business_name" not in df.columns:
        raise HTTPException(
            status_code=400,
            detail=(
                "File must include a business name column "
                "(e.g. 'business_name' or 'Company')."
            ),
        )

    saved_count = 0
    skipped = 0

    for _, row in df.iterrows():
        business_name = row.get("business_name")

        if (
            pd.isna(business_name)
            or not str(business_name).strip()
        ):
            skipped += 1
            continue

        db.execute(
            text(
                """
                INSERT INTO leads (
                    owner_id,
                    user_id,
                    team_id,
                    business_name,
                    phone,
                    website,
                    address,
                    search_query
                )
                VALUES (
                    :owner_id,
                    :user_id,
                    :team_id,
                    :business_name,
                    :phone,
                    :website,
                    :address,
                    'csv_upload'
                )
                """
            ),
            {
                "owner_id": current_user["id"],
                "user_id": current_user["id"],
                "team_id": (
                    team["team_id"]
                    if team
                    else None
                ),
                "business_name": str(
                    business_name
                ).strip(),
                "phone": (
                    None
                    if pd.isna(row.get("phone"))
                    else str(row.get("phone")).strip()
                    or None
                ),
                "website": (
                    None
                    if pd.isna(row.get("website"))
                    else str(row.get("website")).strip()
                    or None
                ),
                "address": (
                    None
                    if pd.isna(row.get("address"))
                    else str(row.get("address")).strip()
                    or None
                ),
            },
        )

        saved_count += 1

    db.commit()

    return {
        "filename": file.filename,
        "saved_leads": saved_count,
        "skipped_rows": skipped,
        "team_id": (
            team["team_id"]
            if team
            else None
        ),
    }
