"""Proje yönetimi endpoint'leri.

GET    /api/v1/projects/                      — tenant projelerini listele (durum filtresi)
POST   /api/v1/projects/                      — yeni proje oluştur
GET    /api/v1/projects/{id}                  — proje detayı
PATCH  /api/v1/projects/{id}                  — proje güncelle
DELETE /api/v1/projects/{id}                  — soft delete (durum=arsiv)
GET    /api/v1/projects/{id}/aktivite         — son 20 aktivite (sayfalı)
POST   /api/v1/projects/{id}/aktivite         — manuel aktivite kaydı
GET    /api/v1/projects/{id}/notlar           — proje notlarını listele
POST   /api/v1/projects/{id}/notlar           — proje notu oluştur
PATCH  /api/v1/projects/{id}/notlar/{not_id}  — proje notu güncelle
DELETE /api/v1/projects/{id}/notlar/{not_id}  — proje notu sil
POST   /api/v1/projects/{id}/milestone        — önemli tarih ekle
GET    /api/v1/projects/{id}/milestones       — önemli tarihleri listele
PATCH  /api/v1/projects/{id}/milestones/{mid} — milestone güncelle
DELETE /api/v1/projects/{id}/milestones/{mid} — milestone sil
"""

import json
from datetime import date, datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentMusteriId, CurrentUser
from app.core.database import get_db
from app.models.proje import Proje, ProjeDurum
from app.models.aktivite import Aktivite
from app.models.site import Santiye
from app.models.proje_not import ProjeNot

router = APIRouter(tags=["projects"])

DbDep = Annotated[AsyncSession, Depends(get_db)]


# ---------------------------------------------------------------------------
# Pydantic V2 şemaları
# ---------------------------------------------------------------------------


class ProjeCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    santiye_id: str | None = Field(default=None, description="Bağlı şantiye UUID (opsiyonel)")
    isim: str = Field(..., min_length=1, max_length=200, description="Proje adı")
    tanim: str | None = Field(default=None)
    durum: ProjeDurum = Field(default=ProjeDurum.aktif)
    baslangic_tarihi: date | None = Field(default=None)
    bitis_tarihi: date | None = Field(default=None)
    il: str | None = Field(default=None, max_length=100)
    ilce: str | None = Field(default=None, max_length=100)
    enlem: float | None = None
    boylam: float | None = None
    proje_muduru: str | None = Field(default=None, max_length=200)
    butce: float | None = None
    ilerleme_yuzdesi: float = Field(default=0.0, ge=0.0, le=100.0)


class ProjeUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    santiye_id: str | None = None
    isim: str | None = Field(default=None, min_length=1, max_length=200)
    tanim: str | None = None
    durum: ProjeDurum | None = None
    baslangic_tarihi: date | None = None
    bitis_tarihi: date | None = None
    il: str | None = Field(default=None, max_length=100)
    ilce: str | None = Field(default=None, max_length=100)
    enlem: float | None = None
    boylam: float | None = None
    proje_muduru: str | None = Field(default=None, max_length=200)
    butce: float | None = None
    ilerleme_yuzdesi: float | None = Field(default=None, ge=0.0, le=100.0)


class ProjeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    musteri_id: str
    santiye_id: str | None = None
    isim: str
    tanim: str | None = None
    durum: ProjeDurum
    baslangic_tarihi: date | None = None
    bitis_tarihi: date | None = None
    il: str | None = None
    ilce: str | None = None
    enlem: float | None = None
    boylam: float | None = None
    proje_muduru: str | None = None
    butce: float | None = None
    ilerleme_yuzdesi: float
    created_at: str | None = None
    updated_at: str | None = None


# ---------------------------------------------------------------------------
# Yardımcı fonksiyonlar
# ---------------------------------------------------------------------------


def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat()


async def _get_or_404(db: AsyncSession, proje_id: str, musteri_id: str) -> Proje:
    """Projeyi tenant izolasyonuyla getirir; bulunamazsa 404 fırlatır."""
    result = await db.execute(
        select(Proje).where(Proje.id == proje_id, Proje.musteri_id == musteri_id)
    )
    proje: Proje | None = result.scalar_one_or_none()
    if proje is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Proje bulunamadı: {proje_id}",
        )
    return proje


