from sqlalchemy import Column, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
import uuid

from app.models.profile import Profile
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

    business_name = Column(Text)
    phone = Column(Text)
    website = Column(Text)
    address = Column(Text)
    search_query = Column(Text)
    status = Column(Text, nullable=False, default="new")
    notes = Column(Text)