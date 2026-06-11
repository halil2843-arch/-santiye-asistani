# Şantiye Asistanı — Mimari Spec v2.0
**Tarih:** 2026-06-01  
**Hazırlayan:** Mimar Agent (Senior Architect + Spec skill)  
**Durum:** ONAYLANDI — tüm agentlar bu spec'e göre çalışır

---

## 1. Mevcut Durum Analizi

### Tamamlanan Backend Özellikleri

| Modül | Endpoint'ler | Durum |
|-------|-------------|-------|
| Auth | POST /auth/register, POST /auth/login | Tam, JWT (python-jose + passlib) |
| Sites | GET/POST /sites/, PATCH /sites/{id}, GET /sites/pending-phones, POST /sites/{id}/link-phone, GET/POST/DELETE /sites/{id}/phones | Tam, çoklu numara desteği var |
| Reports | GET /reports/{santiye_id}, POST /reports/generate, GET /reports/{id}/download, PATCH /reports/{id}/approve, GET /reports/{id}/preview | Tam, Excel çok-sekme preview var |
| Templates | POST /templates/upload, GET /templates/, DELETE /templates/{id} | Tam, xlsx + docx parse |
| Webhook | POST/GET /webhook/whatsapp, GET /webhook/messages/{santiye_id} | Tam, Twilio imza doğrulama var |
| Koordinatör | GET/POST /koordinator/, DELETE /koordinator/{id} | Tam, LLM tabanlı yönlendirme |
| Kullanıcılar | GET/POST /users/, PATCH/DELETE /users/{id} | Tam, admin-only RBAC |

**AI Pipeline (çalışan):**  
- Aşama 1: Groq LLM → WhatsApp mesajlarından ExtractionSonucu (personel, makine, iş, malzeme, hava)  
- Aşama 2: Groq LLM → ExtractionSonucu → şablon alanlarına eşleme (map_to_template_fields)  
- Gemini 2.0 Flash → fotoğraf analizi (medya URL'lerinden)  
- APScheduler → her gün 18:00 İstanbul saatinde geç rapor uyarısı (Twilio WhatsApp)  
- Excel: aylık dosya, her gün ayrı sekme (rapor_202605.xlsx çalışıyor)  
- Docx: docxtpl ile Word doldurucu  

**Veri Modeli (mevcut tablolar):**  
`musteriler` → `kullanicilar` (tenant/RBAC)  
`santiyeler` + `santiye_numaralari` (çoklu WhatsApp)  
`sablonlar` (xlsx/docx, alan_esleme JSON)  
`raporlar` (tarih, durum: taslak/onaylandi/iptal)  
`whatsapp_mesajlari` + `cikarilanlar` (extraction sonuçları)  
`koordinatorler` (çok-şantiye koordinatör numaraları)  
`pending_whatsapp` (bilinmeyen numaralar)  

### Tamamlanan Frontend Özellikleri

| Sayfa | Route | Durum |
|-------|-------|-------|
| Login | /login | Var (auth group) |
| Dashboard | /dashboard | Var |
| Şantiyeler | /santiyeler | Tam — CRUD + çoklu numara + pending bağlama |
| Raporlar | /raporlar | Tam — onay + indirme + Excel preview (çok-sekme) |
| Şablonlar | /sablonlar | Var |
| Koordinatörler | /koordinator | Var |
| Mesajlar | /mesajlar | Var |
| Kullanıcılar | /kullanicilar | Var |

**Component altyapısı:** Card, Button, Badge, Sidebar (sidebar-tabanlı desktop layout)  
**API katmanı:** `lib/api.ts` — tüm endpoint'leri kapsıyor, JWT Bearer token, 401 otomatik logout  
**Type güvenliği:** `types/index.ts` — tüm response tipleri tanımlı  

### Eksik / Geliştirilmesi Gereken Alanlar

1. **Mobil layout yok:** Sidebar sabit 64px genişlik, telefonda kullanılamaz. Hiçbir responsive breakpoint yok.
2. **Tab sistemi yok:** 4 ana tab (Ana Sayfa / Yönetim / Araçlar / Asistan) henüz implement edilmemiş.
3. **Proje modülü eksik:** Projeler (proje içi: raporlama, planlama, kaynak, güvenlik, medya, harita, aktivite) hiç yok.
4. **AI Chat (Asistan tab) yok:** Groq altyapısı var ama chat UI implement edilmemiş. Hızlı komut chipleri yok.
5. **Araçlar modülü yok:** 12 saha aracının hiçbiri (birim dönüştürücü, hesaplayıcı vb.) yok.
6. **Yönetim modüllerinin çoğu eksik:** Stok, Dosyalar, Galeri, İş Planı, Ekip, ISG, Puantaj, Hakediş, Toplantı Notları implementasyonu yok — sadece Raporlar + Şablonlar var.
7. **Ana Sayfa widget'ları yok:** Hava durumu, konum (il/ilçe), bildirimler, sık kullanılanlar, bugünün toplamı widgetları implement edilmemiş.
8. **Hava durumu entegrasyonu yok:** Backend'de `HavaDurumu` schema var (extraction'dan geliyor) ama dış kaynak (OpenWeather vb.) bağlantısı yok.
9. **SQLite → PostgreSQL geçişi:** requirements.txt'te `asyncpg` var ama model kodunda SQLite cast kullanılıyor (`bildirim_zamanlayici.py`). Production için PostgreSQL geçişi yapılmadı.
10. **Dosya depolama lokal:** Şablon ve çıktı dosyaları sunucu diskinde tutulmakta. Production için S3/R2 gerekecek.

