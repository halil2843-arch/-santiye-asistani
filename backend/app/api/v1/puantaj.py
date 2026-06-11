"""Puantaj (personel devam) yönetimi endpoint'leri.

GET    /api/v1/puantaj/          — liste (tarih, proje_id, santiye_id filtresi)
POST   /api/v1/puantaj/          — tek kayıt ekle
POST   /api/v1/puantaj/toplu     — toplu kayıt ekle
GET    /api/v1/puantaj/ozet      — günlük/aylık özet
GET    /api/v1/puantaj/{id}      — detay
PATCH  /api/v1/puantaj/{id}      — güncelle
DELETE /api/v1/puantaj/{id}      — sil
"""

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentMusteriId
from app.core.database import get_db
from app.models.puantaj import PuantajKaydi

router = APIRouter(tags=["puantaj"])

DbDep = Annotated[AsyncSession, Depends(get_db)]


# ---------------------------------------------------------------------------
# Pydantic V2 şemaları
# ---------------------------------------------------------------------------


class PuantajCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    tarih: str = Field(..., description="ISO tarih: 2026-06-01")
    personel_adi: str = Field(..., min_length=1, max_length=200)
    meslek: str | None = Field(default=None, max_length=100, description="formen | işçi | operatör")
    giris_saati: str | None = Field(default="08:00", max_length=10)
    cikis_saati: str | None = Field(default="18:00", max_length=10)
    calisma_saati: float = Field(default=8.0, ge=0.0, le=24.0)
    fazla_mesai: float = Field(default=0.0, ge=0.0)
    devamsizlik: bool = Field(default=False)
    devamsizlik_nedeni: str | None = Field(
        default=None,
        max_length=100,
        description="hasta | izinli | mazeret | devamsiz",
    )
    notlar: str | None = None
    proje_id: str | None = None
    santiye_id: str | None = None


class PuantajUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    tarih: str | None = None
    personel_adi: str | None = Field(default=None, min_length=1, max_length=200)
    meslek: str | None = Field(default=None, max_length=100)
    giris_saati: str | None = Field(default=None, max_length=10)
    cikis_saati: str | None = Field(default=None, max_length=10)
    calisma_saati: float | None = Field(default=None, ge=0.0, le=24.0)
    fazla_mesai: float | None = Field(default=None, ge=0.0)
    devamsizlik: bool | None = None
    devamsizlik_nedeni: str | None = Field(
        default=None,
        max_length=100,
        description="hasta | izinli | mazeret | devamsiz",
    )
    notlar: str | None = None
    proje_id: str | None = None
    santiye_id: str | None = None


class PuantajResponse(PuantajCreate):
    model_config = ConfigDict(from_attributes=True)

    id: str
    musteri_id: str
    created_at: str | None = None


class OzetItem(BaseModel):
    tarih: str
    toplam_personel: int
    toplam_calisma_saati: float
    toplam_fazla_mesai: float
    devamsizlik_sayisi: int


# ---------------------------------------------------------------------------
# Yardımcı
# ---------------------------------------------------------------------------


def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


async def _get_or_404(db: AsyncSession, kaydi_id: str, musteri_id: str) -> PuantajKaydi:
    result = await db.execute(
        select(PuantajKaydi).where(
            PuantajKaydi.id == kaydi_id,
            PuantajKaydi.musteri_id == musteri_id,
        )
    )
    kayit = result.scalar_one_or_none()
    if kayit is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Puantaj kaydı bulunamadı: {kaydi_id}",
        )
    return kayit


# ---------------------------------------------------------------------------
# Endpoint'ler
# ---------------------------------------------------------------------------


@router.get(
    "/ozet",
    response_model=list[OzetItem],
    summary="Günlük/aylık puantaj özeti",
)
async def puantaj_ozet(
    db: DbDep,
    musteri_id: CurrentMusteriId,
    proje_id: str | None = Query(default=None),
    santiye_id: str | None = Query(default=None),
    ay: str | None = Query(
        default=None,
        description="YYYY-MM formatında ay filtresi (örn: 2026-06)",
    ),
) -> list[OzetItem]:
    """Tarih bazında toplam personel, toplam çalışma ve fazla mesai özetini döndürür."""
    stmt = (
        select(
            PuantajKaydi.tarih,
            func.count(PuantajKaydi.id).label("toplam_personel"),
            func.coalesce(func.sum(PuantajKaydi.calisma_saati), 0.0).label("toplam_calisma_saati"),
            func.coalesce(func.sum(PuantajKaydi.fazla_mesai), 0.0).label("toplam_fazla_mesai"),
            func.sum(
                func.cast(PuantajKaydi.devamsizlik, func.count(PuantajKaydi.id).type)
            ).label("devamsizlik_sayisi"),
        )
        .where(PuantajKaydi.musteri_id == musteri_id)
        .group_by(PuantajKaydi.tarih)
        .order_by(PuantajKaydi.tarih.desc())
    )
    if proje_id:
        stmt = stmt.where(PuantajKaydi.proje_id == proje_id)
    if santiye_id:
        stmt = stmt.where(PuantajKaydi.santiye_id == santiye_id)
    if ay:
        stmt = stmt.where(PuantajKaydi.tarih.startswith(ay))

    rows = (await db.execute(stmt)).all()

    # Devamsizlik için ayrı sorgu (SQLite Boolean sum uyumsuzluğu)
    sonuclar: list[OzetItem] = []
    for row in rows:
        dev_stmt = (
            select(func.count(PuantajKaydi.id))
            .where(
                PuantajKaydi.musteri_id == musteri_id,
                PuantajKaydi.tarih == row.tarih,
                PuantajKaydi.devamsizlik == True,  # noqa: E712
            )
        )
        if proje_id:
            dev_stmt = dev_stmt.where(PuantajKaydi.proje_id == proje_id)
        if santiye_id:
            dev_stmt = dev_stmt.where(PuantajKaydi.santiye_id == santiye_id)
        dev_sayisi = (await db.execute(dev_stmt)).scalar() or 0

        sonuclar.append(
            OzetItem(
                tarih=row.tarih,
                toplam_personel=row.toplam_personel,
                toplam_calisma_saati=float(row.toplam_calisma_saati),
                toplam_fazla_mesai=float(row.toplam_fazla_mesai),
                devamsizlik_sayisi=dev_sayisi,
            )
        )
    return sonuclar


