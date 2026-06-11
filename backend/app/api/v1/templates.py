"""Şablon yönetimi endpoint'leri.

POST   /api/v1/templates/upload         — yeni şablon yükle
GET    /api/v1/templates/{musteri_id}   — müşteri şablonlarını listele
DELETE /api/v1/templates/{template_id} — şablon sil
"""

import os
import re
import unicodedata
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentMusteriId
from app.core.config import settings
from app.core.database import get_db
from app.models.site import Sablon
from app.services.template_parser import parse_docx_fields, parse_xlsx_fields

router = APIRouter(prefix="/templates", tags=["templates"])

DbDep = Annotated[AsyncSession, Depends(get_db)]

_ALLOWED_EXTENSIONS = {".xlsx", ".docx"}

# Dosya boyutu limiti: 10 MB
_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

# ZIP magic bytes — OOXML (xlsx/docx) ZIP tabanlı formattır
_MAGIC_ZIP = b"PK\x03\x04"


def _check_magic_bytes(content: bytes, ext: str) -> bool:
    """Dosya içeriğinin gerçek formatını magic bytes ile doğrular.

    xlsx ve docx her ikisi de ZIP (OOXML) tabanlıdır; ilk 4 byte PK\\x03\\x04 olmalıdır.
    Sadece uzantıya güvenmek MIME-spoofing saldırısına açıktır.
    """
    if ext in {".xlsx", ".docx"}:
        return content[:4] == _MAGIC_ZIP
    return False


def _sanitize_filename(filename: str) -> str:
    """Dosya adını güvenli hale getirir.

    - Türkçe / Unicode karakterleri ASCII'ye dönüştürür (NFKD normalize).
    - Boşlukları alt çizgiye çevirir.
    - Alfanümerik, nokta, tire ve alt çizgi dışındaki karakterleri siler.
    - Path traversal karakterlerini (/, \\, ..) engeller.
    """
    # Unicode normalize: ş→s, ç→c, ğ→g vb.
    normalized = unicodedata.normalize("NFKD", filename)
    ascii_name = normalized.encode("ascii", "ignore").decode("ascii")
    # Boşluk → alt çizgi
    ascii_name = ascii_name.replace(" ", "_")
    # İzin verilmeyen karakterleri kaldır
    ascii_name = re.sub(r"[^A-Za-z0-9_.\-]", "", ascii_name)
    # Birden fazla noktayı ve path traversal'ı önle
    ascii_name = re.sub(r"\.{2,}", ".", ascii_name)
    # Başta/sonda nokta veya alt çizgi olmasın
    ascii_name = ascii_name.strip("._")
    return ascii_name or "dosya"


# ---------------------------------------------------------------------------
# Pydantic response modelleri
# ---------------------------------------------------------------------------


