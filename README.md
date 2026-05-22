# Şantiye Asistanı

WhatsApp'tan gelen mesajları yapay zeka ile analiz edip Excel/Word şablonlarını otomatik dolduran şantiye rapor sistemi.

## Gereksinimler

| Araç | Versiyon | İndirme |
|---|---|---|
| Python | 3.11+ | python.org |
| Node.js | 18+ | nodejs.org |

## Kurulum

### 1. Repoyu klonla

```bash
git clone https://github.com/KULLANICI_ADI/santiye-asistani.git
cd santiye-asistani
```

### 2. Backend kurulumu

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
```

`.env` dosyasını açıp şu alanları doldurun:

| Alan | Açıklama | Nereden alınır |
|---|---|---|
| `SECRET_KEY` | JWT imzalama anahtarı | `python -c "import secrets; print(secrets.token_hex(32))"` |
| `GROQ_API_KEY` | Metin analizi için | [console.groq.com](https://console.groq.com) — ücretsiz |
| `GEMINI_API_KEY` | Fotoğraf analizi için | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) — ücretsiz |
| `TWILIO_AUTH_TOKEN` | WhatsApp webhook | [console.twilio.com](https://console.twilio.com) |
| `TWILIO_ACCOUNT_SID` | WhatsApp webhook | [console.twilio.com](https://console.twilio.com) |

### 3. Frontend kurulumu

```bash
cd ../frontend
npm install
```

### 4. Çalıştırma

**Terminal 1 — Backend:**
```bash
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

### 5. İlk admin hesabı oluştur

Tarayıcıda [http://localhost:8000/docs](http://localhost:8000/docs) adresini açın, `/api/v1/auth/register` endpoint'ini kullanın.

Veya terminal ile:
```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"firma_adi\":\"Firma\",\"firma_email\":\"firma@example.com\",\"ad_soyad\":\"Ad Soyad\",\"email\":\"admin@example.com\",\"sifre\":\"Sifre2024!\"}"
```

Sonra [http://localhost:3000](http://localhost:3000) adresinden giriş yapın.

---

## Özellikler

- 📱 WhatsApp mesajlarından otomatik rapor üretimi
- 🤖 Groq LLM ile metin analizi (llama-3.3-70b-versatile)
- 📸 Gemini 2.0 Flash ile fotoğraf analizi
- 📊 Excel / Word şablon doldurma (kendi şablonunuzu yükleyin)
- 👥 Kullanıcı yönetimi — admin / editör / izleyici rolleri
- 🔔 Rapor onayında WhatsApp bildirimi + günlük geç rapor uyarısı
- 🏗️ Çoklu şantiye ve çoklu WhatsApp numarası desteği
- 📋 Rapor önizleme (indirmeden tarayıcıda görüntüle)
- 🧑‍💼 Koordinatör modu — tek numaradan tüm şantiyelerin raporunu gönder

## Stack

**Backend:** FastAPI · SQLAlchemy 2.0 async · SQLite · Groq · Gemini · Twilio · APScheduler

**Frontend:** Next.js 16 · TypeScript · Tailwind CSS

## API Dokümantasyonu

Backend çalışırken: [http://localhost:8000/docs](http://localhost:8000/docs)
