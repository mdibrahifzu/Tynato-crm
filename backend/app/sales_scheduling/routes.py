from __future__ import annotations

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.dependencies import get_current_team, get_current_user, get_db, require_team, require_sales_scheduler
from .schemas import (
    AvailabilityUpdate,
    BlockCreateRequest,
    BookingCreateRequest,
    BookingUpdateRequest,
    RescheduleBookingRequest,
    SalesSchedulingSettingsUpdate,
)
from .service import (
    book_slot,
    cancel_block,
    create_block,
    get_availability,
    get_available_slots,
    get_internal_bookings,
    get_internal_settings,
    get_my_booking,
    list_blocks,
    replace_availability,
    reschedule_booking,
    update_booking_status,
    update_internal_settings,
)


router = APIRouter(tags=["Sales Scheduling"])


# ============================================================
# CUSTOMER SIDE
# ============================================================

@router.get("/sales-call/availability")
def customer_availability(
    target_date: date = Query(..., alias="date"),
    current_user=Depends(get_current_user),
    team=Depends(require_team),
    db: Session = Depends(get_db),
):
    # current_user is intentionally retained for authenticated access.
    return get_available_slots(db, target_date)


@router.post("/sales-call/book", status_code=201)
def customer_book(
    payload: BookingCreateRequest,
    current_user=Depends(get_current_user),
    team=Depends(require_team),
    db: Session = Depends(get_db),
):
    return book_slot(
        db,
        team_id=str(team["team_id"]),
        user_id=str(current_user["id"]),
        requested_start=payload.start_at,
    )


@router.get("/sales-call/my-bookings")
def customer_my_bookings(
    target_date: date = Query(..., alias="date"),
    team=Depends(require_team),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return {
        "date": target_date.isoformat(),
        "bookings": get_my_booking(db, str(team["team_id"]), target_date),
    }


# ============================================================
# INTERNAL SALES SCHEDULER SIDE
# ============================================================

@router.get("/sales-scheduling/me")
def sales_scheduler_me(
    current_user=Depends(require_sales_scheduler),
):
    return {
        "is_sales_scheduler": True,
        "user_id": current_user["id"],
    }


@router.get("/sales-scheduling/settings")
def sales_scheduler_settings(
    current_user=Depends(require_sales_scheduler),
    db: Session = Depends(get_db),
):
    return get_internal_settings(db, str(current_user["id"]))


@router.put("/sales-scheduling/settings")
def sales_scheduler_settings_update(
    payload: SalesSchedulingSettingsUpdate,
    current_user=Depends(require_sales_scheduler),
    db: Session = Depends(get_db),
):
    return update_internal_settings(
        db,
        str(current_user["id"]),
        payload.default_slot_duration_minutes,
        payload.timezone,
    )


@router.get("/sales-scheduling/availability")
def sales_scheduler_availability(
    current_user=Depends(require_sales_scheduler),
    db: Session = Depends(get_db),
):
    return {
        "intervals": get_availability(db, str(current_user["id"]))
    }


@router.put("/sales-scheduling/availability")
def sales_scheduler_availability_update(
    payload: AvailabilityUpdate,
    current_user=Depends(require_sales_scheduler),
    db: Session = Depends(get_db),
):
    return {
        "intervals": replace_availability(
            db,
            str(current_user["id"]),
            [item.model_dump() for item in payload.intervals],
        )
    }


@router.get("/sales-scheduling/blocks")
def sales_scheduler_blocks(
    target_date: date = Query(..., alias="date"),
    current_user=Depends(require_sales_scheduler),
    db: Session = Depends(get_db),
):
    return {
        "date": target_date.isoformat(),
        "blocks": list_blocks(db, str(current_user["id"]), target_date),
    }


@router.post("/sales-scheduling/blocks", status_code=201)
def sales_scheduler_block_create(
    payload: BlockCreateRequest,
    current_user=Depends(require_sales_scheduler),
    db: Session = Depends(get_db),
):
    return create_block(
        db,
        str(current_user["id"]),
        payload.start_local,
        payload.end_local,
        payload.reason,
    )


@router.delete("/sales-scheduling/blocks/{block_id}")
def sales_scheduler_block_delete(
    block_id: UUID,
    current_user=Depends(require_sales_scheduler),
    db: Session = Depends(get_db),
):
    return cancel_block(db, str(current_user["id"]), block_id)


@router.get("/sales-scheduling/bookings")
def sales_scheduler_bookings(
    target_date: date = Query(..., alias="date"),
    current_user=Depends(require_sales_scheduler),
    db: Session = Depends(get_db),
):
    return {
        "date": target_date.isoformat(),
        "bookings": get_internal_bookings(db, target_date, str(current_user["id"])),
    }


@router.post("/sales-scheduling/bookings/{booking_id}/reschedule")
def sales_scheduler_booking_reschedule(
    booking_id: UUID,
    payload: RescheduleBookingRequest,
    current_user=Depends(require_sales_scheduler),
    db: Session = Depends(get_db),
):
    return reschedule_booking(
        db,
        str(current_user["id"]),
        booking_id,
        payload.start_local,
    )


@router.patch("/sales-scheduling/bookings/{booking_id}")
def sales_scheduler_booking_update(
    booking_id: UUID,
    payload: BookingUpdateRequest,
    current_user=Depends(require_sales_scheduler),
    db: Session = Depends(get_db),
):
    return update_booking_status(
        db,
        str(current_user["id"]),
        booking_id,
        payload.status,
    )
