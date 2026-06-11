"""Proje yönetimi endpoint testleri.

Kapsam:
  - POST /api/v1/projects/                  — proje oluştur
  - GET  /api/v1/projects/                  — liste
  - GET  /api/v1/projects/{id}              — tekil getir
  - PATCH /api/v1/projects/{id}             — güncelle (durum değiştir)
  - GET  /api/v1/projects/{id}/aktivite     — aktivite listesi (boş)
  - POST /api/v1/projects/{id}/aktivite     — aktivite ekle
  - DELETE /api/v1/projects/{id}            — sil (soft delete → arsiv)
  - Tenant isolation
"""

import pytest
from httpx import AsyncClient

from app.core.security import create_access_token, hash_password
from app.models.tenant import Musteri, Kullanici


# ---------------------------------------------------------------------------
# Yardımcı: ikinci tenant oluştur
# ---------------------------------------------------------------------------


async def _create_second_tenant(db_session):
    musteri2 = Musteri(
        firma_adi="Ikinci Firma A.S.",
        email="ikinci@firma2.com",
        aktif=True,
    )
    db_session.add(musteri2)
    await db_session.flush()

    kullanici2 = Kullanici(
        musteri_id=musteri2.id,
        ad_soyad="Ikinci Kullanici",
        email="ikinci@kullanici2.com",
        sifre_hash=hash_password("Pass12345"),
        rol="admin",
        aktif=True,
    )
    db_session.add(kullanici2)
    await db_session.flush()

    token2 = create_access_token(
        {"sub": kullanici2.id, "mid": musteri2.id, "rol": kullanici2.rol}
    )
    return {"Authorization": f"Bearer {token2}"}


# ---------------------------------------------------------------------------
# Testler
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_proje_success(
    client: AsyncClient, auth_headers: dict
) -> None:
    """Yeni proje oluşturma 201 ve proje verisi döndürmeli."""
    payload = {
        "isim": "Test Konut Projesi",
        "tanim": "15 daireli bina projesi",
        "durum": "aktif",
        "il": "Istanbul",
        "ilce": "Kadikoy",
        "proje_muduru": "Mehmet Bey",
        "butce": 5000000.0,
        "ilerleme_yuzdesi": 0.0,
    }
    resp = await client.post("/api/v1/projects/", json=payload, headers=auth_headers)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["isim"] == "Test Konut Projesi"
    assert data["durum"] == "aktif"
    assert data["il"] == "Istanbul"
    assert "id" in data
    assert "musteri_id" in data


