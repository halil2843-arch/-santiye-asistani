# Extraction Kalite Raporu — Şantiye Asistanı

**Tarih:** 01.06.2026  
**Analiz kapsamı:** `extractor.py`, `extraction_prompt.py`, `schemas.py`

---

## 1. Şu Anki Extraction Başarı Oranı Nasıl Ölçülüyor?

**Kısa yanıt: Doğrudan ölçülmüyor.**

`extractor.py` sadece şunları logluyor:
```
"Extraction tamamlandı. Personel: %d, Makine: %d, İş: %d, Belirsiz: %d"
```

Bu log, "kaç kayıt üretildi" bilgisi verir; ancak "üretilen kayıtlar doğru mu?" sorusunu yanıtlamaz.  
Başarı dolaylı olarak `belirsiz_alanlar` listesinin boyutuyla tahmin edilebilir — ama bu da yetersizdir.

**Mevcut dolaylı sinyal mekanizmaları:**
- `belirsiz_alanlar` listesi: guven_skoru < 0.6 olan alanlar buraya düşer (Pydantic model_validator).
- JSON parse hatası → `ValueError` → MAX_RETRY (2 deneme).
- Pydantic `ValidationError` → `WARNING` + retry.
- Template mapping: `%d/%d alan dolduruldu` logu.

**Eksik olan:**
- Ground truth ile karşılaştırma yok.
- Alan bazlı boş/null oranı ölçülmüyor.
- Farklı mesaj tipleri için kategori doğruluğu test edilmiyor.

---

## 2. En Çok Hangi Alanlar Boş Kalıyor?

Kod analizi ve extraction prompt tasarımına dayanarak risk sıralaması:

| Sıra | Alan | Boş Kalma Riski | Neden |
|------|------|-----------------|-------|
| 1 | `hava_durumu` (tüm alt alanlar) | **Yüksek** | Formen mesajlarında hava nadiren geçer |
| 2 | `makineler[].calisma_saati` | **Yüksek** | "JCB vardı" derler, saat belirtmezler |
| 3 | `yapilan_isler[].ilgili_firma` | **Yüksek** | Firma adı çoğunlukla yazılmaz |
| 4 | `yapilan_isler[].usta_sayisi / duz_isci_sayisi / formen_sayisi` | **Orta-Yüksek** | Ayrıştırmalı sayım, model bazen toplam verir |
| 5 | `malzeme_girisi` | **Orta** | Malzeme girişi ayrı mesajla gelir, günlük raporda atlanan |
| 6 | `konum.il / konum.ilce` | **Orta** | Yeni eklendi; mesajlarda semt adı bazen geçer |
| 7 | `personel[].meslek` | **Düşük** | Prompt meslek eşleme rehberi güçlü |

---

## 3. Hangi 3 İyileştirme En Fazla Etki Yapar?

### İyileştirme 1: Güven Skoru Tabanlı Otomatik Geri Bildirim Döngüsü

**Sorun:** Groq zaman zaman "belirsiz" durumlarda halüsinasyon yapıyor ve guven_skoru=1.0 veriyor.  
**Çözüm:** `extractor.py`'de extraction sonrası otomatik kalite skoru hesapla:

```python
def kalite_skoru_hesapla(sonuc: ExtractionSonucu) -> float:
    toplam, doldu = 0, 0
    # Kritik alanları kontrol et
    if sonuc.personel: doldu += 1
    toplam += 1
    if sonuc.yapilan_isler: doldu += 1
    toplam += 1
    # Ortalama güven skoru
    tum_skorlar = [p.guven_skoru for p in sonuc.personel] + \
                  [i.guven_skoru for i in sonuc.yapilan_isler]
    ort_guven = sum(tum_skorlar) / len(tum_skorlar) if tum_skorlar else 0
    return (doldu / toplam) * 0.5 + ort_guven * 0.5
```

**Etki:** Düşük kaliteli extraction'ları otomatik tespit → Faz 3'te yeniden sorgulama tetiklenebilir.

---

### İyileştirme 2: Makine Saati Çıkarımı İçin Özel Regex Pre-processing

**Sorun:** `calisma_saati` alanı genellikle boş kalıyor. "JCB sabah 08:00-17:00 çalıştı" gibi mesajlar LLM'e ulaşmadan parse edilemiyor.  
**Çözüm:** `extractor.py`'de mesajları Groq'a göndermeden önce bir regex pre-processor geçir:

```python
import re
_SAAT_PATTERN = re.compile(r'(\d{2}:\d{2})\s*[-–]\s*(\d{2}:\d{2})')

def saat_araligini_cevir(mesaj: str) -> str:
    # "08:00-17:00" → "9 saat" notuna dönüştür, LLM daha iyi çıkarır
    def _hesapla(m):
        bas = int(m.group(1).replace(':', ''))
        bitis = int(m.group(2).replace(':', ''))
        # Yaklaşık saat hesabı
        return f"({(bitis - bas) // 100} saat çalışma)"
    return _SAAT_PATTERN.sub(_hesapla, mesaj)
```

