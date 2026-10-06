from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ModuleUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    is_enabled: bool


class OrganizationStatusRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: Literal["active", "suspended"]


class SuperAdminUserStatusRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    is_active: bool