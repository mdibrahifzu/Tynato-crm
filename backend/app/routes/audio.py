from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.dependencies import get_current_team, get_current_user, get_db
from app.repositories.audio_repository import AudioRepository
from app.services.audio_config import AUDIO_MAX_PROCESSING_ATTEMPTS
from app.services.audio_evaluator_service import (
    EmptyTranscriptError,
    evaluate_transcript,
)
from app.services.audio_service import create_upload, process_audio
from app.services.audio_storage import delete_audio

router = APIRouter(prefix="/audio", tags=["Audio"])
_repo = AudioRepository()


@router.post("/upload")
def upload_audio_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    team=Depends(get_current_team),
):
    record = create_upload(db, file, current_user, team)
    background_tasks.add_task(process_audio, record["id"])
    return {
        "audio_id": record["id"],
        "status": record["status"],
        "message": "Audio uploaded and queued for processing.",
    }


@router.get("")
def list_audio(
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    team=Depends(get_current_team),
):
    return _repo.list_for_user(db, current_user, team, limit, offset)

@router.get("/evaluations/history")
def get_evaluation_history(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return _repo.get_evaluation_history(
        db,
        current_user,
        limit,
    )

@router.get("/{audio_id}")
def get_audio(
    audio_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    team=Depends(get_current_team),
):
    record = _repo.get_for_user(db, audio_id, current_user, team)

    if not record:
        raise HTTPException(
            status_code=404,
            detail="Audio not found.",
        )

    return record


@router.post("/{audio_id}/retry")
def retry_audio(
    audio_id: UUID,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    team=Depends(get_current_team),
):
    record = _repo.get_for_user(
        db,
        audio_id,
        current_user,
        team,
    )

    if not record:
        raise HTTPException(
            status_code=404,
            detail="Audio not found.",
        )

    if record["status"] != "failed":
        raise HTTPException(
            status_code=409,
            detail="Only failed audio can be retried.",
        )

    if (
        record["owner_id"] != current_user["id"]
        and current_user["role"] != "admin"
    ):
        raise HTTPException(
            status_code=403,
            detail="Only the owner or an admin can retry this audio.",
        )

    if record["processing_attempts"] >= AUDIO_MAX_PROCESSING_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail="Maximum processing attempts reached.",
        )

    db.execute(
        text("""
            UPDATE public.audio_files
            SET status = 'uploaded',
                error_message = NULL,
                updated_at = NOW()
            WHERE id = :audio_id
              AND status = 'failed'
        """),
        {"audio_id": audio_id},
    )

    db.commit()
    background_tasks.add_task(process_audio, audio_id)

    return {
        "audio_id": audio_id,
        "status": "uploaded",
    }


@router.post("/{audio_id}/evaluate")
def evaluate_audio_call(
    audio_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    team=Depends(get_current_team),
):
    record = _repo.get_for_user(
        db,
        audio_id,
        current_user,
        team,
    )

    if not record:
        raise HTTPException(
            status_code=404,
            detail="Audio not found.",
        )

    if record["status"] != "completed":
        raise HTTPException(
            status_code=409,
            detail="Audio processing must be completed before evaluation.",
        )

    transcript = record["transcript"]

    if not transcript or not transcript.strip():
        raise HTTPException(
            status_code=422,
            detail="No transcript is available for evaluation.",
        )

    existing = _repo.get_evaluation(
        db,
        audio_id,
    )

    if existing and existing["status"] == "completed":
        return existing

    evaluation_record = _repo.start_evaluation(
        db,
        audio_id,
        AUDIO_MAX_PROCESSING_ATTEMPTS,
    )

    if not evaluation_record:
        raise HTTPException(
            status_code=409,
            detail=(
                "Evaluation is already processing or the maximum "
                "attempts have been reached."
            ),
        )

    db.commit()

    try:
        evaluation, model_name = evaluate_transcript(
            transcript,
        )

        result = _repo.save_evaluation_success(
            db,
            audio_id,
            evaluation,
            model_name,
            evaluation.model_dump(
                mode="json",
            ),
        )

        if not result:
            db.rollback()
            raise HTTPException(
                status_code=500,
                detail="Evaluation was generated but could not be saved.",
            )

        db.commit()
        return result

    except EmptyTranscriptError as exc:
        db.rollback()

        _repo.save_evaluation_failure(
            db,
            audio_id,
            str(exc),
            True,
        )

        db.commit()

        raise HTTPException(
            status_code=422,
            detail=str(exc),
        )

    except HTTPException:
        raise

    except Exception:
        db.rollback()

        latest = _repo.get_evaluation(
            db,
            audio_id,
        )

        attempts = (
            int(latest["processing_attempts"])
            if latest
            else 0
        )

        final = (
            attempts >= AUDIO_MAX_PROCESSING_ATTEMPTS
        )

        _repo.save_evaluation_failure(
            db,
            audio_id,
            "AI call evaluation failed. Please retry.",
            final,
        )

        db.commit()

        raise HTTPException(
            status_code=503,
            detail="AI call evaluation is temporarily unavailable.",
        )

@router.get("/{audio_id}/evaluation")
def get_audio_evaluation(
    audio_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    team=Depends(get_current_team),
):
    record = _repo.get_for_user(
        db,
        audio_id,
        current_user,
        team,
    )

    if not record:
        raise HTTPException(
            status_code=404,
            detail="Audio not found.",
        )

    evaluation = _repo.get_evaluation(
        db,
        audio_id,
    )

    if not evaluation:
        raise HTTPException(
            status_code=404,
            detail="Evaluation not found.",
        )

    if evaluation["status"] != "completed":
        raise HTTPException(
            status_code=409,
            detail="Evaluation is not completed.",
        )

    return evaluation

@router.delete("/{audio_id}")
def delete_audio_file(
    audio_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    team=Depends(get_current_team),
):
    record = _repo.delete(
        db,
        audio_id,
        current_user,
        team,
    )

    if not record:
        db.rollback()
        raise HTTPException(
            status_code=404,
            detail="Audio not found.",
        )

    db.commit()

    try:
        delete_audio(record["storage_path"])
    except Exception:
        # Database ownership has already been removed. The object remains
        # inaccessible through the application but should be cleaned by a
        # production storage reconciliation job.
        pass

    return {
        "success": True,
        "audio_id": audio_id,
    }