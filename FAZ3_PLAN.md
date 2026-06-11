# Şantiye Asistanı — Faz 3 Teknik Plan
**Tarih:** 2026-06-01  
**Hazırlayan:** Mimar Agent (Senior Architect)  
**Bağlam:** Faz 1 tamamlandı, Faz 2 agent'ları çalışıyor, Faz 3 başlamadan önceki referans doküman.

---

## 1. Faz 3 Giriş Durumu (Faz 2 Çıkış Varsayımı)

Faz 3 başlarken aşağıdaki bileşenlerin Faz 2'den **teslim edilmiş** olması beklenir:

| Bileşen | Faz 2 Çıktısı |
|---------|--------------|
| Stok backend | Model + CRUD + hareket endpoint'leri calisiyor |
| Medya upload | POST /api/v1/media/upload fonksiyonel |
| ISG | GET/POST /api/v1/isg/ fonksiyonel |
| Toplanti notlari | GET/POST /api/v1/toplanti/ fonksiyonel |
| Aktivite feed | GET/POST /api/v1/projects/{id}/aktivite fonksiyonel |
| Proje detay 7 sekme (FE) | yonetim/projeler/[id]/ tam sekme yapisi var |
| PDF/HTML export | pdf_exporter.py calisiyor |
| Rate limiting iskelet | slowapi veya custom middleware var |
| Tenant isolation testleri | pytest suite gecti |
| Chat iskelet | POST /api/v1/chat/message placeholder yanit veriyor (MEVCUT DOGRULANMIS) |
| Asistan UI iskelet | asistan/page.tsx input/chip arayuzu var, API bagli degil (MEVCUT DOGRULANMIS) |
| 12 arac sayfasi iskelet | Tum sayfa dosyalari var, icerik "yakinda" placeholder (MEVCUT DOGRULANMIS) |
| Hakedis olusturucu | hakedis_olusturucu.py dosyasi mevcut |

---

## 2. Bagimlilik Haritasi

Asagidaki sema, hangi gorev hangi baska gorev bitmeden baslatilaMaz oldugunu gosterir.

```
BACKEND TARAFLARI:
─────────────────
[B1] Chat gecmis tablosu (migration)
     └── [B2] Chat SSE streaming endpoint (gecmis kaydetmek icin B1 gerekli)
              └── [FE-A] Asistan chat UI (SSE baglantisi icin B2 gerekli)

[B3] JWT refresh token (bagimsiz)
     └── [FE-B] Frontend token yenileme logic (B3 gerekli)

[B4] Hakedis endpoint'leri + Excel cikti (hakedis_olusturucu.py zaten var)
     └── [FE-C] yonetim/hakedis/page.tsx (B4 gerekli)

[B5] Malzeme tahmini endpoint (Groq tabanli)
     └── [FE-D] araclar/malzeme-tahmini/page.tsx tam uygulama (B5 gerekli)

[B6] SQLite → PostgreSQL gecis (bagimsiz, ancak onceden yapilmali)

[B7] Redis tabanli rate limiting (B3'ten bagimsiz, Redis altyapisi gerekiyor)

FRONTEND TARAFLARI:
───────────────────
[FE-E] araclar/birim-donusturucu → bagimsiz (client-side saf JS/TS)
[FE-F] araclar/hesaplayici → bagimsiz (client-side)
[FE-G] araclar/beton → bagimsiz (client-side)
[FE-H] araclar/alan-hacim → bagimsiz (client-side)
[FE-I] araclar/egim → bagimsiz + DeviceOrientation API
[FE-J] araclar/demir → bagimsiz (client-side tablo)
[FE-K] araclar/su-terazisi → bagimsiz (DeviceOrientationEvent API)
[FE-L] araclar/qr → bagimsiz (kamera API, jsQR lib)
[FE-M] araclar/mesafe → bagimsiz (manuel giris ile basla)
[FE-N] araclar/fotograf-not → bagimsiz (canvas API)
[FE-O] araclar/rehber → bagimsiz (statik markdown/JSX)
[FE-P] PWA manifest.json → bagimsiz (Next.js metadata API)
```

**Kritik yol (en uzun bagimlilik zinciri):**  
`B1 → B2 → FE-A` — Chat SSE, Faz 3'un en uzun soket/stream degistirme isini gerektiriyor.

---

## 3. Paralel Baslatilabilecek Gorevler

### Sprint 1 — Paralel baslat (hic bagimliligi yok):

