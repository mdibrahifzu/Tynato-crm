from __future__ import annotations

import json
from typing import Any, Callable, Dict, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session


def create_notification(
    db: Session,
    *,
    user_id: str,
    team_id: Optional[str],
    notification_type: str,
    title: str,
    message: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    dedupe_key: Optional[str] = None,
) -> Optional[dict]:
    """Create one notification using trusted server-side identity values."""

    metadata_json = (
        json.dumps(metadata, separators=(",", ":"))
        if metadata is not None
        else None
    )

    result = db.execute(
        text(
            """
            INSERT INTO public.notifications (
                user_id,
                team_id,
                type,
                title,
                message,
                entity_type,
                entity_id,
                metadata,
                dedupe_key
            )
            VALUES (
                :user_id,
                :team_id,
                :notification_type,
                :title,
                :message,
                :entity_type,
                :entity_id,
                CAST(:metadata AS JSONB),
                :dedupe_key
            )
            ON CONFLICT (
                user_id,
                dedupe_key
            )
            WHERE is_read = FALSE
              AND dedupe_key IS NOT NULL
            DO NOTHING
            RETURNING
                id, user_id, team_id, type, title, message,
                entity_type, entity_id, is_read, read_at,
                metadata, created_at
            """
        ),
        {
            "user_id": user_id,
            "team_id": team_id,
            "notification_type": notification_type,
            "title": title,
            "message": message,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "metadata": metadata_json,
            "dedupe_key": dedupe_key,
        },
    )

    row = result.mappings().first()
    return dict(row) if row is not None else None


def notify_active_team_members(
    db: Session,
    *,
    team_id: str,
    notification_type: str,
    title: str,
    message: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    dedupe_key_factory: Optional[Callable[[str], str]] = None,
) -> int:
    """Send one notification to every ACTIVE member of one team."""

    members = db.execute(
        text(
            """
            SELECT DISTINCT member_id
            FROM public.team_members
            WHERE team_id = :team_id
              AND status = 'active'
              AND member_id IS NOT NULL
            """
        ),
        {"team_id": team_id},
    ).mappings().all()

    created_count = 0

    for member in members:
        member_id = str(member["member_id"])
        dedupe_key = (
            dedupe_key_factory(member_id)
            if dedupe_key_factory is not None
            else None
        )

        created = create_notification(
            db,
            user_id=member_id,
            team_id=team_id,
            notification_type=notification_type,
            title=title,
            message=message,
            entity_type=entity_type,
            entity_id=entity_id,
            metadata=metadata,
            dedupe_key=dedupe_key,
        )

        if created is not None:
            created_count += 1

    return created_count
