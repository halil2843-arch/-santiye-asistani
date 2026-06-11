"""Stok yönetimi endpoint'leri.

GET    /api/v1/stok/                  — liste (proje_id & kritik filtresi)
POST   /api/v1/stok/                  — yeni kalem
GET    /api/v1/stok/{id}              — detay
PATCH  /api/v1/stok/{id}              — güncelle
DELETE /api/v1/stok/{id}              — sil
POST   /api/v1/stok/{id}/hareket      — hareket ekle (miktar güncelle)
GET    /api/v1/stok/{id}/hareketler   — hareket listesi
"""

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentMusteriId, CurrentUser
from app.core.database import get_db
from app.models.stok import StokHareketi, StokKalemi

router = APIRouter(tags=["stok"])

DbDep = Annotated[AsyncSession, Depends(get_db)]


# ---------------------------------------------------------------------------
# Pydantic V2 şemaları
# ---------------------------------------------------------------------------


class StokKalemiCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    proje_id: str | None = Field(default=None)
    malzeme_adi: str = Field(..., min_length=1, max_length=200)
    birim: str | None = Field(default=None, max_length=30)
    miktar: float = Field(default=0.0, ge=0.0)
    min_miktar: float = Field(default=0.0, ge=0.0)


class StokKalemiUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    proje_id: str | None = None
    malzeme_adi: str | None = Field(default=None, min_length=1, max_length=200)
    birim: str | None = Field(default=None, max_length=30)
    miktar: float | None = Field(default=None, ge=0.0)
    min_miktar: float | None = Field(default=None, ge=0.0)


class StokKalemiResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    musteri_id: str
    proje_id: str | None = None
    malzeme_adi: str
    birim: str | None = None
    miktar: float
    min_miktar: float
    kritik: bool
    created_at: str | None = None
    updated_at: str | None = None

    @classmethod
    def from_orm_with_kritik(cls, kalem: StokKalemi) -> "StokKalemiResponse":
        data = {
            "id": kalem.id,
            "musteri_id": kalem.musteri_id,
            "proje_id": kalem.proje_id,
            "malzeme_adi": kalem.malzeme_adi,
            "birim": kalem.birim,
            "miktar": kalem.miktar or 0.0,
            "min_miktar": kalem.min_miktar or 0.0,
            "kritik": (kalem.miktar or 0.0) <= (kalem.min_miktar or 0.0),
            "created_at": kalem.created_at,
            "updated_at": kalem.updated_at,
        }
        return cls.model_validate(data)


class HareketCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    tip: str = Field(..., description="giris | cikis | sayim")
    miktar: float = Field(..., gt=0.0)
    aciklama: str | None = None


class HareketResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    kalem_id: str
    kullanici_id: str | None = None
    tip: str
    miktar: float
    aciklama: str | None = None
    tarih: str | None = None
    created_at: str | None = None


# ---------------------------------------------------------------------------
# Yardımcı
# ---------------------------------------------------------------------------


def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


GECERLI_TIPLER = {"giris", "cikis", "sayim"}


async def _kalem_or_404(db: AsyncSession, kalem_id: str, musteri_id: str) -> StokKalemi:
    result = await db.execute(
        select(StokKalemi).where(
            StokKalemi.id == kalem_id,
            StokKalemi.musteri_id == musteri_id,
        )
    )
    kalem = result.scalar_one_or_none()
    if kalem is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Stok kalemi bulunamadı: {kalem_id}",
        )
    return kalem


# ---------------------------------------------------------------------------
# Endpoint'ler
# ---------------------------------------------------------------------------


@router.get(
    "/",
    response_model=list[StokKalemiResponse],
    summary="Stok kalemlerini listele",
)
async def list_stok(
    db: DbDep,
    musteri_id: CurrentMusteriId,
    proje_id: str | None = Query(default=None, description="Projeye göre filtrele"),
    kritik: bool | None = Query(default=None, description="True → sadece kritik kalemleri getir"),
) -> list[StokKalemiResponse]:
    """Kimliği doğrulanmış kullanıcının tenant'ına ait stok kalemlerini listeler."""
    stmt = select(StokKalemi).where(StokKalemi.musteri_id == musteri_id)
    if proje_id:
        stmt = stmt.where(StokKalemi.proje_id == proje_id)
    stmt = stmt.order_by(StokKalemi.malzeme_adi)
    result = await db.execute(stmt)
    kalemler = list(result.scalars().all())

    responses = [StokKalemiResponse.from_orm_with_kritik(k) for k in kalemler]
    if kritik is True:
        responses = [r for r in responses if r.kritik]
    elif kritik is False:
        responses = [r for r in responses if not r.kritik]
    return responses


