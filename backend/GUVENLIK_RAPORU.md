# Güvenlik Denetim Raporu

**Tarih:** 2026-06-01  
**Denetçi:** Güvenlik & Test Agent (VibeSec + WebApp-Testing)  
**Kapsam:** `app/core/security.py`, `app/core/config.py`, `app/api/v1/templates.py`, `app/api/v1/projeler.py`, `app/api/v1/dashboard.py`, `app/api/deps.py`, `app/api/v1/webhook.py`

---

## Kritik Bulgular (Hemen Düzeltilmeli)

### 1. JWT Token Süresi Çok Uzun — DÜZELTİLDİ
**Dosya:** `app/core/config.py`  
**Sorun:** `ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24` → token 24 saat geçerliydi.  
**Risk:** Çalınan bir token 24 saat boyunca geçerli kalır. Kısa ömürlü tokenlar saldırı penceresini küçültür.  
**Düzeltme:** Değer `60` dakikaya (1 saat) düşürüldü.

### 2. Dosya Yükleme — Boyut Sınırı Yoktu — DÜZELTİLDİ
**Dosya:** `app/api/v1/templates.py`  
**Sorun:** Yüklenen dosya boyutuna hiçbir sınır konulmamıştı. Saldırgan çok büyük dosya göndererek sunucu belleğini tüketebilirdi (DoS).  
**Düzeltme:** Sunucu tarafında 10 MB sınırı eklendi; aşan istekler `HTTP 413` ile reddedilir.

### 3. Dosya Yükleme — Yalnızca Uzantı Kontrolü Vardı — DÜZELTİLDİ
**Dosya:** `app/api/v1/templates.py`  
**Sorun:** Sadece `.xlsx`/`.docx` uzantısı kontrol ediliyordu. Saldırgan kötü amaçlı içerik barındıran bir dosyayı `evil.xlsx` adıyla gönderebilirdi (MIME spoofing).  
**Düzeltme:** Magic bytes doğrulaması eklendi. OOXML dosyaları ZIP tabanlıdır; ilk 4 byte `PK\x03\x04` olmalıdır. Uyuşmazsa `HTTP 422` döner.

### 4. Dosya Adı Sanitizasyonu Yetersizdi — DÜZELTİLDİ
**Dosya:** `app/api/v1/templates.py`  
**Sorun:** `dosya.filename.replace(" ", "_")` ile yalnızca boşluklar değiştiriliyordu. `../../etc/passwd` gibi path traversal, Türkçe karakterler ve özel karakterler doğrudan disk yoluna yazılıyordu.  
**Düzeltme:**  
- `unicodedata.normalize("NFKD")` ile Türkçe/Unicode karakterler ASCII'ye dönüştürüldü.  
- `re.sub` ile alfanümerik/nokta/tire/alt çizgi dışı karakterler temizlendi.  
- `os.path.abspath` ile son path traversal kontrolü eklendi.

---

## Orta Öncelikli Bulgular

### 5. Twilio Webhook — DEBUG=True İmzayı Atlar
**Dosya:** `app/api/v1/webhook.py` — satır 94  
**Sorun:**
```python
if settings.DEBUG or not settings.TWILIO_AUTH_TOKEN or settings.TWILIO_AUTH_TOKEN == "...":
    return params  # imza kontrolü atlanır
```
Bu mantık geliştirme kolaylığı için tasarlanmış; ancak `.env`'de yanlışlıkla `DEBUG=true` bırakılırsa production'da herkes Twilio webhook'unu taklit edebilir.  
**Risk Seviyesi:** Orta — `config.py`'deki `validate_production_secrets` validator `DEBUG=True` iken SECRET_KEY/GROQ_API_KEY kontrollerini atladığından ek risk oluşur.  
**Öneri:** `.env.example`'da `DEBUG=true` varsayılan bırakılmış; bu değerin production ortamında `DEBUG=false` olduğundan emin olunacak CI/CD kontrolü eklenmeli.