---

## 2. Yeni Mobil Mimari

### Frontend Route Yapısı (yeni tab sistemi)

```
app/
├── (auth)/
│   ├── login/page.tsx        (mevcut)
│   └── register/page.tsx     (YENİ)
│
└── (app)/                    ← YENİ: mobil-first layout (bottom tab bar)
    ├── layout.tsx             ← MobilLayout: bottom nav + top header
    │
    ├── anasayfa/
    │   └── page.tsx           ← Tab 1: Konum, hava, bildirimler, sık kullanılanlar, bugün toplamı
    │
    ├── yonetim/               ← Tab 2: 12 modül grid
    │   ├── page.tsx           ← 12-modül grid anasayfası
    │   ├── raporlar/
    │   │   └── page.tsx       (mevcut /raporlar → taşı)
    │   ├── taslaklar/
    │   │   └── page.tsx       (YENİ)
    │   ├── projeler/
    │   │   ├── page.tsx       ← Aktif/pasif toggle + arşiv klasörü listesi
    │   │   └── [id]/
    │   │       ├── page.tsx   ← Proje detay (tab router içinde)
    │   │       ├── raporlama/ (raporlar bu projeye ait)
    │   │       ├── planlama/
    │   │       ├── kaynak/
    │   │       ├── guvenlik/
    │   │       ├── medya/
    │   │       ├── harita/
    │   │       └── aktivite/
    │   ├── stok/page.tsx      (YENİ)
    │   ├── dosyalar/page.tsx  (YENİ)
    │   ├── galeri/page.tsx    (YENİ)
    │   ├── is-plani/page.tsx  (YENİ)
    │   ├── ekip/page.tsx      (mevcut /kullanicilar → taşı + genişlet)
    │   ├── isg/page.tsx       (YENİ)
    │   ├── puantaj/page.tsx   (YENİ)
    │   ├── hakedis/page.tsx   (YENİ)
    │   └── toplanti/page.tsx  (YENİ)
    │
    ├── araclar/               ← Tab 3: 12 saha aracı
    │   ├── page.tsx           ← Araçlar grid
    │   ├── birim-donusturucu/
    │   ├── hesaplayici/
    │   ├── malzeme-tahmini/
    │   ├── su-terazisi/
    │   └── ...                (12 araç)
    │
    └── asistan/               ← Tab 4: AI Chat
        └── page.tsx           ← Groq chat + hızlı komut chipleri
```

**Layout Kararı:**  
- Desktop (≥1024px): Sidebar korunur, mevcut `(dashboard)` layout devam eder  
- Mobil (<1024px): Bottom tab bar (4 tab) + top header (proje adı + bildirim ikonu)  
- Tek layout dosyası `(app)/layout.tsx` her iki durumu handle eder (`useMediaQuery` veya CSS grid)  

### Yeni Gerekli API Endpoint'leri

#### Projeler (Şantiye alt-entity'si olarak)
```
GET    /api/v1/projects/                    — tenant projeleri (aktif/pasif/arşiv filtresi)
POST   /api/v1/projects/                    — yeni proje
GET    /api/v1/projects/{id}               — proje detayı
PATCH  /api/v1/projects/{id}               — güncelle (isim, durum, konum)
DELETE /api/v1/projects/{id}               — soft delete / arşivle
GET    /api/v1/projects/{id}/aktivite      — aktivite feed (sayfalandırmalı)
POST   /api/v1/projects/{id}/aktivite      — manuel aktivite kaydı
```

