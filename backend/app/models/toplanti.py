"""Toplantı notları modeli."""

import uuid
from sqlalchemy import Column, String, Text, ForeignKey

from app.core.database import Base


def _gen_uuid() -> str:
    return str(uuid.uuid4())


class Toplanti(Base):
    __tablename__ = "toplantilar"

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
    baslik = Column(String(300), nullable=False)
    tarih = Column(String(50), nullable=False)
    yer = Column(String(200), nullable=True)
    notlar = Column(Text, nullable=True)
    katilanlar = Column(Text, nullable=True)    # JSON string: [{"isim":"...","rol":"..."}]
    created_at = Column(String(50), nullable=True)
