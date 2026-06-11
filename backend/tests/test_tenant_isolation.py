"""
Tenant isolation testleri.

Bir tenant başka bir tenant'ın verisine erişememeli.
Her test kendi in-memory DB'sini kullanır (conftest.py fixtures).

Sprint notu: Fixture'lar conftest.py'den alınır.
             İkinci tenant için ek fixture'lar bu dosyada tanımlanmıştır.
"""

from __future__ import annotations

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.proje import Proje, ProjeDurum
from app.models.site import Santiye
from app.models.tenant import Musteri


# ---------------------------------------------------------------------------
# Tenant A'ya ait test verisi fixture'lari
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def proje_a(db_session: AsyncSession, test_musteri) -> Proje:
    """Tenant A'ya ait bir proje kaydı."""
    proje = Proje(
        musteri_id=test_musteri.id,
        isim="Tenant A Projesi",
        durum=ProjeDurum.aktif,
        ilerleme_yuzdesi=0.0,
    )
    db_session.add(proje)
    await db_session.flush()
    return proje


@pytest_asyncio.fixture
async def santiye_a(db_session: AsyncSession, test_musteri) -> Santiye:
    """Tenant A'ya ait bir şantiye kaydı."""
    santiye = Santiye(
        musteri_id=test_musteri.id,
        isim="Tenant A Santiyesi",
        aktif=True,
        arsiv=False,
    )
    db_session.add(santiye)
    await db_session.flush()
    return santiye


# ---------------------------------------------------------------------------
# Testler
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_proje_baska_tenant_goremez(
    client: AsyncClient,
    proje_a: Proje,
    auth_headers_b: dict[str, str],
) -> None:
    """Tenant B, Tenant A'nın projesini görememeli — 404 beklenir.

    Güvenlik gerekliliği: Proje ID'si tahmin edilebilir olsa bile
    tenant izolasyonu sayesinde başka tenant erişemez.
    404 (403 yerine) dönmesi kaynak varlığını da gizler (enumeration koruması).
    """
    resp = await client.get(
        f"/api/v1/projects/{proje_a.id}",
        headers=auth_headers_b,
    )
    assert resp.status_code == 404, (
        f"Tenant B, Tenant A projesine erişebildi! "
        f"Status: {resp.status_code}, Yanıt: {resp.text}"
    )


@pytest.mark.asyncio
async def test_proje_listesi_baska_tenant_icermez(
    client: AsyncClient,
    proje_a: Proje,
    auth_headers_b: dict[str, str],
) -> None:
    """Tenant B'nin proje listesi, Tenant A'nın projesini içermemeli."""
    resp = await client.get("/api/v1/projects/", headers=auth_headers_b)
    assert resp.status_code == 200
    projeler = resp.json()
    proje_ids = [p["id"] for p in projeler]
    assert proje_a.id not in proje_ids, (
        f"Tenant A'nın projesi ({proje_a.id}) Tenant B'nin listesinde görünüyor!"
    )


@pytest.mark.asyncio
async def test_proje_guncelleme_baska_tenant_yapamaz(
    client: AsyncClient,
    proje_a: Proje,
    auth_headers_b: dict[str, str],
) -> None:
    """Tenant B, Tenant A'nın projesini güncelleyememeli — 404 beklenir."""
    resp = await client.patch(
        f"/api/v1/projects/{proje_a.id}",
        headers=auth_headers_b,
        json={"isim": "Ele Gecirildi"},
    )
    assert resp.status_code == 404, (
        f"Tenant B, Tenant A projesini güncelleyebildi! "
        f"Status: {resp.status_code}"
    )


@pytest.mark.asyncio
async def test_proje_silme_baska_tenant_yapamaz(
    client: AsyncClient,
    proje_a: Proje,
    auth_headers_b: dict[str, str],
) -> None:
    """Tenant B, Tenant A'nın projesini silememeli — 404 beklenir."""
    resp = await client.delete(
        f"/api/v1/projects/{proje_a.id}",
        headers=auth_headers_b,
    )
    assert resp.status_code == 404, (
        f"Tenant B, Tenant A projesini sildi! "
        f"Status: {resp.status_code}"
    )


@pytest.mark.asyncio
async def test_dashboard_yalniz_kendi_verisini_gosterir(
    client: AsyncClient,
    santiye_a: Santiye,
    auth_headers: dict[str, str],
    auth_headers_b: dict[str, str],
) -> None:
    """Dashboard summary yalnızca kendi tenant'ının verisini göstermeli.

    Tenant A'da 1 şantiye var. Tenant B'nin dashboard'u 0 şantiye göstermeli.
    """
    # Tenant A'nın dashboard'u
    resp_a = await client.get("/api/v1/dashboard/summary", headers=auth_headers)
    assert resp_a.status_code == 200
    summary_a = resp_a.json()
    assert summary_a["aktif_santiye_sayisi"] >= 1, (
        "Tenant A kendi şantiyesini göremedi."
    )

    # Tenant B'nin dashboard'u — farklı tenant, 0 şantiye beklenir
    resp_b = await client.get("/api/v1/dashboard/summary", headers=auth_headers_b)
    assert resp_b.status_code == 200
    summary_b = resp_b.json()
    assert summary_b["aktif_santiye_sayisi"] == 0, (
        f"Tenant B, Tenant A'nın şantiyelerini sayıyor! "
        f"Değer: {summary_b['aktif_santiye_sayisi']}"
    )