| Agent | Gorev | Aciklama |
|-------|-------|---------|
| Backend Dev | B1: Chat gecmis migration | `chat_mesajlari` tablosu Alembic migration |
| Backend Dev | B3: JWT refresh token | core/security.py + /auth/refresh endpoint |
| Backend Dev | B4: Hakedis endpoint'leri | hakedis_olusturucu.py zaten var, router ekle |
| Backend Dev | B6: PostgreSQL gecis | bildirim_zamanlayici.py cast duzelt, DATABASE_URL degistir |
| Frontend Dev | FE-E: Birim donusturucu | Tamamen client-side, hic API yok |
| Frontend Dev | FE-F: Hesaplayici | Tamamen client-side |
| Frontend Dev | FE-G: Beton hesaplayici | Tamamen client-side |
| Frontend Dev | FE-K: Su terazisi | DeviceOrientationEvent API |
| Frontend Dev | FE-P: PWA manifest | Next.js app/manifest.ts, 2 saatlik is |

### Sprint 2 — Sprint 1'e bagimli:

| Agent | Gorev | Bagimlilik | Aciklama |
|-------|-------|-----------|---------|
| Backend Dev | B2: Chat SSE streaming | B1 bitmeli | Groq stream + SSE response |
| Backend Dev | B5: Malzeme tahmini | B2 (Groq pattern netlesince) | Yeni Groq endpoint |
| Backend Dev | B7: Redis rate limiting | B3'ten bagimsiz ama ortam hazir olunca | Redis container + slowapi |
| Frontend Dev | FE-B: Token yenileme | B3 bitmeli | api.ts interceptor degisimi |
| Frontend Dev | FE-A: Asistan chat UI | B2 bitmeli | SSE reader + mesaj listesi |
| Frontend Dev | FE-H/I/J/L/M/N/O: Diger araclar | Sprint 1 paralel | client-side veya kamera araclari |

### Sprint 3 — Sprint 2'ye bagimli:

| Agent | Gorev | Bagimlilik |
|-------|-------|-----------|
| Frontend Dev | FE-C: Hakedis sayfasi | B4 bitmeli |
| Frontend Dev | FE-D: Malzeme tahmini sayfasi | B5 bitmeli |
| Guvenlik & Test | Redis rate limit test | B7 bitmeli |
| Guvenlik & Test | SSE auth middleware test | B2 bitmeli |

---

## 4. Agent Gorev Kutulari

---

### BACKEND DEV — Faz 3 Gorev Listesi

```
┌─────────────────────────────────────────────────────────────────────┐
│ BACKEND DEV — FAZ 3 GOREVLERI                                       │
├────┬──────────────────────────────────────────────────┬──────┬──────┤
│ #  │ Gorev                                            │ Onc. │ Boyut│
├────┼──────────────────────────────────────────────────┼──────┼──────┤
│ B1 │ chat_mesajlari tablosu Alembic migration yaz     │  1   │  S   │
│    │ (kolon: id, musteri_id, kullanici_id, rol,       │      │      │
│    │  icerik, created_at)                             │      │      │
├────┼──────────────────────────────────────────────────┼──────┼──────┤
│ B2 │ Chat SSE streaming: /api/v1/chat/message         │  1   │  L   │
│    │ Mevcut placeholder'i Groq async stream ile       │      │      │
│    │ degistir. StreamingResponse + text/event-stream. │      │      │
│    │ Gecmis kaydet (B1 gerekli).                      │      │      │
├────┼──────────────────────────────────────────────────┼──────┼──────┤
│ B3 │ GET /api/v1/chat/history + DELETE endpoint       │  2   │  S   │
│    │ Sayfalandirmali gecmis listesi.                   │      │      │
├────┼──────────────────────────────────────────────────┼──────┼──────┤
│ B4 │ JWT refresh token: POST /auth/refresh            │  1   │  M   │
│    │ access_token 60dk, refresh_token 7 gun.          │      │      │
│    │ core/security.py'ye create_refresh_token ekle.   │      │      │
├────┼──────────────────────────────────────────────────┼──────┼──────┤
│ B5 │ Hakedis router: GET/POST /api/v1/hakedis/        │  1   │  M   │
│    │ GET /api/v1/hakedis/{id}/excel                   │      │      │
│    │ hakedis_olusturucu.py zaten mevcut, router ekle. │      │      │
│    │ Hakedis modeli olustur (mevcut degil).           │      │      │
├────┼──────────────────────────────────────────────────┼──────┼──────┤
│ B6 │ Malzeme tahmini: POST /api/v1/araclar/malzeme    │  2   │  M   │
│    │ Groq ile alan/malzeme tipi → miktar tahmini.     │      │      │
│    │ Prompt: services/malzeme_tahmini_prompt.py yaz.  │      │      │
├────┼──────────────────────────────────────────────────┼──────┼──────┤
│ B7 │ SQLite → PostgreSQL tam gecis                    │  1   │  M   │
│    │ 1. bildirim_zamanlayici.py cast kaldır           │      │      │
│    │    (SqliteDate → func.date())                    │      │      │
│    │ 2. .env: DATABASE_URL=postgresql+asyncpg://...   │      │      │
│    │ 3. Alembic tum migration'lari PG uzerinde test   │      │      │
│    │ 4. ENUM tipler icin SAEnum kullanimi dogrula     │      │      │
├────┼──────────────────────────────────────────────────┼──────┼──────┤
│ B8 │ Redis tabanli rate limiting                      │  2   │  M   │
│    │ slowapi[redis] veya custom middleware.            │      │      │
│    │ Kural: auth 5/dk, chat 30/dk, upload 10/dk.      │      │      │
│    │ Redis bağlantısı core/redis.py'de merkezi yonet. │      │      │
├────┼──────────────────────────────────────────────────┼──────┼──────┤
│ B9 │ SSE endpoint auth middleware                     │  2   │  S   │
│    │ StreamingResponse'ta Depends(get_current_user)   │      │      │
│    │ calismiyor — Header token parse icin ozel dep.   │      │      │
└────┴──────────────────────────────────────────────────┴──────┴──────┘

Oncelik: 1 = kritik yolda, 2 = onemli ama bloke etmez
Boyut: S=yarım gün, M=1 gün, L=1.5-2 gün
```

