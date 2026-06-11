"""ISG (İş Sağlığı ve Güvenliği) endpoint'leri.

GET    /api/v1/isg/         — liste (proje_id, tip, durum filtresi)
POST   /api/v1/isg/         — yeni kayıt
GET    /api/v1/isg/ozet     — aylık özet
GET    /api/v1/isg/{id}     — detay
PATCH  /api/v1/isg/{id}     — güncelle (durum değiştir, sonuç ekle)
"""

from collections import defaultdict
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentMusteriId
from app.core.database import get_db
from app.models.isg import IsgKaydi

router = APIRouter(tags=["isg"])

DbDep = Annotated[AsyncSession, Depends(get_db)]


# ---------------------------------------------------------------------------
# Pydantic V2 şemaları
# ---------------------------------------------------------------------------


class IsgCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    proje_id: str | None = None
    tip: str = Field(..., description="olay | denetim | egitim | ramak_kala")
    tarih: str = Field(..., min_length=1, max_length=20)
    aciklama: str | None = None
    sonuc: str | None = None
    onem_seviyesi: str = Field(default="orta", description="dusuk | orta | yuksek | kritik")
    durum: str = Field(default="acik", description="acik | kapandi | ertelendi")
    sorumlu: str | None = Field(default=None, max_length=200)


class IsgUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    proje_id: str | None = None
    tip: str | None = None
    tarih: str | None = None
    aciklama: str | None = None
    sonuc: str | None = None
    onem_seviyesi: str | None = None
    durum: str | None = None
    sorumlu: str | None = None


class IsgResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    musteri_id: str
    proje_id: str | None = None
    tip: str
    tarih: str
    aciklama: str | None = None
    sonuc: str | None = None
    onem_seviyesi: str
    durum: str
    sorumlu: str | None = None
    created_at: str | None = None


class IsgOzetResponse(BaseModel):
    ay: str
    toplam: int
    acik: int
    kapandi: int
    ertelendi: int
    tip_dagilimi: dict[str, int]
    onem_dagilimi: dict[str, int]


# ---------------------------------------------------------------------------
# Yardımcı
# ---------------------------------------------------------------------------


def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


async def _kayit_or_404(db: AsyncSession, kayit_id: str, musteri_id: str) -> IsgKaydi:
    result = await db.execute(
        select(IsgKaydi).where(
            IsgKaydi.id == kayit_id,
            IsgKaydi.musteri_id == musteri_id,
        )
    )
    kayit = result.scalar_one_or_none()
    if kayit is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ISG kaydı bulunamadı: {kayit_id}",
        )
    return kayit


# ---------------------------------------------------------------------------
# Endpoint'ler
# ---------------------------------------------------------------------------


@router.get(
    "/ozet",
    response_model=IsgOzetResponse,
    summary="ISG aylık özet",
)
async def isg_ozet(
    db: DbDep,
    musteri_id: CurrentMusteriId,
    ay: str | None = Query(
        default=None,
        description="YYYY-MM formatında ay (varsayılan: bu ay)",
    ),
    proje_id: str | None = Query(default=None),
) -> IsgOzetResponse:
    """Belirtilen ay için ISG istatistiklerini döndürür."""
    hedef_ay = ay or datetime.now(tz=timezone.utc).strftime("%Y-%m")
    stmt = select(IsgKaydi).where(
        IsgKaydi.musteri_id == musteri_id,
        IsgKaydi.tarih.startswith(hedef_ay),
    )
    if proje_id:
        stmt = stmt.where(IsgKaydi.proje_id == proje_id)
    result = await db.execute(stmt)
    kayitlar = list(result.scalars().all())

    tip_sayac: dict[str, int] = defaultdict(int)
    onem_sayac: dict[str, int] = defaultdict(int)
    acik = kapandi = ertelendi = 0

    for k in kayitlar:
        tip_sayac[k.tip] += 1
        onem_sayac[k.onem_seviyesi] += 1
        if k.durum == "acik":
            acik += 1
        elif k.durum == "kapandi":
            kapandi += 1
        elif k.durum == "ertelendi":
            ertelendi += 1

    return IsgOzetResponse(
        ay=hedef_ay,
        toplam=len(kayitlar),
        acik=acik,
        kapandi=kapandi,
        ertelendi=ertelendi,
        tip_dagilimi=dict(tip_sayac),
        onem_dagilimi=dict(onem_sayac),
    )


@router.get(
    "/",
    response_model=list[IsgResponse],
    summary="ISG kayıtlarını listele",
)
async def list_isg(
    db: DbDep,
    musteri_id: CurrentMusteriId,
    proje_id: str | None = Query(default=None, description="Projeye göre filtrele"),
    tip: str | None = Query(default=None, description="olay | denetim | egitim | ramak_kala"),
    durum: str | None = Query(default=None, description="acik | kapandi | ertelendi"),
    limit: int = Query(default=50, le=200, description="Maksimum kayıt sayısı"),
) -> list[IsgKaydi]:
    stmt = select(IsgKaydi).where(IsgKaydi.musteri_id == musteri_id)
    if proje_id:
        stmt = stmt.where(IsgKaydi.proje_id == proje_id)
    if tip:
        stmt = stmt.where(IsgKaydi.tip == tip)
    if durum:
        stmt = stmt.where(IsgKaydi.durum == durum)
    stmt = stmt.order_by(IsgKaydi.tarih.desc()).limit(limit)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post(
    "/",
    response_model=IsgResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Yeni ISG kaydı oluştur",
)
async def create_isg(
    payload: IsgCreate,
    db: DbDep,
    musteri_id: CurrentMusteriId,
) -> IsgKaydi:
    kayit = IsgKaydi(
        musteri_id=musteri_id,
        proje_id=payload.proje_id,
        tip=payload.tip,
        tarih=payload.tarih,
        aciklama=payload.aciklama,
        sonuc=payload.sonuc,
        onem_seviyesi=payload.onem_seviyesi,
        durum=payload.durum,
        sorumlu=payload.sorumlu,
        created_at=_now_iso(),
    )
    db.add(kayit)
    await db.commit()
    await db.refresh(kayit)
    return kayit


@router.get(
    "/{kayit_id}",
    response_model=IsgResponse,
    summary="ISG kaydı detayı",
)
async def get_isg(
    kayit_id: str,
    db: DbDep,
    musteri_id: CurrentMusteriId,
) -> IsgKaydi:
    return await _kayit_or_404(db, kayit_id, musteri_id)


@router.patch(
    "/{kayit_id}",
    response_model=IsgResponse,
    summary="ISG kaydı güncelle",
)
async def update_isg(
    kayit_id: str,
    payload: IsgUpdate,
    db: DbDep,
    musteri_id: CurrentMusteriId,
) -> IsgKaydi:
    kayit = await _kayit_or_404(db, kayit_id, musteri_id)
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(kayit, field, value)
    db.add(kayit)
    await db.commit()
    await db.refresh(kayit)
    return kayit
