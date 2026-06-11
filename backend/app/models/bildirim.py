"""Push subscription modeli — Web Push / PWA abonelikleri."""

import uuid

from sqlalchemy import Column, String, Text

from app.core.database import Base


class PushSubscription(Base):
    __tablename__ = "push_subscriptions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    musteri_id = Column(String(36), nullable=False, index=True)
    endpoint = Column(Text, nullable=False)
    p256dh = Column(Text, nullable=False)
    auth = Column(Text, nullable=False)
    created_at = Column(String(50), nullable=True)
