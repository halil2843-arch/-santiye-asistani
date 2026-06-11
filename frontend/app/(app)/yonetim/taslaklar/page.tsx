'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { SablonResponse } from '@/types';

const TIP_ETIKET: Record<string, { label: string; renk: string; bg: string; icon: string }> = {
  gunluk_rapor: { label: 'Günlük Rapor', renk: '#F59E0B', bg: 'rgba(245,158,11,0.12)', icon: '📋' },
  hakedis:      { label: 'Hakediş',      renk: '#A78BFA', bg: 'rgba(167,139,250,0.12)', icon: '💰' },
  isg:          { label: 'İSG Formu',    renk: '#F87171', bg: 'rgba(248,113,113,0.12)', icon: '⚠️' },
  puantaj:      { label: 'Puantaj',      renk: '#34D399', bg: 'rgba(52,211,153,0.12)', icon: '👷' },
  aylik_ozet:   { label: 'Aylık Özet',   renk: '#60A5FA', bg: 'rgba(96,165,250,0.12)', icon: '📊' },
  diger:        { label: 'Diğer',        renk: '#94A3B8', bg: 'rgba(148,163,184,0.08)', icon: '📁' },
};

const FORMAT_ICON: Record<string, string> = {
  xlsx: '📗',
  docx: '📘',
  pdf:  '📕',
};

function TipBadge({ tip }: { tip: string | null }) {
  const meta = TIP_ETIKET[tip ?? 'diger'] ?? TIP_ETIKET.diger;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: meta.bg, color: meta.renk,
      border: `1px solid ${meta.renk}30`,
      borderRadius: 20, padding: '3px 10px',
      fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {meta.icon} {meta.label}
    </span>
  );
}

