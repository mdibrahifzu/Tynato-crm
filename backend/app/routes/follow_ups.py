from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.dependencies import get_current_team, get_current_user, get_db
from app.routes.notifications import create_in_app_notification

logger = logging.getLogger(__name__)

router = APIRouter()

REMINDER_OFFSETS = {5, 15, 30, 60, 1440}
ACTIVE_STATUSES = ("scheduled", "processing", "reminded")


class FollowUpRequest(BaseModel):
    follow_up_at: datetime
    reminder_offset_minutes: int = Field(default=15)
    assigned_to: Optional[UUID] = None

    def validate_values(self) -> None:
        if self.reminder_offset_minutes not in REMINDER_OFFSETS:
            raise HTTPException(
                status_code=400,
                detail="Invalid reminder offset.",
            )

        if self.follow_up_at.tzinfo is None or self.follow_up_at.utcoffset() is None:
            raise HTTPException(
                status_code=400,
                detail="follow_up_at must include a timezone offset.",
            )


def _lead_access_clause(current_user, team):
    if current_user["role"] == "admin":
        return "", {}

    if team:
        return "AND cl.team_id = :team_id", {"team_id": team["team_id"]}

    return (
        "AND cl.owner_id = :owner_id AND cl.team_id IS NULL",
        {"owner_id": current_user["id"]},
    )


def _get_accessible_lead(
    db: Session,
    custom_lead_id: UUID,
    current_user,
    team,
):
    access_clause, access_params = _lead_access_clause(current_user, team)

    result = db.execute(
        text(
            f"""
            SELECT
                cl.id,
                cl.full_name,
                cl.phone_number,
                cl.owner_id,
                cl.team_id,
                cl.status
            FROM public.custom_leads cl
            WHERE cl.id = :custom_lead_id
            {access_clause}
            LIMIT 1
            FOR UPDATE
            """
        ),
        {
            "custom_lead_id": str(custom_lead_id),
            **access_params,
        },
    ).mappings().first()

    if not result:
        raise HTTPException(
            status_code=404,
            detail="Custom lead not found.",
        )

    return result


def _validate_assignee(
    db: Session,
    *,
    lead,
    assigned_to: str,
):
    if lead["team_id"] is None:
        if str(lead["owner_id"]) != str(assigned_to):
            raise HTTPException(
                status_code=403,
                detail="A personal custom lead can only be assigned to its owner.",
            )
        return

    member = db.execute(
        text(
            """
            SELECT p.id
            FROM public.team_members tm
            INNER JOIN public.profiles p
                ON p.id = tm.member_id
            WHERE tm.team_id = :team_id
              AND tm.member_id = :assigned_to
              AND tm.status = 'active'
              AND p.is_active = TRUE
            LIMIT 1
            """
        ),
        {
            "team_id": lead["team_id"],
            "assigned_to": assigned_to,
        },
    ).first()

    if not member:
        raise HTTPException(
            status_code=400,
            detail="Assigned user is not an active member of this team.",
        )


@router.get("/follow-ups/assignees")
def get_follow_up_assignees(
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    team=Depends(get_current_team),
):
    if not team:
        profile = db.execute(
            text(
                """
                SELECT id, full_name, email
                FROM public.profiles
                WHERE id = :user_id
                  AND is_active = TRUE
                LIMIT 1
                """
            ),
            {"user_id": current_user["id"]},
        ).mappings().first()

        return [dict(profile)] if profile else []

    rows = db.execute(
    text(
        """
        SELECT
            p.id,
            p.full_name,
            p.email
        FROM public.team_members tm
        INNER JOIN public.profiles p
            ON p.id = tm.member_id
        WHERE tm.team_id = :team_id
          AND tm.status = 'active'
          AND tm.member_id IS NOT NULL
          AND p.is_active = TRUE
        ORDER BY
            CASE WHEN p.id = :current_user_id THEN 0 ELSE 1 END,
            COALESCE(p.full_name, p.email, p.id::text),
            p.id
        """
    ),
    {
        "team_id": team["team_id"],
        "current_user_id": current_user["id"],
    },
).mappings().all()

    return [dict(row) for row in rows]


@router.get("/custom-leads/{custom_lead_id}/follow-up")
def get_follow_up(
    custom_lead_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    team=Depends(get_current_team),
):
    lead = _get_accessible_lead(
        db,
        custom_lead_id,
        current_user,
        team,
    )

    row = db.execute(
        text(
            """
            SELECT
                id,
                custom_lead_id,
                team_id,
                assigned_to,
                follow_up_at,
                reminder_offset_minutes,
                remind_at,
                status,
                reminder_sent_at,
                created_at,
                updated_at
            FROM public.lead_follow_ups
            WHERE custom_lead_id = :custom_lead_id
              AND status IN ('scheduled', 'processing', 'reminded')
            ORDER BY updated_at DESC
            LIMIT 1
            """
        ),
        {"custom_lead_id": str(lead["id"])},
    ).mappings().first()

    return dict(row) if row else None


