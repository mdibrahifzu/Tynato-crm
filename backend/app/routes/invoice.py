import os
from urllib.parse import urlparse
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.dependencies import get_db, get_current_team, get_current_user
from app.invoice_logo_storage import create_invoice_logo_signed_url, upload_invoice_logo
from app.repositories.business_settings_repository import (
    get_business_settings_for_workspace,
)
from app.repositories.invoice_repository import (
    create_invoice,
    get_invoice,
    get_lead_for_invoice,
    get_custom_lead_for_invoice,
    list_invoices,
    update_invoice_status,
)
from app.schemas.invoice import InvoiceRequest
from app.services.invoice_service import InvoiceGenerationError, generate_invoice_pdf

router = APIRouter(prefix="/invoices", tags=["invoices"])

ALLOWED_LOGO_TYPES = {"image/png", "image/jpeg", "image/webp"}
MAX_LOGO_SIZE = 2 * 1024 * 1024


def _validate_logo_bytes(content: bytes, content_type: str) -> None:
    if content_type == "image/png" and content.startswith(b"\x89PNG\r\n\x1a\n"):
        return
    if content_type == "image/jpeg" and content.startswith(b"\xff\xd8\xff"):
        return
    if content_type == "image/webp" and len(content) >= 12 and content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return
    raise HTTPException(status_code=400, detail="Logo file content does not match the declared image type.")


def _build_from_address(invoice: InvoiceRequest) -> str:
    if invoice.from_address:
        return invoice.from_address
    return "\n".join(
        value for value in (
            invoice.business_name,
            invoice.business_address,
            invoice.business_phone,
            invoice.business_email,
        ) if value
    )


def _build_to_address(invoice: InvoiceRequest) -> str:
    if invoice.to_address:
        return invoice.to_address
    return "\n".join(
        value for value in (
            invoice.customer_name,
            invoice.company_name,
            invoice.billing_address,
            invoice.customer_phone,
            invoice.customer_email,
        ) if value
    )


def _validate_logo_url(logo_url: str) -> None:
    parsed = urlparse(logo_url)
    expected = urlparse(os.getenv("SUPABASE_URL", ""))

    if parsed.scheme != "https":
        raise HTTPException(status_code=400, detail="Invoice logo must use HTTPS.")
    if not expected.hostname or parsed.hostname != expected.hostname:
        raise HTTPException(
            status_code=400,
            detail="Invoice logo must come from configured storage.",
        )
    if not parsed.path.startswith("/storage/v1/object/sign/invoice-logos/"):
        raise HTTPException(status_code=400, detail="Invalid invoice logo storage path.")


