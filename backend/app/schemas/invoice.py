from datetime import date
from decimal import Decimal
from uuid import UUID
from typing import List, Optional

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
)


class InvoiceItem(BaseModel):
    name: str = Field(
        min_length=1,
        max_length=500,
    )

    quantity: Decimal = Field(
        gt=0,
    )

    unit_cost: Decimal = Field(
        ge=0,
    )

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = value.strip()

        if not value:
            raise ValueError(
                "Item name cannot be empty."
            )

        return value


class InvoiceRequest(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True
    )

    lead_id: UUID

    from_address: str = Field(
        min_length=1,
        max_length=2000,
        alias="from",
    )

    to_address: str = Field(
        min_length=1,
        max_length=2000,
        alias="to",
    )

    number: str = Field(
        min_length=1,
        max_length=100,
    )

    currency: str = Field(
        default="INR",
        min_length=3,
        max_length=3,
    )

    invoice_date: Optional[date] = Field(
        default=None,
        alias="date",
    )

    due_date: Optional[date] = None

    items: List[InvoiceItem] = Field(
        min_length=1,
        max_length=100,
    )

    notes: Optional[str] = Field(
        default=None,
        max_length=5000,
    )

    @field_validator("currency")
    @classmethod
    def normalize_currency(
        cls,
        value: str,
    ) -> str:
        return value.strip().upper()