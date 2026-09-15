from pydantic import BaseModel, ConfigDict, Field, field_validator


class BusinessSettingsUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    business_name: str = Field(default="", max_length=200)
    business_address: str = Field(default="", max_length=1000)
    business_phone: str = Field(default="", max_length=50)
    business_email: str = Field(default="", max_length=320)
    terms_and_conditions: str = Field(default="", max_length=5000)

    @field_validator(
        "business_name",
        "business_address",
        "business_phone",
        "business_email",
        "terms_and_conditions",
    )
    @classmethod
    def strip_text(cls, value: str) -> str:
        return value.strip()


class BusinessSettingsResponse(BaseModel):
    id: str | None = None
    owner_id: str
    team_id: str | None = None
    business_name: str
    business_address: str
    business_phone: str
    business_email: str
    terms_and_conditions: str
    logo_url: str | None = None
    workspace_type: str
    can_edit: bool
    team_name: str | None = None
    updated_at: str | None = None