@router.get(
    "/",
    response_model=list[PuantajResponse],
    summary="Puantaj kayıtlarını listele",
)
async def list_puantaj(
    db: DbDep,
    musteri_id: CurrentMusteriId,
    tarih: str | None = Query(default=None, description="Tam tarih filtresi: 2026-06-01"),
    proje_id: str | None = Query(default=None),
    santiye_id: str | None = Query(default=None),
    ay: str | None = Query(default=None, description="Ay filtresi: 2026-06"),
) -> list[PuantajKaydi]:
    stmt = (
        select(PuantajKaydi)
        .where(PuantajKaydi.musteri_id == musteri_id)
        .order_by(PuantajKaydi.tarih.desc(), PuantajKaydi.personel_adi)
    )
    if tarih:
        stmt = stmt.where(PuantajKaydi.tarih == tarih)
    if proje_id:
        stmt = stmt.where(PuantajKaydi.proje_id == proje_id)
    if santiye_id:
        stmt = stmt.where(PuantajKaydi.santiye_id == santiye_id)
    if ay:
        stmt = stmt.where(PuantajKaydi.tarih.startswith(ay))
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post(
    "/",
    response_model=PuantajResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Yeni puantaj kaydı ekle (tek kişi)",
)
async def create_puantaj(
    payload: PuantajCreate,
    db: DbDep,
    musteri_id: CurrentMusteriId,
) -> PuantajKaydi:
    """Tek personel için puantaj kaydı oluşturur."""
    kayit = PuantajKaydi(
        musteri_id=musteri_id,
        proje_id=payload.proje_id,
        santiye_id=payload.santiye_id,
        tarih=payload.tarih,
        personel_adi=payload.personel_adi,
        meslek=payload.meslek,
        giris_saati=payload.giris_saati,
        cikis_saati=payload.cikis_saati,
        calisma_saati=payload.calisma_saati,
        fazla_mesai=payload.fazla_mesai,
        devamsizlik=payload.devamsizlik,
        devamsizlik_nedeni=payload.devamsizlik_nedeni,
        notlar=payload.notlar,
        created_at=_now_iso(),
    )
    db.add(kayit)
    await db.commit()
    await db.refresh(kayit)
    return kayit


@router.post(
    "/toplu",
    response_model=list[PuantajResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Toplu puantaj kaydı ekle",
)
async def create_puantaj_toplu(
    payload: list[PuantajCreate],
    db: DbDep,
    musteri_id: CurrentMusteriId,
) -> list[PuantajKaydi]:
    """Birden fazla personelin puantaj kaydını tek seferde oluşturur."""
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="En az bir kayıt gönderilmelidir.",
        )
    now = _now_iso()
    kayitlar: list[PuantajKaydi] = []
    for item in payload:
        k = PuantajKaydi(
            musteri_id=musteri_id,
            proje_id=item.proje_id,
            santiye_id=item.santiye_id,
            tarih=item.tarih,
            personel_adi=item.personel_adi,
            meslek=item.meslek,
            giris_saati=item.giris_saati,
            cikis_saati=item.cikis_saati,
            calisma_saati=item.calisma_saati,
            fazla_mesai=item.fazla_mesai,
            devamsizlik=item.devamsizlik,
            devamsizlik_nedeni=item.devamsizlik_nedeni,
            notlar=item.notlar,
            created_at=now,
        )
        db.add(k)
        kayitlar.append(k)

    await db.commit()
    for k in kayitlar:
        await db.refresh(k)
    return kayitlar


@router.get(
    "/{kayit_id}",
    response_model=PuantajResponse,
    summary="Puantaj kaydı detayı",
)
async def get_puantaj(
    kayit_id: str,
    db: DbDep,
    musteri_id: CurrentMusteriId,
) -> PuantajKaydi:
    return await _get_or_404(db, kayit_id, musteri_id)


@router.patch(
    "/{kayit_id}",
    response_model=PuantajResponse,
    summary="Puantaj kaydını güncelle",
)
async def update_puantaj(
    kayit_id: str,
    payload: PuantajUpdate,
    db: DbDep,
    musteri_id: CurrentMusteriId,
) -> PuantajKaydi:
    kayit = await _get_or_404(db, kayit_id, musteri_id)
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(kayit, field, value)
    db.add(kayit)
    await db.commit()
    await db.refresh(kayit)
    return kayit


@router.delete(
    "/{kayit_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Puantaj kaydını sil",
)
async def delete_puantaj(
    kayit_id: str,
    db: DbDep,
    musteri_id: CurrentMusteriId,
) -> None:
    kayit = await _get_or_404(db, kayit_id, musteri_id)
    await db.delete(kayit)
    await db.commit()
