"""
Cache/Redis abstraction katmanı.

Şu an in-memory dict kullanıyor.
Production'da CACHE_BACKEND=redis ayarı ile otomatik olarak Redis'e geçer.

Kullanım:
    from app.core.cache import cache

    await cache.set("key", "value", ttl=300)
    val = await cache.get("key")
    await cache.delete("key")
    await cache.lpush("list_key", "item1", "item2", maxlen=10)
    items = await cache.lrange("list_key", 0, -1)
    exists = await cache.exists("key")

Not:
    - InMemoryCache: geliştirme ve test ortamı için yeterli.
    - Uygulama yeniden başlatılınca veriler kaybolur.
    - Production: CACHE_BACKEND=redis + REDIS_URL ayarla.
"""

import time
from typing import Any

from app.core.config import settings


class InMemoryCache:
    """Thread-safe olmayan, tek process için in-memory cache.

    asyncio event loop'unda GIL koruması sayesinde race condition
    oluşmaz; multi-process (Gunicorn workers) durumunda paylaşılmaz.
    """

    def __init__(self) -> None:
        # key → (value, expires_at); expires_at=0 sonsuz süre
        self._store: dict[str, tuple[Any, float]] = {}
        self._lists: dict[str, list[Any]] = {}

    async def get(self, key: str) -> Any | None:
        """Key'e karşılık gelen değeri döndürür; yoksa ya da süresi dolmuşsa None."""
        entry = self._store.get(key)
        if entry is None:
            return None
        val, exp = entry
        if exp and time.time() > exp:
            del self._store[key]
            return None
        return val

    async def set(self, key: str, value: Any, ttl: int = 0) -> None:
        """Key-value çifti yazar.

        Args:
            key: Cache anahtarı.
            value: Herhangi bir Python nesnesi.
            ttl: Saniye cinsinden geçerlilik süresi; 0 = sonsuz.
        """
        exp = time.time() + ttl if ttl else 0.0
        self._store[key] = (value, exp)

    async def delete(self, key: str) -> None:
        """Key'i hem store hem de lists'ten siler (varsa)."""
        self._store.pop(key, None)
        self._lists.pop(key, None)

    async def lpush(self, key: str, *values: Any, maxlen: int = 100) -> None:
        """Liste başına bir veya daha fazla değer ekler; maxlen'den uzarsa sondan kırpar.

        Args:
            key: Liste anahtarı.
            *values: Eklenecek değerler (soldan sağa listeye eklenir).
            maxlen: Listenin tutabileceği maksimum eleman sayısı.
        """
        lst = self._lists.setdefault(key, [])
        for v in reversed(values):
            lst.insert(0, v)
        if len(lst) > maxlen:
            self._lists[key] = lst[:maxlen]

    async def lrange(self, key: str, start: int, end: int) -> list[Any]:
        """Listeden dilim döndürür (Redis lrange semantiği).

        Args:
            key: Liste anahtarı.
            start: Başlangıç indeksi (0-tabanlı).
            end: Bitiş indeksi; -1 son elemana kadar.

        Returns:
            İstenen dilim listesi; key yoksa boş liste.
        """
        lst = self._lists.get(key, [])
        if end == -1:
            return lst[start:]
        return lst[start : end + 1]

    async def llen(self, key: str) -> int:
        """Listedeki eleman sayısını döndürür."""
        return len(self._lists.get(key, []))

    async def exists(self, key: str) -> bool:
        """Key'in cache'de var olup olmadığını döndürür."""
        return (await self.get(key)) is not None

    async def flush(self) -> None:
        """Tüm cache'i temizler (test sonrası teardown için)."""
        self._store.clear()
        self._lists.clear()


class RedisCache:
    """Redis tabanlı cache — production için.

    redis>=5.0.0 paketinin kurulu olması gerekir.
    Kurulu değilse otomatik olarak InMemoryCache'e düşer (import fallback).

    Kullanım:
        CACHE_BACKEND=redis
        REDIS_URL=redis://localhost:6379
    """

    def __init__(self, url: str) -> None:
        try:
            import redis.asyncio as aioredis  # type: ignore[import]
            self._redis = aioredis.from_url(url, decode_responses=False)
            self._available = True
        except ImportError:
            import warnings
            warnings.warn(
                "redis paketi bulunamadı; InMemoryCache kullanılıyor. "
                "Production için: pip install redis>=5.0.0",
                stacklevel=3,
            )
            self._available = False
            self._fallback = InMemoryCache()

    async def get(self, key: str) -> Any | None:
        if not self._available:
            return await self._fallback.get(key)  # type: ignore[attr-defined]
        import pickle
        val = await self._redis.get(key)
        return pickle.loads(val) if val else None  # noqa: S301

    async def set(self, key: str, value: Any, ttl: int = 0) -> None:
        if not self._available:
            return await self._fallback.set(key, value, ttl)  # type: ignore[attr-defined]
        import pickle
        data = pickle.dumps(value)
        if ttl:
            await self._redis.setex(key, ttl, data)
        else:
            await self._redis.set(key, data)

    async def delete(self, key: str) -> None:
        if not self._available:
            return await self._fallback.delete(key)  # type: ignore[attr-defined]
        await self._redis.delete(key)

    async def lpush(self, key: str, *values: Any, maxlen: int = 100) -> None:
        if not self._available:
            return await self._fallback.lpush(key, *values, maxlen=maxlen)  # type: ignore[attr-defined]
        import pickle
        pipe = self._redis.pipeline()
        for v in values:
            pipe.lpush(key, pickle.dumps(v))
        pipe.ltrim(key, 0, maxlen - 1)
        await pipe.execute()

    async def lrange(self, key: str, start: int, end: int) -> list[Any]:
        if not self._available:
            return await self._fallback.lrange(key, start, end)  # type: ignore[attr-defined]
        import pickle
        items = await self._redis.lrange(key, start, end)
        return [pickle.loads(i) for i in items]  # noqa: S301

    async def exists(self, key: str) -> bool:
        if not self._available:
            return await self._fallback.exists(key)  # type: ignore[attr-defined]
        return bool(await self._redis.exists(key))

    async def llen(self, key: str) -> int:
        if not self._available:
            return await self._fallback.llen(key)  # type: ignore[attr-defined]
        return int(await self._redis.llen(key))

    async def flush(self) -> None:
        if not self._available:
            return await self._fallback.flush()  # type: ignore[attr-defined]
        await self._redis.flushdb()


def _make_cache() -> "InMemoryCache | RedisCache":
    """Ayarlara göre doğru cache backend'ini döndürür.

    CACHE_BACKEND=redis → RedisCache (redis paketi kuruluysa)
    CACHE_BACKEND=memory (default) → InMemoryCache
    """
    backend: str = getattr(settings, "CACHE_BACKEND", "memory")
    if backend == "redis":
        url: str = getattr(settings, "REDIS_URL", "redis://localhost:6379")
        return RedisCache(url)
    return InMemoryCache()


# Uygulama genelinde tek cache nesnesi (singleton)
cache: InMemoryCache | RedisCache = _make_cache()
