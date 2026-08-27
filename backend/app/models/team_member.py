from sqlalchemy import Column, Text, ForeignKey, TIMESTAMP, func
from sqlalchemy.dialects.postgresql import UUID
import uuid

from app.database import Base


class TeamMember(Base):

    __tablename__ = "team_members"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    owner_id = Column(
        UUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=False
    )

    member_email = Column(Text, nullable=False)

    member_id = Column(
        UUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="SET NULL"),
        nullable=True
    )

    status = Column(Text, nullable=False, default="pending")

    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())