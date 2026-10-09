from __future__ import annotations

import json

from datetime import date, datetime, time, timedelta, timezone
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session


MAX_LOOKAHEAD_DAYS = 90
DEFAULT_TIMEZONE = "Asia/Kolkata"
ALLOWED_DURATIONS = {15, 30, 45, 60}


def _audit(
    db: Session,
    *,
    actor_user_id: str,
    action: str,
    target_type: str,
    target_id: str | None = None,
    before_data: dict[str, Any] | None = None,
    after_data: dict[str, Any] | None = None,
    metadata: dict[str, Any] | None = None,
) -> None:
    db.execute(
        text(
            """
            INSERT INTO public.platform_audit_logs (
                actor_user_id,
                action,
                target_type,
                target_id,
                before_data,
                after_data,
                metadata
            )
            VALUES (
                :actor_user_id,
                :action,
                :target_type,
                :target_id,
                CAST(:before_data AS jsonb),
                CAST(:after_data AS jsonb),
                CAST(:metadata AS jsonb)
            )
            """
        ),
        {
            "actor_user_id": actor_user_id,
            "action": action,
            "target_type": target_type,
            "target_id": target_id,
            "before_data": json.dumps(before_data, separators=(",", ":")) if before_data is not None else None,
            "after_data": json.dumps(after_data, separators=(",", ":")) if after_data is not None else None,
            "metadata": json.dumps(metadata, separators=(",", ":")) if metadata is not None else None,
        },
    )


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def normalize_utc(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise HTTPException(status_code=400, detail="Datetime must include a timezone offset.")
    return value.astimezone(timezone.utc)


def get_zone(timezone_name: str) -> ZoneInfo:
    try:
        return ZoneInfo(timezone_name)
    except ZoneInfoNotFoundError as exc:
        raise HTTPException(status_code=400, detail="Invalid IANA timezone.") from exc


def local_to_utc(local_value: datetime, timezone_name: str) -> datetime:
    if local_value.tzinfo is not None:
        raise HTTPException(status_code=400, detail="Local datetime must not include a timezone offset.")
    return local_value.replace(tzinfo=get_zone(timezone_name)).astimezone(timezone.utc)


def _scheduler_row(db: Session, user_id: str):
    row = db.execute(
        text(
            """
            SELECT
                s.user_id,
                s.default_slot_duration_minutes,
                s.timezone,
                s.is_active,
                p.full_name,
                p.email
            FROM public.sales_scheduler_users s
            INNER JOIN public.profiles p
                ON p.id = s.user_id
            WHERE s.user_id = :user_id
              AND s.is_active = TRUE
              AND p.is_active = TRUE
            LIMIT 1
            """
        ),
        {"user_id": user_id},
    ).mappings().first()
    if not row:
        raise HTTPException(status_code=403, detail="Sales Scheduler access required.")
    return row


def _lock_scheduler(db: Session, sales_user_id: str) -> None:
    db.execute(
        text("SELECT pg_advisory_xact_lock(hashtext(:lock_key))"),
        {"lock_key": f"tynato-sales-scheduler:{sales_user_id}"},
    )


def _lock_customer_team(db: Session, team_id: str) -> None:
    db.execute(
        text("SELECT pg_advisory_xact_lock(hashtext(:lock_key))"),
        {"lock_key": f"tynato-sales-customer-team:{team_id}"},
    )


def _validate_date_range(target_date: date) -> None:
    today = utc_now().date()
    if target_date < today:
        raise HTTPException(status_code=400, detail="The requested date is in the past.")
    if target_date > today + timedelta(days=MAX_LOOKAHEAD_DAYS):
        raise HTTPException(status_code=400, detail=f"Bookings can only be viewed up to {MAX_LOOKAHEAD_DAYS} days ahead.")


def _load_active_schedulers(db: Session):
    return db.execute(
        text(
            """
            SELECT
                s.user_id,
                s.default_slot_duration_minutes,
                s.timezone,
                p.full_name,
                p.email
            FROM public.sales_scheduler_users s
            INNER JOIN public.profiles p
                ON p.id = s.user_id
            WHERE s.is_active = TRUE
              AND p.is_active = TRUE
            ORDER BY s.user_id
            """
        )
    ).mappings().all()


def _load_day_data(db: Session, sales_user_id: str, day_start_utc: datetime, day_end_utc: datetime):
    blocks = db.execute(
        text(
            """
            SELECT id, start_at, end_at, reason, status
            FROM public.sales_availability_blocks
            WHERE sales_user_id = :sales_user_id
              AND status = 'active'
              AND start_at < :day_end
              AND end_at > :day_start
            ORDER BY start_at
            """
        ),
        {
            "sales_user_id": sales_user_id,
            "day_start": day_start_utc,
            "day_end": day_end_utc,
        },
    ).mappings().all()

    bookings = db.execute(
        text(
            """
            SELECT id, start_at, end_at, status
            FROM public.sales_call_bookings
            WHERE sales_user_id = :sales_user_id
              AND status = 'booked'
              AND start_at < :day_end
              AND end_at > :day_start
            ORDER BY start_at
            """
        ),
        {
            "sales_user_id": sales_user_id,
            "day_start": day_start_utc,
            "day_end": day_end_utc,
        },
    ).mappings().all()

    return blocks, bookings


def _overlaps(start_at: datetime, end_at: datetime, rows: list[Any]) -> bool:
    for row in rows:
        if row["start_at"] < end_at and row["end_at"] > start_at:
            return True
    return False


def _weekly_intervals(db: Session, sales_user_id: str, day_of_week: int):
    return db.execute(
        text(
            """
            SELECT
                start_time,
                end_time,
                slot_duration_minutes
            FROM public.sales_availability
            WHERE sales_user_id = :sales_user_id
              AND day_of_week = :day_of_week
              AND is_active = TRUE
            ORDER BY start_time
            """
        ),
        {
            "sales_user_id": sales_user_id,
            "day_of_week": day_of_week,
        },
    ).mappings().all()


def get_available_slots(db: Session, target_date: date) -> dict[str, Any]:
    _validate_date_range(target_date)

    schedulers = _load_active_schedulers(db)
    if not schedulers:
        return {
            "date": target_date.isoformat(),
            "timezone": DEFAULT_TIMEZONE,
            "slots": [],
        }

    slots_by_start: dict[datetime, dict[str, Any]] = {}
    now_utc = utc_now()

    for scheduler in schedulers:
        tz = get_zone(scheduler["timezone"])
        local_day_start = datetime.combine(target_date, time.min).replace(tzinfo=tz)
        local_day_end = local_day_start + timedelta(days=1)
        day_start_utc = local_day_start.astimezone(timezone.utc)
        day_end_utc = local_day_end.astimezone(timezone.utc)

        blocks, bookings = _load_day_data(
            db,
            str(scheduler["user_id"]),
            day_start_utc,
            day_end_utc,
        )

        intervals = _weekly_intervals(
            db,
            str(scheduler["user_id"]),
            target_date.weekday(),
        )

        for interval in intervals:
            duration_minutes = int(
                interval["slot_duration_minutes"]
                or scheduler["default_slot_duration_minutes"]
            )
            if duration_minutes not in ALLOWED_DURATIONS:
                continue

            cursor = datetime.combine(
                target_date,
                interval["start_time"],
                tzinfo=tz,
            )
            interval_end = datetime.combine(
                target_date,
                interval["end_time"],
                tzinfo=tz,
            )
            duration = timedelta(minutes=duration_minutes)

            while cursor + duration <= interval_end:
                slot_start_utc = cursor.astimezone(timezone.utc)
                slot_end_utc = (cursor + duration).astimezone(timezone.utc)

                if slot_start_utc > now_utc and not _overlaps(slot_start_utc, slot_end_utc, blocks) and not _overlaps(slot_start_utc, slot_end_utc, bookings):
                    existing = slots_by_start.get(slot_start_utc)
                    if existing is None or slot_end_utc < existing["end_at"]:
                        slots_by_start[slot_start_utc] = {
                            "start_at": slot_start_utc,
                            "end_at": slot_end_utc,
                        }

                cursor += duration

    ordered = sorted(slots_by_start.values(), key=lambda item: item["start_at"])

    # Customer-facing response intentionally does not expose sales-user identity.
    display_timezone = schedulers[0]["timezone"] if len({s["timezone"] for s in schedulers}) == 1 else DEFAULT_TIMEZONE
    display_zone = get_zone(display_timezone)

    return {
        "date": target_date.isoformat(),
        "timezone": display_timezone,
        "slots": [
            {
                "start_at": slot["start_at"].isoformat(),
                "end_at": slot["end_at"].isoformat(),
                "display_time": slot["start_at"].astimezone(display_zone).strftime("%I:%M %p").lstrip("0"),
            }
            for slot in ordered
        ],
    }


def _slot_is_valid_for_scheduler(
    db: Session,
    scheduler,
    requested_start_utc: datetime,
) -> tuple[bool, datetime | None]:
    tz = get_zone(scheduler["timezone"])
    requested_local = requested_start_utc.astimezone(tz)
    local_date = requested_local.date()

    intervals = _weekly_intervals(db, str(scheduler["user_id"]), local_date.weekday())

    for interval in intervals:
        duration_minutes = int(interval["slot_duration_minutes"] or scheduler["default_slot_duration_minutes"])
        duration = timedelta(minutes=duration_minutes)
        interval_start = datetime.combine(local_date, interval["start_time"], tzinfo=tz)
        interval_end = datetime.combine(local_date, interval["end_time"], tzinfo=tz)

        if requested_local < interval_start or requested_local + duration > interval_end:
            continue

        elapsed = requested_local - interval_start
        if elapsed.total_seconds() % (duration_minutes * 60) != 0:
            continue

        return True, (requested_local + duration).astimezone(timezone.utc)

    return False, None


def _has_conflict(
    db: Session,
    scheduler_id: str,
    team_id: str,
    start_at: datetime,
    end_at: datetime,
    exclude_booking_id: str | None = None,
) -> bool:
    # ------------------------------------------------------------
    # 1. Check whether the Sales Scheduler is already booked.
    #
    # Do NOT use:
    #   (:exclude_booking_id IS NULL OR ...)
    #
    # PostgreSQL cannot reliably infer the type of a NULL bind
    # parameter in that expression.
    # ------------------------------------------------------------
    if exclude_booking_id is None:
        existing_booking = db.execute(
            text(
                """
                SELECT 1
                FROM public.sales_call_bookings
                WHERE sales_user_id = :sales_user_id
                  AND status = 'booked'
                  AND start_at < :end_at
                  AND end_at > :start_at
                LIMIT 1
                """
            ),
            {
                "sales_user_id": scheduler_id,
                "start_at": start_at,
                "end_at": end_at,
            },
        ).first()
    else:
        existing_booking = db.execute(
            text(
                """
                SELECT 1
                FROM public.sales_call_bookings
                WHERE sales_user_id = :sales_user_id
                  AND status = 'booked'
                  AND start_at < :end_at
                  AND end_at > :start_at
                  AND id <> :exclude_booking_id
                LIMIT 1
                """
            ),
            {
                "sales_user_id": scheduler_id,
                "start_at": start_at,
                "end_at": end_at,
                "exclude_booking_id": exclude_booking_id,
            },
        ).first()

    if existing_booking:
        return True

    # ------------------------------------------------------------
    # 2. Check whether the requested time is blocked.
    # ------------------------------------------------------------
    existing_block = db.execute(
        text(
            """
            SELECT 1
            FROM public.sales_availability_blocks
            WHERE sales_user_id = :sales_user_id
              AND status = 'active'
              AND start_at < :end_at
              AND end_at > :start_at
            LIMIT 1
            """
        ),
        {
            "sales_user_id": scheduler_id,
            "start_at": start_at,
            "end_at": end_at,
        },
    ).first()

    if existing_block:
        return True

    # ------------------------------------------------------------
    # 3. Check whether this customer team already has a booking
    #    that overlaps this time.
    # ------------------------------------------------------------
    if exclude_booking_id is None:
        existing_team_booking = db.execute(
            text(
                """
                SELECT 1
                FROM public.sales_call_bookings
                WHERE customer_team_id = :team_id
                  AND status = 'booked'
                  AND start_at < :end_at
                  AND end_at > :start_at
                LIMIT 1
                """
            ),
            {
                "team_id": team_id,
                "start_at": start_at,
                "end_at": end_at,
            },
        ).first()
    else:
        existing_team_booking = db.execute(
            text(
                """
                SELECT 1
                FROM public.sales_call_bookings
                WHERE customer_team_id = :team_id
                  AND status = 'booked'
                  AND start_at < :end_at
                  AND end_at > :start_at
                  AND id <> :exclude_booking_id
                LIMIT 1
                """
            ),
            {
                "team_id": team_id,
                "start_at": start_at,
                "end_at": end_at,
                "exclude_booking_id": exclude_booking_id,
            },
        ).first()

    return existing_team_booking is not None

def book_slot(db: Session, team_id: str, user_id: str, requested_start: datetime) -> dict[str, Any]:
    requested_start_utc = normalize_utc(requested_start)
    now = utc_now()
    if requested_start_utc <= now:
        raise HTTPException(status_code=400, detail="Cannot book a slot in the past.")

    if requested_start_utc.date() > now.date() + timedelta(days=MAX_LOOKAHEAD_DAYS):
        raise HTTPException(status_code=400, detail=f"Bookings can only be made up to {MAX_LOOKAHEAD_DAYS} days ahead.")

    try:
        # SQLAlchemy Session may already have an open transaction because
        # authentication/team dependencies queried the database before this
        # service was called. Do not call db.begin() here; use the existing
        # transaction so the advisory locks remain held until commit.
        _lock_customer_team(db, team_id)
        schedulers = _load_active_schedulers(db)

        for scheduler in schedulers:
            scheduler_id = str(scheduler["user_id"])
            _lock_scheduler(db, scheduler_id)

            valid, end_at = _slot_is_valid_for_scheduler(
                db,
                scheduler,
                requested_start_utc,
            )
            if not valid or end_at is None:
                continue

            if _has_conflict(
                db,
                scheduler_id,
                team_id,
                requested_start_utc,
                end_at,
            ):
                continue

            booking = db.execute(
                text(
                    """
                    INSERT INTO public.sales_call_bookings (
                        sales_user_id,
                        customer_team_id,
                        start_at,
                        end_at,
                        status,
                        booked_by_user_id,
                        created_at,
                        updated_at
                    )
                    VALUES (
                        :sales_user_id,
                        :customer_team_id,
                        :start_at,
                        :end_at,
                        'booked',
                        :booked_by_user_id,
                        NOW(),
                        NOW()
                    )
                    RETURNING id, start_at, end_at, status, created_at
                    """
                ),
                {
                    "sales_user_id": scheduler_id,
                    "customer_team_id": team_id,
                    "start_at": requested_start_utc,
                    "end_at": end_at,
                    "booked_by_user_id": user_id,
                },
            ).mappings().one()

            _audit(
                db,
                actor_user_id=user_id,
                action="sales_call.booked",
                target_type="sales_call_booking",
                target_id=str(booking["id"]),
                after_data={
                    "sales_user_id": scheduler_id,
                    "customer_team_id": team_id,
                    "start_at": booking["start_at"].isoformat(),
                    "end_at": booking["end_at"].isoformat(),
                    "status": booking["status"],
                },
            )

            # Commit the transaction that was already opened by dependency
            # queries. This releases the advisory locks atomically with the
            # booking so another request cannot book the same slot meanwhile.
            db.commit()

            return {
                "id": booking["id"],
                "start_at": booking["start_at"],
                "end_at": booking["end_at"],
                "status": booking["status"],
                "created_at": booking["created_at"],
            }
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="This slot is no longer available.") from exc
    except Exception:
        db.rollback()
        raise

    db.rollback()
    raise HTTPException(status_code=409, detail="This slot is no longer available.")


