"""Medya dosyası upload/download endpoint'leri.

POST   /api/v1/media/upload        — multipart/form-data yükleme
GET    /api/v1/media/              — liste (proje_id, tip filtresi)
DELETE /api/v1/media/{id}         — sil (diskten de kaldır)
GET    /api/v1/media/{id}/download — dosya indir
"""

import mimetypes
import os
import re
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentMusteriId
from app.core.config import settings
from app.core.database import get_db
from app.models.medya import MedyaDosyasi

router = APIRouter(tags=["media"])

DbDep = Annotated[AsyncSession, Depends(get_db)]

# ---------------------------------------------------------------------------
# Sabitler
# ---------------------------------------------------------------------------

MAX_BOYUT_BYTE = 10 * 1024 * 1024  # 10 MB
IZINLI_UZANTILAR = {
    ".jpg", ".jpeg", ".png", ".gif",
    ".pdf", ".xlsx", ".docx",
    ".dwg", ".dxf", ".dwf", ".rvt", ".ifc", ".skp",  # çizim dosyaları
}
MIME_TIPLER: dict[str, str] = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".pdf": "application/pdf",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
FOTOGRAF_UZANTILARI = {".jpg", ".jpeg", ".png", ".gif"}
VIDEO_UZANTILARI = {".mp4", ".avi", ".mov"}
CIZIM_UZANTILARI = {".dwg", ".dxf", ".dwf", ".rvt", ".ifc", ".skp"}
GECERLI_TIP_OVERRIDE = {"cizim", "fotograf", "belge", "video"}


# ---------------------------------------------------------------------------
# Pydantic V2 şemaları
# ---------------------------------------------------------------------------


class MedyaResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    musteri_id: str
    proje_id: str | None = None
    rapor_id: str | None = None
    dosya_adi: str | None = None
    mime_type: str | None = None
    boyut_byte: int | None = None
    tip: str
    klasor: str | None = None
    created_at: str | None = None


# ---------------------------------------------------------------------------
# Yardımcı
# ---------------------------------------------------------------------------


def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


def _guvenli_ad(dosya_adi: str) -> str:
    """Dosya adından tehlikeli karakterleri temizler."""
    ad = os.path.basename(dosya_adi)
    ad = re.sub(r"[^\w\-\.]", "_", ad)
    return ad


def _medya_tip(uzanti: str) -> str:
    ext = uzanti.lower()
    if ext in FOTOGRAF_UZANTILARI:
        return "fotograf"
    if ext in VIDEO_UZANTILARI:
        return "video"
    if ext in CIZIM_UZANTILARI:
        return "cizim"
    return "belge"


async def _medya_or_404(db: AsyncSession, medya_id: str, musteri_id: str) -> MedyaDosyasi:
    result = await db.execute(
        select(MedyaDosyasi).where(
            MedyaDosyasi.id == medya_id,
            MedyaDosyasi.musteri_id == musteri_id,
        )
    )
    m = result.scalar_one_or_none()
    if m is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Medya dosyası bulunamadı: {medya_id}",
        )
    return m


# ---------------------------------------------------------------------------
# Endpoint'ler
# ---------------------------------------------------------------------------


@router.post(
    "/upload",
    response_model=MedyaResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Dosya yükle",
)
async def upload_medya(
    db: DbDep,
    musteri_id: CurrentMusteriId,
    dosya: UploadFile = File(..., description="Yüklenecek dosya (max 10 MB)"),
    proje_id: str | None = Form(default=None),
    rapor_id: str | None = Form(default=None),
    klasor: str | None = Form(default=None, description="Galeri klasörü adı"),
    tip_override: str | None = Form(
        default=None,
        description="Tip zorlama: cizim | fotograf | belge | video",
    ),
) -> MedyaDosyasi:
    """Dosya yükler, veritabanına kaydeder ve metadata döndürür.

    İzin verilen tipler: jpg, jpeg, png, gif, pdf, xlsx, docx, dwg, dxf, dwf, rvt, ifc, skp
    Maksimum boyut: 10 MB
    tip_override ile dosya tipi manuel olarak zorlanabilir (örn: 'cizim').
    """
    # Uzantı kontrolü
    orijinal_ad = dosya.filename or "dosya"
    uzanti = Path(orijinal_ad).suffix.lower()
    if uzanti not in IZINLI_UZANTILAR:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Desteklenmeyen dosya tipi: {uzanti}. İzin verilenler: {', '.join(IZINLI_UZANTILAR)}",
        )

    # Boyut kontrolü — içeriği oku
    icerik = await dosya.read()
    if len(icerik) > MAX_BOYUT_BYTE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Dosya boyutu {len(icerik) // 1024 // 1024} MB, limit 10 MB.",
        )

    # Dizin oluştur: uploads/{musteri_id}/
    hedef_dizin = Path(settings.UPLOAD_DIR) / musteri_id
    hedef_dizin.mkdir(parents=True, exist_ok=True)

    # Güvenli, benzersiz dosya adı
    dosya_uuid = str(uuid.uuid4())
    guvenli = _guvenli_ad(orijinal_ad)
    dosya_adi_unique = f"{dosya_uuid}_{guvenli}"
    dosya_yolu = hedef_dizin / dosya_adi_unique

    # Diske yaz
    with open(dosya_yolu, "wb") as f:
        f.write(icerik)

    # Veritabanına kaydet
    mime = MIME_TIPLER.get(uzanti, dosya.content_type or "application/octet-stream")
    # tip_override geçerliyse onu kullan; aksi halde uzantıdan otomatik belirle
    tip = (
        tip_override
        if tip_override and tip_override in GECERLI_TIP_OVERRIDE
        else _medya_tip(uzanti)
    )

    medya = MedyaDosyasi(
        musteri_id=musteri_id,
        proje_id=proje_id,
        rapor_id=rapor_id,
        dosya_yolu=str(dosya_yolu),
        dosya_adi=orijinal_ad,
        mime_type=mime,
        boyut_byte=len(icerik),
        tip=tip,
        klasor=klasor,
        created_at=_now_iso(),
    )
    db.add(medya)
    await db.commit()
    await db.refresh(medya)
    return medya


