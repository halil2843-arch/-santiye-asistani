"""E2E test scripti — Şantiye Asistanı tam senaryo testi.

Çalıştırmak için (backend dizininden):
    python -m tests.e2e_test

ya da doğrudan:
    python tests/e2e_test.py

Senaryo:
  1. Musteri kaydı (register)
  2. Login => token al
  3. Santiye olustur
  4. Bilinmeyen numaradan webhook simulasyonu => pending_whatsapp kontrolu
  5. Numarayi santiyeye bagla
  6. Kayitli numaradan tekrar webhook => mesaj kaydedildi mi kontrol
  7. Rapor olustur (generate) -- Gemini API mock'lanir
  8. Rapor listele

Tum adimlar asyncio.run() ile calisir; unittest kullanilmaz.
"""

from __future__ import annotations

import asyncio
import sys
import traceback
from unittest.mock import AsyncMock, patch
from datetime import date

from httpx import AsyncClient, ASGITransport
from sqlalchemy import select
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

# --- Proje kok dizinini sys.path'e ekle (script olarak calisirken) ---
import os
_backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

from app.core.database import Base, get_db
from app.main import app
from app.models.message import PendingWhatsapp, WhatsappMesaji
from app.services.schemas import ExtractionSonucu

# ---------------------------------------------------------------------------
# Test DB kurulumu
# ---------------------------------------------------------------------------

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)
TestSession = async_sessionmaker(
    test_engine, class_=AsyncSession, expire_on_commit=False
)


async def setup_db() -> None:
    import app.models  # noqa: F401
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def teardown_db() -> None:
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


# ---------------------------------------------------------------------------
# Client fabrikasi
# ---------------------------------------------------------------------------


def make_client(session: AsyncSession) -> AsyncClient:
    async def override_get_db():
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise

    app.dependency_overrides[get_db] = override_get_db
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test")


# ---------------------------------------------------------------------------
# Senaryo yardimcilari
# ---------------------------------------------------------------------------


def _ok(step: str, detail: str = "") -> None:
    suffix = f" -- {detail}" if detail else ""
    print(f"  [OK] {step}{suffix}")


def _fail(step: str, detail: str = "") -> None:
    suffix = f" -- {detail}" if detail else ""
    print(f"  [FAIL] {step}{suffix}")
    raise AssertionError(f"E2E adim basarisiz: {step}{suffix}")


def assert_status(resp, expected: int, step: str) -> None:
    if resp.status_code != expected:
        _fail(step, f"beklenen={expected} gelen={resp.status_code} body={resp.text[:300]}")
    _ok(step, f"HTTP {resp.status_code}")


# ---------------------------------------------------------------------------
# Ana E2E senaryosu
# ---------------------------------------------------------------------------


