"""Kullanıcı yönetimi endpoint'leri (admin only).

GET    /api/v1/users/      — tenant kullanıcılarını listele
POST   /api/v1/users/      — yeni kullanıcı ekle
PATCH  /api/v1/users/{id}  — güncelle (ad, rol, aktif)
DELETE /api/v1/users/{id}  — pasif yap
"""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, EmailStr, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import AdminUser, CurrentUser, get_db
from app.core.security import hash_password
from app.models.tenant import Kullanici

router = APIRouter(prefix="/users", tags=["users"])

DbDep = Annotated[AsyncSession, Depends(get_db)]


class KullaniciCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    ad_soyad: str
    email: EmailStr
    sifre: str
    rol: Literal["editor", "viewer"] = "viewer"
    telefon_no: str | None = None

    @field_validator("sifre")
    @classmethod
    def sifre_uzunluk(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Şifre en az 8 karakter olmalıdır.")
        return v


class KullaniciUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    ad_soyad: str | None = None
    rol: Literal["admin", "editor", "viewer"] | None = None
    aktif: bool | None = None
    telefon_no: str | None = None


class KullaniciResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    musteri_id: str
    ad_soyad: str
    email: str
    telefon_no: str | None
    rol: str
    aktif: bool


@router.get("/", response_model=list[KullaniciResponse])
async def list_users(db: DbDep, admin: AdminUser) -> list[KullaniciResponse]:
    stmt = (
        select(Kullanici)
        .where(Kullanici.musteri_id == admin.musteri_id)
        .order_by(Kullanici.ad_soyad)
    )
    kullanicilar = (await db.execute(stmt)).scalars().all()
    return [KullaniciResponse.model_validate(k) for k in kullanicilar]


@router.post("/", response_model=KullaniciResponse, status_code=status.HTTP_201_CREATED)
async def create_user(payload: KullaniciCreate, db: DbDep, admin: AdminUser) -> KullaniciResponse:
    existing = (await db.execute(select(Kullanici).where(Kullanici.email == payload.email))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Bu e-posta zaten kayıtlı.")

    kullanici = Kullanici(
        musteri_id=admin.musteri_id,
        ad_soyad=payload.ad_soyad,
        email=payload.email,
        sifre_hash=hash_password(payload.sifre),
        rol=payload.rol,
        telefon_no=payload.telefon_no,
        aktif=True,
    )
    db.add(kullanici)
    await db.commit()
    await db.refresh(kullanici)
    return KullaniciResponse.model_validate(kullanici)


@router.patch("/{kullanici_id}", response_model=KullaniciResponse)
async def update_user(
    kullanici_id: str,
    payload: KullaniciUpdate,
    db: DbDep,
    admin: AdminUser,
) -> KullaniciResponse:
    stmt = select(Kullanici).where(
        Kullanici.id == kullanici_id,
        Kullanici.musteri_id == admin.musteri_id,
    )
    kullanici = (await db.execute(stmt)).scalar_one_or_none()
    if kullanici is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kullanıcı bulunamadı.")

    if payload.ad_soyad is not None:
        kullanici.ad_soyad = payload.ad_soyad
    if payload.telefon_no is not None:
        kullanici.telefon_no = payload.telefon_no
    if payload.rol is not None:
        if kullanici_id == admin.id and payload.rol != "admin":
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Kendi rolünüzü değiştiremezsiniz.")
        kullanici.rol = payload.rol
    if payload.aktif is not None:
        if kullanici_id == admin.id and not payload.aktif:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Kendinizi pasif yapamazsınız.")
        kullanici.aktif = payload.aktif

    db.add(kullanici)
    await db.commit()
    await db.refresh(kullanici)
    return KullaniciResponse.model_validate(kullanici)


@router.delete("/{kullanici_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(kullanici_id: str, db: DbDep, admin: AdminUser) -> None:
    if kullanici_id == admin.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Kendinizi silemezsiniz.")

    stmt = select(Kullanici).where(
        Kullanici.id == kullanici_id,
        Kullanici.musteri_id == admin.musteri_id,
    )
    kullanici = (await db.execute(stmt)).scalar_one_or_none()
    if kullanici is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kullanıcı bulunamadı.")

    kullanici.aktif = False
    db.add(kullanici)
    await db.commit()