def get_my_booking(db: Session, team_id: str, target_date: date):
    _validate_date_range(target_date)

    rows = db.execute(
        text(
            """
            SELECT
                b.id,
                b.start_at,
                b.end_at,
                b.status,
                b.created_at
            FROM public.sales_call_bookings b
            INNER JOIN public.sales_scheduler_users s
                ON s.user_id = b.sales_user_id
            WHERE b.customer_team_id = :team_id
              AND b.status = 'booked'
              AND (
                  b.start_at AT TIME ZONE s.timezone
              )::date = :target_date
            ORDER BY b.start_at
            """
        ),
        {
            "team_id": team_id,
            "target_date": target_date,
        },
    ).mappings().all()

    return [dict(row) for row in rows]

def get_internal_bookings(db: Session, target_date: date, viewer_user_id: str):
    scheduler = _scheduler_row(db, viewer_user_id)
    _validate_date_range(target_date)
    tz = get_zone(scheduler["timezone"])
    day_start = datetime.combine(target_date, time.min, tzinfo=tz).astimezone(timezone.utc)
    day_end = day_start + timedelta(days=1)

    rows = db.execute(
        text(
            """
            SELECT
                b.id,
                b.sales_user_id,
                sp.full_name AS sales_user_name,
                b.customer_team_id,
                t.name AS customer_team_name,
                b.start_at,
                b.end_at,
                b.status
            FROM public.sales_call_bookings b
            INNER JOIN public.profiles sp
                ON sp.id = b.sales_user_id
            INNER JOIN public.teams t
                ON t.id = b.customer_team_id
            WHERE b.status = 'booked'
              AND b.start_at < :day_end
              AND b.end_at > :day_start
            ORDER BY b.start_at, sp.full_name
            LIMIT 500
            """
        ),
        {
            "day_start": day_start,
            "day_end": day_end,
        },
    ).mappings().all()

    return [dict(row) for row in rows]


