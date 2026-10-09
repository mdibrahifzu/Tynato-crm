from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.dependencies import get_current_user, get_db

router = APIRouter()


def create_in_app_notification(
    db: Session,
    *,
    team_id,
    user_id,
    notification_type: str,
    title: str,
    message: str,
    entity_type: str | None = None,
    entity_id: str | None = None,
    metadata: dict | None = None,
    dedupe_key: str | None = None,
):
    return db.execute(
        text(
            """
            INSERT INTO public.notifications (
                team_id,
                user_id,
                type,
                title,
                message,
                entity_type,
                entity_id,
                is_read,
                metadata,
                dedupe_key
            )
            VALUES (
                :team_id,
                :user_id,
                :type,
                :title,
                :message,
                :entity_type,
                :entity_id,
                FALSE,
                CAST(:metadata AS jsonb),
                :dedupe_key
            )
            ON CONFLICT (dedupe_key)
            DO NOTHING
            RETURNING id
            """
        ),
        {
            "team_id": team_id,
            "user_id": user_id,
            "type": notification_type,
            "title": title,
            "message": message,
            "entity_type": entity_type,
            "entity_id": str(entity_id) if entity_id else None,
            "metadata": json.dumps(metadata or {}),
            "dedupe_key": dedupe_key,
        },
    ).scalar()


@router.get("/notifications")
def list_notifications(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    unread_only: bool = Query(False),
    notification_type: str | None = Query(
        default=None, min_length=1, max_length=100
    ),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = db.execute(
        text(
            """
            SELECT
                id, team_id, type, title, message,
                entity_type, entity_id, is_read, read_at,
                metadata, created_at
            FROM public.notifications
            WHERE user_id = :user_id
              AND (:unread_only = FALSE OR is_read = FALSE)
              AND (
    CAST(:notification_type AS TEXT) IS NULL
    OR type = :notification_type
)
            ORDER BY created_at DESC
            LIMIT :limit
            OFFSET :offset
            """
        ),
        {
            "user_id": current_user["id"],
            "unread_only": unread_only,
            "notification_type": notification_type,
            "limit": limit,
            "offset": offset,
        },
    )
    return [dict(row) for row in result.mappings().all()]


@router.get("/notifications/unread-count")
def get_unread_notification_count(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    count = db.execute(
        text(
            """
            SELECT COUNT(*)::int
            FROM public.notifications
            WHERE user_id = :user_id
              AND is_read = FALSE
            """
        ),
        {"user_id": current_user["id"]},
    ).scalar() or 0

    return {"count": int(count)}


@router.patch("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    updated = db.execute(
        text(
            """
            UPDATE public.notifications
            SET is_read = TRUE, read_at = NOW()
            WHERE id = :notification_id
              AND user_id = :user_id
              AND is_read = FALSE
            RETURNING id, is_read, read_at
            """
        ),
        {
            "notification_id": notification_id,
            "user_id": current_user["id"],
        },
    ).mappings().first()

    if updated is not None:
        db.commit()
        return {
            "success": True,
            "already_read": False,
            "notification": dict(updated),
        }

    exists = db.execute(
        text(
            """
            SELECT 1
            FROM public.notifications
            WHERE id = :notification_id
              AND user_id = :user_id
            LIMIT 1
            """
        ),
        {
            "notification_id": notification_id,
            "user_id": current_user["id"],
        },
    ).first()

    if exists is None:
        raise HTTPException(
            status_code=404,
            detail="Notification not found.",
        )

    return {"success": True, "already_read": True}


@router.patch("/notifications/read-all")
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = db.execute(
        text(
            """
            UPDATE public.notifications
            SET is_read = TRUE, read_at = NOW()
            WHERE user_id = :user_id
              AND is_read = FALSE
            """
        ),
        {"user_id": current_user["id"]},
    )
    db.commit()

    return {
        "success": True,
        "updated": int(result.rowcount or 0),
    }
