"""Basit in-memory rate limiter.

Production'da Redis tabanlıya geçilmeli (örn. slowapi + Redis backend).
Bu implementasyon tek-process, tek-worker ortamlar için yeterlidir.

Kullanım:
    @router.post("/login")
    @rate_limit(maks_istek=10, pencere_saniye=60)
    async def login(request: Request, ...):
        ...
"""

import time
from collections import defaultdict
from functools import wraps

from fastapi import HTTPException, Request

# Global sayaç — modül düzeyinde singleton (tek process'te paylaşılır)
_istek_sayaci: dict[str, list[float]] = defaultdict(list)


def rate_limit(maks_istek: int = 5, pencere_saniye: int = 60):
    """Decorator: IP başına pencere_saniye içinde maks_istek izin ver.

    Args:
        maks_istek: İzin verilen maksimum istek sayısı (varsayılan: 5).
        pencere_saniye: Zaman penceresi saniye cinsinden (varsayılan: 60).

    Raises:
        HTTPException 429: Limit aşıldığında döner.

    Güvenlik notu:
        - IP adresi X-Forwarded-For değil, doğrudan bağlantı host'undan alınır.
          Reverse proxy arkasında çalışıyorsanız TrustedHostMiddleware +
          ProxyHeadersMiddleware ekleyerek gerçek client IP'sini alın.
        - In-memory olduğundan uygulama yeniden başlatıldığında sayaçlar sıfırlanır.
        - Çoklu worker/process ortamında her process kendi sayacını tutar;
          Production'da Redis + slowapi kullanın.
    """

    def decorator(func):
        @wraps(func)
        async def wrapper(request: Request, *args, **kwargs):
            ip = request.client.host if request.client else "unknown"
            simdi = time.monotonic()
            pencere_baslangic = simdi - pencere_saniye

            # Pencere dışı kalan eski kayıtları temizle
            _istek_sayaci[ip] = [
                t for t in _istek_sayaci[ip] if t > pencere_baslangic
            ]

            if len(_istek_sayaci[ip]) >= maks_istek:
                raise HTTPException(
                    status_code=429,
                    detail=(
                        f"Çok fazla istek. "
                        f"Lütfen {pencere_saniye} saniye sonra tekrar deneyin."
                    ),
                )

            _istek_sayaci[ip].append(simdi)
            return await func(request, *args, **kwargs)

        return wrapper

    return decorator


def rate_limit_sayaci_temizle(ip: str | None = None) -> None:
    """Test ve bakım amaçlı sayaç temizleme yardımcısı.

    Args:
        ip: Belirli bir IP'nin sayacını temizler. None ise tüm sayaçları sıfırlar.
    """
    if ip is None:
        _istek_sayaci.clear()
    else:
        _istek_sayaci.pop(ip, None)