def get_internal_settings(db: Session, user_id: str):
    row = _scheduler_row(db, user_id)
    return {
        "user_id": row["user_id"],
        "full_name": row["full_name"],
        "email": row["email"],
        "default_slot_duration_minutes": row["default_slot_duration_minutes"],
        "timezone": row["timezone"],
    }


def update_internal_settings(db: Session, user_id: str, duration_minutes: int, timezone_name: str):
    scheduler = _scheduler_row(db, user_id)
    get_zone(timezone_name)

    try:
        _lock_scheduler(db, user_id)
        row = db.execute(
            text(
                """
                UPDATE public.sales_scheduler_users
                SET default_slot_duration_minutes = :duration_minutes,
                    timezone = :timezone,
                    updated_at = NOW()
                WHERE user_id = :user_id
                  AND is_active = TRUE
                RETURNING user_id, default_slot_duration_minutes, timezone
                """
            ),
            {
                "user_id": user_id,
                "duration_minutes": duration_minutes,
                "timezone": timezone_name,
            },
        ).mappings().one()
        _audit(
            db,
            actor_user_id=user_id,
            action="sales_scheduling.settings_updated",
            target_type="sales_scheduler_user",
            target_id=user_id,
            after_data={
                "default_slot_duration_minutes": row["default_slot_duration_minutes"],
                "timezone": row["timezone"],
            },
        )
        db.commit()
    except Exception:
        db.rollback()
        raise

    return dict(row)