# ---------------------------------------------------------------------------
# Endpoint'ler
# ---------------------------------------------------------------------------


@router.get(
    "/",
    response_model=list[ProjeResponse],
    summary="Tenant projelerini listele",
)
async def list_projeler(
    db: DbDep,
    musteri_id: CurrentMusteriId,
    durum: str | None = Query(
        default=None,
        description="Filtre: aktif | pasif | arsiv | hepsi (varsayılan: hepsi)",
    ),
) -> list[Proje]:
    """Kimliği doğrulanmış kullanıcının tenant'ına ait projeleri listeler.

    `durum` parametresi verilmezse ya da `hepsi` geçilirse tüm projeler döner.
    """
    stmt = select(Proje).where(Proje.musteri_id == musteri_id)
    if durum and durum != "hepsi":
        try:
            durum_enum = ProjeDurum(durum)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Geçersiz durum değeri: {durum}. Geçerli değerler: aktif, pasif, arsiv, hepsi",
            )
        stmt = stmt.where(Proje.durum == durum_enum)
    stmt = stmt.order_by(Proje.isim)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post(
    "/",
    response_model=ProjeResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Yeni proje oluştur",
)
async def create_proje(
    payload: ProjeCreate,
    db: DbDep,
    musteri_id: CurrentMusteriId,
) -> Proje:
    """Yeni bir proje kaydı oluşturur."""
    # Şantiye müşteriye ait mi doğrula (güvenlik: başka müşterinin şantiyesine bağlanma engeli)
    if payload.santiye_id:
        santiye = await db.get(Santiye, payload.santiye_id)
        if not santiye or santiye.musteri_id != musteri_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Geçersiz şantiye: bu şantiye size ait değil veya mevcut değil.",
            )
    now = _now_iso()
    proje = Proje(
        musteri_id=musteri_id,
        santiye_id=payload.santiye_id,
        isim=payload.isim,
        tanim=payload.tanim,
        durum=payload.durum,
        baslangic_tarihi=payload.baslangic_tarihi,
        bitis_tarihi=payload.bitis_tarihi,
        il=payload.il,
        ilce=payload.ilce,
        enlem=payload.enlem,
        boylam=payload.boylam,
        proje_muduru=payload.proje_muduru,
        butce=payload.butce,
        ilerleme_yuzdesi=payload.ilerleme_yuzdesi,
        created_at=now,
        updated_at=now,
    )
    db.add(proje)
    await db.commit()
    await db.refresh(proje)
    return proje


@router.get(
    "/{proje_id}",
    response_model=ProjeResponse,
    summary="Proje detayı",
)
async def get_proje(
    proje_id: str,
    db: DbDep,
    musteri_id: CurrentMusteriId,
) -> Proje:
    """Verilen ID'ye ait projeyi döndürür (tenant isolation uygulanır)."""
    proje = await _get_or_404(db, proje_id, musteri_id)
    return proje


@router.patch(
    "/{proje_id}",
    response_model=ProjeResponse,
    summary="Proje güncelle",
)
async def update_proje(
    proje_id: str,
    payload: ProjeUpdate,
    db: DbDep,
    musteri_id: CurrentMusteriId,
) -> Proje:
    """Projenin bir ya da birden fazla alanını günceller."""
    proje = await _get_or_404(db, proje_id, musteri_id)

    # santiye_id değiştiriliyorsa sahiplik kontrolü
    if "santiye_id" in payload.model_fields_set and payload.santiye_id is not None:
        santiye = await db.get(Santiye, payload.santiye_id)
        if not santiye or santiye.musteri_id != musteri_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Geçersiz şantiye: bu şantiye size ait değil veya mevcut değil.",
            )

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(proje, field, value)
    proje.updated_at = _now_iso()

    db.add(proje)
    await db.commit()
    await db.refresh(proje)
    return proje


