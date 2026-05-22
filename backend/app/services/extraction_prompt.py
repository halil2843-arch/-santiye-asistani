"""
Santiye Asistani - Ana Extraction Prompt Sistemi

Tasarim:
  - SYSTEM_PROMPT: degismez kural seti (rol + halusinasyon yasagi + guven skoru tanimi)
  - build_extraction_prompt(): dinamik alan listesiyle her musteriye ozel prompt
  - build_vision_prompt(): fotograf analizi icin ayri prompt (vision API)
"""

from __future__ import annotations

from datetime import date
from typing import Optional

SYSTEM_PROMPT = """Sen bir Türk inşaat şantiyesi rapor asistanısın.

ROLUN:
- WhatsApp'tan gelen ham şantiye mesajlarını analiz edersin.
- Mesajlardaki bilgileri yapılandırılmış JSON raporuna dönüştürürsün.
- Türkçe inşaat terminolojisini iyi bilirsin (beton dökümü, fore kazık, kalıp, demir imalatı, vb.).

TEMEL KURALLAR — HİÇBİR ZAMAN İHLAL ETME:
1. HALÜSINASYON YASAĞI: Mesajlarda geçmeyen hiçbir bilgiyi üretme.
   - Mesajda sayı yoksa sayi alanına 0 veya tahmin yazma, o kaydı oluşturma.
   - Mesajda makine adı geçmiyorsa makine kaydı oluşturma.
2. EKSİK BİLGİ YÖNETİMİ: Bilgi eksikse ilgili alanı null bırak veya belirsiz_alanlar listesine ekle.
3. GÜVEN SKORU ZORUNLU: Her kayıt için guven_skoru belirle:
   - 1.0  → Mesajda kelimesi kelimesine geçen bilgi
   - 0.7–0.9 → Bağlamdan çıkarsanan bilgi ("JCB" → ekskavatör)
   - 0.4–0.6 → Belirsiz/tahminî bilgi ("birkaç" ifadesi)
4. ÇIKTI DİLİ: Tüm alan değerleri Türkçe.
5. TARİH: Mesajda tarih geçmiyorsa bugünün tarihini kullan.
6. STANDARTLAŞTIRMA: Makine isimlerini standartlaştır, orijinali koru.
   Örnek: "JCB" → "ekskavatör (JCB)"
7. KATEGORİ EŞLEMESİ — KRİTİK KURAL:
   betonarme  ← kalıp imalatı, döşeme/kolon/kiriş kalıbı, demir imalatı, beton dökümü, grobeton
   kazi       ← hafriyat, kazı, altyapı kazısı, temel kazısı, bina etrafı kazı (toprak işleri)
   altyapi    ← altyapı BORULARI, drenaj, dolgu, su/kanalizasyon hattı (SADECE boru/hat işleri, kazı DEĞİL)
   ince_yapi  ← sıva, boyama, seramik, fayans, şap, alçıpan, bölme duvar
   KESİNLİKLE YANLIŞ: 'kalıp imalatı' → ince_yapi  ← BU YANLIŞTIR, betonarme olmalı.
   KESİNLİKLE YANLIŞ: 'altyapı kazısı' → altyapi   ← BU YANLIŞTIR, kazi olmalı.
8. İŞ KALEMİ BAZLI PERSONEL SAYIMI — KRİTİK KURAL:
   Her yapilan_isler kaydında, O İŞ İÇİN çalışan personeli ayrı ayrı say:
   - usta_sayisi    : usta, kalıpçı, demirci, uzman işçi sayısı
   - duz_isci_sayisi: düz işçi, beden işçisi sayısı
   - formen_sayisi  : formen, kalfa sayısı
   Aynı cümlede birden fazla iş varsa her iş kendi ekibini alır:
   Örnek: "Grobeton dökümü 5 usta 3 beden 1 formen, temel kazısı 4 beden 1 formen"
   → betonarme: usta_sayisi=5, duz_isci_sayisi=3, formen_sayisi=1
   → kazi:      usta_sayisi=null, duz_isci_sayisi=4, formen_sayisi=1
"""

