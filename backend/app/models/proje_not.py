"""ProjeNot modeli — proje bazlı yapışkан notlar."""

import uuid
from sqlalchemy import Column, String, Text

from app.core.database import Base


def _gen_uuid() -> str:
    return str(uuid.uuid4())


class ProjeNot(Base):
    __tablename__ = "proje_notlari"

    id = Column(String(36), primary_key=True, default=_gen_uuid)
    proje_id = Column(String(36), nullable=False, index=True)
    musteri_id = Column(String(36), nullable=False, index=True)
    baslik = Column(String(200), nullable=False)
    icerik = Column(Text, nullable=False)
    renk = Column(String(20), nullable=True, default="amber")   # amber, green, red, blue
    sabitlendi = Column(String(5), nullable=True, default="false")  # pinned: "true" | "false"
    created_at = Column(String(50), nullable=True)
    updated_at = Column(String(50), nullable=True)
