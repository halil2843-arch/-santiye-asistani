"""Twilio WhatsApp webhook endpoint testleri.

Kapsam:
  - POST /api/v1/webhook/whatsapp — bilinmeyen numara → TwiML + pending kaydı
  - POST /api/v1/webhook/whatsapp — kayıtlı numara → mesaj kaydedilir

Güvenlik notu:
  Twilio imza doğrulaması DEBUG=True modunda bypass edilir.
  Testlerde X-Twilio-Signature header'ı gönderilir ancak doğrulama mock'lanır.
"""

from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.message import PendingWhatsapp, WhatsappMesaji
from app.models.site import Santiye
from app.models.tenant import Musteri

# Webhook endpoint'i Twilio imzası doğruluyor; test ortamında bypass için mock
FAKE_SIGNATURE = "test-signature-bypass"


def _twilio_form(from_no: str, body: str = "Test mesaj") -> dict[str, str]:
    """Twilio'nun gönderdiği form verisini simüle eder."""
    return {
        "From": f"whatsapp:{from_no}",
        "Body": body,
        "To": "whatsapp:+14155238886",
        "MessageSid": "SMtest12345",
    }


async def _post_webhook(
    client: AsyncClient,
    form_data: dict[str, str],
) -> "httpx.Response":  # type: ignore[name-defined]
    """Twilio imzasını mock'layarak webhook POST isteği gönderir."""
    headers = {"X-Twilio-Signature": FAKE_SIGNATURE}
    return await client.post(
        "/api/v1/webhook/whatsapp",
        data=form_data,
        headers=headers,
    )