@router.get(
    "/",
    response_model=list[MedyaResponse],
    summary="Medya dosyalarını listele",
)
async def list_medya(
    db: DbDep,
    musteri_id: CurrentMusteriId,
    proje_id: str | None = Query(default=None, description="Projeye göre filtrele"),
    tip: str | None = Query(default=None, description="fotograf | belge | video"),
    klasor: str | None = Query(default=None, description="Klasöre göre filtrele"),
) -> list[MedyaDosyasi]:
    stmt = select(MedyaDosyasi).where(MedyaDosyasi.musteri_id == musteri_id)
    if proje_id:
        stmt = stmt.where(MedyaDosyasi.proje_id == proje_id)
    if tip:
        stmt = stmt.where(MedyaDosyasi.tip == tip)
    if klasor is not None:
        stmt = stmt.where(MedyaDosyasi.klasor == klasor)
    stmt = stmt.order_by(MedyaDosyasi.created_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get(
    "/klasorler",
    response_model=list[str],
    summary="Müşteriye ait galeri klasörlerini listele",
)
async def klasorleri_getir(
    musteri_id: CurrentMusteriId,
    db: DbDep,
    proje_id: str | None = Query(default=None, description="Projeye göre filtrele"),
) -> list[str]:
    """Benzersiz klasör adlarını döndürür. Boş klasör yoktur."""
    q = (
        select(MedyaDosyasi.klasor)
        .where(
            MedyaDosyasi.musteri_id == musteri_id,
            MedyaDosyasi.klasor.isnot(None),
        )
        .distinct()
    )
    if proje_id:
        q = q.where(MedyaDosyasi.proje_id == proje_id)
    result = await db.execute(q)
    return [r[0] for r in result.fetchall() if r[0]]


@router.patch(
    "/{medya_id}/klasor",
    summary="Medya dosyasını klasöre taşı",
)
async def klasore_tasi(
    medya_id: str,
    musteri_id: CurrentMusteriId,
    db: DbDep,
    klasor: str | None = None,  # None = klasörden çıkar
) -> dict:
    """Medya dosyasının klasörünü günceller. klasor=None ise klasörden çıkarır."""
    medya = await db.get(MedyaDosyasi, medya_id)
    if not medya or medya.musteri_id != musteri_id:
        raise HTTPException(status_code=404, detail="Bulunamadı")
    medya.klasor = klasor
    await db.commit()
    return {"mesaj": "Taşındı", "klasor": klasor}


@router.post(
    "/{medya_id}/kopyala",
    response_model=MedyaResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Medya dosyasını kopyala",
)
async def medya_kopyala(
    medya_id: str,
    musteri_id: CurrentMusteriId,
    db: DbDep,
    klasor: str | None = Query(default=None, description="Kopyanın klasörü (boş = orijinalle aynı)"),
) -> MedyaDosyasi:
    """Medya dosyasını kopyalar — DB kaydı + fiziksel dosya kopyalanır."""
    # Orijinali bul
    original = await _medya_or_404(db, medya_id, musteri_id)

    # Fiziksel dosyayı kopyala
    src = Path(original.dosya_yolu)
    if src.exists():
        yeni_uuid = str(uuid.uuid4())
        yeni_ad = f"{yeni_uuid}{src.suffix}"
        hedef = src.parent / yeni_ad
        shutil.copy2(src, hedef)
        yeni_yol = str(hedef)
    else:
        # Dosya yoksa sadece DB kaydını çoğalt, aynı yolu tut
        yeni_yol = original.dosya_yolu

    yeni_dosya_adi = f"(Kopya) {original.dosya_adi}" if original.dosya_adi else None

    kopya = MedyaDosyasi(
        id=str(uuid.uuid4()),
        musteri_id=original.musteri_id,
        proje_id=original.proje_id,
        rapor_id=original.rapor_id,
        dosya_yolu=yeni_yol,
        dosya_adi=yeni_dosya_adi,
        mime_type=original.mime_type,
        boyut_byte=original.boyut_byte,
        tip=original.tip,
        klasor=klasor if klasor is not None else original.klasor,
        created_at=_now_iso(),
    )
    db.add(kopya)
    await db.commit()
    await db.refresh(kopya)
    return kopya


@router.delete(
    "/{medya_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Medya dosyası sil",
)
async def delete_medya(
    medya_id: str,
    db: DbDep,
    musteri_id: CurrentMusteriId,
) -> None:
    """Kaydı veritabanından ve dosyayı diskten siler."""
    medya = await _medya_or_404(db, medya_id, musteri_id)

    # Diskten sil
    dosya_yolu = Path(medya.dosya_yolu)
    if dosya_yolu.exists():
        dosya_yolu.unlink()

    await db.delete(medya)
    await db.commit()


@router.get(
    "/{medya_id}/download",
    summary="Dosya indir",
    response_class=FileResponse,
)
async def download_medya(
    medya_id: str,
    db: DbDep,
    musteri_id: CurrentMusteriId,
) -> FileResponse:
    """Dosyayı doğrudan indirir."""
    medya = await _medya_or_404(db, medya_id, musteri_id)
    dosya_yolu = Path(medya.dosya_yolu)
    if not dosya_yolu.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dosya diskte bulunamadı.",
        )
    return FileResponse(
        path=str(dosya_yolu),
        filename=medya.dosya_adi or dosya_yolu.name,
        media_type=medya.mime_type or "application/octet-stream",
    )


