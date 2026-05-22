"""Koordinatör yönetimi endpoint'leri.

GET    /api/v1/koordinator/       — koordinatör listesi
POST   /api/v1/koordinator/       — yeni koordinatör ekle
DELETE /api/v1/koordinator/{id}   — koordinatör sil (soft-delete)
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentMusteriId
from app.core.database import get_db
from app.models.koordinator import Koordinator

router = APIRouter(prefix="/koordinator", tags=["koordinator"])

DbDep = Annotated[AsyncSession, Depends(get_db)]


class KoordinatorCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    whatsapp_numara: str = Field(..., description="E.164 formatı: +905551234567")
    aciklama: str | None = Field(default=None, max_length=200)

    @field_validator("whatsapp_numara")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        v = v.strip()
        if not v.startswith("+"):
            raise ValueError("Numara '+' ile başlamalı (E.164).")
        if not v[1:].isdigit():
            raise ValueError("Numara yalnızca rakam içermeli ('+' hariç).")
        return v


class KoordinatorResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    musteri_id: str
    whatsapp_numara: str
    aciklama: str | None
    aktif: bool


@router.get(
    "/",
    response_model=list[KoordinatorResponse],
    summary="Koordinatör listesi",
)
async def list_koordinatorler(
    db: DbDep,
    musteri_id: CurrentMusteriId,
) -> list[KoordinatorResponse]:
    stmt = (
        select(Koordinator)
        .where(Koordinator.musteri_id == musteri_id, Koordinator.aktif.is_(True))
        .order_by(Koordinator.created_at.desc())
    )
    result = await db.execute(stmt)
    return [KoordinatorResponse.model_validate(k) for k in result.scalars().all()]


@router.post(
    "/",
    response_model=KoordinatorResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Yeni koordinatör ekle",
)
async def create_koordinator(
    payload: KoordinatorCreate,
    db: DbDep,
    musteri_id: CurrentMusteriId,
) -> KoordinatorResponse:
    # Numara çakışması: başka tenant'ta da olsa unique
    stmt = select(Koordinator).where(Koordinator.whatsapp_numara == payload.whatsapp_numara)
    if (await db.execute(stmt)).scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{payload.whatsapp_numara} zaten koordinatör olarak kayıtlı.",
        )

    # Aynı numara bir şantiyeye de bağlı olamaz
    from app.models.site import Santiye
    stmt2 = select(Santiye).where(Santiye.whatsapp_numara == payload.whatsapp_numara)
    if (await db.execute(stmt2)).scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{payload.whatsapp_numara} zaten bir şantiyeye bağlı.",
        )

    k = Koordinator(
        musteri_id=musteri_id,
        whatsapp_numara=payload.whatsapp_numara,
        aciklama=payload.aciklama,
    )
    db.add(k)
    await db.commit()
    await db.refresh(k)
    return KoordinatorResponse.model_validate(k)


@router.delete(
    "/{koordinator_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Koordinatör sil",
)
async def delete_koordinator(
    koordinator_id: str,
    db: DbDep,
    musteri_id: CurrentMusteriId,
) -> None:
    stmt = select(Koordinator).where(
        Koordinator.id == koordinator_id,
        Koordinator.musteri_id == musteri_id,
    )
    k = (await db.execute(stmt)).scalar_one_or_none()
    if k is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Koordinatör bulunamadı.")
    k.aktif = False
    await db.commit()