@router.delete(
    "/{proje_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Projeyi arşivle (soft delete)",
)
async def delete_proje(
    proje_id: str,
    db: DbDep,
    musteri_id: CurrentMusteriId,
) -> None:
    """Projeyi gerçek anlamda silmez; durumunu `arsiv` olarak işaretler."""
    proje = await _get_or_404(db, proje_id, musteri_id)
    proje.durum = ProjeDurum.arsiv
    proje.updated_at = _now_iso()
    db.add(proje)
    await db.commit()


# ---------------------------------------------------------------------------
# Aktivite şemaları
# ---------------------------------------------------------------------------


class AktiviteCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    tip: str | None = Field(default=None, max_length=50)
    baslik: str = Field(..., min_length=1, max_length=300)
    aciklama: str | None = None
    renk: str = Field(default="blue", description="green | amber | red | blue")


class AktiviteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    proje_id: str
    musteri_id: str
    kullanici_id: str | None = None
    tip: str | None = None
    baslik: str | None = None
    aciklama: str | None = None
    renk: str
    created_at: str | None = None


# ---------------------------------------------------------------------------
# Aktivite endpoint'leri
# ---------------------------------------------------------------------------


@router.get(
    "/{proje_id}/aktivite",
    response_model=list[AktiviteResponse],
    summary="Proje aktivite feed",
)
async def list_aktivite(
    proje_id: str,
    db: DbDep,
    musteri_id: CurrentMusteriId,
    sayfa: int = Query(default=1, ge=1, description="Sayfa numarası"),
    boyut: int = Query(default=20, ge=1, le=100, description="Sayfa başı kayıt"),
) -> list[Aktivite]:
    """Projeye ait aktiviteleri sayfalı olarak döndürür (en yeni önce)."""
    await _get_or_404(db, proje_id, musteri_id)
    offset = (sayfa - 1) * boyut
    result = await db.execute(
        select(Aktivite)
        .where(Aktivite.proje_id == proje_id, Aktivite.musteri_id == musteri_id)
        .order_by(Aktivite.created_at.desc())
        .offset(offset)
        .limit(boyut)
    )
    return list(result.scalars().all())


@router.get(
    "/{proje_id}/istatistik",
    summary="Proje hero kartı istatistikleri",
)
async def proje_istatistik(
    proje_id: str,
    musteri_id: CurrentMusteriId,
    db: DbDep,
) -> dict:
    """Proje hero kartı için canlı istatistikler döndürür.

    Dönen alanlar:
    - toplam_personel_bugun: bugün devam eden personel sayısı
    - kritik_stok_sayisi: miktarı min_miktarın altındaki stok kalemleri
    - medya_sayisi: projeye yüklenen medya dosya sayısı
    - isg_acik_madde: açık durumdaki ISG kayıt sayısı
    - ilerleme_yuzdesi: proje ilerleme yüzdesi
    - proje_muduru, baslangic_tarihi, bitis_tarihi
    """
    proje = (await db.execute(
        select(Proje).where(Proje.id == proje_id, Proje.musteri_id == musteri_id)
    )).scalar_one_or_none()
    if not proje:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proje bulunamadı")

    bugun = str(date.today())

    # Bugünkü aktif personel
    from app.models.puantaj import PuantajKaydi
    puantaj_stmt = select(func.count(PuantajKaydi.id)).where(
        PuantajKaydi.proje_id == proje_id,
        PuantajKaydi.tarih == bugun,
        PuantajKaydi.devamsizlik == False,  # noqa: E712
    )
    toplam_personel = (await db.execute(puantaj_stmt)).scalar() or 0

    # Kritik stok (miktar <= min_miktar)
    from app.models.stok import StokKalemi
    stok_stmt = select(func.count(StokKalemi.id)).where(
        StokKalemi.proje_id == proje_id,
        StokKalemi.miktar <= StokKalemi.min_miktar,
    )
    kritik_stok = (await db.execute(stok_stmt)).scalar() or 0

    # Medya dosya sayısı
    from app.models.medya import MedyaDosyasi
    medya_stmt = select(func.count(MedyaDosyasi.id)).where(
        MedyaDosyasi.proje_id == proje_id,
    )
    medya_sayisi = (await db.execute(medya_stmt)).scalar() or 0

    # ISG açık madde sayısı
    from app.models.isg import IsgKaydi
    isg_stmt = select(func.count(IsgKaydi.id)).where(
        IsgKaydi.proje_id == proje_id,
        IsgKaydi.durum == "acik",
    )
    isg_acik = (await db.execute(isg_stmt)).scalar() or 0

    return {
        "toplam_personel_bugun": toplam_personel,
        "kritik_stok_sayisi": kritik_stok,
        "medya_sayisi": medya_sayisi,
        "isg_acik_madde": isg_acik,
        "ilerleme_yuzdesi": proje.ilerleme_yuzdesi or 0.0,
        "proje_muduru": proje.proje_muduru,
        "baslangic_tarihi": str(proje.baslangic_tarihi) if proje.baslangic_tarihi else None,
        "bitis_tarihi": str(proje.bitis_tarihi) if proje.bitis_tarihi else None,
    }