def get_availability(db: Session, user_id: str):
    _scheduler_row(db, user_id)
    rows = db.execute(
        text(
            """
            SELECT id, day_of_week, start_time, end_time, slot_duration_minutes, is_active
            FROM public.sales_availability
            WHERE sales_user_id = :user_id
              AND is_active = TRUE
            ORDER BY day_of_week, start_time
            """
        ),
        {"user_id": user_id},
    ).mappings().all()
    return [dict(row) for row in rows]


def replace_availability(db: Session, user_id: str, intervals: list[dict[str, Any]]):
    _scheduler_row(db, user_id)

    normalized = sorted(
        intervals,
        key=lambda item: (item["day_of_week"], item["start_time"]),
    )

    previous_by_day: dict[int, dict[str, Any]] = {}
    for item in normalized:
        day = int(item["day_of_week"])
        start = item["start_time"]
        previous = previous_by_day.get(day)
        if previous and start < previous["end_time"]:
            db.rollback()
            raise HTTPException(
                status_code=400,
                detail="Availability intervals cannot overlap on the same day.",
            )
        previous_by_day[day] = item

    try:
        _lock_scheduler(db, user_id)
        db.execute(
            text(
                """
                DELETE FROM public.sales_availability
                WHERE sales_user_id = :user_id
                """
            ),
            {"user_id": user_id},
        )

        for item in normalized:
            db.execute(
                text(
                    """
                    INSERT INTO public.sales_availability (
                        sales_user_id,
                        day_of_week,
                        start_time,
                        end_time,
                        slot_duration_minutes,
                        is_active,
                        created_at,
                        updated_at
                    )
                    VALUES (
                        :sales_user_id,
                        :day_of_week,
                        :start_time,
                        :end_time,
                        :slot_duration_minutes,
                        TRUE,
                        NOW(),
                        NOW()
                    )
                    """
                ),
                {
                    "sales_user_id": user_id,
                    "day_of_week": item["day_of_week"],
                    "start_time": item["start_time"],
                    "end_time": item["end_time"],
                    "slot_duration_minutes": item.get("slot_duration_minutes"),
                },
            )
        _audit(
            db,
            actor_user_id=user_id,
            action="sales_scheduling.availability_replaced",
            target_type="sales_availability",
            target_id=user_id,
            after_data={"interval_count": len(normalized)},
        )
        db.commit()
    except Exception:
        db.rollback()
        raise

    return get_availability(db, user_id)