class SablonResponse(BaseModel):
    """Şablon kaydının API temsili."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    musteri_id: str
    santiye_id: str | None
    isim: str
    format: str
    dosya_yolu: str
    alan_esleme: dict  # type: ignore[type-arg]
    tip: str | None
    aktif: bool


# ---------------------------------------------------------------------------
# Yardımcı fonksiyonlar
# ---------------------------------------------------------------------------


def _ensure_upload_dir(musteri_id: str) -> str:
    """Müşteriye özel upload dizinini oluşturur ve yolunu döndürür."""
    dir_path = os.path.join(settings.UPLOAD_DIR, musteri_id)
    os.makedirs(dir_path, exist_ok=True)
    return dir_path


async def _parse_fields(
    dosya_yolu: str,
    fmt: str,
) -> dict:  # type: ignore[type-arg]
    """Dosya formatına göre alan eşlemesini döndürür.

    xlsx → {"B3": "tarih", ...}
    docx → {"tarih": "tarih", ...}  (alan adı hem anahtar hem değer)
    """
    if fmt == "xlsx":
        return parse_xlsx_fields(dosya_yolu)
    # docx: liste → dict (alan_adi: alan_adi)
    fields = parse_docx_fields(dosya_yolu)
    return {f: f for f in fields}


# ---------------------------------------------------------------------------
# Endpoint'ler
# ---------------------------------------------------------------------------


@router.post(
    "/upload",
    response_model=SablonResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Yeni şablon yükle",
)
async def upload_template(
    db: DbDep,
    musteri_id: CurrentMusteriId,
    isim: Annotated[str, Form(...)],
    dosya: Annotated[UploadFile, File(...)],
    santiye_id: Annotated[str | None, Form()] = None,
    tip: Annotated[str, Form()] = "gunluk_rapor",
) -> SablonResponse:
    """Multipart form ile .xlsx veya .docx şablon yükler.

    - Dosyayı UPLOAD_DIR/{musteri_id}/ klasörüne kaydeder.
    - {{ }} yer tutucularını parse eder.
    - Sablon kaydını veritabanına ekler.
    """
    if not dosya.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dosya adı boş olamaz.",
        )

    _, ext = os.path.splitext(dosya.filename.lower())
    if ext not in _ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Desteklenmeyen dosya formatı: {ext}. İzin verilenler: {sorted(_ALLOWED_EXTENSIONS)}",
        )

    fmt = ext.lstrip(".")  # "xlsx" veya "docx"

    # Dosyayı belleğe oku
    try:
        content = await dosya.read()
    except OSError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Dosya okunamadı: {exc}",
        ) from exc

    # Boyut kontrolü: 10 MB limitini aş → reddet
    if len(content) > _MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Dosya boyutu {len(content) // (1024*1024)} MB, maksimum 10 MB.",
        )

    # Magic bytes kontrolü: gerçek dosya formatını doğrula (MIME spoofing önlemi)
    if not _check_magic_bytes(content, ext):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Dosya içeriği {ext} formatıyla uyuşmuyor. Lütfen geçerli bir {ext} dosyası yükleyin.",
        )

    # Güvenli dosya adı oluştur: Türkçe/unicode karakter ve path traversal koruması
    original_name = os.path.splitext(dosya.filename)[0]
    safe_name = _sanitize_filename(original_name)
    safe_filename = f"{safe_name}{ext}"

    # Kayıt dizini ve dosya yolu
    upload_dir = _ensure_upload_dir(musteri_id)
    dosya_yolu = os.path.join(upload_dir, safe_filename)

    # Path traversal son kontrol: yol upload dizini dışına çıkmamalı
    abs_upload_dir = os.path.abspath(upload_dir)
    abs_dosya_yolu = os.path.abspath(dosya_yolu)
    if not abs_dosya_yolu.startswith(abs_upload_dir + os.sep):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Geçersiz dosya adı.",
        )

    # Dosyayı diske yaz
    try:
        with open(dosya_yolu, "wb") as f:
            f.write(content)
    except OSError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Dosya kaydedilemedi: {exc}",
        ) from exc

    # Alan eşlemesini parse et
    try:
        alan_esleme = await _parse_fields(dosya_yolu, fmt)
    except (FileNotFoundError, ValueError) as exc:
        # Başarısız parse'ta yüklenen dosyayı temizle
        try:
            os.remove(dosya_yolu)
        except OSError:
            pass
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Şablon parse hatası: {exc}",
        ) from exc

    sablon = Sablon(
        musteri_id=musteri_id,
        santiye_id=santiye_id,
        isim=isim,
        format=fmt,
        dosya_yolu=dosya_yolu,
        alan_esleme=alan_esleme,
        tip=tip,
    )
    db.add(sablon)
    await db.commit()
    await db.refresh(sablon)

    return SablonResponse.model_validate(sablon)


@router.get(
    "/",
    response_model=list[SablonResponse],
    summary="Müşteri şablonlarını listele",
)
async def list_templates(
    db: DbDep,
    musteri_id: CurrentMusteriId,
    tip: str | None = None,
) -> list[SablonResponse]:
    """Token'daki tenant'a ait aktif şablonları döndürür.

    Query parametresi:
        tip: Opsiyonel şablon türü filtresi (gunluk_rapor, hakedis, isg, puantaj, aylik_ozet, diger)
    """
    conditions = [Sablon.musteri_id == musteri_id, Sablon.aktif.is_(True)]
    if tip is not None:
        conditions.append(Sablon.tip == tip)
    stmt = (
        select(Sablon)
        .where(*conditions)
        .order_by(Sablon.created_at.desc())
    )
    result = await db.execute(stmt)
    sablonlar = result.scalars().all()
    return [SablonResponse.model_validate(s) for s in sablonlar]


@router.delete(
    "/{template_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Şablon sil (soft-delete)",
)
async def delete_template(
    template_id: str,
    db: DbDep,
    musteri_id: CurrentMusteriId,
) -> None:
    """Şablonu aktif=False yaparak soft-delete uygular.

    Yalnızca token sahibinin tenant'ına ait şablonlar silinebilir.

    Raises:
        404: Şablon bulunamazsa veya başka bir tenant'a aitse.
    """
    stmt = select(Sablon).where(
        Sablon.id == template_id,
        Sablon.musteri_id == musteri_id,
    )
    result = await db.execute(stmt)
    sablon = result.scalar_one_or_none()

    if sablon is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Şablon bulunamadı: {template_id}",
        )

    sablon.aktif = False  # type: ignore[assignment]
    await db.commit()
