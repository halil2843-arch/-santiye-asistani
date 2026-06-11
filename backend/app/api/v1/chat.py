"""
AI Chat endpoint — Groq llama-3.3-70b SSE streaming.
POST   /api/v1/chat/message  → Server-Sent Events stream
GET    /api/v1/chat/commands → Hızlı komut listesi
GET    /api/v1/chat/history  → Konuşma geçmişini getir
DELETE /api/v1/chat/history  → Konuşma geçmişini temizle
"""

from __future__ import annotations

import json
from typing import AsyncIterator

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from groq import AsyncGroq
from pydantic import BaseModel, Field

from app.api.deps import CurrentMusteriId
from app.core.cache import cache
from app.core.config import settings
from app.services.chat_prompt import QUICK_COMMANDS, build_chat_prompt, quick_command_formatla

router = APIRouter(tags=["chat"])

# ---------------------------------------------------------------------------
# Chat geçmişi — cache abstraction üzerinden (memory veya Redis)
# ---------------------------------------------------------------------------

_GECMIS_MAXLEN = 10  # Tutulacak maksimum mesaj sayısı


async def _gecmis_ekle(musteri_id: str, rol: str, icerik: str) -> None:
    """Verilen rolde (user/assistant) mesajı cache'e ekler; son 10'u saklar.

    Cache key: "chat:{musteri_id}"
    Her mesaj {"role": ..., "content": ...} dict olarak lpush edilir.
    lpush baş tarafa ekler; geçmiş okunurken lrange ile sıralı gelir.
    """
    key = f"chat:{musteri_id}"
    await cache.lpush(key, {"role": rol, "content": icerik}, maxlen=_GECMIS_MAXLEN)


async def _gecmis_al(musteri_id: str) -> list[dict]:
    """Müşteriye ait geçmiş mesaj listesini döndürür (boş liste mümkün).

    lpush ile baş tarafa eklendiğinden lrange sonucu ters sıralıdır;
    bağlam için doğru kronolojik sıra gerekiyorsa reversed() uygula.
    """
    key = f"chat:{musteri_id}"
    gecmis: list[dict] = await cache.lrange(key, 0, -1)
    # lpush baş tarafa eklediğinden listeyi ters çevir (en eski başta)
    return list(reversed(gecmis))


# ---------------------------------------------------------------------------
# Request modeli
# ---------------------------------------------------------------------------

class ChatMesaj(BaseModel):
    icerik: str = Field(..., min_length=1, max_length=2000, description="Kullanıcının mesajı")
    hizli_komut: str | None = Field(
        default=None,
        description=(
            "Hızlı komut kodu. Değerler: "
            "rapor_olustur, stok_sorgula, ekip_ara, isg_kontrol, "
            "is_plani, hesaplama, hava_degerlendirme, kaza_bildir, "
            "puantaj_ozet, malzeme_siparis"
        ),
    )
    komut_parametreleri: dict | None = Field(
        default=None,
        description="Hızlı komut şablonu için dinamik parametreler ({personel}, {makine} vb.)",
    )
    santiye_adi: str | None = Field(default=None, description="Aktif şantiye adı (bağlam için)")
    proje_adi: str | None = Field(default=None, description="Aktif proje adı (bağlam için)")


# ---------------------------------------------------------------------------
# Groq SSE stream üretici
# ---------------------------------------------------------------------------