#### Stok
```
GET    /api/v1/stok/                        — stok listesi (proje/depo filtresi)
POST   /api/v1/stok/                        — stok girişi
PATCH  /api/v1/stok/{id}                   — güncelle
POST   /api/v1/stok/{id}/hareket           — stok hareketi (giriş/çıkış)
GET    /api/v1/stok/{id}/hareketler        — hareket geçmişi
```

#### Galeri / Dosyalar
```
POST   /api/v1/media/upload                 — fotoğraf/dosya yükle (multipart)
GET    /api/v1/media/                       — liste (proje/tarih/tip filtresi)
DELETE /api/v1/media/{id}                  — sil
```

#### ISG
```
GET    /api/v1/isg/                         — ISG kayıtları
POST   /api/v1/isg/                         — yeni kayıt (olay/denetim/eğitim)
PATCH  /api/v1/isg/{id}                    — güncelle
```

#### Hakediş
```
GET    /api/v1/hakedis/                     — hakediş listesi
POST   /api/v1/hakedis/                     — yeni hakediş
GET    /api/v1/hakedis/{id}/excel          — Excel indir
```

#### Toplantı Notları
```
GET    /api/v1/toplanti/                    — toplantı listesi
POST   /api/v1/toplanti/                    — yeni toplantı + katılımcılar
GET    /api/v1/toplanti/{id}               — detay + notlar
```

#### Hava Durumu (dış kaynak)
```
GET    /api/v1/weather?il=istanbul&ilce=besiktas  — OpenWeatherMap proxy
```

#### AI Chat Endpoint'i
```
POST   /api/v1/chat/message                — Groq streaming chat
GET    /api/v1/chat/history                — konuşma geçmişi
DELETE /api/v1/chat/history                — geçmişi temizle
```

#### Ana Sayfa Widget'ları
```
GET    /api/v1/dashboard/summary           — bugünün özeti (rapor sayısı, personel toplamı, aktif şantiye)
GET    /api/v1/dashboard/notifications     — okunmamış bildirimler
PATCH  /api/v1/dashboard/notifications/{id}/read  — okundu işaretle
POST   /api/v1/dashboard/favorites         — sık kullanılana ekle
```

### Güncellenecek Mevcut Endpoint'ler

| Endpoint | Değişiklik |
|----------|-----------|
| GET /sites/ | `proje_id` filtresi ekle; konum alanları (il, ilce, enlem, boylam) response'a ekle |
| POST /sites/ | `il`, `ilce`, `enlem`, `boylam` alanları ekle |
| GET /reports/{santiye_id} | Sayfalandırma (skip/limit) ekle; `proje_id` filtresi |
| POST /reports/generate | Streaming response seçeneği (WebSocket veya SSE) |
| GET /webhook/messages/{santiye_id} | Tarih filtresi ekle |

---

## 3. Veri Modeli Değişiklikleri

### Yeni Tablolar / Alanlar Gereksinimi

