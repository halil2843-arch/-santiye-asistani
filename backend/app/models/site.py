import uuid
from sqlalchemy import Column, String, Boolean, DateTime, Enum, ForeignKey, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class Santiye(Base):
    __tablename__ = "santiyeler"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    musteri_id = Column(String(36), ForeignKey("musteriler.id", ondelete="CASCADE"), nullable=False, index=True)
    isim = Column(String(200), nullable=False)
    adres = Column(String(500), nullable=True)
    whatsapp_numara = Column(String(30), nullable=True, unique=True, index=True)
    aktif = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    musteri = relationship("Musteri", back_populates="santiyeler")
    sablonlar = relationship("Sablon", back_populates="santiye")
    raporlar = relationship("Rapor", back_populates="santiye", cascade="all, delete-orphan")
    mesajlar = relationship("WhatsappMesaji", back_populates="santiye", cascade="all, delete-orphan")
    ek_numaralar = relationship("SantiyeNumara", back_populates="santiye", cascade="all, delete-orphan")


class SantiyeNumara(Base):
    __tablename__ = "santiye_numaralari"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    santiye_id = Column(String(36), ForeignKey("santiyeler.id", ondelete="CASCADE"), nullable=False, index=True)
    numara = Column(String(30), nullable=False, unique=True, index=True)
    aktif = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    santiye = relationship("Santiye", back_populates="ek_numaralar")


class Sablon(Base):
    __tablename__ = "sablonlar"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    musteri_id = Column(String(36), ForeignKey("musteriler.id", ondelete="CASCADE"), nullable=False, index=True)
    santiye_id = Column(String(36), ForeignKey("santiyeler.id", ondelete="SET NULL"), nullable=True)
    isim = Column(String(200), nullable=False)
    format = Column(Enum("xlsx", "docx", name="format_enum"), nullable=False)
    dosya_yolu = Column(String(500), nullable=False)
    # {"B3": "tarih", "O8": "jcb_saat", "D8": "proje_muduru_saha_py", ...}
    alan_esleme = Column(JSON, nullable=False, default=dict)
    aktif = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    musteri = relationship("Musteri", back_populates="sablonlar")
    santiye = relationship("Santiye", back_populates="sablonlar")
    raporlar = relationship("Rapor", back_populates="sablon")
