from sqlalchemy import Column, Text
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

    business_name = Column(Text)

    phone = Column(Text)

    website = Column(Text)

    address = Column(Text)

    search_query = Column(Text)