```sql
-- Mevcut Santiye tablosuna eklenecek alanlar
ALTER TABLE santiyeler ADD COLUMN il VARCHAR(100);
ALTER TABLE santiyeler ADD COLUMN ilce VARCHAR(100);
ALTER TABLE santiyeler ADD COLUMN enlem FLOAT;
ALTER TABLE santiyeler ADD COLUMN boylam FLOAT;
ALTER TABLE santiyeler ADD COLUMN arsiv BOOLEAN DEFAULT FALSE;

-- Yeni: Projeler (şantiye alt-entity'si olarak tasarlandı, ilerleyen sürümde santiyeden bağımsız olabilir)
CREATE TABLE projeler (
    id          VARCHAR(36) PRIMARY KEY,
    musteri_id  VARCHAR(36) NOT NULL REFERENCES musteriler(id),
    santiye_id  VARCHAR(36) REFERENCES santiyeler(id),
    isim        VARCHAR(200) NOT NULL,
    tanim       TEXT,
    durum       ENUM('aktif','pasif','arsiv') DEFAULT 'aktif',
    baslangic_tarihi DATE,
    bitis_tarihi     DATE,
    il          VARCHAR(100),
    ilce        VARCHAR(100),
    enlem       FLOAT,
    boylam      FLOAT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ
);

-- Aktivite feed (projeler için)
CREATE TABLE aktiviteler (
    id          VARCHAR(36) PRIMARY KEY,
    proje_id    VARCHAR(36) NOT NULL REFERENCES projeler(id),
    kullanici_id VARCHAR(36) REFERENCES kullanicilar(id),
    tip         VARCHAR(50),   -- 'rapor_olusturuldu', 'mesaj_geldi', 'manuel', vs.
    baslik      VARCHAR(300),
    aciklama    TEXT,
    meta        JSON,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Stok
CREATE TABLE stok_kalemleri (
    id           VARCHAR(36) PRIMARY KEY,
    musteri_id   VARCHAR(36) NOT NULL REFERENCES musteriler(id),
    proje_id     VARCHAR(36) REFERENCES projeler(id),
    malzeme_adi  VARCHAR(200) NOT NULL,
    birim        VARCHAR(30),
    miktar       FLOAT DEFAULT 0,
    min_miktar   FLOAT DEFAULT 0,  -- uyarı eşiği
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ
);

CREATE TABLE stok_hareketleri (
    id           VARCHAR(36) PRIMARY KEY,
    kalem_id     VARCHAR(36) NOT NULL REFERENCES stok_kalemleri(id),
    kullanici_id VARCHAR(36) REFERENCES kullanicilar(id),
    tip          ENUM('giris','cikis','sayim') NOT NULL,
    miktar       FLOAT NOT NULL,
    aciklama     TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Medya (galeri + dosyalar)
CREATE TABLE medya_dosyalari (
    id           VARCHAR(36) PRIMARY KEY,
    musteri_id   VARCHAR(36) NOT NULL REFERENCES musteriler(id),
    proje_id     VARCHAR(36) REFERENCES projeler(id),
    rapor_id     VARCHAR(36) REFERENCES raporlar(id),
    dosya_yolu   VARCHAR(1000) NOT NULL,
    dosya_adi    VARCHAR(300),
    mime_type    VARCHAR(100),
    boyut_byte   BIGINT,
    tip          ENUM('fotograf','belge','video','diger') DEFAULT 'fotograf',
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- ISG Kayıtları
CREATE TABLE isg_kayitlari (
    id           VARCHAR(36) PRIMARY KEY,
    musteri_id   VARCHAR(36) NOT NULL REFERENCES musteriler(id),
    proje_id     VARCHAR(36) REFERENCES projeler(id),
    tip          ENUM('olay','denetim','egitim','ramak_kala') NOT NULL,
    tarih        DATE NOT NULL,
    aciklama     TEXT,
    sonuc        TEXT,
    onem_seviyesi ENUM('dusuk','orta','yuksek','kritik') DEFAULT 'orta',
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Toplantı Notları
CREATE TABLE toplantilar (
    id           VARCHAR(36) PRIMARY KEY,
    musteri_id   VARCHAR(36) NOT NULL REFERENCES musteriler(id),
    proje_id     VARCHAR(36) REFERENCES projeler(id),
    baslik       VARCHAR(300) NOT NULL,
    tarih        TIMESTAMPTZ NOT NULL,
    yer          VARCHAR(200),
    notlar       TEXT,
    katilanlar   JSON,      -- [{isim, rol}] listesi
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Hakediş
CREATE TABLE hakedisler (
    id           VARCHAR(36) PRIMARY KEY,
    musteri_id   VARCHAR(36) NOT NULL REFERENCES musteriler(id),
    proje_id     VARCHAR(36) REFERENCES projeler(id),
    donem        VARCHAR(20),    -- "2026-05"
    toplam_tutar FLOAT,
    durum        ENUM('taslak','onaylandi','odendi') DEFAULT 'taslak',
    dosya_yolu   VARCHAR(1000),
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Bildirimler (in-app)
CREATE TABLE bildirimler (
    id           VARCHAR(36) PRIMARY KEY,
    musteri_id   VARCHAR(36) NOT NULL REFERENCES musteriler(id),
    kullanici_id VARCHAR(36) REFERENCES kullanicilar(id),  -- NULL = tüm tenant
    tip          VARCHAR(50),
    baslik       VARCHAR(300),
    icerik       TEXT,
    okundu       BOOLEAN DEFAULT FALSE,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Sık Kullanılanlar
CREATE TABLE sik_kullanilanlar (
    id           VARCHAR(36) PRIMARY KEY,
    kullanici_id VARCHAR(36) NOT NULL REFERENCES kullanicilar(id),
    tip          VARCHAR(50),  -- 'proje', 'rapor', 'sablon'
    referans_id  VARCHAR(36),
    etiket       VARCHAR(200),
    sira         INT DEFAULT 0
);
```

### Mevcut Modeller Yeterli mi?

| Model | Durum |
|-------|-------|
| Musteri / Kullanici | Yeterli; plan (free/pro/enterprise) yeter |
| Santiye / SantiyeNumara | Konum alanları (il, ilce, enlem, boylam, arsiv) EKLENMELİ |
| Sablon | Yeterli |
| Rapor | Yeterli; durum enum'una "hata" zaten eklenmiş |
| WhatsappMesaji / Cikarilan | Yeterli |
| Koordinatör | Yeterli |
| PendingWhatsapp | Yeterli |

