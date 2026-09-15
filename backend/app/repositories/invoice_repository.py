from __future__ import annotations

from typing import Any, Optional
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.orm import Session


def _serialize_invoice(row: Any) -> dict:
    if not row:
        return {}

    data = dict(row)

    for key in (
        "id",
        "lead_id",
        "custom_lead_id",
        "owner_id",
        "team_id",
    ):
        if data.get(key) is not None:
            data[key] = str(data[key])

    for key in (
        "invoice_date",
        "due_date",
        "created_at",
        "updated_at",
    ):
        if data.get(key) is not None:
            data[key] = str(data[key])

    for key in (
        "total",
        "tax_percent",
    ):
        if data.get(key) is not None:
            data[key] = float(data[key])

    return data


def _serialize_item(row: Any) -> dict:
    if not row:
        return {}

    data = dict(row)

    for key in (
        "id",
        "invoice_id",
    ):
        if data.get(key) is not None:
            data[key] = str(data[key])

    for key in (
        "quantity",
        "unit_cost",
        "amount",
    ):
        if data.get(key) is not None:
            data[key] = float(data[key])

    if data.get("created_at") is not None:
        data["created_at"] = str(data["created_at"])

    return data


def get_lead_for_invoice(
    db: Session,
    lead_id: UUID,
    current_user_id: UUID,
    current_user_role: str,
) -> Optional[dict]:
    if current_user_role == "admin":
        result = db.execute(
            text("""
                SELECT
                    id,
                    owner_id,
                    team_id,
                    business_name,
                    phone,
                    website,
                    address
                FROM public.leads
                WHERE id = :lead_id
                LIMIT 1
            """),
            {
                "lead_id": lead_id,
            },
        )

    else:
        result = db.execute(
            text("""
                SELECT
                    id,
                    owner_id,
                    team_id,
                    business_name,
                    phone,
                    website,
                    address
                FROM public.leads
                WHERE id = :lead_id
                  AND (
                      owner_id = :owner_id
                      OR EXISTS (
                          SELECT 1
                          FROM public.team_members tm
                          WHERE tm.team_id = leads.team_id
                            AND tm.member_id = :owner_id
                            AND tm.status = 'active'
                      )
                  )
                LIMIT 1
            """),
            {
                "lead_id": lead_id,
                "owner_id": current_user_id,
            },
        )

    row = result.mappings().first()

    return dict(row) if row else None


def get_custom_lead_for_invoice(
    db: Session,
    custom_lead_id: UUID,
    current_user_id: UUID,
    current_user_role: str,
    team_id: Optional[UUID],
) -> Optional[dict]:
    if current_user_role == "admin":
        result = db.execute(
            text("""
                SELECT
                    id,
                    owner_id,
                    team_id,
                    full_name,
                    phone_number,
                    email,
                    project_location
                FROM public.custom_leads
                WHERE id = :custom_lead_id
                LIMIT 1
            """),
            {
                "custom_lead_id": custom_lead_id,
            },
        )

    elif team_id is not None:
        result = db.execute(
            text("""
                SELECT
                    id,
                    owner_id,
                    team_id,
                    full_name,
                    phone_number,
                    email,
                    project_location
                FROM public.custom_leads
                WHERE id = :custom_lead_id
                  AND team_id = :team_id
                LIMIT 1
            """),
            {
                "custom_lead_id": custom_lead_id,
                "team_id": team_id,
            },
        )

    else:
        result = db.execute(
            text("""
                SELECT
                    id,
                    owner_id,
                    team_id,
                    full_name,
                    phone_number,
                    email,
                    project_location
                FROM public.custom_leads
                WHERE id = :custom_lead_id
                  AND owner_id = :owner_id
                  AND team_id IS NULL
                LIMIT 1
            """),
            {
                "custom_lead_id": custom_lead_id,
                "owner_id": current_user_id,
            },
        )

    row = result.mappings().first()

    return dict(row) if row else None


