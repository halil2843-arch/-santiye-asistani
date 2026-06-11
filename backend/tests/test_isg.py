"""ISG (İş Sağlığı ve Güvenliği) endpoint testleri.

Kapsam:
  - POST  /api/v1/isg/        — kayıt oluştur (olay tipi, kritik önem)
  - GET   /api/v1/isg/        — liste
  - GET   /api/v1/isg/ozet    — özet
  - PATCH /api/v1/isg/{id}    — durum güncelle (acik → kapandi)
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
        firma_adi="ISG Firma B A.S.",
        email="isgb@firma2.com",
        aktif=True,
    )
    db_session.add(musteri2)
    await db_session.flush()

    kullanici2 = Kullanici(
        musteri_id=musteri2.id,
        ad_soyad="ISG B Kullanici",
        email="isgb@kullanici2.com",
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
async def test_create_isg_kaydi(
    client: AsyncClient, auth_headers: dict
) -> None:
    """ISG kaydı oluşturma 201 ve kayıt verisi döndürmeli."""
    payload = {
        "tip": "olay",
        "tarih": "2026-06-01",
        "aciklama": "Iscinin eline tel batmasi",
        "onem_seviyesi": "kritik",
        "durum": "acik",
        "sorumlu": "ISG Uzmani Ayse",
    }
    resp = await client.post("/api/v1/isg/", json=payload, headers=auth_headers)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["tip"] == "olay"
    assert data["tarih"] == "2026-06-01"
    assert data["onem_seviyesi"] == "kritik"
    assert data["durum"] == "acik"
    assert data["sorumlu"] == "ISG Uzmani Ayse"
    assert "id" in data
    assert "musteri_id" in data


@pytest.mark.asyncio
async def test_create_isg_denetim(
    client: AsyncClient, auth_headers: dict
) -> None:
    """Denetim tipi ISG kaydı oluşturulabilmeli."""
    payload = {
        "tip": "denetim",
        "tarih": "2026-06-02",
        "aciklama": "Aylik guvenlik denetimi",
        "onem_seviyesi": "orta",
        "durum": "kapandi",
    }
    resp = await client.post("/api/v1/isg/", json=payload, headers=auth_headers)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert data["tip"] == "denetim"
    assert data["durum"] == "kapandi"


@pytest.mark.asyncio
async def test_list_isg(
    client: AsyncClient, auth_headers: dict
) -> None:
    """Liste endpoint'i ISG kayıtlarını döndürmeli."""
    for i in range(3):
        await client.post(
            "/api/v1/isg/",
            json={
                "tip": "egitim",
                "tarih": f"2026-06-0{i+1}",
                "onem_seviyesi": "dusuk",
                "durum": "acik",
            },
            headers=auth_headers,
        )

    resp = await client.get("/api/v1/isg/", headers=auth_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 3


@pytest.mark.asyncio
async def test_list_isg_durum_filtre(
    client: AsyncClient, auth_headers: dict
) -> None:
    """durum=acik filtresi yalnızca açık kayıtları döndürmeli."""
    await client.post(
        "/api/v1/isg/",
        json={"tip": "olay", "tarih": "2026-06-10", "onem_seviyesi": "yuksek", "durum": "acik"},
        headers=auth_headers,
    )
    await client.post(
        "/api/v1/isg/",
        json={"tip": "denetim", "tarih": "2026-06-11", "onem_seviyesi": "orta", "durum": "kapandi"},
        headers=auth_headers,
    )

    resp = await client.get("/api/v1/isg/?durum=acik", headers=auth_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert all(k["durum"] == "acik" for k in data)


@pytest.mark.asyncio
async def test_isg_ozet(
    client: AsyncClient, auth_headers: dict
) -> None:
    """Özet endpoint'i ISG istatistiklerini döndürmeli."""
    # Bu aya ait kayıtlar ekle
    await client.post(
        "/api/v1/isg/",
        json={"tip": "olay", "tarih": "2026-06-01", "onem_seviyesi": "kritik", "durum": "acik"},
        headers=auth_headers,
    )
    await client.post(
        "/api/v1/isg/",
        json={"tip": "denetim", "tarih": "2026-06-02", "onem_seviyesi": "orta", "durum": "kapandi"},
        headers=auth_headers,
    )

    resp = await client.get("/api/v1/isg/ozet?ay=2026-06", headers=auth_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert "ay" in data
    assert "toplam" in data
    assert "acik" in data
    assert "kapandi" in data
    assert "ertelendi" in data
    assert "tip_dagilimi" in data
    assert "onem_dagilimi" in data
    assert data["toplam"] >= 2
    assert data["acik"] >= 1
    assert data["kapandi"] >= 1


@pytest.mark.asyncio
async def test_isg_ozet_bos_ay(
    client: AsyncClient, auth_headers: dict
) -> None:
    """Kayıtsız ayda özet sıfır değerleriyle döndürmeli."""
    resp = await client.get("/api/v1/isg/ozet?ay=2020-01", headers=auth_headers)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["toplam"] == 0
    assert data["acik"] == 0


@pytest.mark.asyncio
async def test_update_isg_durum(
    client: AsyncClient, auth_headers: dict
) -> None:
    """PATCH ile kayıt durumu acik → kapandi güncellenebilmeli."""
    create_resp = await client.post(
        "/api/v1/isg/",
        json={
            "tip": "ramak_kala",
            "tarih": "2026-06-05",
            "aciklama": "Iscinin neredeyse dusmesi",
            "onem_seviyesi": "yuksek",
            "durum": "acik",
        },
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    kayit_id = create_resp.json()["id"]

    patch_resp = await client.patch(
        f"/api/v1/isg/{kayit_id}",
        json={"durum": "kapandi", "sonuc": "Guvenlik onlemi alindi"},
        headers=auth_headers,
    )
    assert patch_resp.status_code == 200, patch_resp.text
    data = patch_resp.json()
    assert data["durum"] == "kapandi"
    assert data["sonuc"] == "Guvenlik onlemi alindi"


@pytest.mark.asyncio
async def test_update_isg_ertelendi(
    client: AsyncClient, auth_headers: dict
) -> None:
    """PATCH ile durum ertelendi olarak güncellenebilmeli."""
    create_resp = await client.post(
        "/api/v1/isg/",
        json={"tip": "egitim", "tarih": "2026-06-06", "onem_seviyesi": "dusuk", "durum": "acik"},
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    kayit_id = create_resp.json()["id"]

    patch_resp = await client.patch(
        f"/api/v1/isg/{kayit_id}",
        json={"durum": "ertelendi"},
        headers=auth_headers,
    )
    assert patch_resp.status_code == 200, patch_resp.text
    assert patch_resp.json()["durum"] == "ertelendi"


@pytest.mark.asyncio
async def test_isg_tenant_isolation(
    client: AsyncClient, auth_headers: dict, db_session
) -> None:
    """Başka müşterinin ISG kaydına erişim 404 döndürmeli."""
    create_resp = await client.post(
        "/api/v1/isg/",
        json={"tip": "olay", "tarih": "2026-06-07", "onem_seviyesi": "kritik", "durum": "acik"},
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    kayit_id = create_resp.json()["id"]

    # İkinci tenant aynı kaydı güncellemeye çalışır
    headers2 = await _create_second_tenant(db_session)
    patch_resp = await client.patch(
        f"/api/v1/isg/{kayit_id}",
        json={"durum": "kapandi"},
        headers=headers2,
    )
    assert patch_resp.status_code == 404, patch_resp.text


@pytest.mark.asyncio
async def test_isg_no_auth(client: AsyncClient) -> None:
    """Token olmadan ISG kaydı oluşturma → 401."""
    resp = await client.post(
        "/api/v1/isg/",
        json={"tip": "olay", "tarih": "2026-06-01", "onem_seviyesi": "orta", "durum": "acik"},
    )
    assert resp.status_code == 401