@router.post(
    "/",
    response_model=StokKalemiResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Yeni stok kalemi oluştur",
)
async def create_stok(
    payload: StokKalemiCreate,
    db: DbDep,
    musteri_id: CurrentMusteriId,
) -> StokKalemiResponse:
    now = _now_iso()
    kalem = StokKalemi(
        musteri_id=musteri_id,
        proje_id=payload.proje_id,
        malzeme_adi=payload.malzeme_adi,
        birim=payload.birim,
        miktar=payload.miktar,
        min_miktar=payload.min_miktar,
        created_at=now,
        updated_at=now,
    )
    db.add(kalem)
    await db.commit()
    await db.refresh(kalem)
    return StokKalemiResponse.from_orm_with_kritik(kalem)


@router.get(
    "/{kalem_id}",
    response_model=StokKalemiResponse,
    summary="Stok kalemi detayı",
)
async def get_stok(
    kalem_id: str,
    db: DbDep,
    musteri_id: CurrentMusteriId,
) -> StokKalemiResponse:
    kalem = await _kalem_or_404(db, kalem_id, musteri_id)
    return StokKalemiResponse.from_orm_with_kritik(kalem)


@router.patch(
    "/{kalem_id}",
    response_model=StokKalemiResponse,
    summary="Stok kalemi güncelle",
)
async def update_stok(
    kalem_id: str,
    payload: StokKalemiUpdate,
    db: DbDep,
    musteri_id: CurrentMusteriId,
) -> StokKalemiResponse:
    kalem = await _kalem_or_404(db, kalem_id, musteri_id)
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(kalem, field, value)
    kalem.updated_at = _now_iso()
    db.add(kalem)
    await db.commit()
    await db.refresh(kalem)
    return StokKalemiResponse.from_orm_with_kritik(kalem)


@router.delete(
    "/{kalem_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Stok kalemi sil",
)
async def delete_stok(
    kalem_id: str,
    db: DbDep,
    musteri_id: CurrentMusteriId,
) -> None:
    kalem = await _kalem_or_404(db, kalem_id, musteri_id)
    await db.delete(kalem)
    await db.commit()


@router.post(
    "/{kalem_id}/hareket",
    response_model=HareketResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Stok hareketi ekle",
)
async def add_hareket(
    kalem_id: str,
    payload: HareketCreate,
    db: DbDep,
    musteri_id: CurrentMusteriId,
    current_user: CurrentUser,
) -> StokHareketi:
    """Giriş/çıkış/sayım hareketi ekler ve kalem stok miktarını günceller."""
    if payload.tip not in GECERLI_TIPLER:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Geçersiz hareket tipi: {payload.tip}. Geçerli değerler: giris, cikis, sayim",
        )
    kalem = await _kalem_or_404(db, kalem_id, musteri_id)

    now = _now_iso()
    hareket = StokHareketi(
        kalem_id=kalem_id,
        kullanici_id=current_user.id,
        tip=payload.tip,
        miktar=payload.miktar,
        aciklama=payload.aciklama,
        tarih=now,
        created_at=now,
    )

    # Stok miktarını güncelle
    if payload.tip == "giris":
        kalem.miktar = (kalem.miktar or 0.0) + payload.miktar
    elif payload.tip == "cikis":
        yeni_miktar = (kalem.miktar or 0.0) - payload.miktar
        if yeni_miktar < 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Çıkış miktarı mevcut stoktan fazla olamaz.",
            )
        kalem.miktar = yeni_miktar
    elif payload.tip == "sayim":
        kalem.miktar = payload.miktar

    kalem.updated_at = _now_iso()
    db.add(hareket)
    db.add(kalem)
    await db.commit()
    await db.refresh(hareket)
    return hareket


@router.get(
    "/{kalem_id}/hareketler",
    response_model=list[HareketResponse],
    summary="Stok hareket listesi",
)
async def list_hareketler(
    kalem_id: str,
    db: DbDep,
    musteri_id: CurrentMusteriId,
) -> list[StokHareketi]:
    # Önce kalem tenant kontrolü
    await _kalem_or_404(db, kalem_id, musteri_id)
    result = await db.execute(
        select(StokHareketi)
        .where(StokHareketi.kalem_id == kalem_id)
        .order_by(StokHareketi.created_at.desc())
    )
    return list(result.scalars().all())
