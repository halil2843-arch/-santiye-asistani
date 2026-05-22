"""Güvenlik yardımcıları: parola hash ve JWT işlemleri."""

from datetime import datetime, timedelta, timezone
from typing import Any

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
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    """JWT token'ı decode eder ve payload'u döndürür.

    Args:
        token: Kodlanmış JWT string.

    Returns:
        Token payload dict'i.

    Raises:
        JWTError: Token geçersiz veya süresi dolmuşsa.
    """
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
