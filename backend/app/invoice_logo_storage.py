from __future__ import annotations

import os
import uuid
from typing import Optional

from supabase import create_client

BUCKET = "invoice-logos"
SIGNED_URL_SECONDS = 60 * 60 * 24 * 365

_client = None


def _get_client():
    global _client

    if _client is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SECRET_KEY")
        if not url or not key:
            raise RuntimeError("Supabase storage configuration is missing.")
        _client = create_client(url, key)

    return _client


def _validate_storage_path(logo_path: str) -> None:
    if not logo_path:
        raise ValueError("Logo path is empty.")
    if logo_path.startswith("/") or ".." in logo_path.split("/"):
        raise ValueError("Invalid logo storage path.")
    if not (logo_path.startswith("users/") or logo_path.startswith("teams/")):
        raise ValueError("Invalid logo storage scope.")


def upload_invoice_logo_with_path(
    file_bytes: bytes,
    filename: str,
    content_type: str,
    *,
    owner_id: str,
    team_id: Optional[str],
) -> tuple[str, str]:
    if not file_bytes:
        raise ValueError("Logo file is empty.")

    extensions = {
        "image/png": "png",
        "image/jpeg": "jpg",
        "image/webp": "webp",
    }

    ext = extensions.get(content_type)
    if not ext:
        raise ValueError("Unsupported logo content type.")

    scope = f"teams/{team_id}" if team_id else f"users/{owner_id}"
    path = f"{scope}/logo-{uuid.uuid4()}.{ext}"

    client = _get_client()
    client.storage.from_(BUCKET).upload(
        path,
        file_bytes,
        {"content-type": content_type, "upsert": "false"},
    )

    signed_url = create_invoice_logo_signed_url(path)
    return path, signed_url


def upload_invoice_logo(
    file_bytes: bytes,
    filename: str,
    content_type: str,
    *,
    owner_id: str,
    team_id: Optional[str],
) -> str:
    _, signed_url = upload_invoice_logo_with_path(
        file_bytes,
        filename,
        content_type,
        owner_id=owner_id,
        team_id=team_id,
    )
    return signed_url


def create_invoice_logo_signed_url(logo_path: str) -> str:
    _validate_storage_path(logo_path)

    client = _get_client()
    signed = client.storage.from_(BUCKET).create_signed_url(
        logo_path,
        SIGNED_URL_SECONDS,
    )

    signed_url = signed.get("signedURL")
    if not signed_url:
        raise RuntimeError("Supabase did not return a signed logo URL.")

    return signed_url


def delete_invoice_logo(logo_path: str) -> None:
    _validate_storage_path(logo_path)
    client = _get_client()
    client.storage.from_(BUCKET).remove([logo_path])
