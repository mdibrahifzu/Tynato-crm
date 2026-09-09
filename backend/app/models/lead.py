from sqlalchemy import Column, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
import uuid

from app.database import Base


class Lead(Base):

    __tablename__ = "leads"

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

    # Team that owns the lead.
    # NULL means this is still a personal lead.
    team_id = Column(
        UUID(as_uuid=True),
        ForeignKey("teams.id", ondelete="CASCADE"),
        nullable=True
    )

    # User who created/uploaded the lead.
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("profiles.id", ondelete="SET NULL"),
        nullable=True
    )

    business_name = Column(Text)
    phone = Column(Text)
    website = Column(Text)
    address = Column(Text)
    search_query = Column(Text)
    status = Column(Text, nullable=False, default="new")
    notes = Column(Text)