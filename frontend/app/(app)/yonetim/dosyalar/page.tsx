'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { MedyaDosyasi } from '@/types';
import { tokenStore } from '@/lib/auth';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

// ───────────────────────────────────────────────
// Yardımcı fonksiyonlar
// ───────────────────────────────────────────────

function formatBoyut(byte: number): string {
  if (byte < 1024) return byte + ' B';
  if (byte < 1024 * 1024) return (byte / 1024).toFixed(1) + ' KB';
  return (byte / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatTarih(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

type DosyaTip = 'tumu' | 'pdf' | 'excel' | 'word' | 'diger';

function getMimeTip(d: MedyaDosyasi): DosyaTip {
  const mime = (d.mime_type ?? '').toLowerCase();
  const ad = (d.dosya_adi ?? '').toLowerCase();
  if (mime.includes('pdf') || ad.endsWith('.pdf')) return 'pdf';
  if (
    mime.includes('spreadsheet') ||
    mime.includes('excel') ||
    ad.endsWith('.xlsx') ||
    ad.endsWith('.xls') ||
    ad.endsWith('.csv')
  )
    return 'excel';
  if (
    mime.includes('word') ||
    mime.includes('document') ||
    ad.endsWith('.docx') ||
    ad.endsWith('.doc')
  )
    return 'word';
  return 'diger';
}

interface DosyaIkonu {
  emoji: string;
  color: string;
  bg: string;
}

function getDosyaIkonu(tip: DosyaTip): DosyaIkonu {
  switch (tip) {
    case 'pdf':
      return { emoji: 'PDF', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' };
    case 'excel':
      return { emoji: 'XLS', color: '#22C55E', bg: 'rgba(34,197,94,0.12)' };
    case 'word':
      return { emoji: 'DOC', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' };
    default:
      return { emoji: 'FILE', color: '#94A3B8', bg: 'rgba(148,163,184,0.12)' };
  }
}

// ───────────────────────────────────────────────
// Skeleton
// ───────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="bg-[#1E2636] rounded-2xl h-20 animate-pulse border border-white/[0.07]"
        />
      ))}
    </div>
  );
}

// ───────────────────────────────────────────────
// Ana Sayfa
// ───────────────────────────────────────────────

