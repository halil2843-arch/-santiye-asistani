"""Şantiye yönetimi ve onboarding endpoint'leri.

GET   /api/v1/sites/                        — tüm şantiyeleri listele
POST  /api/v1/sites/                        — yeni şantiye oluştur
PATCH /api/v1/sites/{santiye_id}            — şantiye bilgilerini güncelle
GET   /api/v1/sites/pending-phones          — eşleştirilmemiş bekleyen numaraları listele
POST  /api/v1/sites/{santiye_id}/link-phone — bir numarayı şantiyeye bağla
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentMusteriId
from app.core.database import get_db
from app.models.message import PendingWhatsapp
from app.models.site import Santiye, SantiyeNumara

router = APIRouter(prefix="/sites", tags=["sites"])

DbDep = Annotated[AsyncSession, Depends(get_db)]


# ---------------------------------------------------------------------------
# Pydantic V2 şemaları
# ---------------------------------------------------------------------------

class SantiyeCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    musteri_id: str = Field(..., min_length=1, description="Müşteri UUID")
    isim: str = Field(..., min_length=1, max_length=200, description="Şantiye adı")
    adres: str | None = Field(default=None, max_length=500)
    whatsapp_numara: str | None = Field(
        default=None,
        description="E.164 formatında numara: +905551234567",
    )
    il: str | None = Field(default=None, max_length=100)
    ilce: str | None = Field(default=None, max_length=100)
    enlem: float | None = Field(default=None)
    boylam: float | None = Field(default=None)
    arsiv: bool = Field(default=False)

    @field_validator("whatsapp_numara")
    @classmethod
    def validate_phone(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not v.startswith("+"):
            raise ValueError("WhatsApp numarası '+' ile başlamalı (E.164 formatı).")
        if not v[1:].isdigit():
            raise ValueError("Numara yalnızca rakam içermeli ('+' hariç).")
        return v


class SantiyeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    musteri_id: str
    isim: str
    adres: str | None = None
    whatsapp_numara: str | None = None
    aktif: bool
    il: str | None = None
    ilce: str | None = None
    enlem: float | None = None
    boylam: float | None = None
    arsiv: bool = False


class SantiyeUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    isim: str | None = Field(default=None, min_length=1, max_length=200)
    adres: str | None = Field(default=None, max_length=500)
    aktif: bool | None = None
    il: str | None = Field(default=None, max_length=100)
    ilce: str | None = Field(default=None, max_length=100)
    enlem: float | None = None
    boylam: float | None = None
    arsiv: bool | None = None

    @field_validator("isim")
    @classmethod
    def isim_bos_olamaz(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("Şantiye adı boş olamaz.")
        return v


class LinkPhoneRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    whatsapp_numara: str = Field(
        ...,
        description="Şantiyeye bağlanacak E.164 numarası: +905551234567",
    )

    @field_validator("whatsapp_numara")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        v = v.strip()
        if not v.startswith("+"):
            raise ValueError("WhatsApp numarası '+' ile başlamalı (E.164 formatı).")
        if not v[1:].isdigit():
            raise ValueError("Numara yalnızca rakam içermeli ('+' hariç).")
        return v


class LinkPhoneResponse(BaseModel):
    santiye_id: str
    whatsapp_numara: str
    pending_islendi: bool = Field(
        description="PendingWhatsapp kaydı varsa islendi=True yapıldı mı"
    )


class PendingPhoneResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    whatsapp_numara: str
    ilk_mesaj_metni: str | None = None
    islendi: bool


# ---------------------------------------------------------------------------
# Endpoint'ler
# ---------------------------------------------------------------------------

@router.get(
    "/",
    response_model=list[SantiyeResponse],
    summary="Tüm şantiyeleri listele",
)
async def list_sites(db: DbDep) -> list[Santiye]:
    """Sistemdeki tüm aktif/pasif şantiyeleri döndürür."""
    result = await db.execute(select(Santiye).order_by(Santiye.isim))
    return list(result.scalars().all())


@router.post(
    "/",
    response_model=SantiyeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Yeni şantiye oluştur",
)
async def create_site(payload: SantiyeCreate, db: DbDep) -> Santiye:
    """Yeni bir şantiye kaydı oluşturur.

    `whatsapp_numara` verilirse unique constraint geçerlidir;
    aynı numara başka şantiyede kayıtlıysa 409 döner.
    """
    # Numara çakışması kontrolü
    if payload.whatsapp_numara:
        stmt = select(Santiye).where(Santiye.whatsapp_numara == payload.whatsapp_numara)
        result = await db.execute(stmt)
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"{payload.whatsapp_numara} numarası başka bir şantiyeye kayıtlı.",
            )

    santiye = Santiye(
        musteri_id=payload.musteri_id,
        isim=payload.isim,
        adres=payload.adres,
        whatsapp_numara=payload.whatsapp_numara,
        il=payload.il,
        ilce=payload.ilce,
        enlem=payload.enlem,
        boylam=payload.boylam,
        arsiv=payload.arsiv,
    )
    db.add(santiye)
    await db.commit()
    await db.refresh(santiye)
    return santiye


@router.patch(
    "/{santiye_id}",
    response_model=SantiyeResponse,
    summary="Şantiye bilgilerini güncelle",
)
async def update_site(
    santiye_id: str,
    payload: SantiyeUpdate,
    db: DbDep,
) -> Santiye:
    """İsim, adres veya aktiflik durumunu günceller.

    Raises:
        404: Şantiye bulunamazsa.
    """
    result = await db.execute(select(Santiye).where(Santiye.id == santiye_id))
    santiye: Santiye | None = result.scalar_one_or_none()
    if santiye is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Şantiye bulunamadı: {santiye_id}",
        )

    if payload.isim is not None:
        santiye.isim = payload.isim
    if payload.adres is not None:
        santiye.adres = payload.adres
    if payload.aktif is not None:
        santiye.aktif = payload.aktif
    if payload.il is not None:
        santiye.il = payload.il
    if payload.ilce is not None:
        santiye.ilce = payload.ilce
    if payload.enlem is not None:
        santiye.enlem = payload.enlem
    if payload.boylam is not None:
        santiye.boylam = payload.boylam
    if payload.arsiv is not None:
        santiye.arsiv = payload.arsiv

    db.add(santiye)
    await db.commit()
    await db.refresh(santiye)
    return santiye


@router.get(
    "/pending-phones",
    response_model=list[PendingPhoneResponse],
    summary="Bekleyen (eşleştirilmemiş) numaraları listele",
)
async def list_pending_phones(db: DbDep) -> list[PendingWhatsapp]:
    """Henüz bir şantiyeye bağlanmamış WhatsApp numaralarını döndürür.

    Sadece `islendi=False` olan kayıtlar listelenir.
    """
    result = await db.execute(
        select(PendingWhatsapp)
        .where(PendingWhatsapp.islendi == False)  # noqa: E712
        .order_by(PendingWhatsapp.olusturma_tarihi.desc())
    )
    return list(result.scalars().all())


@router.post(
    "/{santiye_id}/link-phone",
    response_model=LinkPhoneResponse,
    summary="WhatsApp numarasını şantiyeye bağla",
)
async def link_phone_to_site(
    santiye_id: str,
    payload: LinkPhoneRequest,
    db: DbDep,
) -> LinkPhoneResponse:
    """Verilen numarayı belirtilen şantiyeye bağlar.

    - Şantiye bulunamazsa 404.
    - Numara başka şantiyede kayıtlıysa 409.
    - Başarılıysa `Santiye.whatsapp_numara` güncellenir.
    - `PendingWhatsapp`'ta eşleşen kayıt varsa `islendi=True` yapılır.
    """
    # Şantiye varlık kontrolü
    result = await db.execute(select(Santiye).where(Santiye.id == santiye_id))
    santiye: Santiye | None = result.scalar_one_or_none()
    if santiye is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Şantiye bulunamadı: {santiye_id}",
        )

    # Numara çakışması: başka şantiyede mi kayıtlı?
    stmt_conflict = (
        select(Santiye)
        .where(Santiye.whatsapp_numara == payload.whatsapp_numara)
        .where(Santiye.id != santiye_id)
    )
    conflict_result = await db.execute(stmt_conflict)
    if conflict_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"{payload.whatsapp_numara} numarası başka bir şantiyeye kayıtlı.",
        )

    # Şantiyeye numarayı bağla
    santiye.whatsapp_numara = payload.whatsapp_numara
    db.add(santiye)

    # PendingWhatsapp kaydını tamamlandı olarak işaretle
    pending_result = await db.execute(
        select(PendingWhatsapp).where(
            PendingWhatsapp.whatsapp_numara == payload.whatsapp_numara
        )
    )
    pending: PendingWhatsapp | None = pending_result.scalar_one_or_none()
    pending_islendi = False
    if pending:
        pending.islendi = True
        db.add(pending)
        pending_islendi = True

    await db.commit()

    return LinkPhoneResponse(
        santiye_id=santiye.id,
        whatsapp_numara=payload.whatsapp_numara,
        pending_islendi=pending_islendi,
    )


# ---------------------------------------------------------------------------
# Çoklu numara yönetimi
# ---------------------------------------------------------------------------

class NumaraCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    numara: str = Field(..., description="E.164 formatında numara: +905551234567")

    @field_validator("numara")
    @classmethod
    def validate_numara(cls, v: str) -> str:
        v = v.strip()
        if not v.startswith("+") or not v[1:].isdigit():
            raise ValueError("Numara E.164 formatında olmalı (+905551234567).")
        return v


class NumaraResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    santiye_id: str
    numara: str
    aktif: bool


@router.get("/{santiye_id}/phones", response_model=list[NumaraResponse])
async def list_phones(santiye_id: str, db: DbDep, musteri_id: CurrentMusteriId) -> list[NumaraResponse]:
    santiye = (await db.execute(
        select(Santiye).where(Santiye.id == santiye_id, Santiye.musteri_id == musteri_id)
    )).scalar_one_or_none()
    if santiye is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Şantiye bulunamadı.")
    numaralar = (await db.execute(
        select(SantiyeNumara).where(SantiyeNumara.santiye_id == santiye_id, SantiyeNumara.aktif.is_(True))
    )).scalars().all()
    return [NumaraResponse.model_validate(n) for n in numaralar]


@router.post("/{santiye_id}/phones", response_model=NumaraResponse, status_code=status.HTTP_201_CREATED)
async def add_phone(santiye_id: str, payload: NumaraCreate, db: DbDep, musteri_id: CurrentMusteriId) -> NumaraResponse:
    santiye = (await db.execute(
        select(Santiye).where(Santiye.id == santiye_id, Santiye.musteri_id == musteri_id)
    )).scalar_one_or_none()
    if santiye is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Şantiye bulunamadı.")

    conflict = (await db.execute(
        select(SantiyeNumara).where(SantiyeNumara.numara == payload.numara, SantiyeNumara.aktif.is_(True))
    )).scalar_one_or_none()
    if conflict:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"{payload.numara} başka bir şantiyede kayıtlı.")

    numara = SantiyeNumara(santiye_id=santiye_id, numara=payload.numara, aktif=True)
    db.add(numara)
    await db.commit()
    await db.refresh(numara)
    return NumaraResponse.model_validate(numara)


@router.delete("/{santiye_id}/phones/{numara_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_phone(santiye_id: str, numara_id: str, db: DbDep, musteri_id: CurrentMusteriId) -> None:
    santiye = (await db.execute(
        select(Santiye).where(Santiye.id == santiye_id, Santiye.musteri_id == musteri_id)
    )).scalar_one_or_none()
    if santiye is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Şantiye bulunamadı.")

    numara = (await db.execute(
        select(SantiyeNumara).where(SantiyeNumara.id == numara_id, SantiyeNumara.santiye_id == santiye_id)
    )).scalar_one_or_none()
    if numara is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Numara bulunamadı.")

    numara.aktif = False
    db.add(numara)
    await db.commit()
