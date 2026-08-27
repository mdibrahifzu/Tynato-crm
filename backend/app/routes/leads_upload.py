import io
 
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
 
from app.dependencies import get_db, get_current_user
from app.repositories.lead_repository import save_lead
 
router = APIRouter()
 
COLUMN_ALIASES = {
    "business_name": ["business_name", "business name", "company", "name"],
    "phone": ["phone", "phone number", "phone_number"],
    "website": ["website", "url", "site"],
    "address": ["address", "location"],
}
 
 
def _normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    normalized = {c: c.strip().lower() for c in df.columns}
    df = df.rename(columns=normalized)
 
    resolved = {}
    for target, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            if alias in df.columns:
                resolved[alias] = target
                break
 
    return df.rename(columns=resolved)
 
 
@router.post("/leads/upload")
def upload_leads(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    filename = (file.filename or "").lower()
 
    if not (filename.endswith(".csv") or filename.endswith(".xlsx") or filename.endswith(".xls")):
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Upload a .csv, .xlsx, or .xls file."
        )
 
    contents = file.file.read()
 
    try:
        if filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(contents))
        else:
            df = pd.read_excel(io.BytesIO(contents))
    except Exception:
        raise HTTPException(status_code=400, detail="Could not parse file. Check the format and try again.")
 
    df = _normalize_columns(df)
 
    if "business_name" not in df.columns:
        raise HTTPException(
            status_code=400,
            detail="File must include a business name column (e.g. 'business_name' or 'Company')."
        )
 
    saved_count = 0
    skipped = 0
 
    for _, row in df.iterrows():
        business_name = row.get("business_name")
 
        if pd.isna(business_name) or not str(business_name).strip():
            skipped += 1
            continue
 
        save_lead(
            db=db,
            owner_id=current_user["id"],
            business_name=str(business_name).strip(),
            phone=None if pd.isna(row.get("phone")) else str(row.get("phone")),
            website=None if pd.isna(row.get("website")) else str(row.get("website")).strip() or None,
            address=None if pd.isna(row.get("address")) else str(row.get("address")),
            search_query="csv_upload"
        )
        saved_count += 1
 
    return {
        "filename": file.filename,
        "saved_leads": saved_count,
        "skipped_rows": skipped
    }