---

### FRONTEND DEV — Faz 3 Gorev Listesi

```
┌─────────────────────────────────────────────────────────────────────┐
│ FRONTEND DEV — FAZ 3 GOREVLERI                                      │
├────┬──────────────────────────────────────────────────┬──────┬──────┤
│ #  │ Gorev                                            │ Onc. │ Boyut│
├────┼──────────────────────────────────────────────────┼──────┼──────┤
│ F1 │ Asistan chat UI — SSE baglantisi                 │  1   │  L   │
│    │ asistan/page.tsx icerigini tamamla:              │      │      │
│    │ - fetch + ReadableStream SSE reader              │      │      │
│    │ - Mesaj listesi (user/assistant bubble)          │      │      │
│    │ - Yazma animasyonu (streaming karakter karakter) │      │      │
│    │ - Hizli komut chip'leri → komut_parametreleri    │      │      │
│    │ - Gecmis yukleme (GET /chat/history)             │      │      │
│    │ BAGIMLILIK: B2 bitmeli                           │      │      │
├────┼──────────────────────────────────────────────────┼──────┼──────┤
│ F2 │ JWT token yenileme — api.ts interceptor          │  1   │  S   │
│    │ 401 gelince refresh_token ile /auth/refresh      │      │      │
│    │ cagir, yeni access_token sakla, istegi tekrarla. │      │      │
│    │ BAGIMLILIK: B4 bitmeli                           │      │      │
├────┼──────────────────────────────────────────────────┼──────┼──────┤
│ F3 │ yonetim/hakedis/page.tsx                         │  2   │  M   │
│    │ Hakedis listesi + yeni hakedis formu.             │      │      │
│    │ Excel indirme butonu (blob download).            │      │      │
│    │ BAGIMLILIK: B5 bitmeli                           │      │      │
├────┼──────────────────────────────────────────────────┼──────┼──────┤
│ F4 │ PWA manifest.json                                │  1   │  S   │
│    │ app/manifest.ts (Next.js 14 metadata API).       │      │      │
│    │ name, short_name, icons (192/512px), theme_color │      │      │
│    │ display: standalone, start_url: /anasayfa        │      │      │
│    │ public/icons/ klasoru + ikon dosyalari.          │      │      │
│    │ BAGIMLILIK: Yok — hemen baslanabilir             │      │      │
├────┼──────────────────────────────────────────────────┼──────┼──────┤
│ F5 │ araclar/birim-donusturucu/page.tsx               │  1   │  M   │
│    │ Kategori: uzunluk, alan, hacim, agirlik, sicaklik│      │      │
│    │ Sabit konversiyon tablosu. Saf client-side.      │      │      │
│    │ BAGIMLILIK: Yok                                  │      │      │
├────┼──────────────────────────────────────────────────┼──────┼──────┤
│ F6 │ araclar/hesaplayici/page.tsx                     │  1   │  S   │
│    │ Temel hesap makinesi + inşaat modlari:           │      │      │
│    │ (yuzde, KDV, kur hesabi). Saf client-side.      │      │      │
│    │ BAGIMLILIK: Yok                                  │      │      │
├────┼──────────────────────────────────────────────────┼──────┼──────┤
│ F7 │ araclar/beton/page.tsx                           │  2   │  S   │
│    │ Hacim → cimento/kum/cakil/su hesabi.             │      │      │
│    │ C20/C25/C30 oran secenekleri. Client-side.       │      │      │
│    │ BAGIMLILIK: Yok                                  │      │      │
├────┼──────────────────────────────────────────────────┼──────┼──────┤
│ F8 │ araclar/alan-hacim/page.tsx                      │  2   │  S   │
│    │ Dikdortgen/ucgen/daire alan; kutu/silindir hacim.│      │      │
│    │ Dinamik sekil secimi. Client-side.               │      │      │
│    │ BAGIMLILIK: Yok                                  │      │      │
├────┼──────────────────────────────────────────────────┼──────┼──────┤
│ F9 │ araclar/egim/page.tsx                            │  2   │  M   │
│    │ Manuel giris (yukseklik/mesafe → derece/yuzde).  │      │      │
│    │ + DeviceOrientationEvent ile otomatik olcum.     │      │      │
│    │ BAGIMLILIK: Yok                                  │      │      │
├────┼──────────────────────────────────────────────────┼──────┼──────┤
│F10 │ araclar/demir/page.tsx                           │  2   │  S   │
│    │ Cap secimi (8-32mm) + boy → kg hesabi.           │      │      │
│    │ Standart demir agirlik tablosu. Client-side.     │      │      │
│    │ BAGIMLILIK: Yok                                  │      │      │
├────┼──────────────────────────────────────────────────┼──────┼──────┤
│F11 │ araclar/su-terazisi/page.tsx                     │  1   │  M   │
│    │ DeviceOrientationEvent: beta/gamma → kabarcik.   │      │      │
│    │ Canvas veya SVG ile gorsel terazı figuru.        │      │      │
│    │ iOS 13+ icin DeviceMotionEvent.requestPermission │      │      │
│    │ BAGIMLILIK: Yok (device API)                     │      │      │
├────┼──────────────────────────────────────────────────┼──────┼──────┤
│F12 │ araclar/qr/page.tsx                              │  2   │  M   │
│    │ jsQR veya @zxing/browser lib.                    │      │      │
│    │ Kamera preview + calistiginda sonuc goster.      │      │      │
│    │ BAGIMLILIK: npm install jsqr                     │      │      │
├────┼──────────────────────────────────────────────────┼──────┼──────┤
│F13 │ araclar/mesafe/page.tsx                          │  3   │  S   │
│    │ Manuel giris ile baslat (A-B noktasi uzakligi).  │      │      │
│    │ AR/ML versiyonu Faz 4'e birak.                   │      │      │
│    │ BAGIMLILIK: Yok                                  │      │      │
├────┼──────────────────────────────────────────────────┼──────┼──────┤
│F14 │ araclar/fotograf-not/page.tsx                    │  3   │  M   │
│    │ Kameradan/galeriden foto sec.                    │      │      │
│    │ Canvas uzerine kalem, ok, yazi anotasyon.        │      │      │
│    │ PNG olarak kaydet/indir.                         │      │      │
│    │ BAGIMLILIK: Yok (canvas API)                     │      │      │
├────┼──────────────────────────────────────────────────┼──────┼──────┤
│F15 │ araclar/rehber/page.tsx                          │  3   │  S   │
│    │ Statik icerik: acil numralar, TS standartlari,   │      │      │
│    │ yasal zorunluluklar, kisaltmalar.                │      │      │
│    │ MDX veya JSON veri + render. Client-side.        │      │      │
│    │ BAGIMLILIK: Yok                                  │      │      │
├────┼──────────────────────────────────────────────────┼──────┼──────┤
│F16 │ araclar/malzeme-tahmini/page.tsx — tam impl.     │  2   │  M   │
│    │ Alan, yapi tipi, malzeme kategorisi form.        │      │      │
│    │ POST /api/v1/araclar/malzeme ile tahmini goster. │      │      │
│    │ Streaming destekli (SSE okuma).                  │      │      │
│    │ BAGIMLILIK: B6 bitmeli                           │      │      │
└────┴──────────────────────────────────────────────────┴──────┴──────┘

Oncelik: 1=sprint1, 2=sprint2, 3=sprint3
Boyut: S=yarım gün, M=1 gün, L=1.5-2 gün
```

