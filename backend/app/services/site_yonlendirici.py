"""Koordinatör mesajlarını şantiye bazında bölen Groq servisi.

Tek bir WhatsApp mesajında birden fazla şantiyenin raporu olabilir.
Bu modül LLM ile mesajı okur, hangi bölüm hangi şantiyeye ait belirler.
"""

from __future__ import annotations

import json
import logging
from typing import TypedDict

from groq import Groq

from app.core.config import settings

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """Sen bir inşaat şantiyesi asistanısın.
Görevin: Koordinatörden gelen WhatsApp mesajını analiz edip,
içindeki şantiye bazlı bölümleri tespit etmek.

Kurallar:
- Mesajda birden fazla şantiyenin raporu olabilir (ayrı ayrı veya iç içe)
- Şantiye adı tam eşleşmeyebilir; yakın isim / kısaltma / sıra numarası ile eşleştir
- Bir bölüm birden fazla şantiyeye ait olamaz
- Hangi şantiyeye ait olduğu belli olmayan içeriği "bilinmeyen" olarak döndür
- Sadece JSON döndür, başka açıklama ekleme"""


def _build_prompt(mesaj: str, santiyeler: list[dict]) -> str:
    santiye_listesi = "\n".join(
        f'- "{s["isim"]}" (id: {s["id"]})'
        for s in santiyeler
    )
    return f"""Mevcut şantiyeler:
{santiye_listesi}

Koordinatör mesajı:
\"\"\"
{mesaj}
\"\"\"

Mesajı şantiye bazında böl. JSON formatında döndür:
{{
  "parcalar": [
    {{
      "santiye_id": "<id veya null>",
      "santiye_isim": "<eşleşen şantiye adı veya 'bilinmeyen'>",
      "icerik": "<bu şantiyeye ait orijinal mesaj içeriği>"
    }}
  ]
}}"""


class MesajParcasi(TypedDict):
    santiye_id: str | None
    santiye_isim: str
    icerik: str


def yonlendir(mesaj: str, santiyeler: list[dict]) -> list[MesajParcasi]:
    """Mesajı şantiye bazında böler.

    Args:
        mesaj:      Koordinatörden gelen ham WhatsApp mesajı.
        santiyeler: [{"id": "...", "isim": "..."}] formatında şantiye listesi.

    Returns:
        Her şantiye için {"santiye_id", "santiye_isim", "icerik"} listesi.
        Tanımlanamayan içerik santiye_id=None ile döner.
    """
    if not santiyeler:
        logger.warning("Şantiye listesi boş, yönlendirme yapılamıyor.")
        return [{"santiye_id": None, "santiye_isim": "bilinmeyen", "icerik": mesaj}]

    if not settings.GROQ_API_KEY:
        raise EnvironmentError("GROQ_API_KEY eksik.")

    client = Groq(api_key=settings.GROQ_API_KEY)
    prompt = _build_prompt(mesaj, santiyeler)

    for deneme in range(1, 3):
        try:
            yanit = client.chat.completions.create(
                model=settings.DEFAULT_MODEL,
                messages=[
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                response_format={"type": "json_object"},
                temperature=0.0,
                max_tokens=1024,
            )

            ham = yanit.choices[0].message.content or "{}"
            veri = json.loads(ham)
            parcalar: list[MesajParcasi] = veri.get("parcalar", [])

            if not parcalar:
                logger.warning("LLM boş parça listesi döndürdü.")
                return [{"santiye_id": None, "santiye_isim": "bilinmeyen", "icerik": mesaj}]

            # santiye_id doğrulama: LLM yanlış id üretebilir
            gecerli_idler = {s["id"] for s in santiyeler}
            for p in parcalar:
                if p.get("santiye_id") and p["santiye_id"] not in gecerli_idler:
                    logger.warning("LLM geçersiz santiye_id üretti: %s", p["santiye_id"])
                    p["santiye_id"] = None

            logger.info(
                "Koordinatör mesajı %d parçaya bölündü: %s",
                len(parcalar),
                [p["santiye_isim"] for p in parcalar],
            )
            return parcalar

        except Exception as exc:
            logger.warning("Yönlendirme hatası (deneme %d): %s", deneme, exc)

    logger.error("Yönlendirme %d denemede başarısız, tüm içerik 'bilinmeyen' şantiyeye atandı.")
    return [{"santiye_id": None, "santiye_isim": "bilinmeyen", "icerik": mesaj}]
