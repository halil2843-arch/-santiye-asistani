"""Puantaj (personel devam takip) modeli."""

import uuid
from sqlalchemy import Column, String, Float, Boolean, ForeignKey, Text

from app.core.database import Base


def _gen_uuid() -> str:
    return str(uuid.uuid4())


class PuantajKaydi(Base):
    __tablename__ = "puantaj_kayitlari"

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
    santiye_id = Column(
        String(36),
        ForeignKey("santiyeler.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    tarih = Column(String(20), nullable=False, index=True)   # "2026-06-01"
    personel_adi = Column(String(200), nullable=False)
    meslek = Column(String(100), nullable=True)              # "formen", "işçi", "operatör"
    giris_saati = Column(String(10), nullable=True)          # "08:00"
    cikis_saati = Column(String(10), nullable=True)          # "18:00"
    calisma_saati = Column(Float, default=8.0)
    fazla_mesai = Column(Float, default=0.0)
    devamsizlik = Column(Boolean, default=False)
    devamsizlik_nedeni = Column(String(100), nullable=True)  # "hasta", "izinli", "mazeret", "devamsiz"
    notlar = Column(Text, nullable=True)
    created_at = Column(String(50), nullable=True)
