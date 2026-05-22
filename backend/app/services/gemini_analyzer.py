"""Gemini 2.0 Flash ile şantiye fotoğrafı analizi.

Twilio MediaUrl'lerini indirip Gemini'ye göndererek Türkçe bir
inşaat sahası özeti döndürür. Çağrılar sync'tir; asyncio.to_thread ile çalıştırın.
"""

from __future__ import annotations

import base64
import logging
from typing import TYPE_CHECKING

import httpx

from app.core.config import settings

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)

_ANALIZ_PROMPT = (
    "Sen bir inşaat şantiyesi raporlama asistanısın. "
    "Aşağıdaki şantiye fotoğraflarını incele ve kısa bir Türkçe özet yaz:\n"
    "- Sahada yapılan işler\n"
    "- Görünen makine ve ekipmanlar\n"
    "- Yaklaşık çalışan personel sayısı\n"
    "- İnşaatın genel durumu ve ilerleme düzeyi\n"
    "- Dikkat çekici güvenlik durumları (varsa)\n\n"
    "Yalnızca gördüklerini yaz; tahmin yapma. Madde madde, Türkçe."
)


def _indir(url: str) -> tuple[bytes, str]:
    """Twilio veya genel bir URL'den görüntü indirir.

    Returns:
        (ham_bayt, mime_type) çifti
    """
    auth = None
    if "twilio.com" in url and settings.TWILIO_ACCOUNT_SID and settings.TWILIO_AUTH_TOKEN:
        auth = (settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)

    with httpx.Client(timeout=30.0, follow_redirects=True) as client:
        yanit = client.get(url, auth=auth)
        yanit.raise_for_status()

    mime_type = yanit.headers.get("content-type", "image/jpeg").split(";")[0].strip()
    return yanit.content, mime_type


def analyze_photos(foto_urls: list[str]) -> str:
    """Fotoğrafları Gemini 2.0 Flash ile analiz eder.

    Args:
        foto_urls: Twilio veya diğer kaynaklardan gelen görüntü URL'leri.

    Returns:
        Türkçe analiz metni. Hata veya fotoğraf yoksa boş string.
    """
    if not foto_urls:
        return ""

    if not settings.GEMINI_API_KEY:
        logger.warning("GEMINI_API_KEY tanımlı değil; fotoğraf analizi atlanıyor.")
        return ""

    try:
        from google import genai
        from google.genai import types  # type: ignore[attr-defined]
    except ImportError:
        logger.error("google-genai paketi kurulu değil. 'pip install google-genai' çalıştırın.")
        return ""

    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    parcalar: list = [types.Part.from_text(text=_ANALIZ_PROMPT)]

    for url in foto_urls:
        try:
            veri, mime_type = _indir(url)
            parcalar.append(types.Part.from_bytes(data=veri, mime_type=mime_type))
            logger.info("Fotoğraf indirildi: %s (%d B)", url[:70], len(veri))
        except Exception as exc:
            logger.warning("Fotoğraf indirilemedi (%s): %s", url[:70], exc)

    if len(parcalar) == 1:
        logger.warning("Hiç fotoğraf indirilemedi; analiz atlanıyor.")
        return ""

    try:
        yanit = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=parcalar,
        )
        metin = (yanit.text or "").strip()
        logger.info("Gemini analizi tamamlandı (%d karakter).", len(metin))
        return metin
    except Exception as exc:
        logger.error("Gemini API hatası: %s", exc)
        return ""
