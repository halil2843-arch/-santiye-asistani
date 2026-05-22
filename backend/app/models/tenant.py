import uuid
from sqlalchemy import Column, String, Boolean, DateTime, Enum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class Musteri(Base):
    __tablename__ = "musteriler"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    firma_adi = Column(String(200), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    telefon = Column(String(20), nullable=True)
    plan = Column(Enum("free", "pro", "enterprise", name="plan_enum"), default="free")
    aktif = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    kullanicilar = relationship("Kullanici", back_populates="musteri", cascade="all, delete-orphan")
    santiyeler = relationship("Santiye", back_populates="musteri", cascade="all, delete-orphan")
    sablonlar = relationship("Sablon", back_populates="musteri", cascade="all, delete-orphan")


class Kullanici(Base):
    __tablename__ = "kullanicilar"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    musteri_id = Column(String(36), ForeignKey("musteriler.id", ondelete="CASCADE"), nullable=False, index=True)
    ad_soyad = Column(String(150), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    telefon_no = Column(String(20), nullable=True)
    rol = Column(Enum("admin", "editor", "viewer", name="rol_enum"), default="viewer")
    sifre_hash = Column(String(255), nullable=False)
    aktif = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    musteri = relationship("Musteri", back_populates="kullanicilar")
    raporlar = relationship("Rapor", back_populates="olusturan")
