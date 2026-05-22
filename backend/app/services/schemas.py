"""
Santiye Asistani - Extraction Cikti Modelleri

Guven Skoru Rehberi:
  1.0       → Mesajda kelimesi kelimesine gecen bilgi
  0.7-0.9   → Baglama gore cikarsanan bilgi (ornegin "JCB" → ekskavatör tipi)
  0.4-0.6   → Tahmine dayali bilgi (ornegin belirsiz sayi ifadeleri)
  < 0.6     → ExtractionSonucu.belirsiz_alanlar listesine eklenir
"""

from __future__ import annotations
from datetime import date
from typing import Optional
from pydantic import BaseModel, Field, field_validator, model_validator


class PersonelKaydi(BaseModel):
    ekip_adi: str = Field(description="Ekip veya firma adi.")
    meslek: str = Field(description="Meslek veya uzmanlik alani.")
    sayi: int = Field(ge=0, description="O gun calisan kisi sayisi.")
    guven_skoru: float = Field(ge=0.0, le=1.0)

    @field_validator("sayi", mode="before")
    @classmethod
    def sayi_pozitif(cls, v: int) -> int:
        if v is None:
            return 0
        if v < 0:
            raise ValueError("Personel sayisi negatif olamaz.")
        return v


class MakineKaydi(BaseModel):
    makine_tipi: str = Field(description="Makinenin standartlastirilmis adi.")
    sayi: int = Field(ge=1)
    calisma_saati: Optional[float] = Field(default=None, ge=0.0)
    guven_skoru: float = Field(ge=0.0, le=1.0)


class YapilanIs(BaseModel):
    kategori: str = Field(description="Is kategorisi.")
    aciklama: str = Field(description="Isin kisa aciklamasi.")
    ilgili_firma: Optional[str] = Field(default=None)
    calisan_sayisi: Optional[int] = Field(default=None, ge=0, description="Bu is icin sahada toplam calisan.")
    usta_sayisi: Optional[int] = Field(default=None, ge=0, description="Usta / kalipci / uzman isci sayisi.")
    duz_isci_sayisi: Optional[int] = Field(default=None, ge=0, description="Duz isci / beden iscisi sayisi.")
    formen_sayisi: Optional[int] = Field(default=None, ge=0, description="Formen / kalfa sayisi.")
    guven_skoru: float = Field(ge=0.0, le=1.0)


class MalzemeGirisi(BaseModel):
    malzeme_adi: str
    miktar: float = Field(ge=0.0)
    birim: str = Field(description="Olcum birimi: torba, ton, m3, adet, kg, lt, mt")
    guven_skoru: float = Field(ge=0.0, le=1.0)


class HavaDurumu(BaseModel):
    sabah: Optional[str] = None
    ogleden_sonra: Optional[str] = None
    sicaklik_derece: Optional[float] = None
    genel_aciklama: Optional[str] = None


class BelirsizAlan(BaseModel):
    alan_adi: str
    mevcut_deger: Optional[str] = None
    neden_belirsiz: str
    guven_skoru: float = Field(ge=0.0, le=1.0)


class ExtractionSonucu(BaseModel):
    tarih: date
    santiye_adi: Optional[str] = None
    hava_durumu: HavaDurumu
    personel: list[PersonelKaydi] = Field(default_factory=list)
    makineler: list[MakineKaydi] = Field(default_factory=list)
    yapilan_isler: list[YapilanIs] = Field(default_factory=list)
    malzeme_girisi: list[MalzemeGirisi] = Field(default_factory=list)
    belirsiz_alanlar: list[BelirsizAlan] = Field(default_factory=list)
    fotograf_analizi: Optional[str] = None
    ham_mesajlar: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def belirsiz_alanlari_kontrol_et(self) -> "ExtractionSonucu":
        """guven_skoru < 0.6 olan kayitlari otomatik belirsiz_alanlar listesine ekle."""
        mevcut_belirsiz = {b.alan_adi for b in self.belirsiz_alanlar}

        for i, p in enumerate(self.personel):
            if p.guven_skoru < 0.6:
                alan = f"personel[{i}].sayi ({p.ekip_adi})"
                if alan not in mevcut_belirsiz:
                    self.belirsiz_alanlar.append(BelirsizAlan(
                        alan_adi=alan,
                        mevcut_deger=str(p.sayi),
                        neden_belirsiz="Personel sayisi dusuk guven ile cikarsandi.",
                        guven_skoru=p.guven_skoru,
                    ))

        for i, m in enumerate(self.makineler):
            if m.guven_skoru < 0.6:
                alan = f"makineler[{i}] ({m.makine_tipi})"
                if alan not in mevcut_belirsiz:
                    self.belirsiz_alanlar.append(BelirsizAlan(
                        alan_adi=alan,
                        mevcut_deger=m.makine_tipi,
                        neden_belirsiz="Makine bilgisi dusuk guven ile cikarsandi.",
                        guven_skoru=m.guven_skoru,
                    ))

        return self
