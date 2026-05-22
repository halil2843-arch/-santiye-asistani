"""Günlük geç rapor uyarısı — APScheduler ile her gün 18:00 İstanbul saatinde çalışır."""

import logging
from datetime import date, datetime, timedelta, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import cast, select
from sqlalchemy.dialects.sqlite import DATE as SqliteDate

from app.core.database import AsyncSessionLocal
from app.models.koordinator import Koordinator
from app.models.message import WhatsappMesaji
from app.models.site import Santiye
from app.services.whatsapp_sender import whatsapp_bildirim_gonder

logger = logging.getLogger(__name__)

_scheduler = AsyncIOScheduler(timezone="Europe/Istanbul")


def _bugun_istanbul() -> date:
    return datetime.now(tz=timezone(timedelta(hours=3))).date()


async def gec_rapor_uyarisi_gonder() -> None:
    logger.info("Geç rapor kontrolü başlatıldı.")
    try:
        bugun = _bugun_istanbul()
        async with AsyncSessionLocal() as db:
            santiyeler = (
                await db.execute(select(Santiye).where(Santiye.aktif.is_(True)))
            ).scalars().all()

            for santiye in santiyeler:
                mesaj_stmt = select(WhatsappMesaji.id).where(
                    WhatsappMesaji.santiye_id == santiye.id,
                    cast(WhatsappMesaji.created_at, SqliteDate) == bugun,
                ).limit(1)
                mesaj_var = (await db.execute(mesaj_stmt)).first() is not None
                if mesaj_var:
                    continue

                logger.info("Geç rapor uyarısı: %s", santiye.isim)
                if santiye.whatsapp_numara:
                    await whatsapp_bildirim_gonder(
                        santiye.whatsapp_numara,
                        "⚠️ Bugün şantiye raporu henüz alınmadı. Lütfen günlük bilgi gönderin.",
                    )

                koordinatorler = (
                    await db.execute(
                        select(Koordinator).where(
                            Koordinator.musteri_id == santiye.musteri_id,
                            Koordinator.aktif.is_(True),
                        )
                    )
                ).scalars().all()
                for k in koordinatorler:
                    await whatsapp_bildirim_gonder(
                        k.whatsapp_numara,
                        f"⚠️ *{santiye.isim}* şantiyesinden bugün mesaj gelmedi.",
                    )
    except Exception:
        logger.exception("Geç rapor uyarısı görevinde hata oluştu.")


def baslat_zamanlayici() -> None:
    _scheduler.add_job(
        gec_rapor_uyarisi_gonder,
        trigger="cron",
        hour=18,
        minute=0,
        id="gec_rapor_uyarisi",
        replace_existing=True,
    )
    _scheduler.start()
    logger.info("Bildirim zamanlayıcısı başlatıldı (her gün 18:00 İstanbul).")


def durdur_zamanlayici() -> None:
    if _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("Bildirim zamanlayıcısı durduruldu.")
