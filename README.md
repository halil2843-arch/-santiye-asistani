# Şantiye Asistanı

WhatsApp'tan gelen mesajları yapay zeka ile analiz edip Excel/Word şablonlarını otomatik dolduran şantiye rapor sistemi.

---

## Yeni Bilgisayarda Kurulum (Adım Adım)

### Ön Gereksinimler

Aşağıdaki araçların kurulu olduğundan emin olun:

| Araç | Versiyon | İndirme |
|---|---|---|
| Python | 3.11+ | [python.org](https://python.org) |
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| Git | Herhangi | [git-scm.com](https://git-scm.com) |

---

### 1. Repoyu klonla

```bash
git clone https://github.com/halil2843-arch/-santiye-asistani.git
cd -santiye-asistani
```

---

### 2. Backend kurulumu

```bash
cd backend
pip install -r requirements.txt
```

`.env.example` dosyasını kopyalayıp `.env` adıyla kaydet:

```bash
# Windows
copy .env.example .env

# Mac / Linux
cp .env.example .env
```

`.env` dosyasını bir metin editörüyle aç ve şu alanları doldur:

| Alan | Açıklama | Nereden alınır |
|---|---|---|
| `SECRET_KEY` | JWT imzalama anahtarı | Terminalde çalıştır: `python -c "import secrets; print(secrets.token_hex(32))"` |
| `GROQ_API_KEY` | Metin analizi | [console.groq.com](https://console.groq.com) — ücretsiz |
| `GEMINI_API_KEY` | Fotoğraf analizi | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) — ücretsiz |
| `TWILIO_AUTH_TOKEN` | WhatsApp webhook | [console.twilio.com](https://console.twilio.com) |
| `TWILIO_ACCOUNT_SID` | WhatsApp webhook | [console.twilio.com](https://console.twilio.com) |

> `DEBUG=true` ve `DATABASE_URL` alanlarını olduğu gibi bırakabilirsin.

---

### 3. Frontend kurulumu

```bash
cd ../frontend
npm install
```

---

### 4. Uygulamayı çalıştır

İki ayrı terminal penceresi aç:

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

Tarayıcıda [http://localhost:3000](http://localhost:3000) adresini aç.

---

### 5. İlk admin hesabını oluştur

Backend çalışırken bir kez çalıştır (değerleri kendinize göre değiştirin):

```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"firma_adi\":\"Firma Adı\",\"firma_email\":\"firma@example.com\",\"ad_soyad\":\"Ad Soyad\",\"email\":\"admin@example.com\",\"sifre\":\"GucluSifre2024!\"}"
```

Windows PowerShell kullanıyorsanız [http://localhost:8000/docs](http://localhost:8000/docs) adresinden `/api/v1/auth/register` endpoint'ini kullanabilirsiniz.

---

### 6. (İsteğe bağlı) WhatsApp testleri için Cloudflare tüneli

Twilio webhook'unu test etmek istiyorsanız [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) indirin ve çalıştırın:

```bash
cloudflared tunnel --url http://localhost:8000
```

Oluşan `https://xxxx.trycloudflare.com` adresini Twilio Console'da webhook URL olarak girin:
`https://xxxx.trycloudflare.com/api/v1/webhook/whatsapp`

---

## Özellikler

- WhatsApp mesajlarından otomatik rapor üretimi
- Groq LLM ile metin analizi (llama-3.3-70b-versatile)
- Gemini 2.0 Flash ile fotoğraf analizi
- Excel / Word şablon doldurma (kendi şablonunuzu yükleyin)
- Kullanıcı yönetimi — admin / editör / izleyici rolleri
- Rapor onayında WhatsApp bildirimi + günlük geç rapor uyarısı (18:00)
- Çoklu şantiye ve çoklu WhatsApp numarası desteği
- Rapor önizleme (indirmeden tarayıcıda görüntüle)
- Koordinatör modu — tek numaradan tüm şantiyelerin raporunu gönder

---

## Stack

**Backend:** FastAPI · SQLAlchemy 2.0 async · SQLite · Groq · Gemini · Twilio · APScheduler

**Frontend:** Next.js 16 · TypeScript · Tailwind CSS

---

## API Dokümantasyonu

Backend çalışırken: [http://localhost:8000/docs](http://localhost:8000/docs)
