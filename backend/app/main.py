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

from app.api.v1 import auth, webhook, templates, reports, sites, koordinator, users
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
# FastAPI uygulaması
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Şantiye Asistanı API",
    description=(
        "WhatsApp'tan gelen mesajları GPT-4o ile analiz ederek "
        "Excel/Word şablonlarını otomatik dolduran SaaS backend."
    ),
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)


# ---------------------------------------------------------------------------
# CORS — geliştirmede tüm origin'lere izin ver
# ---------------------------------------------------------------------------

_cors_origins = (
    ["*"] if settings.CORS_ORIGINS == "*"
    else [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
