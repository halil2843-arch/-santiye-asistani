'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { Aktivite, ProjeResponse } from '@/types';

// ── Renk yardımcısı ───────────────────────────────────────────────────────────

const RENK_MAP: Record<string, string> = {
  green: 'bg-green-500',
  amber: 'bg-amber-400',
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  gray: 'bg-[#94A3B8]',
};

function RenkDot({ renk }: { renk: string }) {
  const cls = RENK_MAP[renk] ?? RENK_MAP.gray;
  return <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${cls}`} />;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-[#1E2636] rounded-xl p-3 animate-pulse">
          <div className="h-3 bg-[#2A3447] rounded w-3/4 mb-2" />
          <div className="h-2 bg-[#2A3447] rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}

// ── Aktivite Ekleme Modalı ────────────────────────────────────────────────────

interface AktiviteModalProps {
  sutunBaslik: string;
  onClose: () => void;
  onKaydet: (baslik: string, aciklama: string) => Promise<void>;
}

function AktiviteModal({ sutunBaslik, onClose, onKaydet }: AktiviteModalProps) {
  const [baslik, setBaslik] = useState('');
  const [aciklama, setAciklama] = useState('');
  const [saving, setSaving] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  async function handleKaydet() {
    if (!baslik.trim()) {
      setHata('Başlık zorunludur');
      return;
    }
    setSaving(true);
    setHata(null);
    try {
      await onKaydet(baslik.trim(), aciklama.trim());
      onClose();
    } catch (e: unknown) {
      setHata(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-4 pb-4 sm:pb-0">
      <div className="w-full max-w-md bg-[#1A2235] rounded-2xl border border-white/[0.09] p-5 shadow-2xl">
        {/* Başlık */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[#F1F5F9] text-base font-semibold">
            Yeni Görev — <span className="text-amber-400">{sutunBaslik}</span>
          </h2>
          <button
            onClick={onClose}
            className="text-[#64748B] hover:text-[#94A3B8] transition-colors text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Hata */}
        {hata && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2 mb-3">
            <p className="text-red-400 text-xs">{hata}</p>
          </div>
        )}

        {/* Başlık inputu */}
        <div className="mb-3">
          <label className="text-[#94A3B8] text-xs mb-1 block">Başlık *</label>
          <input
            type="text"
            value={baslik}
            onChange={(e) => setBaslik(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleKaydet()}
            placeholder="Görev başlığı..."
            className="w-full bg-[#252F42] border border-white/[0.07] rounded-xl px-3 py-2.5 text-[#F1F5F9] text-sm placeholder:text-[#4B5563] focus:outline-none focus:border-amber-400/50 transition-colors"
            autoFocus
          />
        </div>

        {/* Açıklama textarea */}
        <div className="mb-5">
          <label className="text-[#94A3B8] text-xs mb-1 block">Açıklama</label>
          <textarea
            value={aciklama}
            onChange={(e) => setAciklama(e.target.value)}
            placeholder="İsteğe bağlı açıklama..."
            rows={3}
            className="w-full bg-[#252F42] border border-white/[0.07] rounded-xl px-3 py-2.5 text-[#F1F5F9] text-sm placeholder:text-[#4B5563] focus:outline-none focus:border-amber-400/50 transition-colors resize-none"
          />
        </div>

        {/* Butonlar */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-white/[0.09] text-[#94A3B8] text-sm hover:text-[#F1F5F9] hover:border-white/20 transition-colors"
          >
            İptal
          </button>
          <button
            onClick={handleKaydet}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-amber-400 text-[#0E1117] text-sm font-semibold hover:bg-amber-300 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-[#0E1117]/40 border-t-[#0E1117] rounded-full animate-spin" />
                Kaydediliyor...
              </>
            ) : (
              'Kaydet'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Kanban Sütun ─────────────────────────────────────────────────────────────

type SutunTip = 'yapilacak' | 'devam' | 'tamamlandi';

const SUTUN_META: Record<SutunTip, { baslik: string; renkCls: string; bos: string }> = {
  yapilacak: {
    baslik: 'Yapılacak',
    renkCls: 'text-[#94A3B8] border-[#94A3B8]/30',
    bos: 'Henüz görev yok',
  },
  devam: {
    baslik: 'Devam Ediyor',
    renkCls: 'text-amber-400 border-amber-400/30',
    bos: 'Devam eden görev yok',
  },
  tamamlandi: {
    baslik: 'Tamamlandı',
    renkCls: 'text-green-400 border-green-400/30',
    bos: 'Tamamlanan görev yok',
  },
};

function KanbanSutun({
  tip,
  aktiviteler,
  onYeniGörev,
}: {
  tip: SutunTip;
  aktiviteler: Aktivite[];
  onYeniGörev: (tip: SutunTip) => void;
}) {
  const meta = SUTUN_META[tip];

  return (
    <div className="flex-1 min-w-0">
      {/* Sütun başlık */}
      <div className={`flex items-center justify-between mb-3 pb-2 border-b ${meta.renkCls}`}>
        <span className={`text-xs font-semibold uppercase tracking-wide ${meta.renkCls.split(' ')[0]}`}>
          {meta.baslik}
        </span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-white/[0.05] ${meta.renkCls.split(' ')[0]}`}>
          {aktiviteler.length}
        </span>
      </div>

      {/* Kartlar */}
      {aktiviteler.length === 0 ? (
        <div className="bg-[#1E2636]/50 border border-dashed border-white/[0.07] rounded-xl p-4 text-center">
          <p className="text-[#4B5563] text-xs">{meta.bos}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {aktiviteler.map((a) => (
            <div
              key={a.id}
              className="bg-[#1E2636] rounded-xl border border-white/[0.07] p-3 hover:border-white/20 transition-colors"
            >
              <div className="flex items-start gap-2">
                <RenkDot renk={a.renk ?? 'gray'} />
                <div className="flex-1 min-w-0">
                  <p className="text-[#F1F5F9] text-xs font-medium leading-snug line-clamp-2">
                    {a.baslik ?? '—'}
                  </p>
                  {a.aciklama && (
                    <p className="text-[#64748B] text-[10px] mt-1 line-clamp-2 leading-snug">
                      {a.aciklama}
                    </p>
                  )}
                  {a.created_at && (
                    <p className="text-[#4B5563] text-[9px] mt-1.5">
                      {new Date(a.created_at).toLocaleDateString('tr-TR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                      })}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Yeni Görev Ekle butonu */}
      <button
        onClick={() => onYeniGörev(tip)}
        className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-white/[0.10] text-[#64748B] text-xs hover:text-[#94A3B8] hover:border-white/20 transition-colors"
      >
        <span className="text-base leading-none">+</span>
        Yeni Görev Ekle
      </button>
    </div>
  );
}

// ── Ana Sayfa ─────────────────────────────────────────────────────────────────

export default function IsPlanPage() {
  const router = useRouter();
  const [projeler, setProjeler] = useState<ProjeResponse[]>([]);
  const [secilenProje, setSecilenProje] = useState('');
  const [aktiviteler, setAktiviteler] = useState<Aktivite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [modalAcik, setModalAcik] = useState(false);
  const [modalSutun, setModalSutun] = useState<SutunTip>('yapilacak');

  // Proje listesi
  useEffect(() => {
    api
      .getProjeler()
      .then((list) => {
        setProjeler(list);
        if (list.length > 0) setSecilenProje(list[0].id);
      })
      .catch(() => setProjeler([]));
  }, []);

  // Aktiviteler
  useEffect(() => {
    if (!secilenProje) {
      setAktiviteler([]);
      return;
    }
    setLoading(true);
    setError(null);
    api
      .getAktiviteler(secilenProje)
      .then(setAktiviteler)
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : 'Aktiviteler yüklenemedi');
        setAktiviteler([]);
      })
      .finally(() => setLoading(false));
  }, [secilenProje]);

  // Sütunlara dağıt — tip alanına göre
  const sutunAktivite = (tip: SutunTip): Aktivite[] =>
    aktiviteler.filter((a) => {
      if (!a.tip) return tip === 'yapilacak';
      return a.tip === tip;
    });

  const toplamGrev = aktiviteler.length;

  function handleYeniGorev(tip: SutunTip) {
    setModalSutun(tip);
    setModalAcik(true);
  }

  async function handleKaydet(baslik: string, aciklama: string) {
    const yeni = await api.createAktivite(secilenProje, {
      tip: modalSutun,
      baslik,
      aciklama: aciklama || undefined,
      renk: 'amber',
    });
    // Optimistic update — state'e ekle
    setAktiviteler((prev) => [yeni, ...prev]);
  }

  return (
    <div className="min-h-screen bg-[#0E1117] px-4 py-5 pb-28">
      {/* Modal */}
      {modalAcik && (
        <AktiviteModal
          sutunBaslik={SUTUN_META[modalSutun].baslik}
          onClose={() => setModalAcik(false)}
          onKaydet={handleKaydet}
        />
      )}

      {/* Geri + Başlık */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => router.push('/yonetim')}
          className="text-[#94A3B8] hover:text-[#F1F5F9] text-sm transition-colors"
        >
          ← Yönetim
        </button>
        <span className="text-[#94A3B8]/40">|</span>
        <h1 className="text-[#F1F5F9] text-xl font-bold font-[var(--font-syne)]">İş Planı</h1>
      </div>

      {/* Proje Seçici */}
      <div className="mb-5">
        <select
          value={secilenProje}
          onChange={(e) => setSecilenProje(e.target.value)}
          className="w-full bg-[#252F42] rounded-xl border border-white/[0.07] text-[#F1F5F9] px-4 py-3 text-sm focus:outline-none focus:border-[#F59E0B]/60"
        >
          {projeler.length === 0 && <option value="">Proje bulunamadı</option>}
          {projeler.map((p) => (
            <option key={p.id} value={p.id}>
              {p.isim}
            </option>
          ))}
        </select>
      </div>

      {/* Hata */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Özet */}
      {!loading && toplamGrev > 0 && (
        <div className="flex gap-3 mb-5">
          {(['yapilacak', 'devam', 'tamamlandi'] as SutunTip[]).map((t) => {
            const sayi = sutunAktivite(t).length;
            const meta = SUTUN_META[t];
            return (
              <div
                key={t}
                className="flex-1 bg-[#1E2636] rounded-xl border border-white/[0.07] p-3 text-center"
              >
                <p className={`text-lg font-bold ${meta.renkCls.split(' ')[0]}`}>{sayi}</p>
                <p className="text-[#94A3B8] text-[10px] mt-0.5">{meta.baslik}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Kanban Board */}
      {!secilenProje ? (
        <div className="bg-[#1E2636] rounded-2xl p-10 text-center border border-white/[0.07]">
          <span className="text-4xl block mb-3">📋</span>
          <p className="text-[#94A3B8] text-sm">Görevleri görmek için bir proje seçin</p>
        </div>
      ) : loading ? (
        <div className="space-y-4">
          <Skeleton />
        </div>
      ) : (
        <div className="flex flex-col gap-5 sm:flex-row sm:gap-4">
          {(['yapilacak', 'devam', 'tamamlandi'] as SutunTip[]).map((tip) => (
            <KanbanSutun
              key={tip}
              tip={tip}
              aktiviteler={sutunAktivite(tip)}
              onYeniGörev={handleYeniGorev}
            />
          ))}
        </div>
      )}
    </div>
  );
}