**Kritik karar:** `Proje` modeli `Santiye`'den bağımsız bir entity olarak tanımlanmalı (santiye_id nullable FK). İlerleyen aşamada tek şantiyede birden fazla proje, veya şantiye bağlantısı olmayan projeler desteklenebilir.

---

## 4. Agent Görev Dağılımı

### Backend Dev için Görev Listesi (öncelik sıralı)

**Faz 1 — Temel (acil):**
1. `Santiye` modeline konum alanları ekle: `il`, `ilce`, `enlem`, `boylam`, `arsiv` → Alembic migration
2. Yeni `Proje` modeli ve CRUD endpoint'leri yaz (`/api/v1/projects/`)
3. Dashboard summary endpoint: `GET /api/v1/dashboard/summary` (rapor sayısı, personel toplamı, aktif şantiye)
4. Hava durumu proxy: `GET /api/v1/weather?il=&ilce=` (OpenWeatherMap free tier)
5. In-app bildirim tablosu + `GET /api/v1/dashboard/notifications`

**Faz 2 — Genişleme:**
6. Stok modeli + CRUD + hareket endpoint'leri
7. Medya upload endpoint (`/api/v1/media/upload`) — lokal disk, ilerleyen sürümde S3
8. ISG kayıt endpoint'leri
9. Toplantı notları endpoint'leri
10. Aktivite feed endpoint'leri (projeler için)

**Faz 3 — Araçlar & AI:**
11. AI Chat endpoint: `POST /api/v1/chat/message` (Groq streaming, SSE veya WebSocket)
12. Chat geçmiş tablosu + endpoint'leri
13. Hakediş endpoint'leri + Excel çıktısı
14. SQLite → PostgreSQL tam geçiş (bildirim_zamanlayici.py SQLite cast kaldır)
15. Rate limiting (slowapi veya custom middleware)

### Frontend Dev için Görev Listesi (öncelik sıralı)

**Faz 1 — Temel (acil):**
1. `(app)/layout.tsx` yaz: Bottom tab bar + responsive (mobil: bottom nav, desktop: sidebar)
2. `BottomTabBar` component: 4 tab ikonu (Ana Sayfa, Yönetim, Araçlar, Asistan) + aktif state
3. `anasayfa/page.tsx`: Konum seçici (il/ilçe dropdown), hava kartı, bugün özet kartları
4. `yonetim/page.tsx`: 12-modül grid layout (2x6 veya 3x4 grid, kart + ikon)
5. Mevcut `/santiyeler`, `/raporlar`, `/kullanicilar` sayfalarını `yonetim/` altına taşı/link ver

**Faz 2 — Genişleme:**
6. `yonetim/projeler/page.tsx`: Aktif/pasif toggle, arşiv butonu, proje kartları
7. `yonetim/projeler/[id]/page.tsx`: İç tab sistemi (Raporlama, Planlama, Kaynak, Güvenlik, Medya, Harita, Aktivite)
8. `yonetim/stok/page.tsx`: Stok listesi + hareket girişi form
9. `yonetim/galeri/page.tsx`: Izgara galeri + fotoğraf yükle
10. `yonetim/isg/page.tsx` + `yonetim/toplanti/page.tsx`

**Faz 3 — Araçlar & AI:**
11. `asistan/page.tsx`: Chat UI (mesaj listesi + input) + hızlı komut chipleri (5-6 adet)
12. `araclar/page.tsx`: 12 araç grid
13. `araclar/birim-donusturucu/page.tsx`, `araclar/hesaplayici/page.tsx` (client-side saf JS/TS)
14. `araclar/malzeme-tahmini/page.tsx` (API çağrılı — Groq ile tahmin)
15. `types/index.ts` güncellemesi: Proje, Stok, ISG, Hakediş tipleri ekle

### AI / Prompt Mühendisi için Görev Listesi

**Faz 1:**
1. Chat system prompt yaz: Şantiye bağlamında genel asistan; proje/rapor/stok hakkında soru yanıtlama
2. Mevcut `SYSTEM_PROMPT` ve `MAPPING_SYSTEM_PROMPT`'ı gözden geçir — konum bilgisi (il/ilçe) bağlama ekle
3. Hızlı komut chipleri için 6 hazır prompt template belirle (örn: "Bugünün raporu nerede?", "Stok durumu?", "ISG özeti")

**Faz 2:**
4. Malzeme tahmini prompt'u: `POST /araclar/malzeme-tahmini` için Groq tabanlı hesaplama
5. Hakediş otomatik doldurma prompt'u: raporlardan hakediş kalemlerini çıkar
6. Fotoğraf → ISG riski tespiti: Gemini analizi prompt'unu ISG bağlamına genişlet

