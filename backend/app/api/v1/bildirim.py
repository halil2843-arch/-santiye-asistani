"""
Push notification endpoint'leri (Web Push / PWA).

Frontend'den gelen subscription'ı kaydeder ve VAPID anahtarı sağlar.
VAPID anahtarları .env'den okunur.

Kurulum:
    pip install pywebpush

Anahtar üretmek için:
    py -m py_vapid --gen-key    (pywebpush ile birlikte gelir)
"""

import json
import logging
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentMusteriId
from app.core.config import settings
from app.core.database import get_db
from app.models.bildirim import PushSubscription

logger = logging.getLogger(__name__)

router = APIRouter(tags=["bildirim"])

# ---------------------------------------------------------------------------
# Şemalar
# ---------------------------------------------------------------------------


class PushSubscriptionSchema(BaseModel):
    """Web Push abonelik nesnesi — browser tarafından oluşturulur."""

    endpoint: str
    keys: dict[str, str]  # {"auth": "...", "p256dh": "..."}


# ---------------------------------------------------------------------------
# Endpoint'ler
# ---------------------------------------------------------------------------


@router.post("/subscribe", status_code=201, summary="Push aboneliği kaydet")
async def push_abone_ol(
    sub: PushSubscriptionSchema,
    musteri_id: CurrentMusteriId,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """PWA push notification aboneliğini veritabanına kaydeder.

    Aynı endpoint zaten kayıtlıysa üstüne yazar (upsert).
    """
    p256dh = sub.keys.get("p256dh", "")
    auth = sub.keys.get("auth", "")

    # Mevcut kayıt var mı? (endpoint'e göre kontrol)
    result = await db.execute(
        select(PushSubscription).where(PushSubscription.endpoint == sub.endpoint)
    )
    existing: PushSubscription | None = result.scalar_one_or_none()

    if existing:
        # Üstüne yaz — musteri_id, p256dh, auth güncellenebilir
        existing.musteri_id = musteri_id
        existing.p256dh = p256dh
        existing.auth = auth
        db.add(existing)
        logger.info("Push aboneliği güncellendi: musteri_id=%s", musteri_id)
    else:
        new_sub = PushSubscription(
            musteri_id=musteri_id,
            endpoint=sub.endpoint,
            p256dh=p256dh,
            auth=auth,
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        db.add(new_sub)
        logger.info("Push aboneliği kaydedildi: musteri_id=%s", musteri_id)

    await db.commit()
    return {"mesaj": "Abonelik kaydedildi"}


@router.delete("/subscribe", summary="Push aboneliğini iptal et")
async def push_abonelik_iptal(
    sub: PushSubscriptionSchema,
    musteri_id: CurrentMusteriId,
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    """Verilen endpoint için push notification aboneliğini veritabanından kaldırır."""
    result = await db.execute(
        select(PushSubscription).where(
            PushSubscription.endpoint == sub.endpoint,
            PushSubscription.musteri_id == musteri_id,
        )
    )
    existing: PushSubscription | None = result.scalar_one_or_none()

    if existing:
        await db.delete(existing)
        await db.commit()
        logger.info("Push aboneliği kaldırıldı: musteri_id=%s", musteri_id)

    return {"mesaj": "Abonelik iptal edildi"}


@router.get("/vapid-public-key", summary="VAPID public key döndür")
async def vapid_public_key(musteri_id: CurrentMusteriId) -> dict[str, str]:
    """Frontend'in ServiceWorker'a iletmesi gereken VAPID public key'i döndürür.

    Key .env dosyasındaki VAPID_PUBLIC_KEY değerinden alınır.
    Yapılandırılmamışsa 503 döner.
    """
    key: str = getattr(settings, "VAPID_PUBLIC_KEY", "")
    if not key:
        raise HTTPException(
            status_code=503,
            detail="Push notification henüz yapılandırılmadı. .env dosyasına VAPID_PUBLIC_KEY ekleyin.",
        )
    return {"public_key": key}


@router.post("/test-gonder", summary="Test push bildirimi gönder")
async def test_bildirimi_gonder(
    musteri_id: CurrentMusteriId,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Aktif aboneliklere test push bildirimi gönderir (geliştirme ortamı için).

    pywebpush kurulu değilse kurulum talimatını döner.
    VAPID_PRIVATE_KEY yapılandırılmamışsa 503 döner.
    """
    result = await db.execute(
        select(PushSubscription).where(PushSubscription.musteri_id == musteri_id)
    )
    subs = list(result.scalars().all())

    if not subs:
        return {"mesaj": "Aktif abonelik yok", "gonderilen": 0}

    private_key: str = getattr(settings, "VAPID_PRIVATE_KEY", "")
    if not private_key:
        raise HTTPException(
            status_code=503,
            detail="VAPID_PRIVATE_KEY yapılandırılmamış. .env dosyasına ekleyin.",
        )

    try:
        from pywebpush import WebPushException, webpush  # type: ignore[import]
    except ImportError:
        return {
            "mesaj": "pywebpush kurulu değil — pip install pywebpush",
            "gonderilen": 0,
        }

    admin_email: str = getattr(settings, "ADMIN_EMAIL", "admin@santiye.com")
    payload = json.dumps(
        {"title": "Test Bildirimi", "body": "Şantiye Asistanı push notification çalışıyor!"}
    )

    gonderilen = 0
    for sub in subs:
        sub_info = {
            "endpoint": sub.endpoint,
            "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
        }
        try:
            webpush(
                subscription_info=sub_info,
                data=payload,
                vapid_private_key=private_key,
                vapid_claims={"sub": f"mailto:{admin_email}"},
            )
            gonderilen += 1
        except WebPushException as exc:
            logger.warning("Push gönderilemedi (%s): %s", sub.endpoint[:60], exc)
        except Exception as exc:  # noqa: BLE001
            logger.error("Beklenmedik push hatası: %s", exc)

    return {"mesaj": f"{gonderilen}/{len(subs)} bildirim gönderildi", "gonderilen": gonderilen}