---

### GUVENLIK & TEST — Faz 3 Gorev Listesi

```
┌─────────────────────────────────────────────────────────────────────┐
│ GUVENLIK & TEST — FAZ 3 GOREVLERI                                   │
├────┬──────────────────────────────────────────────────┬──────┬──────┤
│ #  │ Gorev                                            │ Onc. │ Boyut│
├────┼──────────────────────────────────────────────────┼──────┼──────┤
│ S1 │ SSE endpoint auth testi                          │  1   │  S   │
│    │ Geçersiz/süresi dolmus token ile SSE cagrisinda  │      │      │
│    │ 401 donduruluyor mu dogrula.                     │      │      │
├────┼──────────────────────────────────────────────────┼──────┼──────┤
│ S2 │ JWT refresh token akis testi                     │  1   │  S   │
│    │ access tok süresi dolunca refresh ile yenileme.  │      │      │
│    │ Cürümüs refresh token ile 401 dogrula.           │      │      │
├────┼──────────────────────────────────────────────────┼──────┼──────┤
│ S3 │ PostgreSQL gecis dogrulama                       │  1   │  M   │
│    │ Tum Alembic migration'lari PG'de calistir.       │      │      │
│    │ ENUM tip yaratimi, NULLABILITY dogrula.          │      │      │
│    │ bildirim_zamanlayici.py func.date() testi.       │      │      │
├────┼──────────────────────────────────────────────────┼──────┼──────┤
│ S4 │ Redis rate limiting uclari testi                 │  2   │  S   │
│    │ 6. istekte 429 Too Many Requests dogrulanmali.   │      │      │
│    │ Redis olmadan graceful fallback (in-memory).     │      │      │
├────┼──────────────────────────────────────────────────┼──────┼──────┤
│ S5 │ Groq API key sizmasi kontrolü                    │  1   │  S   │
│    │ .env dosyasi .gitignore'da mi?                   │      │      │
│    │ Log'larda key yaziliyor mu grep ile tara.        │      │      │
│    │ Hata mesajlarinda key gozuküyor mu?              │      │      │
└────┴──────────────────────────────────────────────────┴──────┴──────┘
```