@router.post("/logo")
def upload_logo(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
    team=Depends(get_current_team),
):
    if file.content_type not in ALLOWED_LOGO_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported logo type.")

    content = file.file.read(MAX_LOGO_SIZE + 1)
    if not content:
        raise HTTPException(status_code=400, detail="Logo file is empty.")
    if len(content) > MAX_LOGO_SIZE:
        raise HTTPException(status_code=413, detail="Logo must be 2 MB or smaller.")

    _validate_logo_bytes(content, file.content_type)

    team_id = team.get("team_id") if team else None

    try:
        url = upload_invoice_logo(
            content,
            file.filename or "logo",
            file.content_type,
            owner_id=str(current_user["id"]),
            team_id=str(team_id) if team_id else None,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Could not store invoice logo.") from exc

    return {"logo_url": url}


def _load_business_invoice_snapshot(settings: dict | None) -> tuple[str, str | None]:
    if not settings:
        raise HTTPException(
            status_code=400,
            detail="Configure your business details in Settings before generating an invoice.",
        )

    from_address = "\n".join(
        value
        for value in (
            settings.get("business_name"),
            settings.get("business_address"),
            settings.get("business_phone"),
            settings.get("business_email"),
        )
        if value
    )

    if not from_address:
        raise HTTPException(
            status_code=400,
            detail="Configure your business details in Settings before generating an invoice.",
        )

    logo_url = None
    if settings.get("logo_path"):
        try:
            logo_url = create_invoice_logo_signed_url(settings["logo_path"])
        except Exception as exc:
            raise HTTPException(
                status_code=502,
                detail="Could not load business logo.",
            ) from exc

    return from_address, logo_url


@router.post("")
def create_invoice_endpoint(
    invoice: InvoiceRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    team=Depends(get_current_team),
):
    current_user_id = current_user["id"]
    current_user_role = current_user["role"]
    team_id = team.get("team_id") if team else None

    lead = None
    custom_lead = None

    # ---------------------------------------------------------
    # Validate lead source
    # ---------------------------------------------------------

    if invoice.lead_id and invoice.custom_lead_id:
        raise HTTPException(
            status_code=400,
            detail="An invoice cannot reference both a lead and a custom lead.",
        )

    # ---------------------------------------------------------
    # NORMAL CRM LEAD
    # ---------------------------------------------------------

    if invoice.lead_id:
        lead = get_lead_for_invoice(
            db=db,
            lead_id=invoice.lead_id,
            current_user_id=current_user_id,
            current_user_role=current_user_role,
        )

        if not lead:
            raise HTTPException(
                status_code=404,
                detail="Lead not found or access denied.",
            )

        lead_team_id = lead.get("team_id")

        if lead_team_id is not None:
            if (
                team_id is None
                or str(team_id) != str(lead_team_id)
            ):
                if current_user_role != "admin":
                    raise HTTPException(
                        status_code=403,
                        detail="You do not have access to this lead's team.",
                    )

                team_id = lead_team_id

        elif (
            team_id is not None
            and current_user_role != "admin"
        ):
            raise HTTPException(
                status_code=403,
                detail="A personal lead cannot be used for a team invoice.",
            )

    # ---------------------------------------------------------
    # CUSTOM LEAD
    # ---------------------------------------------------------

    elif invoice.custom_lead_id:
        custom_lead = get_custom_lead_for_invoice(
            db=db,
            custom_lead_id=invoice.custom_lead_id,
            current_user_id=current_user_id,
            current_user_role=current_user_role,
            team_id=team_id,
        )

        if not custom_lead:
            raise HTTPException(
                status_code=404,
                detail="Custom lead not found or access denied.",
            )

        custom_lead_team_id = custom_lead.get("team_id")

        if custom_lead_team_id is not None:
            if (
                team_id is None
                or str(team_id) != str(custom_lead_team_id)
            ):
                if current_user_role != "admin":
                    raise HTTPException(
                        status_code=403,
                        detail="You do not have access to this custom lead's team.",
                    )

                team_id = custom_lead_team_id

        elif (
            team_id is not None
            and current_user_role != "admin"
        ):
            raise HTTPException(
                status_code=403,
                detail="A personal custom lead cannot be used for a team invoice.",
            )

    # ---------------------------------------------------------
    # CUSTOMER DETAILS
    # ---------------------------------------------------------

    if lead:
        customer_name = (
            invoice.customer_name
            or lead.get("business_name")
        )

        company_name = invoice.company_name

        customer_phone = (
            invoice.customer_phone
            or lead.get("phone")
        )

        customer_email = invoice.customer_email

        billing_address = (
            invoice.billing_address
            or lead.get("address")
        )

    elif custom_lead:
        customer_name = (
            invoice.customer_name
            or custom_lead.get("full_name")
        )

        company_name = invoice.company_name

        customer_phone = (
            invoice.customer_phone
            or custom_lead.get("phone_number")
        )

        customer_email = (
            invoice.customer_email
            or custom_lead.get("email")
        )

        billing_address = (
            invoice.billing_address
            or custom_lead.get("project_location")
        )

    else:
        customer_name = invoice.customer_name
        company_name = invoice.company_name
        customer_phone = invoice.customer_phone
        customer_email = invoice.customer_email
        billing_address = invoice.billing_address

        if not customer_name and not company_name:
            raise HTTPException(
                status_code=400,
                detail="Enter a customer name or company name.",
            )

    # ---------------------------------------------------------
    # LOAD BUSINESS SETTINGS
    # ---------------------------------------------------------

    if team_id is None:
        settings_owner_id = current_user_id

    else:
        team_owner = db.execute(
            text("""
                SELECT owner_id
                FROM public.teams
                WHERE id = :team_id
                LIMIT 1
            """),
            {
                "team_id": team_id,
            },
        ).scalar_one_or_none()

        if not team_owner:
            raise HTTPException(
                status_code=404,
                detail="Invoice workspace not found.",
            )

        settings_owner_id = team_owner

    business_settings = get_business_settings_for_workspace(
        db,
        owner_id=settings_owner_id,
        team_id=team_id,
    )

    from_address, saved_logo_url = (
        _load_business_invoice_snapshot(
            business_settings
        )
    )

    # ---------------------------------------------------------
    # CUSTOMER ADDRESS FOR PDF
    # ---------------------------------------------------------

    to_address = invoice.to_address or "\n".join(
        value
        for value in (
            customer_name,
            company_name,
            billing_address,
            customer_phone,
            customer_email,
        )
        if value
    )

    if not to_address:
        raise HTTPException(
            status_code=400,
            detail="Enter customer details.",
        )

    # ---------------------------------------------------------
    # FINAL INVOICE PAYLOAD
    # ---------------------------------------------------------

    request_payload = invoice.model_copy(
        update={
            "business_name": business_settings["business_name"],
            "business_address": business_settings["business_address"],
            "business_phone": business_settings["business_phone"],
            "business_email": business_settings["business_email"],
            "logo_url": saved_logo_url,
            "from_address": from_address,
            "to_address": to_address,
            "customer_name": customer_name,
            "company_name": company_name,
            "customer_phone": customer_phone,
            "customer_email": customer_email,
            "billing_address": billing_address,
            "terms": (
                business_settings.get(
                    "terms_and_conditions"
                )
                or ""
            ),
        }
    )

    # ---------------------------------------------------------
    # CREATE + GENERATE PDF
    # ---------------------------------------------------------

    try:
        invoice_data = create_invoice(
            db=db,
            lead_id=invoice.lead_id,
            custom_lead_id=invoice.custom_lead_id,
            owner_id=current_user_id,
            team_id=team_id,
            invoice_number=invoice.number,
            invoice_date=invoice.invoice_date,
            due_date=invoice.due_date,
            currency=invoice.currency,
            from_address=from_address,
            to_address=to_address,
            notes=invoice.notes,
            terms=(
                business_settings.get(
                    "terms_and_conditions"
                )
                or ""
            ),
            payment_terms=invoice.payment_terms,
            purchase_order=invoice.purchase_order,
            logo_url=saved_logo_url,
            customer_name=customer_name,
            company_name=company_name,
            customer_phone=customer_phone,
            customer_email=customer_email,
            billing_address=billing_address,
            tax_title=invoice.tax_title,
            tax_percent=invoice.tax_percent,
            items=[
                {
                    "name": item.name,
                    "quantity": item.quantity,
                    "unit_cost": item.unit_cost,
                }
                for item in invoice.items
            ],
        )

        pdf = generate_invoice_pdf(request_payload)

        invoice_id = invoice_data["id"]

        updated = update_invoice_status(
            db=db,
            invoice_id=invoice_id,
            current_user_id=current_user_id,
            current_user_role=current_user_role,
            team_id=team_id,
            status="GENERATED",
        )

        if not updated:
            raise RuntimeError(
                "Invoice status could not be updated."
            )

        db.commit()

        filename = (
            f"invoice-{invoice.number}"
            .replace("/", "-")
            .replace("\\", "-")
            .replace(" ", "-")
            + ".pdf"
        )

        return Response(
            content=pdf,
            media_type="application/pdf",
            headers={
                "Content-Disposition": (
                    f'attachment; filename="{filename}"'
                ),
                "X-Invoice-Id": str(invoice_id),
            },
        )

    except InvoiceGenerationError as exc:
        db.rollback()

        raise HTTPException(
            status_code=502,
            detail=str(exc),
        ) from exc

    except IntegrityError as exc:
        db.rollback()

        if "invoices_" in str(exc.orig):
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Invoice number "
                    f"'{invoice.number}' already exists."
                ),
            ) from exc

        raise HTTPException(
            status_code=500,
            detail="Could not save the invoice.",
        ) from exc

    except Exception:
        db.rollback()
        raise