def create_invoice(
    db: Session,
    *,
    lead_id: Optional[UUID],
    custom_lead_id: Optional[UUID],
    owner_id: UUID,
    team_id: Optional[UUID],
    invoice_number: str,
    invoice_date,
    due_date,
    currency: str,
    from_address: str,
    to_address: str,
    notes: Optional[str],
    terms: Optional[str],
    payment_terms: Optional[str],
    purchase_order: Optional[str],
    logo_url: Optional[str],
    customer_name: Optional[str],
    company_name: Optional[str],
    customer_phone: Optional[str],
    customer_email: Optional[str],
    billing_address: Optional[str],
    tax_title: Optional[str],
    tax_percent,
    items: list[dict],
) -> dict:
    result = db.execute(
        text("""
            INSERT INTO public.invoices (
                lead_id,
                custom_lead_id,
                owner_id,
                team_id,
                invoice_number,
                invoice_date,
                due_date,
                currency,
                status,
                from_address,
                to_address,
                notes,
                terms,
                payment_terms,
                purchase_order,
                logo_url,
                customer_name,
                company_name,
                customer_phone,
                customer_email,
                billing_address,
                tax_title,
                tax_percent,
                total
            )
            VALUES (
                :lead_id,
                :custom_lead_id,
                :owner_id,
                :team_id,
                :invoice_number,
                :invoice_date,
                :due_date,
                :currency,
                'DRAFT',
                :from_address,
                :to_address,
                :notes,
                :terms,
                :payment_terms,
                :purchase_order,
                :logo_url,
                :customer_name,
                :company_name,
                :customer_phone,
                :customer_email,
                :billing_address,
                :tax_title,
                :tax_percent,
                0
            )
            RETURNING *
        """),
        {
            "lead_id": lead_id,
            "custom_lead_id": custom_lead_id,
            "owner_id": owner_id,
            "team_id": team_id,
            "invoice_number": invoice_number,
            "invoice_date": invoice_date,
            "due_date": due_date,
            "currency": currency,
            "from_address": from_address,
            "to_address": to_address,
            "notes": notes,
            "terms": terms,
            "payment_terms": payment_terms,
            "purchase_order": purchase_order,
            "logo_url": logo_url,
            "customer_name": customer_name,
            "company_name": company_name,
            "customer_phone": customer_phone,
            "customer_email": customer_email,
            "billing_address": billing_address,
            "tax_title": tax_title,
            "tax_percent": tax_percent,
        },
    )

    invoice = result.mappings().first()

    if not invoice:
        raise RuntimeError("Invoice could not be created.")

    invoice_id = invoice["id"]

    for item in items:
        db.execute(
            text("""
                INSERT INTO public.invoice_items (
                    invoice_id,
                    description,
                    quantity,
                    unit_cost
                )
                VALUES (
                    :invoice_id,
                    :description,
                    :quantity,
                    :unit_cost
                )
            """),
            {
                "invoice_id": invoice_id,
                "description": item["name"],
                "quantity": item["quantity"],
                "unit_cost": item["unit_cost"],
            },
        )

    updated = db.execute(
        text("""
            SELECT *
            FROM public.invoices
            WHERE id = :invoice_id
        """),
        {
            "invoice_id": invoice_id,
        },
    ).mappings().first()

    invoice_data = _serialize_invoice(updated)

    item_rows = db.execute(
        text("""
            SELECT
                id,
                invoice_id,
                description,
                quantity,
                unit_cost,
                amount,
                created_at
            FROM public.invoice_items
            WHERE invoice_id = :invoice_id
            ORDER BY created_at, id
        """),
        {
            "invoice_id": invoice_id,
        },
    ).mappings().all()

    invoice_data["items"] = [
        _serialize_item(row)
        for row in item_rows
    ]

    return invoice_data


def get_invoice(
    db: Session,
    *,
    invoice_id: UUID,
    current_user_id: UUID,
    current_user_role: str,
) -> Optional[dict]:
    if current_user_role == "admin":
        where_sql = "i.id = :invoice_id"
        params = {
            "invoice_id": invoice_id,
        }

    else:
        where_sql = """
            i.id = :invoice_id
            AND (
                i.owner_id = :owner_id
                OR EXISTS (
                    SELECT 1
                    FROM public.team_members tm
                    WHERE tm.team_id = i.team_id
                      AND tm.member_id = :owner_id
                      AND tm.status = 'active'
                )
            )
        """

        params = {
            "invoice_id": invoice_id,
            "owner_id": current_user_id,
        }

    result = db.execute(
        text(f"""
            SELECT i.*
            FROM public.invoices i
            WHERE {where_sql}
            LIMIT 1
        """),
        params,
    )

    invoice = result.mappings().first()

    if not invoice:
        return None

    invoice_data = _serialize_invoice(invoice)

    item_rows = db.execute(
        text("""
            SELECT
                id,
                invoice_id,
                description,
                quantity,
                unit_cost,
                amount,
                created_at
            FROM public.invoice_items
            WHERE invoice_id = :invoice_id
            ORDER BY created_at, id
        """),
        {
            "invoice_id": invoice_id,
        },
    ).mappings().all()

    invoice_data["items"] = [
        _serialize_item(row)
        for row in item_rows
    ]

    return invoice_data


def update_invoice_status(
    db: Session,
    *,
    invoice_id: UUID,
    current_user_id: UUID,
    current_user_role: str,
    team_id: Optional[UUID],
    status: str,
) -> Optional[dict]:
    if current_user_role == "admin":
        scope_sql = "id = :invoice_id"
        params = {
            "invoice_id": invoice_id,
        }

    else:
        scope_sql = """
            id = :invoice_id
            AND (
                owner_id = :owner_id
                OR (
                    team_id = :team_id
                    AND :team_id IS NOT NULL
                    AND EXISTS (
                        SELECT 1
                        FROM public.team_members tm
                        WHERE tm.team_id = invoices.team_id
                          AND tm.member_id = :owner_id
                          AND tm.status = 'active'
                    )
                )
            )
        """

        params = {
            "invoice_id": invoice_id,
            "owner_id": current_user_id,
            "team_id": team_id,
        }

    result = db.execute(
        text(f"""
            UPDATE public.invoices
            SET
                status = :status,
                updated_at = now()
            WHERE {scope_sql}
            RETURNING *
        """),
        {
            **params,
            "status": status,
        },
    )

    row = result.mappings().first()

    return _serialize_invoice(row) if row else None


def list_invoices(
    db: Session,
    *,
    current_user_id: UUID,
    current_user_role: str,
    team_id: Optional[UUID],
    limit: int = 50,
    offset: int = 0,
) -> list[dict]:
    if current_user_role == "admin":
        where_sql = "TRUE"
        params = {}

    else:
        where_sql = """
            (
                i.owner_id = :owner_id
                OR (
                    i.team_id = :team_id
                    AND :team_id IS NOT NULL
                    AND EXISTS (
                        SELECT 1
                        FROM public.team_members tm
                        WHERE tm.team_id = i.team_id
                          AND tm.member_id = :owner_id
                          AND tm.status = 'active'
                    )
                )
            )
        """

        params = {
            "owner_id": current_user_id,
            "team_id": team_id,
        }

    result = db.execute(
        text(f"""
            SELECT i.*
            FROM public.invoices i
            WHERE {where_sql}
            ORDER BY i.created_at DESC
            LIMIT :limit
            OFFSET :offset
        """),
        {
            **params,
            "limit": limit,
            "offset": offset,
        },
    )

    return [
        _serialize_invoice(row)
        for row in result.mappings().all()
    ]