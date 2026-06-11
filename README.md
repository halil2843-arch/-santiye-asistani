# Şantiye Asistanı

WhatsApp'tan gelen mesajları yapay zeka ile analiz edip Excel/Word şablonlarını otomatik dolduran, mobil-öncelikli SaaS şantiye yönetim sistemi.

---

## Proje Durumu

### Tamamlananlar

#### Faz 1 — Temel Altyapı
- [x] FastAPI backend (JWT auth, SQLite, Alembic migrations)
- [x] Twilio WhatsApp webhook + Groq LLM metin analizi
- [x] Excel / Word şablon doldurma (openpyxl + docxtpl)
- [x] Kullanıcı ve şantiye yönetimi
- [x] Rapor üretimi ve onaylama akışı
- [x] APScheduler — 18:00 geç rapor uyarısı
- [x] Next.js frontend — login, dashboard, şablon yönetimi

#### Faz 2 — Tam Stack SaaS (2026-06-11 tamamlandı)
- [x] 18 backend router (projeler, stok, İSG, medya, puantaj, hakedis, toplantı, bildirim, chat, dashboard, malzeme)
- [x] 13 Alembic migration (001–013)
- [x] Gemini 2.0 Flash — fotoğraf analizi + AI malzeme tahmini
- [x] Groq SSE streaming chat (Asistan)
- [x] VAPID push bildirimleri (PWA)
- [x] Refresh token + token blacklist + rate limiting
- [x] Cache soyutlama (InMemory / Redis-ready) + Storage soyutlama (Local / S3-ready)
- [x] Docker: backend/Dockerfile + frontend/Dockerfile + docker-compose.yml
- [x] 94 test (81 pass, 13 skip — placeholder)
- [x] Mobil app: 12 araç + 12 yönetim modülü + Asistan + Ana Sayfa
- [x] PWA: manifest, service worker, offline sayfası
- [x] GitHub push — tüm kod repo'da

### Yapılacaklar

#### Kısa Vadeli
- [ ] **OpenWeather API** — Ana sayfa hava durumu widget'ı şu an mock veri kullanıyor; gerçek API ile değiştirilecek (`OPENWEATHER_API_KEY` .env'e eklenecek)
- [ ] **test_faz2_guvenlik.py** — 13 placeholder test doldurulacak (stok/medya/ISG tenant izolasyon senaryoları)

#### Orta Vadeli — Production Deploy
- [ ] PostgreSQL geçişi (`DATABASE_URL` güncelle)
- [ ] Redis bağlantısı (cache + rate limit kalıcılığı)
- [ ] AWS S3 / Cloudflare R2 depolama (medya dosyaları)
- [ ] `docker compose up --build` ile deploy
- [ ] HTTPS + domain yapılandırması

#### Faz 3 — Gelişmiş Özellikler (FAZ3_PLAN.md)
- [ ] Rapor PDF export (weasyprint)
- [ ] Hakediş hesaplama ve PDF çıktısı
- [ ] Gelişmiş puantaj — devamsızlık ve izin yönetimi
- [ ] Koordinatör modu — çok-şantiye tek numara
- [ ] Abonelik / ödeme sistemi (SaaS monetizasyon)
- [ ] Çoklu dil desteği

---

## Yeni Bilgisayarda Kurulum

### Ön Gereksinimler

