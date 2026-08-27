from pydantic import BaseModel, EmailStr


class TeamMemberCreate(BaseModel):
    email: EmailStr