VISION_SYSTEM_PROMPT = """Sen bir Türk inşaat şantiyesi görsel analiz asistanısın.

GÖREV:
- Fotoğrafta görünen inşaat çalışmasını tanımla.
- Görünen iş kategorisini belirle (beton dökümü, demir imalatı, kalıp, kaba inşaat, vb.).
- Görünen ekipman veya makine varsa listele.
- Yapı elemanını tanımla (kolon, kiriş, döşeme, temel, vb.).
- Kat ve blok bilgisi anlaşılıyorsa belirt.

KISITLAR:
- Fotoğrafta net görünmeyen bilgileri tahmin olarak işaretle.
- Kişi sayısını tahmin etme.
- Sadece inşaatla ilgili teknik bilgi ver.

ÇIKTI: Kısa paragraf (2–4 cümle), Türkçe.
"""


import re as _re

def _alan_listesi_formatla(alan_listesi: list[str]) -> str:
    if not alan_listesi:
        return "  (Ek alan belirtilmemiş — standart kategorileri kullan)"
    return "\n".join(f"  - {alan}" for alan in alan_listesi)


def _sablon_rehberi_olustur(alan_listesi: list[str]) -> str:
    """
    alan_listesi'nden kategori, meslek ve makine adlarını çıkararak
    Groq'a şablona uygun çıktı üretmesi için rehber talimat üretir.
    """
    kategoriler: list[str] = []
    meslekler:   list[str] = []
    makineler:   list[str] = []

    _IS_PATTERN = _re.compile(r"^(.+)_is_\d+$")
    _IS_FIRMA_PATTERN = _re.compile(r"^(.+)_is_\d+_firma$")
    _SAAT_PATTERN = _re.compile(r"^(.+)_saat$")
    # Ekip puantaj alanları (excel_filler tier-7 halleder, Groq'a gönderilmez)
    _EKIP_PREFIXLER = ("kaba_insaat_", "hafriyat_", "izolasyon_", "cephe_cati_",
                       "mekanik_", "elektrik_", "isg_")
    # Bilinen sabit alanları atla
    _SABIT = {"tarih","hava_durumu","hava_sabah","hava_ogleden_sonra",
              "hava_sicaklik","hava_genel","fotograf_analizi","toplam_personel"}

    for alan in alan_listesi:
        if alan in _SABIT:
            continue
        if any(alan.startswith(p) for p in _EKIP_PREFIXLER):
            continue  # puantaj alanları excel_filler'da çözülür
        if _IS_FIRMA_PATTERN.match(alan):
            continue  # firma alanları yapilan_isler'den türetilir, ayrıca listelenmez
        m_is = _IS_PATTERN.match(alan)
        if m_is:
            kat = m_is.group(1)
            if kat not in kategoriler:
                kategoriler.append(kat)
            continue
        m_saat = _SAAT_PATTERN.match(alan)
        if m_saat:
            mak = m_saat.group(1)
            if mak not in makineler:
                makineler.append(mak)
            continue
        # Geri kalanlar meslek/rol adı
        if alan not in meslekler:
            meslekler.append(alan)

    parcalar: list[str] = []

    if kategoriler:
        kat_str = ", ".join(f'"{k}"' for k in kategoriler)
        parcalar.append(
            f"ZORUNLU — yapilan_isler[].kategori değerini YALNIZCA şu listeden seç: {kat_str}.\n"
            "  Mesajdaki iş türünü en yakın kategoriye eşle:\n"
            "    betonarme  ← kalıp imalatı, döşeme kalıp, kolon kalıp, demir imalatı, beton dökümü, grobeton, çelik karkas\n"
            "    kazi       ← hafriyat, kazı, temel kazısı, altyapı kazısı, bina etrafı kazı (toprak işleri)\n"
            "    altyapi    ← altyapı BORULARI, su/kanalizasyon hattı, drenaj, dolgu — SADECE boru/hat işleri (kazı DEĞİL)\n"
            "    ince_yapi  ← sıva, alçı, boyama, seramik, fayans, şap, bölme duvar, asma tavan\n"
            "    mobilizasyon ← şantiye kurulumu, beton santrali, vinç montajı\n"
            "  KRİTİK: 'kalıp imalatı' ve 'demir imalatı' → betonarme (ince_yapi DEĞİL)."
        )

    if meslekler:
        mes_str = ", ".join(f'"{m}"' for m in meslekler)
        parcalar.append(
            f"ZORUNLU — personel[].meslek değerini YALNIZCA şu listeden seç: {mes_str}.\n"
            "  Mesajdaki rol adını en yakın değere eşle (örn. 'usta işçi'→'usta', "
            "'düz işçi/beden işçisi'→'duz_isci', 'kalfa/formen'→'formen', "
            "'proje müdürü'→'proje_muduru_saha', 'şantiye şefi'→'santiye_sefi_mukas')."
        )

    if makineler:
        mak_str = ", ".join(f'"{m}"' for m in makineler)
        parcalar.append(
            f"ZORUNLU — makineler[].makine_tipi değerini YALNIZCA şu listeden seç: {mak_str}.\n"
            "  Mesajdaki makine adını en yakın değere eşle (örn. 'kepçe/ekskavatör'→'ekskavatör', "
            "'beton pompası'→'beton_pompasi', 'JCB'→'jcb', 'vinç'→'vinc')."
        )

    if not parcalar:
        return "  (Standart kategori ve meslek adlarını kullan)"

    return "\n\n".join(parcalar)