@router.post(
    "/{proje_id}/aktivite",
    response_model=AktiviteResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Manuel aktivite kaydı ekle",
)
async def create_aktivite(
    proje_id: str,
    payload: AktiviteCreate,
    db: DbDep,
    musteri_id: CurrentMusteriId,
    current_user: CurrentUser,
) -> Aktivite:
    """Projeye manuel aktivite kaydı ekler."""
    await _get_or_404(db, proje_id, musteri_id)
    aktivite = Aktivite(
        proje_id=proje_id,
        musteri_id=musteri_id,
        kullanici_id=current_user.id,
        tip=payload.tip,
        baslik=payload.baslik,
        aciklama=payload.aciklama,
        renk=payload.renk,
        created_at=_now_iso(),
    )
    db.add(aktivite)
    await db.commit()
    await db.refresh(aktivite)
    return aktivite


# ---------------------------------------------------------------------------
# ProjeNot şemaları
# ---------------------------------------------------------------------------


class NotCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    baslik: str = Field(..., min_length=1, max_length=200)
    icerik: str = Field(..., min_length=1)
    renk: str = Field(default="amber", description="amber | green | red | blue")
    sabitlendi: bool = Field(default=False)


class NotUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    baslik: str | None = Field(default=None, min_length=1, max_length=200)
    icerik: str | None = Field(default=None, min_length=1)
    renk: str | None = None
    sabitlendi: bool | None = None


class NotResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    proje_id: str
    musteri_id: str
    baslik: str
    icerik: str
    renk: str | None = None
    sabitlendi: str | None = None   # "true" | "false" — modelde String(5)
    created_at: str | None = None
    updated_at: str | None = None


# ---------------------------------------------------------------------------
# ProjeNot yardımcı
# ---------------------------------------------------------------------------


async def _get_not_or_404(
    db: AsyncSession, proje_id: str, not_id: str, musteri_id: str
) -> ProjeNot:
    result = await db.execute(
        select(ProjeNot).where(
            ProjeNot.id == not_id,
            ProjeNot.proje_id == proje_id,
            ProjeNot.musteri_id == musteri_id,
        )
    )
    n = result.scalar_one_or_none()
    if n is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Not bulunamadı: {not_id}",
        )
    return n


# ---------------------------------------------------------------------------
# ProjeNot endpoint'leri
# ---------------------------------------------------------------------------


@router.get(
    "/{proje_id}/notlar",
    response_model=list[NotResponse],
    summary="Proje notlarını listele",
)
async def list_notlar(
    proje_id: str,
    db: DbDep,
    musteri_id: CurrentMusteriId,
) -> list[ProjeNot]:
    """Projeye ait tüm notları döndürür; sabitlenenler önce gelir."""
    await _get_or_404(db, proje_id, musteri_id)
    result = await db.execute(
        select(ProjeNot)
        .where(ProjeNot.proje_id == proje_id, ProjeNot.musteri_id == musteri_id)
        .order_by(ProjeNot.sabitlendi.desc(), ProjeNot.created_at.desc())
    )
    return list(result.scalars().all())


