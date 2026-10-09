import io
 
from typing import Dict, List, Optional
from uuid import UUID
 
import pandas as pd
 
from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
)
 
from sqlalchemy import text
from sqlalchemy.orm import Session
 
from pydantic import BaseModel, Field
 
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
# SHARED LEAD CREATION
# ============================================================
 
def create_custom_lead_record(
    db: Session,
    *,
    team_id,
    owner_id,
    ad_name: Optional[str] = None,
    form_name: Optional[str] = None,
    full_name: Optional[str] = None,
    phone_number: Optional[str] = None,
    email: Optional[str] = None,
    project_location: Optional[str] = None,
    created_time=None,
):
    row = db.execute(
        text(
            """
            INSERT INTO public.custom_leads (
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
            RETURNING id, owner_id, team_id
            """
        ),
        {
            "ad_name": ad_name,
            "form_name": form_name,
            "full_name": full_name,
            "phone_number": phone_number,
            "email": email,
            "project_location": project_location,
            "created_time": created_time,
            "owner_id": owner_id,
            "team_id": team_id,
        },
    ).mappings().first()
 
    if not row:
        raise RuntimeError("Lead creation failed.")
 
    return dict(row)
 
 
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
 
            create_custom_lead_record(
                db,
                team_id=team_id,
                owner_id=current_user["id"],
                ad_name=row["ad_name"] or None,
                form_name=row["form_name"] or None,
                full_name=row["full_name"] or None,
                phone_number=row["phone_number"] or None,
                email=row["email"] or None,
                project_location=row["project_location?"] or None,
                created_time=created_time,
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
    source: Optional[str] = None,
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
            cl.id,
            cl.ad_name,
            cl.form_name,
            cl.full_name,
            cl.phone_number,
            cl.email,
            cl.project_location,
            cl.created_time,
            cl.status,
            cl.notes,
            cl.owner_id,
            cl.team_id,
            cl.created_at,
            cl.updated_at,
            f.follow_up AS follow_up,
            a.attribution AS attribution
        FROM (__SOURCE_ROWS__) cl
        LEFT JOIN LATERAL (
            SELECT jsonb_build_object(
                'id', lf.id,
                'custom_lead_id', lf.custom_lead_id,
                'team_id', lf.team_id,
                'assigned_to', lf.assigned_to,
                'follow_up_at', lf.follow_up_at,
                'reminder_offset_minutes', lf.reminder_offset_minutes,
                'remind_at', lf.remind_at,
                'status', lf.status,
                'reminder_sent_at', lf.reminder_sent_at,
                'created_at', lf.created_at,
                'updated_at', lf.updated_at
            ) AS follow_up
            FROM public.lead_follow_ups lf
            WHERE lf.custom_lead_id = cl.id
              AND lf.status IN ('scheduled', 'processing', 'reminded')
            ORDER BY lf.updated_at DESC
            LIMIT 1
        ) f ON TRUE
        LEFT JOIN LATERAL (
            SELECT jsonb_build_object(
                'campaign_id', sa.meta_campaign_id,
                'campaign_name', COALESCE(
                    (SELECT mc.name FROM public.meta_campaigns mc
                     WHERE mc.team_id = sa.team_id
                       AND mc.meta_campaign_id = sa.meta_campaign_id
                     ORDER BY mc.updated_at DESC LIMIT 1),
                    sa.campaign_name_snapshot
                ),
                'adset_id', sa.meta_adset_id,
                'adset_name', (
                    SELECT ms.name FROM public.meta_adsets ms
                    WHERE ms.team_id = sa.team_id
                      AND ms.meta_adset_id = sa.meta_adset_id
                    LIMIT 1
                ),
                'ad_id', sa.meta_ad_id,
                'ad_name', (
                    SELECT md.name FROM public.meta_ads md
                    WHERE md.team_id = sa.team_id
                      AND md.meta_ad_id = sa.meta_ad_id
                    LIMIT 1
                ),
                'form_id', sa.meta_form_id,
                'form_name', COALESCE(
                    (SELECT mf.name FROM public.meta_lead_forms mf
                     WHERE mf.team_id = sa.team_id
                       AND mf.meta_form_id = sa.meta_form_id
                     LIMIT 1),
                    sa.form_name_snapshot
                ),
                'leadgen_id', sa.leadgen_id
            ) AS attribution
            FROM public.lead_source_attribution sa
            WHERE sa.lead_id = cl.id
              AND sa.source = 'meta'
            LIMIT 1
        ) a ON TRUE
    """
 
    exists_sql = (
        "EXISTS (SELECT 1 FROM public.lead_source_attribution a "
        "WHERE a.lead_id = custom_leads.id AND a.source = 'meta')"
    )
    if source == "meta":
        rows_sql = "SELECT * FROM public.custom_leads WHERE " + exists_sql
    elif source == "import":
        rows_sql = "SELECT * FROM public.custom_leads WHERE NOT " + exists_sql
    else:
        rows_sql = "SELECT * FROM public.custom_leads"
    base_query = base_query.replace("__SOURCE_ROWS__", rows_sql)
 
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
 
    # A lead cannot be put into follow_up status without an actual
    # scheduled follow-up. The dedicated follow-up endpoint creates
    # or reschedules that record first.
    if status == "follow_up":
        if current_user["role"] == "admin":
            follow_up_access = ""
            follow_up_params = {"id": str(custom_lead_id)}
        elif team:
            follow_up_access = "AND team_id = :team_id"
            follow_up_params = {
                "id": str(custom_lead_id),
                "team_id": team["team_id"],
            }
        else:
            follow_up_access = "AND owner_id = :owner_id AND team_id IS NULL"
            follow_up_params = {
                "id": str(custom_lead_id),
                "owner_id": current_user["id"],
            }
 
        has_follow_up = db.execute(
            text(
                f"""
                SELECT 1
                FROM public.custom_leads
                WHERE id = :id
                  {follow_up_access}
                  AND EXISTS (
                      SELECT 1
                      FROM public.lead_follow_ups lf
                      WHERE lf.custom_lead_id = public.custom_leads.id
                        AND lf.status IN ('scheduled', 'processing', 'reminded')
                  )
                LIMIT 1
                """
            ),
            follow_up_params,
        ).first()
 
        if has_follow_up is None:
            raise HTTPException(
                status_code=400,
                detail="Schedule a follow-up before setting this lead to follow_up.",
            )
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
 
    # Leaving follow_up status cancels any active scheduled reminder.
    if status is not None and status != "follow_up":
        db.execute(
            text(
                """
                UPDATE public.lead_follow_ups
                SET
                    status = 'cancelled',
                    updated_at = NOW()
                WHERE custom_lead_id = :custom_lead_id
                  AND status IN ('scheduled', 'processing', 'reminded')
                """
            ),
            {"custom_lead_id": str(custom_lead_id)},
        )
 
    db.commit()
    return dict(updated)
 
# ============================================================
# DELETE CUSTOM LEAD
# ============================================================
 
# ============================================================
# DELETE CUSTOM LEAD
# ============================================================
 
@router.delete(
    "/custom-leads/{custom_lead_id}"
)
def delete_custom_lead(
    custom_lead_id: UUID,
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
 
    is_admin = (
        str(current_user.get("role", "")).lower()
        == "admin"
        and current_user.get("is_active", True)
    )
 
    team_id = (
        team["team_id"]
        if team
        else None
    )
 
    owner_id = current_user["id"]
 
    result = db.execute(
        text("""
            DELETE FROM public.custom_leads
            WHERE id = :custom_lead_id
              AND (
                    :is_admin = TRUE
 
                    OR owner_id = :owner_id
 
                    OR (
                        :team_id IS NOT NULL
                        AND team_id = :team_id
                    )
              )
            RETURNING
                id,
                full_name,
                phone_number,
                email,
                owner_id,
                team_id
        """),
        {
            "custom_lead_id": custom_lead_id,
            "is_admin": is_admin,
            "owner_id": owner_id,
            "team_id": team_id,
        },
    )
 
    deleted = result.mappings().first()
 
    if not deleted:
        # Distinguish "does not exist" from "not accessible".
        existing = db.execute(
            text("""
                SELECT
                    id,
                    owner_id,
                    team_id
                FROM public.custom_leads
                WHERE id = :custom_lead_id
                LIMIT 1
            """),
            {
                "custom_lead_id": custom_lead_id,
            },
        ).mappings().first()
 
        db.rollback()
 
        if not existing:
            raise HTTPException(
                status_code=404,
                detail="Custom lead does not exist.",
            )
 
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to delete this custom lead.",
        )
 
    db.commit()
 
    return {
        "success": True,
        "message": "Custom lead deleted successfully.",
        "deleted_lead": dict(deleted),
    }