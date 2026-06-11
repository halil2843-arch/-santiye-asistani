"""Toplantı notları endpoint'leri.

GET    /api/v1/toplanti/        — liste (proje_id filtresi)
POST   /api/v1/toplanti/        — yeni toplantı
GET    /api/v1/toplanti/{id}    — detay
PATCH  /api/v1/toplanti/{id}    — güncelle (not ekle)
DELETE /api/v1/toplanti/{id}    — sil
"""

from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentMusteriId
from app.core.database import get_db
from app.models.toplanti import Toplanti

router = APIRouter(tags=["toplanti"])

DbDep = Annotated[AsyncSession, Depends(get_db)]


# ---------------------------------------------------------------------------
# Pydantic V2 şemaları
# ---------------------------------------------------------------------------


class ToplantiCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    proje_id: str | None = None
    baslik: str = Field(..., min_length=1, max_length=300)
    tarih: str = Field(..., min_length=1, max_length=50)
    yer: str | None = Field(default=None, max_length=200)
    notlar: str | None = None
    katilanlar: str | None = Field(
        default=None,
        description='JSON string: [{"isim":"...","rol":"..."}]',
    )


class ToplantiUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    proje_id: str | None = None
    baslik: str | None = Field(default=None, min_length=1, max_length=300)
    tarih: str | None = None
    yer: str | None = None
    notlar: str | None = None
    katilanlar: str | None = None


class ToplantiResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    musteri_id: str
    proje_id: str | None = None
    baslik: str
    tarih: str
    yer: str | None = None
    notlar: str | None = None
    katilanlar: str | None = None
    created_at: str | None = None


# ---------------------------------------------------------------------------
# Yardımcı
# ---------------------------------------------------------------------------


def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


async def _toplanti_or_404(db: AsyncSession, toplanti_id: str, musteri_id: str) -> Toplanti:
    result = await db.execute(
        select(Toplanti).where(
            Toplanti.id == toplanti_id,
            Toplanti.musteri_id == musteri_id,
        )
    )
    t = result.scalar_one_or_none()
    if t is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Toplantı bulunamadı: {toplanti_id}",
        )
    return t


# ---------------------------------------------------------------------------
# Endpoint'ler
# ---------------------------------------------------------------------------


@router.get(
    "/",
    response_model=list[ToplantiResponse],
    summary="Toplantıları listele",
)
async def list_toplantilar(
    db: DbDep,
    musteri_id: CurrentMusteriId,
    proje_id: str | None = Query(default=None),
) -> list[Toplanti]:
    stmt = select(Toplanti).where(Toplanti.musteri_id == musteri_id)
    if proje_id:
        stmt = stmt.where(Toplanti.proje_id == proje_id)
    stmt = stmt.order_by(Toplanti.tarih.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post(
    "/",
    response_model=ToplantiResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Yeni toplantı oluştur",
)
async def create_toplanti(
    payload: ToplantiCreate,
    db: DbDep,
    musteri_id: CurrentMusteriId,
) -> Toplanti:
    toplanti = Toplanti(
        musteri_id=musteri_id,
        proje_id=payload.proje_id,
        baslik=payload.baslik,
        tarih=payload.tarih,
        yer=payload.yer,
        notlar=payload.notlar,
        katilanlar=payload.katilanlar,
        created_at=_now_iso(),
    )
    db.add(toplanti)
    await db.commit()
    await db.refresh(toplanti)
    return toplanti


@router.get(
    "/{toplanti_id}",
    response_model=ToplantiResponse,
    summary="Toplantı detayı",
)
async def get_toplanti(
    toplanti_id: str,
    db: DbDep,
    musteri_id: CurrentMusteriId,
) -> Toplanti:
    return await _toplanti_or_404(db, toplanti_id, musteri_id)


@router.patch(
    "/{toplanti_id}",
    response_model=ToplantiResponse,
    summary="Toplantı güncelle",
)
async def update_toplanti(
    toplanti_id: str,
    payload: ToplantiUpdate,
    db: DbDep,
    musteri_id: CurrentMusteriId,
) -> Toplanti:
    """Toplantı bilgilerini günceller; not eklemek için `notlar` alanını değiştirin."""
    toplanti = await _toplanti_or_404(db, toplanti_id, musteri_id)
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(toplanti, field, value)
    db.add(toplanti)
    await db.commit()
    await db.refresh(toplanti)
    return toplanti


@router.delete(
    "/{toplanti_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Toplantı sil",
)
async def delete_toplanti(
    toplanti_id: str,
    db: DbDep,
    musteri_id: CurrentMusteriId,
) -> None:
    toplanti = await _toplanti_or_404(db, toplanti_id, musteri_id)
    await db.delete(toplanti)
    await db.commit()