@pytest.mark.asyncio
async def test_template_listesi_baska_tenant_icermez(
    client: AsyncClient,
    auth_headers: dict[str, str],
    auth_headers_b: dict[str, str],
) -> None:
    """Tenant B'nin şablon listesi, Tenant A'nın şablonlarını içermemeli."""
    # Tenant A'nın şablon listesi (boş bile olsa 200 beklenir)
    resp_a = await client.get("/api/v1/templates/", headers=auth_headers)
    assert resp_a.status_code == 200

    # Tenant B'nin şablon listesi
    resp_b = await client.get("/api/v1/templates/", headers=auth_headers_b)
    assert resp_b.status_code == 200

    # İki listenin kesişimi boş olmalı
    ids_a = {t["id"] for t in resp_a.json()}
    ids_b = {t["id"] for t in resp_b.json()}
    overlap = ids_a & ids_b
    assert not overlap, (
        f"Tenant izolasyonu ihlali! Ortak şablon ID'leri: {overlap}"
    )


@pytest.mark.asyncio
async def test_token_olmadan_erisim_engellenir(client: AsyncClient) -> None:
    """Token olmadan korumalı endpoint'lere erişim 401 dönmeli."""
    endpoints = [
        "/api/v1/projects/",
        "/api/v1/dashboard/summary",
        "/api/v1/templates/",
    ]
    for endpoint in endpoints:
        resp = await client.get(endpoint)
        assert resp.status_code == 401, (
            f"Token olmadan {endpoint} erişilebilir! Status: {resp.status_code}"
        )


@pytest.mark.asyncio
async def test_gecersiz_token_erisim_engellenir(client: AsyncClient) -> None:
    """Sahte/geçersiz token ile erişim 401 dönmeli."""
    sahte_headers = {"Authorization": "Bearer sahte.token.degeri"}
    resp = await client.get("/api/v1/projects/", headers=sahte_headers)
    assert resp.status_code == 401, (
        f"Geçersiz token kabul edildi! Status: {resp.status_code}"
    )


@pytest.mark.asyncio
async def test_auth_rate_limit_login(client: AsyncClient) -> None:
    """Login endpoint'i 10 başarısız denemeden sonra 429 döner.

    AC: IP başına 60 saniye içinde 10 istek sınırı uygulanır.
    """
    from app.core.rate_limit import rate_limit_sayaci_temizle

    # Önceki test kalıntılarını temizle
    rate_limit_sayaci_temizle()

    yanlis_giris = {"email": "yanlis@example.com", "sifre": "YanlisPass999"}

    # 10 istek — hepsi 401 (yanlış şifre) dönmeli, henüz limit yok
    for i in range(10):
        r = await client.post("/api/v1/auth/login", json=yanlis_giris)
        assert r.status_code in (401, 422), (
            f"İstek {i + 1}: Beklenmeyen durum kodu {r.status_code}"
        )

    # 11. istek — artık 429 dönmeli
    r11 = await client.post("/api/v1/auth/login", json=yanlis_giris)
    assert r11.status_code == 429, (
        f"Rate limit çalışmıyor! 11. istekte {r11.status_code} döndü, 429 beklendi."
    )


@pytest.mark.asyncio
async def test_auth_rate_limit_register(client: AsyncClient) -> None:
    """Register endpoint'i 5 denemeden sonra 429 döner.

    AC: IP başına 60 saniye içinde 5 kayıt isteği sınırı uygulanır.
    """
    from app.core.rate_limit import rate_limit_sayaci_temizle

    rate_limit_sayaci_temizle()

    # 5 istek — her biri 201 veya 409 dönebilir (email zaten kayıtlıysa)
    for i in range(5):
        await client.post(
            "/api/v1/auth/register",
            json={
                "firma_adi": f"Test Firma {i}",
                "firma_email": f"firma{i}@ratelimit.com",
                "ad_soyad": f"Test Kullanici {i}",
                "email": f"kullanici{i}@ratelimit.com",
                "sifre": "TestSifre123",
            },
        )

    # 6. istek — 429 beklenir
    r6 = await client.post(
        "/api/v1/auth/register",
        json={
            "firma_adi": "Limit Asildi Firma",
            "firma_email": "limit@ratelimit.com",
            "ad_soyad": "Limit Kullanici",
            "email": "limit@ratelimit.com",
            "sifre": "TestSifre123",
        },
    )
    assert r6.status_code == 429, (
        f"Register rate limit çalışmıyor! 6. istekte {r6.status_code} döndü, 429 beklendi."
    )
