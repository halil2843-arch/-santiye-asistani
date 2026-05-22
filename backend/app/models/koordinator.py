import uuid
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class Koordinator(Base):
    """Birden fazla şantiyeye mesaj gönderebilen koordinatör numaraları.

    Bu numaradan gelen mesajlar içerik bazlı yönlendirmeye (LLM) tabi tutulur.
    """

    __tablename__ = "koordinatorler"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    musteri_id = Column(String(36), ForeignKey("musteriler.id", ondelete="CASCADE"), nullable=False, index=True)
    whatsapp_numara = Column(String(30), nullable=False, unique=True, index=True)
    aciklama = Column(String(200), nullable=True)
    aktif = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    musteri = relationship("Musteri")