---

### AI / PROMPT MUHENDISI — Faz 3 Gorev Listesi

```
┌─────────────────────────────────────────────────────────────────────┐
│ AI / PROMPT MUHENDISI — FAZ 3 GOREVLERI                             │
├────┬──────────────────────────────────────────────────┬──────┬──────┤
│ #  │ Gorev                                            │ Onc. │ Boyut│
├────┼──────────────────────────────────────────────────┼──────┼──────┤
│ P1 │ Chat streaming sistem prompt guncellemesi        │  1   │  M   │
│    │ services/chat_prompt.py → build_chat_prompt()    │      │      │
│    │ fonksiyonu: santiye_adi, bugun_tarihi, son_7_gun │      │      │
│    │ ozet baglami (rapor sayisi, stok uyarilari).     │      │      │
├────┼──────────────────────────────────────────────────┼──────┼──────┤
│ P2 │ Malzeme tahmini prompt'u                         │  1   │  M   │
│    │ services/malzeme_tahmini_prompt.py yaz.          │      │      │
│    │ Giris: {alan_m2, yapi_tipi, malzeme_kategorisi}  │      │      │
│    │ Cikis: JSON miktar + birim + aciklama.           │      │      │
│    │ Few-shot: 3 ornek ekle.                          │      │      │
├────┼──────────────────────────────────────────────────┼──────┼──────┤
│ P3 │ Hizli komut chip prompt'lari guncellestirme      │  2   │  S   │
│    │ Mevcut QUICK_COMMANDS icin streaming uyumlu      │      │      │
│    │ format: kisa/net/madde madde cikti beklentisi.   │      │      │
└────┴──────────────────────────────────────────────────┴──────┴──────┘
```

---

## 5. Kritik Teknik Kararlar

### 5.1 Groq SSE Streaming — FastAPI StreamingResponse

**Durum:** `chat.py` dosyasinda Faz 3 icin TODO yorumu mevcut, implementasyon hazir degil.

**Uygulama deseni:**

