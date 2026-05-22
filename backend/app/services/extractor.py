"""
Şantiye Asistanı - Groq LLM Entegrasyonu (metin analizi)

Fotoğraf analizi şimdilik devre dışı — sadece WhatsApp metin mesajları işlenir.
"""

from __future__ import annotations

import json
import logging
from datetime import date
from typing import Optional

from groq import Groq
from pydantic import ValidationError

from .extraction_prompt import (
    SYSTEM_PROMPT,
    MAPPING_SYSTEM_PROMPT,
    build_extraction_prompt,
    build_mapping_prompt,
)
from .schemas import ExtractionSonucu
from app.core.config import settings

logger = logging.getLogger(__name__)

DEFAULT_MODEL = settings.DEFAULT_MODEL
DEFAULT_TEMPERATURE = 0.1
MAX_TOKENS = 2048
MAX_RETRY = 2


def _groq_client() -> Groq:
    api_key = settings.GROQ_API_KEY
    if not api_key:
        raise EnvironmentError("GROQ_API_KEY .env dosyasında bulunamadı.")
    return Groq(api_key=api_key)


def _parse_extraction_sonucu(ham_json: str, orijinal_mesajlar: list[str]) -> ExtractionSonucu:
    try:
        veri = json.loads(ham_json)
    except json.JSONDecodeError as e:
        logger.error("JSON parse hatası. Ham çıktı:\n%s", ham_json[:500])
        raise ValueError(f"Groq geçersiz JSON döndürdü: {e}") from e

    veri.setdefault("ham_mesajlar", orijinal_mesajlar)
    if "hava_durumu" not in veri or veri["hava_durumu"] is None:
        veri["hava_durumu"] = {}
    # Eksik ekip_adi olan personel kayitlarini temizle
    if "personel" in veri and isinstance(veri["personel"], list):
        veri["personel"] = [p for p in veri["personel"] if p.get("ekip_adi")]

    try:
        return ExtractionSonucu(**veri)
    except ValidationError as e:
        logger.error("Pydantic doğrulama hatası: %s", e)
        raise


def extract_from_messages(
    mesajlar: list[str],
    foto_urls: Optional[list[str]] = None,
    alan_listesi: Optional[list[str]] = None,
    bugun: Optional[date] = None,
    model: str = DEFAULT_MODEL,
) -> ExtractionSonucu:
    """
    WhatsApp mesajlarından yapılandırılmış şantiye raporu verisi çıkarır.

    Args:
        mesajlar:     O gün gelen WhatsApp metin mesajları.
        foto_urls:    Şimdilik kullanılmıyor (fotoğraf desteği sonraki sürümde).
        alan_listesi: Müşterinin Excel şablonundan okunan özel alan adları.
        bugun:        Raporun tarihi. None → date.today()
        model:        Kullanılacak Groq modeli.
    """
    alan_listesi = alan_listesi or []
    bugun_obj = bugun or date.today()

    if foto_urls:
        logger.debug("foto_urls extractor'a iletildi (%d URL); Gemini analizi rapor_servisi'nde yapılır.", len(foto_urls))

    client = _groq_client()

    user_metin = build_extraction_prompt(
        alan_listesi=alan_listesi,
        mesajlar=mesajlar,
        bugun=bugun_obj,
    )

    son_hata: Exception | None = None

    for deneme in range(1, MAX_RETRY + 1):
        try:
            logger.info("Groq çağrısı yapılıyor (deneme %d/%d)...", deneme, MAX_RETRY)

            yanit = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_metin},
                ],
                response_format={"type": "json_object"},
                temperature=DEFAULT_TEMPERATURE,
                max_tokens=MAX_TOKENS,
            )

            ham_json = yanit.choices[0].message.content or ""
            sonuc = _parse_extraction_sonucu(ham_json, mesajlar)

            logger.info(
                "Extraction tamamlandı. Personel: %d, Makine: %d, İş: %d, Belirsiz: %d",
                len(sonuc.personel), len(sonuc.makineler),
                len(sonuc.yapilan_isler), len(sonuc.belirsiz_alanlar),
            )
            return sonuc

        except (ValueError, ValidationError) as e:
            son_hata = e
            logger.warning("Parse hatası (deneme %d): %s", deneme, e)

    raise RuntimeError(
        f"Groq extraction {MAX_RETRY} denemede başarısız oldu. Son hata: {son_hata}"
    ) from son_hata


def map_to_template_fields(
    sonuc: ExtractionSonucu,
    alan_listesi: list[str],
    model: str = DEFAULT_MODEL,
) -> dict:
    """İkinci aşama: ExtractionSonucu'nu şablon alanlarına doğrudan eşler.

    Args:
        sonuc:        Aşama 1 extraction çıktısı.
        alan_listesi: Doldurulacak şablon alan adları.
        model:        Groq modeli.

    Returns:
        {alan_adı: değer} sözlüğü. Hata durumunda {} döner (heuristic fallback devreye girer).
    """
    if not alan_listesi:
        return {}

    client = _groq_client()
    extraction_data = sonuc.model_dump(mode="json")
    user_metin = build_mapping_prompt(alan_listesi, extraction_data)

    if not user_metin:
        logger.info("Template mapping: tüm alanlar heuristic ile çözülüyor, LLM atlanıyor.")
        return {}

    son_hata: Exception | None = None

    for deneme in range(1, MAX_RETRY + 1):
        try:
            logger.info("Template mapping başlatılıyor (deneme %d/%d)...", deneme, MAX_RETRY)

            yanit = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": MAPPING_SYSTEM_PROMPT},
                    {"role": "user", "content": user_metin},
                ],
                response_format={"type": "json_object"},
                temperature=0.0,
                max_tokens=1024,
            )

            ham_json = yanit.choices[0].message.content or "{}"
            esleme: dict = json.loads(ham_json)

            dolu = sum(1 for v in esleme.values() if v is not None)
            logger.info(
                "Template mapping tamamlandı. %d/%d alan dolduruldu.",
                dolu, len(alan_listesi),
            )
            return esleme

        except Exception as e:
            son_hata = e
            logger.warning("Template mapping hatası (deneme %d): %s", deneme, e)

    logger.error(
        "Template mapping %d denemede başarısız, heuristic fallback aktif. Hata: %s",
        MAX_RETRY, son_hata,
    )
    return {}


def analyze_fotograf(foto_urls: list[str], fotograf_notu: Optional[str] = None, model: str = DEFAULT_MODEL) -> str:
    """Fotoğraf analizi — gemini_analyzer.analyze_photos kullanın."""
    from app.services.gemini_analyzer import analyze_photos
    return analyze_photos(foto_urls)
