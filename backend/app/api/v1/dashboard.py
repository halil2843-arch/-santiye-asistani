"""Dashboard ve hava durumu proxy endpoint'leri.

GET /api/v1/dashboard/summary  — özet istatistikler
GET /api/v1/weather            — hava durumu (il, ilce parametreleri)
"""

from datetime import date, datetime, timezone, timedelta
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentMusteriId
from app.core.config import settings
from app.core.database import get_db
from app.models.message import Cikarilan, WhatsappMesaji
from app.models.proje import Proje, ProjeDurum
from app.models.report import Rapor
from app.models.site import Santiye

router = APIRouter(tags=["dashboard"])

DbDep = Annotated[AsyncSession, Depends(get_db)]


# ---------------------------------------------------------------------------
# Şemalar
# ---------------------------------------------------------------------------


class DashboardSummary(BaseModel):
    aktif_santiye_sayisi: int
    aktif_proje_sayisi: int
    bugunun_rapor_sayisi: int
    bekleyen_rapor_sayisi: int
    toplam_personel: int
    okunmamis_mesaj_sayisi: int


class HavaDurumu(BaseModel):
    sicaklik: float
    durum: str
    ikon: str
    nem: int
    ruzgar: float
    il: str
    ilce: str


# ---------------------------------------------------------------------------
# Yardımcılar
# ---------------------------------------------------------------------------


def _bugun() -> date:
    """İstanbul saatiyle bugünün tarihini döndürür (UTC+3)."""
    return datetime.now(tz=timezone(timedelta(hours=3))).date()


_HAVA_MOCK = {
    "sicaklik": 24.0,
    "durum": "Parçalı Bulutlu",
    "ikon": "⛅",
    "nem": 65,
    "ruzgar": 12.0,
}

_OWM_CONDITION_ICONS: dict[str, str] = {
    "clear sky": "☀️",
    "few clouds": "🌤",
    "scattered clouds": "⛅",
    "broken clouds": "☁️",
    "overcast clouds": "☁️",
    "light rain": "🌦",
    "moderate rain": "🌧",
    "heavy intensity rain": "🌧",
    "thunderstorm": "⛈",
    "snow": "❄️",
    "mist": "🌫",
    "fog": "🌫",
    "haze": "🌫",
}


def _condition_icon(description: str) -> str:
    desc = description.lower()
    for key, icon in _OWM_CONDITION_ICONS.items():
        if key in desc:
            return icon
    return "🌡"


# ---------------------------------------------------------------------------
# Endpoint'ler
# ---------------------------------------------------------------------------


@router.get(
    "/summary",
    response_model=DashboardSummary,
    summary="Dashboard özet istatistikler",
)
async def dashboard_summary(
    db: DbDep,
    musteri_id: CurrentMusteriId,
) -> DashboardSummary:
    """Giriş yapmış kullanıcının tenant'ına ait dashboard metriklerini döndürür."""

    bugun = _bugun()

    # 1. Aktif şantiye sayısı
    aktif_santiye_stmt = select(func.count(Santiye.id)).where(
        Santiye.musteri_id == musteri_id,
        Santiye.aktif.is_(True),
        Santiye.arsiv.is_(False),
    )
    aktif_santiye_sayisi: int = (await db.execute(aktif_santiye_stmt)).scalar_one() or 0

    # 2. Aktif proje sayısı
    aktif_proje_stmt = select(func.count(Proje.id)).where(
        Proje.musteri_id == musteri_id,
        Proje.durum == ProjeDurum.aktif,
    )
    aktif_proje_sayisi: int = (await db.execute(aktif_proje_stmt)).scalar_one() or 0

    # 3. Bugünün rapor sayısı — santiye üzerinden tenant filtresi
    bugun_rapor_stmt = (
        select(func.count(Rapor.id))
        .join(Santiye, Rapor.santiye_id == Santiye.id)
        .where(
            Santiye.musteri_id == musteri_id,
            Rapor.tarih == bugun,
        )
    )
    bugunun_rapor_sayisi: int = (await db.execute(bugun_rapor_stmt)).scalar_one() or 0

    # 4. Bekleyen (taslak) rapor sayısı
    bekleyen_rapor_stmt = (
        select(func.count(Rapor.id))
        .join(Santiye, Rapor.santiye_id == Santiye.id)
        .where(
            Santiye.musteri_id == musteri_id,
            Rapor.durum == "taslak",
        )
    )
    bekleyen_rapor_sayisi: int = (await db.execute(bekleyen_rapor_stmt)).scalar_one() or 0

    # 5. Bugünün raporlarındaki toplam personel
    #    Cikarilan.alan_adi = 'personel_sayisi' olan ve bugünün raporuna ait kayıtların
    #    deger alanı sayısal olarak toplanır.
    bugunku_rapor_ids_stmt = (
        select(Rapor.id)
        .join(Santiye, Rapor.santiye_id == Santiye.id)
        .where(
            Santiye.musteri_id == musteri_id,
            Rapor.tarih == bugun,
        )
    )
    bugunku_rapor_id_rows = (await db.execute(bugunku_rapor_ids_stmt)).scalars().all()

    toplam_personel = 0
    if bugunku_rapor_id_rows:
        personel_stmt = select(Cikarilan.deger).where(
            Cikarilan.rapor_id.in_(bugunku_rapor_id_rows),
            Cikarilan.alan_adi == "personel_sayisi",
        )
        personel_rows = (await db.execute(personel_stmt)).scalars().all()
        for deger in personel_rows:
            try:
                toplam_personel += int(float(deger))
            except (TypeError, ValueError):
                pass

    # 6. Okunmamış mesaj sayısı
    okunmamis_stmt = (
        select(func.count(WhatsappMesaji.id))
        .join(Santiye, WhatsappMesaji.santiye_id == Santiye.id)
        .where(
            Santiye.musteri_id == musteri_id,
            WhatsappMesaji.islendi.is_(False),
        )
    )
    okunmamis_mesaj_sayisi: int = (await db.execute(okunmamis_stmt)).scalar_one() or 0

    return DashboardSummary(
        aktif_santiye_sayisi=aktif_santiye_sayisi,
        aktif_proje_sayisi=aktif_proje_sayisi,
        bugunun_rapor_sayisi=bugunun_rapor_sayisi,
        bekleyen_rapor_sayisi=bekleyen_rapor_sayisi,
        toplam_personel=toplam_personel,
        okunmamis_mesaj_sayisi=okunmamis_mesaj_sayisi,
    )


