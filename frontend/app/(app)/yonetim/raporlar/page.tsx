'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { SantiyeResponse, RaporResponse } from '@/types';
import { tokenStore } from '@/lib/auth';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

// ───────────────────────────────────────────────
// Yardımcı
// ───────────────────────────────────────────────

function formatTarih(iso: string): string {
  return new Date(iso).toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

type DurumFiltre = 'tumu' | 'taslak' | 'onaylandi';

interface DurumBadge {
  label: string;
  bg: string;
  color: string;
}

function getDurumBadge(durum: RaporResponse['durum']): DurumBadge {
  switch (durum) {
    case 'taslak':
      return { label: 'Taslak', bg: 'rgba(245,158,11,0.15)', color: '#F59E0B' };
    case 'onaylandi':
      return { label: 'Onaylandı', bg: 'rgba(34,197,94,0.15)', color: '#22C55E' };
    case 'iptal':
      return { label: 'İptal', bg: 'rgba(239,68,68,0.15)', color: '#EF4444' };
    case 'hata':
      return { label: 'Hata', bg: 'rgba(239,68,68,0.15)', color: '#EF4444' };
    default:
      return { label: durum, bg: 'rgba(148,163,184,0.15)', color: '#94A3B8' };
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
          className="bg-[#1E2636] rounded-2xl h-24 animate-pulse border border-white/[0.07]"
        />
      ))}
    </div>
  );
}

// ───────────────────────────────────────────────
// Ana Sayfa
// ───────────────────────────────────────────────