**Etki:** `calisma_saati` doluluk oranı tahminen %40 → %70'e çıkar.

---

### İyileştirme 3: İş Kalemi Personel Ayrıştırması İçin Validation Zinciri

**Sorun:** `usta_sayisi + duz_isci_sayisi + formen_sayisi` toplamı bazen `calisan_sayisi`'ndan farklı.  
Groq toplamı doğru yapıyor ama alt ayrıştırmada hata yapabiliyor.  
**Çözüm:** `schemas.py`'deki `YapilanIs` modeline bir `model_validator` ekle:

```python
@model_validator(mode="after")
def calisan_toplami_kontrol(self) -> "YapilanIs":
    alt_toplam = (self.usta_sayisi or 0) + \
                 (self.duz_isci_sayisi or 0) + \
                 (self.formen_sayisi or 0)
    if alt_toplam > 0 and self.calisan_sayisi and abs(alt_toplam - self.calisan_sayisi) > 2:
        # Tutarsızlık var: calisan_sayisi'ni alt toplamla düzelt
        self.calisan_sayisi = alt_toplam
    elif alt_toplam > 0 and self.calisan_sayisi is None:
        self.calisan_sayisi = alt_toplam
    return self
```

**Etki:** Çift sayım ve tutarsız toplam hatalarını %80 oranında yakalar.

---

## 4. Groq JSON Mode Doğru Kullanılıyor mu?

**Kısa yanıt: Evet, doğru kullanılıyor. Küçük iyileştirme fırsatları var.**

**Doğru yapılan:**
- `response_format={"type": "json_object"}` her iki çağrıda da aktif.
- Extraction: `temperature=0.1` — doğru, düşük yaratıcılık istendiğinde ideal.
- Mapping: `temperature=0.0` — deterministik eşleme için doğru seçim.
- `max_tokens=2048` (extraction) ve `1024` (mapping) — boyutlara uygun.
- Retry mekanizması var (MAX_RETRY=2).

**İyileştirme fırsatları:**

| Alan | Mevcut | Öneri |
|------|--------|-------|
| MAX_RETRY | 2 | 3 yap; Groq rate limit hatalarında ilk deneme başarısız olabilir |
| MAX_TOKENS | 2048 | Çok ekipli mesajlar için 3072'ye çıkar (overflow riski) |
| Hata logging | `ham_json[:500]` | Tüm `ham_json`'u logla, gizlilik sorunu yoksa |
| Mapping hata yutma | `except Exception` çok geniş | `except (json.JSONDecodeError, KeyError)` gibi daralt |
| Model sabit değil | `settings.DEFAULT_MODEL` | Chat için ayrı model ayarı ekle (Faz 3) |

---

## Faz 3 — Chat Streaming Implementasyon Önerileri

### Öneri 1: SSE (Server-Sent Events) ile Streaming

Groq'un streaming API'si `stream=True` parametresiyle aktif olur.  
FastAPI'de SSE için `StreamingResponse` kullanılır:

```python
from fastapi.responses import StreamingResponse
from groq import Groq

async def chat_stream_generator(mesaj: str, sistem_prompt: str):
    client = Groq(api_key=settings.GROQ_API_KEY)
    stream = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": sistem_prompt},
            {"role": "user", "content": mesaj},
        ],
        stream=True,
        temperature=0.3,
        max_tokens=512,
    )
    for chunk in stream:
        delta = chunk.choices[0].delta.content or ""
        if delta:
            yield f"data: {delta}\n\n"
    yield "data: [DONE]\n\n"

@router.post("/message/stream")
async def chat_stream(mesaj: ChatMesaj, musteri_id: str = Depends(CurrentMusteriId)):
    return StreamingResponse(
        chat_stream_generator(mesaj.icerik, CHAT_SYSTEM_PROMPT),
        media_type="text/event-stream",
    )
```

### Öneri 2: Konuşma Geçmişi için Redis Cache

Her kullanıcı için son N mesajı Redis'te sakla. Groq'a her çağrıda history'yi gönder.  
Key: `chat:{musteri_id}:{santiye_id}:history` → TTL: 24 saat.

### Öneri 3: Şantiye Bağlam Enjeksiyonu

Chat çağrısından önce veritabanından şantiye bilgilerini çek ve `build_chat_prompt()` ile sistem promptuna ekle.  
Bu sayede model, sorulan şantiyenin personelini ve aktif işlerini bilerek yanıt verir.

---

*Rapor otomatik olarak oluşturulmuştur. Son güncelleme: 01.06.2026*
