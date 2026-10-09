from __future__ import annotations

from datetime import date, time, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


ALLOWED_DURATIONS = {15, 30, 45, 60}


class SalesSchedulingSettingsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    default_slot_duration_minutes: int = Field(default=30)
    timezone: str = Field(default="Asia/Kolkata", min_length=1, max_length=64)

    @field_validator("default_slot_duration_minutes")
    @classmethod
    def validate_duration(cls, value: int) -> int:
        if value not in ALLOWED_DURATIONS:
            raise ValueError("Duration must be 15, 30, 45, or 60 minutes.")
        return value


class AvailabilityInterval(BaseModel):
    model_config = ConfigDict(extra="forbid")

    day_of_week: int = Field(ge=0, le=6)
    start_time: time
    end_time: time
    slot_duration_minutes: int | None = None

    @field_validator("slot_duration_minutes")
    @classmethod
    def validate_optional_duration(cls, value: int | None) -> int | None:
        if value is not None and value not in ALLOWED_DURATIONS:
            raise ValueError("Duration must be 15, 30, 45, or 60 minutes.")
        return value

    @field_validator("end_time")
    @classmethod
    def validate_time_order(cls, value: time, info):
        start_time = info.data.get("start_time")
        if start_time is not None and value <= start_time:
            raise ValueError("end_time must be later than start_time.")
        return value


class AvailabilityUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    intervals: list[AvailabilityInterval] = Field(default_factory=list, max_length=50)


class BlockCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    start_local: str = Field(min_length=16, max_length=16)
    end_local: str = Field(min_length=16, max_length=16)
    reason: str | None = Field(default=None, max_length=500)

    @field_validator("start_local", "end_local")
    @classmethod
    def validate_local_datetime(cls, value: str) -> str:
        try:
            parsed = datetime.fromisoformat(value)
        except ValueError as exc:
            raise ValueError("Use local datetime format YYYY-MM-DDTHH:MM.") from exc

        if parsed.tzinfo is not None:
            raise ValueError("Local datetime must not include a timezone offset.")
        return value


class BookingCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    start_at: datetime

    @field_validator("start_at")
    @classmethod
    def validate_aware_start(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("start_at must include a timezone offset.")
        return value


class BookingUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["cancelled", "completed"]


class RescheduleBookingRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    start_local: str = Field(min_length=16, max_length=16)

    @field_validator("start_local")
    @classmethod
    def validate_local_datetime(cls, value: str) -> str:
        try:
            parsed = datetime.fromisoformat(value)
        except ValueError as exc:
            raise ValueError("Use local datetime format YYYY-MM-DDTHH:MM.") from exc

        if parsed.tzinfo is not None:
            raise ValueError("Local datetime must not include a timezone offset.")
        return value