def create_block(db: Session, user_id: str, start_local: str, end_local: str, reason: str | None):
    scheduler = _scheduler_row(db, user_id)
    try:
        start_naive = datetime.fromisoformat(start_local)
        end_naive = datetime.fromisoformat(end_local)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail="Use local datetime format YYYY-MM-DDTHH:MM.") from exc

    start_at = local_to_utc(start_naive, scheduler["timezone"])
    end_at = local_to_utc(end_naive, scheduler["timezone"])
    now = utc_now()

    if end_at <= start_at:
        db.rollback()
        raise HTTPException(status_code=400, detail="Block end must be later than block start.")
    if end_at <= now:
        db.rollback()
        raise HTTPException(status_code=400, detail="Cannot create a block entirely in the past.")

    try:
        _lock_scheduler(db, user_id)

        booking_conflict = db.execute(
            text(
                """
                SELECT 1
                FROM public.sales_call_bookings
                WHERE sales_user_id = :user_id
                  AND status = 'booked'
                  AND start_at < :end_at
                  AND end_at > :start_at
                LIMIT 1
                """
            ),
            {
                "user_id": user_id,
                "start_at": start_at,
                "end_at": end_at,
            },
        ).first()

        if booking_conflict:
            db.rollback()
            raise HTTPException(status_code=409, detail="Cannot block a period that already has a booked sales call.")

        row = db.execute(
            text(
                """
                INSERT INTO public.sales_availability_blocks (
                    sales_user_id,
                    start_at,
                    end_at,
                    reason,
                    status,
                    created_at,
                    updated_at
                )
                VALUES (
                    :user_id,
                    :start_at,
                    :end_at,
                    :reason,
                    'active',
                    NOW(),
                    NOW()
                )
                RETURNING id, start_at, end_at, reason, status, created_at
                """
            ),
            {
                "user_id": user_id,
                "start_at": start_at,
                "end_at": end_at,
                "reason": reason,
            },
        ).mappings().one()
        _audit(
            db,
            actor_user_id=user_id,
            action="sales_scheduling.block_created",
            target_type="sales_availability_block",
            target_id=str(row["id"]),
            after_data={
                "start_at": row["start_at"].isoformat(),
                "end_at": row["end_at"].isoformat(),
                "status": row["status"],
            },
        )
        db.commit()
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        raise

    return dict(row)