**Faz 3:**
7. Extraction prompt'larını puantaj çizelgesi formatına uygun alan mapping'ini güçlendir
8. RAG benzeri bağlam: kullanıcının şantiye geçmişini chat'e enjekte et (son 7 gün özet)

### Rapor Uzmanı için Görev Listesi

**Faz 1:**
1. Aylık kümülatif puantaj sekmesini doğrula — `excel_filler.py` içindeki `_EKIP_KATEGORI_MAP` güncel mi kontrol et
2. Hakediş Excel şablonu oluştur ve `fill_xlsx` / `fill_docx` pipeline'ına entegre et
3. ISG aylık özet raporu şablonu (Excel)

**Faz 2:**
4. Proje bazlı rapor filtresi — mevcut `uret_rapor` orkestratörüne `proje_id` bağlamı ekle
5. Raporların PDF export'u (openpyxl → xlsxwriter veya weasyprint ile)
6. Otomatik aylık özet raporu: her ay 1'inde APScheduler ile WhatsApp'a gönder

### Güvenlik & Test için Görev Listesi

**Faz 1:**
1. Mevcut endpoint'lerde tenant isolation testleri yaz (başka tenant'ın verisine erişilemiyor mu?)
2. JWT token süresi + refresh token akışı ekle (şu an access_token süresi ayarlanmamış)
3. `DEBUG=True` durumunda Twilio imza doğrulamasının atlanması → production için `.env` kontrolü ekle
4. CORS `allow_origins=["*"]` production'da kısıtlanmalı

**Faz 2:**
5. Rate limiting: auth endpoint'lerine (register/login) 5/dakika sınırı
6. Dosya yükleme güvenliği: MIME tip doğrulama, boyut sınırı (10 MB) — mevcut kontrolsüz
7. Input sanitization: WhatsApp mesajları ham metin olarak DB'ye kaydediliyor, XSS yok ama log injection riski var
8. `pytest` test coverage: rapor_servisi, extractor, excel_filler için unit testler

**Faz 3:**
9. API anahtarı güvenliği: GROQ_API_KEY, GEMINI_API_KEY, TWILIO_* `.env` dışına çıkmamalı — secret scanning
10. WebSocket/SSE endpoint'leri için auth middleware

---

## 5. Faz Planı

### Faz 1 — Temel (1-2 hafta)

**Hedef:** Mobil kullanılabilir hale getir, proje yönetimi ekle, ana sayfa canlı veri

**Backend görevleri:**
- [ ] Santiye modeline konum alanları + Alembic migration
- [ ] Proje CRUD endpoint'leri (`/api/v1/projects/`)
- [ ] Dashboard summary endpoint
- [ ] Hava durumu proxy (OpenWeatherMap)
- [ ] In-app bildirim tablosu + listing endpoint

**Frontend görevleri:**
- [ ] `(app)/layout.tsx` — bottom tab bar + responsive
- [ ] `BottomTabBar` component (4 tab)
- [ ] `anasayfa/page.tsx` — konum + hava + özet kartları
- [ ] `yonetim/page.tsx` — 12 modül grid
- [ ] Mevcut sayfaları yeni route yapısına taşı

**Teslim kriterleri:**
- Telefonda 4 tab çalışıyor
- Ana sayfa hava durumu gösteriyor
- Yönetim'den raporlara ulaşılabiliyor
- Projeler listesi görüntülenebiliyor

---

### Faz 2 — Genişleme (2-3 hafta)

**Hedef:** Yönetim modüllerini tamamla (stok, galeri, ISG, toplantı), proje detay ekranı

**Backend görevleri:**
- [ ] Stok modeli + CRUD + hareket endpoint'leri
- [ ] Medya upload endpoint
- [ ] ISG endpoint'leri
- [ ] Toplantı notları endpoint'leri
- [ ] Aktivite feed endpoint'leri
- [ ] Proje detay endpoint'i (aktivite timeline dahil)

