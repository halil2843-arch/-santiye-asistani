'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import type {
  ProjeResponse,
  ProjeIstatistik,
  StokKalemi,
  IsgKaydi,
  MedyaDosyasi,
  PuantajKaydi,
  Aktivite,
  Toplanti,
  ProjeNot,
  RaporResponse,
  SantiyeResponse,
} from '@/types';

// ─── Renk sabitleri ───────────────────────────────────────────────────────────

const NOT_RENK: Record<string, { border: string; bg: string; dot: string }> = {
  amber: { border: '#F59E0B', bg: 'rgba(245,158,11,0.08)', dot: 'bg-amber-400' },
  green: { border: '#22C55E', bg: 'rgba(34,197,94,0.08)',  dot: 'bg-green-400' },
  red:   { border: '#EF4444', bg: 'rgba(239,68,68,0.08)',  dot: 'bg-red-400'   },
  blue:  { border: '#3B82F6', bg: 'rgba(59,130,246,0.08)', dot: 'bg-blue-400'  },
};

// ─── Yardımcı bileşenler ──────────────────────────────────────────────────────

function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="w-full bg-[#2A3447] rounded-full h-2 overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-to-r from-[#F59E0B] to-[#FBBF24] transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function CircleProgress({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(#F59E0B ${pct * 3.6}deg, #2A3447 0deg)`,
        }}
      />
      <div className="absolute inset-2 bg-[#1E2636] rounded-full" />
      <span className="relative text-[#F59E0B] text-xl font-bold font-[var(--font-syne)]">
        %{pct}
      </span>
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onChange(!checked); }}
      className={`relative w-10 h-5 rounded-full transition-colors focus:outline-none ${
        checked ? 'bg-[#F59E0B]' : 'bg-[#2A3447]'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-[#1E2636] rounded-2xl p-4 animate-pulse">
          <div className="h-4 bg-[#2A3447] rounded w-2/3 mb-2" />
          <div className="h-3 bg-[#2A3447] rounded w-1/3" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ mesaj, icon = '📋' }: { mesaj: string; icon?: string }) {
  return (
    <div className="bg-[#1E2636] rounded-2xl p-10 text-center border border-white/[0.07]">
      <span className="text-4xl block mb-3">{icon}</span>
      <p className="text-[#94A3B8] text-sm">{mesaj}</p>
    </div>
  );
}

function formatBoyut(bytes: number | null) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── ISG renk haritaları ──────────────────────────────────────────────────────

const onemKenarlık: Record<string, string> = {
  kritik: 'border-l-red-500',
  yuksek: 'border-l-orange-500',
  orta:   'border-l-amber-500',
  dusuk:  'border-l-green-500',
};
const onemRenk: Record<string, string> = {
  kritik: 'bg-red-500/20 text-red-400 border-red-500/30',
  yuksek: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  orta:   'bg-amber-500/20 text-amber-400 border-amber-500/30',
  dusuk:  'bg-green-500/20 text-green-400 border-green-500/30',
};
const onemLabel: Record<string, string> = {
  kritik: 'Kritik', yuksek: 'Yüksek', orta: 'Orta', dusuk: 'Düşük',
};
const isgDurumRenk: Record<string, string> = {
  acik:      'bg-red-500/20 text-red-400',
  kapandi:   'bg-green-500/20 text-green-400',
  ertelendi: 'bg-[#2A3447] text-[#94A3B8]',
};
const isgDurumLabel: Record<string, string> = {
  acik: 'Açık', kapandi: 'Kapandı', ertelendi: 'Ertelendi',
};

// ─── Rapor durum renkleri ─────────────────────────────────────────────────────

const raporDurumRenk: Record<string, string> = {
  onaylandi: 'bg-green-500/20 text-green-400 border-green-500/30',
  taslak:    'bg-amber-500/20 text-amber-400 border-amber-500/30',
  hata:      'bg-red-500/20 text-red-400 border-red-500/30',
  iptal:     'bg-[#2A3447] text-[#94A3B8] border-white/[0.07]',
};
const raporDurumLabel: Record<string, string> = {
  onaylandi: 'Onaylandı', taslak: 'Taslak', hata: 'Hata', iptal: 'İptal',
};

// ─── ÖZET SEKMESİ ─────────────────────────────────────────────────────────────

function OzetTab({
  proje,
  istatistik,
  projeId,
  onDuzenleClick,
}: {
  proje: ProjeResponse;
  istatistik: ProjeIstatistik | null;
  projeId: string;
  onDuzenleClick: () => void;
}) {
  const [milestonelar, setMilestonelar] = useState<Aktivite[]>([]);
  const [msLoading, setMsLoading] = useState(true);
  const [msModalAcik, setMsModalAcik] = useState(false);
  const [msBaslik, setMsBaslik] = useState('');
  const [msHedefTarih, setMsHedefTarih] = useState('');
  const [msSaving, setMsSaving] = useState(false);

  const loadMilestones = () => {
    api.getAktiviteler(projeId)
      .then((aktiviteler) => setMilestonelar(aktiviteler.filter((a) => a.tip === 'milestone')))
      .catch(() => setMilestonelar([]))
      .finally(() => setMsLoading(false));
  };

  useEffect(() => { loadMilestones(); }, [projeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMilestoneEkle = async () => {
    if (!msBaslik.trim() || !msHedefTarih) return;
    setMsSaving(true);
    try {
      await api.createMilestone(projeId, { baslik: msBaslik.trim(), hedef_tarih: msHedefTarih });
      setMsModalAcik(false);
      setMsBaslik('');
      setMsHedefTarih('');
      loadMilestones();
    } catch {
      // sessiz
    } finally {
      setMsSaving(false);
    }
  };

  const kalan = (() => {
    if (!proje.bitis_tarihi) return null;
    const diff = new Date(proje.bitis_tarihi).getTime() - Date.now();
    const gun = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return gun;
  })();

  const butceFormatted = proje.butce !== null && proje.butce !== undefined
    ? new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(proje.butce)
    : null;

  const bilgiler: { label: string; value: string | null }[] = [
    { label: 'Durum',        value: proje.durum },
    { label: 'Başlangıç',    value: proje.baslangic_tarihi ? new Date(proje.baslangic_tarihi).toLocaleDateString('tr-TR') : null },
    { label: 'Bitiş',        value: proje.bitis_tarihi ? new Date(proje.bitis_tarihi).toLocaleDateString('tr-TR') : null },
    { label: 'Proje Müdürü', value: proje.proje_muduru },
    { label: 'İl / İlçe',   value: [proje.il, proje.ilce].filter(Boolean).join(' / ') || null },
    { label: 'Bütçe',        value: butceFormatted },
  ];

  return (
    <div className="space-y-5">
      {/* Dashboard kartları — 2x3 grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* İlerleme dairesi */}
        <div className="bg-[#1E2636] rounded-2xl p-4 border border-white/[0.07] flex flex-col items-center justify-center gap-2">
          <CircleProgress value={proje.ilerleme_yuzdesi} />
          <p className="text-[#94A3B8] text-xs text-center">İlerleme</p>
        </div>

        {/* Süre kartı */}
        <div className="bg-[#1E2636] rounded-2xl p-4 border border-white/[0.07] flex flex-col justify-between">
          <p className="text-[#94A3B8] text-xs mb-2">Süre</p>
          {proje.baslangic_tarihi && (
            <p className="text-[#F1F5F9] text-xs">
              <span className="text-[#94A3B8]">Baş:</span>{' '}
              {new Date(proje.baslangic_tarihi).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
            </p>
          )}
          {proje.bitis_tarihi && (
            <p className="text-[#F1F5F9] text-xs mt-0.5">
              <span className="text-[#94A3B8]">Bit:</span>{' '}
              {new Date(proje.bitis_tarihi).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
            </p>
          )}
          {kalan !== null && (
            <p className={`text-sm font-bold mt-2 font-[var(--font-syne)] ${kalan < 0 ? 'text-red-400' : kalan < 30 ? 'text-amber-400' : 'text-green-400'}`}>
              {kalan < 0 ? `${Math.abs(kalan)} gün gecikti` : `${kalan} gün kaldı`}
            </p>
          )}
          {!proje.baslangic_tarihi && !proje.bitis_tarihi && (
            <p className="text-[#94A3B8] text-xs">Tarih belirlenmedi</p>
          )}
        </div>

        {/* Personel kartı */}
        <div className="bg-[#1E2636] rounded-2xl p-4 border border-white/[0.07] flex items-center gap-3">
          <span className="text-2xl">👷</span>
          <div>
            <p className="text-[#F59E0B] text-xl font-bold font-[var(--font-syne)]">
              {istatistik ? istatistik.toplam_personel_bugun : '—'}
            </p>
            <p className="text-[#94A3B8] text-xs">Bugün Personel</p>
          </div>
        </div>

        {/* Bütçe kartı */}
        <div className="bg-[#1E2636] rounded-2xl p-4 border border-white/[0.07] flex items-center gap-3">
          <span className="text-2xl">💰</span>
          <div className="min-w-0">
            <p className="text-[#F59E0B] text-sm font-bold font-[var(--font-syne)] truncate">
              {butceFormatted ?? '—'}
            </p>
            <p className="text-[#94A3B8] text-xs">Toplam Bütçe</p>
          </div>
        </div>

        {/* Stok uyarısı */}
        <div className="bg-[#1E2636] rounded-2xl p-4 border border-white/[0.07] flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className={`text-xl font-bold font-[var(--font-syne)] ${istatistik && istatistik.kritik_stok_sayisi > 0 ? 'text-red-400' : 'text-[#F59E0B]'}`}>
              {istatistik ? istatistik.kritik_stok_sayisi : '—'}
            </p>
            <p className="text-[#94A3B8] text-xs">Kritik Stok</p>
          </div>
        </div>

        {/* ISG */}
        <div className="bg-[#1E2636] rounded-2xl p-4 border border-white/[0.07] flex items-center gap-3">
          <span className="text-2xl">⛑️</span>
          <div>
            <p className={`text-xl font-bold font-[var(--font-syne)] ${istatistik && istatistik.isg_acik_madde > 0 ? 'text-red-400' : 'text-[#F59E0B]'}`}>
              {istatistik ? istatistik.isg_acik_madde : '—'}
            </p>
            <p className="text-[#94A3B8] text-xs">ISG Açık</p>
          </div>
        </div>
      </div>

      {/* Proje Bilgileri */}
      <div className="bg-[#1E2636] rounded-2xl border border-white/[0.07] p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[#F1F5F9] text-sm font-semibold font-[var(--font-syne)]">Proje Bilgileri</h3>
          <button
            onClick={onDuzenleClick}
            className="text-[#F59E0B] text-xs hover:underline"
          >
            Düzenle →
          </button>
        </div>
        <div className="space-y-2.5">
          {bilgiler.map(
            (b) =>
              b.value && (
                <div key={b.label} className="flex items-start justify-between gap-3">
                  <span className="text-[#94A3B8] text-xs flex-shrink-0">{b.label}</span>
                  <span className="text-[#F1F5F9] text-xs text-right font-medium">{b.value}</span>
                </div>
              )
          )}
        </div>
      </div>

      {/* Tanım */}
      {proje.tanim && (
        <div className="bg-[#1E2636] rounded-2xl border border-white/[0.07] p-4">
          <h3 className="text-[#F1F5F9] text-sm font-semibold font-[var(--font-syne)] mb-2">Açıklama</h3>
          <p className="text-[#94A3B8] text-sm leading-relaxed">{proje.tanim}</p>
        </div>
      )}

      {/* Milestone / Hedefler */}
      <div className="bg-[#1E2636] rounded-2xl border border-white/[0.07] p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[#F1F5F9] text-sm font-semibold font-[var(--font-syne)]">Hedefler & Kilometre Taşları</h3>
          <button
            onClick={() => setMsModalAcik(true)}
            className="min-h-[36px] text-xs bg-amber-500/10 border border-amber-500/30 text-amber-400 px-3 py-1.5 rounded-lg hover:bg-amber-500/20 transition-colors"
          >
            + Ekle
          </button>
        </div>

        {msLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-10 bg-[#2A3447] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : milestonelar.length === 0 ? (
          <p className="text-[#94A3B8] text-xs text-center py-4">
            Henüz hedef eklenmedi — Ekle butonuyla başlayın
          </p>
        ) : (
          <div className="space-y-2">
            {milestonelar.map((m) => {
              let hedefTarih: string | null = null;
              let tamamlandi = false;
              if (m.aciklama) {
                try {
                  const parsed = JSON.parse(m.aciklama) as { hedef_tarih?: string; tamamlandi?: boolean };
                  hedefTarih = parsed.hedef_tarih ?? null;
                  tamamlandi = parsed.tamamlandi ?? false;
                } catch { /* sessiz */ }
              }
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-3 bg-[#252F42] rounded-xl px-3 py-2.5 border border-white/[0.05]"
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${tamamlandi ? 'bg-green-500 border-green-500' : 'border-[#94A3B8]'}`}>
                    {tamamlandi && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${tamamlandi ? 'text-[#94A3B8] line-through' : 'text-[#F1F5F9]'}`}>
                      {m.baslik}
                    </p>
                    {hedefTarih && (
                      <p className="text-[#94A3B8] text-xs">
                        {new Date(hedefTarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: m.renk === 'green' ? '#22C55E' : m.renk === 'red' ? '#EF4444' : m.renk === 'blue' ? '#3B82F6' : '#F59E0B' }}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Milestone modal */}
      {msModalAcik && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1A2235] rounded-t-3xl w-full max-w-lg p-6 pb-safe-bottom">
            <h2 className="text-[#F1F5F9] text-base font-bold font-[var(--font-syne)] mb-4">Yeni Hedef Ekle</h2>
            <div className="space-y-3">
              <div>
                <label className="text-[#94A3B8] text-xs mb-1.5 block">Başlık</label>
                <input
                  type="text"
                  value={msBaslik}
                  onChange={(e) => setMsBaslik(e.target.value)}
                  placeholder="Temel atımı, çatı kaplaması..."
                  className="w-full bg-[#0E1117] border border-white/[0.1] rounded-xl px-4 py-3 text-[#F1F5F9] text-sm focus:outline-none focus:border-amber-500/60"
                />
              </div>
              <div>
                <label className="text-[#94A3B8] text-xs mb-1.5 block">Hedef Tarih</label>
                <input
                  type="date"
                  value={msHedefTarih}
                  onChange={(e) => setMsHedefTarih(e.target.value)}
                  className="w-full bg-[#0E1117] border border-white/[0.1] rounded-xl px-4 py-3 text-[#F1F5F9] text-sm focus:outline-none focus:border-amber-500/60"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => { setMsModalAcik(false); setMsBaslik(''); setMsHedefTarih(''); }}
                className="flex-1 min-h-[44px] bg-[#2A3447] text-[#94A3B8] rounded-xl text-sm font-medium"
              >
                İptal
              </button>
              <button
                disabled={msSaving || !msBaslik.trim() || !msHedefTarih}
                onClick={handleMilestoneEkle}
                className="flex-1 min-h-[44px] bg-[#F59E0B] text-black rounded-xl text-sm font-bold disabled:opacity-40 hover:bg-[#D97706] transition-colors"
              >
                {msSaving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ÇİZİMLER SEKMESİ ─────────────────────────────────────────────────────────

function CizimlerTab({ projeId }: { projeId: string }) {
  const [dosyalar, setDosyalar] = useState<MedyaDosyasi[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [filtre, setFiltre] = useState<'tumü' | 'pdf' | 'cad' | 'gorsel'>('tumü');

  const fetchCizimler = () => {
    api.getMedya(projeId, 'cizim')
      .then(setDosyalar)
      .catch(() => setDosyalar([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCizimler(); }, [projeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('dosya', file);
        fd.append('proje_id', projeId);
        fd.append('tip_override', 'cizim');
        await api.uploadMedya(fd);
      }
      fetchCizimler();
    } catch {
      // sessiz
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteMedya(id);
      setDosyalar((prev) => prev.filter((d) => d.id !== id));
    } catch { /* sessiz */ }
  };

  const getCizimTip = (d: MedyaDosyasi): 'pdf' | 'cad' | 'gorsel' => {
    if (d.mime_type?.includes('pdf')) return 'pdf';
    if (d.mime_type?.startsWith('image/') || d.dosya_adi?.match(/\.(png|jpg|jpeg|webp)$/i)) return 'gorsel';
    return 'cad';
  };

  const filtrelenmis = dosyalar.filter((d) => {
    if (filtre === 'tumü') return true;
    return getCizimTip(d) === filtre;
  });

  const getIkon = (tip: 'pdf' | 'cad' | 'gorsel') => {
    if (tip === 'pdf') return { emoji: '📄', color: 'text-red-400', bg: 'bg-red-500/10' };
    if (tip === 'cad') return { emoji: '📐', color: 'text-blue-400', bg: 'bg-blue-500/10' };
    return { emoji: '🖼️', color: 'text-purple-400', bg: 'bg-purple-500/10' };
  };

  if (loading) return <Skeleton />;

  return (
    <div className="space-y-4">
      {/* Filtre + Yükle */}
      <div className="flex items-center gap-2 justify-between">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
          {(['tumü', 'pdf', 'cad', 'gorsel'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFiltre(f)}
              className={`min-h-[36px] flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                filtre === f
                  ? 'bg-[#F59E0B] text-black'
                  : 'bg-[#1E2636] text-[#94A3B8] border border-white/[0.07] hover:text-[#F1F5F9]'
              }`}
            >
              {f === 'tumü' ? 'Tümü' : f === 'pdf' ? 'PDF Planlar' : f === 'cad' ? 'CAD Dosyaları' : 'Görseller'}
            </button>
          ))}
        </div>
        <label className={`flex-shrink-0 min-h-[36px] flex items-center gap-1.5 bg-[#F59E0B] text-black text-xs font-semibold px-3 py-1.5 rounded-xl hover:bg-[#D97706] transition-colors cursor-pointer ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
          {uploading ? '...' : '+ Yükle'}
          <input
            type="file"
            accept=".pdf,.dwg,.dxf,.dwf,.png,.jpg,.jpeg"
            multiple
            className="hidden"
            onChange={handleUpload}
          />
        </label>
      </div>

      {filtrelenmis.length === 0 ? (
        <EmptyState mesaj="Henüz çizim dosyası yüklenmedi" icon="📐" />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtrelenmis.map((d) => {
            const tip = getCizimTip(d);
            const { emoji, color, bg } = getIkon(tip);
            return (
              <div key={d.id} className="bg-[#1E2636] rounded-2xl border border-white/[0.07] overflow-hidden">
                <div className={`aspect-[4/3] ${bg} flex items-center justify-center`}>
                  <span className={`text-5xl ${color}`}>{emoji}</span>
                </div>
                <div className="p-3">
                  <p className="text-[#F1F5F9] text-xs font-medium truncate" title={d.dosya_adi ?? 'Dosya'}>
                    {d.dosya_adi ?? 'Dosya'}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <span className={`text-[10px] uppercase font-semibold ${color}`}>{tip.toUpperCase()}</span>
                    {d.boyut_byte && (
                      <span className="text-[#94A3B8] text-[10px]">{formatBoyut(d.boyut_byte)}</span>
                    )}
                  </div>
                  {d.created_at && (
                    <p className="text-[#94A3B8] text-[10px] mt-0.5">
                      {new Date(d.created_at).toLocaleDateString('tr-TR')}
                    </p>
                  )}
                  <div className="flex gap-2 mt-2">
                    <a
                      href={api.getMedyaViewUrl(d.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-center text-[10px] bg-[#2A3447] text-[#94A3B8] py-1.5 rounded-lg hover:text-[#F1F5F9] transition-colors"
                    >
                      İndir
                    </a>
                    <button
                      onClick={() => handleDelete(d.id)}
                      className="flex-1 text-[10px] bg-red-500/10 text-red-400 py-1.5 rounded-lg hover:bg-red-500/20 transition-colors"
                    >
                      Sil
                    </button>
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

// ─── NOTLAR SEKMESİ ───────────────────────────────────────────────────────────

function NotlarTab({ projeId }: { projeId: string }) {
  const [notlar, setNotlar] = useState<ProjeNot[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalAcik, setModalAcik] = useState(false);
  const [duzenleNot, setDuzenleNot] = useState<ProjeNot | null>(null);
  const [baslik, setBaslik] = useState('');
  const [icerik, setIcerik] = useState('');
  const [renk, setRenk] = useState<keyof typeof NOT_RENK>('amber');
  const [saving, setSaving] = useState(false);
  const [siliyor, setSiliyor] = useState<string | null>(null);

  const fetchNotlar = () => {
    api.getProjeNotlari(projeId)
      .then((data) => {
        const sorted = [...data].sort((a, b) => {
          if (a.sabitlendi === 'true' && b.sabitlendi !== 'true') return -1;
          if (a.sabitlendi !== 'true' && b.sabitlendi === 'true') return 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        setNotlar(sorted);
      })
      .catch(() => setNotlar([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchNotlar(); }, [projeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const modalAc = (not?: ProjeNot) => {
    if (not) {
      setDuzenleNot(not);
      setBaslik(not.baslik);
      setIcerik(not.icerik);
      setRenk((not.renk as keyof typeof NOT_RENK) || 'amber');
    } else {
      setDuzenleNot(null);
      setBaslik('');
      setIcerik('');
      setRenk('amber');
    }
    setModalAcik(true);
  };

  const modalKapat = () => {
    setModalAcik(false);
    setDuzenleNot(null);
    setBaslik('');
    setIcerik('');
    setRenk('amber');
  };

  const handleKaydet = async () => {
    if (!baslik.trim() || !icerik.trim()) return;
    setSaving(true);
    try {
      if (duzenleNot) {
        await api.updateProjeNot(projeId, duzenleNot.id, { baslik: baslik.trim(), icerik: icerik.trim(), renk });
      } else {
        await api.createProjeNot(projeId, { baslik: baslik.trim(), icerik: icerik.trim(), renk });
      }
      modalKapat();
      fetchNotlar();
    } catch {
      // sessiz
    } finally {
      setSaving(false);
    }
  };

  const handleSil = async (id: string) => {
    setSiliyor(id);
    try {
      await api.deleteProjeNot(projeId, id);
      setNotlar((prev) => prev.filter((n) => n.id !== id));
    } catch {
      // sessiz
    } finally {
      setSiliyor(null);
    }
  };

  const handleSabitle = async (not: ProjeNot) => {
    const yeniDeger = not.sabitlendi === 'true' ? 'false' : 'true';
    try {
      await api.updateProjeNot(projeId, not.id, { sabitlendi: yeniDeger });
      fetchNotlar();
    } catch { /* sessiz */ }
  };

  if (loading) return <Skeleton />;

  return (
    <div className="space-y-4 relative pb-20">
      {notlar.length === 0 ? (
        <EmptyState mesaj="Henüz not yok — + butonuyla ekleyin" icon="📝" />
      ) : (
        <div className="space-y-3">
          {notlar.map((n) => {
            const renkStyle = NOT_RENK[n.renk] ?? NOT_RENK.amber;
            return (
              <div
                key={n.id}
                className="rounded-2xl border border-l-4 border-white/[0.07] p-4"
                style={{ borderLeftColor: renkStyle.border, background: renkStyle.bg }}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {n.sabitlendi === 'true' && (
                      <span className="text-amber-400 flex-shrink-0" title="Sabitlendi">📌</span>
                    )}
                    <h4 className="text-[#F1F5F9] text-sm font-semibold font-[var(--font-syne)] truncate">
                      {n.baslik}
                    </h4>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleSabitle(n)}
                      className="min-h-[32px] min-w-[32px] flex items-center justify-center text-[#94A3B8] hover:text-amber-400 transition-colors rounded-lg"
                      title={n.sabitlendi === 'true' ? 'Sabitlemeyi kaldır' : 'Sabitle'}
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M16 3a1 1 0 0 1 .707.293l4 4a1 1 0 0 1-1.414 1.414L18 7.414V17a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7.414l-1.293 1.293A1 1 0 0 1 3.293 7.293l4-4A1 1 0 0 1 8 3h8z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => modalAc(n)}
                      className="min-h-[32px] min-w-[32px] flex items-center justify-center text-[#94A3B8] hover:text-[#F1F5F9] transition-colors rounded-lg"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      disabled={siliyor === n.id}
                      onClick={() => handleSil(n.id)}
                      className="min-h-[32px] min-w-[32px] flex items-center justify-center text-[#94A3B8] hover:text-red-400 transition-colors rounded-lg disabled:opacity-40"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                <p className="text-[#CBD5E1] text-sm leading-relaxed whitespace-pre-wrap">{n.icerik}</p>
                <p className="text-[#64748B] text-[10px] mt-2">
                  {new Date(n.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => modalAc()}
        className="fixed bottom-24 right-5 z-30 w-14 h-14 bg-[#F59E0B] rounded-full shadow-lg flex items-center justify-center text-black text-2xl hover:bg-[#D97706] transition-colors active:scale-95"
        aria-label="Yeni not ekle"
      >
        +
      </button>

      {/* Modal */}
      {modalAcik && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#1A2235] rounded-t-3xl w-full max-w-lg p-6 pb-safe-bottom">
            <h2 className="text-[#F1F5F9] text-base font-bold font-[var(--font-syne)] mb-4">
              {duzenleNot ? 'Notu Düzenle' : 'Yeni Not'}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="text-[#94A3B8] text-xs mb-1.5 block">Başlık</label>
                <input
                  type="text"
                  value={baslik}
                  onChange={(e) => setBaslik(e.target.value)}
                  placeholder="Not başlığı..."
                  className="w-full bg-[#0E1117] border border-white/[0.1] rounded-xl px-4 py-3 text-[#F1F5F9] text-sm focus:outline-none focus:border-amber-500/60"
                />
              </div>
              <div>
                <label className="text-[#94A3B8] text-xs mb-1.5 block">İçerik</label>
                <textarea
                  rows={4}
                  value={icerik}
                  onChange={(e) => setIcerik(e.target.value)}
                  placeholder="Not içeriği..."
                  className="w-full bg-[#0E1117] border border-white/[0.1] rounded-xl px-4 py-3 text-[#F1F5F9] text-sm focus:outline-none focus:border-amber-500/60 resize-none"
                />
              </div>
              <div>
                <label className="text-[#94A3B8] text-xs mb-2 block">Renk</label>
                <div className="flex gap-2">
                  {(Object.entries(NOT_RENK) as [keyof typeof NOT_RENK, { border: string; bg: string; dot: string }][]).map(([key, val]) => (
                    <button
                      key={key}
                      onClick={() => setRenk(key)}
                      className={`w-8 h-8 rounded-full transition-all ${val.dot} ${renk === key ? 'ring-2 ring-white ring-offset-2 ring-offset-[#1A2235] scale-110' : 'opacity-70'}`}
                      aria-label={key}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={modalKapat}
                className="flex-1 min-h-[44px] bg-[#2A3447] text-[#94A3B8] rounded-xl text-sm font-medium"
              >
                İptal
              </button>
              <button
                disabled={saving || !baslik.trim() || !icerik.trim()}
                onClick={handleKaydet}
                className="flex-1 min-h-[44px] bg-[#F59E0B] text-black rounded-xl text-sm font-bold disabled:opacity-40 hover:bg-[#D97706] transition-colors"
              >
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DOSYALAR SEKMESİ ─────────────────────────────────────────────────────────

const BELGE_KATEGORILER = ['Sözleşme', 'Ruhsat', 'Teknik Şartname', 'Onay', 'Diğer'] as const;

function DosyalarTab({ projeId }: { projeId: string }) {
  const [dosyalar, setDosyalar] = useState<MedyaDosyasi[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [kategori, setKategori] = useState('');

  const fetchBelgeler = () => {
    api.getMedya(projeId, 'belge')
      .then(setDosyalar)
      .catch(() => setDosyalar([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchBelgeler(); }, [projeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('dosya', file);
        fd.append('proje_id', projeId);
        if (kategori) fd.append('aciklama', kategori);
        await api.uploadMedya(fd);
      }
      fetchBelgeler();
    } catch {
      // sessiz
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteMedya(id);
      setDosyalar((prev) => prev.filter((d) => d.id !== id));
    } catch { /* sessiz */ }
  };

  const getMimeIkon = (mime: string | null): string => {
    if (!mime) return '📁';
    if (mime.includes('pdf')) return '📕';
    if (mime.includes('word') || mime.includes('doc')) return '📘';
    if (mime.includes('excel') || mime.includes('sheet') || mime.includes('xls')) return '📗';
    if (mime.includes('zip') || mime.includes('rar')) return '🗜️';
    if (mime.includes('text')) return '📄';
    return '📎';
  };

  if (loading) return <Skeleton />;

  return (
    <div className="space-y-4">
      {/* Yükleme alanı */}
      <div className="bg-[#1E2636] rounded-2xl border border-white/[0.07] p-4">
        <h3 className="text-[#F1F5F9] text-sm font-semibold mb-3">Belge Yükle</h3>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <select
            value={kategori}
            onChange={(e) => setKategori(e.target.value)}
            className="col-span-2 bg-[#0E1117] border border-white/[0.1] rounded-xl px-3 py-2.5 text-[#F1F5F9] text-sm focus:outline-none focus:border-amber-500/60"
          >
            <option value="">Kategori seçin (opsiyonel)</option>
            {BELGE_KATEGORILER.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </div>
        <label className={`flex items-center justify-center gap-2 min-h-[44px] bg-[#F59E0B] text-black text-sm font-semibold rounded-xl hover:bg-[#D97706] transition-colors cursor-pointer w-full ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
          {uploading ? 'Yükleniyor...' : '+ Belge Yükle'}
          <input
            type="file"
            accept=".pdf,.docx,.doc,.xlsx,.xls,.txt,.zip"
            multiple
            className="hidden"
            onChange={handleUpload}
          />
        </label>
      </div>

      {dosyalar.length === 0 ? (
        <EmptyState mesaj="Henüz belge yüklenmedi" icon="📂" />
      ) : (
        <div className="space-y-2">
          {dosyalar.map((d) => (
            <div key={d.id} className="bg-[#1E2636] rounded-xl border border-white/[0.07] flex items-center gap-3 p-3">
              <span className="text-2xl flex-shrink-0">{getMimeIkon(d.mime_type)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-[#F1F5F9] text-sm font-medium truncate">
                  {d.dosya_adi ?? 'Belge'}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {d.boyut_byte && (
                    <span className="text-[#94A3B8] text-[10px]">{formatBoyut(d.boyut_byte)}</span>
                  )}
                  {d.created_at && (
                    <span className="text-[#94A3B8] text-[10px]">
                      {new Date(d.created_at).toLocaleDateString('tr-TR')}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <a
                  href={api.getMedyaViewUrl(d.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[36px] px-3 flex items-center text-[10px] bg-[#2A3447] text-[#94A3B8] rounded-lg hover:text-[#F1F5F9] transition-colors"
                >
                  ↓
                </a>
                <button
                  onClick={() => handleDelete(d.id)}
                  className="min-h-[36px] px-3 flex items-center text-[10px] bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 transition-colors"
                >
                  Sil
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── GALERİ SEKMESİ ───────────────────────────────────────────────────────────

function GaleriTab({ projeId }: { projeId: string }) {
  const [dosyalar, setDosyalar] = useState<MedyaDosyasi[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const fetchMedya = () => {
    api.getMedya(projeId)
      .then(setDosyalar)
      .catch(() => setDosyalar([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchMedya(); }, [projeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('dosya', file);
        fd.append('proje_id', projeId);
        await api.uploadMedya(fd);
      }
      fetchMedya();
    } catch {
      // sessiz
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteMedya(id);
      setDosyalar((prev) => prev.filter((d) => d.id !== id));
    } catch { /* sessiz */ }
  };

  if (loading) return <Skeleton />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <label className={`flex items-center gap-1.5 bg-[#F59E0B] text-black text-xs font-semibold px-4 py-2.5 rounded-xl hover:bg-[#D97706] transition-colors cursor-pointer min-h-[44px] ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
          <span>{uploading ? 'Yükleniyor...' : '+ Fotoğraf Yükle'}</span>
          <input
            type="file"
            accept="image/*,application/pdf,video/*"
            multiple
            capture="environment"
            className="hidden"
            onChange={handleUpload}
          />
        </label>
      </div>

      {dosyalar.length === 0 ? (
        <EmptyState mesaj="Henüz medya dosyası yüklenmedi" icon="🖼️" />
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {dosyalar.map((d) => (
            <div key={d.id} className="bg-[#1E2636] rounded-xl border border-white/[0.07] overflow-hidden">
              <div className="aspect-square bg-[#2A3447] flex items-center justify-center">
                {d.mime_type?.startsWith('image/') ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={api.getMedyaViewUrl(d.id)}
                    alt={d.dosya_adi ?? 'Fotoğraf'}
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : d.mime_type?.startsWith('video/') ? (
                  <span className="text-3xl">🎬</span>
                ) : (
                  <span className="text-3xl">📄</span>
                )}
              </div>
              <div className="p-2">
                <p className="text-[#F1F5F9] text-[10px] font-medium truncate">
                  {d.dosya_adi ?? 'Dosya'}
                </p>
                {d.boyut_byte && (
                  <p className="text-[#94A3B8] text-[9px]">{formatBoyut(d.boyut_byte)}</p>
                )}
                <button
                  onClick={() => handleDelete(d.id)}
                  className="mt-1 text-[9px] text-red-400 hover:text-red-300 transition-colors min-h-[24px]"
                >
                  Sil
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── PUANTAJ SEKMESİ ──────────────────────────────────────────────────────────

function PuantajTab({ projeId }: { projeId: string }) {
  const [kayitlar, setKayitlar] = useState<PuantajKaydi[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getPuantaj(undefined, projeId)
      .then(setKayitlar)
      .catch(() => setKayitlar([]))
      .finally(() => setLoading(false));
  }, [projeId]);

  if (loading) return <Skeleton />;
  if (kayitlar.length === 0) return <EmptyState mesaj="Henüz puantaj kaydı eklenmedi" icon="📊" />;

  const gruplar: Record<string, PuantajKaydi[]> = {};
  for (const k of kayitlar) {
    if (!gruplar[k.tarih]) gruplar[k.tarih] = [];
    gruplar[k.tarih].push(k);
  }
  const tarihler = Object.keys(gruplar).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-4">
      {tarihler.map((tarih) => (
        <div key={tarih} className="bg-[#1E2636] rounded-2xl border border-white/[0.07] overflow-hidden">
          <div className="px-4 py-2.5 bg-[#252F42] border-b border-white/[0.07] flex items-center justify-between">
            <span className="text-[#F1F5F9] text-sm font-semibold font-[var(--font-syne)]">
              {new Date(tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
            <span className="text-[#94A3B8] text-xs">{gruplar[tarih].length} personel</span>
          </div>
          <div className="divide-y divide-white/[0.05]">
            {gruplar[tarih].map((k) => (
              <div key={k.id} className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-amber-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-amber-400 text-xs font-bold">
                      {k.personel_adi.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="text-[#F1F5F9] text-sm font-medium">{k.personel_adi}</p>
                    {k.meslek && <p className="text-[#94A3B8] text-xs">{k.meslek}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[#F1F5F9] text-sm font-semibold">
                    {k.calisma_saati}s
                    {k.fazla_mesai > 0 && (
                      <span className="text-amber-400 text-xs ml-1">+{k.fazla_mesai}s</span>
                    )}
                  </p>
                  {k.devamsizlik && (
                    <span className="text-red-400 text-[10px]">Devamsız</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── STOK SEKMESİ ─────────────────────────────────────────────────────────────

function StokTab({ projeId }: { projeId: string }) {
  const [kalemler, setKalemler] = useState<StokKalemi[]>([]);
  const [loading, setLoading] = useState(true);
  const [hareketAcik, setHareketAcik] = useState<string | null>(null);
  const [girisValue, setGirisValue] = useState('');
  const [cikisValue, setCikisValue] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchStok = () => {
    api.getStokKalemleri(projeId)
      .then(setKalemler)
      .catch(() => setKalemler([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchStok(); }, [projeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleHareket = async (id: string, tip: 'giris' | 'cikis') => {
    const val = tip === 'giris' ? parseFloat(girisValue) : parseFloat(cikisValue);
    if (isNaN(val) || val <= 0) return;
    setSaving(true);
    try {
      await api.stokHareket(id, tip, val);
      setGirisValue(''); setCikisValue('');
      setHareketAcik(null);
      fetchStok();
    } catch {
      // sessiz
    } finally {
      setSaving(false);
    }
  };

  const kritikler = kalemler.filter((k) => k.kritik);

  if (loading) return <Skeleton />;

  return (
    <div className="space-y-4">
      {kritikler.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center gap-3">
          <span className="text-red-400 text-xl">⚠️</span>
          <div>
            <p className="text-red-400 text-sm font-semibold">Kritik Stok Uyarısı</p>
            <p className="text-red-400/80 text-xs mt-0.5">
              {kritikler.length} kalem kritik seviyenin altında
            </p>
          </div>
        </div>
      )}

      <Link
        href="/yonetim/stok"
        className="flex items-center justify-between bg-[#252F42] rounded-xl px-4 py-3 border border-white/[0.07] hover:border-amber-500/30 transition-colors"
      >
        <span className="text-[#94A3B8] text-sm">Stok Yönetimi Sayfası</span>
        <span className="text-amber-400 text-sm">→</span>
      </Link>

      {kalemler.length === 0 ? (
        <EmptyState mesaj="Henüz stok kalemi eklenmedi" icon="📦" />
      ) : (
        <div className="space-y-3">
          {kalemler.map((k) => {
            const pct = k.min_miktar > 0 ? Math.min(100, (k.miktar / k.min_miktar) * 100) : 100;
            const acik = hareketAcik === k.id;
            return (
              <div
                key={k.id}
                className={`bg-[#1E2636] rounded-2xl border transition-colors ${k.kritik ? 'border-red-500/40' : 'border-white/[0.07]'}`}
              >
                <div className="p-4 cursor-pointer" onClick={() => setHareketAcik(acik ? null : k.id)}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-9 h-9 bg-[#2A3447] rounded-xl flex items-center justify-center flex-shrink-0">
                        <span className="text-base">📦</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[#F1F5F9] text-sm font-semibold font-[var(--font-syne)] truncate">
                          {k.malzeme_adi}
                        </p>
                        <p className="text-[#94A3B8] text-xs">
                          {k.miktar} {k.birim ?? 'adet'} · min {k.min_miktar}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      {k.kritik && (
                        <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full">Kritik</span>
                      )}
                      <svg
                        className={`w-4 h-4 text-[#94A3B8] transition-transform ${acik ? 'rotate-180' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[#94A3B8] text-[10px]">Stok seviyesi</span>
                      <span className={`text-[10px] font-semibold ${pct < 50 ? 'text-red-400' : 'text-[#F59E0B]'}`}>
                        %{Math.round(pct)}
                      </span>
                    </div>
                    <div className="w-full bg-[#2A3447] rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct < 50 ? 'bg-red-500' : 'bg-gradient-to-r from-[#F59E0B] to-[#FBBF24]'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </div>

                {acik && (
                  <div className="border-t border-white/[0.07] p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[#94A3B8] text-xs mb-1.5 block">Giriş Miktarı</label>
                        <div className="flex gap-2">
                          <input
                            type="number" min="0" value={girisValue}
                            onChange={(e) => setGirisValue(e.target.value)} placeholder="0"
                            className="flex-1 bg-[#0E1117] border border-white/[0.1] rounded-xl px-3 py-2.5 text-[#F1F5F9] text-sm focus:outline-none focus:border-green-500/60"
                          />
                          <button
                            disabled={saving || !girisValue}
                            onClick={() => handleHareket(k.id, 'giris')}
                            className="bg-green-500/20 border border-green-500/30 text-green-400 px-3 rounded-xl text-xs font-semibold hover:bg-green-500/30 disabled:opacity-40 transition-colors min-h-[44px]"
                          >
                            + Giriş
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="text-[#94A3B8] text-xs mb-1.5 block">Çıkış Miktarı</label>
                        <div className="flex gap-2">
                          <input
                            type="number" min="0" value={cikisValue}
                            onChange={(e) => setCikisValue(e.target.value)} placeholder="0"
                            className="flex-1 bg-[#0E1117] border border-white/[0.1] rounded-xl px-3 py-2.5 text-[#F1F5F9] text-sm focus:outline-none focus:border-red-500/60"
                          />
                          <button
                            disabled={saving || !cikisValue}
                            onClick={() => handleHareket(k.id, 'cikis')}
                            className="bg-red-500/20 border border-red-500/30 text-red-400 px-3 rounded-xl text-xs font-semibold hover:bg-red-500/30 disabled:opacity-40 transition-colors min-h-[44px]"
                          >
                            - Çıkış
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── ISG SEKMESİ ──────────────────────────────────────────────────────────────

function IsgTab({ projeId }: { projeId: string }) {
  const [kayitlar, setKayitlar] = useState<IsgKaydi[]>([]);
  const [loading, setLoading] = useState(true);
  const [kapatiyor, setKapatiyor] = useState<string | null>(null);

  useEffect(() => {
    api.getIsgKayitlari(projeId)
      .then(setKayitlar)
      .catch(() => setKayitlar([]))
      .finally(() => setLoading(false));
  }, [projeId]);

  const handleKapat = async (id: string) => {
    setKapatiyor(id);
    try {
      await api.updateIsgKaydi(id, { durum: 'kapandi' });
      setKayitlar((prev) => prev.map((k) => k.id === id ? { ...k, durum: 'kapandi' } : k));
    } catch {
      // sessiz
    } finally {
      setKapatiyor(null);
    }
  };

  if (loading) return <Skeleton />;
  if (kayitlar.length === 0) return <EmptyState mesaj="Henüz ISG kaydı eklenmedi" icon="⛑️" />;

  return (
    <div className="space-y-3">
      {kayitlar.map((k) => (
        <div
          key={k.id}
          className={`bg-[#1E2636] rounded-2xl border-l-4 border border-white/[0.07] p-4 ${onemKenarlık[k.onem_seviyesi] ?? 'border-l-amber-500'}`}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs border px-2 py-0.5 rounded-full font-semibold ${onemRenk[k.onem_seviyesi]}`}>
                {onemLabel[k.onem_seviyesi]}
              </span>
              <span className="text-xs bg-[#2A3447] text-[#94A3B8] px-2 py-0.5 rounded-full capitalize">
                {k.tip.replace('_', ' ')}
              </span>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isgDurumRenk[k.durum]}`}>
              {isgDurumLabel[k.durum]}
            </span>
          </div>
          <p className="text-[#94A3B8] text-xs mb-1">{new Date(k.tarih).toLocaleDateString('tr-TR')}</p>
          {k.aciklama && <p className="text-[#F1F5F9] text-sm mb-2">{k.aciklama}</p>}
          {k.sorumlu && (
            <p className="text-[#94A3B8] text-xs mb-2">
              Sorumlu: <span className="text-[#F1F5F9]">{k.sorumlu}</span>
            </p>
          )}
          {k.sonuc && (
            <p className="text-[#94A3B8] text-xs mb-2">
              Sonuç: <span className="text-[#F1F5F9]">{k.sonuc}</span>
            </p>
          )}
          {k.durum === 'acik' && (
            <button
              disabled={kapatiyor === k.id}
              onClick={() => handleKapat(k.id)}
              className="text-xs bg-green-500/20 border border-green-500/30 text-green-400 px-3 py-1.5 rounded-lg hover:bg-green-500/30 disabled:opacity-40 transition-colors min-h-[36px]"
            >
              {kapatiyor === k.id ? 'Kapatılıyor...' : 'Kapat'}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── HAKEDİŞ SEKMESİ ──────────────────────────────────────────────────────────

function HakedisTab({ proje }: { proje: ProjeResponse }) {
  const tahminiHakedis = proje.butce !== null && proje.butce !== undefined
    ? proje.butce * (proje.ilerleme_yuzdesi / 100)
    : null;

  const fmt = (n: number) =>
    new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-4">
      {/* Hakedis sayfasına yönlendir */}
      <Link
        href="/yonetim/hakedis"
        className="flex items-center justify-between bg-[#F59E0B] text-black rounded-2xl px-5 py-4 hover:bg-[#D97706] transition-colors min-h-[64px]"
      >
        <div>
          <p className="font-bold text-sm font-[var(--font-syne)]">Yeni Hakediş Oluştur</p>
          <p className="text-black/70 text-xs mt-0.5">Excel hakediş dosyası oluştur</p>
        </div>
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>

      {/* Bilgi kartları */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#1E2636] rounded-2xl border border-white/[0.07] p-4">
          <p className="text-[#94A3B8] text-xs mb-1">Toplam Bütçe</p>
          <p className="text-[#F59E0B] text-base font-bold font-[var(--font-syne)] truncate">
            {proje.butce !== null && proje.butce !== undefined ? fmt(proje.butce) : '—'}
          </p>
        </div>
        <div className="bg-[#1E2636] rounded-2xl border border-white/[0.07] p-4">
          <p className="text-[#94A3B8] text-xs mb-1">Tamamlanan</p>
          <p className="text-green-400 text-base font-bold font-[var(--font-syne)]">
            %{proje.ilerleme_yuzdesi}
          </p>
        </div>
        <div className="col-span-2 bg-[#1E2636] rounded-2xl border border-white/[0.07] p-4">
          <p className="text-[#94A3B8] text-xs mb-1">Tahmini Hakediş Tutarı</p>
          <p className="text-[#F1F5F9] text-lg font-bold font-[var(--font-syne)]">
            {tahminiHakedis !== null ? fmt(tahminiHakedis) : '—'}
          </p>
          <p className="text-[#94A3B8] text-xs mt-1">
            Bütçe × İlerleme yüzdesi baz alınarak hesaplanmıştır
          </p>
        </div>
      </div>

      {/* Bilgi notu */}
      <div className="bg-[#1E2636] rounded-2xl border border-amber-500/20 p-4">
        <p className="text-[#94A3B8] text-sm leading-relaxed">
          Hakediş Excel dosyası oluşturmak için yukarıdaki <span className="text-amber-400 font-medium">Yeni Hakediş Oluştur</span> butonunu kullanın. İş kalemleri, miktarlar ve KDV oranı gibi detayları Hakediş sayfasında belirleyebilirsiniz.
        </p>
      </div>
    </div>
  );
}

// ─── RAPORLAR SEKMESİ ─────────────────────────────────────────────────────────

function RaporlarTab({ proje }: { proje: ProjeResponse }) {
  const [raporlar, setRaporlar] = useState<RaporResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [onayliyor, setOnayliyor] = useState<string | null>(null);

  useEffect(() => {
    if (!proje.santiye_id) {
      // Santiye_id yok — santiyelerden bulmaya çalış
      api.getSantiyeler()
        .then((santiyeler: SantiyeResponse[]) => {
          const santiye = santiyeler[0];
          if (santiye) {
            return api.getRaporlar(santiye.id);
          }
          return [];
        })
        .then(setRaporlar)
        .catch(() => setRaporlar([]))
        .finally(() => setLoading(false));
    } else {
      api.getRaporlar(proje.santiye_id)
        .then(setRaporlar)
        .catch(() => setRaporlar([]))
        .finally(() => setLoading(false));
    }
  }, [proje.santiye_id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOnayla = async (id: string) => {
    setOnayliyor(id);
    try {
      const updated = await api.approveRapor(id);
      setRaporlar((prev) => prev.map((r) => r.id === id ? updated : r));
    } catch {
      // sessiz
    } finally {
      setOnayliyor(null);
    }
  };

  if (loading) return <Skeleton />;

  if (!proje.santiye_id) {
    return (
      <div className="space-y-4">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <p className="text-amber-400 text-sm">
            Bu projeye bağlı bir şantiye bulunamadı. Raporları görüntülemek için projeyi bir şantiyeye bağlayın.
          </p>
        </div>
        <Link
          href="/yonetim/raporlar"
          className="flex items-center justify-between bg-[#1E2636] rounded-xl px-4 py-3 border border-white/[0.07] hover:border-amber-500/30 transition-colors"
        >
          <span className="text-[#94A3B8] text-sm">Tüm Raporlar</span>
          <span className="text-amber-400">→</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[#94A3B8] text-xs">{raporlar.length} rapor</p>
        <Link
          href="/yonetim/raporlar"
          className="text-amber-400 text-xs hover:underline"
        >
          Tüm Raporlar →
        </Link>
      </div>

      {raporlar.length === 0 ? (
        <EmptyState mesaj="Henüz rapor oluşturulmadı" icon="📋" />
      ) : (
        raporlar.slice(0, 20).map((r) => (
          <div key={r.id} className="bg-[#1E2636] rounded-2xl border border-white/[0.07] p-4">
            <div className="flex items-start justify-between mb-2">
              <p className="text-[#F1F5F9] text-sm font-medium">
                {new Date(r.tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              <span className={`text-[10px] border px-2 py-0.5 rounded-full font-semibold ${raporDurumRenk[r.durum]}`}>
                {raporDurumLabel[r.durum] ?? r.durum}
              </span>
            </div>
            <div className="flex gap-2 mt-3">
              {r.cikti_dosya_yolu && (
                <a
                  href={api.downloadRapor(r.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-center text-xs bg-[#2A3447] text-[#94A3B8] py-2 rounded-lg hover:text-[#F1F5F9] transition-colors min-h-[36px] flex items-center justify-center"
                >
                  ↓ İndir
                </a>
              )}
              {r.durum === 'taslak' && (
                <button
                  disabled={onayliyor === r.id}
                  onClick={() => handleOnayla(r.id)}
                  className="flex-1 text-xs bg-green-500/20 border border-green-500/30 text-green-400 py-2 rounded-lg hover:bg-green-500/30 disabled:opacity-40 transition-colors min-h-[36px]"
                >
                  {onayliyor === r.id ? 'Onaylanıyor...' : 'Onayla'}
                </button>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ─── TOPLANTI SEKMESİ ─────────────────────────────────────────────────────────

function ToplantiTab({ projeId }: { projeId: string }) {
  const [toplantilar, setToplantilar] = useState<Toplanti[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getToplantilar(projeId)
      .then(setToplantilar)
      .catch(() => setToplantilar([]))
      .finally(() => setLoading(false));
  }, [projeId]);

  if (loading) return <Skeleton />;
  if (toplantilar.length === 0) return <EmptyState mesaj="Henüz toplantı kaydı eklenmedi" icon="🤝" />;

  return (
    <div className="space-y-3">
      {toplantilar.map((t) => (
        <div key={t.id} className="bg-[#1E2636] rounded-2xl border border-white/[0.07] p-4">
          <div className="flex items-start justify-between mb-2">
            <h4 className="text-[#F1F5F9] text-sm font-semibold font-[var(--font-syne)] flex-1 min-w-0 mr-3">
              {t.baslik}
            </h4>
            <span className="text-[#94A3B8] text-xs whitespace-nowrap flex-shrink-0">
              {new Date(t.tarih).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
          {t.yer && (
            <p className="text-[#94A3B8] text-xs mb-1.5 flex items-center gap-1">
              <span>📍</span> {t.yer}
            </p>
          )}
          {t.katilanlar && (
            <div className="flex items-start gap-1.5 mb-2">
              <span className="text-[#94A3B8] text-xs mt-0.5 flex-shrink-0">👥</span>
              <p className="text-[#94A3B8] text-xs">{t.katilanlar}</p>
            </div>
          )}
          {t.notlar && (
            <div className="mt-2 pt-2 border-t border-white/[0.07]">
              <p className="text-[#94A3B8] text-xs leading-relaxed">{t.notlar}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── AKTİVİTE SEKMESİ ────────────────────────────────────────────────────────

function AktiviteTab({ projeId }: { projeId: string }) {
  const [aktiviteler, setAktiviteler] = useState<Aktivite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAktiviteler(projeId)
      .then(setAktiviteler)
      .catch(() => setAktiviteler([]))
      .finally(() => setLoading(false));
  }, [projeId]);

  if (loading) return <Skeleton />;
  if (aktiviteler.length === 0) return <EmptyState mesaj="Henüz aktivite kaydı yok" icon="📌" />;

  const renkHarita: Record<string, string> = {
    green:  '#22C55E',
    amber:  '#F59E0B',
    red:    '#EF4444',
    blue:   '#3B82F6',
    yellow: '#EAB308',
    orange: '#F97316',
  };

  // Milestone olmayanları göster
  const aktivite = aktiviteler.filter((a) => a.tip !== 'milestone');

  return (
    <div className="relative pl-6">
      <div className="absolute left-2.5 top-0 bottom-0 w-0.5 bg-[#2A3447]" />
      <div className="space-y-4">
        {aktivite.map((a) => {
          const renk = renkHarita[a.renk] ?? a.renk ?? '#F59E0B';
          return (
            <div key={a.id} className="relative">
              <div
                className="absolute -left-4 top-3 w-3 h-3 rounded-full ring-2 ring-[#0E1117]"
                style={{ backgroundColor: renk }}
              />
              <div className="bg-[#1E2636] rounded-xl border border-white/[0.07] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[#F1F5F9] text-sm font-medium">
                      {a.baslik ?? a.tip ?? 'Aktivite'}
                    </p>
                    {a.aciklama && (
                      <p className="text-[#94A3B8] text-xs mt-0.5">{a.aciklama}</p>
                    )}
                  </div>
                  {a.created_at && (
                    <span className="text-[#94A3B8] text-[10px] whitespace-nowrap flex-shrink-0">
                      {new Date(a.created_at).toLocaleDateString('tr-TR')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Sekme tanımları (12 sekme) ───────────────────────────────────────────────

const SEKMELER = [
  { id: 'ozet',      label: 'Özet',     icon: '🏗️' },
  { id: 'cizimler',  label: 'Çizimler', icon: '📐' },
  { id: 'notlar',    label: 'Notlar',   icon: '📝' },
  { id: 'dosyalar',  label: 'Dosyalar', icon: '📂' },
  { id: 'galeri',    label: 'Galeri',   icon: '🖼️' },
  { id: 'puantaj',   label: 'Puantaj',  icon: '📊' },
  { id: 'stok',      label: 'Stok',     icon: '📦' },
  { id: 'isg',       label: 'ISG',      icon: '⛑️' },
  { id: 'hakedis',   label: 'Hakediş',  icon: '💰' },
  { id: 'raporlar',  label: 'Raporlar', icon: '📋' },
  { id: 'toplanti',  label: 'Toplantı', icon: '🤝' },
  { id: 'aktivite',  label: 'Aktivite', icon: '📌' },
] as const;

type SekmeId = (typeof SEKMELER)[number]['id'];

// ─── Ana Sayfa ────────────────────────────────────────────────────────────────

export default function ProjeDetayPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === 'string' ? params.id : '';

  const [proje, setProje] = useState<ProjeResponse | null>(null);
  const [istatistik, setIstatistik] = useState<ProjeIstatistik | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SekmeId>('ozet');
  const [toggling, setToggling] = useState(false);
  const [yuklenenSekmeler, setYuklenenSekmeler] = useState<Record<string, boolean>>({ ozet: true });

  // Proje düzenleme modal state'i
  const [duzenleAcik, setDuzenleAcik] = useState(false);
  const [duzenleForm, setDuzenleForm] = useState<Partial<ProjeResponse>>({});
  const [duzenleSaving, setDuzenleSaving] = useState(false);
  const [duzenleErr, setDuzenleErr] = useState<string | null>(null);

  const handleDuzenleAc = () => {
    if (!proje) return;
    setDuzenleForm({
      isim: proje.isim,
      tanim: proje.tanim ?? '',
      il: proje.il ?? '',
      ilce: proje.ilce ?? '',
      proje_muduru: proje.proje_muduru ?? '',
      butce: proje.butce ?? undefined,
      baslangic_tarihi: proje.baslangic_tarihi ?? '',
      bitis_tarihi: proje.bitis_tarihi ?? '',
      ilerleme_yuzdesi: proje.ilerleme_yuzdesi ?? 0,
    });
    setDuzenleErr(null);
    setDuzenleAcik(true);
  };

  const handleDuzenleKaydet = async () => {
    if (!proje || !duzenleForm.isim?.trim()) {
      setDuzenleErr('Proje adı zorunludur');
      return;
    }
    setDuzenleSaving(true);
    setDuzenleErr(null);
    try {
      const updated = await api.updateProje(proje.id, {
        isim: duzenleForm.isim?.trim(),
        tanim: duzenleForm.tanim || undefined,
        il: duzenleForm.il || undefined,
        ilce: duzenleForm.ilce || undefined,
        proje_muduru: duzenleForm.proje_muduru || undefined,
        butce: duzenleForm.butce ? Number(duzenleForm.butce) : undefined,
        baslangic_tarihi: duzenleForm.baslangic_tarihi || undefined,
        bitis_tarihi: duzenleForm.bitis_tarihi || undefined,
        ilerleme_yuzdesi: Number(duzenleForm.ilerleme_yuzdesi ?? 0),
      });
      setProje(updated);
      setDuzenleAcik(false);
    } catch (e: unknown) {
      setDuzenleErr(e instanceof Error ? e.message : 'Güncelleme başarısız');
    } finally {
      setDuzenleSaving(false);
    }
  };

  const tabBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api.getProje(id),
      api.getProjeIstatistik(id).catch(() => null),
    ])
      .then(([projeData, istatistikData]) => {
        setProje(projeData);
        setIstatistik(istatistikData);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Proje yüklenemedi'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleTabChange = (sekmeId: SekmeId) => {
    setActiveTab(sekmeId);
    setYuklenenSekmeler((prev) => ({ ...prev, [sekmeId]: true }));
    // Tab'ı görünür yap
    const tabBar = tabBarRef.current;
    if (tabBar) {
      const btn = tabBar.querySelector(`[data-tab="${sekmeId}"]`) as HTMLElement | null;
      if (btn) {
        btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  };

  const handleToggle = async (aktif: boolean) => {
    if (!proje) return;
    setToggling(true);
    try {
      const updated = await api.updateProje(proje.id, { durum: aktif ? 'aktif' : 'pasif' });
      setProje(updated);
    } catch {
      // sessiz
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0E1117] px-4 py-5">
        <div className="animate-pulse space-y-4">
          <div className="h-5 bg-[#1E2636] rounded w-24 mb-1" />
          <div className="h-32 bg-[#1E2636] rounded-2xl" />
          <div className="h-12 bg-[#1E2636] rounded-xl" />
          <Skeleton rows={3} />
        </div>
      </div>
    );
  }

  if (error || !proje) {
    return (
      <div className="min-h-screen bg-[#0E1117] px-4 py-5">
        <button
          onClick={() => router.back()}
          className="text-[#94A3B8] text-sm mb-5 flex items-center gap-1.5 hover:text-white transition-colors min-h-[44px]"
        >
          ← Projeler
        </button>
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center">
          <p className="text-red-400 text-sm">{error ?? 'Proje bulunamadı'}</p>
        </div>
      </div>
    );
  }

  const durumRengi = proje.durum === 'aktif'
    ? 'bg-green-500/20 text-green-400 border-green-500/30'
    : proje.durum === 'tamamlandi'
    ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    : proje.durum === 'iptal'
    ? 'bg-red-500/20 text-red-400 border-red-500/30'
    : 'bg-[#2A3447] text-[#94A3B8] border-white/[0.07]';

  const durumMetin: Record<string, string> = {
    aktif: 'Aktif', pasif: 'Pasif', tamamlandi: 'Tamamlandı', iptal: 'İptal',
  };

  return (
    <div className="min-h-screen bg-[#0E1117]">
      {/* ── Üst bar ── */}
      <div className="px-4 pt-5 pb-4">
        <button
          onClick={() => router.back()}
          className="text-[#94A3B8] text-sm mb-4 flex items-center gap-1.5 hover:text-[#F1F5F9] transition-colors min-h-[44px]"
        >
          ← Projeler
        </button>

        {/* Hero kart */}
        <div className="bg-[#161B26] rounded-2xl border border-white/[0.07] p-5">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1 min-w-0 mr-3">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-[#F1F5F9] text-xl font-bold font-[var(--font-syne)] leading-tight">
                  {proje.isim}
                </h1>
                <span className={`text-[10px] border px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${durumRengi}`}>
                  {durumMetin[proje.durum] ?? proje.durum}
                </span>
              </div>
              {(proje.il || proje.ilce) && (
                <div className="flex items-center gap-1 mt-1">
                  <svg className="w-3.5 h-3.5 text-[#94A3B8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-[#94A3B8] text-xs">
                    {[proje.il, proje.ilce].filter(Boolean).join(', ')}
                  </span>
                </div>
              )}
              {proje.proje_muduru && (
                <p className="text-[#94A3B8] text-xs mt-0.5">👤 {proje.proje_muduru}</p>
              )}
            </div>
            <ToggleSwitch
              checked={proje.durum === 'aktif'}
              onChange={handleToggle}
              disabled={toggling}
            />
          </div>

          {/* İlerleme çubuğu */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-[#94A3B8] text-xs">İlerleme</span>
              <span className="text-[#F59E0B] text-xs font-semibold">%{proje.ilerleme_yuzdesi}</span>
            </div>
            <ProgressBar value={proje.ilerleme_yuzdesi} />
          </div>

          {/* 4 İstatistik mini */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { label: 'İşçi',    value: istatistik ? String(istatistik.toplam_personel_bugun) : '—' },
              { label: 'Stok ⚠', value: istatistik ? String(istatistik.kritik_stok_sayisi)    : '—' },
              { label: 'ISG',     value: istatistik ? String(istatistik.isg_acik_madde)         : '—' },
              { label: 'Medya',   value: istatistik ? String(istatistik.medya_sayisi)           : '—' },
            ].map((s) => (
              <div key={s.label} className="bg-[#0E1117] rounded-xl p-2.5 text-center">
                <p className="text-[#F59E0B] text-sm font-bold font-[var(--font-syne)]">{s.value}</p>
                <p className="text-[#94A3B8] text-[10px] mt-0.5 truncate">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Sekme çubuğu (sticky, yatay kaydırmalı) ── */}
      <div className="sticky top-0 z-20 bg-[#0E1117]/95 backdrop-blur-sm border-b border-white/[0.07]">
        <div
          ref={tabBarRef}
          className="flex overflow-x-auto px-2 gap-0.5"
          style={{ scrollbarWidth: 'none' }}
        >
          {SEKMELER.map((s) => (
            <button
              key={s.id}
              data-tab={s.id}
              onClick={() => handleTabChange(s.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-3 text-xs font-medium border-b-2 transition-colors whitespace-nowrap min-h-[48px] ${
                activeTab === s.id
                  ? 'border-[#F59E0B] text-[#F59E0B] bg-amber-500/5'
                  : 'border-transparent text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/[0.03]'
              }`}
            >
              <span className="text-sm">{s.icon}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Sekme içerikleri (lazy) ── */}
      <div className="px-4 py-5 pb-28">
        {/* Özet her zaman render edilir */}
        <div className={activeTab === 'ozet' ? '' : 'hidden'}>
          <OzetTab proje={proje} istatistik={istatistik} projeId={id} onDuzenleClick={handleDuzenleAc} />
        </div>

        {yuklenenSekmeler.cizimler && (
          <div className={activeTab === 'cizimler' ? '' : 'hidden'}>
            <CizimlerTab projeId={id} />
          </div>
        )}

        {yuklenenSekmeler.notlar && (
          <div className={activeTab === 'notlar' ? '' : 'hidden'}>
            <NotlarTab projeId={id} />
          </div>
        )}

        {yuklenenSekmeler.dosyalar && (
          <div className={activeTab === 'dosyalar' ? '' : 'hidden'}>
            <DosyalarTab projeId={id} />
          </div>
        )}

        {yuklenenSekmeler.galeri && (
          <div className={activeTab === 'galeri' ? '' : 'hidden'}>
            <GaleriTab projeId={id} />
          </div>
        )}

        {yuklenenSekmeler.puantaj && (
          <div className={activeTab === 'puantaj' ? '' : 'hidden'}>
            <PuantajTab projeId={id} />
          </div>
        )}

        {yuklenenSekmeler.stok && (
          <div className={activeTab === 'stok' ? '' : 'hidden'}>
            <StokTab projeId={id} />
          </div>
        )}

        {yuklenenSekmeler.isg && (
          <div className={activeTab === 'isg' ? '' : 'hidden'}>
            <IsgTab projeId={id} />
          </div>
        )}

        {yuklenenSekmeler.hakedis && (
          <div className={activeTab === 'hakedis' ? '' : 'hidden'}>
            <HakedisTab proje={proje} />
          </div>
        )}

        {yuklenenSekmeler.raporlar && (
          <div className={activeTab === 'raporlar' ? '' : 'hidden'}>
            <RaporlarTab proje={proje} />
          </div>
        )}

        {yuklenenSekmeler.toplanti && (
          <div className={activeTab === 'toplanti' ? '' : 'hidden'}>
            <ToplantiTab projeId={id} />
          </div>
        )}

        {yuklenenSekmeler.aktivite && (
          <div className={activeTab === 'aktivite' ? '' : 'hidden'}>
            <AktiviteTab projeId={id} />
          </div>
        )}
      </div>

      {/* ── Proje Düzenleme Modal ── */}
      {duzenleAcik && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={() => setDuzenleAcik(false)}
        >
          <div
            style={{ background: '#161B26', borderRadius: '24px 24px 0 0', width: '100%', maxWidth: 520, borderTop: '1px solid rgba(255,255,255,0.08)', padding: '20px 20px 36px', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ width: 40, height: 4, background: '#2A3447', borderRadius: 4, margin: '0 auto 16px' }} />
            <h2 style={{ color: '#F1F5F9', fontSize: 17, fontWeight: 700, fontFamily: 'Syne, sans-serif', marginBottom: 20 }}>Proje Bilgilerini Düzenle</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ color: '#94A3B8', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6 }}>PROJE ADI *</label>
                <input value={duzenleForm.isim ?? ''} onChange={e => setDuzenleForm(f => ({ ...f, isim: e.target.value }))}
                  style={{ width: '100%', background: '#1E2636', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '11px 14px', color: '#F1F5F9', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ color: '#94A3B8', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6 }}>TANIM</label>
                <textarea value={duzenleForm.tanim ?? ''} onChange={e => setDuzenleForm(f => ({ ...f, tanim: e.target.value }))} rows={2}
                  style={{ width: '100%', background: '#1E2636', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '11px 14px', color: '#F1F5F9', fontSize: 14, outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ color: '#94A3B8', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6 }}>İL</label>
                  <input value={duzenleForm.il ?? ''} onChange={e => setDuzenleForm(f => ({ ...f, il: e.target.value }))} placeholder="İstanbul"
                    style={{ width: '100%', background: '#1E2636', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '11px 14px', color: '#F1F5F9', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <label style={{ color: '#94A3B8', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6 }}>İLÇE</label>
                  <input value={duzenleForm.ilce ?? ''} onChange={e => setDuzenleForm(f => ({ ...f, ilce: e.target.value }))} placeholder="Kadıköy"
                    style={{ width: '100%', background: '#1E2636', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '11px 14px', color: '#F1F5F9', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
              <div>
                <label style={{ color: '#94A3B8', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6 }}>PROJE MÜDÜRÜ</label>
                <input value={duzenleForm.proje_muduru ?? ''} onChange={e => setDuzenleForm(f => ({ ...f, proje_muduru: e.target.value }))}
                  style={{ width: '100%', background: '#1E2636', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '11px 14px', color: '#F1F5F9', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ color: '#94A3B8', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6 }}>BÜTÇE (₺)</label>
                <input type="number" value={duzenleForm.butce ?? ''} onChange={e => setDuzenleForm(f => ({ ...f, butce: e.target.value ? Number(e.target.value) : undefined }))}
                  style={{ width: '100%', background: '#1E2636', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '11px 14px', color: '#F1F5F9', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ color: '#94A3B8', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6 }}>BAŞLANGIÇ</label>
                  <input type="date" value={duzenleForm.baslangic_tarihi ?? ''} onChange={e => setDuzenleForm(f => ({ ...f, baslangic_tarihi: e.target.value }))}
                    style={{ width: '100%', background: '#1E2636', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '11px 14px', color: '#F1F5F9', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <label style={{ color: '#94A3B8', fontSize: 11, fontWeight: 600 }}>BİTİŞ</label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                      <input type="checkbox" checked={duzenleForm.bitis_tarihi === ''}
                        onChange={e => setDuzenleForm(f => ({ ...f, bitis_tarihi: e.target.checked ? '' : undefined }))}
                        style={{ accentColor: '#F59E0B', width: 12, height: 12 }} />
                      <span style={{ color: '#94A3B8', fontSize: 10 }}>Belirsiz</span>
                    </label>
                  </div>
                  <input type="date" value={duzenleForm.bitis_tarihi ?? ''} disabled={duzenleForm.bitis_tarihi === ''}
                    onChange={e => setDuzenleForm(f => ({ ...f, bitis_tarihi: e.target.value }))}
                    style={{ width: '100%', background: '#1E2636', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '11px 14px', color: '#F1F5F9', fontSize: 14, outline: 'none', boxSizing: 'border-box', opacity: duzenleForm.bitis_tarihi === '' ? 0.4 : 1 }} />
                </div>
              </div>
              <div>
                <label style={{ color: '#94A3B8', fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                  İLERLEME: %{duzenleForm.ilerleme_yuzdesi ?? 0}
                </label>
                <input type="range" min={0} max={100} value={duzenleForm.ilerleme_yuzdesi ?? 0}
                  onChange={e => setDuzenleForm(f => ({ ...f, ilerleme_yuzdesi: Number(e.target.value) }))}
                  style={{ width: '100%', accentColor: '#F59E0B' }} />
              </div>
            </div>

            {duzenleErr && (
              <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '10px 14px', color: '#FCA5A5', fontSize: 13, marginTop: 14 }}>
                {duzenleErr}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={handleDuzenleKaydet} disabled={duzenleSaving}
                style={{ flex: 1, background: duzenleSaving ? 'rgba(245,158,11,0.5)' : '#F59E0B', color: '#000', borderRadius: 14, padding: '13px', fontWeight: 700, fontSize: 15, border: 'none', cursor: duzenleSaving ? 'default' : 'pointer', fontFamily: 'Syne, sans-serif' }}>
                {duzenleSaving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
              <button onClick={() => setDuzenleAcik(false)}
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
