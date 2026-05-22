"""Kimlik doğrulama endpoint testleri.

Kapsam:
  - POST /api/v1/auth/register
  - POST /api/v1/auth/login
  - GET  /api/v1/templates/  (korumalı endpoint, token kontrolü)
"""

import pytest
from httpx import AsyncClient


# ---------------------------------------------------------------------------
# Register testleri
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_register_success(client: AsyncClient) -> None:
    """Yeni müşteri kaydı 201 döndürmeli ve yanıtta kullanici_id olmalı."""
    payload = {
        "firma_adi": "Yeni Firma Ltd.",
        "firma_email": "yeni@firma.com",
        "ad_soyad": "Ali Veli",
        "email": "ali@firma.com",
        "sifre": "Guclu123!",
    }
    resp = await client.post("/api/v1/auth/register", json=payload)
    assert resp.status_code == 201, resp.text
    data = resp.json()
    assert "musteri_id" in data
    assert "kullanici_id" in data
    assert data["email"] == "ali@firma.com"
    assert "mesaj" in data


@pytest.mark.asyncio
async def test_register_duplicate_firma_email(client: AsyncClient) -> None:
    """Aynı firma emailiyle iki kayıt denemesi → ikincisi 409 döndürmeli."""
    payload = {
        "firma_adi": "Firma X",
        "firma_email": "dup@firma.com",
        "ad_soyad": "A B",
        "email": "ab@firma.com",
        "sifre": "Guclu123!",
    }
    r1 = await client.post("/api/v1/auth/register", json=payload)
    assert r1.status_code == 201

    # Aynı firma emaili, farklı kullanici emaili
    payload2 = dict(payload)
    payload2["email"] = "cd@firma.com"
    r2 = await client.post("/api/v1/auth/register", json=payload2)
    assert r2.status_code == 409, r2.text


@pytest.mark.asyncio
async def test_register_duplicate_kullanici_email(client: AsyncClient) -> None:
    """Aynı kullanici emailiyle iki kayıt denemesi → ikincisi 409 döndürmeli."""
    payload = {
        "firma_adi": "Firma Y",
        "firma_email": "firmay@firma.com",
        "ad_soyad": "C D",
        "email": "cd@firma2.com",
        "sifre": "Guclu123!",
    }
    r1 = await client.post("/api/v1/auth/register", json=payload)
    assert r1.status_code == 201

    # Farklı firma emaili, aynı kullanici emaili
    payload2 = dict(payload)
    payload2["firma_email"] = "firmaz@firma.com"
    payload2["firma_adi"] = "Firma Z"
    r2 = await client.post("/api/v1/auth/register", json=payload2)
    assert r2.status_code == 409, r2.text


# ---------------------------------------------------------------------------
# Login testleri
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient) -> None:
    """Geçerli kimlik bilgileriyle giriş yapılınca token dönmeli."""
    # Önce kayıt
    reg_payload = {
        "firma_adi": "Login Firma",
        "firma_email": "login@firma.com",
        "ad_soyad": "Login User",
        "email": "loginuser@firma.com",
        "sifre": "LoginPass1",
    }
    r_reg = await client.post("/api/v1/auth/register", json=reg_payload)
    assert r_reg.status_code == 201

    # Giriş
    login_payload = {"email": "loginuser@firma.com", "sifre": "LoginPass1"}
    r_login = await client.post("/api/v1/auth/login", json=login_payload)
    assert r_login.status_code == 200, r_login.text
    data = r_login.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert "kullanici_id" in data
    assert "musteri_id" in data


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient) -> None:
    """Yanlış şifre ile giriş denemesi → 401 döndürmeli."""
    reg_payload = {
        "firma_adi": "WrongPass Firma",
        "firma_email": "wp@firma.com",
        "ad_soyad": "WP User",
        "email": "wpuser@firma.com",
        "sifre": "CorrectPass1",
    }
    await client.post("/api/v1/auth/register", json=reg_payload)

    login_payload = {"email": "wpuser@firma.com", "sifre": "WrongPass999"}
    r = await client.post("/api/v1/auth/login", json=login_payload)
    assert r.status_code == 401, r.text


@pytest.mark.asyncio
async def test_login_nonexistent_email(client: AsyncClient) -> None:
    """Kayıtlı olmayan email ile giriş → 401 döndürmeli."""
    login_payload = {"email": "yok@firma.com", "sifre": "HerhangiBir1"}
    r = await client.post("/api/v1/auth/login", json=login_payload)
    assert r.status_code == 401, r.text


# ---------------------------------------------------------------------------
# Korumalı endpoint erişim testleri
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_protected_endpoint_no_token(client: AsyncClient) -> None:
    """Token olmadan /api/v1/templates/ isteği → 401 döndürmeli."""
    r = await client.get("/api/v1/templates/")
    assert r.status_code == 401, r.text


@pytest.mark.asyncio
async def test_protected_endpoint_invalid_token(client: AsyncClient) -> None:
    """Geçersiz token ile /api/v1/templates/ isteği → 401 döndürmeli."""
    headers = {"Authorization": "Bearer cozumlenemeyen.gecersiz.token"}
    r = await client.get("/api/v1/templates/", headers=headers)
    assert r.status_code == 401, r.text


@pytest.mark.asyncio
async def test_protected_endpoint_valid_token(
    client: AsyncClient,
    auth_headers: dict[str, str],
) -> None:
    """Geçerli token ile /api/v1/templates/ isteği → 200 ve liste döndürmeli."""
    r = await client.get("/api/v1/templates/", headers=auth_headers)
    assert r.status_code == 200, r.text
    assert isinstance(r.json(), list)