@pytest.mark.asyncio
async def test_list_projeler(
    client: AsyncClient, auth_headers: dict
) -> None:
    """Liste endpoint'i proje listesi döndürmeli."""
    # İki proje oluştur
    for isim in ["Proje Alpha", "Proje Beta"]:
        await client.post(
            "/api/v1/projects/",
            json={"isim": isim, "durum": "aktif"},
            headers=auth_headers,
        )

    resp = await client.get("/api/v1/projects/", headers=auth_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 2


@pytest.mark.asyncio
async def test_get_proje_by_id(
    client: AsyncClient, auth_headers: dict
) -> None:
    """Tekil proje detayı doğru döndürmeli."""
    create_resp = await client.post(
        "/api/v1/projects/",
        json={"isim": "Detay Test Projesi", "durum": "aktif"},
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    proje_id = create_resp.json()["id"]

    get_resp = await client.get(f"/api/v1/projects/{proje_id}", headers=auth_headers)
    assert get_resp.status_code == 200, get_resp.text
    data = get_resp.json()
    assert data["id"] == proje_id
    assert data["isim"] == "Detay Test Projesi"


@pytest.mark.asyncio
async def test_update_proje_durum(
    client: AsyncClient, auth_headers: dict
) -> None:
    """PATCH ile proje durumu güncellenebilmeli."""
    create_resp = await client.post(
        "/api/v1/projects/",
        json={"isim": "Guncelleme Test", "durum": "aktif"},
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    proje_id = create_resp.json()["id"]

    patch_resp = await client.patch(
        f"/api/v1/projects/{proje_id}",
        json={"durum": "pasif", "ilerleme_yuzdesi": 45.0},
        headers=auth_headers,
    )
    assert patch_resp.status_code == 200, patch_resp.text
    data = patch_resp.json()
    assert data["durum"] == "pasif"
    assert data["ilerleme_yuzdesi"] == 45.0


@pytest.mark.asyncio
async def test_get_aktivite_bos(
    client: AsyncClient, auth_headers: dict
) -> None:
    """Yeni projede aktivite listesi boş olmalı."""
    create_resp = await client.post(
        "/api/v1/projects/",
        json={"isim": "Aktivite Bos Test", "durum": "aktif"},
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    proje_id = create_resp.json()["id"]

    aktiv_resp = await client.get(
        f"/api/v1/projects/{proje_id}/aktivite", headers=auth_headers
    )
    assert aktiv_resp.status_code == 200, aktiv_resp.text
    data = aktiv_resp.json()
    assert isinstance(data, list)
    assert len(data) == 0


@pytest.mark.asyncio
async def test_create_aktivite(
    client: AsyncClient, auth_headers: dict
) -> None:
    """Projeye aktivite eklenebilmeli."""
    create_resp = await client.post(
        "/api/v1/projects/",
        json={"isim": "Aktivite Ekle Test", "durum": "aktif"},
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    proje_id = create_resp.json()["id"]

    aktiv_resp = await client.post(
        f"/api/v1/projects/{proje_id}/aktivite",
        json={"baslik": "Zemin kazisi basladi", "tip": "ilerleme", "renk": "green"},
        headers=auth_headers,
    )
    assert aktiv_resp.status_code == 201, aktiv_resp.text
    data = aktiv_resp.json()
    assert data["baslik"] == "Zemin kazisi basladi"
    assert data["proje_id"] == proje_id

    # Liste artık 1 kayıt içermeli
    list_resp = await client.get(
        f"/api/v1/projects/{proje_id}/aktivite", headers=auth_headers
    )
    assert list_resp.status_code == 200
    assert len(list_resp.json()) == 1


@pytest.mark.asyncio
async def test_delete_proje_soft(
    client: AsyncClient, auth_headers: dict
) -> None:
    """DELETE soft delete — proje durumu 'arsiv' olmalı."""
    create_resp = await client.post(
        "/api/v1/projects/",
        json={"isim": "Silinecek Proje", "durum": "aktif"},
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    proje_id = create_resp.json()["id"]

    del_resp = await client.delete(f"/api/v1/projects/{proje_id}", headers=auth_headers)
    assert del_resp.status_code == 204, del_resp.text

    # Proje hâlâ erişilebilir ama durumu arsiv
    get_resp = await client.get(f"/api/v1/projects/{proje_id}", headers=auth_headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["durum"] == "arsiv"


@pytest.mark.asyncio
async def test_projeler_tenant_isolation(
    client: AsyncClient, auth_headers: dict, db_session
) -> None:
    """Başka müşterinin projesi 404 döndürmeli."""
    create_resp = await client.post(
        "/api/v1/projects/",
        json={"isim": "Tenant A Projesi", "durum": "aktif"},
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    proje_id = create_resp.json()["id"]

    # İkinci tenant aynı projeye erişmeye çalışır
    headers2 = await _create_second_tenant(db_session)
    get_resp = await client.get(f"/api/v1/projects/{proje_id}", headers=headers2)
    assert get_resp.status_code == 404, get_resp.text


@pytest.mark.asyncio
async def test_create_proje_no_auth(client: AsyncClient) -> None:
    """Token olmadan proje oluşturma → 401."""
    resp = await client.post("/api/v1/projects/", json={"isim": "Test"})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_list_projeler_durum_filtre(
    client: AsyncClient, auth_headers: dict
) -> None:
    """Durum filtresi çalışmalı — aktif projeler döndürmeli."""
    await client.post(
        "/api/v1/projects/",
        json={"isim": "Aktif Proje", "durum": "aktif"},
        headers=auth_headers,
    )
    await client.post(
        "/api/v1/projects/",
        json={"isim": "Pasif Proje", "durum": "pasif"},
        headers=auth_headers,
    )

    resp = await client.get("/api/v1/projects/?durum=aktif", headers=auth_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert all(p["durum"] == "aktif" for p in data)
