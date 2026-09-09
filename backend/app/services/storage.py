import os
import uuid
from supabase import create_client

BUCKET = "lead-attachments"

_client = None


def _get_client():
    global _client
    if _client is None:
        _client = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SECRET_KEY"),
        )
    return _client


def upload_lead_file(file_bytes: bytes, filename: str, content_type: str) -> str:
    client = _get_client()
    ext = filename.rsplit(".", 1)[-1] if "." in filename else "bin"
    path = f"{uuid.uuid4()}.{ext}"
    client.storage.from_(BUCKET).upload(path, file_bytes, {"content-type": content_type})
    return client.storage.from_(BUCKET).create_signed_url(path, 60 * 60 * 24 * 365)["signedURL"]