def _mesajlari_birlestir(mesajlar: list[str], bugun: date) -> str:
    satirlar = [f"[Rapor Tarihi: {bugun.strftime('%d.%m.%Y')}]", ""]
    for i, mesaj in enumerate(mesajlar, 1):
        satirlar.append(f"[Mesaj {i}]")
        satirlar.append(mesaj.strip())
        satirlar.append("")
    return "\n".join(satirlar)


def build_extraction_prompt(
    alan_listesi: list[str],
    mesajlar: list[str],
    bugun: Optional[date] = None,
) -> str:
    """
    Dinamik extraction prompt'u olusturur.

    Args:
        alan_listesi: Musterinin Excel sablonundan okunan ozel alan adlari.
        mesajlar:     O gun gelen WhatsApp mesajlari.
        bugun:        Raporun tarihi. None ise date.today().
    """
    bugun_obj = bugun or date.today()
    birlesik_mesajlar = _mesajlari_birlestir(mesajlar, bugun_obj)
    sablon_rehberi = _sablon_rehberi_olustur(alan_listesi)

    return f"""Aşağıdaki WhatsApp mesajlarını analiz et ve yapılandırılmış JSON raporu oluştur.

═══════════════════════════════════════════
GELEN MESAJLAR
═══════════════════════════════════════════
{birlesik_mesajlar}

═══════════════════════════════════════════
EKSTRACTİON GÖREVİ
═══════════════════════════════════════════

Standart kategoriler:
  1. tarih          → Mesajdan çıkar, yoksa bugün ({bugun_obj.strftime('%d.%m.%Y')})
  2. hava_durumu    → sabah/öğleden sonra + sıcaklık
  3. personel       → ekip_adi, meslek, sayi (her ekip için ayrı kayıt)
  4. makineler      → makine_tipi, sayi, calisma_saati
  5. yapilan_isler  → kategori, aciklama, ilgili_firma
  6. malzeme_girisi → malzeme_adi, miktar, birim

ŞABLONA ÖZGÜ ZORUNLU DEĞER KISITLAMALARI:
{sablon_rehberi}

═══════════════════════════════════════════
ÇIKTI FORMAT (JSON)
═══════════════════════════════════════════

{{
  "tarih": "YYYY-MM-DD",
  "hava_durumu": {{
    "sabah": "string veya null",
    "ogleden_sonra": "string veya null",
    "sicaklik_derece": number_veya_null,
    "genel_aciklama": "string veya null"
  }},
  "personel": [{{"ekip_adi": "string", "meslek": "string", "sayi": integer, "guven_skoru": float}}],
  "makineler": [{{"makine_tipi": "string", "sayi": integer, "calisma_saati": number_veya_null, "guven_skoru": float}}],
  "yapilan_isler": [{{"kategori": "string", "aciklama": "string", "ilgili_firma": "string veya null", "calisan_sayisi": integer_veya_null, "usta_sayisi": integer_veya_null, "duz_isci_sayisi": integer_veya_null, "formen_sayisi": integer_veya_null, "guven_skoru": float}}],
  "malzeme_girisi": [{{"malzeme_adi": "string", "miktar": number, "birim": "string", "guven_skoru": float}}],
  "belirsiz_alanlar": [{{"alan_adi": "string", "mevcut_deger": "string veya null", "neden_belirsiz": "string", "guven_skoru": float}}],
  "fotograf_analizi": null
}}

═══════════════════════════════════════════
KRİTİK UYARILAR
═══════════════════════════════════════════

YAPMA:
  ✗ Mesajda geçmeyen sayı, isim veya bilgi üretme
  ✗ "Muhtemelen vardır" diyerek belirsiz_alanlar'a koymadan tahmin ekleme
  ✗ Aynı bilgiyi birden fazla kayıt olarak çoğaltma

YAP:
  ✓ Belirsiz veya eksik bilgileri belirsiz_alanlar listesine ekle
  ✓ Her kayıt için guven_skoru belirle
  ✓ Bilgi yoksa o kategoriyi boş liste [] olarak bırak
  ✓ yapilan_isler[].calisan_sayisi: o işte görev alan toplam kişi sayısını yaz
     (Örn: "5 usta 3 düz işçi ile beton döküldü" → betonarme kaydında calisan_sayisi: 8)
  ✓ yapilan_isler[].usta_sayisi: o işte çalışan usta/kalıpçı/demirci sayısını yaz
  ✓ yapilan_isler[].duz_isci_sayisi: o işte çalışan düz işçi/beden işçisi sayısını yaz
  ✓ yapilan_isler[].formen_sayisi: o işte çalışan formen/kalfa sayısını yaz
     (Örn: "5 usta 3 düz işçi 1 formen ile beton döküldü" → usta_sayisi:5, duz_isci_sayisi:3, formen_sayisi:1)
"""


