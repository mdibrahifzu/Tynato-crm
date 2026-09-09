from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.services.audio_config import (
    ALLOWED_AUDIO_EXTENSIONS,
    ALLOWED_AUDIO_TYPES,
    AUDIO_MAX_FILENAME_LENGTH,
    AUDIO_MAX_FILE_SIZE_BYTES,
    normalize_mime_type,
)


def sanitize_filename(filename: str) -> str:
    filename = (filename or "").strip()
    if not filename or filename in {".", ".."}:
        raise HTTPException(status_code=400, detail="Invalid filename.")
    if len(filename) > AUDIO_MAX_FILENAME_LENGTH:
        raise HTTPException(status_code=400, detail="Filename is too long.")
    if any(char in filename for char in "\x00\r\n/\\"):
        raise HTTPException(status_code=400, detail="Invalid filename.")
    return filename


def validate_upload_metadata(file: UploadFile) -> tuple[str, str, int, str]:
    filename = sanitize_filename(file.filename or "")
    extension = Path(filename).suffix.lower()
    mime_type = normalize_mime_type(file.content_type)

    if extension not in ALLOWED_AUDIO_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Unsupported audio extension.")
    if mime_type not in ALLOWED_AUDIO_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported audio MIME type.")
    if extension != ALLOWED_AUDIO_TYPES[mime_type]:
        raise HTTPException(status_code=400, detail="Audio extension and MIME type do not match.")

    try:
        file.file.seek(0, 2)
        size = file.file.tell()
        file.file.seek(0)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Could not inspect uploaded file.") from exc

    if size <= 0:
        raise HTTPException(status_code=400, detail="Audio file is empty.")
    if size > AUDIO_MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Audio file is too large. Maximum size is {AUDIO_MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB.",
        )

    return filename, extension, size, mime_type


def validate_audio_signature(data: bytes, mime_type: str) -> None:
    if len(data) < 4:
        raise HTTPException(status_code=400, detail="Invalid audio file.")

    if mime_type in {"audio/wav", "audio/x-wav"}:
        valid = len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WAVE"
    elif mime_type == "audio/ogg":
        valid = data[:4] == b"OggS"
    elif mime_type == "audio/flac":
        valid = data[:4] == b"fLaC"
    elif mime_type == "audio/webm":
        valid = data[:4] == b"\x1a\x45\xdf\xa3"
    elif mime_type in {"audio/m4a", "audio/x-m4a", "audio/mp4"}:
        valid = len(data) >= 12 and data[4:8] == b"ftyp"
    elif mime_type in {"audio/mpeg"}:
        valid = data[:3] == b"ID3" or (len(data) >= 2 and data[0] == 0xFF and (data[1] & 0xE0) == 0xE0)
    elif mime_type == "audio/aac":
        valid = len(data) >= 2 and data[0] == 0xFF and (data[1] & 0xF6) == 0xF0
    else:
        # The allowlist already limits the type. Avoid pretending an incomplete
        # signature check can prove formats for which we do not have a robust
        # signature parser here.
        valid = True

    if not valid:
        raise HTTPException(
            status_code=400,
            detail="Uploaded content does not match its declared audio type.",
        )
