from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class OAuthCompleteRequest(BaseModel):
    code: str = Field(min_length=1)
    state: str = Field(min_length=1)


class OAuthStartResponse(BaseModel):
    auth_url: str


class MetaConnectionOut(BaseModel):
    id: UUID
    team_id: UUID
    meta_user_id: str
    granted_scopes: List[str]
    status: str
    api_version: str
    token_expires_at: Optional[datetime] = None
    last_validated_at: Optional[datetime] = None
    last_successful_sync_at: Optional[datetime] = None
    connected_at: datetime


class MetaAssetSummary(BaseModel):
    businesses: int
    pages: int
    ad_accounts: int


class MetaHealthOut(BaseModel):
    enabled: bool
    connections: int
    active_connections: int


class MetaAdAccountOut(BaseModel):
    id: UUID
    meta_ad_account_id: str
    name: str
    account_status: Optional[int] = None
    currency: Optional[str] = None
    timezone_name: Optional[str] = None
    is_selected: bool
    status: str
    last_seen_at: Optional[datetime] = None


class MetaCampaignOut(BaseModel):
    id: UUID
    ad_account_row_id: UUID
    ad_account_name: str
    meta_campaign_id: str
    name: str
    status: Optional[str] = None
    objective: Optional[str] = None
    start_time: Optional[datetime] = None
    stop_time: Optional[datetime] = None
    daily_budget: Optional[Decimal] = None
    lifetime_budget: Optional[Decimal] = None
    last_seen_at: Optional[datetime] = None
    updated_at: datetime


class MetaCampaignSyncRequest(BaseModel):
    ad_account_row_id: Optional[UUID] = None


class MetaCampaignSyncResponse(BaseModel):
    success: bool
    job_id: UUID
    status: str


class MetaJobOut(BaseModel):
    id: UUID
    queue: str
    job_type: str
    team_id: UUID
    connection_id: UUID
    status: str
    attempts: int
    run_after: datetime
    locked_until: Optional[datetime] = None
    last_error: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
    payload: Optional[Dict[str, Any]] = None