```python
# backend/app/api/v1/chat.py — Faz 3 implementasyonu

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from groq import AsyncGroq
from app.core.config import settings
from app.api.deps import CurrentMusteriId
from app.services.chat_prompt import build_chat_prompt

router = APIRouter(tags=["chat"])

@router.post("/message/stream")
async def chat_stream(
    mesaj: ChatMesaj,
    musteri_id: str = Depends(CurrentMusteriId),
):
    client = AsyncGroq(api_key=settings.GROQ_API_KEY)

    async def event_generator():
        stream = await client.chat.completions.create(
            model=settings.DEFAULT_MODEL,
            messages=[
                {"role": "system", "content": build_chat_prompt(...)},
                {"role": "user", "content": mesaj.icerik},
            ],
            stream=True,
            temperature=0.3,
            max_tokens=512,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                # SSE formati: "data: <metin>\n\n"
                yield f"data: {delta}\n\n"
        # Stream sonu sinyali
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Nginx proxy bufferini kapat
        },
    )
```

**Frontend SSE okuma (asistan/page.tsx):**

```typescript
const response = await fetch('/api/v1/chat/message/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json',
             'Authorization': `Bearer ${token}` },
  body: JSON.stringify({ icerik: input }),
});
const reader = response.body!.getReader();
const decoder = new TextDecoder();
let buffer = '';
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n\n');
  buffer = lines.pop() || '';
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const text = line.slice(6);
      if (text === '[DONE]') break;
      // Streaming karakteri ekle mevcut mesaja
      setMessages(prev => updateLastAssistantMessage(prev, text));
    }
  }
}
```

**Dikkat edilecekler:**
- `X-Accel-Buffering: no` Nginx arkasinda zorunlu, aksi halde SSE tamponlanir.
- Auth: `StreamingResponse`'ta `Depends(get_current_user)` dogrudan calisir, route parametresi olarak alinmali (header token parse).
- Eski `/message` endpoint'i (placeholder) Faz 3'te `/message/stream` ile yenilenmeli; geriye donuk uyumluluk icin JSON yanit modunu da koru.

---

### 5.2 SQLite → PostgreSQL Sifir Downtime Gecis Stratejisi

**Mevcut sorun:** `bildirim_zamanlayici.py` satirinda `cast(WhatsappMesaji.created_at, SqliteDate)` var. PostgreSQL'de `SqliteDate` tipi tanimsiz.

**Adim adim gecis:**

```
1. KOD DUZELTME (once yap, PG bekleme):
   bildirim_zamanlayici.py:
   - ONCE: cast(WhatsappMesaji.created_at, SqliteDate)
   - SONRA: func.date(WhatsappMesaji.created_at)
   Her iki DB'de de calisir → guvenli degisim

2. ENUM KONTROLU:
   SQLite'ta Enum sadece string olarak saklanir.
   PostgreSQL'de SAEnum, CREATE TYPE calistirir.
   Alembic revision'larinda create_constraint=True kontrol et.
   Kritik tablolar: stok_hareketleri.tip, isg_kayitlari.tip,
   projeler.durum, medya_dosyalari.tip, hakedisler.durum

3. ORTAM GEÇISI:
   .env'e ekle:
   DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/santiye
   SQLITE_DATABASE_URL=sqlite+aiosqlite:///./santiye.db  (yedek)

4. MIGRATION:
   alembic upgrade head  # PG'de calistir
   Varsa veri: sqlite-utils veya pandas ile CSV ara transfer

5. DOGRULAMA:
   pytest -x tests/  # Tum testler PG uzerinde gec
   Ozellikle: bildirim_zamanlayici schedulerini manuel tetikle
```

**Risk notu:** Gelistirme SQLite'ta devam edebilir (DATABASE_URL env'e gore secilir). Production deployment'inda PG zorunlu.

---

### 5.3 PWA manifest.json — Next.js 14 Yaklasimi

**Nereye konur:** Next.js 14 App Router'da `app/manifest.ts` dosyasi (NOT `public/manifest.json`).

```typescript
// frontend/app/manifest.ts
import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Şantiye Asistanı',
    short_name: 'Şantiye',
    description: 'Sahada akıllı şantiye yönetimi',
    start_url: '/anasayfa',
    display: 'standalone',
    background_color: '#0E1117',
    theme_color: '#F59E0B',
    orientation: 'portrait',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png',
        purpose: 'maskable' },
    ],
  };
}
```

**Service Worker gerekli mi?**