### 6. CORS — Wildcard `"*"` Production'da Risk
**Dosya:** `app/core/config.py`, `app/main.py`  
**Sorun:** `CORS_ORIGINS=*` ile `allow_credentials=True` birlikte kullanıldığında tarayıcılar bunu reddeder (CORS spec). Ancak API istekleri (Postman, curl) tüm origin'lerden kabul edilir.  
**Risk:** Kötü niyetli sitelerden gelen tarayıcı tabanlı istekler engellenemez.  
**Öneri:** Production'da `CORS_ORIGINS` gerçek frontend URL'leriyle doldurulmalı (`.env.example` güncellendi).

### 7. JWT `alg: none` — Algoritma Sabitlendi, Whitelist Uygulanmış
**Dosya:** `app/core/security.py`  
**Durum:** `algorithms=[settings.ALGORITHM]` (HS256) ile decode yapılıyor. `alg: none` saldırısına kapalı. Pozitif bulgu.

### 8. Güvenli Olmayan SECRET_KEY Varsayılanı
**Dosya:** `app/core/config.py`  
**Durum:** `_DEFAULT_SECRET` tanımlı ama `validate_production_secrets` validator bunu production'da `ValueError` ile engeller. `DEBUG=False` iken güvenli. Ancak validator yalnızca `GROQ_API_KEY` ve `SECRET_KEY` kontrol eder; `TWILIO_AUTH_TOKEN` boş bırakılabilir.  
**Öneri:** Validator'a `TWILIO_AUTH_TOKEN` boşluk kontrolü de eklenmeli.

---

## Düşük Öncelikli Bulgular

