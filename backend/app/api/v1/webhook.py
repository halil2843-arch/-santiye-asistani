"""Twilio WhatsApp Webhook endpoint'leri.

POST /api/v1/webhook/whatsapp — gelen WhatsApp mesajlarını alır.
GET  /api/v1/webhook/whatsapp — Twilio doğrulama challenge'ı için.

Akış:
  1. Gelen `From` numarası `Santiye.whatsapp_numara` alanında aranır.
  2. Bulunursa: mesaj WhatsappMesaji tablosuna kaydedilir (mevcut akış).
  3. Bulunmazsa:
     - `PendingWhatsapp` tablosuna INSERT OR IGNORE yapılır (unique kısıtı).
     - TwiML ile kullanıcıya "numaranız kayıtlı değil" mesajı döndürülür.

Güvenlik: Her POST isteğinde X-Twilio-Signature header'ı,
twilio.request_validator.RequestValidator ile doğrulanır.
"""

from typing import Annotated
import logging

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentMusteriId
from app.core.config import settings
from app.core.database import get_db
from app.models.koordinator import Koordinator
from app.models.message import PendingWhatsapp, WhatsappMesaji
from app.models.site import Santiye

try:
    from twilio.request_validator import RequestValidator
    _TWILIO_AVAILABLE = True
except ImportError:  # pragma: no cover
    _TWILIO_AVAILABLE = False

router = APIRouter(prefix="/webhook", tags=["webhook"])
logger = logging.getLogger(__name__)

DbDep = Annotated[AsyncSession, Depends(get_db)]

# ---------------------------------------------------------------------------
# TwiML sabitleri
# ---------------------------------------------------------------------------

_TWIML_EMPTY = "<Response/>"
_TWIML_UNKNOWN_PHONE = (
    "<Response>"
    "<Message>Merhaba! Numaraniz henuz sisteme kayitli degil. "
    "Lutfen yoneticinize bildirin.</Message>"
    "</Response>"
)


# ---------------------------------------------------------------------------
# Twilio imza doğrulama
# ---------------------------------------------------------------------------

def _get_validator() -> "RequestValidator":
    """Twilio RequestValidator örneği döndürür."""
    if not _TWILIO_AVAILABLE:
        raise RuntimeError("twilio paketi kurulu değil.")
    from twilio.request_validator import RequestValidator as RV
    return RV(settings.TWILIO_AUTH_TOKEN)


def _build_twilio_url(request: Request) -> str:
    """İstek URL'ini Twilio'nun beklediği formata çevirir.

    Reverse-proxy arkasındaysa X-Forwarded-Proto header'ına göre
    protokolü günceller.
    """
    forwarded_proto = request.headers.get("x-forwarded-proto")
    url = str(request.url)
    if forwarded_proto:
        scheme, rest = url.split("://", 1)
        url = f"{forwarded_proto}://{rest}"
    return url


async def _verify_twilio_signature(
    request: Request,
    x_twilio_signature: str,
) -> dict[str, str]:
    """İmzayı doğrular; geçersizse 403 fırlatır.

    DEBUG=True ise veya TWILIO_AUTH_TOKEN ayarlanmamışsa imza kontrolü atlanır.
    """
    form_data = await request.form()
    params: dict[str, str] = {k: v for k, v in form_data.multi_items()}  # type: ignore[misc]

    if settings.DEBUG or not settings.TWILIO_AUTH_TOKEN or settings.TWILIO_AUTH_TOKEN == "...":
        return params

    validator = _get_validator()
    url = _build_twilio_url(request)
    valid = validator.validate(url, params, x_twilio_signature)

    if not valid:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Geçersiz Twilio imzası.",
        )

    return params


# ---------------------------------------------------------------------------
# Yardımcı: numaraya göre şantiye bul
# ---------------------------------------------------------------------------