# ---------------------------------------------------------------------------
# Bilinmeyen numara testi
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_webhook_unknown_number(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """Bilinmeyen numaradan gelen webhook:
    - TwiML yanıt döndürmeli (bilinmeyen numara mesajı içermeli)
    - pending_whatsapp tablosuna kayıt oluşturulmalı
    """
    unknown_no = "+905550000001"

    with patch(
        "app.api.v1.webhook._verify_twilio_signature",
        new_callable=AsyncMock,
        return_value=_twilio_form(unknown_no, "Merhaba, rapor göndereceğim"),
    ):
        r = await _post_webhook(client, _twilio_form(unknown_no))

    assert r.status_code == 200, r.text
    body = r.text
    assert "Numaraniz" in body or "kayitli" in body or "Response" in body

    # pending_whatsapp kaydı oluşturuldu mu?
    stmt = select(PendingWhatsapp).where(
        PendingWhatsapp.whatsapp_numara == unknown_no
    )
    result = await db_session.execute(stmt)
    pending = result.scalar_one_or_none()
    assert pending is not None, "PendingWhatsapp kaydı oluşturulmalıydı"
    assert pending.islendi is False


@pytest.mark.asyncio
async def test_webhook_unknown_number_duplicate(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    """Aynı bilinmeyen numaradan iki kez mesaj gelirse pending kaydı tekrarlanmamalı."""
    unknown_no = "+905550000002"
    form = _twilio_form(unknown_no, "İlk mesaj")

    with patch(
        "app.api.v1.webhook._verify_twilio_signature",
        new_callable=AsyncMock,
        return_value=form,
    ):
        r1 = await _post_webhook(client, form)
        assert r1.status_code == 200

    # İkinci mesaj — aynı numara
    with patch(
        "app.api.v1.webhook._verify_twilio_signature",
        new_callable=AsyncMock,
        return_value=_twilio_form(unknown_no, "İkinci mesaj"),
    ):
        r2 = await _post_webhook(client, _twilio_form(unknown_no, "İkinci mesaj"))
        assert r2.status_code == 200

    # Sadece 1 pending kaydı olmalı
    stmt = select(PendingWhatsapp).where(
        PendingWhatsapp.whatsapp_numara == unknown_no
    )
    result = await db_session.execute(stmt)
    records = result.scalars().all()
    assert len(records) == 1, "Aynı numara için yalnızca 1 pending kaydı olmalı"


# ---------------------------------------------------------------------------
# Kayıtlı numara testi
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_webhook_known_number(
    client: AsyncClient,
    db_session: AsyncSession,
    test_musteri: Musteri,
) -> None:
    """Kayıtlı numaradan gelen webhook:
    - Boş TwiML (<Response/>) dönmeli
    - whatsapp_mesajlari tablosuna kayıt oluşturulmalı
    """
    known_no = "+905551234500"

    # Şantiyeyi DB'ye ekle
    santiye = Santiye(
        musteri_id=test_musteri.id,
        isim="Webhook Test Şantiyesi",
        whatsapp_numara=known_no,
        aktif=True,
    )
    db_session.add(santiye)
    await db_session.flush()

    mesaj_metni = "Bugün 10 işçi çalıştı."
    form = _twilio_form(known_no, mesaj_metni)

    with patch(
        "app.api.v1.webhook._verify_twilio_signature",
        new_callable=AsyncMock,
        return_value=form,
    ):
        r = await _post_webhook(client, form)

    assert r.status_code == 200, r.text
    # Boş TwiML döndürmeli
    assert "<Response/>" in r.text or r.text.strip() == "<Response/>"

    # Mesaj kaydedildi mi?
    stmt = select(WhatsappMesaji).where(
        WhatsappMesaji.santiye_id == santiye.id
    )
    result = await db_session.execute(stmt)
    mesaj = result.scalar_one_or_none()
    assert mesaj is not None, "WhatsappMesaji kaydı oluşturulmalıydı"
    assert mesaj.icerik == mesaj_metni
    assert mesaj.gonderen_no == known_no
    assert mesaj.islendi is False


@pytest.mark.asyncio
async def test_webhook_known_number_saves_multiple_messages(
    client: AsyncClient,
    db_session: AsyncSession,
    test_musteri: Musteri,
) -> None:
    """Kayıtlı numaradan birden fazla mesaj gelince her biri kaydedilmeli."""
    known_no = "+905551234501"

    santiye = Santiye(
        musteri_id=test_musteri.id,
        isim="Çoklu Mesaj Şantiyesi",
        whatsapp_numara=known_no,
        aktif=True,
    )
    db_session.add(santiye)
    await db_session.flush()

    for i in range(3):
        form = _twilio_form(known_no, f"Mesaj {i + 1}")
        with patch(
            "app.api.v1.webhook._verify_twilio_signature",
            new_callable=AsyncMock,
            return_value=form,
        ):
            r = await _post_webhook(client, form)
        assert r.status_code == 200

    stmt = select(WhatsappMesaji).where(WhatsappMesaji.santiye_id == santiye.id)
    result = await db_session.execute(stmt)
    mesajlar = result.scalars().all()
    assert len(mesajlar) == 3


@pytest.mark.asyncio
async def test_webhook_missing_from_field(client: AsyncClient) -> None:
    """'From' alanı olmayan webhook isteği → 400 dönmeli."""
    form_without_from = {"Body": "test", "To": "whatsapp:+14155238886"}

    with patch(
        "app.api.v1.webhook._verify_twilio_signature",
        new_callable=AsyncMock,
        return_value=form_without_from,
    ):
        r = await client.post(
            "/api/v1/webhook/whatsapp",
            data=form_without_from,
            headers={"X-Twilio-Signature": FAKE_SIGNATURE},
        )

    assert r.status_code == 400, r.text


@pytest.mark.asyncio
async def test_webhook_get_challenge(client: AsyncClient) -> None:
    """GET /api/v1/webhook/whatsapp doğrulama challenge'ı → 200 dönmeli."""
    r = await client.get("/api/v1/webhook/whatsapp")
    assert r.status_code == 200, r.text
    assert r.json().get("status") == "ok"
