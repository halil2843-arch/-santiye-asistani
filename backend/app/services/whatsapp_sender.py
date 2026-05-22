"""Twilio üzerinden WhatsApp mesajı gönderme servisi."""

import asyncio
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


def _send_sync(to_number: str, mesaj: str) -> str:
    """Senkron Twilio çağrısı — thread pool içinde çalışır."""
    from twilio.rest import Client  # noqa: PLC0415

    client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
    msg = client.messages.create(
        from_=f"whatsapp:{settings.TWILIO_WHATSAPP_FROM}",
        to=f"whatsapp:{to_number}",
        body=mesaj,
    )
    return msg.sid


async def whatsapp_bildirim_gonder(to_number: str, mesaj: str) -> None:
    """Koordinatöre WhatsApp bildirimi gönderir (non-blocking).

    Twilio kimlik bilgileri eksikse veya paket yoksa sessizce loglar.
    """
    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
        logger.warning("Twilio kimlik bilgileri eksik — bildirim gönderilmedi.")
        return

    try:
        import twilio  # noqa: F401
    except ImportError:
        logger.warning("twilio paketi kurulu değil — bildirim gönderilmedi.")
        return

    try:
        sid = await asyncio.to_thread(_send_sync, to_number, mesaj)
        logger.info("WhatsApp bildirimi gönderildi → %s (SID=%s)", to_number, sid)
    except Exception as exc:
        logger.error("WhatsApp bildirimi gönderilemedi (%s): %s", to_number, exc)