Faz 3 icin: **Hayir, zorunlu degil.**  
Next.js `display: standalone` + `manifest.ts` ile uygulama telefon ana ekranina eklenebilir olur.  
PWA'nin temel gereksinimi: manifest + HTTPS. SW, offline calisma icin gereklidir.

Tavsiye: Faz 3'te sadece manifest ekle. Faz 4'te `next-pwa` veya `workbox` ile SW ekle (offline rapor goruntuleme icin).

**Ikon dosyalari:**  
`public/icons/icon-192.png` ve `public/icons/icon-512.png` olustur.  
Araç: `sharp` ile mevcut logo'dan otomatik boyutlandirma veya manuel PNG.

---

### 5.4 12 Arac Sayfasi — Client-Side vs Groq API Karari

| Arac | Karar | Gerekcesi |
|------|-------|----------|
| Birim donusturucu | CLIENT-SIDE | Sabit konversiyon katsayilari (metre/inch, kg/lb vb.) |
| Hesaplayici | CLIENT-SIDE | Aritmetik islem, API gereksiz |
| Malzeme tahmini | GROQ API | Malzeme miktari degiskene bagimli (alan, yapi tipi, standart), dil anlama gerekiyor |
| Su terazisi | DEVICE API | DeviceOrientationEvent beta/gamma degerleri |
| Beton hesaplayici | CLIENT-SIDE | TS 500 standardina gore sabit karisim oranlari |
| Alan & Hacim | CLIENT-SIDE | Sabit geometri formuller |
| Egim hesaplayici | CLIENT-SIDE + DEVICE | Manuel: tan(yukseklik/mesafe), Otomatik: DeviceOrientation |
| Demir/Celik agirlik | CLIENT-SIDE | TS 708 standart demir agirlik tablosu (sabit) |
| QR okuyucu | KAMERA API + LIB | jsQR (MIT, 10KB, WebAssembly yok) veya @zxing/browser |
| Mesafe olcer | MANUEL (ilk) | ML-Kit/AR kompleks; Faz 3'te manuel giris yeterli |
| Fotograf notlari | CANVAS API | Kameradan/galeriden resim, canvas uzerine cizim |
| Santiye rehberi | STATIK | JSON/MDX icerik, arama ile |

**Groq API cagiran tek arac: Malzeme Tahmini.**  
Diger 11 arac tamamen client-side — API bagimlilik yok, cevrimdisi calisir.

---

## 6. Araç Sayfalari — Teknik Detay Notlari

### 6.1 Su Terazisi (su-terazisi)

```typescript
// DeviceOrientationEvent permission (iOS 13+)
async function requestPermission() {
  if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
    const result = await (DeviceOrientationEvent as any).requestPermission();
    if (result !== 'granted') throw new Error('İzin reddedildi');
  }
}

window.addEventListener('deviceorientation', (e) => {
  const beta = e.beta ?? 0;   // on/arka egim (-180 / 180)
  const gamma = e.gamma ?? 0; // sol/sag egim (-90 / 90)
  // Kabarcik pozisyonu: gamma → x, beta → y
  setBubbleX(clamp((gamma / 90) * MAX_OFFSET, -MAX_OFFSET, MAX_OFFSET));
  setBubbleY(clamp((beta / 90) * MAX_OFFSET, -MAX_OFFSET, MAX_OFFSET));
});
```

**Gorsel:** SVG daire icerisinde kucuk daire (kabarcik). Ortada ise yesil, disarida kirmizi.

### 6.2 QR Okuyucu (qr)

```
npm install jsqr
```

```typescript
// Kamera → canvas → jsQR dongusu
import jsQR from 'jsqr';
const canvas = canvasRef.current;
const ctx = canvas.getContext('2d')!;
ctx.drawImage(videoRef.current, 0, 0);
const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
const code = jsQR(imageData.data, imageData.width, imageData.height);
if (code) setSonuc(code.data);
```

**Not:** `getUserMedia({ video: { facingMode: 'environment' } })` ile arka kamera ac.

### 6.3 Malzeme Tahmini (malzeme-tahmini) — Groq Prompt

```python
# services/malzeme_tahmini_prompt.py

SYSTEM = """Sen bir Türk inşaat mühendisisin. Kullanıcı alan, yapı tipi ve malzeme kategorisi verince, 
standart miktarları JSON formatında hesapla. TS standartlarını kullan. 
Cevap: {"kalemler": [{"malzeme": str, "miktar": float, "birim": str, "aciklama": str}]}"""

# Few-shot ornek:
# Kullanici: "50m2 betonarme kolon, beton malzemeleri"
# Asistan: {"kalemler": [{"malzeme": "Cimento CEM I 42.5", "miktar": 380, "birim": "kg/m3", ...}]}
```

