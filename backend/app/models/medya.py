"""Medya dosyası modeli — fotoğraf, belge, video upload kayıtları."""

import uuid
from sqlalchemy import Column, String, Integer, ForeignKey

from app.core.database import Base


def _gen_uuid() -> str:
    return str(uuid.uuid4())


class MedyaDosyasi(Base):
    __tablename__ = "medya_dosyalari"

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
    rapor_id = Column(
        String(36),
        ForeignKey("raporlar.id", ondelete="SET NULL"),
        nullable=True,
    )
    dosya_yolu = Column(String(1000), nullable=False)
    dosya_adi = Column(String(300), nullable=True)
    mime_type = Column(String(100), nullable=True)
    boyut_byte = Column(Integer, nullable=True)
    tip = Column(String(20), default="fotograf")     # "fotograf", "belge", "video"
    klasor = Column(String(100), nullable=True, index=True)  # Galeri klasörü
    created_at = Column(String(50), nullable=True)
