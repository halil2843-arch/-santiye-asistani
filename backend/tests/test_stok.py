"""Stok yönetimi endpoint testleri.

Kapsam:
  - POST /api/v1/stok/                   — stok kalemi oluştur
  - GET  /api/v1/stok/                   — liste
  - POST /api/v1/stok/{id}/hareket       — giriş hareketi
  - POST /api/v1/stok/{id}/hareket       — çıkış hareketi (yetersiz stok hata senaryosu)
  - GET  /api/v1/stok/{id}/hareketler    — hareket listesi
  - DELETE /api/v1/stok/{id}             — sil
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
        firma_adi="Stok Firma B A.S.",
        email="stokb@firma2.com",
        aktif=True,
    )
    db_session.add(musteri2)
    await db_session.flush()

    kullanici2 = Kullanici(
        musteri_id=musteri2.id,
        ad_soyad="Stok B Kullanici",
        email="stokb@kullanici2.com",
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
async def test_create_stok_kalemi(
    client: AsyncClient, auth_headers: dict
) -> None:
    """Yeni stok kalemi oluşturma 201 döndürmeli."""
    payload = {
        "malzeme_adi": "Cimento",
        "birim": "ton",
        "miktar": 50.0,
        "min_miktar": 10.0,
    }
    resp = await client.post("/api/v1/stok/", json=payload, headers=auth_headers)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["malzeme_adi"] == "Cimento"
    assert data["birim"] == "ton"
    assert data["miktar"] == 50.0
    assert data["min_miktar"] == 10.0
    assert "id" in data
    assert "musteri_id" in data
    assert "kritik" in data


@pytest.mark.asyncio
async def test_list_stok(
    client: AsyncClient, auth_headers: dict
) -> None:
    """Liste endpoint'i stok kalemlerini döndürmeli."""
    for malzeme in ["Demir", "Kum", "Cakil"]:
        await client.post(
            "/api/v1/stok/",
            json={"malzeme_adi": malzeme, "miktar": 100.0, "min_miktar": 20.0},
            headers=auth_headers,
        )

    resp = await client.get("/api/v1/stok/", headers=auth_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 3


@pytest.mark.asyncio
async def test_stok_giris_hareketi(
    client: AsyncClient, auth_headers: dict
) -> None:
    """Giriş hareketi stok miktarını artırmalı."""
    create_resp = await client.post(
        "/api/v1/stok/",
        json={"malzeme_adi": "Boya", "birim": "litre", "miktar": 20.0, "min_miktar": 5.0},
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    kalem_id = create_resp.json()["id"]

    hareket_resp = await client.post(
        f"/api/v1/stok/{kalem_id}/hareket",
        json={"tip": "giris", "miktar": 30.0, "aciklama": "Yeni sevkiyat"},
        headers=auth_headers,
    )
    assert hareket_resp.status_code == 201, hareket_resp.text
    data = hareket_resp.json()
    assert data["tip"] == "giris"
    assert data["miktar"] == 30.0
    assert data["kalem_id"] == kalem_id

    # Kalem miktarı güncellenmeli: 20 + 30 = 50
    get_resp = await client.get(f"/api/v1/stok/{kalem_id}", headers=auth_headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["miktar"] == 50.0


@pytest.mark.asyncio
async def test_stok_cikis_hareketi(
    client: AsyncClient, auth_headers: dict
) -> None:
    """Çıkış hareketi stok miktarını azaltmalı."""
    create_resp = await client.post(
        "/api/v1/stok/",
        json={"malzeme_adi": "Kiremit", "birim": "adet", "miktar": 100.0, "min_miktar": 10.0},
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    kalem_id = create_resp.json()["id"]

    hareket_resp = await client.post(
        f"/api/v1/stok/{kalem_id}/hareket",
        json={"tip": "cikis", "miktar": 40.0, "aciklama": "Saha kullanimi"},
        headers=auth_headers,
    )
    assert hareket_resp.status_code == 201, hareket_resp.text
    assert hareket_resp.json()["tip"] == "cikis"

    # Kalem miktarı: 100 - 40 = 60
    get_resp = await client.get(f"/api/v1/stok/{kalem_id}", headers=auth_headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["miktar"] == 60.0


@pytest.mark.asyncio
async def test_stok_cikis_yetersiz_stok(
    client: AsyncClient, auth_headers: dict
) -> None:
    """Mevcut stoktan fazla çıkış → 422 hatası döndürmeli."""
    create_resp = await client.post(
        "/api/v1/stok/",
        json={"malzeme_adi": "Vidalar", "birim": "kutu", "miktar": 5.0, "min_miktar": 1.0},
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    kalem_id = create_resp.json()["id"]

    # 5 adet stok var, 999 çıkış yapmaya çalış
    hareket_resp = await client.post(
        f"/api/v1/stok/{kalem_id}/hareket",
        json={"tip": "cikis", "miktar": 999.0, "aciklama": "Fazla cikis"},
        headers=auth_headers,
    )
    assert hareket_resp.status_code == 422, hareket_resp.text


@pytest.mark.asyncio
async def test_list_hareketler(
    client: AsyncClient, auth_headers: dict
) -> None:
    """Hareket listesi endpoint'i doğru çalışmalı."""
    create_resp = await client.post(
        "/api/v1/stok/",
        json={"malzeme_adi": "Profil", "birim": "metre", "miktar": 200.0, "min_miktar": 50.0},
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    kalem_id = create_resp.json()["id"]

    # İki hareket ekle
    await client.post(
        f"/api/v1/stok/{kalem_id}/hareket",
        json={"tip": "giris", "miktar": 100.0},
        headers=auth_headers,
    )
    await client.post(
        f"/api/v1/stok/{kalem_id}/hareket",
        json={"tip": "cikis", "miktar": 50.0},
        headers=auth_headers,
    )

    list_resp = await client.get(
        f"/api/v1/stok/{kalem_id}/hareketler", headers=auth_headers
    )
    assert list_resp.status_code == 200, list_resp.text
    data = list_resp.json()
    assert isinstance(data, list)
    assert len(data) == 2


@pytest.mark.asyncio
async def test_delete_stok_kalemi(
    client: AsyncClient, auth_headers: dict
) -> None:
    """DELETE 204 döndürmeli; sonraki istek 404 olmalı."""
    create_resp = await client.post(
        "/api/v1/stok/",
        json={"malzeme_adi": "Silinecek Malzeme", "miktar": 10.0, "min_miktar": 2.0},
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    kalem_id = create_resp.json()["id"]

    del_resp = await client.delete(f"/api/v1/stok/{kalem_id}", headers=auth_headers)
    assert del_resp.status_code == 204, del_resp.text

    # Silinen kayda erişim 404 olmalı
    get_resp = await client.get(f"/api/v1/stok/{kalem_id}", headers=auth_headers)
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_stok_tenant_isolation(
    client: AsyncClient, auth_headers: dict, db_session
) -> None:
    """Başka müşterinin stok kalemine erişim 404 döndürmeli."""
    create_resp = await client.post(
        "/api/v1/stok/",
        json={"malzeme_adi": "Tenant A Malzeme", "miktar": 50.0, "min_miktar": 5.0},
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    kalem_id = create_resp.json()["id"]

    # İkinci tenant aynı kalemi silmeye çalışır
    headers2 = await _create_second_tenant(db_session)
    del_resp = await client.delete(f"/api/v1/stok/{kalem_id}", headers=headers2)
    assert del_resp.status_code == 404, del_resp.text


@pytest.mark.asyncio
async def test_stok_kritik_flag(
    client: AsyncClient, auth_headers: dict
) -> None:
    """miktar <= min_miktar ise kritik=True döndürmeli."""
    # miktar < min_miktar → kritik
    resp = await client.post(
        "/api/v1/stok/",
        json={"malzeme_adi": "Kritik Malzeme", "miktar": 3.0, "min_miktar": 10.0},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["kritik"] is True

    # miktar > min_miktar → kritik değil
    resp2 = await client.post(
        "/api/v1/stok/",
        json={"malzeme_adi": "Normal Malzeme", "miktar": 100.0, "min_miktar": 10.0},
        headers=auth_headers,
    )
    assert resp2.status_code == 201
    assert resp2.json()["kritik"] is False