export default function DosyalarPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dosyalar, setDosyalar] = useState<MedyaDosyasi[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aktifTab, setAktifTab] = useState<DosyaTip>('tumu');
  const [aramaMetni, setAramaMetni] = useState('');
  const [siliniyorId, setSiliniyorId] = useState<string | null>(null);

  const fetchDosyalar = () => {
    setLoading(true);
    api
      .getMedya(undefined, 'belge')
      .then(setDosyalar)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'Yükleme hatası')
      )
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDosyalar();
  }, []);

  // ── Filtrele ──────────────────────────────────
  const goruntulenecek = dosyalar.filter((d) => {
    const tabUygun =
      aktifTab === 'tumu' ? true : getMimeTip(d) === aktifTab;
    const aramaUygun = aramaMetni
      ? (d.dosya_adi ?? '').toLowerCase().includes(aramaMetni.toLowerCase())
      : true;
    return tabUygun && aramaUygun;
  });

  // ── Upload ────────────────────────────────────
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('dosya', file);
        await api.uploadMedya(fd);
      }
      fetchDosyalar();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Yükleme başarısız');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── İndir ─────────────────────────────────────
  const handleIndir = async (d: MedyaDosyasi) => {
    try {
      const token = tokenStore.getAccess();
      const res = await fetch(`${BASE}/api/v1/media/${d.id}/view`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('İndirme başarısız');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = d.dosya_adi ?? 'dosya';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'İndirme hatası');
    }
  };

  // ── Sil ───────────────────────────────────────
  const handleSil = async (id: string) => {
    setSiliniyorId(id);
    try {
      await api.deleteMedya(id);
      setDosyalar((prev) => prev.filter((d) => d.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Silme hatası');
    } finally {
      setSiliniyorId(null);
    }
  };

  // ── Tab sayıları ──────────────────────────────
  const tabSayilari: Record<DosyaTip, number> = {
    tumu: dosyalar.length,
    pdf: dosyalar.filter((d) => getMimeTip(d) === 'pdf').length,
    excel: dosyalar.filter((d) => getMimeTip(d) === 'excel').length,
    word: dosyalar.filter((d) => getMimeTip(d) === 'word').length,
    diger: dosyalar.filter((d) => getMimeTip(d) === 'diger').length,
  };

  const TABS: { key: DosyaTip; label: string }[] = [
    { key: 'tumu', label: 'Tümü' },
    { key: 'pdf', label: 'PDF' },
    { key: 'excel', label: 'Excel' },
    { key: 'word', label: 'Word' },
    { key: 'diger', label: 'Diğer' },
  ];

  return (
    <div className="min-h-screen bg-[#0E1117] px-4 py-5 pb-28">
      {/* Geri + Başlık */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center bg-[#1E2636] rounded-xl border border-white/[0.07] text-[#94A3B8] hover:text-[#F1F5F9] transition-colors"
          aria-label="Geri"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-[#F1F5F9] text-xl font-bold">Dosya Yönetimi</h1>
          {!loading && (
            <p className="text-[#94A3B8] text-xs mt-0.5">
              {goruntulenecek.length} dosya
            </p>
          )}
        </div>
      </div>

      {/* Hata banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4 flex items-center justify-between">
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-300 ml-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Arama */}
      <div className="relative mb-4">
        <svg
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
          />
        </svg>
        <input
          type="text"
          placeholder="Dosya adına göre ara..."
          value={aramaMetni}
          onChange={(e) => setAramaMetni(e.target.value)}
          className="w-full bg-[#252F42] border border-white/[0.07] rounded-xl pl-10 pr-4 py-2.5 text-[#F1F5F9] text-sm placeholder-[#94A3B8] focus:outline-none focus:border-[#F59E0B]/60"
        />
      </div>

      {/* Tab filtreleri */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-4 scrollbar-hide">
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setAktifTab(key)}
            className={`flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors border ${
              aktifTab === key
                ? 'bg-[#F59E0B] text-black border-[#F59E0B]'
                : 'bg-[#1E2636] text-[#94A3B8] border-white/[0.07] hover:text-[#F1F5F9]'
            }`}
          >
            {label}
            {tabSayilari[key] > 0 && (
              <span
                className={`ml-1.5 ${aktifTab === key ? 'text-black/70' : 'text-[#94A3B8]'}`}
              >
                {tabSayilari[key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Dosya listesi */}
      {loading ? (
        <Skeleton />
      ) : goruntulenecek.length === 0 ? (
        <div className="bg-[#1E2636] rounded-2xl p-12 text-center border border-white/[0.07]">
          <div className="text-4xl mb-3">📁</div>
          <p className="text-[#94A3B8] text-sm">Henüz dosya yüklenmedi</p>
          <label className="mt-3 inline-block text-[#F59E0B] text-sm font-medium hover:underline cursor-pointer">
            İlk dosyayı yükle →
            <input
              type="file"
              accept=".pdf,.xlsx,.xls,.docx,.doc,.txt,.csv"
              multiple
              className="hidden"
              onChange={handleUpload}
            />
          </label>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {goruntulenecek.map((d) => {
            const tip = getMimeTip(d);
            const ikon = getDosyaIkonu(tip);
            return (
              <div
                key={d.id}
                className="bg-[#1E2636] rounded-2xl border border-white/[0.07] px-4 py-3 flex items-center gap-3"
              >
                {/* İkon */}
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 text-[10px] font-black"
                  style={{ background: ikon.bg, color: ikon.color }}
                >
                  {ikon.emoji}
                </div>

                {/* Meta */}
                <div className="flex-1 min-w-0">
                  <p className="text-[#F1F5F9] text-sm font-medium truncate">
                    {d.dosya_adi ?? 'Adsız Dosya'}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {d.boyut_byte != null && (
                      <span className="text-[#94A3B8] text-xs">
                        {formatBoyut(d.boyut_byte)}
                      </span>
                    )}
                    {d.boyut_byte != null && d.created_at && (
                      <span className="text-[#94A3B8] text-xs">·</span>
                    )}
                    {d.created_at && (
                      <span className="text-[#94A3B8] text-xs">
                        {formatTarih(d.created_at)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Aksiyonlar */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* İndir */}
                  <button
                    onClick={() => handleIndir(d)}
                    className="w-8 h-8 flex items-center justify-center bg-[#252F42] rounded-lg text-[#94A3B8] hover:text-[#F59E0B] transition-colors border border-white/[0.07]"
                    aria-label="İndir"
                    title="İndir"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                    </svg>
                  </button>

                  {/* Sil */}
                  <button
                    onClick={() => handleSil(d.id)}
                    disabled={siliniyorId === d.id}
                    className="w-8 h-8 flex items-center justify-center bg-red-500/10 rounded-lg text-red-400 hover:bg-red-500/20 transition-colors border border-red-500/20 disabled:opacity-50"
                    aria-label="Sil"
                    title="Sil"
                  >
                    {siliniyorId === d.id ? (
                      <div className="w-3.5 h-3.5 border-2 border-red-400/40 border-t-red-400 rounded-full animate-spin" />
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FAB — Dosya Yükle */}
      <label
        className={`fixed bottom-24 right-5 w-14 h-14 bg-[#F59E0B] rounded-full flex items-center justify-center shadow-lg shadow-[#F59E0B]/30 cursor-pointer transition-opacity ${
          uploading ? 'opacity-60 pointer-events-none' : 'hover:bg-[#D97706]'
        }`}
        aria-label="Dosya Yükle"
      >
        {uploading ? (
          <div className="w-6 h-6 border-2 border-black/40 border-t-black rounded-full animate-spin" />
        ) : (
          <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.xlsx,.xls,.docx,.doc,.txt,.csv"
          multiple
          className="hidden"
          onChange={handleUpload}
        />
      </label>
    </div>
  );
}
