"""Kimlik doğrulama endpoint'leri.

POST  /api/v1/auth/register  — yeni Musteri + admin Kullanici kaydı
POST  /api/v1/auth/login     — email + şifre → access_token
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, ConfigDict, EmailStr, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.rate_limit import rate_limit
from app.core.security import (
    create_access_token,
    create_refresh_token,
    verify_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.api.deps import CurrentMusteriId
from app.models.tenant import Kullanici, Musteri

router = APIRouter(prefix="/auth", tags=["auth"])

DbDep = Annotated[AsyncSession, Depends(get_db)]

# OAuth2 scheme — logout endpoint'i için token almak amacıyla
_oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


# ---------------------------------------------------------------------------
# Pydantic şemaları
# ---------------------------------------------------------------------------


class RegisterRequest(BaseModel):
    """Kayıt isteği: yeni firma + ilk admin kullanıcı."""

    model_config = ConfigDict(str_strip_whitespace=True)

    # Musteri bilgileri
    firma_adi: str
    firma_email: EmailStr

    # Kullanici bilgileri
    ad_soyad: str
    email: EmailStr
    sifre: str

    @field_validator("sifre")
    @classmethod
    def sifre_uzunluk(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Şifre en az 8 karakter olmalıdır.")
        return v


class RegisterResponse(BaseModel):
    """Kayıt başarılı yanıtı."""

    musteri_id: str
    kullanici_id: str
    email: str
    mesaj: str


class LoginRequest(BaseModel):
    """Giriş isteği."""

    model_config = ConfigDict(str_strip_whitespace=True)

    email: EmailStr
    sifre: str


class TokenResponse(BaseModel):
    """Access token yanıtı (login)."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    kullanici_id: str
    musteri_id: str
    rol: str


class RefreshRequest(BaseModel):
    """Refresh token isteği."""

    refresh_token: str


class AccessTokenResponse(BaseModel):
    """Yenilenen access token yanıtı."""

    access_token: str
    token_type: str = "bearer"


# ---------------------------------------------------------------------------
# Endpoint'ler
# ---------------------------------------------------------------------------


@router.post(
    "/register",
    response_model=RegisterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Yeni firma ve admin kullanıcı kaydı",
)
@rate_limit(maks_istek=5, pencere_saniye=60)
async def register(request: Request, payload: RegisterRequest, db: DbDep) -> RegisterResponse:
    """Yeni bir Musteri (firma) ve bu firmaya bağlı admin rolünde Kullanici oluşturur.

    - firma_email veya kullanici email daha önce kayıtlıysa 409 döner.
    - Şifre hiçbir zaman plain text olarak veritabanına yazılmaz.

    Raises:
        409: Email zaten kayıtlıysa.
    """
    # Firma email kontrolü
    musteri_stmt = select(Musteri).where(Musteri.email == payload.firma_email)
    existing_musteri = (await db.execute(musteri_stmt)).scalar_one_or_none()
    if existing_musteri:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bu firma e-postası zaten kayıtlı.",
        )

    # Kullanici email kontrolü
    kullanici_stmt = select(Kullanici).where(Kullanici.email == payload.email)
    existing_kullanici = (await db.execute(kullanici_stmt)).scalar_one_or_none()
    if existing_kullanici:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bu kullanıcı e-postası zaten kayıtlı.",
        )

    # Musteri oluştur
    musteri = Musteri(
        firma_adi=payload.firma_adi,
        email=payload.firma_email,
    )
    db.add(musteri)
    await db.flush()  # musteri.id üretilsin

    # Kullanici oluştur (admin rol)
    kullanici = Kullanici(
        musteri_id=musteri.id,
        ad_soyad=payload.ad_soyad,
        email=payload.email,
        sifre_hash=hash_password(payload.sifre),
        rol="admin",
    )
    db.add(kullanici)
    await db.commit()
    await db.refresh(kullanici)

    return RegisterResponse(
        musteri_id=musteri.id,
        kullanici_id=kullanici.id,
        email=kullanici.email,
        mesaj="Kayıt başarılı. Giriş yapabilirsiniz.",
    )


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Giriş yap ve access token al",
)
@rate_limit(maks_istek=10, pencere_saniye=60)
async def login(request: Request, payload: LoginRequest, db: DbDep) -> TokenResponse:
    """Email ve şifre ile giriş yapar; JWT access token döndürür.

    Token payload'u şunları içerir:
        sub  — kullanici.id
        mid  — musteri.id (tenant ID)
        rol  — kullanici.rol

    Raises:
        401: Email bulunamazsa veya şifre yanlışsa.
        403: Kullanıcı veya müşteri hesabı pasifse.
    """
    # Kullaniciyi bul
    stmt = select(Kullanici).where(Kullanici.email == payload.email)
    kullanici = (await db.execute(stmt)).scalar_one_or_none()

    if kullanici is None or not verify_password(payload.sifre, kullanici.sifre_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-posta veya şifre hatalı.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not kullanici.aktif:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Kullanıcı hesabı pasif.",
        )

    # Müşteri aktiflik kontrolü
    musteri_stmt = select(Musteri).where(Musteri.id == kullanici.musteri_id)
    musteri = (await db.execute(musteri_stmt)).scalar_one_or_none()
    if musteri is None or not musteri.aktif:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Firma hesabı pasif veya bulunamadı.",
        )

    # Token üret
    token_data = {
        "sub": kullanici.id,
        "mid": kullanici.musteri_id,
        "rol": kullanici.rol,
    }
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(kullanici.id)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        kullanici_id=kullanici.id,
        musteri_id=kullanici.musteri_id,
        rol=kullanici.rol,
    )