export default function TaslakPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [sablonlar, setSablonlar] = useState<SablonResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [siliniyor, setSiliniyor] = useState<string | null>(null);

  // Upload modal state
  const [uploadAcik, setUploadAcik] = useState(false);
  const [uploadDosya, setUploadDosya] = useState<File | null>(null);
  const [uploadIsim, setUploadIsim] = useState('');
  const [uploadTip, setUploadTip] = useState<string>('gunluk_rapor');
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);

  // Filtre
  const [filtreTip, setFiltreTip] = useState<string>('');

  const fetchSablonlar = () => {
    setLoading(true);
    api.getSablonlar()
      .then(setSablonlar)
      .catch(() => setSablonlar([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchSablonlar(); }, []);

  const handleSil = async (id: string, isim: string) => {
    if (!window.confirm(`"${isim}" şablonu silinsin mi?`)) return;
    setSiliniyor(id);
    try {
      await api.deleteSablon(id);
      setSablonlar(prev => prev.filter(s => s.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Silme başarısız');
    } finally {
      setSiliniyor(null);
    }
  };

  const handleDosyaSec = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploadDosya(f);
    if (!uploadIsim) setUploadIsim(f.name.replace(/\.[^.]+$/, ''));
    setUploadAcik(true);
  };

  const handleUpload = async () => {
    if (!uploadDosya || !uploadIsim.trim()) {
      setUploadErr('Dosya adı zorunludur');
      return;
    }
    setUploading(true);
    setUploadErr(null);
    try {
      const fd = new FormData();
      fd.append('dosya', uploadDosya);
      fd.append('isim', uploadIsim.trim());
      fd.append('tip', uploadTip);
      await api.uploadSablon(fd);
      setUploadAcik(false);
      setUploadDosya(null);
      setUploadIsim('');
      setUploadTip('gunluk_rapor');
      fetchSablonlar();
    } catch (e: unknown) {
      setUploadErr(e instanceof Error ? e.message : 'Yükleme başarısız');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleIndir = async (sablon: SablonResponse) => {
    // Şablon dosyasını indir — backend /api/v1/templates/{id} GET varsa kullan, yoksa dosya_yolu'ndan al
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}/api/v1/templates/${sablon.id}/download`,
        { headers: { Authorization: `Bearer ${localStorage.getItem('access_token') ?? ''}` } }
      );
      if (!res.ok) throw new Error('İndirme başarısız');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = sablon.isim + (sablon.format ? `.${sablon.format}` : '');
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Fallback — doğrudan yol
      setError('İndirme başarısız. Dosya sunucuda bulunamadı.');
    }
  };

  const gosterilen = filtreTip
    ? sablonlar.filter(s => (s.tip ?? 'diger') === filtreTip)
    : sablonlar;

  return (
    <div className="min-h-screen bg-[#0E1117] px-4 py-5 pb-28">

      {/* Üst bar */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="text-[#94A3B8] hover:text-[#F1F5F9] text-sm transition-colors">
            ← Geri
          </button>
          <h1 className="text-[#F1F5F9] text-xl font-bold font-[var(--font-syne)]">Taslaklar</h1>
        </div>

        {/* Yükle butonu */}
        <label
          className="flex items-center gap-1.5 bg-[#F59E0B] text-black text-sm font-semibold px-4 py-2 rounded-xl cursor-pointer hover:bg-[#D97706] transition-colors"
        >
          + Şablon Ekle
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.docx,.doc,.pdf,.csv,.txt"
            className="hidden"
            onChange={handleDosyaSec}
          />
        </label>
      </div>

      <p className="text-[#64748B] text-xs mb-5">
        Günlük rapor, hakediş, İSG formu gibi tekrar kullanacağınız dosya şablonlarını buraya yükleyin.
      </p>

      {/* Hata */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4 flex items-center justify-between">
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 text-lg leading-none">×</button>
        </div>
      )}

      {/* Tip filtresi */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 4, marginBottom: 16 }}>
        <button
          onClick={() => setFiltreTip('')}
          style={{
            flexShrink: 0, padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
            background: !filtreTip ? '#F59E0B' : '#1E2636',
            color: !filtreTip ? '#000' : '#94A3B8',
            border: `1px solid ${!filtreTip ? '#F59E0B' : 'rgba(255,255,255,0.07)'}`,
            cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          Tümü ({sablonlar.length})
        </button>
        {Object.entries(TIP_ETIKET).map(([key, meta]) => {
          const sayi = sablonlar.filter(s => (s.tip ?? 'diger') === key).length;
          if (sayi === 0) return null;
          return (
            <button key={key} onClick={() => setFiltreTip(filtreTip === key ? '' : key)}
              style={{
                flexShrink: 0, padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                background: filtreTip === key ? meta.bg : '#1E2636',
                color: filtreTip === key ? meta.renk : '#94A3B8',
                border: `1px solid ${filtreTip === key ? meta.renk + '60' : 'rgba(255,255,255,0.07)'}`,
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {meta.icon} {meta.label} ({sayi})
            </button>
          );
        })}
      </div>

      {/* Liste */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="bg-[#1E2636] rounded-2xl h-20 animate-pulse" />)}
        </div>
      ) : gosterilen.length === 0 ? (
        <div className="bg-[#1E2636] rounded-2xl p-10 text-center border border-white/[0.07]">
          <span className="text-4xl block mb-3">📂</span>
          <p className="text-[#F1F5F9] text-sm font-medium mb-1">Henüz şablon yüklenmedi</p>
          <p className="text-[#64748B] text-xs mb-4">Tekrar kullanacağınız Excel, Word veya PDF dosyalarını ekleyin</p>
          <label className="inline-flex items-center gap-2 bg-[#F59E0B] text-black text-sm font-semibold px-4 py-2.5 rounded-xl cursor-pointer">
            + İlk Şablonu Ekle
            <input type="file" accept=".xlsx,.xls,.docx,.doc,.pdf" className="hidden" onChange={handleDosyaSec} />
          </label>
        </div>
      ) : (
        <div className="space-y-3">
          {gosterilen.map(s => (
            <div key={s.id} className="bg-[#1E2636] rounded-2xl border border-white/[0.07] p-4">
              <div className="flex items-start gap-3">
                {/* Format ikonu */}
                <div style={{
                  width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                  background: '#252F42', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22,
                }}>
                  {FORMAT_ICON[s.format] ?? '📄'}
                </div>

                {/* Bilgiler */}
                <div className="flex-1 min-w-0">
                  <p className="text-[#F1F5F9] text-sm font-semibold truncate">{s.isim}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <TipBadge tip={s.tip ?? null} />
                    <span style={{ color: '#475569', fontSize: 11, fontWeight: 500 }}>
                      {s.format?.toUpperCase()}
                    </span>
                    {!s.aktif && (
                      <span style={{ color: '#64748B', fontSize: 10 }}>• Pasif</span>
                    )}
                  </div>
                </div>

                {/* Aksiyonlar */}
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleIndir(s)}
                    style={{
                      background: '#252F42', color: '#94A3B8',
                      border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: 10, padding: '7px 12px',
                      fontSize: 12, cursor: 'pointer',
                    }}
                    title="İndir"
                  >
                    ⬇
                  </button>
                  <button
                    onClick={() => handleSil(s.id, s.isim)}
                    disabled={siliniyor === s.id}
                    style={{
                      background: 'rgba(239,68,68,0.1)', color: '#F87171',
                      border: '1px solid rgba(239,68,68,0.2)',
                      borderRadius: 10, padding: '7px 12px',
                      fontSize: 12, cursor: 'pointer',
                      opacity: siliniyor === s.id ? 0.5 : 1,
                    }}
                    title="Sil"
                  >
                    🗑
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {uploadAcik && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => { setUploadAcik(false); setUploadDosya(null); setUploadIsim(''); }}
        >
          <div
            style={{ background: '#161B26', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 480, borderTop: '1px solid rgba(255,255,255,0.08)', padding: '20px 20px 36px' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ width: 40, height: 4, background: '#2A3447', borderRadius: 4, margin: '0 auto 16px' }} />
            <h2 style={{ color: '#F1F5F9', fontSize: 17, fontWeight: 700, fontFamily: 'Syne, sans-serif', marginBottom: 20 }}>
              Şablon Yükle
            </h2>

            {/* Seçilen dosya */}
            {uploadDosya && (
              <div style={{ background: '#1E2636', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 12, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>
                  {FORMAT_ICON[uploadDosya.name.split('.').pop() ?? ''] ?? '📄'}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: '#F1F5F9', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {uploadDosya.name}
                  </p>
                  <p style={{ color: '#64748B', fontSize: 11 }}>
                    {(uploadDosya.size / 1024).toFixed(0)} KB
                  </p>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* İsim */}
              <div>
                <label style={{ color: '#94A3B8', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6 }}>ŞABLON ADI *</label>
                <input
                  value={uploadIsim}
                  onChange={e => setUploadIsim(e.target.value)}
                  placeholder="ör: Günlük Rapor Şablonu - Haziran"
                  autoFocus
                  style={{ width: '100%', background: '#1E2636', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '11px 14px', color: '#F1F5F9', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              {/* Tip */}
              <div>
                <label style={{ color: '#94A3B8', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6 }}>ŞABLON TİPİ</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {Object.entries(TIP_ETIKET).map(([key, meta]) => (
                    <button
                      key={key}
                      onClick={() => setUploadTip(key)}
                      style={{
                        padding: '7px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        background: uploadTip === key ? meta.bg : '#1E2636',
                        color: uploadTip === key ? meta.renk : '#64748B',
                        border: `1px solid ${uploadTip === key ? meta.renk + '60' : 'rgba(255,255,255,0.07)'}`,
                      }}
                    >
                      {meta.icon} {meta.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {uploadErr && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px', color: '#FCA5A5', fontSize: 13, marginTop: 14 }}>
                {uploadErr}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={handleUpload} disabled={uploading}
                style={{ flex: 1, background: uploading ? 'rgba(245,158,11,0.5)' : '#F59E0B', color: '#000', borderRadius: 14, padding: '13px', fontWeight: 700, fontSize: 15, border: 'none', cursor: uploading ? 'default' : 'pointer', fontFamily: 'Syne, sans-serif' }}>
                {uploading ? 'Yükleniyor...' : 'Kaydet'}
              </button>
              <button onClick={() => { setUploadAcik(false); setUploadDosya(null); setUploadIsim(''); }}
                style={{ flex: 1, background: '#1E2636', color: '#64748B', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '13px', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>
                İptal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
