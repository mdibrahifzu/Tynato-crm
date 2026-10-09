import logging
from uuid import UUID
 
from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
)
from sqlalchemy import text
from sqlalchemy.orm import Session
 
from app.dependencies import get_current_team, get_current_user, get_db
from app.repositories.audio_repository import AudioRepository
from app.services.audio_config import AUDIO_MAX_PROCESSING_ATTEMPTS
from app.services.audio_evaluator_service import (
    EmptyTranscriptError,
    evaluate_transcript_with_backoff,
)
from app.services.audio_service import create_upload, process_audio
from app.services.audio_storage import delete_audio
 
logger = logging.getLogger(__name__)
router = APIRouter(prefix="/audio", tags=["Audio"])
_repo = AudioRepository()
 
 
@router.post("/upload")
def upload_audio_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    custom_lead_id: UUID | None = Form(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    team=Depends(get_current_team),
):
    if custom_lead_id:
        lead = db.execute(
            text("""
                SELECT
                    id,
                    owner_id,
                    team_id,
                    full_name,
                    phone_number,
                    email
                FROM public.custom_leads
                WHERE id = :custom_lead_id
                  AND (
                        :is_admin = TRUE
                        OR (
                            :team_id IS NOT NULL
                            AND team_id = :team_id
                        )
                        OR (
                            :team_id IS NULL
                            AND owner_id = :owner_id
                            AND team_id IS NULL
                        )
                  )
                LIMIT 1
            """),
            {
                "custom_lead_id": custom_lead_id,
                "owner_id": current_user["id"],
                "team_id": (
                    team["team_id"]
                    if team
                    else None
                ),
                "is_admin": (
                    current_user["role"] == "admin"
                    and current_user["is_active"]
                ),
            },
        ).mappings().first()
 
        if not lead:
            raise HTTPException(
                status_code=404,
                detail="Custom lead not found.",
            )
 
    record = create_upload(
        db,
        file,
        current_user,
        team,
        custom_lead_id=custom_lead_id,
    )
 
    background_tasks.add_task(
        process_audio,
        record["id"],
    )
 
    return {
        "audio_id": record["id"],
        "custom_lead_id": custom_lead_id,
        "status": record["status"],
        "message": (
            "Audio uploaded and queued "
            "for processing."
        ),
    }
 
 
def run_evaluation_job(audio_id: UUID):
    from app.database import SessionLocal
 
    db = SessionLocal()
    try:
        record = _repo.get_for_evaluation(db, audio_id)
        transcript = record["transcript"] if record else None
 
        evaluation, model_name = evaluate_transcript_with_backoff(transcript)
 
        _repo.save_evaluation_success(
            db,
            audio_id,
            evaluation,
            model_name,
            evaluation.model_dump(mode="json"),
        )
        db.commit()
 
        # AI follow-up reminder. Must never break the evaluation itself.
        try:
            from app.services.ai_follow_up import schedule_ai_follow_up
 
            outcome = schedule_ai_follow_up(
                db,
                audio_id,
                evaluation.model_dump(mode="json"),
            )
            db.commit()
            logger.info("AI follow-up for audio %s: %s", audio_id, outcome)
        except Exception:
            db.rollback()
            logger.exception("AI follow-up failed for audio %s", audio_id)
 
    except EmptyTranscriptError as exc:
        db.rollback()
        _repo.save_evaluation_failure(db, audio_id, str(exc), True)
        db.commit()
 
    except Exception:
        db.rollback()
        latest = _repo.get_evaluation(db, audio_id)
        attempts = int(latest["processing_attempts"]) if latest else AUDIO_MAX_PROCESSING_ATTEMPTS
        final = attempts >= AUDIO_MAX_PROCESSING_ATTEMPTS
        _repo.save_evaluation_failure(
            db,
            audio_id,
            "AI call evaluation failed. Please retry.",
            final,
        )
        db.commit()
 
    finally:
        db.close()
 
 
@router.get("")
def list_audio(
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    custom_lead_id: UUID | None = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    team=Depends(get_current_team),
):
    return _repo.list_for_user(
        db,
        current_user,
        team,
        limit,
        offset,
        custom_lead_id,
    )
 
 
@router.get("/evaluations/history")
def get_evaluation_history(
    limit: int = Query(20, ge=1, le=100),
    custom_lead_id: UUID | None = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    team=Depends(get_current_team),
):
    return _repo.get_evaluation_history(
        db,
        current_user,
        team,
        limit=limit,
        custom_lead_id=custom_lead_id,
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
    background_tasks.add_task(run_evaluation_job, audio_id)
 
    return {
        "audio_id": audio_id,
        "status": "processing",
        "message": "AI evaluation started.",
    }
 
 
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
        pass
 
    return {
        "success": True,
        "audio_id": audio_id,
    }