from __future__ import annotations
 
import json
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
 
from sqlalchemy import text
 
logger = logging.getLogger(__name__)
 
IST = timezone(timedelta(hours=5, minutes=30))
REMINDER_OFFSET_MINUTES = 15
WORK_START_HOUR = 10
WORK_END_HOUR = 18
 

ACTION_DELAY_HOURS = {
    "CALL": 24,
    "FOLLOW_UP": 24,
    "SCHEDULE_MEETING": 24,
    "DEMO": 24,
    "SEND_PROPOSAL": 4,
    "REQUEST_INFORMATION": 48,
    "HANDLE_OBJECTION": 48,
    "NEGOTIATE": 48,
    "NURTURE": 72,
}
 
CLOSED_STATUSES = {"converted", "not_interested", "junk"}
 
 
def compute_follow_up_at(
    action: str,
    now: Optional[datetime] = None,
) -> Optional[datetime]:
    hours = ACTION_DELAY_HOURS.get(action)
    if hours is None:
        return None
 
    now = now or datetime.now(timezone.utc)
    due = (now + timedelta(hours=hours)).astimezone(IST)
 
    # Keep reminders inside working hours (IST).
    if due.hour < WORK_START_HOUR:
        due = due.replace(
            hour=WORK_START_HOUR, minute=0, second=0, microsecond=0
        )
    elif due.hour >= WORK_END_HOUR:
        due = (due + timedelta(days=1)).replace(
            hour=WORK_START_HOUR, minute=0, second=0, microsecond=0
        )
 
    return due.astimezone(timezone.utc)
 
 
_WEEKDAYS = {
    "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
    "friday": 4, "saturday": 5, "sunday": 6,
}
_NUMBER_WORDS = {
    "a": 1, "one": 1, "two": 2, "three": 3, "four": 4,
    "five": 5, "six": 6, "seven": 7,
}
_MERIDIEM_RE = re.compile(
    r"(?<!\d)(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s?m\b", re.IGNORECASE
)
_CLOCK_RE = re.compile(r"(?<!\d)([01]?\d|2[0-3]):([0-5]\d)(?!\d)")
 
 
def _parse_time(text_value: str):
    match = _MERIDIEM_RE.search(text_value)
    if match:
        hour = int(match.group(1))
        minute = int(match.group(2) or 0)
        if not 1 <= hour <= 12:
            return None
        pm = match.group(3).lower() == "p"
        if pm and hour != 12:
            hour += 12
        if not pm and hour == 12:
            hour = 0
        return hour, minute
 
    match = _CLOCK_RE.search(text_value)
    if match:
        hour, minute = int(match.group(1)), int(match.group(2))
        # "at 4:30" with no AM/PM: assume afternoon for 1-7.
        if 1 <= hour <= 7:
            hour += 12
        return hour, minute
 
    if "noon" in text_value:
        return 12, 0
    if "morning" in text_value:
        return 10, 0
    if "afternoon" in text_value:
        return 14, 0
    if "evening" in text_value:
        return 17, 0
    return None
 
 
def _parse_day_offset(text_value: str, anchor: datetime):
    if "day after tomorrow" in text_value:
        return 2
    if "tomorrow" in text_value or "next day" in text_value:
        return 1
    if re.search(r"\btoday\b|\bthis (morning|afternoon|evening)\b", text_value):
        return 0
 
    match = re.search(r"\bin (\d+|a|one|two|three|four|five|six|seven) days?\b", text_value)
    if match:
        raw = match.group(1)
        return int(raw) if raw.isdigit() else _NUMBER_WORDS[raw]
 
    if "next week" in text_value:
        return 7
 
    for name, index in _WEEKDAYS.items():
        if re.search(r"\b{}\b".format(name), text_value):
            return ((index - anchor.weekday() - 1) % 7) + 1
 
    return None
 
 
