"""Aktivite feed modeli — proje bazlı aktivite akışı."""

import uuid
from sqlalchemy import Column, String, Text, ForeignKey

from app.core.database import Base


def _gen_uuid() -> str:
    return str(uuid.uuid4())


class Aktivite(Base):
    __tablename__ = "aktiviteler"

    id = Column(String(36), primary_key=True, default=_gen_uuid)
    proje_id = Column(
        String(36),
        ForeignKey("projeler.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    musteri_id = Column(
        String(36),
        ForeignKey("musteriler.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    kullanici_id = Column(
        String(36),
        ForeignKey("kullanicilar.id", ondelete="SET NULL"),
        nullable=True,
    )
    tip = Column(String(50), nullable=True)      # "rapor_olusturuldu","stok_uyarisi","mesaj_geldi"
    baslik = Column(String(300), nullable=True)
    aciklama = Column(Text, nullable=True)
    renk = Column(String(20), default="blue")    # "green","amber","red","blue"
    created_at = Column(String(50), nullable=True)