async def run_e2e() -> None:
    await setup_db()
    print("\n=== Santiye Asistani E2E Test Basliyor ===\n")

    async with TestSession() as session:
        client = make_client(session)

        async with client:
            # -----------------------------------------------------------
            # Adim 1: Musteri kaydi
            # -----------------------------------------------------------
            print("1. Musteri kaydi...")
            reg_payload = {
                "firma_adi": "E2E Test Firmasi",
                "firma_email": "e2e@firma.com",
                "ad_soyad": "E2E Kullanici",
                "email": "e2euser@firma.com",
                "sifre": "E2ETest123!",
            }
            r = await client.post("/api/v1/auth/register", json=reg_payload)
            assert_status(r, 201, "register")
            reg_data = r.json()
            musteri_id: str = reg_data["musteri_id"]

            # -----------------------------------------------------------
            # Adim 2: Login => token al
            # -----------------------------------------------------------
            print("2. Login ve token alma...")
            r = await client.post(
                "/api/v1/auth/login",
                json={"email": "e2euser@firma.com", "sifre": "E2ETest123!"},
            )
            assert_status(r, 200, "login")
            token = r.json()["access_token"]
            auth_headers = {"Authorization": f"Bearer {token}"}
            _ok("token alindi", token[:30] + "...")

            # -----------------------------------------------------------
            # Adim 3: Santiye olustur
            # -----------------------------------------------------------
            print("3. Santiye olusturma...")
            r = await client.post(
                "/api/v1/sites/",
                json={
                    "musteri_id": musteri_id,
                    "isim": "E2E Santiyesi",
                    "adres": "Istanbul, Kadikoy",
                },
            )
            assert_status(r, 201, "create_site")
            santiye_id: str = r.json()["id"]
            _ok("santiye id", santiye_id)

            # -----------------------------------------------------------
            # Adim 4: Bilinmeyen numaradan webhook
            # -----------------------------------------------------------
            print("4. Bilinmeyen numaradan webhook simulasyonu...")
            unknown_no = "+905550001234"
            form = {
                "From": f"whatsapp:{unknown_no}",
                "Body": "Merhaba, rapor gonderecegim",
                "To": "whatsapp:+14155238886",
                "MessageSid": "SM_e2e_test_001",
            }
            with patch(
                "app.api.v1.webhook._verify_twilio_signature",
                new_callable=AsyncMock,
                return_value=form,
            ):
                r = await client.post(
                    "/api/v1/webhook/whatsapp",
                    data=form,
                    headers={"X-Twilio-Signature": "e2e-fake-sig"},
                )
            assert_status(r, 200, "webhook_unknown")

            # pending_whatsapp kaydi kontrolu
            stmt = select(PendingWhatsapp).where(
                PendingWhatsapp.whatsapp_numara == unknown_no
            )
            result = await session.execute(stmt)
            pending = result.scalar_one_or_none()
            if pending is None:
                _fail("pending_whatsapp kaydi olusturulmaliydı")
            _ok("pending_whatsapp kaydi olusturuldu", f"id={pending.id}")

            # pending-phones endpoint kontrolu
            r = await client.get("/api/v1/sites/pending-phones")
            assert_status(r, 200, "list_pending_phones")
            phones = [p["whatsapp_numara"] for p in r.json()]
            assert unknown_no in phones, f"{unknown_no} pending listesinde yok"
            _ok("pending-phones listesi dogrulandi")

            # -----------------------------------------------------------
            # Adim 5: Numarayi santiyeye bagla
            # -----------------------------------------------------------
            print("5. Numarayi santiyeye baglama...")
            r = await client.post(
                f"/api/v1/sites/{santiye_id}/link-phone",
                json={"whatsapp_numara": unknown_no},
            )
            assert_status(r, 200, "link_phone")
            link_data = r.json()
            assert link_data["pending_islendi"] is True
            _ok("numara baglandi ve pending islendi=True yapildi")

            # -----------------------------------------------------------
            # Adim 6: Kayitli numaradan tekrar webhook
            # -----------------------------------------------------------
            print("6. Kayitli numaradan webhook mesaji...")
            mesaj_metni = "Bugun 15 isci calisti. 2 JCB, 3 Kamyon kullanildi."
            form2 = {
                "From": f"whatsapp:{unknown_no}",  # artik kayitli
                "Body": mesaj_metni,
                "To": "whatsapp:+14155238886",
                "MessageSid": "SM_e2e_test_002",
            }
            with patch(
                "app.api.v1.webhook._verify_twilio_signature",
                new_callable=AsyncMock,
                return_value=form2,
            ):
                r = await client.post(
                    "/api/v1/webhook/whatsapp",
                    data=form2,
                    headers={"X-Twilio-Signature": "e2e-fake-sig"},
                )
            assert_status(r, 200, "webhook_known")
            assert "<Response/>" in r.text, f"Bos TwiML beklendi, gelen: {r.text}"

            # Mesaj kaydedildi mi?
            stmt2 = select(WhatsappMesaji).where(
                WhatsappMesaji.gonderen_no == unknown_no
            )
            result2 = await session.execute(stmt2)
            mesaj = result2.scalar_one_or_none()
            if mesaj is None:
                _fail("WhatsappMesaji kaydedilmeli idi")
            assert mesaj.icerik == mesaj_metni
            _ok("mesaj kaydedildi", f"id={mesaj.id}")

            # -----------------------------------------------------------
            # Adim 7: Rapor olustur (Gemini mock'lanir)
            # -----------------------------------------------------------
            print("7. Rapor olusturma (Gemini mock)...")

            # rapor_servisi.uret_rapor tamamen mock'lanir
            with patch(
                "app.services.rapor_servisi.uret_rapor",
                new_callable=AsyncMock,
                return_value="/tmp/rapor_e2e_test.xlsx",
            ):
                r = await client.post(
                    "/api/v1/reports/generate",
                    json={
                        "santiye_id": santiye_id,
                        "sablon_id": "sablon-uuid-placeholder",
                        "tarih": str(date.today()),
                        "mesaj_ids": [],
                    },
                    headers=auth_headers,
                )
            assert_status(r, 201, "generate_report")
            rapor_id: str = r.json()["rapor_id"]
            _ok("rapor olusturuldu", f"id={rapor_id}")

            # -----------------------------------------------------------
            # Adim 8: Rapor listele
            # -----------------------------------------------------------
            print("8. Rapor listeleme...")
            r = await client.get(
                f"/api/v1/reports/{santiye_id}",
                headers=auth_headers,
            )
            assert_status(r, 200, "list_reports")
            raporlar = r.json()
            assert len(raporlar) >= 1, "En az 1 rapor listelenmeli"
            rapor_ids = [rp["id"] for rp in raporlar]
            assert rapor_id in rapor_ids, f"{rapor_id} rapor listesinde bulunamadi"
            _ok("rapor listesinde dogrulandi", f"{len(raporlar)} rapor")

    app.dependency_overrides.clear()
    await teardown_db()

    print("\n=== E2E Test TAMAMLANDI -- Tum adimlar basarili! ===\n")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


if __name__ == "__main__":
    try:
        asyncio.run(run_e2e())
    except AssertionError as exc:
        print(f"\n[E2E HATA] {exc}")
        traceback.print_exc()
        sys.exit(1)
    except Exception as exc:
        print(f"\n[E2E KRITIK HATA] {exc}")
        traceback.print_exc()
        sys.exit(1)