### 9. Güvenlik Header'ları Eksik
**Dosya:** `app/main.py`  
**Sorun:** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Strict-Transport-Security`, `Content-Security-Policy` header'ları eklenmemiş.  
**Öneri:** FastAPI middleware olarak eklenebilir:
```python
from starlette.middleware.base import BaseHTTPMiddleware

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response
```

### 10. Hava Durumu Endpoint — Kullanıcı Girdisi OWM'e İletiliyor
**Dosya:** `app/api/v1/dashboard.py`  
**Sorun:** `il` ve `ilce` parametreleri doğrudan OWM API'sine `q=ilce,il,TR` formatında gönderiliyor. OWM URL'e encoding yapıyor (httpx otomatik handle eder), ancak maksimum uzunluk sınırı yoktur.  
**Öneri:** `il` ve `ilce` parametrelerine `max_length` kısıtı eklenmeli (örn. 100 karakter).

### 11. Token Revocation Mekanizması Yok
**Durum:** JWT token'ları oluşturulduktan sonra geçersiz kılınamaz (kullanıcı silindi, şifre değişti vb.).  
**Öneri:** Redis tabanlı token blacklist veya kısa ömürlü token + refresh token mekanizması (sonraki sprint).

### 12. OpenAPI Dokümantasyonu Production'da Açık
**Dosya:** `app/main.py`  
**Sorun:** `docs_url="/docs"`, `redoc_url="/redoc"`, `openapi_url="/openapi.json"` tüm ortamlarda erişilebilir.  
**Öneri:** Production'da bu URL'leri `None` yapın:
```python
app = FastAPI(
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
)
```

---

## Uygulanan Düzeltmeler (Bu Sprint)

| # | Dosya | Değişiklik |
|---|-------|------------|
| 1 | `app/core/config.py` | `ACCESS_TOKEN_EXPIRE_MINUTES`: 1440 → 60 dakika |
| 2 | `app/api/v1/templates.py` | 10 MB dosya boyutu sınırı eklendi |
| 3 | `app/api/v1/templates.py` | Magic bytes (ZIP/OOXML) doğrulaması eklendi |
| 4 | `app/api/v1/templates.py` | Türkçe karakter, path traversal ve özel karakter sanitizasyonu |
| 5 | `tests/test_tenant_isolation.py` | 8 adet tenant isolation pytest testi oluşturuldu |
| 6 | `.env.example` | `OPENWEATHER_API_KEY`, `ACCESS_TOKEN_EXPIRE_MINUTES`, `CORS_ORIGINS` eklendi |

---

## Faz 2 Güncellemesi (2026-06-01)

### Rate Limiting Eklendi

**Dosya:** `app/core/rate_limit.py` (yeni)  
**Yaklaşım:** In-memory sliding window rate limiter (decorator tabanlı).

| Endpoint | Sınır | Pencere |
|----------|-------|---------|
| `POST /api/v1/auth/login` | 10 istek | 60 saniye |
| `POST /api/v1/auth/register` | 5 istek | 60 saniye |

**Uygulama notu:**  
Bu implementasyon tek-process ortamlar için yeterlidir. Production'da çoklu worker/process kullanılıyorsa sayaçlar process'ler arasında paylaşılmaz — **Redis + slowapi** tabanlı çözüme geçilmelidir.

```python
# Production için önerilen geçiş:
# pip install slowapi redis
from slowapi import Limiter
from slowapi.util import get_remote_address
limiter = Limiter(key_func=get_remote_address, storage_uri="redis://localhost:6379")
```

**Güvenlik notu (VibeSec — Brute Force Koruması):**  
Login rate limiting, parola brute force saldırılarına karşı birincil savunma katmanıdır. Limit aşıldığında `HTTP 429` döner. IP adresi `request.client.host`'tan alınır; reverse proxy arkasında `X-Forwarded-For` ile gerçek IP alınmalıdır.

---

### Tenant Isolation Testleri Tamamlandı

**Dosya:** `tests/test_tenant_isolation.py`  
**Durum:** 10 test — gerçek in-memory SQLite fixture'larıyla çalışır hale getirildi.

| Test | Kapsam |
|------|--------|
| `test_proje_baska_tenant_goremez` | IDOR — tek proje erişimi |
| `test_proje_listesi_baska_tenant_icermez` | Liste filtreleme izolasyonu |
| `test_proje_guncelleme_baska_tenant_yapamaz` | Write izolasyonu |
| `test_proje_silme_baska_tenant_yapamaz` | Delete izolasyonu |
| `test_dashboard_yalniz_kendi_verisini_gosterir` | Cross-tenant sayaç izolasyonu |
| `test_template_listesi_baska_tenant_icermez` | Şablon izolasyonu |
| `test_token_olmadan_erisim_engellenir` | Authentication zorunluluğu |
| `test_gecersiz_token_erisim_engellenir` | Token doğrulama |
| `test_auth_rate_limit_login` | Login brute force koruması |
| `test_auth_rate_limit_register` | Register rate limiting |

---

### Faz 2 Yeni Endpoint Güvenlik Şablonları Hazırlandı

**Dosya:** `tests/test_faz2_guvenlik.py` (yeni)  
Şu anda tüm testler `pytest.skip` ile işaretli — endpoint'ler hazır oldukça aktive edilecek.

Kapsanan güvenlik kontrolleri (TDD RED aşaması):
- Stok endpoint tenant isolation (IDOR koruması)
- Medya yükleme: boyut sınırı (413), magic bytes (422), path traversal (422), SVG reddi
- ISG kayıtları tenant isolation
- Mass assignment koruması kontrolü
- Tüm yeni endpoint'lerin token gerektirdiğinin doğrulanması

---

### Test Altyapısı

**Dosya:** `pytest.ini` (yeni)  
```ini
[pytest]
asyncio_mode = auto
testpaths = tests
```

**Testleri çalıştırma:**
```bash
# Backend dizininden:
cd backend
pytest tests/ -v

# Yalnızca tenant isolation testleri:
pytest tests/test_tenant_isolation.py -v

# Yalnızca Faz 2 iskelet testleri (skip'ler dahil):
pytest tests/test_faz2_guvenlik.py -v