| Araç | Versiyon | İndirme |
|---|---|---|
| Python | 3.11+ | [python.org](https://python.org) |
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| Git | Herhangi | [git-scm.com](https://git-scm.com) |

### 1. Repoyu klonla

```bash
git clone https://github.com/halil2843-arch/-santiye-asistani.git
cd -santiye-asistani
```

### 2. Backend kurulumu

```bash
cd backend
pip install -r requirements.txt
```

`.env.example` dosyasını kopyalayıp `.env` oluştur:

```bash
# Windows
copy .env.example .env

# Mac / Linux
cp .env.example .env
```

`.env` içindeki zorunlu alanları doldur:

| Alan | Açıklama | Nereden |
|---|---|---|
| `SECRET_KEY` | JWT anahtarı | `python -c "import secrets; print(secrets.token_hex(32))"` |
| `GROQ_API_KEY` | Metin analizi | [console.groq.com](https://console.groq.com) — ücretsiz |
| `GEMINI_API_KEY` | Fotoğraf / AI malzeme | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) — ücretsiz |
| `TWILIO_AUTH_TOKEN` | WhatsApp webhook | [console.twilio.com](https://console.twilio.com) |
| `TWILIO_ACCOUNT_SID` | WhatsApp webhook | [console.twilio.com](https://console.twilio.com) |
| `VAPID_PRIVATE_KEY` | Push bildirim | `py -c "from py_vapid import Vapid; v=Vapid(); v.generate_keys(); print(v.private_key)"` |
| `VAPID_PUBLIC_KEY` | Push bildirim | Yukarıdakiyle birlikte üretilir |

> `DEBUG=true` ve `DATABASE_URL=sqlite+aiosqlite:///./santiye.db` alanlarını olduğu gibi bırakabilirsin.

### 3. Frontend kurulumu

```bash
cd ../frontend
npm install
```

### 4. Uygulamayı başlat

**Terminal 1 — Backend:**
```bash
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

Tarayıcıda [http://localhost:3000](http://localhost:3000) adresini aç.

### 5. İlk admin hesabı oluştur

Backend çalışırken bir kez çalıştır:

```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"firma_adi\":\"Firma Adı\",\"firma_email\":\"firma@example.com\",\"ad_soyad\":\"Ad Soyad\",\"email\":\"admin@example.com\",\"sifre\":\"GucluSifre2024!\"}"
```

Windows PowerShell kullanıyorsanız [http://localhost:8000/docs](http://localhost:8000/docs) → `/api/v1/auth/register` endpoint'ini kullanın.

### 6. (İsteğe bağlı) WhatsApp için Cloudflare tüneli

```bash
cloudflared tunnel --url http://localhost:8000
```

Oluşan URL'i Twilio Console'da webhook olarak girin:
`https://xxxx.trycloudflare.com/api/v1/webhook/whatsapp`

---

## Testleri Çalıştır

```bash
cd backend
pytest tests/ -q
```

Beklenen çıktı: `81 passed, 13 skipped`

---

## Docker ile Çalıştır

```bash
docker compose up --build
```

> Not: `frontend/next.config.ts` içinde `output: 'standalone'` aktif olmalı (Docker build için). Geliştirmede kaldırılmalı.

---

## Özellikler

**Rapor Sistemi**
- WhatsApp mesajlarından otomatik günlük rapor üretimi
- Groq LLM (llama-3.3-70b) ile metin analizi
- Gemini 2.0 Flash ile fotoğraf analizi
- Müşterinin kendi Excel / Word şablonunu yüklemesi

**Mobil App (PWA)**
- Offline çalışma, ana ekrana eklenebilir
- Push bildirimleri (VAPID)
- 12 araç: hesaplayıcı, birim dönüştürücü, AI malzeme tahmini, beton hesabı, alan/hacim, eğim, demir (TS708), su terazisi, QR okuyucu, mesafe (GPS), fotoğraf-not, mesleki rehber

**Yönetim Modülleri**
- Projeler (Kanban iş planı, aktivite takibi)
- Stok giriş/çıkış ve kritik seviye uyarısı
- İSG kayıtları ve denetim takibi
- Puantaj ve devamsızlık yönetimi
- Medya galerisi (Gemini AI açıklaması)
- Hakediş hesaplama
- Toplantı tutanakları

**Güvenlik & Altyapı**
- Tenant izolasyonu (çok kiracılı SaaS)
- Rate limiting (IP bazlı)
- Refresh token + blacklist
- Cache ve storage soyutlama (Redis / S3 production-ready)

---

## Stack

| Katman | Teknoloji |
|---|---|
| Backend | FastAPI · SQLAlchemy 2.0 async · SQLite → PostgreSQL |
| AI | Groq llama-3.3-70b · Gemini 2.0 Flash |
| Frontend | Next.js 16 · TypeScript · Tailwind CSS 4 |
| Auth | JWT · python-jose · passlib[bcrypt] |
| Bildirim | Twilio WhatsApp · VAPID Push |
| Zamanlayıcı | APScheduler |
| Deploy | Docker · docker-compose |

---

## API Dokümantasyonu

Backend çalışırken: [http://localhost:8000/docs](http://localhost:8000/docs)
