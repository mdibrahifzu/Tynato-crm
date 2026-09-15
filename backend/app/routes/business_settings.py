from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.dependencies import (
    get_current_team,
    get_current_user,
    get_db,
)
from app.invoice_logo_storage import (
    create_invoice_logo_signed_url,
    upload_invoice_logo_with_path,
)
from app.repositories.business_settings_repository import (
    get_business_settings_for_workspace,
    update_logo_path,
    upsert_business_settings,
)
from app.schemas.business_settings import (
    BusinessSettingsResponse,
    BusinessSettingsUpdate,
)


# ============================================================
# LOGGING
# ============================================================

logger = logging.getLogger(__name__)


# ============================================================
# ROUTER
# ============================================================

router = APIRouter(
    prefix="/business-settings",
    tags=["business-settings"],
)


# ============================================================
# LOGO CONFIGURATION
# ============================================================

ALLOWED_LOGO_TYPES = {
    "image/png",
    "image/jpeg",
    "image/webp",
}

MAX_LOGO_SIZE = 2 * 1024 * 1024  # 2 MB


# ============================================================
# IMAGE VALIDATION
# ============================================================

def _validate_logo_bytes(
    content: bytes,
    content_type: str,
) -> None:
    """
    Validate the actual file signature.

    Checking only file.content_type is not sufficient because the
    browser can send a misleading MIME type.
    """

    # PNG
    if (
        content_type == "image/png"
        and content.startswith(b"\x89PNG\r\n\x1a\n")
    ):
        return

    # JPEG
    if (
        content_type == "image/jpeg"
        and content.startswith(b"\xff\xd8\xff")
    ):
        return

    # WEBP
    if (
        content_type == "image/webp"
        and len(content) >= 12
        and content[:4] == b"RIFF"
        and content[8:12] == b"WEBP"
    ):
        return

    raise HTTPException(
        status_code=400,
        detail="Logo file content does not match the declared image type.",
    )


# ============================================================
# WORKSPACE CONTEXT
# ============================================================

def _workspace_context(
    current_user,
    team,
) -> dict:
    """
    Determine the workspace entirely from the authenticated user
    and backend team membership.

    The frontend never gets to choose owner_id/team_id.
    """

    user_id = current_user["id"]

    # --------------------------------------------------------
    # TEAM WORKSPACE
    # --------------------------------------------------------
    if team and team.get("team_id"):
        team_owner_id = team["owner_id"]

        return {
            "owner_id": team_owner_id,
            "team_id": team["team_id"],
            "workspace_type": "team",
            "team_name": team.get("team_name"),
            "can_edit": str(team_owner_id) == str(user_id),
        }

    # --------------------------------------------------------
    # PERSONAL WORKSPACE
    # --------------------------------------------------------
    return {
        "owner_id": user_id,
        "team_id": None,
        "workspace_type": "personal",
        "team_name": None,
        "can_edit": True,
    }


# ============================================================
# RESPONSE BUILDER
# ============================================================

def _response_from_settings(
    settings,
    context,
    *,
    logo_url=None,
) -> dict:
    """
    Convert the database record into the API response.
    """

    settings_team_id = (
        settings.get("team_id")
        if settings
        else None
    )

    team_id = settings_team_id or context["team_id"]

    return {
        "id": (
            str(settings["id"])
            if settings and settings.get("id")
            else None
        ),
        "owner_id": str(
            settings["owner_id"]
            if settings
            else context["owner_id"]
        ),
        "team_id": (
            str(team_id)
            if team_id
            else None
        ),
        "business_name": (
            settings["business_name"]
            if settings
            else ""
        ),
        "business_address": (
            settings["business_address"]
            if settings
            else ""
        ),
        "business_phone": (
            settings["business_phone"]
            if settings
            else ""
        ),
        "business_email": (
            settings["business_email"]
            if settings
            else ""
        ),
        "terms_and_conditions": (
            settings["terms_and_conditions"]
            if settings
            else ""
),
        "logo_url": logo_url,
        "workspace_type": context["workspace_type"],
        "can_edit": context["can_edit"],
        "team_name": context["team_name"],
        "updated_at": (
            settings.get("updated_at")
            if settings
            else None
        ),
    }


# ============================================================
# SIGNED LOGO URL
# ============================================================

