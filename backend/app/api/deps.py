"""FastAPI dependency injection yardımcıları.

Kullanım:
    from app.api.deps import CurrentUser, CurrentMusteriId

    @router.get("/...")
    async def endpoint(musteri_id: CurrentMusteriId, db: DbDep):
        ...
"""

from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_token
from app.models.tenant import Kullanici

# /api/v1/auth/login endpoint'ini tokenUrl olarak göster (Swagger'da kilit ikonu)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

DbDep = Annotated[AsyncSession, Depends(get_db)]

_CREDENTIALS_EXCEPTION = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Kimlik bilgileri doğrulanamadı.",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: DbDep,
) -> Kullanici:
    """Bearer token'ı decode ederek ilgili Kullanici nesnesini döndürür.

    Raises:
        401: Token geçersiz, süresi dolmuş veya kullanıcı bulunamazsa.
        403: Kullanıcı hesabı pasifse.
    """
    try:
        payload = decode_token(token)
        user_id: str | None = payload.get("sub")
        if not user_id:
            raise _CREDENTIALS_EXCEPTION
    except JWTError:
        raise _CREDENTIALS_EXCEPTION

    stmt = select(Kullanici).where(Kullanici.id == user_id)
    kullanici = (await db.execute(stmt)).scalar_one_or_none()

    if kullanici is None:
        raise _CREDENTIALS_EXCEPTION

    if not kullanici.aktif:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Kullanıcı hesabı pasif.",
        )

    return kullanici


async def get_current_musteri_id(
    current_user: Annotated[Kullanici, Depends(get_current_user)],
) -> str:
    """Kimliği doğrulanmış kullanıcının musteri_id'sini döndürür.

    Tenant isolation için tüm korumalı endpoint'lerde kullanılır.
    """
    return current_user.musteri_id


# ---------------------------------------------------------------------------
# Tip takma adları — endpoint imzalarını kısaltır
# ---------------------------------------------------------------------------

CurrentUser = Annotated[Kullanici, Depends(get_current_user)]
CurrentMusteriId = Annotated[str, Depends(get_current_musteri_id)]


async def require_admin(current_user: Annotated[Kullanici, Depends(get_current_user)]) -> Kullanici:
    if current_user.rol != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bu işlem için admin yetkisi gerekli.")
    return current_user


AdminUser = Annotated[Kullanici, Depends(require_admin)]
