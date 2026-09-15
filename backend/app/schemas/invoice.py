from datetime import date
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    model_validator,
)


class InvoiceItem(BaseModel):
    name: str = Field(min_length=1, max_length=500)
    quantity: Decimal = Field(gt=0)
    unit_cost: Decimal = Field(ge=0)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = value.strip()

        if not value:
            raise ValueError("Item name cannot be empty.")

        return value


class InvoiceRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    # Lead source
    lead_id: Optional[UUID] = None
    custom_lead_id: Optional[UUID] = None

    # Business
    from_address: Optional[str] = Field(
        default=None,
        max_length=2000,
        alias="from",
    )
    business_name: Optional[str] = Field(
        default=None,
        max_length=500,
    )
    business_address: Optional[str] = Field(
        default=None,
        max_length=1500,
    )
    business_phone: Optional[str] = Field(
        default=None,
        max_length=100,
    )
    business_email: Optional[str] = Field(
        default=None,
        max_length=320,
    )
    logo_url: Optional[str] = Field(
        default=None,
        max_length=4000,
    )

    # Customer
    customer_name: Optional[str] = Field(
        default=None,
        max_length=500,
    )
    company_name: Optional[str] = Field(
        default=None,
        max_length=500,
    )
    customer_phone: Optional[str] = Field(
        default=None,
        max_length=100,
    )
    customer_email: Optional[str] = Field(
        default=None,
        max_length=320,
    )
    billing_address: Optional[str] = Field(
        default=None,
        max_length=1500,
    )
    to_address: Optional[str] = Field(
        default=None,
        max_length=2000,
        alias="to",
    )

    # Invoice
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

    payment_terms: Optional[str] = Field(
        default=None,
        max_length=1000,
    )
    purchase_order: Optional[str] = Field(
        default=None,
        max_length=200,
    )

    # Items
    items: List[InvoiceItem] = Field(
        min_length=1,
        max_length=100,
    )

    # Tax
    tax_title: Optional[str] = Field(
        default=None,
        max_length=100,
    )
    tax_percent: Optional[Decimal] = Field(
        default=None,
        ge=0,
        le=100,
    )

    # Additional
    notes: Optional[str] = Field(
        default=None,
        max_length=5000,
    )
    terms: Optional[str] = Field(
        default=None,
        max_length=5000,
    )

    @field_validator(
        "from_address",
        "business_name",
        "business_address",
        "business_phone",
        "business_email",
        "logo_url",
        "customer_name",
        "company_name",
        "customer_phone",
        "customer_email",
        "billing_address",
        "to_address",
        "payment_terms",
        "purchase_order",
        "tax_title",
        "notes",
        "terms",
    )
    @classmethod
    def strip_optional_strings(cls, value):
        if value is None:
            return None

        value = value.strip()

        return value or None

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        value = value.strip().upper()

        if not value.isalpha() or len(value) != 3:
            raise ValueError(
                "Currency must be a valid 3-letter code."
            )

        return value

    @model_validator(mode="after")
    def validate_dates_and_tax(self):
        if self.lead_id and self.custom_lead_id:
            raise ValueError(
                "An invoice cannot reference both a lead and a custom lead."
            )

        if (
            self.invoice_date
            and self.due_date
            and self.due_date < self.invoice_date
        ):
            raise ValueError(
                "Due date cannot be before invoice date."
            )

        if (
            self.tax_percent is not None
            and self.tax_percent <= 0
        ):
            self.tax_percent = None
            self.tax_title = None

        elif (
            self.tax_percent is not None
            and not self.tax_title
        ):
            self.tax_title = "GST"

        elif self.tax_percent is None:
            self.tax_title = None

        return self