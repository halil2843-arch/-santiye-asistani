"""Pytest fixtures — test altyapisi.

Async SQLite :memory: DB, httpx AsyncClient, Musteri+Kullanici+JWT token fixture'lari.

Izolasyon stratejisi:
  - Her test fonksiyonu icin ayri bir in-memory SQLite DB olusturulur.
  - Bu sayede tablolar her testte temiz baslar; rollback veya truncate gerekmez.
"""

from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    AsyncSession,
    async_sessionmaker,
)

from app.core.database import Base, get_db
from app.core.rate_limit import rate_limit_sayaci_temizle
from app.core.security import create_access_token, hash_password
from app.main import app
from app.models.tenant import Musteri, Kullanici


# ---------------------------------------------------------------------------
# Her test icin ayri engine + session fabrikasi
# ---------------------------------------------------------------------------


def _make_engine():
    """Test-local async SQLite :memory: engine olusturur."""
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        echo=False,
    )
    return engine


@pytest_asyncio.fixture
async def db_engine():
    """Her test icin taze bir SQLite :memory: engine + tablolar."""
    import app.models  # noqa: F401  — Base.metadata'ya kayit icin
    engine = _make_engine()
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(db_engine):
    """Her test icin temiz bir AsyncSession (ayri in-memory DB'den)."""
    session_factory = async_sessionmaker(
        db_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_factory() as session:
        yield session


# ---------------------------------------------------------------------------
# Dependency override + AsyncClient
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def client(db_session: AsyncSession):
    """Override get_db ile AsyncClient dondurur."""

    async def override_get_db():
        try:
            yield db_session
            await db_session.commit()
        except Exception:
            await db_session.rollback()
            raise

    app.dependency_overrides[get_db] = override_get_db
    rate_limit_sayaci_temizle()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Musteri + Kullanici fixture'lari
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def test_musteri(db_session: AsyncSession) -> Musteri:
    """Test icin hazir Musteri nesnesi olusturur."""
    musteri = Musteri(
        firma_adi="Test Firma A.S.",
        email="firma@test.com",
        aktif=True,
    )
    db_session.add(musteri)
    await db_session.flush()
    return musteri


@pytest_asyncio.fixture
async def test_kullanici(db_session: AsyncSession, test_musteri: Musteri) -> Kullanici:
    """Test icin hazir Kullanici nesnesi olusturur (sifre: TestPass123)."""
    kullanici = Kullanici(
        musteri_id=test_musteri.id,
        ad_soyad="Test Kullanici",
        email="kullanici@test.com",
        sifre_hash=hash_password("TestPass123"),
        rol="admin",
        aktif=True,
    )
    db_session.add(kullanici)
    await db_session.flush()
    return kullanici


@pytest_asyncio.fixture
async def auth_token(test_kullanici: Kullanici, test_musteri: Musteri) -> str:
    """Gecerli JWT access token dondurur."""
    return create_access_token(
        {
            "sub": test_kullanici.id,
            "mid": test_musteri.id,
            "rol": test_kullanici.rol,
        }
    )


@pytest_asyncio.fixture
async def auth_headers(auth_token: str) -> dict[str, str]:
    """Authorization header dict'i dondurur."""
    return {"Authorization": f"Bearer {auth_token}"}


# ---------------------------------------------------------------------------
# İkinci tenant (Tenant B) fixture'lari — tenant izolasyon testleri icin
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def test_musteri_b(db_session: AsyncSession) -> Musteri:
    """Ikinci tenant icin Musteri nesnesi."""
    musteri = Musteri(
        firma_adi="Diger Firma B.V.",
        email="firma_b@test.com",
        aktif=True,
    )
    db_session.add(musteri)
    await db_session.flush()
    return musteri


@pytest_asyncio.fixture
async def test_kullanici_b(db_session: AsyncSession, test_musteri_b: Musteri) -> Kullanici:
    """Tenant B'ye ait kullanici (sifre: TestPass456)."""
    kullanici = Kullanici(
        musteri_id=test_musteri_b.id,
        ad_soyad="Tenant B Kullanici",
        email="kullanici_b@test.com",
        sifre_hash=hash_password("TestPass456"),
        rol="admin",
        aktif=True,
    )
    db_session.add(kullanici)
    await db_session.flush()
    return kullanici


@pytest_asyncio.fixture
async def auth_token_b(test_kullanici_b: Kullanici, test_musteri_b: Musteri) -> str:
    """Tenant B icin gecerli JWT access token."""
    return create_access_token(
        {
            "sub": test_kullanici_b.id,
            "mid": test_musteri_b.id,
            "rol": test_kullanici_b.rol,
        }
    )


@pytest_asyncio.fixture
async def auth_headers_b(auth_token_b: str) -> dict[str, str]:
    """Tenant B icin Authorization header dict'i."""
    return {"Authorization": f"Bearer {auth_token_b}"}
