"""Proje modeli — bir müşteriye / şantiyeye bağlı proje kaydı."""

import uuid
import enum
from sqlalchemy import Column, String, Float, Boolean, Date, Text, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship

from app.core.database import Base


def _gen_uuid() -> str:
    return str(uuid.uuid4())


class ProjeDurum(str, enum.Enum):
    aktif = "aktif"
    pasif = "pasif"
    arsiv = "arsiv"


class Proje(Base):
    __tablename__ = "projeler"

    id = Column(String(36), primary_key=True, default=_gen_uuid)
    musteri_id = Column(
        String(36),
        ForeignKey("musteriler.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    santiye_id = Column(
        String(36),
        ForeignKey("santiyeler.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    isim = Column(String(200), nullable=False)
    tanim = Column(Text, nullable=True)
    durum = Column(
        SAEnum(ProjeDurum, name="proje_durum_enum", native_enum=False),
        default=ProjeDurum.aktif,
        nullable=False,
    )
    baslangic_tarihi = Column(Date, nullable=True)
    bitis_tarihi = Column(Date, nullable=True)
    il = Column(String(100), nullable=True)
    ilce = Column(String(100), nullable=True)
    enlem = Column(Float, nullable=True)
    boylam = Column(Float, nullable=True)
    proje_muduru = Column(String(200), nullable=True)
    butce = Column(Float, nullable=True)
    ilerleme_yuzdesi = Column(Float, default=0.0)
    created_at = Column(String(50), nullable=True)
    updated_at = Column(String(50), nullable=True)

    musteri = relationship("Musteri", backref="projeler")
    santiye = relationship("Santiye", backref="projeler")
