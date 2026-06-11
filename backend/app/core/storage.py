"""
Dosya depolama abstraction katmanı.

Şu an lokal disk kullanıyor.
Production'da STORAGE_BACKEND=s3 ayarı ile S3/R2'ye geçer.

Kullanım:
    from app.core.storage import storage

    yol = await storage.save(dosya_bytes, "foto.jpg", prefix="proje_abc")
    url  = await storage.url(yol)
    var  = await storage.exists(yol)
    await storage.delete(yol)

Not:
    - LocalStorage: geliştirme ve test ortamı için yeterli.
    - save() her çağrıda UUID prefix ekler; dosya adı çakışması olmaz.
    - Production: STORAGE_BACKEND=s3 + S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY ayarla.
"""

import os
import uuid
from pathlib import Path

from app.core.config import settings


class LocalStorage:
    """Lokal disk üzerinde dosya depolama.

    Args:
        base_dir: Tüm dosyaların yazılacağı kök dizin (settings.UPLOAD_DIR).
    """

    def __init__(self, base_dir: str) -> None:
        self.base_dir = Path(base_dir)

    async def save(self, data: bytes, filename: str, prefix: str = "") -> str:
        """Dosyayı diske yazar ve tam yolu döndürür.

        Args:
            data: Yazılacak ham byte verisi.
            filename: Orijinal dosya adı (güvenli UUID prefix eklenir).
            prefix: Alt dizin adı (örn. musteri_id veya proje_id).

        Returns:
            Dosyanın tam yolu (str); url() ve delete() metotlarında kullanılır.
        """
        guvenli_ad = f"{uuid.uuid4()}_{filename}"
        klasor = self.base_dir / prefix if prefix else self.base_dir
        klasor.mkdir(parents=True, exist_ok=True)
        yol = klasor / guvenli_ad
        yol.write_bytes(data)
        return str(yol)

    async def url(self, path: str) -> str:
        """Dosyanın erişim URL/yolunu döndürür.

        Lokal depolamada tam dosya yolu döner.
        S3'te ön-imzalı URL veya CDN adresi döner.

        Args:
            path: save() tarafından döndürülen tam yol.

        Returns:
            Erişim URL'i ya da yolu.
        """
        return path

    async def delete(self, path: str) -> None:
        """Dosyayı diskten siler; dosya yoksa sessizce geçer.

        Args:
            path: save() tarafından döndürülen tam yol.
        """
        try:
            Path(path).unlink()
        except FileNotFoundError:
            pass

    async def exists(self, path: str) -> bool:
        """Dosyanın mevcut olup olmadığını kontrol eder.

        Args:
            path: save() tarafından döndürülen tam yol.

        Returns:
            True ise dosya mevcut.
        """
        return Path(path).exists()


def _make_storage() -> LocalStorage:
    """Ayarlara göre doğru storage backend'ini döndürür.

    STORAGE_BACKEND=s3  → S3Storage (henüz implement edilmedi)
    STORAGE_BACKEND=local (default) → LocalStorage
    """
    backend: str = getattr(settings, "STORAGE_BACKEND", "local")
    if backend == "s3":
        # S3 implementasyonu eklendiğinde buraya gelecek:
        # from app.core.s3_storage import S3Storage
        # return S3Storage(
        #     bucket=settings.S3_BUCKET,
        #     region=settings.S3_REGION,
        #     access_key=settings.S3_ACCESS_KEY,
        #     secret_key=settings.S3_SECRET_KEY,
        # )
        raise NotImplementedError(
            "S3 storage backend henüz implement edilmedi. "
            "app/core/s3_storage.py dosyasını oluşturun veya STORAGE_BACKEND=local kullanın."
        )
    return LocalStorage(base_dir=settings.UPLOAD_DIR)


# Uygulama genelinde tek storage nesnesi (singleton)
storage: LocalStorage = _make_storage()
