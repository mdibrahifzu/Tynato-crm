from __future__ import annotations

from typing import Any
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

    if data.get("total") is not None:
        data["total"] = float(data["total"])

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
        data["created_at"] = str(
            data["created_at"]
        )

    return data


def get_lead_for_invoice(
    db: Session,
    lead_id: UUID,
    current_user_id: UUID,
    current_user_role: str,
) -> dict | None:
    if current_user_role == "admin":
        result = db.execute(
            text(
                """
                SELECT
                    id,
                    owner_id,
                    team_id,
                    business_name,
                    phone,
                    website,
                    address
                FROM leads
                WHERE id = :lead_id
                LIMIT 1
                """
            ),
            {
                "lead_id": lead_id,
            },
        )
    else:
        result = db.execute(
            text(
                """
                SELECT
                    id,
                    owner_id,
                    team_id,
                    business_name,
                    phone,
                    website,
                    address
                FROM leads
                WHERE id = :lead_id
                  AND (
                      owner_id = :owner_id
                      OR EXISTS (
                          SELECT 1
                          FROM team_members tm
                          WHERE tm.team_id = leads.team_id
                            AND tm.member_id = :owner_id
                            AND tm.status = 'active'
                      )
                  )
                LIMIT 1
                """
            ),
            {
                "lead_id": lead_id,
                "owner_id": current_user_id,
            },
        )

    row = result.mappings().first()

    return dict(row) if row else None

def create_invoice(
    db: Session,
    *,
    lead_id: UUID,
    owner_id: UUID,
    team_id: UUID | None,
    invoice_number: str,
    invoice_date,
    due_date,
    currency: str,
    from_address: str,
    to_address: str,
    notes: str | None,
    items: list[dict],
) -> dict:
    result = db.execute(
        text(
            """
            INSERT INTO invoices (
                lead_id,
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
                total
            )
            VALUES (
                :lead_id,
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
                0
            )
            RETURNING
                id,
                lead_id,
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
                total,
                created_at,
                updated_at
            """
        ),
        {
            "lead_id": lead_id,
            "owner_id": owner_id,
            "team_id": team_id,
            "invoice_number": invoice_number,
            "invoice_date": invoice_date,
            "due_date": due_date,
            "currency": currency,
            "from_address": from_address,
            "to_address": to_address,
            "notes": notes,
        },
    )

    invoice = result.mappings().first()

    if not invoice:
        raise RuntimeError(
            "Invoice could not be created."
        )

    invoice_id = invoice["id"]

    for item in items:
        db.execute(
            text(
                """
                INSERT INTO invoice_items (
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
                """
            ),
            {
                "invoice_id": invoice_id,
                "description": item["name"],
                "quantity": item["quantity"],
                "unit_cost": item["unit_cost"],
            },
        )

    updated = db.execute(
        text(
            """
            SELECT
                id,
                lead_id,
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
                total,
                created_at,
                updated_at
            FROM invoices
            WHERE id = :invoice_id
            """
        ),
        {
            "invoice_id": invoice_id,
        },
    ).mappings().first()

    invoice_data = _serialize_invoice(updated)

    item_rows = db.execute(
        text(
            """
            SELECT
                id,
                invoice_id,
                description,
                quantity,
                unit_cost,
                amount,
                created_at
            FROM invoice_items
            WHERE invoice_id = :invoice_id
            ORDER BY created_at, id
            """
        ),
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
) -> dict | None:
    result = db.execute(
        text(
            """
            SELECT
                i.id,
                i.lead_id,
                i.owner_id,
                i.team_id,
                i.invoice_number,
                i.invoice_date,
                i.due_date,
                i.currency,
                i.status,
                i.from_address,
                i.to_address,
                i.notes,
                i.total,
                i.created_at,
                i.updated_at
            FROM invoices i
            WHERE i.id = :invoice_id
              AND (
                  i.owner_id = :owner_id
                  OR EXISTS (
                      SELECT 1
                      FROM team_members tm
                      WHERE tm.team_id = i.team_id
                        AND tm.member_id = :owner_id
                        AND tm.status = 'active'
                  )
              )
            LIMIT 1
            """
        ),
        {
            "invoice_id": invoice_id,
            "owner_id": current_user_id,
        },
    )

    invoice = result.mappings().first()

    if not invoice:
        return None

    invoice_data = _serialize_invoice(invoice)

    item_rows = db.execute(
        text(
            """
            SELECT
                id,
                invoice_id,
                description,
                quantity,
                unit_cost,
                amount,
                created_at
            FROM invoice_items
            WHERE invoice_id = :invoice_id
            ORDER BY created_at, id
            """
        ),
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
    owner_id: UUID,
    status: str,
) -> dict | None:
    result = db.execute(
        text(
            """
            UPDATE invoices
            SET
                status = :status,
                updated_at = now()
            WHERE id = :invoice_id
              AND owner_id = :owner_id
            RETURNING
                id,
                lead_id,
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
                total,
                created_at,
                updated_at
            """
        ),
        {
            "invoice_id": invoice_id,
            "owner_id": owner_id,
            "status": status,
        },
    )

    row = result.mappings().first()

    return (
        _serialize_invoice(row)
        if row
        else None
    )


def list_invoices(
    db: Session,
    *,
    current_user_id: UUID,
    limit: int = 50,
    offset: int = 0,
) -> list[dict]:
    result = db.execute(
        text(
            """
            SELECT
                i.id,
                i.lead_id,
                i.owner_id,
                i.team_id,
                i.invoice_number,
                i.invoice_date,
                i.due_date,
                i.currency,
                i.status,
                i.from_address,
                i.to_address,
                i.notes,
                i.total,
                i.created_at,
                i.updated_at
            FROM invoices i
            WHERE (
                i.owner_id = :owner_id
                OR EXISTS (
                    SELECT 1
                    FROM team_members tm
                    WHERE tm.team_id = i.team_id
                      AND tm.member_id = :owner_id
                      AND tm.status = 'active'
                )
            )
            ORDER BY i.created_at DESC
            LIMIT :limit
            OFFSET :offset
            """
        ),
        {
            "owner_id": current_user_id,
            "limit": limit,
            "offset": offset,
        },
    )

    return [
        _serialize_invoice(row)
        for row in result.mappings().all()
    ]