def parse_follow_up_text(
    value: Any,
    anchor: datetime,
) -> Optional[datetime]:
    """Read 'tomorrow after 1:00 PM' style text. Returns UTC or None."""
    if not isinstance(value, str) or not value.strip():
        return None
 
    text_value = value.lower()
    anchor_ist = anchor.astimezone(IST)
 
    offset = _parse_day_offset(text_value, anchor_ist)
    clock = _parse_time(text_value)
 
    if offset is None and clock is None:
        return None
 
    hour, minute = clock if clock else (WORK_START_HOUR, 0)
 
    due = (anchor_ist + timedelta(days=offset or 0)).replace(
        hour=hour, minute=minute, second=0, microsecond=0
    )
 
    # Time given without a day: next occurrence.
    if offset is None and due <= anchor_ist:
        due += timedelta(days=1)
 
    return due.astimezone(timezone.utc)
 
 
 
def schedule_ai_follow_up(
    db,
    audio_id,
    analysis: Dict[str, Any],
) -> str:
    """Create a follow-up reminder from the AI evaluation. Caller commits."""
    strategy = analysis.get("conversion_strategy") or {}
    action = str(strategy.get("recommended_action") or "").upper()
 
    row = db.execute(
        text(
            """
            SELECT
                cl.id,
                cl.team_id,
                cl.owner_id,
                cl.status,
                af.owner_id AS caller_id,
                af.created_at AS call_at
            FROM public.audio_files af
            JOIN public.custom_leads cl
              ON cl.id = af.custom_lead_id
            WHERE af.id = :audio_id
            FOR UPDATE OF cl
            """
        ),
        {"audio_id": str(audio_id)},
    ).mappings().first()
 
    if not row:
        return "skipped: audio is not linked to a lead"
 
    # 1) A time spoken on the call (audio_summaries.follow_up) wins.
    items = db.execute(
        text(
            "SELECT follow_up FROM public.audio_summaries "
            "WHERE audio_id = :audio_id"
        ),
        {"audio_id": str(audio_id)},
    ).scalar()
 
    if isinstance(items, str):
        try:
            items = json.loads(items)
        except ValueError:
            items = [items]
 
    now = datetime.now(timezone.utc)
    follow_up_at = None
    source = "action"
 
    if action != "DISQUALIFY":
        for item in items if isinstance(items, list) else []:
            parsed = parse_follow_up_text(item, row["call_at"] or now)
            if parsed and parsed > now + timedelta(minutes=5):
                follow_up_at = parsed
                source = "call"
                break
 
    # 2) Otherwise the AI's recommended action decides the delay.
    if follow_up_at is None:
        follow_up_at = compute_follow_up_at(action)
 
    if follow_up_at is None:
        return "skipped: action {}".format(action or "none")
 
    if str(row["status"] or "").lower() in CLOSED_STATUSES:
        return "skipped: lead is closed"
 
    active = db.execute(
        text(
            """
            SELECT 1
            FROM public.lead_follow_ups
            WHERE custom_lead_id = :lead_id
              AND status IN ('scheduled', 'processing', 'reminded')
            LIMIT 1
            """
        ),
        {"lead_id": str(row["id"])},
    ).first()
 
    if active:
        return "skipped: lead already has an active follow-up"
 
    # The person who made the call follows up; fall back to the lead owner.
    assignee = row["caller_id"] or row["owner_id"]
 
    if row["team_id"] is not None and assignee != row["owner_id"]:
        is_member = db.execute(
            text(
                """
                SELECT 1
                FROM public.team_members
                WHERE team_id = :team_id
                  AND member_id = :user_id
                  AND status = 'active'
                LIMIT 1
                """
            ),
            {"team_id": row["team_id"], "user_id": assignee},
        ).first()
        if not is_member:
            assignee = row["owner_id"]
 
    db.execute(
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
                :lead_id,
                :team_id,
                :assigned_to,
                :follow_up_at,
                :offset,
                :remind_at,
                'scheduled'
            )
            """
        ),
        {
            "lead_id": row["id"],
            "team_id": row["team_id"],
            "assigned_to": assignee,
            "follow_up_at": follow_up_at,
            "offset": REMINDER_OFFSET_MINUTES,
            "remind_at": follow_up_at
            - timedelta(minutes=REMINDER_OFFSET_MINUTES),
        },
    )
 
    if str(row["status"] or "").lower() in {"new", "interested"}:
        db.execute(
            text(
                """
                UPDATE public.custom_leads
                SET status = 'follow_up', updated_at = NOW()
                WHERE id = :lead_id
                """
            ),
            {"lead_id": row["id"]},
        )
 
    return "scheduled ({}) {} for {}".format(source, action, follow_up_at.isoformat())
 