def list_blocks(db: Session, user_id: str, target_date: date):
    scheduler = _scheduler_row(db, user_id)
    _validate_date_range(target_date)
    tz = get_zone(scheduler["timezone"])
    day_start = datetime.combine(target_date, time.min, tzinfo=tz).astimezone(timezone.utc)
    day_end = day_start + timedelta(days=1)

    rows = db.execute(
        text(
            """
            SELECT id, start_at, end_at, reason, status, created_at
            FROM public.sales_availability_blocks
            WHERE sales_user_id = :user_id
              AND start_at < :day_end
              AND end_at > :day_start
            ORDER BY start_at
            """
        ),
        {
            "user_id": user_id,
            "day_start": day_start,
            "day_end": day_end,
        },
    ).mappings().all()
    return [dict(row) for row in rows]


def cancel_block(db: Session, user_id: str, block_id: UUID):
    _scheduler_row(db, user_id)
    try:
        _lock_scheduler(db, user_id)
        row = db.execute(
            text(
                """
                UPDATE public.sales_availability_blocks
                SET status = 'cancelled',
                    updated_at = NOW()
                WHERE id = :block_id
                  AND sales_user_id = :user_id
                  AND status = 'active'
                RETURNING id, status
                """
            ),
            {
                "block_id": block_id,
                "user_id": user_id,
            },
        ).mappings().first()
        if not row:
            db.rollback()
            raise HTTPException(status_code=404, detail="Block not found.")
        _audit(
            db,
            actor_user_id=user_id,
            action="sales_scheduling.block_cancelled",
            target_type="sales_availability_block",
            target_id=str(row["id"]),
            after_data={"status": row["status"]},
        )
        db.commit()
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        raise
    return dict(row)