# Coverage ile:
pytest tests/ --cov=app --cov-report=term-missing
```

---

## Production Geçiş Checklist

> Bu bölüm her deployment öncesi gözden geçirilmelidir.

### Zorunlu (deploy öncesi — bunlar olmadan production'a çıkma)

- [ ] `DEBUG=false` — `.env` dosyasında
- [ ] `SECRET_KEY` güçlü random string (32+ karakter, `secrets.token_hex(32)` ile üret)
- [ ] `CORS_ORIGINS` gerçek frontend domain(ler)i (örn. `https://santiyeasistani.com`)
- [ ] `DATABASE_URL` PostgreSQL bağlantı string'i (SQLite production'da önerilmez)
- [ ] `GROQ_API_KEY` dolduruldu (boş bırakılırsa `config.py` başlatmayı reddeder)
- [ ] `TWILIO_AUTH_TOKEN` ve `TWILIO_ACCOUNT_SID` dolduruldu

### Güvenlik

- [ ] `/docs` ve `/redoc` erişimi kapalı (`DEBUG=false` ile **otomatik** kapanır)
- [ ] Rate limiting → Redis tabanlıya geçildi (`slowapi` + `redis`)
- [ ] HTTPS zorunlu — nginx/Caddy ile TLS termination yapılıyor
- [ ] `Strict-Transport-Security` header'ı nginx/Caddy tarafından ekleniyor
- [ ] Dosya depolama → S3/R2 (lokal disk yerine; sunucu değişiminde veriler kaybolmaz)
- [ ] `.env` dosyası `.gitignore`'a eklendi, git'e commit edilmedi
- [ ] `pip-audit` çıktısı temiz (bilinen CVE yok)

### Test

- [ ] `pytest tests/ -v` — tüm testler geçiyor
- [ ] `pytest tests/ --cov=app --cov-report=term-missing` — kritik modüller %80+ kapsam
- [ ] `py -3 app/core/db_migrate.py --check` — PostgreSQL uyumluluk doğrulandı (varsa)
- [ ] Medya `view` endpoint path traversal testi geçiyor (`test_faz2_guvenlik.py`)
- [ ] Tenant isolation testlerinin tamamı yeşil (`test_tenant_isolation.py`)

---

## Sonraki Sprint İçin Bekleyenler

1. **Güvenlik header middleware** ekle (`X-Content-Type-Options`, `X-Frame-Options`, HSTS)
2. **OpenAPI docs'u production'da kapat** (`docs_url=None` vb.)
3. **Token revocation / refresh token** mekanizması (Redis blacklist veya kısa-ömürlü + refresh)
4. **Twilio `DEBUG` bypass** için prod ortam CI/CD kontrolü ekle
5. **Hava durumu endpoint** `il`/`ilce` parametrelerine `max_length` kısıtı
6. **Validator'a** `TWILIO_AUTH_TOKEN` boşluk kontrolü ekle
7. **Rate limiting — Redis'e taşı:** `slowapi` + Redis backend (production zorunluluğu)
8. **SVG yükleme** izin veriliyorsa XSS riski incelenmeli (mevcut durumda yalnızca xlsx/docx — güvenli)
9. **Dependency audit** çalıştır: `pip-audit` ile bilinen CVE'leri tara
10. **Faz 2 test iskeletlerini doldur:** `test_faz2_guvenlik.py` içindeki `pytest.skip`'leri kaldır

---

## Tenant İzolasyonu Özeti

Tüm korumalı endpoint'ler `CurrentMusteriId` dependency'si kullanıyor. Bu dependency:
1. Bearer token'ı decode eder
2. `sub` (user_id) ile DB'den `Kullanici` çeker
3. `kullanici.musteri_id`'yi döndürür

Her veri sorgusunda `WHERE ... AND musteri_id = :musteri_id` koşulu uygulanıyor. Projeler, şantiyeler, şablonlar, dashboard ve mesaj endpoint'lerinin tamamında tenant izolasyonu mevcut ve doğru uygulanmış.

Rapor endpoint'i için `santiye_id → santiye.musteri_id` join ile dolaylı tenant kontrolü yapılıyor — bu yöntem de güvenli.
