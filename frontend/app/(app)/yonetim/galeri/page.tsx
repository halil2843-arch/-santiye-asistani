'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { MedyaDosyasi, ProjeResponse } from '@/types';
import { tokenStore } from '@/lib/auth';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

// ── Fotoğraf notları — localStorage ─────────────────────────────────────────

function notlariAl(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem('foto_notlar') || '{}'); } catch { return {}; }
}
function notKaydet(id: string, not: string) {
  const notlar = notlariAl();
  if (not.trim()) notlar[id] = not.trim();
  else delete notlar[id];
  localStorage.setItem('foto_notlar', JSON.stringify(notlar));
}

// ── Not Bileşeni ─────────────────────────────────────────────────────────────

function FotoNot({ id }: { id: string }) {
  const [acik, setAcik] = useState(false);
  const [not, setNot] = useState('');
  const [kayitli, setKayitli] = useState('');

  useEffect(() => {
    const mevcut = notlariAl()[id] ?? '';
    setNot(mevcut);
    setKayitli(mevcut);
  }, [id]);

  const handleKaydet = () => {
    notKaydet(id, not);
    setKayitli(not.trim());
    setAcik(false);
  };

  const handleIptal = () => {
    setNot(kayitli);
    setAcik(false);
  };

  return (
    <div style={{ padding: '6px 8px 8px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
      {!acik ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {kayitli ? (
            <p style={{
              flex: 1, fontSize: 9, color: '#94A3B8', lineHeight: 1.4,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }} title={kayitli}>
              📝 {kayitli}
            </p>
          ) : (
            <span style={{ flex: 1, fontSize: 9, color: '#475569' }}>Not yok</span>
          )}
          <button
            onClick={() => setAcik(true)}
            style={{
              flexShrink: 0, background: 'rgba(245,158,11,0.12)',
              border: '1px solid rgba(245,158,11,0.25)',
              borderRadius: 6, padding: '3px 7px',
              color: '#F59E0B', fontSize: 9, fontWeight: 600, cursor: 'pointer',
            }}
          >
            📝
          </button>
        </div>
      ) : (
        <div>
          <textarea
            rows={2}
            value={not}
            onChange={(e) => setNot(e.target.value)}
            placeholder="Fotoğraf notu..."
            autoFocus
            style={{
              width: '100%', background: '#0E1117',
              border: '1px solid rgba(245,158,11,0.4)',
              borderRadius: 8, padding: '5px 7px',
              color: '#F1F5F9', fontSize: 10, resize: 'none', outline: 'none',
              fontFamily: 'inherit', boxSizing: 'border-box', lineHeight: 1.4,
            }}
          />
          <div style={{ display: 'flex', gap: 5, marginTop: 5 }}>
            <button
              onClick={handleKaydet}
              style={{
                flex: 1, background: 'rgba(34,197,94,0.15)',
                border: '1px solid rgba(34,197,94,0.35)',
                borderRadius: 7, padding: '4px', color: '#4ADE80',
                fontSize: 9, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Kaydet
            </button>
            <button
              onClick={handleIptal}
              style={{
                flex: 1, background: '#1E2636',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 7, padding: '4px', color: '#64748B',
                fontSize: 9, fontWeight: 600, cursor: 'pointer',
              }}
            >
              İptal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="grid grid-cols-3 gap-2">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="bg-[#1E2636] rounded-xl animate-pulse aspect-square" />
      ))}
    </div>
  );
}

function formatBoyut(bytes: number | null) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Fotoğraf thumbnail — blob URL ile token'lı yükleme */
function FotoThumbnail({ id }: { id: string }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [hata, setHata] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    const token = tokenStore.getAccess();

    fetch(`${BASE}/api/v1/media/${id}/view`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => {
        if (!r.ok) throw new Error('fetch hata');
        return r.blob();
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch(() => setHata(true));

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);

  if (hata || blobUrl === null) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        {hata ? (
          <span className="text-3xl">🖼️</span>
        ) : (
          <div className="w-8 h-8 border-2 border-[#F59E0B]/40 border-t-[#F59E0B] rounded-full animate-spin" />
        )}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={blobUrl}
      alt="Fotoğraf"
      className="w-full h-full object-cover"
    />
  );
}

// ── Yardımcı: Mevcut yoldaki bir seviye alt klasörleri bul ───────────────────

function altKlasorleriHesapla(tumKlasorler: string[], yol: string | null): string[] {
  const onEk = yol ? yol + '/' : '';
  const set = new Set<string>();
  tumKlasorler.forEach(k => {
    if (yol === null) {
      const parcalar = k.split('/');
      set.add(parcalar[0]);
    } else if (k.startsWith(onEk)) {
      const geri = k.substring(onEk.length);
      const parcalar = geri.split('/');
      set.add(parcalar[0]);
    }
  });
  return Array.from(set).sort();
}

// ── Fotoğraf damgası (Canvas) ─────────────────────────────────────────────────

async function filigranUygula(
  file: File,
  ayarlar: { ad: string; tarih: boolean; konum: string }
): Promise<File> {
  const satirlar: string[] = [];
  if (ayarlar.ad) satirlar.push(`👤 ${ayarlar.ad}`);
  if (ayarlar.tarih) {
    satirlar.push(new Date().toLocaleDateString('tr-TR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    }));
  }
  if (ayarlar.konum) satirlar.push(`📍 ${ayarlar.konum}`);
  if (satirlar.length === 0) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0);

      const fs = Math.max(16, Math.round(canvas.width / 42));
      ctx.font = `bold ${fs}px Arial, sans-serif`;
      const pad = fs * 0.8;
      const lh = fs * 1.55;
      const maxW = Math.max(...satirlar.map(s => ctx.measureText(s).width));
      const boxW = maxW + pad * 2;
      const boxH = satirlar.length * lh + pad * 1.2;
      const margin = fs * 0.6;
      const bx = canvas.width - boxW - margin;
      const by = canvas.height - boxH - margin;

      // Yarı-şeffaf arka plan
      ctx.fillStyle = 'rgba(0,0,0,0.60)';
      if ((ctx as CanvasRenderingContext2D & { roundRect?: (...a: unknown[]) => void }).roundRect) {
        (ctx as CanvasRenderingContext2D & { roundRect: (...a: unknown[]) => void })
          .roundRect(bx, by, boxW, boxH, 8);
        ctx.fill();
      } else {
        ctx.fillRect(bx, by, boxW, boxH);
      }

      // Amber sol çizgi
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(bx, by, 3, boxH);

      // Metin
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      satirlar.forEach((s, i) => {
        ctx.fillText(s, bx + pad, by + pad * 0.6 + i * lh);
      });

      canvas.toBlob((blob) => {
        if (!blob) { resolve(file); return; }
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, '_damga.jpg'), { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.92);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

// ─────────────────────────────────────────────────────────────────────────────

export default function GaleriPage() {
  const [dosyalar, setDosyalar] = useState<MedyaDosyasi[]>([]);
  const [projeler, setProjeler] = useState<ProjeResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [secilenProje, setSecilenProje] = useState<string>('');
  const [secilenTip, setSecilenTip] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // İç içe klasör state'leri
  const [extraKlasorler, setExtraKlasorler] = useState<Set<string>>(new Set());
  const [mevcutYol, setMevcutYol] = useState<string | null>(null); // null = kök
  const [yeniKlasorAdi, setYeniKlasorAdi] = useState('');
  const [klasorEkleAcik, setKlasorEkleAcik] = useState(false);
  const [siliyorKlasor, setSiliyorKlasor] = useState<string | null>(null);

  // Taşı / Kopyala modal state'leri
  const [aksiyonMenuId, setAksiyonMenuId] = useState<string | null>(null);
  const [hedefKlasorModal, setHedefKlasorModal] = useState<{ dosyaId: string; mod: 'tasi' | 'kopyala' } | null>(null);

  // Fotoğraf damgası ayarları
  const [damgaAcik, setDamgaAcik] = useState(true);
  const [damgaAdi, setDamgaAdi] = useState('');
  const [damgaTarih, setDamgaTarih] = useState(true);
  const [damgaKonum, setDamgaKonum] = useState(true);
  const [gpsKonum, setGpsKonum] = useState('');
  const [damgaAyarlarAcik, setDamgaAyarlarAcik] = useState(false);

  const fetchDosyalar = () => {
    setLoading(true);
    api.getMedya(secilenProje || undefined, secilenTip || undefined)
      .then(setDosyalar)
      .catch(() => setDosyalar([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    api.getProjeler()
      .then(setProjeler)
      .catch(() => setProjeler([]));

    // Kullanıcı adını JWT'den çek
    try {
      const token = localStorage.getItem('access_token');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setDamgaAdi(payload.ad_soyad || payload.email?.split('@')[0] || '');
      }
    } catch { /* sessiz */ }

    // GPS konumunu al
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setGpsKonum(`${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`),
        () => {},
        { timeout: 6000 }
      );
    }
  }, []);

  useEffect(() => {
    fetchDosyalar();
  }, [secilenProje, secilenTip]); // eslint-disable-line react-hooks/exhaustive-deps

  // Klasörler dosyalar state'inden türetilir + boş yerel klasörler
  const klasorler = [...new Set([
    ...dosyalar.map(d => d.klasor).filter((k): k is string => !!k),
    ...Array.from(extraKlasorler),
  ])].sort();

  // Mevcut yoldaki alt klasörler
  const altKlasorler = altKlasorleriHesapla(klasorler, mevcutYol);

  // Mevcut yoldaki fotoğraflar
  const yoldakiFotograflar = mevcutYol === null
    ? dosyalar.filter(d => !d.klasor)
    : dosyalar.filter(d => d.klasor === mevcutYol);

  // Tip filtresi uygula
  const goruntulenecek = yoldakiFotograflar.filter((d) => {
    if (!secilenTip) return true;
    if (secilenTip === 'fotograf') return d.tip === 'fotograf' || !!d.mime_type?.startsWith('image/');
    if (secilenTip === 'belge') return d.tip === 'belge' || d.mime_type === 'application/pdf';
    return true;
  });

  const handleKlasorSil = async (klasorAdi: string) => {
    // İç içe klasör: bu klasör veya alt klasörlerindeki tüm dosyalar
    const klasordekiler = dosyalar.filter(d =>
      d.klasor === klasorAdi || d.klasor?.startsWith(klasorAdi + '/')
    );
    // Alt klasörler de silinecek
    const altKlasorListesi = klasorler.filter(k => k === klasorAdi || k.startsWith(klasorAdi + '/'));

    const onay = klasordekiler.length > 0
      ? window.confirm(`"${klasorAdi}" klasörü ve alt klasörleri silinecek.\nİçindeki ${klasordekiler.length} dosya sınıflandırılmamışlara taşınacak.\n\nDevam edilsin mi?`)
      : window.confirm(`"${klasorAdi}" klasörünü silmek istiyor musunuz?`);
    if (!onay) return;
    setSiliyorKlasor(klasorAdi);
    try {
      await Promise.all(klasordekiler.map(d => api.klasoreYerlesit(d.id, null)));
      setDosyalar(prev => prev.map(d =>
        (d.klasor === klasorAdi || d.klasor?.startsWith(klasorAdi + '/'))
          ? { ...d, klasor: null }
          : d
      ));
      setExtraKlasorler(prev => {
        const s = new Set(prev);
        altKlasorListesi.forEach(k => s.delete(k));
        return s;
      });
      // Eğer mevcut yol silinen klasörün içindeyse köke dön
      if (mevcutYol === klasorAdi || mevcutYol?.startsWith(klasorAdi + '/')) {
        setMevcutYol(null);
      }
    } catch { /* sessiz */ } finally {
      setSiliyorKlasor(null);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, kamera = false) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (let file of Array.from(files)) {
        // Kamera fotoğrafına damga ekle
        if (kamera && damgaAcik && file.type.startsWith('image/')) {
          file = await filigranUygula(file, {
            ad: damgaAdi,
            tarih: damgaTarih,
            konum: damgaKonum ? gpsKonum : '',
          });
        }
        const fd = new FormData();
        fd.append('dosya', file);
        if (secilenProje) fd.append('proje_id', secilenProje);
        if (mevcutYol) fd.append('klasor', mevcutYol);
        await api.uploadMedya(fd);
      }
      fetchDosyalar();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Yükleme başarısız');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteMedya(id);
      setDosyalar((prev) => prev.filter((d) => d.id !== id));
    } catch {
      // sessiz
    }
  };

  const handleHedefSec = async (hedefKlasor: string | null) => {
    if (!hedefKlasorModal) return;
    const { dosyaId, mod } = hedefKlasorModal;
    setHedefKlasorModal(null);

    try {
      if (mod === 'tasi') {
        await api.klasoreYerlesit(dosyaId, hedefKlasor);
        setDosyalar(prev => prev.map(f => f.id === dosyaId ? { ...f, klasor: hedefKlasor } : f));
      } else {
        const kopya = await api.medyaKopyala(dosyaId, hedefKlasor ?? undefined);
        setDosyalar(prev => [...prev, kopya]);
      }
    } catch {
      setError(mod === 'tasi' ? 'Taşıma başarısız' : 'Kopyalama başarısız');
    }
  };

  return (
    <div
      className="min-h-screen bg-[#0E1117] px-4 py-5 pb-24"
      onClick={() => { if (aksiyonMenuId) setAksiyonMenuId(null); }}
    >
      {/* Başlık + Yükle + Çek */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[#F1F5F9] text-xl font-bold font-[var(--font-syne)]">Galeri</h1>
          {!loading && (
            <p className="text-[#94A3B8] text-xs mt-0.5">{goruntulenecek.length} dosya</p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Damga ayar butonu */}
          <button
            onClick={() => setDamgaAyarlarAcik(true)}
            title="Fotoğraf damgası ayarları"
            style={{
              background: damgaAcik ? 'rgba(245,158,11,0.15)' : '#1E2636',
              color: damgaAcik ? '#F59E0B' : '#475569',
              border: `1px solid ${damgaAcik ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.07)'}`,
              borderRadius: 10, width: 36, height: 36,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, cursor: 'pointer',
            }}
          >
            🔖
          </button>

          {/* Fotoğraf Çek — kamera + damga */}
          <label style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: '#1E2636', color: '#F1F5F9',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12, padding: '8px 14px',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            position: 'relative',
          }}>
            📷 Çek
            {damgaAcik && (
              <span style={{ position: 'absolute', top: -4, right: -4, width: 10, height: 10, background: '#F59E0B', borderRadius: '50%', border: '2px solid #0E1117' }} title="Damga aktif" />
            )}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleUpload(e, true)}
            />
          </label>

          {/* Yükle butonu */}
          <label className={`flex items-center gap-1.5 bg-[#F59E0B] text-black text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#D97706] transition-colors cursor-pointer ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
            <span>{uploading ? 'Yükleniyor...' : '+ Yükle'}</span>
            <input
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => handleUpload(e, false)}
            />
          </label>
        </div>
      </div>

      {/* Hata */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Filtreler */}
      <div className="flex gap-3 mb-4">
        <select
          className="flex-1 bg-[#1E2636] border border-white/[0.07] rounded-xl px-4 py-2.5 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#F59E0B]/60"
          value={secilenProje}
          onChange={(e) => setSecilenProje(e.target.value)}
        >
          <option value="">Tüm Projeler</option>
          {projeler.map((p) => (
            <option key={p.id} value={p.id}>{p.isim}</option>
          ))}
        </select>
        <select
          className="bg-[#1E2636] border border-white/[0.07] rounded-xl px-4 py-2.5 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#F59E0B]/60"
          value={secilenTip}
          onChange={(e) => setSecilenTip(e.target.value)}
        >
          <option value="">Tüm Tipler</option>
          <option value="fotograf">Fotoğraf</option>
          <option value="belge">Belge</option>
        </select>
      </div>

      {/* ── İÇ İÇE KLASÖR NAVIGASYON ─────────────────────────────────────────── */}

      {/* Breadcrumb */}
      {mevcutYol !== null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          <button onClick={() => setMevcutYol(null)} style={{ color: '#F59E0B', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            📁 Ana Galeri
          </button>
          {mevcutYol.split('/').map((parcaAdi, idx, arr) => {
            const hedefYol = arr.slice(0, idx + 1).join('/');
            return (
              <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#475569' }}>/</span>
                <button
                  onClick={() => setMevcutYol(hedefYol)}
                  style={{
                    color: idx === arr.length - 1 ? '#F1F5F9' : '#F59E0B',
                    fontSize: 12,
                    fontWeight: idx === arr.length - 1 ? 700 : 400,
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  }}
                >
                  {parcaAdi}
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Alt Klasör Grid'i (2 sütun) */}
      {altKlasorler.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          {altKlasorler.map(k => {
            const tamYolStr = mevcutYol ? `${mevcutYol}/${k}` : k;
            const iceridekiSayi = dosyalar.filter(d =>
              d.klasor === tamYolStr || d.klasor?.startsWith(tamYolStr + '/')
            ).length;
            return (
              <button
                key={k}
                onClick={() => setMevcutYol(tamYolStr)}
                style={{
                  background: '#1E2636',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 14,
                  padding: '14px 16px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  position: 'relative',
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 6 }}>📁</div>
                <div style={{ color: '#F1F5F9', fontSize: 13, fontWeight: 600, marginBottom: 2 }}>{k}</div>
                <div style={{ color: '#64748B', fontSize: 11 }}>{iceridekiSayi} öğe</div>
                {/* Silme butonu */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleKlasorSil(tamYolStr); }}
                  disabled={siliyorKlasor === tamYolStr}
                  style={{
                    position: 'absolute', top: 8, right: 8,
                    background: 'rgba(239,68,68,0.1)',
                    border: '1px solid rgba(239,68,68,0.2)',
                    borderRadius: 6, padding: '3px 7px',
                    color: '#F87171', fontSize: 11, cursor: 'pointer',
                    opacity: siliyorKlasor === tamYolStr ? 0.4 : 1,
                  }}
                >
                  {siliyorKlasor === tamYolStr ? '…' : '×'}
                </button>
              </button>
            );
          })}
        </div>
      )}

      {/* Yeni Klasör butonu */}
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => setKlasorEkleAcik(true)}
          style={{
            padding: '6px 12px', borderRadius: 20,
            background: 'transparent', color: '#F59E0B',
            border: '1px dashed rgba(245,158,11,0.4)',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}
        >
          + {mevcutYol ? 'Alt Klasör' : 'Klasör'} Ekle
        </button>
      </div>

      {/* ── FOTOĞRAF GRID ────────────────────────────────────────────────────── */}
      {loading ? (
        <Skeleton />
      ) : goruntulenecek.length === 0 ? (
        <div className="bg-[#1E2636] rounded-2xl p-10 text-center border border-white/[0.07]">
          <span className="text-4xl block mb-3">🖼️</span>
          <p className="text-[#94A3B8] text-sm">Henüz dosya yüklenmedi</p>
          <label className="mt-3 inline-block text-[#F59E0B] text-sm font-medium hover:underline cursor-pointer">
            İlk dosyayı yükle →
            <input
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="hidden"
              onChange={handleUpload}
            />
          </label>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-3">
          {goruntulenecek.map((d) => {
            const isFoto = d.tip === 'fotograf' || d.mime_type?.startsWith('image/');
            const isPdf = d.mime_type?.includes('pdf');
            return (
              <div key={d.id} className="bg-[#1E2636] rounded-xl border border-white/[0.07] overflow-hidden group">
                {/* Thumbnail */}
                <div className="aspect-square bg-[#2A3447] relative overflow-hidden">
                  {isFoto ? (
                    <FotoThumbnail id={d.id} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-4xl">{isPdf ? '📄' : '📁'}</span>
                    </div>
                  )}

                  {/* 3 nokta aksiyon menüsü */}
                  <div style={{ position: 'absolute', top: 4, left: 4, zIndex: 10 }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setAksiyonMenuId(aksiyonMenuId === d.id ? null : d.id);
                      }}
                      style={{
                        background: 'rgba(0,0,0,0.6)',
                        borderRadius: 8,
                        width: 28, height: 28,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: 'none', cursor: 'pointer',
                        color: '#fff', fontSize: 16,
                      }}
                    >
                      ⋯
                    </button>

                    {aksiyonMenuId === d.id && (
                      <div
                        style={{
                          position: 'absolute', top: 32, left: 0,
                          background: '#1E2636',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 10, overflow: 'hidden',
                          zIndex: 20, minWidth: 130,
                          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                        }}
                        onClick={e => e.stopPropagation()}
                      >
                        <button
                          onClick={() => { setHedefKlasorModal({ dosyaId: d.id, mod: 'tasi' }); setAksiyonMenuId(null); }}
                          style={{
                            width: '100%', padding: '10px 14px',
                            background: 'none', border: 'none',
                            color: '#F1F5F9', fontSize: 12,
                            textAlign: 'left', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 8,
                          }}
                        >
                          📂 Taşı
                        </button>
                        <button
                          onClick={() => { setHedefKlasorModal({ dosyaId: d.id, mod: 'kopyala' }); setAksiyonMenuId(null); }}
                          style={{
                            width: '100%', padding: '10px 14px',
                            background: 'none', border: 'none',
                            color: '#F1F5F9', fontSize: 12,
                            textAlign: 'left', cursor: 'pointer',
                            borderTop: '1px solid rgba(255,255,255,0.05)',
                            display: 'flex', alignItems: 'center', gap: 8,
                          }}
                        >
                          📋 Kopyala
                        </button>
                        <button
                          onClick={() => { handleDelete(d.id); setAksiyonMenuId(null); }}
                          style={{
                            width: '100%', padding: '10px 14px',
                            background: 'none', border: 'none',
                            color: '#F87171', fontSize: 12,
                            textAlign: 'left', cursor: 'pointer',
                            borderTop: '1px solid rgba(255,255,255,0.05)',
                            display: 'flex', alignItems: 'center', gap: 8,
                          }}
                        >
                          🗑 Sil
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Meta */}
                <div className="p-2">
                  <p className="text-[#F1F5F9] text-[10px] font-medium truncate">
                    {d.dosya_adi ?? (isFoto ? 'Fotoğraf' : 'Belge')}
                  </p>
                  <div className="flex items-center justify-between mt-0.5">
                    {d.boyut_byte && (
                      <span className="text-[#94A3B8] text-[9px]">{formatBoyut(d.boyut_byte)}</span>
                    )}
                    {d.created_at && (
                      <span className="text-[#94A3B8] text-[9px]">
                        {new Date(d.created_at).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })}
                      </span>
                    )}
                  </div>

                  {/* Klasör badge */}
                  {d.klasor && (
                    <div style={{
                      marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 3,
                      background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)',
                      borderRadius: 6, padding: '2px 6px',
                    }}>
                      <span style={{ fontSize: 9 }}>📁</span>
                      <span style={{
                        fontSize: 9, color: '#93C5FD', fontWeight: 600,
                        maxWidth: 64, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {d.klasor.split('/').pop()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Not bileşeni */}
                <FotoNot id={d.id} />
              </div>
            );
          })}
        </div>
      )}

      {/* ── YENİ KLASÖR MODAL ────────────────────────────────────────────────── */}
      {klasorEkleAcik && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 60,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }}>
          <div style={{ background: '#1E2636', borderRadius: 16, padding: 24, width: '100%', maxWidth: 320 }}>
            <h3 style={{ color: '#F1F5F9', fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
              {mevcutYol ? `"${mevcutYol.split('/').pop()}" İçine Alt Klasör` : 'Yeni Klasör'}
            </h3>
            {mevcutYol && (
              <p style={{ color: '#64748B', fontSize: 11, marginBottom: 12 }}>
                Konum: {mevcutYol}
              </p>
            )}
            <input
              type="text"
              value={yeniKlasorAdi}
              onChange={e => setYeniKlasorAdi(e.target.value)}
              placeholder="Klasör adı (ör: Zemin Kat, Kolon...)"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter' && yeniKlasorAdi.trim()) {
                  const tamYeniYol = mevcutYol
                    ? `${mevcutYol}/${yeniKlasorAdi.trim()}`
                    : yeniKlasorAdi.trim();
                  setExtraKlasorler(prev => new Set([...prev, tamYeniYol]));
                  setYeniKlasorAdi('');
                  setKlasorEkleAcik(false);
                }
              }}
              style={{
                width: '100%', background: '#252F42',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10, padding: '10px 14px',
                color: '#F1F5F9', fontSize: 14, outline: 'none',
                boxSizing: 'border-box', marginBottom: 12,
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  if (yeniKlasorAdi.trim()) {
                    const tamYeniYol = mevcutYol
                      ? `${mevcutYol}/${yeniKlasorAdi.trim()}`
                      : yeniKlasorAdi.trim();
                    setExtraKlasorler(prev => new Set([...prev, tamYeniYol]));
                    setYeniKlasorAdi('');
                    setKlasorEkleAcik(false);
                  }
                }}
                style={{
                  flex: 1, background: '#F59E0B', color: '#000',
                  borderRadius: 10, padding: '10px',
                  fontWeight: 700, border: 'none', cursor: 'pointer', fontSize: 14,
                }}
              >
                Oluştur
              </button>
              <button
                onClick={() => { setKlasorEkleAcik(false); setYeniKlasorAdi(''); }}
                style={{
                  flex: 1, background: '#1E2636', color: '#64748B',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 10, padding: '10px',
                  fontWeight: 600, cursor: 'pointer', fontSize: 14,
                }}
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TAŞI / KOPYALA HEDEF KLASÖR MODAL ──────────────────────────────── */}
      {hedefKlasorModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 70,
            background: 'rgba(0,0,0,0.75)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
          onClick={() => setHedefKlasorModal(null)}
        >
          <div
            style={{
              background: '#161B26',
              borderRadius: '24px 24px 0 0',
              width: '100%', maxWidth: 480,
              padding: '20px 20px 36px',
              maxHeight: '70vh', overflowY: 'auto',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: 40, height: 4, background: '#2A3447', borderRadius: 4, margin: '0 auto 16px' }} />
            <h3 style={{ color: '#F1F5F9', fontSize: 16, fontWeight: 700, marginBottom: 4 }}>
              {hedefKlasorModal.mod === 'tasi' ? '📂 Taşınacak Klasör' : '📋 Kopyalanacak Klasör'}
            </h3>
            <p style={{ color: '#64748B', fontSize: 12, marginBottom: 16 }}>Hedef klasörü seçin</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {/* Sınıflandırılmamış seçeneği */}
              <button
                onClick={() => handleHedefSec(null)}
                style={{
                  padding: '12px 16px',
                  background: '#1E2636',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 12, color: '#94A3B8',
                  fontSize: 13, textAlign: 'left', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}
              >
                📂 Sınıflandırılmamış
              </button>

              {/* Tüm klasörler — iç içe gösterim için indent */}
              {klasorler.map(k => {
                const derinlik = k.split('/').length - 1;
                return (
                  <button
                    key={k}
                    onClick={() => handleHedefSec(k)}
                    style={{
                      padding: '12px 16px',
                      paddingLeft: 16 + derinlik * 20,
                      background: '#1E2636',
                      border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: 12, color: '#F1F5F9',
                      fontSize: 13, textAlign: 'left', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 10,
                    }}
                  >
                    📁 {k.split('/').pop()}
                    <span style={{ color: '#475569', fontSize: 11 }}>{k}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