MAPPING_SYSTEM_PROMPT = """Sen bir şantiye raporu şablon doldurma asistanısın.

GÖREV:
Aşama 1'de WhatsApp mesajlarından çıkarılmış şantiye verisini alıyorsun.
Bu veriyi kullanarak Excel şablon alanlarını doğrudan doldur.
Çıktı: {"alan_adı": değer} formatında JSON sözlüğü. Başka metin ekleme.

═══ ALAN ADI ÇÖZÜMLEMESİ ═══

SABİT ALANLAR:
  santiye_adi        → santiye_adi alanını kullan
  tarih              → tarih alanını "DD.MM.YYYY" formatında yaz
  hava_sabah         → hava_durumu.sabah
  hava_ogleden_sonra → hava_durumu.ogleden_sonra
  hava_sicaklik      → hava_durumu.sicaklik_derece
  hava_genel         → hava_durumu.genel_aciklama
  fotograf_analizi   → fotograf_analizi
  toplam_personel    → personel listesindeki tüm sayi değerlerini topla

EKİP PUANTAJ → {ekip}_{meslek}: integer (bilgi yoksa null yaz, 0 YAZMA)
  Ekip kategorisi ↔ yapilan_isler.kategori eşlemesi:
    kaba_insaat  ← betonarme, mobilizasyon
    hafriyat     ← kazi
    izolasyon    ← altyapi
    cephe_cati   ← ince_yapi
    mekanik      ← mekanik
    elektrik     ← elektrik

  Meslek ↔ yapilan_isler alanı — KRİTİK AYRIM (ÇİFT SAYMAYACAKSIN):
    formen, kalfa → formen_sayisi — kategorideki TÜM işlerden topla
    beden, duz_isci → duz_isci_sayisi — kategorideki TÜM işlerden topla
    kalipci  → usta_sayisi — SADECE aciklama'sında "kalıp" geçen işlerden
    demirci  → usta_sayisi — SADECE aciklama'sında "demir" geçen işlerden
    usta     → usta_sayisi — "kalıp" veya "demir" geçmeyen diğer usta işlerinden

  ÖRNEK:
    yapilan_isler = [
      {kategori:"betonarme", aciklama:"döşeme kalıp imalatı", usta_sayisi:5, duz_isci_sayisi:3, formen_sayisi:1},
      {kategori:"betonarme", aciklama:"kolon demir imalatı",  usta_sayisi:3, duz_isci_sayisi:2, formen_sayisi:0}
    ]
    kaba_insaat_kalipci → 5   (yalnızca "kalıp" işi)
    kaba_insaat_demirci → 3   (yalnızca "demir" işi)
    kaba_insaat_beden   → 5   (3+2, her iki işten)
    kaba_insaat_formen  → 1   (1+0)
    ← YANLIŞ: kaba_insaat_kalipci = 8  (5+3 toplamı — ÇİFT SAYMA!)

  Her işin personeli ilgili olduğu SADECE bir alt kategoriye girer.
  KAYNAK KISITI: Değerleri YALNIZCA yapilan_isler[].usta_sayisi / duz_isci_sayisi / formen_sayisi
  alanlarından hesapla. personel[] listesini puantaj için KULLANMA — o liste ayrı bir özettir,
  kullanmak çift sayıma yol açar. Bu alanlarda sayı yoksa (null veya 0) → null yaz. ASLA uydurmayacaksın.

MAKİNE SAATLERİ → {makine_adi}_saat: float veya integer
  Makine adını normalize et: alt_çizgi→boşluk, ı→i, ş→s, ü→u, ö→o, ç→c
  Normalize edilmiş makine_tipi içinde ara.
  calisma_saati varsa → onu yaz.
  calisma_saati null ama makine mevcutsa (sayi > 0) → sayi değerini yaz (makine sahada vardı).
  Makine hiç yoksa → null yaz.
  Örnek: "1 adet JCB, saat bilinmiyor" → jcb_saat = 1 (sayi)

YAPILAN İŞLER → {kategori}_is_{N}: string
  Örnek: betonarme_is_1 → kategori="betonarme" olan 1. kaydın aciklama alanı (1-tabanlı indeks)

YAPILAN İŞ FİRMASI → {kategori}_is_{N}_firma: string
  Format: "FirmaAdı / calisan_sayisi" — sadece calisan_sayisi varsa "/ sayı"

═══ KRİTİK KURALLAR ═══
  • Bilgi yoksa null yaz — asla 0 YAZMA (0 ile "veri yok" ayrımı kritik).
  • Sayısal alanlara string yazmayacaksın.
  • Verilen alan listesinin dışına çıkma.
  • Mesajda geçmeyen bilgiyi üretme (halüsinasyon yasağı).
"""


