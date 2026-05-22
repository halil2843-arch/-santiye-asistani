"""Rapor uretim orkestratoru.

Tek giris noktasi: uret_rapor(rapor_id, db)

Is akisi:
  1. DB'den Rapor + iliskili Sablon + WhatsappMesajlari yukle
  2. Islenmemis mesajlarin metin ve foto URL'lerini topla
  3. Sablon alan_esleme'sinden alan listesini cikar (extraction'a rehber olur)
  4. extract_from_messages() cagir (sync → asyncio.to_thread ile)
  5. Cikti dosya yolunu belirle: OUTPUT_DIR/{santiye_id}/rapor_{tarih}_{rapor_id[:8]}.{format}
  6. Formata gore fill_xlsx veya fill_docx cagir
  7. Rapor.cikti_dosya_yolu guncelle + mesajlari islendi=True yap
  8. DB commit et, dosya yolunu don
"""

from __future__ import annotations

import asyncio
import logging
import os
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.models.message import WhatsappMesaji
from app.models.report import Rapor
from app.models.site import Sablon, Santiye
from .docx_filler import fill_docx
from .excel_filler import fill_xlsx
from .extractor import extract_from_messages, map_to_template_fields
from .gemini_analyzer import analyze_photos

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Yardimci fonksiyonlar
# ---------------------------------------------------------------------------


def _cikti_yolu_olustur(
    santiye_id: str,
    rapor_id: str,
    tarih: date,
    format: str,
) -> str:
    """Aylık çıktı dosyasının tam disk yolunu üretir ve dizini oluşturur.

    Aynı ay içindeki tüm günler aynı dosyada ayrı sekmeler olarak tutulur.
    rapor_id parametresi artık kullanılmıyor (geriye dönük uyum için korundu).
    """
    ay_str = tarih.strftime("%Y%m")  # "202605"
    dosya_adi = f"rapor_{ay_str}.{format}"

    dizin = os.path.join(settings.OUTPUT_DIR, santiye_id)
    os.makedirs(dizin, exist_ok=True)

    return os.path.join(dizin, dosya_adi)


def _alan_listesi_cikar(alan_esleme: dict) -> list[str]:
    """alan_esleme sozlugundeki degerleri (alan adlarini) benzersiz liste olarak dondurur."""
    return list(dict.fromkeys(alan_esleme.values()))


# ---------------------------------------------------------------------------
# Ana orkestratör
# ---------------------------------------------------------------------------