@router.get("")
def get_invoices(
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    team=Depends(get_current_team),
):
    return list_invoices(
        db=db,
        current_user_id=current_user["id"],
        current_user_role=current_user["role"],
        team_id=team.get("team_id") if team else None,
        limit=max(1, min(limit, 100)),
        offset=max(0, offset),
    )


@router.get("/{invoice_id}")
def get_invoice_endpoint(
    invoice_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    invoice = get_invoice(
        db=db,
        invoice_id=invoice_id,
        current_user_id=current_user["id"],
        current_user_role=current_user["role"],
    )
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found or access denied.")
    return invoice


@router.patch("/{invoice_id}/status")
def update_invoice_status_endpoint(
    invoice_id: UUID,
    status: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    team=Depends(get_current_team),
):
    allowed_statuses = {"DRAFT", "GENERATED", "SENT", "PAID", "CANCELLED"}
    normalized_status = status.strip().upper()
    if normalized_status not in allowed_statuses:
        raise HTTPException(status_code=400, detail="Invalid invoice status.")

    updated = update_invoice_status(
        db=db,
        invoice_id=invoice_id,
        current_user_id=current_user["id"],
        current_user_role=current_user["role"],
        team_id=team.get("team_id") if team else None,
        status=normalized_status,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Invoice not found or access denied.")
    db.commit()
    return updated