@router.post(
    "/{proje_id}/notlar",
    response_model=NotResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Proje notu oluştur",
)
async def create_not(
    proje_id: str,
    payload: NotCreate,
    db: DbDep,
    musteri_id: CurrentMusteriId,
) -> ProjeNot:
    """Projeye yeni bir yapışkan not ekler."""
    await _get_or_404(db, proje_id, musteri_id)
    now = _now_iso()
    not_kaydi = ProjeNot(
        proje_id=proje_id,
        musteri_id=musteri_id,
        baslik=payload.baslik,
        icerik=payload.icerik,
        renk=payload.renk,
        sabitlendi="true" if payload.sabitlendi else "false",
        created_at=now,
        updated_at=now,
    )
    db.add(not_kaydi)
    await db.commit()
    await db.refresh(not_kaydi)
    return not_kaydi


@router.patch(
    "/{proje_id}/notlar/{not_id}",
    response_model=NotResponse,
    summary="Proje notu güncelle",
)
async def update_not(
    proje_id: str,
    not_id: str,
    payload: NotUpdate,
    db: DbDep,
    musteri_id: CurrentMusteriId,
) -> ProjeNot:
    """Notun bir ya da birden fazla alanını günceller."""
    not_kaydi = await _get_not_or_404(db, proje_id, not_id, musteri_id)

    if payload.baslik is not None:
        not_kaydi.baslik = payload.baslik
    if payload.icerik is not None:
        not_kaydi.icerik = payload.icerik
    if payload.renk is not None:
        not_kaydi.renk = payload.renk
    if payload.sabitlendi is not None:
        not_kaydi.sabitlendi = "true" if payload.sabitlendi else "false"

    not_kaydi.updated_at = _now_iso()
    db.add(not_kaydi)
    await db.commit()
    await db.refresh(not_kaydi)
    return not_kaydi


@router.delete(
    "/{proje_id}/notlar/{not_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Proje notu sil",
)
async def delete_not(
    proje_id: str,
    not_id: str,
    db: DbDep,
    musteri_id: CurrentMusteriId,
) -> None:
    """Notu kalıcı olarak siler."""
    not_kaydi = await _get_not_or_404(db, proje_id, not_id, musteri_id)
    await db.delete(not_kaydi)
    await db.commit()


# ---------------------------------------------------------------------------
# Milestone şemaları
# ---------------------------------------------------------------------------


class MilestoneCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    baslik: str = Field(..., min_length=1, max_length=200)
    hedef_tarih: str = Field(..., description="ISO date string (YYYY-MM-DD)")
    aciklama: str | None = None
    tamamlandi: bool = Field(default=False)


class MilestoneUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    baslik: str | None = Field(default=None, min_length=1, max_length=200)
    hedef_tarih: str | None = None
    aciklama: str | None = None
    tamamlandi: bool | None = None


class MilestoneResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    proje_id: str
    musteri_id: str
    baslik: str | None = None
    hedef_tarih: str | None = None
    aciklama: str | None = None
    tamamlandi: bool = False
    renk: str
    created_at: str | None = None

    @classmethod
    def from_aktivite(cls, a: "Aktivite") -> "MilestoneResponse":
        """Aktivite kaydından MilestoneResponse üretir; meta JSON'ı parse eder."""
        try:
            meta: dict = json.loads(a.aciklama or "{}")
        except (json.JSONDecodeError, TypeError):
            meta = {}
        return cls(
            id=a.id,
            proje_id=a.proje_id,
            musteri_id=a.musteri_id,
            baslik=a.baslik,
            hedef_tarih=meta.get("hedef_tarih"),
            aciklama=meta.get("aciklama"),
            tamamlandi=meta.get("tamamlandi", False),
            renk=a.renk,
            created_at=a.created_at,
        )


# ---------------------------------------------------------------------------
# Milestone endpoint'leri
# ---------------------------------------------------------------------------