@router.post(
    "/refresh",
    response_model=AccessTokenResponse,
    summary="Refresh token ile yeni access token al",
)
@rate_limit(maks_istek=20, pencere_saniye=60)
async def refresh_token(request: Request, payload: RefreshRequest, db: DbDep) -> AccessTokenResponse:
    """Geçerli bir refresh token ile yeni bir access token üretir.

    Refresh token 7 gün geçerlidir. Access token süresi dolduğunda
    bu endpoint kullanılarak yeni token alınır; kullanıcının tekrar
    giriş yapması gerekmez.

    Raises:
        401: Refresh token geçersiz veya süresi dolmuşsa.
        403: Kullanıcı veya müşteri hesabı pasifse.
        404: Kullanıcı bulunamazsa.
    """
    # Refresh token'ı doğrula ve kullanici_id'yi al
    kullanici_id = verify_refresh_token(payload.refresh_token)

    # Kullaniciyi bul ve durumunu kontrol et
    stmt = select(Kullanici).where(Kullanici.id == kullanici_id)
    kullanici = (await db.execute(stmt)).scalar_one_or_none()

    if kullanici is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kullanıcı bulunamadı.",
        )

    if not kullanici.aktif:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Kullanıcı hesabı pasif.",
        )

    # Müşteri aktiflik kontrolü
    musteri_stmt = select(Musteri).where(Musteri.id == kullanici.musteri_id)
    musteri = (await db.execute(musteri_stmt)).scalar_one_or_none()
    if musteri is None or not musteri.aktif:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Firma hesabı pasif veya bulunamadı.",
        )

    # Yeni access token üret
    token_data = {
        "sub": kullanici.id,
        "mid": kullanici.musteri_id,
        "rol": kullanici.rol,
    }
    new_access_token = create_access_token(token_data)

    return AccessTokenResponse(access_token=new_access_token)


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Çıkış yap — access token'ı geçersizleştir",
)
async def logout(
    token: Annotated[str, Depends(_oauth2_scheme)],
    musteri_id: CurrentMusteriId,
) -> None:
    """Mevcut access token'ı blacklist'e ekleyerek geçersizleştirir.

    Token süresi dolana kadar geçerli kalma sorununu çözer.
    Hatalı/süresi dolmuş token ile çağrılırsa sessizce 204 döner.

    Production notu: blacklist Redis'e taşınana kadar uygulama
    yeniden başlatıldığında blacklist sıfırlanır.
    """
    from app.core.token_blacklist import add_to_blacklist

    try:
        payload = decode_token(token)
        jti: str | None = payload.get("jti")
        exp: float = float(payload.get("exp", 0))
        if jti:
            add_to_blacklist(jti, exp)
    except Exception:
        # Token zaten geçersizse veya süresi dolmuşsa sessizce geç
        pass
    return None
