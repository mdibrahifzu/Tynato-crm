import os
from typing import Any, Dict

import requests

from app.schemas.invoice import InvoiceRequest

INVOICE_API_URL = "http://127.0.0.1:8001/generate"

_CURRENCY_SYMBOLS = {
    "INR": "₹",
    "USD": "$",
    "EUR": "€",
    "GBP": "£",
}


class InvoiceGenerationError(Exception):
    pass


def _build_payload(invoice: InvoiceRequest) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "from": invoice.from_address or "",
        "to": invoice.to_address or "",
        "number": invoice.number,
        "currency_symbol": _CURRENCY_SYMBOLS.get(invoice.currency, "₹"),
        "items": [
            {
                "name": item.name,
                "quantity": float(item.quantity),
                "unit_cost": float(item.unit_cost),
            }
            for item in invoice.items
        ],
    }

    if invoice.logo_url:
        payload["logo"] = invoice.logo_url
    if invoice.invoice_date:
        payload["date"] = invoice.invoice_date.isoformat()
    if invoice.due_date:
        payload["due_date"] = invoice.due_date.isoformat()
    if invoice.tax_title:
        payload["tax_title"] = invoice.tax_title
    if invoice.tax_percent is not None:
        payload["tax_percent"] = float(invoice.tax_percent)
    if invoice.notes:
        payload["notes"] = invoice.notes
    if invoice.terms:
        payload["terms"] = invoice.terms

    return payload


def generate_invoice_pdf(invoice: InvoiceRequest) -> bytes:
    api_key = os.getenv("INVOICE_API_KEY")
    if not api_key:
        raise InvoiceGenerationError("Invoice API key is not configured.")

    try:
        response = requests.post(
            INVOICE_API_URL,
            headers={
                "X-API-Key": api_key,
                "Content-Type": "application/json",
            },
            json=_build_payload(invoice),
            timeout=15,
        )
    except requests.RequestException as exc:
        raise InvoiceGenerationError("Unable to connect to Invoice API.") from exc

    if not response.ok:
        try:
            error_body = response.json()
        except ValueError:
            error_body = {}
        raise InvoiceGenerationError(
            str(error_body.get("detail") or "Invoice generation failed.")
        )

    content_type = response.headers.get("Content-Type", "").lower()
    if "application/pdf" not in content_type:
        raise InvoiceGenerationError("Invoice API returned an unexpected response.")
    if not response.content:
        raise InvoiceGenerationError("Invoice API returned an empty PDF.")

    return response.content