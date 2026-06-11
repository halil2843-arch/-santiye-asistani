"""Stok modelleri — malzeme kalemleri ve stok hareketleri."""

import uuid
from sqlalchemy import Column, String, Float, Text, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


def _gen_uuid() -> str:
    return str(uuid.uuid4())


class StokKalemi(Base):
    __tablename__ = "stok_kalemleri"

    id = Column(String(36), primary_key=True, default=_gen_uuid)
    musteri_id = Column(
        String(36),
        ForeignKey("musteriler.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    proje_id = Column(
        String(36),
        ForeignKey("projeler.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    malzeme_adi = Column(String(200), nullable=False)
    birim = Column(String(30), nullable=True)        # "adet", "kg", "m3", "ton"
    miktar = Column(Float, default=0.0)
    min_miktar = Column(Float, default=0.0)          # uyarı eşiği
    created_at = Column(String(50), nullable=True)
    updated_at = Column(String(50), nullable=True)

    hareketler = relationship(
        "StokHareketi",
        back_populates="kalem",
        cascade="all, delete-orphan",
    )


class StokHareketi(Base):
    __tablename__ = "stok_hareketleri"

    id = Column(String(36), primary_key=True, default=_gen_uuid)
    kalem_id = Column(
        String(36),
        ForeignKey("stok_kalemleri.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    kullanici_id = Column(
        String(36),
        ForeignKey("kullanicilar.id", ondelete="SET NULL"),
        nullable=True,
    )
    tip = Column(String(20), nullable=False)         # "giris", "cikis", "sayim"
    miktar = Column(Float, nullable=False)
    aciklama = Column(Text, nullable=True)
    tarih = Column(String(50), nullable=True)        # ISO datetime (audit trail)
    created_at = Column(String(50), nullable=True)

    kalem = relationship("StokKalemi", back_populates="hareketler")