### 6.4 Fotograf Notlari (fotograf-not)

```typescript
// Anotasyon araclari: kalem, ok, dikdortgen, metin
// Canvas state: her cizim komutu history stack'te
// Geri al: history.pop() + yeniden ciz
// Kaydet: canvas.toBlob() → link.click() ile PNG indir
```

---

## 7. Sprint Plani Ozeti

### Sprint 1 (Gun 1-3): Temel altyapı + Kolay kazanimlar

| Agent | Gorevler |
|-------|---------|
| Backend Dev | B1 (migration), B4 (refresh token), B5 (hakedis router), B7 (PG gecis) |
| Frontend Dev | F4 (PWA manifest), F5 (birim-donusturucu), F6 (hesaplayici), F7 (beton), F8 (alan-hacim) |
| Guvenlik | S3 (PG gecis dogrulama), S5 (key sicizmasi kontrolu) |
| AI/Prompt | P1 (chat prompt guncelle), P2 (malzeme tahmini prompt) |

### Sprint 2 (Gun 4-7): AI Chat + Kompleks araclar

| Agent | Gorevler |
|-------|---------|
| Backend Dev | B2 (SSE streaming — kritik), B6 (malzeme tahmini endpoint), B8 (Redis rate limiting) |
| Frontend Dev | F11 (su terazisi), F9 (egim), F10 (demir), F12 (QR), F2 (token yenileme) |
| Guvenlik | S1 (SSE auth), S2 (refresh token test), S4 (rate limit test) |
| AI/Prompt | P3 (chip promptlari) |

### Sprint 3 (Gun 8-10): Entegrasyon + Son araclar

| Agent | Gorevler |
|-------|---------|
| Backend Dev | B3 (chat gecmis endpoint), B9 (SSE auth middleware guclendir) |
| Frontend Dev | F1 (Asistan chat UI — SSE), F3 (hakedis sayfasi), F13 (mesafe), F14 (fotograf-not), F15 (rehber), F16 (malzeme-tahmini tam) |
| Guvenlik | Son entegrasyon test gecisi |

---

## 8. Teslim Kriterleri (Faz 3 Bitti Sayilma Sartlari)

- [ ] Asistan tab'inda Groq ile gercek streaming chat calisuyor (karakterler tek tek geliyor)
- [ ] Hizli komut chip'lerinden en az 5'i fonksiyonel (mesaj gonderiyor)
- [ ] Chat gecmisi kayit altina aliniyor, sayfayi yenileyince geri geliyor
- [ ] JWT refresh token: access süresi dolunca otomatik yenileniyor, kullanici cikis yapmiyor
- [ ] Hakedis sayfasi: liste goruntuleniyor, Excel indirilabiliyor
- [ ] 12 araç sayfasinin en az 8'i fonksiyonel (placeholder "yakinda" yok)
- [ ] PWA: Chrome/Safari'de "Ana Ekrana Ekle" calisiyor, ikon ve isim dogru gozukuyor
- [ ] PostgreSQL ile tum testler geciyor (SQLite cast hatasi yok)
- [ ] Rate limit: /auth/login'e 6. istekte 429 donuyor
- [ ] Malzeme tahmini: Groq'tan tahmin sonucu ekranda gozukuyor

---

## 9. Bilinen Teknik Riskler (Faz 3 Ozgul)

| Risk | Onem | Onlem |
|------|------|-------|
| Groq streaming iOS Safari'de kesiliyor | ORTA | Keep-alive ping: her 15 sn. `data: ping\n\n` gonder |
| DeviceOrientationEvent iOS izin modali kullanici reddedebilir | DUSUK | Fallback: manuel giris goster, izin reddinde uyari badge |
| Redis yoksa rate limiting cal is miyor | ORTA | Fallback: in-memory dict ile basit rate limit (production disi) |
| PostgreSQL ENUM migration mevcut SQLite verisiyle catisiyor | ORTA | Alembic'te enum drop-create stratejisi; data migration once |
| jsQR WebWorker'da calismiyor, ana thread'i blokluyor | DUSUK | requestAnimationFrame loop ile throttle; buyuk goruntu scan islemi yavaslayabilir |
| SSE baglantisi Nginx arkasinda tamponlanir | YUKSEK | X-Accel-Buffering: no header zorunlu, Nginx'te proxy_buffering off ekle |