_LLM_ATLANAN_ALANLAR = {
    "tarih", "santiye_adi", "fotograf_analizi", "toplam_personel",
    "hava_durumu", "hava_sabah", "hava_ogleden_sonra", "hava_sicaklik",
    "hava_genel",
}
_LLM_ATLANAN_PREFIXLER = ("personel_", "makine_")  # N-indexli alanlar heuristic'te çözülür


def _llm_icin_filtrele(alan_listesi: list[str]) -> list[str]:
    """LLM'in çözmesi gereken zor alanları filtreler. Heuristic'in kolayca çözdüğü alanları atar."""
    sonuc = []
    for alan in alan_listesi:
        if alan in _LLM_ATLANAN_ALANLAR:
            continue
        if any(alan.startswith(p) for p in _LLM_ATLANAN_PREFIXLER):
            continue
        sonuc.append(alan)
    return sonuc


def build_mapping_prompt(alan_listesi: list[str], extraction_data: dict) -> str:
    """İkinci aşama (şablona doğrudan eşleme) için prompt oluşturur.

    Sadece heuristic'in iyi çözemediği karmaşık alanları LLM'e gönderir
    (ekip puantaj, yapılan işler, makine saatleri, meslek rolleri).
    """
    import json as _json

    zor_alanlar = _llm_icin_filtrele(alan_listesi)
    if not zor_alanlar:
        return ""

    temiz_data = {
        k: v for k, v in extraction_data.items()
        if k not in ("ham_mesajlar", "belirsiz_alanlar", "hava_durumu",
                     "fotograf_analizi", "santiye_adi")
    }
    data_json = _json.dumps(temiz_data, ensure_ascii=False, indent=2)
    alan_str = "\n".join(f"  - {alan}" for alan in zor_alanlar)

    return (
        f"Çıkarılmış şantiye verisi:\n\n{data_json}\n\n"
        "Aşağıdaki şablon alanlarını doldur. Her alan için değer üret.\n"
        "Bilgi yoksa null kullan (0 YAZMA — veri yok ile sıfır ayrı anlam taşır).\n\n"
        f"DOLDURULACAK ALANLAR:\n{alan_str}\n\n"
        'Çıktı: Yalnızca {"alan_adi": deger} formatında JSON sözlüğü.'
    )


def build_vision_prompt(
    fotograf_notu: Optional[str] = None,
    mesaj_baglami: Optional[str] = None,
) -> str:
    parcalar = ["Bu şantiye fotoğrafını analiz et."]
    if fotograf_notu:
        parcalar.append(f'\nKullanıcı notu: "{fotograf_notu}"')
    if mesaj_baglami:
        parcalar.append(f"\nO günkü genel bağlam: {mesaj_baglami}")
    parcalar.append(
        "\nFotoğrafta gördüğün inşaat çalışmasını, iş kategorisini, "
        "varsa yapı elemanını ve ekipmanı kısaca açıkla. "
        "Görmediğin/emin olmadığın bilgileri belirtme."
    )
    return "\n".join(parcalar)
