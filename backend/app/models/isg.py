"""ISG (İş Sağlığı ve Güvenliği) kayıt modeli."""

import uuid
from sqlalchemy import Column, String, Text, ForeignKey

from app.core.database import Base


def _gen_uuid() -> str:
    return str(uuid.uuid4())


class IsgKaydi(Base):
    __tablename__ = "isg_kayitlari"

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
    tip = Column(String(30), nullable=False)         # "olay","denetim","egitim","ramak_kala"
    tarih = Column(String(20), nullable=False)
    aciklama = Column(Text, nullable=True)
    sonuc = Column(Text, nullable=True)
    onem_seviyesi = Column(String(20), default="orta")   # "dusuk","orta","yuksek","kritik"
    durum = Column(String(20), default="acik")           # "acik","kapandi","ertelendi"
    sorumlu = Column(String(200), nullable=True)
    created_at = Column(String(50), nullable=True)
