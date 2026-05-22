"""Şantiye onboarding endpoint testleri.

Kapsam:
  - POST /api/v1/sites/              — yeni şantiye oluştur
  - GET  /api/v1/sites/pending-phones — bekleyen numaraları listele
  - POST /api/v1/sites/{id}/link-phone — numarayı şantiyeye bağla
"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.message import PendingWhatsapp
from app.models.tenant import Musteri


# ---------------------------------------------------------------------------
# Şantiye oluşturma
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_site(
    client: AsyncClient,
    test_musteri: Musteri,
) -> None:
    """POST /api/v1/sites/ yeni şantiye kaydı oluşturmalı ve 201 dönmeli."""
    payload = {
        "musteri_id": test_musteri.id,
        "isim": "Ana Şantiye",
        "adres": "Ankara, Çankaya",
        "whatsapp_numara": None,
    }
    r = await client.post("/api/v1/sites/", json=payload)
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["isim"] == "Ana Şantiye"
    assert data["musteri_id"] == test_musteri.id
    assert "id" in data
    assert data["aktif"] is True


@pytest.mark.asyncio
async def test_create_site_with_phone(
    client: AsyncClient,
    test_musteri: Musteri,
) -> None:
    """Telefon numarasıyla şantiye oluşturulabilmeli."""
    payload = {
        "musteri_id": test_musteri.id,
        "isim": "Kuzey Şantiyesi",
        "whatsapp_numara": "+905551112233",
    }
    r = await client.post("/api/v1/sites/", json=payload)
    assert r.status_code == 201, r.text
    assert r.json()["whatsapp_numara"] == "+905551112233"


@pytest.mark.asyncio
async def test_create_site_duplicate_phone(
    client: AsyncClient,
    test_musteri: Musteri,
) -> None:
    """Aynı telefon numarasıyla ikinci şantiye oluşturma → 409 dönmeli."""
    payload = {
        "musteri_id": test_musteri.id,
        "isim": "Şantiye A",
        "whatsapp_numara": "+905559998877",
    }
    r1 = await client.post("/api/v1/sites/", json=payload)
    assert r1.status_code == 201

    payload2 = dict(payload)
    payload2["isim"] = "Şantiye B"
    r2 = await client.post("/api/v1/sites/", json=payload2)
    assert r2.status_code == 409, r2.text


@pytest.mark.asyncio
async def test_list_sites(
    client: AsyncClient,
    test_musteri: Musteri,
) -> None:
    """GET /api/v1/sites/ şantiye listesini döndürmeli."""
    # Şantiye ekle
    await client.post(
        "/api/v1/sites/",
        json={"musteri_id": test_musteri.id, "isim": "Liste Şantiye"},
    )
    r = await client.get("/api/v1/sites/")
    assert r.status_code == 200, r.text
    assert isinstance(r.json(), list)
    assert len(r.json()) >= 1


# ---------------------------------------------------------------------------
# Bekleyen numaralar
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_pending_phones_empty(client: AsyncClient) -> None:
    """Hiç pending kayıt yokken GET /api/v1/sites/pending-phones boş liste döndürmeli."""
    r = await client.get("/api/v1/sites/pending-phones")
    assert r.status_code == 200, r.text
    assert r.json() == []


@pytest.mark.asyncio
async def test_list_pending_phones_with_data(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """Pending kayıt varken liste dolu dönmeli."""
    pending = PendingWhatsapp(
        whatsapp_numara="+905550001111",
        ilk_mesaj_metni="Merhaba",
        islendi=False,
    )
    db_session.add(pending)
    await db_session.flush()

    r = await client.get("/api/v1/sites/pending-phones")
    assert r.status_code == 200, r.text
    items = r.json()
    assert len(items) >= 1
    numbers = [i["whatsapp_numara"] for i in items]
    assert "+905550001111" in numbers


# ---------------------------------------------------------------------------
# Numarayı şantiyeye bağlama
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_link_phone_to_site(
    client: AsyncClient,
    test_musteri: Musteri,
) -> None:
    """POST /api/v1/sites/{id}/link-phone numarayı şantiyeye bağlamalı."""
    # Şantiye oluştur
    r_site = await client.post(
        "/api/v1/sites/",
        json={"musteri_id": test_musteri.id, "isim": "Link Test Şantiye"},
    )
    assert r_site.status_code == 201
    santiye_id = r_site.json()["id"]

    # Numarayı bağla
    r_link = await client.post(
        f"/api/v1/sites/{santiye_id}/link-phone",
        json={"whatsapp_numara": "+905557778899"},
    )
    assert r_link.status_code == 200, r_link.text
    data = r_link.json()
    assert data["santiye_id"] == santiye_id
    assert data["whatsapp_numara"] == "+905557778899"


@pytest.mark.asyncio
async def test_link_phone_marks_pending_as_done(
    client: AsyncClient,
    db_session: AsyncSession,
    test_musteri: Musteri,
) -> None:
    """Numarayı bağlarken mevcut pending kaydı islendi=True yapılmalı."""
    numara = "+905556667788"

    # Önce pending kaydı ekle
    pending = PendingWhatsapp(
        whatsapp_numara=numara,
        ilk_mesaj_metni="İlk temas",
        islendi=False,
    )
    db_session.add(pending)
    await db_session.flush()

    # Şantiye oluştur
    r_site = await client.post(
        "/api/v1/sites/",
        json={"musteri_id": test_musteri.id, "isim": "Pending Link Şantiye"},
    )
    santiye_id = r_site.json()["id"]

    # Numarayı bağla
    r_link = await client.post(
        f"/api/v1/sites/{santiye_id}/link-phone",
        json={"whatsapp_numara": numara},
    )
    assert r_link.status_code == 200, r_link.text
    assert r_link.json()["pending_islendi"] is True


@pytest.mark.asyncio
async def test_link_phone_site_not_found(client: AsyncClient) -> None:
    """Geçersiz santiye_id → 404 dönmeli."""
    r = await client.post(
        "/api/v1/sites/nonexistent-id/link-phone",
        json={"whatsapp_numara": "+905551234567"},
    )
    assert r.status_code == 404, r.text


@pytest.mark.asyncio
async def test_link_phone_invalid_format(
    client: AsyncClient,
    test_musteri: Musteri,
) -> None:
    """+ işareti olmayan numara → 422 dönmeli (Pydantic validation)."""
    r_site = await client.post(
        "/api/v1/sites/",
        json={"musteri_id": test_musteri.id, "isim": "Format Test Şantiye"},
    )
    santiye_id = r_site.json()["id"]

    r = await client.post(
        f"/api/v1/sites/{santiye_id}/link-phone",
        json={"whatsapp_numara": "05551234567"},  # + eksik
    )
    assert r.status_code == 422, r.text
