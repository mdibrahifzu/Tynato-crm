from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class AudioSummary(BaseModel):
    transcript: str = Field(default="", max_length=200_000)
    summary: str = Field(min_length=1, max_length=20_000)
    key_points: List[str] = Field(default_factory=list, max_length=50)
    action_items: List[str] = Field(default_factory=list, max_length=50)
    decisions: List[str] = Field(default_factory=list, max_length=50)
    follow_up: List[str] = Field(default_factory=list, max_length=50)

    @field_validator("key_points", "action_items", "decisions", "follow_up")
    @classmethod
    def clean_lists(cls, value: List[str]) -> List[str]:
        return [item.strip() for item in value if isinstance(item, str) and item.strip()][:50]


class AudioRecord(BaseModel):
    id: UUID
    owner_id: UUID
    team_id: Optional[UUID] = None
    original_filename: str
    mime_type: str
    file_size: int
    status: str
    processing_attempts: int
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    transcript: Optional[str] = None
    summary: Optional[str] = None
    key_points: Optional[list[str]] = None
    action_items: Optional[list[str]] = None
    decisions: Optional[list[str]] = None
    follow_up: Optional[list[str]] = None


class AudioUploadResponse(BaseModel):
    audio_id: UUID
    status: str
    message: str
