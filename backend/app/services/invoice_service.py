import os
from typing import Any, Dict

import requests

from app.schemas.invoice import InvoiceRequest


INVOICE_GENERATOR_URL = (
    "https://invoice-generator.com"
)

INVOICE_GENERATOR_API_KEY = os.getenv(
    "INVOICE_GENERATOR_API_KEY"
)


class InvoiceGenerationError(Exception):
    pass


def _build_payload(
    invoice: InvoiceRequest,
) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "from": invoice.from_address,
        "to": invoice.to_address,
        "number": invoice.number,
        "currency": invoice.currency,
        "items": [
            {
                "name": item.name,
                "quantity": float(item.quantity),
                "unit_cost": float(item.unit_cost),
            }
            for item in invoice.items
        ],
    }

    if invoice.invoice_date:
        payload["date"] = (
            invoice.invoice_date.isoformat()
        )

    if invoice.due_date:
        payload["due_date"] = (
            invoice.due_date.isoformat()
        )

    if invoice.notes:
        payload["notes"] = invoice.notes

    return payload


def generate_invoice_pdf(
    invoice: InvoiceRequest,
) -> bytes:
    if not INVOICE_GENERATOR_API_KEY:
        raise InvoiceGenerationError(
            "Invoice Generator API key is not configured."
        )

    payload = _build_payload(invoice)

    try:
        response = requests.post(
            INVOICE_GENERATOR_URL,
            headers={
                "Authorization": (
                    "Bearer "
                    f"{INVOICE_GENERATOR_API_KEY}"
                ),
                "Content-Type": "application/json",
                "Accept": "application/pdf",
            },
            json=payload,
            timeout=30,
        )
    except requests.RequestException as exc:
        raise InvoiceGenerationError(
            "Unable to connect to Invoice Generator."
        ) from exc

    if not response.ok:
        try:
            error_body = response.json()
        except ValueError:
            error_body = {}

        message = (
            error_body.get("message")
            or error_body.get("error")
            or "Invoice generation failed."
        )

        raise InvoiceGenerationError(
            str(message)
        )

    content_type = (
        response.headers
        .get("Content-Type", "")
        .lower()
    )

    if "application/pdf" not in content_type:
        raise InvoiceGenerationError(
            "Invoice Generator returned an unexpected response."
        )

    if not response.content:
        raise InvoiceGenerationError(
            "Invoice Generator returned an empty PDF."
        )

    return response.content