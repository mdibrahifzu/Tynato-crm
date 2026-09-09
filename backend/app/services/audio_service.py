from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile

from app.repositories.audio_repository import AudioRepository
from app.services.audio_config import (
    AUDIO_MAX_CONCURRENT_PROCESSING,
    AUDIO_MAX_PROCESSING_ATTEMPTS,
    AUDIO_MAX_UPLOADS_PER_DAY,
)
from app.services.audio_storage import delete_audio, download_audio, upload_audio
from app.services.audio_validation import validate_audio_signature, validate_upload_metadata
from app.services.gemini_service import summarize_audio

_repo = AudioRepository()


def check_upload_limits(db, current_user, is_admin: bool) -> None:
    if is_admin:
        return

    uploads_today = _repo.get_daily_upload_count(db, current_user["id"])
    if uploads_today >= AUDIO_MAX_UPLOADS_PER_DAY:
        raise HTTPException(
            status_code=429,
            detail={
                "message": "Daily audio upload limit reached.",
                "limit": AUDIO_MAX_UPLOADS_PER_DAY,
            },
        )


def create_upload(db, file: UploadFile, current_user, team):
    is_admin = current_user["role"] == "admin" and current_user["is_active"]
    check_upload_limits(db, current_user, is_admin)

    filename, extension, size, mime_type = validate_upload_metadata(file)
    data = file.file.read(size + 1)

    if len(data) != size or len(data) > size:
        raise HTTPException(status_code=413, detail="Uploaded audio exceeds the maximum size.")

    validate_audio_signature(data, mime_type)

    audio_id = uuid4()
    team_id = team["team_id"] if team else None

    storage_path = upload_audio(
        data,
        str(current_user["id"]),
        str(audio_id),
        extension,
        mime_type,
    )

    try:
        record = _repo.create(
            db,
            owner_id=current_user["id"],
            team_id=team_id,
            original_filename=filename,
            storage_path=storage_path,
            mime_type=mime_type,
            file_size=size,
        )
        db.commit()
        return record
    except Exception:
        db.rollback()
        try:
            delete_audio(storage_path)
        except Exception:
            pass
        raise


def process_audio(audio_id):
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        record = _repo.get_internal(db, audio_id)
        if not record or record["status"] != "uploaded":
            return

        owner_id = record["owner_id"]

        claimed = _repo.claim_processing(
            db,
            audio_id,
            owner_id,
            AUDIO_MAX_CONCURRENT_PROCESSING,
        )
        if not claimed:
            db.rollback()
            return
        db.commit()

        record = _repo.get_internal(db, audio_id)
        if not record:
            return

        try:
            audio_bytes = download_audio(record["storage_path"])
            extension = Path(record["original_filename"]).suffix.lower()
            summary, gemini_file_id = summarize_audio(
                audio_bytes,
                record["mime_type"],
                extension,
            )

            _repo.save_gemini_file_id(db, audio_id, gemini_file_id)
            _repo.save_success(db, audio_id, summary)
            db.commit()

        except Exception:
            db.rollback()
            latest = _repo.get_internal(db, audio_id)
            attempts = int(latest["processing_attempts"]) if latest else AUDIO_MAX_PROCESSING_ATTEMPTS
            final = attempts >= AUDIO_MAX_PROCESSING_ATTEMPTS
            _repo.save_failure(
                db,
                audio_id,
                "Audio processing failed. Please retry.",
                final,
            )
            db.commit()

    finally:
        db.close()
