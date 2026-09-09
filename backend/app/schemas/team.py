from pydantic import BaseModel, EmailStr, Field


class TeamCreate(BaseModel):
    name: str = Field(
        min_length=1,
        max_length=100
    )


class TeamMemberCreate(BaseModel):
    email: EmailStr