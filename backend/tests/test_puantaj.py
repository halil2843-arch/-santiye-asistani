"""Puantaj endpoint testleri.

Kapsam:
  - POST /api/v1/puantaj/        — tekil kayıt oluştur
  - POST /api/v1/puantaj/toplu   — toplu kayıt (3 kişi)
  - GET  /api/v1/puantaj/        — liste (proje_id filtresi)
  - GET  /api/v1/puantaj/ozet    — özet istatistik
  - DELETE /api/v1/puantaj/{id}  — silme
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
    """İkinci müşteri ve kullanıcı oluşturur; auth_headers döner."""
    musteri2 = Musteri(
        firma_adi="Diger Firma A.S.",
        email="diger@firma2.com",
        aktif=True,
    )
    db_session.add(musteri2)
    await db_session.flush()

    kullanici2 = Kullanici(
        musteri_id=musteri2.id,
        ad_soyad="Diger Kullanici",
        email="diger@kullanici2.com",
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
async def test_create_puantaj_success(
    client: AsyncClient, auth_headers: dict
) -> None:
    """Tekil puantaj kaydı oluşturma 201 döndürmeli."""
    payload = {
        "tarih": "2026-06-01",
        "personel_adi": "Ahmet Yilmaz",
        "meslek": "isci",
        "giris_saati": "08:00",
        "cikis_saati": "17:00",
        "calisma_saati": 9.0,
        "fazla_mesai": 1.0,
        "devamsizlik": False,
        "notlar": "Normal calisma",
    }
    resp = await client.post("/api/v1/puantaj/", json=payload, headers=auth_headers)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["personel_adi"] == "Ahmet Yilmaz"
    assert data["meslek"] == "isci"
    assert data["tarih"] == "2026-06-01"
    assert "id" in data
    assert "musteri_id" in data


@pytest.mark.asyncio
async def test_create_puantaj_toplu(
    client: AsyncClient, auth_headers: dict
) -> None:
    """3 kişilik toplu puantaj kaydı 201 ve 3 kayıt döndürmeli."""
    payload = [
        {
            "tarih": "2026-06-02",
            "personel_adi": "Ali Kaya",
            "meslek": "formen",
            "calisma_saati": 8.0,
        },
        {
            "tarih": "2026-06-02",
            "personel_adi": "Mehmet Demir",
            "meslek": "isci",
            "calisma_saati": 8.0,
        },
        {
            "tarih": "2026-06-02",
            "personel_adi": "Hasan Celik",
            "meslek": "operator",
            "calisma_saati": 8.0,
            "fazla_mesai": 2.0,
        },
    ]
    resp = await client.post("/api/v1/puantaj/toplu", json=payload, headers=auth_headers)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 3
    personel_adlari = [k["personel_adi"] for k in data]
    assert "Ali Kaya" in personel_adlari
    assert "Mehmet Demir" in personel_adlari
    assert "Hasan Celik" in personel_adlari


@pytest.mark.asyncio
async def test_list_puantaj(
    client: AsyncClient, auth_headers: dict
) -> None:
    """Liste endpoint'i kendi kayıtlarını döndürmeli."""
    # Önce kayıt oluştur
    for ad in ["Personel A", "Personel B"]:
        await client.post(
            "/api/v1/puantaj/",
            json={"tarih": "2026-06-03", "personel_adi": ad, "calisma_saati": 8.0},
            headers=auth_headers,
        )

    resp = await client.get("/api/v1/puantaj/", headers=auth_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 2


@pytest.mark.asyncio
async def test_list_puantaj_proje_filtre(
    client: AsyncClient, auth_headers: dict
) -> None:
    """proje_id filtresi yalnızca ilgili kayıtları döndürmeli."""
    proje_a = "proje-aaa-111"
    proje_b = "proje-bbb-222"

    await client.post(
        "/api/v1/puantaj/",
        json={"tarih": "2026-06-04", "personel_adi": "Proje A Calisan", "calisma_saati": 8.0, "proje_id": proje_a},
        headers=auth_headers,
    )
    await client.post(
        "/api/v1/puantaj/",
        json={"tarih": "2026-06-04", "personel_adi": "Proje B Calisan", "calisma_saati": 8.0, "proje_id": proje_b},
        headers=auth_headers,
    )

    resp = await client.get(f"/api/v1/puantaj/?proje_id={proje_a}", headers=auth_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert all(k["proje_id"] == proje_a for k in data)
    adlar = [k["personel_adi"] for k in data]
    assert "Proje A Calisan" in adlar
    assert "Proje B Calisan" not in adlar


@pytest.mark.asyncio
async def test_puantaj_ozet(
    client: AsyncClient, auth_headers: dict
) -> None:
    """Özet endpoint'i istatistik döndürmeli."""
    # Kayıt oluştur
    await client.post(
        "/api/v1/puantaj/",
        json={"tarih": "2026-06-05", "personel_adi": "Ozet Test Calisan", "calisma_saati": 8.0, "fazla_mesai": 2.0},
        headers=auth_headers,
    )

    resp = await client.get("/api/v1/puantaj/ozet", headers=auth_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert isinstance(data, list)
    # En az bir özet satırı olmalı
    assert len(data) >= 1
    ozet = data[0]
    assert "tarih" in ozet
    assert "toplam_personel" in ozet
    assert "toplam_calisma_saati" in ozet
    assert "toplam_fazla_mesai" in ozet
    assert "devamsizlik_sayisi" in ozet


@pytest.mark.asyncio
async def test_delete_puantaj(
    client: AsyncClient, auth_headers: dict
) -> None:
    """DELETE 204 döndürmeli; ikinci istek 404 olmalı."""
    create_resp = await client.post(
        "/api/v1/puantaj/",
        json={"tarih": "2026-06-06", "personel_adi": "Silinecek Kisi", "calisma_saati": 8.0},
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    kayit_id = create_resp.json()["id"]

    del_resp = await client.delete(f"/api/v1/puantaj/{kayit_id}", headers=auth_headers)
    assert del_resp.status_code == 204, del_resp.text

    # Silinen kayda tekrar erişim 404 olmalı
    get_resp = await client.get(f"/api/v1/puantaj/{kayit_id}", headers=auth_headers)
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_puantaj_tenant_isolation(
    client: AsyncClient, auth_headers: dict, db_session
) -> None:
    """Başka müşterinin puantaj kaydı görünmemeli (404)."""
    # Birinci tenant kayıt oluşturur
    create_resp = await client.post(
        "/api/v1/puantaj/",
        json={"tarih": "2026-06-07", "personel_adi": "Tenant A Calisan", "calisma_saati": 8.0},
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    kayit_id = create_resp.json()["id"]

    # İkinci tenant aynı kaydı silmeye çalışır → 404
    headers2 = await _create_second_tenant(db_session)
    del_resp = await client.delete(f"/api/v1/puantaj/{kayit_id}", headers=headers2)
    assert del_resp.status_code == 404, del_resp.text


@pytest.mark.asyncio
async def test_create_puantaj_no_auth(client: AsyncClient) -> None:
    """Token olmadan istek → 401."""
    resp = await client.post(
        "/api/v1/puantaj/",
        json={"tarih": "2026-06-01", "personel_adi": "Test", "calisma_saati": 8.0},
    )
    assert resp.status_code == 401
