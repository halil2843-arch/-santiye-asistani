import uuid
from sqlalchemy import Column, String, Boolean, DateTime, Date, Enum, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class Rapor(Base):
    __tablename__ = "raporlar"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    santiye_id = Column(String(36), ForeignKey("santiyeler.id", ondelete="CASCADE"), nullable=False, index=True)
    sablon_id = Column(String(36), ForeignKey("sablonlar.id", ondelete="SET NULL"), nullable=True)
    olusturan_id = Column(String(36), ForeignKey("kullanicilar.id", ondelete="SET NULL"), nullable=True)
    tarih = Column(Date, nullable=False, index=True)
    durum = Column(Enum("taslak", "onaylandi", "iptal", name="durum_enum"), default="taslak")
    cikti_dosya_yolu = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    santiye = relationship("Santiye", back_populates="raporlar")
    sablon = relationship("Sablon", back_populates="raporlar")
    olusturan = relationship("Kullanici", back_populates="raporlar")
    mesajlar = relationship("WhatsappMesaji", back_populates="rapor")
    cikarilanlar = relationship("Cikarilan", back_populates="rapor", cascade="all, delete-orphan")