@router.post(
    "/{proje_id}/milestone",
    response_model=MilestoneResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Önemli tarih ekle",
)
async def milestone_ekle(
    proje_id: str,
    data: MilestoneCreate,
    db: DbDep,
    musteri_id: CurrentMusteriId,
    current_user: CurrentUser,
) -> MilestoneResponse:
    """Proje milestones aktivite tablosunda tip='milestone' ile tutulur.

    Meta veriler (hedef_tarih, tamamlandi, aciklama) JSON olarak
    aktivite.aciklama alanına kaydedilir.
    """
    await _get_or_404(db, proje_id, musteri_id)
    meta = json.dumps({
        "hedef_tarih": data.hedef_tarih,
        "tamamlandi": data.tamamlandi,
        "aciklama": data.aciklama,
    }, ensure_ascii=False)
    aktivite = Aktivite(
        proje_id=proje_id,
        musteri_id=musteri_id,
        kullanici_id=current_user.id,
        tip="milestone",
        baslik=data.baslik,
        aciklama=meta,
        renk="green" if data.tamamlandi else "blue",
        created_at=_now_iso(),
    )
    db.add(aktivite)
    await db.commit()
    await db.refresh(aktivite)
    return MilestoneResponse.from_aktivite(aktivite)


@router.get(
    "/{proje_id}/milestones",
    response_model=list[MilestoneResponse],
    summary="Önemli tarihleri listele",
)
async def list_milestones(
    proje_id: str,
    db: DbDep,
    musteri_id: CurrentMusteriId,
) -> list[MilestoneResponse]:
    """Projeye ait tüm milestone'ları döndürür (hedef_tarih sıralı)."""
    await _get_or_404(db, proje_id, musteri_id)
    result = await db.execute(
        select(Aktivite)
        .where(
            Aktivite.proje_id == proje_id,
            Aktivite.musteri_id == musteri_id,
            Aktivite.tip == "milestone",
        )
        .order_by(Aktivite.created_at.asc())
    )
    return [MilestoneResponse.from_aktivite(a) for a in result.scalars().all()]


@router.patch(
    "/{proje_id}/milestones/{milestone_id}",
    response_model=MilestoneResponse,
    summary="Milestone güncelle",
)
async def update_milestone(
    proje_id: str,
    milestone_id: str,
    payload: MilestoneUpdate,
    db: DbDep,
    musteri_id: CurrentMusteriId,
) -> MilestoneResponse:
    """Milestone'ın bir ya da birden fazla alanını günceller."""
    await _get_or_404(db, proje_id, musteri_id)
    result = await db.execute(
        select(Aktivite).where(
            Aktivite.id == milestone_id,
            Aktivite.proje_id == proje_id,
            Aktivite.musteri_id == musteri_id,
            Aktivite.tip == "milestone",
        )
    )
    aktivite = result.scalar_one_or_none()
    if aktivite is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Milestone bulunamadı: {milestone_id}",
        )

    # Mevcut meta'yı parse et
    try:
        meta: dict = json.loads(aktivite.aciklama or "{}")
    except (json.JSONDecodeError, TypeError):
        meta = {}

    if payload.baslik is not None:
        aktivite.baslik = payload.baslik
    if payload.hedef_tarih is not None:
        meta["hedef_tarih"] = payload.hedef_tarih
    if payload.aciklama is not None:
        meta["aciklama"] = payload.aciklama
    if payload.tamamlandi is not None:
        meta["tamamlandi"] = payload.tamamlandi
        aktivite.renk = "green" if payload.tamamlandi else "blue"

    aktivite.aciklama = json.dumps(meta, ensure_ascii=False)
    db.add(aktivite)
    await db.commit()
    await db.refresh(aktivite)
    return MilestoneResponse.from_aktivite(aktivite)


@router.delete(
    "/{proje_id}/milestones/{milestone_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Milestone sil",
)
async def delete_milestone(
    proje_id: str,
    milestone_id: str,
    db: DbDep,
    musteri_id: CurrentMusteriId,
) -> None:
    """Milestone kaydını kalıcı olarak siler."""
    await _get_or_404(db, proje_id, musteri_id)
    result = await db.execute(
        select(Aktivite).where(
            Aktivite.id == milestone_id,
            Aktivite.proje_id == proje_id,
            Aktivite.musteri_id == musteri_id,
            Aktivite.tip == "milestone",
        )
    )
    aktivite = result.scalar_one_or_none()
    if aktivite is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Milestone bulunamadı: {milestone_id}",
        )
    await db.delete(aktivite)
    await db.commit()