async def groq_stream(
    musteri_id: str,
    mesaj: str,
    sistem_prompt: str,
) -> AsyncIterator[str]:
    """Groq'tan SSE formatında token akışı üretir.

    Konuşma bağlamını korumak için musteri_id bazlı in-memory geçmişi
    sistem mesajının ardına ekler; tamamlanan yanıtı geçmişe kaydeder.
    """
    gecmis = await _gecmis_al(musteri_id)
    await _gecmis_ekle(musteri_id, "user", mesaj)

    # Mesaj listesini oluştur: sistem → geçmiş bağlam → güncel kullanıcı mesajı
    mesajlar: list[dict] = [{"role": "system", "content": sistem_prompt}]
    mesajlar.extend(gecmis)        # geçmiş bağlam (en fazla 10 mesaj)
    mesajlar.append({"role": "user", "content": mesaj})

    client = AsyncGroq(api_key=settings.GROQ_API_KEY)
    try:
        stream = await client.chat.completions.create(
            model=settings.DEFAULT_MODEL,
            messages=mesajlar,
            stream=True,
            max_tokens=1024,
            temperature=0.7,
        )
        full_response = ""
        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                full_response += delta
                # SSE formatı: "data: {...}\n\n"
                yield f"data: {json.dumps({'token': delta, 'done': False}, ensure_ascii=False)}\n\n"

        # Tamamlanan yanıtı geçmişe ekle
        await _gecmis_ekle(musteri_id, "assistant", full_response)
        yield f"data: {json.dumps({'token': '', 'done': True})}\n\n"
    except Exception as e:
        yield f"data: {json.dumps({'error': str(e), 'done': True})}\n\n"


# ---------------------------------------------------------------------------
# Endpoint'ler
# ---------------------------------------------------------------------------

@router.post("/message", summary="Chat mesajı gönder (SSE streaming)")
async def chat_mesaj_gonder(
    mesaj: ChatMesaj,
    musteri_id: CurrentMusteriId,
):
    """
    Groq llama-3.3-70b ile SSE streaming chat.

    Yanıt formatı (her satır):
        data: {"token": "...", "done": false}
        ...
        data: {"token": "", "done": true}

    Hata durumunda:
        data: {"error": "...", "done": true}

    Nginx proxy arkasında çalışıyorsa X-Accel-Buffering: no header otomatik eklenir.
    """
    # Hızlı komut varsa şablonu doldur
    gonderilecek_mesaj = mesaj.icerik
    if mesaj.hizli_komut:
        params = mesaj.komut_parametreleri or {}
        formatlanmis = quick_command_formatla(mesaj.hizli_komut, **params)
        if formatlanmis:
            gonderilecek_mesaj = formatlanmis

    # Bağlam zenginleştir
    sistem_prompt = build_chat_prompt(
        santiye_adi=mesaj.santiye_adi,
        proje_adi=mesaj.proje_adi,
    )

    return StreamingResponse(
        groq_stream(musteri_id, gonderilecek_mesaj, sistem_prompt),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


@router.get("/commands", summary="Mevcut hızlı komutları listele")
async def get_commands(musteri_id: CurrentMusteriId):
    """Kullanılabilir hızlı komut kodlarını ve şablonlarını döndürür."""
    return {
        "komutlar": [
            {"key": k, "label": k.replace("_", " ").title(), "template": v}
            for k, v in QUICK_COMMANDS.items()
        ]
    }


@router.get("/history", summary="Konuşma geçmişini getir")
async def gecmisi_getir(musteri_id: CurrentMusteriId):
    """Müşteriye ait son 10 mesajı döndürür."""
    return {"mesajlar": await _gecmis_al(musteri_id)}


@router.delete("/history", summary="Konuşma geçmişini temizle")
async def gecmisi_temizle(musteri_id: CurrentMusteriId):
    """Müşteriye ait konuşma geçmişini cache'den siler."""
    await cache.delete(f"chat:{musteri_id}")
    return {"mesaj": "Konuşma geçmişi temizlendi"}


@router.get("/system-prompt", summary="Aktif sistem promptunu göster (debug)")
async def sistem_promptu_goster(
    musteri_id: CurrentMusteriId,
) -> dict:
    """Şu an aktif olan chat sistem promptunu döndürür — bağlam testi için."""
    from app.services.chat_prompt import CHAT_SYSTEM_PROMPT
    return {
        "sistem_prompt_uzunlugu": len(CHAT_SYSTEM_PROMPT),
        "sistem_prompt_onizleme": CHAT_SYSTEM_PROMPT[:300] + "...",
        "mevcut_komut_sayisi": len(QUICK_COMMANDS),
    }
