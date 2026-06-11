"""Güvenlik yardımcıları: parola hash ve JWT işlemleri."""

import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

# ---------------------------------------------------------------------------
# Parola hash
# ---------------------------------------------------------------------------

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    """Düz metin parolayı bcrypt ile hashler."""
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    """Düz metin parolayı hash ile karşılaştırır."""
    return _pwd_context.verify(plain, hashed)


# ---------------------------------------------------------------------------
# JWT
# ---------------------------------------------------------------------------


def create_access_token(
    data: dict[str, Any],
    expires_delta: timedelta | None = None,
) -> str:
    """JWT access token oluşturur.

    Args:
        data: Token payload'una eklenecek veriler (genellikle {"sub": user_id}).
        expires_delta: Geçerlilik süresi; None ise settings'teki varsayılan kullanılır.

    Returns:
        Kodlanmış JWT string.
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta
        if expires_delta is not None
        else timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode["exp"] = expire
    # jti (JWT ID): her token'a benzersiz kimlik; revocation için gerekli
    to_encode["jti"] = str(uuid.uuid4())
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    """JWT token'ı decode eder, blacklist kontrolü yapar ve payload'u döndürür.

    Args:
        token: Kodlanmış JWT string.

    Returns:
        Token payload dict'i.

    Raises:
        JWTError: Token geçersiz, süresi dolmuş veya revoke edilmişse.
    """
    from app.core.token_blacklist import is_blacklisted

    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    jti: str | None = payload.get("jti")
    if jti and is_blacklisted(jti):
        raise JWTError("Token revoke edilmiş")
    return payload


# ---------------------------------------------------------------------------
# Refresh Token
# ---------------------------------------------------------------------------


def create_refresh_token(subject: str) -> str:
    """7 günlük refresh token oluşturur.

    Args:
        subject: Token subject'i (genellikle kullanici.id).

    Returns:
        Kodlanmış JWT refresh token string.
    """
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload: dict[str, Any] = {
        "sub": subject,
        "exp": expire,
        "type": "refresh",
    }
    # alg: none saldırısına karşı algoritma her zaman explicit belirtilir
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def verify_refresh_token(token: str) -> str:
    """Refresh token doğrular, subject (kullanici_id) döndürür.

    Args:
        token: Kodlanmış refresh token.

    Returns:
        Token subject'i (kullanici_id).

    Raises:
        HTTPException 401: Token geçersiz, süresi dolmuş veya tipi yanlışsa.
    """
    try:
        # algorithms listesi ile alg: none saldırısını engelle
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("type") != "refresh":
            raise ValueError("Geçersiz token tipi")
        subject: str | None = payload.get("sub")
        if not subject:
            raise ValueError("Token subject boş")
        return subject
    except JWTError:
        raise HTTPException(status_code=401, detail="Refresh token geçersiz veya süresi dolmuş")
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc))
