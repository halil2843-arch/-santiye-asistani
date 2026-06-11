"""
Şantiye Asistanı — Chat Sistemi Prompt Dosyası

Tasarım:
  - CHAT_SYSTEM_PROMPT: İnşaat sektörüne özel chat asistanı kural seti
  - QUICK_COMMANDS: Sık kullanılan hızlı komut şablonları
  - build_chat_prompt(): Bağlam zenginleştirmeli dinamik prompt üreticisi
"""

from __future__ import annotations

from typing import Optional

# ---------------------------------------------------------------------------
# Ana sistem promptu
# ---------------------------------------------------------------------------

CHAT_SYSTEM_PROMPT = """Sen Şantiye Asistanı'nın yapay zeka asistanısın. Türkiye'deki inşaat şantiyelerinde çalışan mimar, mühendis ve foreman gibi profesyonellere yardım ediyorsun.

## UZMANLIK ALANLARIN
- Türk inşaat mevzuatı (İş Sağlığı ve Güvenliği Kanunu 6331, TBDY 2018)
- Beton standartları (TS EN 206, C16-C50 sınıfları)
- Donatı/çelik (TS 708, B420C/B500C)
- Günlük saha raporu hazırlama
- Puantaj ve personel takibi
- Stok ve malzeme yönetimi
- Hakediş hesaplama (KDV dahil)
- İSG kaza bildirimi ve önleme
- İş planı ve Gantt şeması

## YANIT TARZI
- Kısa ve net yanıtlar ver (saha koşulları, telefon ekranı)
- Sayısal sorularda hesap yap, sonucu göster
- Türkçe teknik terimler kullan
- Acil/güvenlik sorularında hemen protokol ver
- Rapor taslağı istenince hazır format sun

## Yanıt Kuralları
1. KISA VE NET ol — telefonda okunacak, max 3-4 cümle veya madde
2. SOMUT ol — "yaklaşık 50 ton" değil "tam 47.3 ton" de
3. TÜRKÇE — teknik terim kullanabilirsin, ilk geçişte parantez içi açıkla
4. ADIMlı — hesap varsa adım adım göster
5. SORU SOR — belirsizlikte netleştirici tek soru sor

## Bilmediğin Durumlar
"Bu konuda DB'nizdeki veriye bakamıyorum, ancak genel kural şu: ..." şeklinde yanıtla.
Asla yanlış sayı üretme.

## Format
- Liste varsa madde işareti kullan
- Hesap varsa = işareti ile göster
- Uyarı varsa ⚠️ ile başla
- Onay için ✅ kullan

## GÜNLÜK RAPOR FORMATI (istenince kullan)
Tarih: [tarih]
Hava: [durum]
Çalışan Personel: [sayı] kişi
İşler:
- [iş kalemi 1]
- [iş kalemi 2]
Malzeme Kullanımı: [liste]
İSG Durumu: [normal/olay var]
Notlar: [ek bilgi]

## ÖRNEK HIZLI KOMUTLAR
- "15 işçi çalıştı, kazı yaptık" → Günlük rapor taslağı oluştur
- "C25 beton 50m3 dökeceğiz" → Malzeme hesapla
- "8 kişi giriş 08:00 çıkış 17:30" → Puantaj hesapla (overtime dahil)
- "Göz yaralanması oldu" → İSG bildirimi protokolü ver
"""

# ---------------------------------------------------------------------------
# Hızlı komut şablonları
# ---------------------------------------------------------------------------

QUICK_COMMANDS: dict[str, str] = {
    "rapor_olustur": (
        "Bugün {personel} kişi çalıştı. {isler} yapıldı. "
        "Günlük rapor taslağı oluştur."
    ),
    "stok_sorgula": (
        "{malzeme} stoğu kontrol et ve tahmini {sure} günlük kullanım bildir."
    ),
    "isg_kontrol": (
        "{alan} alanında ISG kontrol listesi ver. Eksikleri raporla."
    ),
    "beton_hesap": (
        "{hacim} m3 {sinif} beton için çimento, kum, çakıl ve su miktarlarını hesapla."
    ),
    "puantaj_hesap": (
        "{kisi_sayisi} işçi, giriş {giris} çıkış {cikis}. "
        "Toplam mesai ve fazla mesai hesapla."
    ),
    "kaza_bildir": (
        "Kaza türü: {tur}. Açıklama: {aciklama}. "
        "Resmi ISG bildirim protokolü ve acil adımlar."
    ),
    "malzeme_siparis": (
        "{malzeme} için {miktar} {birim} sipariş taslağı hazırla."
    ),
    "hakedis_ozet": (
        "{proje} projesi {ay} ayı hakediş özeti. İş kalemleri: {kalemler}."
    ),
    # Geriye dönük uyumluluk için eski komutlar
    "ekip_ara": (
        "Aktif ekiplerimizin bugünkü görevlerini ve personel dağılımını özetle"
    ),
    "is_plani": (
        "Bu haftanın iş planı hedeflerini ve bugün tamamlanması gerekenleri özetle"
    ),
    "hava_degerlendirme": (
        "Bugünkü hava koşullarına göre sahada çalışmaya devam edilmeli mi? {hava}"
    ),
}

# ---------------------------------------------------------------------------
# Bağlam zenginleştirmeli prompt üreticisi
# ---------------------------------------------------------------------------

def build_chat_prompt(
    santiye_adi: Optional[str] = None,
    proje_adi: Optional[str] = None,
    proje_muduru: Optional[str] = None,
    aktif_ekipler: Optional[list[str]] = None,
    bugun_tarihi: Optional[str] = None,
) -> str:
    """
    Ana sistem promptunu şantiye-özgü bağlamla zenginleştirir.

    Args:
        santiye_adi:    Aktif şantiyenin adı (bağlam için).
        proje_adi:      Aktif proje adı (bağlam için).
        proje_muduru:   Proje müdürünün adı (kişiselleştirme).
        aktif_ekipler:  O gün sahada olan ekip adları.
        bugun_tarihi:   "DD.MM.YYYY" formatında tarih.

    Returns:
        Groq'a system mesajı olarak gönderilecek tam prompt string'i.
    """
    baglamlar: list[str] = [CHAT_SYSTEM_PROMPT]

    if any([santiye_adi, proje_adi, proje_muduru, aktif_ekipler, bugun_tarihi]):
        baglamlar.append("\n--- AKTİF BAĞLAM ---")

    if bugun_tarihi:
        baglamlar.append(f"Tarih: {bugun_tarihi}")

    if santiye_adi:
        baglamlar.append(f"Aktif şantiye: {santiye_adi}")

    if proje_adi:
        baglamlar.append(f"Aktif proje: {proje_adi}")

    if proje_muduru:
        baglamlar.append(f"Proje müdürü: {proje_muduru}")

    if aktif_ekipler:
        ekip_str = ", ".join(aktif_ekipler)
        baglamlar.append(f"Sahada aktif ekipler: {ekip_str}")

    return "\n".join(baglamlar)


def quick_command_formatla(komut_kodu: str, **kwargs) -> Optional[str]:
    """
    Hızlı komut şablonunu verilen parametrelerle doldurur.

    Args:
        komut_kodu: QUICK_COMMANDS sözlüğündeki anahtar.
        **kwargs:   Şablon değişkenleri ({personel}, {makine} vb.).

    Returns:
        Doldurulmuş komut metni veya None (geçersiz komut).
    """
    sablon = QUICK_COMMANDS.get(komut_kodu)
    if not sablon:
        return None
    try:
        return sablon.format(**kwargs)
    except KeyError:
        # Eksik parametre varsa ham şablonu döndür
        return sablon