@router.get(
    "/weather",
    response_model=HavaDurumu,
    summary="Hava durumu (OpenWeatherMap proxy)",
)
async def get_weather(
    musteri_id: CurrentMusteriId,
    il: str | None = Query(default=None, description="İl adı (örn: istanbul)"),
    ilce: str | None = Query(default=None, description="İlçe adı (örn: bagcilar)"),
    lat: float | None = Query(default=None, description="Enlem koordinatı"),
    lon: float | None = Query(default=None, description="Boylam koordinatı"),
) -> HavaDurumu:
    """Verilen il/ilçe veya koordinat için hava durumu döndürür.

    - `lat`/`lon` verilmişse koordinat ile OWM çağrısı yapılır (öncelikli).
    - Sadece il/ilçe verilmişse metin tabanlı OWM çağrısı yapılır.
    - `OPENWEATHER_API_KEY` .env'de tanımlı değilse mock veri döner.
    - İkisi de verilmemişse 422 döner.
    """
    # En az bir konum parametresi zorunlu
    if lat is None and lon is None and not il:
        from fastapi import HTTPException as _HTTPException
        raise _HTTPException(
            status_code=422,
            detail="il veya lat/lon parametrelerinden en az biri zorunludur.",
        )

    # Görüntülenecek yer adı
    il_display = il or ""
    ilce_display = ilce or ""

    api_key = getattr(settings, "OPENWEATHER_API_KEY", "")

    if not api_key:
        return HavaDurumu(il=il_display, ilce=ilce_display, **_HAVA_MOCK)

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Koordinat verilmişse doğrudan lat/lon ile çağır
            if lat is not None and lon is not None:
                owm_params: dict = {
                    "lat": lat,
                    "lon": lon,
                    "appid": api_key,
                    "units": "metric",
                    "lang": "tr",
                }
            else:
                # il/ilçe tabanlı arama
                lokasyon = f"{ilce},{il},TR" if ilce else f"{il},TR"
                owm_params = {
                    "q": lokasyon,
                    "appid": api_key,
                    "units": "metric",
                    "lang": "tr",
                }

            resp = await client.get(
                "https://api.openweathermap.org/data/2.5/weather",
                params=owm_params,
            )
            if resp.status_code != 200:
                # API hatası — mock veri dön
                return HavaDurumu(il=il_display, ilce=ilce_display, **_HAVA_MOCK)

            data = resp.json()
            description = data["weather"][0].get("description", "")
            # Koordinat kullanıldıysa OWM'den gelen şehir adını kullan
            if lat is not None and lon is not None and not il_display:
                il_display = data.get("name", "")
            return HavaDurumu(
                sicaklik=round(data["main"]["temp"], 1),
                durum=description.capitalize(),
                ikon=_condition_icon(description),
                nem=int(data["main"]["humidity"]),
                ruzgar=round(data["wind"]["speed"] * 3.6, 1),  # m/s → km/h
                il=il_display,
                ilce=ilce_display,
            )
    except Exception:
        # Ağ hatası vb. — mock veri dön
        return HavaDurumu(il=il_display, ilce=ilce_display, **_HAVA_MOCK)
