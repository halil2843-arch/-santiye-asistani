"""
Hakediş endpoint'leri.
Kullanıcı kendi hakediş şablonunu yükleyip sisteme ekleyebilir.
hakedis_olusturucu.py → şablonu olmayan kullanıcılar için varsayılan format.

POST /api/v1/hakedis/olustur       → Hakediş Excel üret ve indir
GET  /api/v1/hakedis/ornek-sablon  → Boş örnek şablonu indir
"""

from __future__ import annotations

import os

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field

from app.api.deps import CurrentMusteriId

router = APIRouter(tags=["hakedis"])


# ---------------------------------------------------------------------------
# Request modeli
# ---------------------------------------------------------------------------

class IsKalemi(BaseModel):
    tanim: str = Field(..., description="İş kalemi tanımı")
    miktar: float = Field(..., ge=0, description="Miktar")
    birim: str = Field(..., description="Birim (m3, ton, adet vb.)")
    birim_fiyat: float = Field(..., ge=0, description="Birim fiyat (₺)")
    notlar: str | None = Field(default=None, description="Ek notlar")


class HakedisCreate(BaseModel):
    santiye_adi: str = Field(..., min_length=1, description="Şantiye / proje adı")
    donem: str = Field(..., pattern=r"^\d{4}-\d{2}$", description="Dönem (YYYY-MM formatında, ör. 2026-05)")
    is_kalemleri: list[IsKalemi] = Field(..., min_length=1, description="İş kalemleri listesi")
    kdv_orani: float = Field(default=0.20, ge=0, le=1, description="KDV oranı (varsayılan 0.20 → %20)")


# ---------------------------------------------------------------------------
# Endpoint'ler
# ---------------------------------------------------------------------------

@router.post("/olustur", summary="Hakediş Excel oluştur ve indir")
async def hakedis_olustur(
    data: HakedisCreate,
    musteri_id: CurrentMusteriId,
):
    """
    Verilen iş kalemleri ile standart hakediş Excel dosyası oluşturur ve döndürür.

    - KDV otomatik hesaplanır
    - Excel'de formüller canlı bırakılır (düzenlenebilir)
    - Dosya adı: hakedis_{santiye_adi}_{donem}.xlsx
    """
    from app.services.hakedis_olusturucu import hakedis_excel_olustur
    try:
        is_kalemleri_dict = [k.model_dump(exclude_none=True) for k in data.is_kalemleri]
        dosya_yolu = hakedis_excel_olustur(
            santiye_adi=data.santiye_adi,
            donem=data.donem,
            is_kalemleri=is_kalemleri_dict,
            kdv_orani=data.kdv_orani,
        )
        with open(dosya_yolu, "rb") as f:
            icerik = f.read()
        dosya_adi = os.path.basename(dosya_yolu)
        return Response(
            content=icerik,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{dosya_adi}"'},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ornek-sablon", summary="Boş hakediş şablonu indir")
async def ornek_sablon_indir(musteri_id: CurrentMusteriId):
    """
    Örnek iş kalemleri içeren boş hakediş şablonu indirir.
    Kullanıcı bu şablonu referans alarak kendi alanlarını düzenleyebilir.
    """
    from app.services.hakedis_olusturucu import hakedis_excel_olustur
    try:
        ornek_yolu = hakedis_excel_olustur(
            santiye_adi="ORNEK_SANTIYE",
            donem="2026-01",
            is_kalemleri=[
                {"tanim": "Kazı ve Hafriyat", "miktar": 100, "birim": "m3", "birim_fiyat": 250},
                {"tanim": "Beton Dökümü", "miktar": 50, "birim": "m3", "birim_fiyat": 800},
                {"tanim": "Demir Donatı İmalatı", "miktar": 5000, "birim": "kg", "birim_fiyat": 25},
            ],
        )
        with open(ornek_yolu, "rb") as f:
            icerik = f.read()
        return Response(
            content=icerik,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": 'attachment; filename="hakedis_ornek_sablon.xlsx"'},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