def _logo_url_from_settings(
    settings: dict | None,
) -> str | None:
    """
    Convert the stored private storage path into a signed URL.

    We store the path in the database rather than permanently
    storing a signed URL.
    """

    if not settings:
        return None

    logo_path = settings.get("logo_path")

    if not logo_path:
        return None

    try:
        return create_invoice_logo_signed_url(logo_path)

    except Exception as exc:
        # Do not expose the underlying storage exception to the client.
        logger.exception(
            "Could not create signed URL for business logo."
        )

        raise HTTPException(
            status_code=502,
            detail="Could not load business logo.",
        ) from exc


# ============================================================
# GET BUSINESS SETTINGS
# ============================================================

@router.get(
    "",
    response_model=BusinessSettingsResponse,
)
def get_business_settings_endpoint(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    team=Depends(get_current_team),
):
    context = _workspace_context(
        current_user,
        team,
    )

    settings = get_business_settings_for_workspace(
        db,
        owner_id=context["owner_id"],
        team_id=context["team_id"],
    )

    return _response_from_settings(
        settings,
        context,
        logo_url=_logo_url_from_settings(settings),
    )


# ============================================================
# SAVE BUSINESS SETTINGS
# ============================================================

@router.put(
    "",
    response_model=BusinessSettingsResponse,
)
def save_business_settings(
    payload: BusinessSettingsUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    team=Depends(get_current_team),
):
    context = _workspace_context(
        current_user,
        team,
    )

    # Only the actual workspace owner can edit.
    if not context["can_edit"]:
        raise HTTPException(
            status_code=403,
            detail="Only the workspace owner can edit business settings.",
        )

    try:
        settings = upsert_business_settings(
            db,
            owner_id=context["owner_id"],
            team_id=context["team_id"],
            business_name=payload.business_name,
            business_address=payload.business_address,
            business_phone=payload.business_phone,
            business_email=payload.business_email,
            terms_and_conditions=payload.terms_and_conditions,
        )

        db.commit()

    except IntegrityError as exc:
        db.rollback()

        logger.warning(
            "Business settings integrity error.",
            exc_info=True,
        )

        raise HTTPException(
            status_code=409,
            detail="Business settings could not be saved for this workspace.",
        ) from exc

    except Exception as exc:
        db.rollback()

        logger.exception(
            "Unexpected error while saving business settings."
        )

        raise HTTPException(
            status_code=500,
            detail=f"Could not save business settings: {exc}",
        ) from exc

    return _response_from_settings(
        settings,
        context,
        logo_url=_logo_url_from_settings(settings),
    )


# ============================================================
# UPLOAD BUSINESS LOGO
# ============================================================