async def uret_rapor(
    rapor_id: str,
    db: AsyncSession,
) -> str:
    """Raporu uretir ve cikti dosya yolunu dondurur.

    Args:
        rapor_id: Uretilecek raporun UUID'si (Rapor.id).
        db:       Aktif async veritabani oturumu.

    Returns:
        Uretilen cikti dosyasinin tam disk yolu.

    Raises:
        ValueError: Rapor, sablon veya mesaj bulunamazsa.
        RuntimeError: Dosya uretimi sirasinda beklenmedik hata olusursa.
    """
    # ------------------------------------------------------------------
    # 1. DB'den Rapor + iliskili mesajlari yukle
    # ------------------------------------------------------------------
    stmt = (
        select(Rapor)
        .where(Rapor.id == rapor_id)
        .options(selectinload(Rapor.mesajlar))
    )
    result = await db.execute(stmt)
    rapor: Rapor | None = result.scalar_one_or_none()

    if rapor is None:
        raise ValueError(f"Rapor bulunamadi: {rapor_id}")

    if not rapor.sablon_id:
        raise ValueError(f"Rapor'a sablon atanmamis: {rapor_id}")

    # ------------------------------------------------------------------
    # 2. Sablonu yukle
    # ------------------------------------------------------------------
    sablon_stmt = select(Sablon).where(Sablon.id == rapor.sablon_id)
    sablon_result = await db.execute(sablon_stmt)
    sablon: Sablon | None = sablon_result.scalar_one_or_none()

    if sablon is None:
        raise ValueError(f"Sablon bulunamadi: {rapor.sablon_id}")

    if not os.path.exists(sablon.dosya_yolu):
        raise ValueError(f"Sablon dosyasi diskte bulunamadi: {sablon.dosya_yolu}")

    # ------------------------------------------------------------------
    # 3. Islenmemis mesajlarin iceriklerini topla
    # ------------------------------------------------------------------
    mesajlar: list[WhatsappMesaji] = rapor.mesajlar  # type: ignore[assignment]
    islenmemis = [m for m in mesajlar if not m.islendi]

    metin_mesajlar: list[str] = [
        m.icerik for m in islenmemis if m.icerik  # type: ignore[misc]
    ]
    # medya_url alanı birden fazla URL'i \n ile saklayabilir — düzleştir
    foto_urls: list[str] = [
        url
        for m in islenmemis
        if m.medya_url
        for url in m.medya_url.split("\n")  # type: ignore[union-attr]
        if url.strip()
    ]

    if not metin_mesajlar and not foto_urls:
        logger.warning(
            "Rapor %s icin islenmemis metin veya fotograf bulunamadi.", rapor_id
        )
        metin_mesajlar = ["(Islenmemis mesaj bulunamadi)"]

    # ------------------------------------------------------------------
    # 3b. Fotoğraf analizi (Gemini 2.0 Flash)
    # ------------------------------------------------------------------
    foto_analizi: str = ""
    if foto_urls:
        logger.info("Gemini fotoğraf analizi başlatılıyor — %d fotoğraf", len(foto_urls))
        try:
            foto_analizi = await asyncio.to_thread(analyze_photos, foto_urls)
        except asyncio.CancelledError:
            logger.warning("Gemini fotoğraf analizi iptal edildi, devam ediliyor.")
        except Exception as exc:
            logger.warning("Gemini fotoğraf analizi hatası: %s", exc)

        if foto_analizi:
            metin_mesajlar = [f"[FOTOĞRAF ANALİZİ]:\n{foto_analizi}"] + metin_mesajlar
            logger.info("Fotoğraf analizi Groq bağlamına eklendi.")

    # ------------------------------------------------------------------
    # 4. Alan listesini cikar (extraction'a rehber)
    # ------------------------------------------------------------------
    alan_esleme: dict = sablon.alan_esleme or {}  # type: ignore[assignment]
    alan_listesi = _alan_listesi_cikar(alan_esleme)

    # ------------------------------------------------------------------
    # 4b. Santiye adini yukle
    # ------------------------------------------------------------------
    santiye_stmt = select(Santiye).where(Santiye.id == rapor.santiye_id)
    santiye_result = await db.execute(santiye_stmt)
    santiye: Santiye | None = santiye_result.scalar_one_or_none()
    santiye_adi = santiye.isim if santiye else None

    # ------------------------------------------------------------------
    # 5. GPT-4o extraction (sync → thread)
    # ------------------------------------------------------------------
    logger.info(
        "Extraction baslatiliyor — rapor=%s mesaj_sayisi=%d foto_sayisi=%d",
        rapor_id, len(metin_mesajlar), len(foto_urls),
    )

    sonuc = await asyncio.to_thread(
        extract_from_messages,
        metin_mesajlar,
        foto_urls or None,
        alan_listesi or None,
        rapor.tarih,  # type: ignore[arg-type]
    )

    sonuc.santiye_adi = santiye_adi
    if foto_analizi and not sonuc.fotograf_analizi:
        sonuc.fotograf_analizi = foto_analizi

    logger.info(
        "Extraction tamamlandi — personel=%d makine=%d is=%d belirsiz=%d",
        len(sonuc.personel),
        len(sonuc.makineler),
        len(sonuc.yapilan_isler),
        len(sonuc.belirsiz_alanlar),
    )

    # ------------------------------------------------------------------
    # 5b. Aşama 2 — şablon alanlarına doğrudan LLM eşleme
    # ------------------------------------------------------------------
    logger.info("Template mapping başlatılıyor — %d benzersiz alan", len(alan_listesi))

    try:
        llm_mapping: dict = await asyncio.to_thread(
            map_to_template_fields,
            sonuc,
            alan_listesi,
        )
    except asyncio.CancelledError:
        logger.warning("Template mapping iptal edildi (istemci bağlantısı kesildi), heuristic fallback aktif.")
        llm_mapping = {}
        # CancelledError'ü yutuyoruz — rapor üretimi devam edecek
    except Exception as e:
        logger.warning("Template mapping hatası, heuristic fallback aktif: %s", e)
        llm_mapping = {}

    dolu = sum(1 for v in llm_mapping.values() if v is not None)
    logger.info(
        "Template mapping tamamlandı — %d/%d alan eşlendi",
        dolu, len(alan_listesi),
    )

    # ------------------------------------------------------------------
    # 6. Cikti dosya yolunu belirle
    # ------------------------------------------------------------------
    format_str: str = sablon.format  # type: ignore[assignment]  # "xlsx" | "docx"
    cikti_yolu = _cikti_yolu_olustur(
        santiye_id=rapor.santiye_id,  # type: ignore[arg-type]
        rapor_id=rapor_id,
        tarih=rapor.tarih,  # type: ignore[arg-type]
        format=format_str,
    )

    # ------------------------------------------------------------------
    # 7. Formata gore sablon doldurma (sync → thread)
    # ------------------------------------------------------------------
    sablon_yolu: str = sablon.dosya_yolu  # type: ignore[assignment]

    if format_str == "xlsx":
        await asyncio.to_thread(
            fill_xlsx,
            sablon_yolu,
            alan_esleme,
            sonuc,
            cikti_yolu,
            llm_mapping,
        )
    elif format_str == "docx":
        await asyncio.to_thread(
            fill_docx,
            sablon_yolu,
            sonuc,
            cikti_yolu,
        )
    else:
        raise ValueError(f"Desteklenmeyen sablon formati: {format_str!r}")

    logger.info("Cikti dosyasi olusturuldu: %s", cikti_yolu)

    # ------------------------------------------------------------------
    # 8. DB guncelle: cikti_dosya_yolu + mesajlari islendi=True
    # ------------------------------------------------------------------
    rapor.cikti_dosya_yolu = cikti_yolu  # type: ignore[assignment]

    for mesaj in islenmemis:
        mesaj.islendi = True  # type: ignore[assignment]

    await db.commit()

    logger.info("Rapor DB guncellendi ve commit edildi: %s", rapor_id)
    return cikti_yolu