export default function RaporlarPage() {
  const router = useRouter();

  const [santiyeler, setSantiyeler] = useState<SantiyeResponse[]>([]);
  const [secilenSantiye, setSecilenSantiye] = useState<string>('');
  const [raporlar, setRaporlar] = useState<RaporResponse[]>([]);
  const [santiyeLoading, setSantiyeLoading] = useState(true);
  const [raporLoading, setRaporLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aktifFiltre, setAktifFiltre] = useState<DurumFiltre>('tumu');
  const [onaylaniyor, setOnaylaniyor] = useState<string | null>(null);
  const [indiriliyor, setIndiriliyor] = useState<string | null>(null);

  // Şantiyeleri yükle — yüklenince ilk şantiyeyi otomatik seç
  useEffect(() => {
    api
      .getSantiyeler()
      .then((data) => {
        setSantiyeler(data);
        if (data.length > 0 && !secilenSantiye) {
          setSecilenSantiye(data[0].id);
        }
      })
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'Şantiyeler yüklenemedi')
      )
      .finally(() => setSantiyeLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Şantiye seçilince raporları yükle
  useEffect(() => {
    if (!secilenSantiye) {
      setRaporlar([]);
      return;
    }
    setRaporLoading(true);
    setError(null);
    api
      .getRaporlar(secilenSantiye)
      .then(setRaporlar)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'Raporlar yüklenemedi')
      )
      .finally(() => setRaporLoading(false));
  }, [secilenSantiye]);

  // ── Filtrele ──────────────────────────────────
  const goruntulenecek = raporlar.filter((r) => {
    if (aktifFiltre === 'tumu') return true;
    if (aktifFiltre === 'taslak') return r.durum === 'taslak';
    if (aktifFiltre === 'onaylandi') return r.durum === 'onaylandi';
    return true;
  });

  // ── Onayla ───────────────────────────────────
  const handleOnayla = async (rapor: RaporResponse) => {
    setOnaylaniyor(rapor.id);
    setError(null);
    try {
      const guncellenen = await api.approveRapor(rapor.id);
      setRaporlar((prev) =>
        prev.map((r) => (r.id === rapor.id ? guncellenen : r))
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Onaylama başarısız');
    } finally {
      setOnaylaniyor(null);
    }
  };

  // ── İndir ─────────────────────────────────────
  const handleIndir = async (rapor: RaporResponse) => {
    setIndiriliyor(rapor.id);
    setError(null);
    try {
      const token = tokenStore.getAccess();
      const res = await fetch(
        `${BASE}/api/v1/reports/${rapor.id}/download`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (!res.ok) throw new Error('İndirme başarısız');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rapor_${rapor.tarih}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'İndirme hatası');
    } finally {
      setIndiriliyor(null);
    }
  };

  // ── Filtre sayıları ───────────────────────────
  const filtreSayilari = {
    tumu: raporlar.length,
    taslak: raporlar.filter((r) => r.durum === 'taslak').length,
    onaylandi: raporlar.filter((r) => r.durum === 'onaylandi').length,
  };

  const FILTRELER: { key: DurumFiltre; label: string }[] = [
    { key: 'tumu', label: 'Tümü' },
    { key: 'taslak', label: 'Taslak' },
    { key: 'onaylandi', label: 'Onaylandı' },
  ];

  return (
    <div className="min-h-screen bg-[#0E1117] px-4 py-5 pb-28">
      {/* Geri + Başlık */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
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
            <h1 className="text-[#F1F5F9] text-xl font-bold">Raporlar</h1>
            {secilenSantiye && !raporLoading && (
              <p className="text-[#94A3B8] text-xs mt-0.5">
                {raporlar.length} rapor
              </p>
            )}
          </div>
        </div>
        <Link
          href="/yonetim/taslaklar"
          className="flex items-center gap-1.5 bg-[#F59E0B] text-black text-xs font-semibold px-3.5 py-2 rounded-xl hover:bg-[#D97706] transition-colors"
        >
          + Yeni Rapor
        </Link>
      </div>

      {/* Hata banner */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4 flex items-center justify-between">
          <p className="text-red-400 text-sm">{error}</p>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 ml-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Şantiye seçici */}
      <div className="mb-4">
        <label className="block text-[#94A3B8] text-xs mb-1.5 font-medium">
          Şantiye Seç
        </label>
        <select
          className="w-full bg-[#252F42] border border-white/[0.07] rounded-xl px-4 py-3 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#F59E0B]/60"
          value={secilenSantiye}
          onChange={(e) => setSecilenSantiye(e.target.value)}
          disabled={santiyeLoading}
        >
          <option value="">— Şantiye Seçin —</option>
          {santiyeler.map((s) => (
            <option key={s.id} value={s.id}>
              {s.isim}
            </option>
          ))}
        </select>
      </div>

      {/* Filtre çipleri — sadece şantiye seçiliyse göster */}
      {secilenSantiye && !raporLoading && raporlar.length > 0 && (
        <div className="flex gap-2 mb-4">
          {FILTRELER.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setAktifFiltre(key)}
              className={`flex-shrink-0 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors border ${
                aktifFiltre === key
                  ? 'bg-[#F59E0B] text-black border-[#F59E0B]'
                  : 'bg-[#1E2636] text-[#94A3B8] border-white/[0.07] hover:text-[#F1F5F9]'
              }`}
            >
              {label}
              {filtreSayilari[key] > 0 && (
                <span className={`ml-1.5 ${aktifFiltre === key ? 'text-black/70' : 'text-[#94A3B8]'}`}>
                  {filtreSayilari[key]}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* İçerik */}
      {!secilenSantiye ? (
        <div className="bg-[#1E2636] rounded-2xl p-12 text-center border border-white/[0.07]">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-[#94A3B8] text-sm">
            Raporları görmek için şantiye seçin
          </p>
        </div>
      ) : raporLoading ? (
        <Skeleton />
      ) : goruntulenecek.length === 0 ? (
        <div className="bg-[#1E2636] rounded-2xl p-12 text-center border border-white/[0.07]">
          <div className="text-4xl mb-3">📋</div>
          <p className="text-[#94A3B8] text-sm mb-4">
            {aktifFiltre !== 'tumu'
              ? 'Bu filtrede rapor bulunamadı'
              : 'Bu şantiyede rapor bulunamadı'}
          </p>
          <Link
            href="/yonetim/taslaklar"
            className="inline-flex items-center gap-2 bg-[#F59E0B] text-black text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#D97706] transition-colors"
          >
            Yeni Rapor Oluştur
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {goruntulenecek.map((r) => {
            const badge = getDurumBadge(r.durum);
            return (
              <div
                key={r.id}
                className="bg-[#1E2636] rounded-2xl border border-white/[0.07] px-4 py-3"
              >
                <div className="flex items-start gap-3">
                  {/* Sol: tarih */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[#F59E0B] text-base font-bold">
                      {formatTarih(r.tarih)}
                    </p>

                    {/* Durum badge */}
                    <div className="flex items-center gap-2 mt-1.5">
                      <span
                        className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                        style={{ background: badge.bg, color: badge.color }}
                      >
                        {badge.label}
                      </span>
                      {r.sablon_id && (
                        <span className="text-[#94A3B8] text-xs truncate">
                          Şablon: {r.sablon_id.slice(0, 8)}…
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Sağ: butonlar */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* İndir */}
                    <button
                      onClick={() => handleIndir(r)}
                      disabled={indiriliyor === r.id}
                      className="w-8 h-8 flex items-center justify-center bg-[#252F42] rounded-lg text-[#94A3B8] hover:text-[#F59E0B] transition-colors border border-white/[0.07] disabled:opacity-50"
                      aria-label="İndir"
                      title="Raporu İndir"
                    >
                      {indiriliyor === r.id ? (
                        <div className="w-3.5 h-3.5 border-2 border-[#94A3B8]/40 border-t-[#94A3B8] rounded-full animate-spin" />
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
                        </svg>
                      )}
                    </button>

                    {/* Onayla — sadece taslaklar için */}
                    {r.durum === 'taslak' && (
                      <button
                        onClick={() => handleOnayla(r)}
                        disabled={onaylaniyor === r.id}
                        className="flex items-center gap-1.5 bg-[#22C55E]/15 border border-[#22C55E]/30 text-[#22C55E] text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-[#22C55E]/25 transition-colors disabled:opacity-50"
                        aria-label="Onayla"
                      >
                        {onaylaniyor === r.id ? (
                          <div className="w-3 h-3 border-2 border-[#22C55E]/40 border-t-[#22C55E] rounded-full animate-spin" />
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        Onayla
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
