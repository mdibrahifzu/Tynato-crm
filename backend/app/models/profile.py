from sqlalchemy import Column, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base

class Profile(Base):

    __tablename__ = "profiles"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True
    )

    email = Column(Text)
    role = Column(Text)
    is_active = Column(Boolean)
    subscription_tier = Column(Text)