@router.post("/logo")
def upload_business_logo(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    team=Depends(get_current_team),
):
    context = _workspace_context(
        current_user,
        team,
    )

    # --------------------------------------------------------
    # AUTHORIZATION
    # --------------------------------------------------------

    if not context["can_edit"]:
        raise HTTPException(
            status_code=403,
            detail="Only the workspace owner can change the business logo.",
        )

    # --------------------------------------------------------
    # MIME VALIDATION
    # --------------------------------------------------------

    content_type = file.content_type

    if content_type not in ALLOWED_LOGO_TYPES:
        raise HTTPException(
            status_code=400,
            detail="Unsupported logo type. Use PNG, JPEG, or WEBP.",
        )

    # --------------------------------------------------------
    # SIZE-LIMITED READ
    # --------------------------------------------------------

    try:
        content = file.file.read(
            MAX_LOGO_SIZE + 1
        )
    finally:
        awaitable_close = getattr(file.file, "close", None)

        if callable(awaitable_close):
            try:
                awaitable_close()
            except Exception:
                # Closing the temporary upload file is cleanup only.
                pass

    if not content:
        raise HTTPException(
            status_code=400,
            detail="Logo file is empty.",
        )

    if len(content) > MAX_LOGO_SIZE:
        raise HTTPException(
            status_code=413,
            detail="Logo must be 2 MB or smaller.",
        )

    # --------------------------------------------------------
    # CONTENT / MAGIC-BYTE VALIDATION
    # --------------------------------------------------------

    _validate_logo_bytes(
        content,
        content_type,
    )

    new_logo_path: str | None = None

    try:
        # ----------------------------------------------------
        # LOAD OR CREATE WORKSPACE SETTINGS
        # ----------------------------------------------------

        settings = get_business_settings_for_workspace(
            db,
            owner_id=context["owner_id"],
            team_id=context["team_id"],
        )

        if settings:
            settings_id_value = settings["id"]

        else:
            settings = upsert_business_settings(
                db,
                owner_id=context["owner_id"],
                team_id=context["team_id"],
                business_name="",
                business_address="",
                business_phone="",
                business_email="",
                terms_and_conditions=payload.terms_and_conditions,
            )

            settings_id_value = settings["id"]

        # Handle both UUID and string database values safely.
        settings_id = (
            settings_id_value
            if isinstance(settings_id_value, UUID)
            else UUID(str(settings_id_value))
        )

        # ----------------------------------------------------
        # UPLOAD NEW OBJECT
        # ----------------------------------------------------

        new_logo_path, logo_url = upload_invoice_logo_with_path(
            content,
            file.filename or "logo",
            content_type,
            owner_id=str(context["owner_id"]),
            team_id=(
                str(context["team_id"])
                if context["team_id"]
                else None
            ),
        )

        # ----------------------------------------------------
        # SAVE STORAGE PATH IN DATABASE
        # ----------------------------------------------------

        updated = update_logo_path(
            db,
            settings_id=settings_id,
            owner_id=context["owner_id"],
            team_id=context["team_id"],
            logo_path=new_logo_path,
        )

        if not updated:
            raise RuntimeError(
                "Business settings could not be updated."
            )

        db.commit()

    except HTTPException:
        db.rollback()

        # If upload succeeded but database update failed,
        # remove only the newly created object.
        if new_logo_path:
            try:
                from app.invoice_logo_storage import delete_invoice_logo

                delete_invoice_logo(new_logo_path)
            except Exception:
                logger.exception(
                    "Failed to clean up newly uploaded logo."
                )

        raise

    except Exception as exc:
        db.rollback()

        # ----------------------------------------------------
        # CLEANUP FAILED DATABASE TRANSACTION
        # ----------------------------------------------------

        if new_logo_path:
            try:
                from app.invoice_logo_storage import delete_invoice_logo

                delete_invoice_logo(new_logo_path)
            except Exception:
                logger.exception(
                    "Failed to clean up newly uploaded logo "
                    "after an error."
                )

        # ----------------------------------------------------
        # IMPORTANT:
        # Log the actual cause server-side, but do not return
        # storage credentials/details to the browser.
        # ----------------------------------------------------

        logger.exception(
            "Business logo upload failed."
        )

        raise HTTPException(
            status_code=502,
            detail="Could not store business logo.",
        ) from exc

    # --------------------------------------------------------
    # IMPORTANT:
    # Do NOT delete the previous logo automatically.
    #
    # Historical invoices may still reference the old signed
    # URL. Reference-aware cleanup can be added later.
    # --------------------------------------------------------

    return {
        "logo_url": logo_url,
    }


# ============================================================
# DELETE BUSINESS LOGO
# ============================================================

@router.delete("/logo")
def delete_business_logo(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    team=Depends(get_current_team),
):
    context = _workspace_context(
        current_user,
        team,
    )

    # --------------------------------------------------------
    # AUTHORIZATION
    # --------------------------------------------------------

    if not context["can_edit"]:
        raise HTTPException(
            status_code=403,
            detail="Only the workspace owner can delete the business logo.",
        )

    # --------------------------------------------------------
    # LOAD SETTINGS
    # --------------------------------------------------------

    settings = get_business_settings_for_workspace(
        db,
        owner_id=context["owner_id"],
        team_id=context["team_id"],
    )

    if not settings:
        return {
            "success": True,
        }

    old_logo_path = settings.get("logo_path")

    if not old_logo_path:
        return {
            "success": True,
        }

    try:
        settings_id_value = settings["id"]

        settings_id = (
            settings_id_value
            if isinstance(settings_id_value, UUID)
            else UUID(str(settings_id_value))
        )

        updated = update_logo_path(
            db,
            settings_id=settings_id,
            owner_id=context["owner_id"],
            team_id=context["team_id"],
            logo_path=None,
        )

        if not updated:
            raise RuntimeError(
                "Business logo could not be removed."
            )

        db.commit()

    except Exception as exc:
        db.rollback()

        logger.exception(
            "Could not remove business logo."
        )

        raise HTTPException(
            status_code=500,
            detail="Could not remove business logo.",
        ) from exc

    # --------------------------------------------------------
    # IMPORTANT:
    # Keep the physical storage object.
    #
    # Existing invoices can still reference the previous logo.
    # --------------------------------------------------------

    return {
        "success": True,
    }