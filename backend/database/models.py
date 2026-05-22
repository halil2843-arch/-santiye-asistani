from sqlalchemy import Column, Integer, String, Date, ForeignKey, Text, DateTime
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class Santiye(Base):
    __tablename__ = "santiyeler"
    id = Column(Integer, primary_key=True, index=True)
    isim = Column(String, index=True)
    adres = Column(String, nullable=True)
    raporlar = relationship("Rapor", back_populates="santiye")

class Rapor(Base):
    __tablename__ = "raporlar"
    id = Column(Integer, primary_key=True, index=True)
    santiye_id = Column(Integer, ForeignKey("santiyeler.id"))
    tarih = Column(Date, index=True)
    olusturulma_zamani = Column(DateTime, default=datetime.utcnow)
    durum = Column(String, default="Taslak") # Taslak, Onaylandi, Iptal vs.
    
    santiye = relationship("Santiye", back_populates="raporlar")
    hava_durumu = relationship("HavaDurumu", back_populates="rapor", uselist=False)
    personeller = relationship("Personel", back_populates="rapor")
    imalatlar = relationship("Imalat", back_populates="rapor")
    medyalar = relationship("Medya", back_populates="rapor")

class HavaDurumu(Base):
    __tablename__ = "hava_durumu"
    id = Column(Integer, primary_key=True, index=True)
    rapor_id = Column(Integer, ForeignKey("raporlar.id"), unique=True)
    sabah = Column(String) # Açık, Yağmurlu vs.
    ogleden_sonra = Column(String)
    sicaklik = Column(String, nullable=True)
    rapor = relationship("Rapor", back_populates="hava_durumu")

class Personel(Base):
    __tablename__ = "personeller"
    id = Column(Integer, primary_key=True, index=True)
    rapor_id = Column(Integer, ForeignKey("raporlar.id"))
    ekip_adi = Column(String) # Taşeron firma veya ekip adı
    meslek = Column(String) # Demirci, Kalıpçı vs.
    sayi = Column(Integer)
    rapor = relationship("Rapor", back_populates="personeller")

class Imalat(Base):
    __tablename__ = "imalatlar"
    id = Column(Integer, primary_key=True, index=True)
    rapor_id = Column(Integer, ForeignKey("raporlar.id"))
    blok_no = Column(String, nullable=True) # A Blok, B Blok
    kat_no = Column(String, nullable=True) # 3. Kat, Zemin Kat
    aciklama = Column(Text) # Yapılan işin detayı
    rapor = relationship("Rapor", back_populates="imalatlar")

class Medya(Base):
    __tablename__ = "medyalar"
    id = Column(Integer, primary_key=True, index=True)
    rapor_id = Column(Integer, ForeignKey("raporlar.id"))
    dosya_yolu = Column(String) # Kaydedilen fotoğrafın bilgisayardaki/sunucudaki yolu
    aciklama = Column(Text, nullable=True) # AI'ın resim hakkında yaptığı yorum
    ilgili_imalat_id = Column(Integer, ForeignKey("imalatlar.id"), nullable=True) # Bu fotoğraf hangi imalata ait?
    rapor = relationship("Rapor", back_populates="medyalar")
