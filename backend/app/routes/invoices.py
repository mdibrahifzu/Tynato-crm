from uuid import UUID

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
)
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.dependencies import (
    get_db,
    get_current_user,
    get_current_team,
)
from app.repositories.invoice_repository import (
    create_invoice,
    get_invoice,
    get_lead_for_invoice,
    list_invoices,
    update_invoice_status,
)
from app.schemas.invoice import InvoiceRequest
from app.services.invoice_service import (
    InvoiceGenerationError,
    generate_invoice_pdf,
)


router = APIRouter(
    prefix="/invoices",
    tags=["invoices"],
)


@router.post("")
def create_invoice_endpoint(
    invoice: InvoiceRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    team=Depends(get_current_team),
):
    current_user_id = current_user["id"]

    lead = get_lead_for_invoice(
    db=db,
    lead_id=invoice.lead_id,
    current_user_id=current_user_id,
    current_user_role=current_user["role"],
)

    if not lead:
        raise HTTPException(
            status_code=404,
            detail="Lead not found or access denied.",
        )

    team_id = None

    if team and team.get("team_id"):
        team_id = team["team_id"]

    if lead.get("team_id") is not None:
        lead_team_id = lead["team_id"]

        if str(team_id) != str(lead_team_id):
            raise HTTPException(
                status_code=403,
                detail=(
                    "You do not have access to "
                    "this lead's team."
                ),
            )

    elif team_id is not None:
        raise HTTPException(
            status_code=403,
            detail=(
                "A personal lead cannot be used "
                "for a team invoice."
            ),
        )

    try:
        invoice_data = create_invoice(
            db=db,
            lead_id=invoice.lead_id,
            owner_id=current_user_id,
            team_id=team_id,
            invoice_number=invoice.number,
            invoice_date=invoice.invoice_date,
            due_date=invoice.due_date,
            currency=invoice.currency,
            from_address=invoice.from_address,
            to_address=invoice.to_address,
            notes=invoice.notes,
            items=[
                {
                    "name": item.name,
                    "quantity": item.quantity,
                    "unit_cost": item.unit_cost,
                }
                for item in invoice.items
            ],
        )

        pdf = generate_invoice_pdf(invoice)

        invoice_id = invoice_data["id"]

        update_invoice_status(
            db=db,
            invoice_id=invoice_id,
            owner_id=current_user_id,
            status="GENERATED",
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
                    f"Invoice number '{invoice.number}' "
                    "already exists."
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
):
    limit = max(1, min(limit, 100))
    offset = max(0, offset)

    return list_invoices(
        db=db,
        current_user_id=current_user["id"],
        limit=limit,
        offset=offset,
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
    )

    if not invoice:
        raise HTTPException(
            status_code=404,
            detail="Invoice not found or access denied.",
        )

    return invoice


@router.patch("/{invoice_id}/status")
def update_invoice_status_endpoint(
    invoice_id: UUID,
    status: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    allowed_statuses = {
        "DRAFT",
        "GENERATED",
        "SENT",
        "PAID",
        "CANCELLED",
    }

    normalized_status = status.strip().upper()

    if normalized_status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail="Invalid invoice status.",
        )

    updated = update_invoice_status(
        db=db,
        invoice_id=invoice_id,
        owner_id=current_user["id"],
        status=normalized_status,
    )

    if not updated:
        raise HTTPException(
            status_code=404,
            detail="Invoice not found or access denied.",
        )

    db.commit()

    return updated