@router.post("/custom-leads/{custom_lead_id}/follow-up")
def schedule_follow_up(
    custom_lead_id: UUID,
    payload: FollowUpRequest,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    team=Depends(get_current_team),
):
    payload.validate_values()

    follow_up_at = payload.follow_up_at.astimezone(timezone.utc)
    now = datetime.now(timezone.utc)

    if follow_up_at <= now:
        raise HTTPException(
            status_code=400,
            detail="Follow-up date and time must be in the future.",
        )

    remind_at = follow_up_at - timedelta(
        minutes=payload.reminder_offset_minutes
    )

    try:
        lead = _get_accessible_lead(
            db,
            custom_lead_id,
            current_user,
            team,
        )

        assigned_to = str(payload.assigned_to or current_user["id"])
        _validate_assignee(
            db,
            lead=lead,
            assigned_to=assigned_to,
        )

        existing = db.execute(
            text(
                """
                SELECT id
                FROM public.lead_follow_ups
                WHERE custom_lead_id = :custom_lead_id
                  AND status IN ('scheduled', 'processing', 'reminded')
                ORDER BY updated_at DESC
                LIMIT 1
                FOR UPDATE
                """
            ),
            {"custom_lead_id": str(lead["id"])},
        ).scalar()

        if existing:
            follow_up = db.execute(
                text(
                    """
                    UPDATE public.lead_follow_ups
                    SET
                        team_id = :team_id,
                        assigned_to = :assigned_to,
                        follow_up_at = :follow_up_at,
                        reminder_offset_minutes = :reminder_offset_minutes,
                        remind_at = :remind_at,
                        status = 'scheduled',
                        reminder_sent_at = NULL,
                        updated_at = NOW()
                    WHERE id = :id
                    RETURNING
                        id,
                        custom_lead_id,
                        team_id,
                        assigned_to,
                        follow_up_at,
                        reminder_offset_minutes,
                        remind_at,
                        status,
                        reminder_sent_at,
                        created_at,
                        updated_at
                    """
                ),
                {
                    "id": existing,
                    "team_id": lead["team_id"],
                    "assigned_to": assigned_to,
                    "follow_up_at": follow_up_at,
                    "reminder_offset_minutes": payload.reminder_offset_minutes,
                    "remind_at": remind_at,
                },
            ).mappings().first()
        else:
            follow_up = db.execute(
                text(
                    """
                    INSERT INTO public.lead_follow_ups (
                        custom_lead_id,
                        team_id,
                        assigned_to,
                        follow_up_at,
                        reminder_offset_minutes,
                        remind_at,
                        status
                    )
                    VALUES (
                        :custom_lead_id,
                        :team_id,
                        :assigned_to,
                        :follow_up_at,
                        :reminder_offset_minutes,
                        :remind_at,
                        'scheduled'
                    )
                    RETURNING
                        id,
                        custom_lead_id,
                        team_id,
                        assigned_to,
                        follow_up_at,
                        reminder_offset_minutes,
                        remind_at,
                        status,
                        reminder_sent_at,
                        created_at,
                        updated_at
                    """
                ),
                {
                    "custom_lead_id": lead["id"],
                    "team_id": lead["team_id"],
                    "assigned_to": assigned_to,
                    "follow_up_at": follow_up_at,
                    "reminder_offset_minutes": payload.reminder_offset_minutes,
                    "remind_at": remind_at,
                },
            ).mappings().first()

        if not follow_up:
            raise RuntimeError("Follow-up creation failed.")

        db.execute(
            text(
                """
                UPDATE public.custom_leads
                SET
                    status = 'follow_up',
                    updated_at = NOW()
                WHERE id = :custom_lead_id
                """
            ),
                        {"custom_lead_id": str(lead["id"])},
        )

        if assigned_to != str(current_user["id"]):
            try:
                with db.begin_nested():
                    create_in_app_notification(
                        db,
                        team_id=lead["team_id"],
                        user_id=assigned_to,
                        notification_type="LEAD_ASSIGNED",
                        title="Lead assigned to you",
                        message=f"{lead['full_name'] or 'A lead'} was assigned to you with a follow-up.",
                        entity_type="custom_lead",
                        entity_id=str(lead["id"]),
                        metadata={"follow_up_at": follow_up_at.isoformat()},
                        dedupe_key=f"lead_assigned:{follow_up['id']}:{assigned_to}:{follow_up_at.isoformat()}",
                    )
            except Exception:
                logger.exception("Assignment notification failed")

        db.commit()

        return {
            "success": True,
            "action": "rescheduled" if existing else "scheduled",
            "follow_up": dict(follow_up),
        }

    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Could not schedule the follow-up.",
        )


@router.delete("/custom-leads/{custom_lead_id}/follow-up")
def cancel_follow_up(
    custom_lead_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    team=Depends(get_current_team),
):
    lead = _get_accessible_lead(
        db,
        custom_lead_id,
        current_user,
        team,
    )

    result = db.execute(
        text(
            """
            UPDATE public.lead_follow_ups
            SET
                status = 'cancelled',
                updated_at = NOW()
            WHERE custom_lead_id = :custom_lead_id
              AND status IN ('scheduled', 'processing', 'reminded')
            RETURNING id
            """
        ),
        {"custom_lead_id": str(lead["id"])},
    )

    db.commit()

    return {
        "success": True,
        "cancelled": int(result.rowcount or 0),
    }


@router.patch("/custom-leads/{custom_lead_id}/follow-up/complete")
def complete_follow_up(
    custom_lead_id: UUID,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
    team=Depends(get_current_team),
):
    lead = _get_accessible_lead(
        db,
        custom_lead_id,
        current_user,
        team,
    )

    row = db.execute(
        text(
            """
            UPDATE public.lead_follow_ups
            SET
                status = 'completed',
                updated_at = NOW()
            WHERE custom_lead_id = :custom_lead_id
              AND status IN ('scheduled', 'processing', 'reminded')
            RETURNING id, status, updated_at
            """
        ),
        {"custom_lead_id": str(lead["id"])},
    ).mappings().first()

    if row is None:
        db.rollback()
        raise HTTPException(
            status_code=404,
            detail="No active follow-up found.",
        )

    db.commit()
    return {"success": True, "follow_up": dict(row)}


__all__ = ["router"]