def reschedule_booking(db: Session, user_id: str, booking_id: UUID, requested_start_local: str):
    scheduler = _scheduler_row(db, user_id)
    try:
        requested_naive = datetime.fromisoformat(requested_start_local)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Use local datetime format YYYY-MM-DDTHH:MM.") from exc

    if requested_naive.tzinfo is not None:
        raise HTTPException(status_code=400, detail="Local datetime must not include a timezone offset.")

    requested_start_utc = local_to_utc(requested_naive, scheduler["timezone"])
    now = utc_now()
    if requested_start_utc <= now:
        raise HTTPException(status_code=400, detail="Cannot reschedule to the past.")
    if requested_start_utc.date() > now.date() + timedelta(days=MAX_LOOKAHEAD_DAYS):
        raise HTTPException(status_code=400, detail=f"Bookings can only be scheduled up to {MAX_LOOKAHEAD_DAYS} days ahead.")

    try:
        _lock_scheduler(db, user_id)
        current = db.execute(
            text(
                """
                SELECT id, customer_team_id, start_at, end_at, status
                FROM public.sales_call_bookings
                WHERE id = :booking_id
                  AND sales_user_id = :user_id
                LIMIT 1
                FOR UPDATE
                """
            ),
            {"booking_id": booking_id, "user_id": user_id},
        ).mappings().first()

        if not current or current["status"] != "booked":
            db.rollback()
            raise HTTPException(status_code=404, detail="Active booking not found.")

        _lock_customer_team(db, str(current["customer_team_id"]))

        valid, new_end = _slot_is_valid_for_scheduler(
            db,
            scheduler,
            requested_start_utc,
        )
        if not valid or new_end is None:
            db.rollback()
            raise HTTPException(status_code=409, detail="The selected time is outside the current sales availability.")

        if _has_conflict(
            db,
            user_id,
            str(current["customer_team_id"]),
            requested_start_utc,
            new_end,
            exclude_booking_id=str(booking_id),
        ):
            db.rollback()
            raise HTTPException(status_code=409, detail="The selected time is no longer available.")

        updated = db.execute(
            text(
                """
                UPDATE public.sales_call_bookings
                SET start_at = :start_at,
                    end_at = :end_at,
                    updated_at = NOW()
                WHERE id = :booking_id
                  AND sales_user_id = :user_id
                  AND status = 'booked'
                RETURNING id, start_at, end_at, status, updated_at
                """
            ),
            {
                "booking_id": booking_id,
                "user_id": user_id,
                "start_at": requested_start_utc,
                "end_at": new_end,
            },
        ).mappings().one()

        _audit(
            db,
            actor_user_id=user_id,
            action="sales_call.rescheduled",
            target_type="sales_call_booking",
            target_id=str(booking_id),
            after_data={
                "start_at": updated["start_at"].isoformat(),
                "end_at": updated["end_at"].isoformat(),
                "status": updated["status"],
            },
        )
        db.commit()
    except HTTPException:
        raise
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="The selected time is no longer available.") from exc
    except Exception:
        db.rollback()
        raise

    return dict(updated)


def update_booking_status(db: Session, user_id: str, booking_id: UUID, status: str):
    _scheduler_row(db, user_id)
    try:
        row = db.execute(
            text(
                """
                SELECT sales_user_id
                FROM public.sales_call_bookings
                WHERE id = :booking_id
                LIMIT 1
                """
            ),
            {"booking_id": booking_id},
        ).mappings().first()
        if not row or str(row["sales_user_id"]) != str(user_id):
            db.rollback()
            raise HTTPException(status_code=404, detail="Booking not found.")

        _lock_scheduler(db, user_id)
        updated = db.execute(
            text(
                """
                UPDATE public.sales_call_bookings
                SET status = :status,
                    updated_at = NOW()
                WHERE id = :booking_id
                  AND sales_user_id = :user_id
                  AND status = 'booked'
                RETURNING id, start_at, end_at, status, updated_at
                """
            ),
            {
                "booking_id": booking_id,
                "user_id": user_id,
                "status": status,
            },
        ).mappings().first()
        if not updated:
            db.rollback()
            raise HTTPException(status_code=409, detail="Booking is no longer active.")
        _audit(
            db,
            actor_user_id=user_id,
            action=f"sales_call.{status}",
            target_type="sales_call_booking",
            target_id=str(updated["id"]),
            after_data={"status": updated["status"]},
        )
        db.commit()
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        raise

    return dict(updated)

