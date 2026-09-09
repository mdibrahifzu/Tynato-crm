import os

from supabase import create_client

from app.services.audio_config import AUDIO_BUCKET

_client = None


def _get_client():
    global _client
    if _client is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SECRET_KEY")
        if not url or not key:
            raise RuntimeError("Supabase server storage configuration is missing")
        _client = create_client(url, key)
    return _client


def upload_audio(file_bytes: bytes, owner_id: str, audio_id: str, extension: str, content_type: str) -> str:
    path = f"{owner_id}/{audio_id}/{audio_id}{extension}"
    _get_client().storage.from_(AUDIO_BUCKET).upload(
        path,
        file_bytes,
        {
            "content-type": content_type,
            "cache-control": "3600",
            "upsert": False,
        },
    )
    return path


def download_audio(path: str) -> bytes:
    return _get_client().storage.from_(AUDIO_BUCKET).download(path)


def delete_audio(path: str) -> None:
    _get_client().storage.from_(AUDIO_BUCKET).remove([path])
