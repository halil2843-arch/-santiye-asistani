"""
JWT token blacklist — logout sonrası token geçersizleştirme.

Production'da Redis set'e taşınmalı (TTL = access token süresi).
Bu modül thread-safe in-memory dict kullanır; uygulama yeniden
başlatıldığında blacklist sıfırlanır (geliştirme ortamı için yeterli).

Kullanım:
    from app.core.token_blacklist import add_to_blacklist, is_blacklisted

    add_to_blacklist(jti, expires_at_timestamp)
    if is_blacklisted(jti):
        raise JWTError("Token revoke edilmiş")
"""

import time
from threading import Lock

_blacklist: dict[str, float] = {}  # jti → expire_timestamp (unix epoch)
_lock = Lock()


def add_to_blacklist(jti: str, expires_at: float) -> None:
    """Token'ı blacklist'e ekle ve süresi dolmuş girişleri temizle.

    Args:
        jti: JWT ID claim değeri.
        expires_at: Token'ın expire olacağı unix timestamp (payload["exp"]).
    """
    with _lock:
        _blacklist[jti] = expires_at
        # Süresi dolmuş token'ları temizle (bellek sızıntısını önle)
        now = time.time()
        expired = [k for k, v in _blacklist.items() if v < now]
        for k in expired:
            del _blacklist[k]


def is_blacklisted(jti: str) -> bool:
    """Token'ın blacklist'te olup olmadığını kontrol et.

    Args:
        jti: JWT ID claim değeri.

    Returns:
        True ise token revoke edilmiş, False ise geçerli.
    """
    with _lock:
        return jti in _blacklist


def blacklist_size() -> int:
    """Blacklist'teki aktif giriş sayısını döndürür (test/debug için)."""
    with _lock:
        return len(_blacklist)