**Frontend görevleri:**
- [ ] `yonetim/projeler/page.tsx` — aktif/pasif/arşiv toggle
- [ ] `yonetim/projeler/[id]/page.tsx` — 7 sekme (iç tab router)
- [ ] `yonetim/stok/page.tsx`
- [ ] `yonetim/galeri/page.tsx`
- [ ] `yonetim/isg/page.tsx`
- [ ] `yonetim/toplanti/page.tsx`
- [ ] `yonetim/puantaj/page.tsx` (mevcut Excel preview'ı mobil uyumlu hale getir)

**Teslim kriterleri:**
- Proje oluşturulup detay ekranında tüm sekmeler görüntülenebiliyor
- Fotoğraf yüklenip galeride görünüyor
- Stok hareketi girilebiliyor

---

### Faz 3 — Araçlar & AI (2-3 hafta)

**Hedef:** Asistan chat, saha araçları, hakediş, production hazırlık

**Backend görevleri:**
- [ ] AI Chat endpoint (Groq SSE streaming)
- [ ] Chat geçmiş tablosu
- [ ] Hakediş endpoint'leri + Excel çıktısı
- [ ] Malzeme tahmini endpoint (Groq tabanlı)
- [ ] SQLite → PostgreSQL tam geçiş
- [ ] Rate limiting
- [ ] JWT refresh token

**Frontend görevleri:**
- [ ] `asistan/page.tsx` — chat UI + hızlı komut chipleri
- [ ] `araclar/page.tsx` — 12 araç grid
- [ ] 12 araç sayfası (birim dönüştürücü, hesaplayıcı, malzeme tahmini, vb.)
- [ ] `yonetim/hakedis/page.tsx`
- [ ] Push notification altyapısı (PWA Service Worker)

**Teslim kriterleri:**
- Asistan tab'ından Groq chat çalışıyor, hızlı komutlar kullanılabiliyor
- En az 4 araç fonksiyonel
- PWA olarak telefona eklenebiliyor (manifest.json)

---

## 6. Teknik Riskler & Kararlar

### Risk 1 — SQLite → PostgreSQL (ORTA RİSK)
**Sorun:** `bildirim_zamanlayici.py` içinde `cast(WhatsappMesaji.created_at, SqliteDate)` kullanılıyor. PostgreSQL'de bu cast çalışmaz.  
**Karar:** Faz 1'in başında SQLite cast'ı SQLAlchemy agnostik `func.date()` ile değiştir. PostgreSQL için `asyncpg` zaten requirements.txt'te var.  
**Eylem:** Backend Dev → Faz 1, 1. sprint, ilk iş.

### Risk 2 — Dosya Depolama Ölçeklenemez (YÜKSEK RİSK)
**Sorun:** Tüm şablon ve çıktı dosyaları sunucu diskinde. Ölçeklemede kayıp riski, yedekleme yok.  
**Karar:** Faz 2'de Cloudflare R2 (ücretsiz 10 GB) veya Supabase Storage entegrasyonu. Ara dönem için Docker volume mount yeterli.  
**Eylem:** Rapor Uzmanı + Backend Dev → Faz 2 planlamasına ekle.

### Risk 3 — Groq Rate Limit (ORTA RİSK)
**Sorun:** Aynı anda birden fazla şantiyeden mesaj gelirse paralel Groq çağrıları rate limit'e çarpar. Şu an retry mekanizması `MAX_RETRY=2` ile sınırlı.  
**Karar:** Faz 2'de task queue ekle (Celery + Redis veya ARQ). Anlık gereksinim için `asyncio.Semaphore` ile eş zamanlılık sınırla (maks 3 paralel çağrı).  
**Eylem:** Backend Dev → Faz 2, extractor.py'ye semaphore ekle.

### Risk 4 — JWT Refresh Token Yok (DÜŞÜK-ORTA RİSK)
**Sorun:** `create_access_token`'da süre ayarlanmamış (varsayılan `settings.ACCESS_TOKEN_EXPIRE_MINUTES`). Frontend 401 alınca login'e yönlendiriyor, yenileme mekanizması yok.  
**Karar:** Faz 1'de `ACCESS_TOKEN_EXPIRE_MINUTES=60` + Faz 3'te refresh token endpoint'i.  
**Eylem:** Güvenlik & Test → core/security.py kontrol et.

### Risk 5 — CORS Wildcard Production'da (DÜŞÜK RİSK)
**Sorun:** `settings.CORS_ORIGINS == "*"` → geliştirme kolaylığı ama production'da XSS vektörü.  
**Karar:** `.env` dosyasında `CORS_ORIGINS=https://santiyeasistani.com` şeklinde production URL'i tanımla.  
**Eylem:** Güvenlik & Test → deployment pipeline'ına environment variable şartı ekle.

### Risk 6 — Dosya Yükleme Güvenlik Kontrolsüz (ORTA RİSK)
**Sorun:** `templates.py` upload'da sadece `.xlsx` / `.docx` uzantısı kontrol ediliyor, MIME type ve boyut kontrolü yok.  
**Karar:** `python-magic` ile gerçek MIME tip kontrolü + 10 MB boyut sınırı ekle.  
**Eylem:** Güvenlik & Test → templates.py + yeni media upload endpoint'i.

### Mimari Karar — Proje vs Şantiye Ayrımı
**Soru:** Projeler şantiye altında mı, yoksa bağımsız mı?  
**Karar:** Şimdilik `Proje.santiye_id NULLABLE FK` — şantiyeye bağlanabilir ama zorunlu değil. Bu hem "tek şantiyede çok proje" hem "şantiyesiz proje" durumunu karşılar. Kullanıcı deneyiminde projeler, şantiye bağlamında gösterilir.

### Mimari Karar — Mobil Öncelikli Layout
**Karar:** Ayrı `/mobile` route'u açmak yerine tek `(app)/layout.tsx` hem mobil hem desktop'ı handle eder.  
- `md:` breakpoint → sidebar görünür, bottom tab gizlenir  
- `<md` → sidebar gizlenir, bottom tab görünür  
Bu yaklaşım kod tekrarını önler ve PWA olarak telefona eklendiğinde tutarlı davranış sağlar.

### Mimari Karar — Chat Streaming
**Karar:** Groq streaming için SSE (Server-Sent Events) tercih et (WebSocket'ten daha basit, tek yönlü akış yeterli).  
FastAPI'de `StreamingResponse` ile `text/event-stream` kullanımı yeterli, ayrı WebSocket altyapısı kurmaya gerek yok.

---

## Ek — Mevcut Dosya & Endpoint Haritası

### Backend Dosyaları
```
backend/app/
├── main.py                    — FastAPI app, CORS, router kayıtları, lifespan
├── core/
│   ├── config.py             — Settings (Pydantic BaseSettings)
│   ├── database.py           — SQLAlchemy async engine + session
│   └── security.py           — JWT oluştur/doğrula, bcrypt
├── models/
│   ├── tenant.py             — Musteri, Kullanici
│   ├── site.py               — Santiye, SantiyeNumara, Sablon
│   ├── report.py             — Rapor
│   ├── message.py            — WhatsappMesaji, Cikarilan, PendingWhatsapp
│   └── koordinator.py        — Koordinator
├── api/v1/
│   ├── auth.py               — /auth/register, /auth/login
│   ├── sites.py              — /sites/* (CRUD + numara)
│   ├── reports.py            — /reports/* (generate, approve, download, preview)
│   ├── templates.py          — /templates/* (upload, list, delete)
│   ├── webhook.py            — /webhook/whatsapp + /webhook/messages/{id}
│   ├── koordinator.py        — /koordinator/*
│   └── users.py              — /users/* (admin CRUD)
└── services/
    ├── rapor_servisi.py      — Rapor üretim orkestrasyonu (ana pipeline)
    ├── extractor.py          — Groq LLM çağrıları (extraction + mapping)
    ├── extraction_prompt.py  — System/user prompt template'leri
    ├── schemas.py            — ExtractionSonucu Pydantic modelleri
    ├── excel_filler.py       — openpyxl şablon doldurma (çok-sekme)
    ├── docx_filler.py        — docxtpl Word doldurma
    ├── gemini_analyzer.py    — Gemini fotoğraf analizi
    ├── template_parser.py    — xlsx/docx alan parse
    ├── site_yonlendirici.py  — Koordinatör mesaj yönlendirme (LLM)
    ├── whatsapp_sender.py    — Twilio WhatsApp mesaj gönderme
    └── bildirim_zamanlayici.py — APScheduler 18:00 geç rapor uyarısı
```

### Frontend Dosyaları
```
frontend/
├── app/
│   ├── (auth)/login/         — Giriş sayfası
│   └── (dashboard)/
│       ├── layout.tsx        — Sidebar layout (desktop only — değişecek)
│       ├── dashboard/        — Genel bakış
│       ├── santiyeler/       — Şantiye CRUD (→ yonetim/projeler'e taşınacak)
│       ├── raporlar/         — Rapor listesi + preview (→ yonetim/raporlar)
│       ├── sablonlar/        — Şablon yönetimi
│       ├── koordinator/      — Koordinatör CRUD
│       ├── mesajlar/         — WhatsApp mesajları
│       └── kullanicilar/     — Kullanıcı CRUD
├── components/
│   ├── layout/Sidebar.tsx    — Sol sidebar (desktop)
│   └── ui/
│       ├── card.tsx
│       ├── button.tsx
│       └── badge.tsx
├── lib/
│   ├── api.ts               — Tüm API çağrıları
│   └── utils.ts             — cn, formatDate yardımcıları
└── types/index.ts           — TypeScript tip tanımları
```