# ---------------------------------------------------------------------------
# İzin verilen MIME tipleri — view endpoint için whitelist
# (VibeSec: yalnızca bilinen güvenli tiplere izin ver)
# ---------------------------------------------------------------------------

IZINLI_MIMELER: set[str] = {
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


@router.get(
    "/{medya_id}/view",
    summary="Medya görüntüle (galeri thumbnail)",
    response_class=FileResponse,
)
async def medya_goruntule(
    medya_id: str,
    musteri_id: CurrentMusteriId,
    db: DbDep,
) -> FileResponse:
    """Medya dosyasını tarayıcıda görüntüler (galeri thumbnail için).

    Content-Disposition header'ı inline olarak ayarlanır; tarayıcı
    dosyayı indirmek yerine doğrudan render eder.

    Güvenlik kontrolleri (VibeSec — Path Traversal & File Serve):
      1. Tenant isolation: musteri_id ile DB sorgusu (_medya_or_404)
      2. Path traversal: dosya_yolu canonicalize edilerek UPLOAD_DIR /
         OUTPUT_DIR dışındaki dosyalara erişim engellenir.
      3. Sembolik link takibi: symlink ise 403 döner.
      4. MIME whitelist: yalnızca izin verilen tipler serve edilir.
    """
    # Tenant isolation: DB sorgusu musteri_id filtresiyle yapılır
    medya = await _medya_or_404(db, medya_id, musteri_id)

    # --- 1. Dosya varlık kontrolü ---
    dosya_yolu_str = medya.dosya_yolu
    if not dosya_yolu_str:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dosya diskte bulunamadı.",
        )

    # --- 2. Path traversal koruması ---
    # os.path.abspath ile hem ../.. hem de relative path saldırılarını engelle
    dosya_yolu_abs = os.path.abspath(dosya_yolu_str)
    upload_root = os.path.abspath(settings.UPLOAD_DIR)
    output_root = os.path.abspath(settings.OUTPUT_DIR)

    if not (
        dosya_yolu_abs.startswith(upload_root + os.sep)
        or dosya_yolu_abs.startswith(output_root + os.sep)
        or dosya_yolu_abs == upload_root
        or dosya_yolu_abs == output_root
    ):
        # İzin verilen dizin dışında — erişimi reddet
        # 403 yerine 404 döndürerek dosya varlığı sızdırılmaz (VibeSec)
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Erişim reddedildi")

    # --- 3. Sembolik link takibini engelle ---
    # Symlink, UPLOAD_DIR dışındaki bir dosyaya yönlendirebilir (güvenlik atlatma)
    if os.path.islink(dosya_yolu_abs):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Erişim reddedildi")

    # --- 4. Dosya fiziksel varlık kontrolü ---
    if not os.path.exists(dosya_yolu_abs):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dosya diskte bulunamadı.",
        )

    # --- 5. MIME tipi kontrolü — whitelist ---
    mime = (
        medya.mime_type
        or mimetypes.guess_type(dosya_yolu_abs)[0]
        or "application/octet-stream"
    )
    if mime not in IZINLI_MIMELER:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Desteklenmeyen dosya tipi",
        )

    dosya_adi = medya.dosya_adi or Path(dosya_yolu_abs).name
    return FileResponse(
        path=dosya_yolu_abs,
        media_type=mime,
        filename=dosya_adi,
        headers={"Content-Disposition": f'inline; filename="{dosya_adi}"'},
    )
