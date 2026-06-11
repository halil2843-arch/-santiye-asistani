"""Şantiye Asistanı — FastAPI uygulama giriş noktası.

Başlatmak için:
    uvicorn app.main:app --reload
"""

import logging
import os
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request as StarletteRequest

from app.api.v1 import auth, webhook, templates, reports, sites, koordinator, users, projeler, dashboard, chat, stok, medya, isg, toplanti, hakedis, malzeme, puantaj, bildirim
from app.models import proje_not  # noqa: F401 — tablo oluşturma için Base.metadata'ya kayıt
from app.core.config import settings
from app.core.database import create_tables

# ---------------------------------------------------------------------------
# Loglama
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Lifespan — startup / shutdown (modern FastAPI pattern)
# ---------------------------------------------------------------------------


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Uygulama başlarken veritabanı tablolarını oluşturur ve
    gerekli dizinleri hazırlar; kapatılırken temizlik yapılabilir."""
    # --- startup ---
    logger.info("Veritabanı tabloları kontrol ediliyor / oluşturuluyor…")

    # Models'ı import et — Base.metadata'ya kayıt için zorunlu
    import app.models  # noqa: F401

    await create_tables()

    # Upload / output dizinlerini oluştur
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    os.makedirs(settings.OUTPUT_DIR, exist_ok=True)

    from app.services.bildirim_zamanlayici import baslat_zamanlayici
    baslat_zamanlayici()

    logger.info("Uygulama başlatıldı. DEBUG=%s", settings.DEBUG)

    yield  # uygulama burada çalışır

    from app.services.bildirim_zamanlayici import durdur_zamanlayici
    durdur_zamanlayici()


# ---------------------------------------------------------------------------
# Güvenlik header middleware
# ---------------------------------------------------------------------------


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Her yanıta temel güvenlik header'larını ekler.

    VibeSec / OWASP önerilerine göre:
      - X-Content-Type-Options: tarayıcı MIME sniffing'ini engeller
      - X-Frame-Options: clickjacking (iframe embedding) saldırılarını engeller
      - X-XSS-Protection: eski tarayıcılar için XSS filtresi (modern CSP yerine destekle)
      - Referrer-Policy: hassas URL bilgisinin dış sitelere sızmasını önler
    """

    async def dispatch(self, request: StarletteRequest, call_next):  # type: ignore[override]
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response


# ---------------------------------------------------------------------------
# FastAPI uygulaması
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Şantiye Asistanı API",
    description=(
        "WhatsApp'tan gelen mesajları GPT-4o ile analiz ederek "
        "Excel/Word şablonlarını otomatik dolduran SaaS backend."
    ),
    version="0.1.0",
    # Production'da OpenAPI dokümantasyonu kapalı (bilgi sızıntısı ve saldırı
    # yüzeyi azaltma). DEBUG=True yalnızca geliştirme ortamında kullanılmalı.
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
    lifespan=lifespan,
)


# ---------------------------------------------------------------------------
# CORS — geliştirmede tüm origin'lere izin ver, production'da kısıtla
# ---------------------------------------------------------------------------

# Güvenlik notu (VibeSec):
#   - Wildcard "*" allow_credentials=True ile birlikte CORS spec gereği
#     tarayıcılar tarafından reddedilir; ayrıca production API'sini
#     herhangi bir kötü niyetli siteden erişime açar.
#   - Production'da CORS_ORIGINS gerçek frontend domain'leriyle doldurulmalı.
_cors_origins = (
    ["*"] if settings.DEBUG  # Sadece dev'de wildcard
    else [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
)

if not settings.DEBUG and not _cors_origins:
    logger.warning(
        "CORS_ORIGINS boş! Production'da tarayıcı tabanlı erişim engellenebilir. "
        ".env dosyasına CORS_ORIGINS=https://yourdomain.com ekleyin."
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Güvenlik header'ları — her ortamda aktif
# Production'da HSTS (Strict-Transport-Security) eklemek için
# bir ters proxy (Nginx/Cloudflare) kullanılması önerilir.
app.add_middleware(SecurityHeadersMiddleware)


# ---------------------------------------------------------------------------
# Router'ları dahil et — tüm prefix'ler /api/v1/... ile başlar
# ---------------------------------------------------------------------------

API_V1_PREFIX = "/api/v1"

app.include_router(auth.router, prefix=API_V1_PREFIX)
app.include_router(webhook.router, prefix=API_V1_PREFIX)
app.include_router(templates.router, prefix=API_V1_PREFIX)
app.include_router(reports.router, prefix=API_V1_PREFIX)
app.include_router(sites.router, prefix=API_V1_PREFIX)
app.include_router(koordinator.router, prefix=API_V1_PREFIX)
app.include_router(users.router, prefix=API_V1_PREFIX)
app.include_router(projeler.router, prefix="/api/v1/projects", tags=["projects"])
app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["dashboard"])
app.include_router(chat.router, prefix="/api/v1/chat", tags=["chat"])
app.include_router(stok.router, prefix="/api/v1/stok", tags=["stok"])
app.include_router(medya.router, prefix="/api/v1/media", tags=["media"])
app.include_router(isg.router, prefix="/api/v1/isg", tags=["isg"])
app.include_router(toplanti.router, prefix="/api/v1/toplanti", tags=["toplanti"])
app.include_router(hakedis.router, prefix="/api/v1/hakedis", tags=["hakedis"])
app.include_router(malzeme.router, prefix="/api/v1/malzeme", tags=["malzeme"])
app.include_router(puantaj.router, prefix="/api/v1/puantaj", tags=["puantaj"])
app.include_router(bildirim.router, prefix="/api/v1/bildirim", tags=["bildirim"])


# ---------------------------------------------------------------------------
# Genel endpoint'ler
# ---------------------------------------------------------------------------


@app.get("/health", tags=["system"], summary="Sağlık kontrolü")
async def health_check() -> dict[str, str]:
    """Servisin ayakta olduğunu doğrular.

    Returns:
        {"status": "ok"}
    """
    return {"status": "ok"}