async def _find_santiye_by_phone(db: AsyncSession, normalized_no: str) -> Santiye | None:
    from app.models.site import SantiyeNumara
    ek_stmt = (
        select(Santiye)
        .join(SantiyeNumara, SantiyeNumara.santiye_id == Santiye.id)
        .where(SantiyeNumara.numara == normalized_no, SantiyeNumara.aktif.is_(True))
    )
    santiye = (await db.execute(ek_stmt)).scalar_one_or_none()
    if santiye:
        return santiye
    result = await db.execute(select(Santiye).where(Santiye.whatsapp_numara == normalized_no))
    return result.scalar_one_or_none()


async def _find_koordinator_by_phone(db: AsyncSession, normalized_no: str) -> Koordinator | None:
    stmt = select(Koordinator).where(
        Koordinator.whatsapp_numara == normalized_no,
        Koordinator.aktif.is_(True),
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def _handle_koordinator_mesaji(
    db: AsyncSession,
    koordinator: Koordinator,
    gonderen_no: str,
    icerik: str,
    medya_url: str | None,
) -> int:
    """Koordinatör mesajını LLM ile şantiye bazında böler, her parçayı kaydeder.

    Returns:
        Kaydedilen mesaj sayısı.
    """
    from app.services.site_yonlendirici import yonlendir

    santiyeler_result = await db.execute(
        select(Santiye).where(Santiye.musteri_id == koordinator.musteri_id, Santiye.aktif.is_(True))
    )
    santiyeler = santiyeler_result.scalars().all()
    santiye_listesi = [{"id": s.id, "isim": s.isim} for s in santiyeler]

    parcalar = yonlendir(icerik, santiye_listesi)

    kaydedilen = 0
    for parca in parcalar:
        if not parca.get("santiye_id"):
            logger.warning(
                "Koordinatör mesajı tanımlanamadı (bilinmeyen şantiye). İçerik: %.80s",
                parca["icerik"],
            )
            continue

        mesaj = WhatsappMesaji(
            santiye_id=parca["santiye_id"],
            gonderen_no=gonderen_no,
            icerik=parca["icerik"],
            medya_url=medya_url,
            islendi=False,
        )
        db.add(mesaj)
        kaydedilen += 1

    await db.commit()
    logger.info(
        "Koordinatör mesajı %d şantiyeye dağıtıldı (koordinatör: %s).",
        kaydedilen, gonderen_no,
    )
    return kaydedilen


# ---------------------------------------------------------------------------
# Yardımcı: PendingWhatsapp'a kayıt ekle (duplicate silently ignored)
# ---------------------------------------------------------------------------

async def _upsert_pending(db: AsyncSession, whatsapp_numara: str, ilk_mesaj: str | None) -> None:
    """Numarayı pending tablosuna ekler.

    Daha önce aynı numara varsa (unique constraint) sessizce geçer;
    ilk_mesaj_metni'ni güncellemez — ilk temas tarihini koruruz.
    """
    stmt = select(PendingWhatsapp).where(PendingWhatsapp.whatsapp_numara == whatsapp_numara)
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    if existing:
        # Zaten kayıtlı; tekrar kaydetme
        logger.debug("Pending numara zaten kayıtlı: %s", whatsapp_numara)
        return

    pending = PendingWhatsapp(
        whatsapp_numara=whatsapp_numara,
        ilk_mesaj_metni=ilk_mesaj,
        islendi=False,
    )
    db.add(pending)
    try:
        await db.commit()
    except IntegrityError:
        # Race condition: başka bir istek aynı anda eklemiş
        await db.rollback()
        logger.warning("PendingWhatsapp race-condition yakalandı: %s", whatsapp_numara)


# ---------------------------------------------------------------------------
# Endpoint'ler
# ---------------------------------------------------------------------------

class MesajResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    santiye_id: str
    rapor_id: str | None
    gonderen_no: str
    icerik: str | None
    medya_url: str | None
    islendi: bool
    created_at: str

    @classmethod
    def from_orm_custom(cls, m: WhatsappMesaji) -> "MesajResponse":
        return cls(
            id=m.id,
            santiye_id=m.santiye_id,
            rapor_id=m.rapor_id,
            gonderen_no=m.gonderen_no,
            icerik=m.icerik,
            medya_url=m.medya_url,
            islendi=m.islendi,
            created_at=m.created_at.isoformat() if m.created_at else "",
        )


@router.get("/whatsapp", status_code=status.HTTP_200_OK)
async def webhook_challenge() -> dict[str, str]:
    """Twilio webhook doğrulama challenge endpoint'i."""
    return {"status": "ok"}


@router.get(
    "/messages/{santiye_id}",
    response_model=list[MesajResponse],
    summary="Şantiyeye ait WhatsApp mesajlarını listele",
)
async def list_messages(
    santiye_id: str,
    db: DbDep,
    musteri_id: CurrentMusteriId,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> list[MesajResponse]:
    """Şantiyenin son mesajlarını döndürür (tenant-isolated)."""
    stmt = select(Santiye).where(
        Santiye.id == santiye_id,
        Santiye.musteri_id == musteri_id,
    )
    santiye = (await db.execute(stmt)).scalar_one_or_none()
    if santiye is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Şantiye bulunamadı")

    msg_stmt = (
        select(WhatsappMesaji)
        .where(WhatsappMesaji.santiye_id == santiye_id)
        .order_by(WhatsappMesaji.created_at.desc())
        .limit(limit)
    )
    result = await db.execute(msg_stmt)
    mesajlar = result.scalars().all()
    return [MesajResponse.from_orm_custom(m) for m in mesajlar]


@router.post("/whatsapp", status_code=status.HTTP_200_OK)
async def receive_whatsapp(
    request: Request,
    db: DbDep,
    x_twilio_signature: str = Header(default="", alias="X-Twilio-Signature"),
) -> str:
    """Twilio'dan gelen WhatsApp mesajını işler.

    Tanınan numara → mesajı kaydet, boş TwiML dön.
    Bilinmeyen numara → PendingWhatsapp'a ekle, açıklayıcı TwiML dön.
    """
    params = await _verify_twilio_signature(request, x_twilio_signature)

    gonderen_no: str = params.get("From", "")
    icerik: str | None = params.get("Body") or None
    # Twilio MediaUrl0..N → hepsini yeni satırla birleştirerek sakla
    medya_urllar = [
        params[f"MediaUrl{i}"]
        for i in range(10)
        if params.get(f"MediaUrl{i}")
    ]
    medya_url: str | None = "\n".join(medya_urllar) if medya_urllar else None

    if not gonderen_no:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="'From' alanı eksik.",
        )

    # Twilio numaraları "whatsapp:+905..." formatında gelir; normalize et
    normalized_no = gonderen_no.replace("whatsapp:", "").strip()

    # --- Santiyeyi whatsapp_numara alanından ara ---
    santiye = await _find_santiye_by_phone(db, normalized_no)

    if santiye is None:
        # Koordinatör mü kontrol et
        koordinator = await _find_koordinator_by_phone(db, normalized_no)
        if koordinator:
            if icerik:
                await _handle_koordinator_mesaji(db, koordinator, normalized_no, icerik, medya_url)
            else:
                logger.info("Koordinatörden medya mesajı geldi, metin yok: %s", normalized_no)
            return _TWIML_EMPTY

        # Bilinmeyen numara: pending tablosuna ekle, kullanıcıyı bilgilendir
        logger.info("Bilinmeyen WhatsApp numarası, pending'e ekleniyor: %s", normalized_no)
        await _upsert_pending(db, normalized_no, icerik)
        return _TWIML_UNKNOWN_PHONE

    # Tanınan numara: mesajı kaydet
    mesaj = WhatsappMesaji(
        santiye_id=santiye.id,
        gonderen_no=normalized_no,
        icerik=icerik,
        medya_url=medya_url,
        islendi=False,
    )
    db.add(mesaj)
    await db.commit()
    logger.info(
        "Mesaj kaydedildi — santiye: %s (%s), numara: %s",
        santiye.isim,
        santiye.id,
        normalized_no,
    )

    return _TWIML_EMPTY
