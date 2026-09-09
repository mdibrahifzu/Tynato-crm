from uuid import UUID
import json

from sqlalchemy import text


class AudioRepository:
    def get_daily_upload_count(self, db, owner_id: UUID) -> int:
        value = db.execute(
            text("""
                SELECT COUNT(*)
                FROM public.audio_files
                WHERE owner_id = :owner_id
                  AND created_at >= CURRENT_DATE
                  AND created_at < CURRENT_DATE + INTERVAL '1 day'
            """),
            {"owner_id": owner_id},
        ).scalar()
        return int(value or 0)

    def get_processing_count(self, db, owner_id: UUID) -> int:
        value = db.execute(
            text("""
                SELECT COUNT(*)
                FROM public.audio_files
                WHERE owner_id = :owner_id
                  AND status = 'processing'
            """),
            {"owner_id": owner_id},
        ).scalar()
        return int(value or 0)

    def create(self, db, *, owner_id, team_id, original_filename, storage_path, mime_type, file_size):
        result = db.execute(
            text("""
                INSERT INTO public.audio_files (
                    owner_id,
                    team_id,
                    original_filename,
                    storage_path,
                    mime_type,
                    file_size,
                    status,
                    processing_attempts
                )
                VALUES (
                    :owner_id,
                    :team_id,
                    :original_filename,
                    :storage_path,
                    :mime_type,
                    :file_size,
                    'uploaded',
                    0
                )
                RETURNING *
            """),
            {
                "owner_id": owner_id,
                "team_id": team_id,
                "original_filename": original_filename,
                "storage_path": storage_path,
                "mime_type": mime_type,
                "file_size": file_size,
            },
        )
        return result.mappings().first()

    def get_for_user(self, db, audio_id, current_user, team):
        result = db.execute(
            text("""
                SELECT
                    af.*,
                    s.transcript,
                    s.summary,
                    s.key_points,
                    s.action_items,
                    s.decisions,
                    s.follow_up
                FROM public.audio_files af
                LEFT JOIN public.audio_summaries s ON s.audio_id = af.id
                WHERE af.id = :audio_id
                  AND (
                        af.owner_id = :owner_id
                        OR :is_admin = TRUE
                        OR (
                            :team_id IS NOT NULL
                            AND af.team_id = :team_id
                        )
                  )
                LIMIT 1
            """),
            {
                "audio_id": audio_id,
                "owner_id": current_user["id"],
                "is_admin": current_user["role"] == "admin" and current_user["is_active"],
                "team_id": team["team_id"] if team else None,
            },
        ).mappings().first()
        return result

    def list_for_user(self, db, current_user, team, limit: int = 20, offset: int = 0):
        result = db.execute(
            text("""
                SELECT
                    af.id,
                    af.owner_id,
                    af.team_id,
                    af.original_filename,
                    af.mime_type,
                    af.file_size,
                    af.status,
                    af.processing_attempts,
                    af.error_message,
                    af.created_at,
                    af.updated_at
                FROM public.audio_files af
                WHERE (
                    af.owner_id = :owner_id
                    OR :is_admin = TRUE
                    OR (
                        :team_id IS NOT NULL
                        AND af.team_id = :team_id
                    )
                )
                ORDER BY af.created_at DESC
                LIMIT :limit OFFSET :offset
            """),
            {
                "owner_id": current_user["id"],
                "is_admin": current_user["role"] == "admin" and current_user["is_active"],
                "team_id": team["team_id"] if team else None,
                "limit": limit,
                "offset": offset,
            },
        )
        return result.mappings().all()

    def get_internal(self, db, audio_id):
        return db.execute(
            text("SELECT * FROM public.audio_files WHERE id = :audio_id LIMIT 1"),
            {"audio_id": audio_id},
        ).mappings().first()

    def claim_processing(self, db, audio_id, owner_id, max_concurrent: int) -> bool:
        result = db.execute(
            text("""
                UPDATE public.audio_files af
                SET
                    status = 'processing',
                    processing_attempts = processing_attempts + 1,
                    error_message = NULL,
                    updated_at = NOW()
                WHERE af.id = :audio_id
                  AND af.owner_id = :owner_id
                  AND af.status = 'uploaded'
                  AND af.processing_attempts < :max_attempts
                  AND (
                      SELECT COUNT(*)
                      FROM public.audio_files p
                      WHERE p.owner_id = af.owner_id
                        AND p.status = 'processing'
                  ) < :max_concurrent
                RETURNING af.id, af.processing_attempts
            """),
            {
                "audio_id": audio_id,
                "owner_id": owner_id,
                "max_concurrent": max_concurrent,
                "max_attempts": 2,
            },
        ).mappings().first()
        return result is not None

    def save_gemini_file_id(self, db, audio_id, gemini_file_id: str):
        db.execute(
            text("""
                UPDATE public.audio_files
                SET gemini_file_id = :gemini_file_id,
                    updated_at = NOW()
                WHERE id = :audio_id
            """),
            {"audio_id": audio_id, "gemini_file_id": gemini_file_id},
        )

    def save_success(self, db, audio_id, summary):
        db.execute(
            text("""
                INSERT INTO public.audio_summaries (
                    audio_id, transcript, summary,
                    key_points, action_items, decisions, follow_up
                )
                VALUES (
                    :audio_id, :transcript, :summary,
                    CAST(:key_points AS jsonb),
                    CAST(:action_items AS jsonb),
                    CAST(:decisions AS jsonb),
                    CAST(:follow_up AS jsonb)
                )
                ON CONFLICT (audio_id) DO UPDATE SET
                    transcript = EXCLUDED.transcript,
                    summary = EXCLUDED.summary,
                    key_points = EXCLUDED.key_points,
                    action_items = EXCLUDED.action_items,
                    decisions = EXCLUDED.decisions,
                    follow_up = EXCLUDED.follow_up,
                    updated_at = NOW()
            """),
            {
                "audio_id": audio_id,
                "transcript": summary.transcript,
                "summary": summary.summary,
                "key_points": json.dumps(summary.key_points),
                "action_items": json.dumps(summary.action_items),
                "decisions": json.dumps(summary.decisions),
                "follow_up": json.dumps(summary.follow_up),
            },
        )
        db.execute(
            text("""
                UPDATE public.audio_files
                SET status = 'completed',
                    error_message = NULL,
                    updated_at = NOW()
                WHERE id = :audio_id
            """),
            {"audio_id": audio_id},
        )

    def get_evaluation(self, db, audio_id):
        result = db.execute(
            text("""
                SELECT
                    id,
                    audio_id,
                    status,
                    processing_attempts,
                    error_message,
                    client_name,
                    is_new_conversation,
                    performance_score,
                    summary,
                    model_name,
                    raw_response,
                    analysis,
                    created_at,
                    updated_at
                FROM public.audio_evaluations
                WHERE audio_id = :audio_id
                LIMIT 1
            """),
            {"audio_id": audio_id},
        ).mappings().first()

        return result

    def start_evaluation(self, db, audio_id, max_attempts: int):
        result = db.execute(
            text("""
                INSERT INTO public.audio_evaluations (
                    audio_id,
                    status,
                    processing_attempts,
                    error_message
                )
                VALUES (
                    :audio_id,
                    'processing',
                    1,
                    NULL
                )
                ON CONFLICT (audio_id)
                DO UPDATE SET
                    status = 'processing',
                    processing_attempts =
                        audio_evaluations.processing_attempts + 1,
                    error_message = NULL,
                    updated_at = NOW()
                WHERE audio_evaluations.status IN ('pending', 'failed')
                  AND audio_evaluations.processing_attempts < :max_attempts
                RETURNING *
            """),
            {
                "audio_id": audio_id,
                "max_attempts": max_attempts,
            },
        ).mappings().first()

        return result

    def save_evaluation_success(
        self,
        db,
        audio_id,
        evaluation,
        model_name: str,
        raw_response: dict,
    ):
        analysis = evaluation.model_dump(
            mode="json",
        )

        result = db.execute(
            text("""
                UPDATE public.audio_evaluations
                SET
                    status = 'completed',
                    client_name = :client_name,
                    is_new_conversation = :is_new_conversation,
                    performance_score = :performance_score,
                    summary = :summary,
                    model_name = :model_name,
                    raw_response = CAST(:raw_response AS jsonb),
                    analysis = CAST(:analysis AS jsonb),
                    error_message = NULL,
                    updated_at = NOW()
                WHERE audio_id = :audio_id
                RETURNING *
            """),
            {
                "audio_id": audio_id,
                "client_name": evaluation.client_name,
                "is_new_conversation": evaluation.is_new_conversation,
                "performance_score": evaluation.performance_score,
                "summary": evaluation.summary,
                "model_name": model_name,
                "raw_response": json.dumps(raw_response),
                "analysis": json.dumps(analysis),
            },
        ).mappings().first()

        return result

    def save_evaluation_failure(
        self,
        db,
        audio_id,
        error_message: str,
        final: bool,
    ):
        status = "failed" if final else "pending"

        result = db.execute(
            text("""
                UPDATE public.audio_evaluations
                SET
                    status = :status,
                    error_message = :error_message,
                    updated_at = NOW()
                WHERE audio_id = :audio_id
                RETURNING *
            """),
            {
                "audio_id": audio_id,
                "status": status,
                "error_message": error_message[:1000],
            },
        ).mappings().first()

        return result

    def save_failure(self, db, audio_id, error_message: str, final: bool):
        status = "failed" if final else "uploaded"
        db.execute(
            text("""
                UPDATE public.audio_files
                SET status = :status,
                    error_message = :error_message,
                    updated_at = NOW()
                WHERE id = :audio_id
            """),
            {
                "audio_id": audio_id,
                "status": status,
                "error_message": error_message[:1000],
            },
        )

    def delete(self, db, audio_id, current_user, team):
        result = db.execute(
            text("""
                DELETE FROM public.audio_files
                WHERE id = :audio_id
                  AND (
                        owner_id = :owner_id
                        OR :is_admin = TRUE
                  )
                RETURNING storage_path
            """),
            {
                "audio_id": audio_id,
                "owner_id": current_user["id"],
                "is_admin": current_user["role"] == "admin" and current_user["is_active"],
            },
        ).mappings().first()
        return result
    def get_evaluation_history(
        self,
        db,
        current_user,
        limit: int = 20,
    ):
        result = db.execute(
            text("""
                SELECT
                    ae.id,
                    ae.audio_id,
                    ae.client_name,
                    ae.performance_score,
                    ae.summary,
                    ae.model_name,
                    ae.analysis,
                    ae.created_at,
                    ae.updated_at
                FROM public.audio_evaluations ae
                INNER JOIN public.audio_files af
                    ON af.id = ae.audio_id
                WHERE af.owner_id = :owner_id
                  AND ae.status = 'completed'
                ORDER BY ae.created_at ASC
                LIMIT :limit
            """),
            {
                "owner_id": current_user["id"],
                "limit": limit,
            },
        )

        return result.mappings().all()