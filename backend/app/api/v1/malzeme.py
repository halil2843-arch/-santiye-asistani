"""
Malzeme tahmini endpoint — Groq LLM ile hesaplama.
POST /api/v1/malzeme/tahmin → Yapı tipi ve alana göre malzeme ihtiyacı tahmini
"""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from groq import AsyncGroq
from pydantic import BaseModel, Field

from app.api.deps import CurrentMusteriId
from app.core.config import settings

router = APIRouter(tags=["malzeme"])


# ---------------------------------------------------------------------------
# Request / Response modelleri
# ---------------------------------------------------------------------------

class MalzemeTahminInput(BaseModel):
    yapi_tipi: str = Field(
        ...,
        description="Yapı tipi: 'konut', 'ofis', 'fabrika', 'depo', vb.",
        examples=["konut"],
    )
    alan_m2: float = Field(..., gt=0, description="Yapı alanı (m²)")
    kat_sayisi: int = Field(default=1, ge=1, le=50, description="Kat sayısı")
    ek_bilgi: str | None = Field(
        default=None,
        max_length=500,
        description="Ek bilgi (yapı sistemi, zemin tipi, özel gereksinimler vb.)",
    )


# ---------------------------------------------------------------------------
# Sistem promptu
# ---------------------------------------------------------------------------

_MALZEME_SISTEM = """Sen deneyimli bir inşaat mühendisisin. Verilen yapı tipi, alan ve kat sayısına göre yaklaşık malzeme ihtiyacını hesapla.

KURALLAR:
1. Yanıtını SADECE geçerli JSON olarak ver, başka açıklama ekleme.
2. Hesaplamalar yaklaşık değerler — bunu "uyari" alanında belirt.
3. Tüm miktarlar gerçekçi ve sektör standartlarına uygun olsun.
4. Türkçe kullan.

JSON ŞEMASI:
{
  "malzemeler": [
    {
      "ad": "malzeme adı",
      "miktar": sayısal_değer,
      "birim": "ton/m3/adet/kg",
      "aciklama": "kısa açıklama"
    }
  ],
  "toplam_maliyet_tahmini_tl": yaklaşık_sayı_veya_null,
  "uyari": "tahmin uyarısı ve varsayımlar"
}"""


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("/tahmin", summary="Groq LLM ile malzeme ihtiyacı tahmini")
async def malzeme_tahmin(
    data: MalzemeTahminInput,
    musteri_id: CurrentMusteriId,
):
    """
    Yapı tipi, alan (m²) ve kat sayısına göre Groq LLM ile ana malzeme ihtiyacını tahmin eder.

    Tahmin edilen malzemeler: çimento, demir/çelik, beton, tuğla/blok, kum, çakıl ve diğerleri.

    **Not:** Bu tahmin yaklaşık değerler içerir. Kesin hesap için detaylı metraj yapılmalıdır.
    """
    client = AsyncGroq(api_key=settings.GROQ_API_KEY)

    kullanici_mesaji = (
        f"Yapı tipi: {data.yapi_tipi}\n"
        f"Toplam alan: {data.alan_m2} m²\n"
        f"Kat sayısı: {data.kat_sayisi}\n"
    )
    if data.ek_bilgi:
        kullanici_mesaji += f"Ek bilgi: {data.ek_bilgi}\n"
    kullanici_mesaji += (
        "\nBu yapı için gereken ana malzemeleri (çimento, demir/çelik, beton, "
        "tuğla/blok, kum, çakıl) yaklaşık miktarlarıyla hesapla."
    )

    try:
        response = await client.chat.completions.create(
            model=settings.DEFAULT_MODEL,
            messages=[
                {"role": "system", "content": _MALZEME_SISTEM},
                {"role": "user", "content": kullanici_mesaji},
            ],
            response_format={"type": "json_object"},
            max_tokens=800,
            temperature=0.2,
        )
        ham_icerik = response.choices[0].message.content or "{}"
        sonuc = json.loads(ham_icerik)
        return sonuc
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"LLM geçersiz JSON döndürdü: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM hatası: {e}")
