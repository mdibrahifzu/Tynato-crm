from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.dependencies import (
    get_db,
    get_current_user,
    get_current_team,
)
from app.services.storage import upload_lead_file

from typing import Optional
router = APIRouter()


ALLOWED_STATUSES = {
    "new",
    "converted",
    "not_interested",
    "interested",
    "follow_up",
    "junk",
}


@router.get("/leads")
def get_leads(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    team=Depends(get_current_team),
):
    base_query = """
        SELECT
            id,
            business_name,
            phone,
            website,
            address,
            status,
            notes,
            last_updated,
            follow_up_date,
            user_id,
            team_id,
            attachment_url,
            attachment_name
        FROM leads
    """

    if current_user["role"] == "admin":
        result = db.execute(
            text(
                base_query
                + """
                ORDER BY id DESC
                """
            )
        )

    elif team:
        result = db.execute(
            text(
                base_query
                + """
                WHERE team_id = :team_id
                ORDER BY id DESC
                """
            ),
            {
                "team_id": team["team_id"],
            },
        )

    else:
        result = db.execute(
            text(
                base_query
                + """
                WHERE owner_id = :owner_id
                  AND team_id IS NULL
                ORDER BY id DESC
                """
            ),
            {
                "owner_id": current_user["id"],
            },
        )

    return result.mappings().all()

@router.post("/leads/manual")
def create_lead_manual(
    business_name: str = Form(...),
    phone: str = Form(""),
    website: str = Form(""),
    address: str = Form(""),
    notes: str = Form(""),
    file: UploadFile = File(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    team=Depends(get_current_team),
):
    attachment_url = None
    attachment_name = None

    if file and file.filename:
        attachment_url = upload_lead_file(
            file.file.read(),
            file.filename,
            file.content_type,
        )
        attachment_name = file.filename

    result = db.execute(
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
                notes,
                search_query,
                attachment_url,
                attachment_name
            )
            VALUES (
                :owner_id,
                :user_id,
                :team_id,
                :business_name,
                :phone,
                :website,
                :address,
                :notes,
                'manual',
                :attachment_url,
                :attachment_name
            )
            RETURNING
                id,
                business_name,
                phone,
                website,
                address,
                status,
                notes,
                last_updated,
                follow_up_date,
                user_id,
                team_id,
                attachment_url,
                attachment_name
            """
        ),
        {
            "owner_id": current_user["id"],
            "user_id": current_user["id"],
            "team_id": team["team_id"] if team else None,
            "business_name": business_name.strip(),
            "phone": phone or None,
            "website": website or None,
            "address": address or None,
            "notes": notes or None,
            "attachment_url": attachment_url,
            "attachment_name": attachment_name,
        },
    )

    db.commit()

    return result.mappings().first()


@router.put("/leads/{lead_id}")
def update_lead(
    lead_id: str,
    status: Optional[str] = Form(None),
    notes: Optional[str] = Form(None),
    file: UploadFile = File(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    team=Depends(get_current_team),
):
    # -----------------------------
    # Build only the fields supplied
    # -----------------------------
    set_parts = []
    params = {
        "lead_id": lead_id,
    }

    # -----------------------------
    # Status
    # -----------------------------
    if status is not None:
        status = status.strip().lower()

        if status not in ALLOWED_STATUSES:
            raise HTTPException(
                status_code=400,
                detail="Invalid lead status.",
            )

        set_parts.append("status = :status")
        params["status"] = status

    # -----------------------------
    # Notes
    # -----------------------------
    if notes is not None:
        set_parts.append("notes = :notes")
        params["notes"] = notes

    # -----------------------------
    # Attachment
    # -----------------------------
    if file and file.filename:
        attachment_url = upload_lead_file(
            file.file.read(),
            file.filename,
            file.content_type,
        )

        set_parts.append(
            "attachment_url = :attachment_url"
        )
        set_parts.append(
            "attachment_name = :attachment_name"
        )

        params["attachment_url"] = attachment_url
        params["attachment_name"] = file.filename

    # -----------------------------
    # Nothing to update
    # -----------------------------
    if not set_parts:
        raise HTTPException(
            status_code=400,
            detail="No changes supplied.",
        )

    # Always refresh last_updated
    set_parts.append("last_updated = NOW()")

    set_clause = ", ".join(set_parts)

    # -----------------------------
    # Team lead
    # -----------------------------
    if team:
        params["team_id"] = team["team_id"]

        result = db.execute(
            text(
                f"""
                UPDATE leads
                SET {set_clause}
                WHERE id = :lead_id
                  AND team_id = :team_id
                """
            ),
            params,
        )

    # -----------------------------
    # Personal lead
    # -----------------------------
    else:
        params["owner_id"] = current_user["id"]

        result = db.execute(
            text(
                f"""
                UPDATE leads
                SET {set_clause}
                WHERE id = :lead_id
                  AND owner_id = :owner_id
                  AND team_id IS NULL
                """
            ),
            params,
        )

    # -----------------------------
    # Lead not found
    # -----------------------------
    if result.rowcount == 0:
        db.rollback()

        raise HTTPException(
            status_code=404,
            detail="Lead not found",
        )

    # -----------------------------
    # Save
    # -----------------------------
    db.commit()

    return {
        "success": True,
        "lead_id": lead_id,
    }