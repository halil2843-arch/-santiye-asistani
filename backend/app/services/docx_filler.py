"""Word (docx) sablon doldurucu — docxtpl (Jinja2) tabanli.

Sablon icerisinde {{ tarih }}, {{ hava_sabah }}, {{ personel }} gibi Jinja2
yer tutuculari kullanilir.

Kullanim:
    cikti = fill_docx(
        sablon_yolu="./uploads/sablonlar/gunluk.docx",
        sonuc=extraction_sonucu,
        cikti_yolu="./outputs/site1/rapor_20260506_a3b4c5d6.docx",
    )
"""

from __future__ import annotations

import logging

from docxtpl import DocxTemplate

from .schemas import ExtractionSonucu

logger = logging.getLogger(__name__)


def _context_olustur(sonuc: ExtractionSonucu) -> dict:
    """ExtractionSonucu'ndan docxtpl context sozlugu uretir."""
    context: dict = {
        # Tarih
        "tarih": sonuc.tarih.strftime("%d.%m.%Y"),

        # Hava durumu (tekil alanlar)
        "hava_sabah": sonuc.hava_durumu.sabah or "",
        "hava_ogleden_sonra": sonuc.hava_durumu.ogleden_sonra or "",
        "hava_sicaklik": sonuc.hava_durumu.sicaklik_derece,
        "hava_genel": sonuc.hava_durumu.genel_aciklama or "",

        # Ozet sayilar
        "toplam_personel": sum(p.sayi for p in sonuc.personel),

        # Fotograf analizi
        "fotograf_analizi": sonuc.fotograf_analizi or "",

        # Liste alanlari — Jinja2 for donguleri icin
        "personel": [
            {
                "ekip_adi": p.ekip_adi,
                "meslek": p.meslek,
                "sayi": p.sayi,
            }
            for p in sonuc.personel
        ],
        "makineler": [
            {
                "makine_tipi": m.makine_tipi,
                "sayi": m.sayi,
                "calisma_saati": m.calisma_saati if m.calisma_saati is not None else "",
            }
            for m in sonuc.makineler
        ],
        "yapilan_isler": [
            {
                "kategori": y.kategori,
                "aciklama": y.aciklama,
                "ilgili_firma": y.ilgili_firma or "",
            }
            for y in sonuc.yapilan_isler
        ],
        "malzeme_girisi": [
            {
                "malzeme_adi": ml.malzeme_adi,
                "miktar": ml.miktar,
                "birim": ml.birim,
            }
            for ml in sonuc.malzeme_girisi
        ],
        "belirsiz_alanlar": [
            {
                "alan_adi": b.alan_adi,
                "mevcut_deger": b.mevcut_deger or "",
                "neden_belirsiz": b.neden_belirsiz,
            }
            for b in sonuc.belirsiz_alanlar
        ],
    }
    return context


def fill_docx(
    sablon_yolu: str,
    sonuc: ExtractionSonucu,
    cikti_yolu: str,
) -> str:
    """Word sablonunu ExtractionSonucu verileriyle doldurur.

    docxtpl, orijinal sablonu degistirmez; render sonucunu yeni dosyaya yazar.

    Args:
        sablon_yolu:  Kaynak docx sablonunun disk yolu.
        sonuc:        GPT-4o extraction sonucu.
        cikti_yolu:   Yazilacak cikti dosyasinin tam yolu.

    Returns:
        cikti_yolu — basarili oldugunda ayni degeri geri verir.
    """
    doc = DocxTemplate(sablon_yolu)
    context = _context_olustur(sonuc)

    logger.info(
        "Word sablon render ediliyor: %s  (personel=%d, makine=%d, is=%d)",
        sablon_yolu,
        len(sonuc.personel),
        len(sonuc.makineler),
        len(sonuc.yapilan_isler),
    )

    doc.render(context)
    doc.save(cikti_yolu)

    logger.info("Word raporu kaydedildi: %s", cikti_yolu)
    return cikti_yolu
