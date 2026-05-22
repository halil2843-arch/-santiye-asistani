import uuid
from sqlalchemy import Column, String, Boolean, DateTime, Float, Text, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base


def gen_uuid():
    return str(uuid.uuid4())


class PendingWhatsapp(Base):
    """Henüz hiçbir şantiyeye eşleştirilmemiş WhatsApp numaraları.

    Bilinmeyen bir numaradan mesaj gelince bu tabloya kaydedilir.
    Yönetici admin panelinden numarayı bir şantiyeye bağladığında
    `islendi` True yapılır ve normal akış devreye girer.
    """

    __tablename__ = "pending_whatsapp"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    whatsapp_numara = Column(String(30), nullable=False, unique=True, index=True)
    ilk_mesaj_metni = Column(Text, nullable=True)
    olusturma_tarihi = Column(DateTime(timezone=True), server_default=func.now())
    islendi = Column(Boolean, default=False, nullable=False, index=True)


class WhatsappMesaji(Base):
    __tablename__ = "whatsapp_mesajlari"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    santiye_id = Column(String(36), ForeignKey("santiyeler.id", ondelete="CASCADE"), nullable=False, index=True)
    rapor_id = Column(String(36), ForeignKey("raporlar.id", ondelete="SET NULL"), nullable=True)
    gonderen_no = Column(String(30), nullable=False)
    icerik = Column(Text, nullable=True)
    medya_url = Column(String(1000), nullable=True)
    islendi = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    santiye = relationship("Santiye", back_populates="mesajlar")
    rapor = relationship("Rapor", back_populates="mesajlar")
    cikarilanlar = relationship("Cikarilan", back_populates="mesaj", cascade="all, delete-orphan")


class Cikarilan(Base):
    __tablename__ = "cikarilanlar"

    id = Column(String(36), primary_key=True, default=gen_uuid)
    mesaj_id = Column(String(36), ForeignKey("whatsapp_mesajlari.id", ondelete="CASCADE"), nullable=False)
    rapor_id = Column(String(36), ForeignKey("raporlar.id", ondelete="CASCADE"), nullable=False)
    alan_adi = Column(String(100), nullable=False)
    deger = Column(Text, nullable=True)
    guven_skoru = Column(Float, default=1.0)
    belirsiz = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    mesaj = relationship("WhatsappMesaji", back_populates="cikarilanlar")
    rapor = relationship("Rapor", back_populates="cikarilanlar")
