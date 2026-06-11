'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { ProjeResponse, ProjeCreate } from '@/types';

// Toggle Switch
function ToggleSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
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

// Progress Bar
function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="w-full bg-[#2A3447] rounded-full h-1.5 overflow-hidden">
      <div
        className="h-full rounded-full bg-gradient-to-r from-[#F59E0B] to-[#FBBF24] transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

// Yeni Proje Modal
function YeniProjeModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: ProjeCreate) => Promise<void>;
}) {
  const [form, setForm] = useState<ProjeCreate & { bitis_belirsiz: boolean }>({
    santiye_id: '',
    isim: '',
    il: '',
    ilce: '',
    proje_muduru: '',
    baslangic_tarihi: '',
    bitis_tarihi: '',
    bitis_belirsiz: false,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.isim.trim()) { setErr('Proje adı zorunludur'); return; }
    setSaving(true);
    setErr(null);
    try {
      const { bitis_belirsiz, ...rest } = form;
      await onSave({
        ...rest,
        bitis_tarihi: bitis_belirsiz ? undefined : form.bitis_tarihi || undefined,
      });
      onClose();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Kaydedilemedi');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-[#161B26] rounded-t-3xl w-full max-w-lg border-t border-[rgba(255,255,255,0.1)] p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-[#2A3447] rounded-full mx-auto mb-5" />
        <h2 className="text-[#F1F5F9] text-lg font-bold font-[var(--font-syne)] mb-4">Yeni Proje</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            className="w-full bg-[#1E2636] border border-[rgba(255,255,255,0.1)] rounded-xl px-4 py-3 text-[#F1F5F9] text-sm placeholder-[#94A3B8] focus:outline-none focus:border-[#F59E0B]/60"
            placeholder="Proje adı *"
            value={form.isim}
            onChange={(e) => setForm({ ...form, isim: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              className="bg-[#1E2636] border border-[rgba(255,255,255,0.1)] rounded-xl px-4 py-3 text-[#F1F5F9] text-sm placeholder-[#94A3B8] focus:outline-none focus:border-[#F59E0B]/60"
              placeholder="İl"
              value={form.il}
              onChange={(e) => setForm({ ...form, il: e.target.value })}
            />
            <input
              className="bg-[#1E2636] border border-[rgba(255,255,255,0.1)] rounded-xl px-4 py-3 text-[#F1F5F9] text-sm placeholder-[#94A3B8] focus:outline-none focus:border-[#F59E0B]/60"
              placeholder="İlçe"
              value={form.ilce}
              onChange={(e) => setForm({ ...form, ilce: e.target.value })}
            />
          </div>
          <input
            className="w-full bg-[#1E2636] border border-[rgba(255,255,255,0.1)] rounded-xl px-4 py-3 text-[#F1F5F9] text-sm placeholder-[#94A3B8] focus:outline-none focus:border-[#F59E0B]/60"
            placeholder="Proje müdürü"
            value={form.proje_muduru}
            onChange={(e) => setForm({ ...form, proje_muduru: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[#94A3B8] text-xs mb-1 block">Başlangıç</label>
              <input
                type="date"
                className="w-full bg-[#1E2636] border border-[rgba(255,255,255,0.1)] rounded-xl px-4 py-3 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#F59E0B]/60"
                value={form.baslangic_tarihi}
                onChange={(e) => setForm({ ...form, baslangic_tarihi: e.target.value })}
              />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <label className="text-[#94A3B8] text-xs">Bitiş</label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.bitis_belirsiz}
                    onChange={(e) => setForm({ ...form, bitis_belirsiz: e.target.checked, bitis_tarihi: e.target.checked ? '' : form.bitis_tarihi })}
                    style={{ accentColor: '#F59E0B', width: 14, height: 14 }}
                  />
                  <span style={{ color: '#94A3B8', fontSize: 11 }}>Belirsiz</span>
                </label>
              </div>
              <input
                type="date"
                disabled={form.bitis_belirsiz}
                className="w-full bg-[#1E2636] border border-[rgba(255,255,255,0.1)] rounded-xl px-4 py-3 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#F59E0B]/60 disabled:opacity-40 disabled:cursor-not-allowed"
                value={form.bitis_tarihi}
                onChange={(e) => setForm({ ...form, bitis_tarihi: e.target.value })}
              />
            </div>
          </div>

          {err && <p className="text-red-400 text-sm">{err}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[#F59E0B] text-white font-semibold py-3 rounded-xl mt-2 disabled:opacity-50 transition-colors hover:bg-[#D97706]"
          >
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ProjelerPage() {
  const [projeler, setProjeler] = useState<ProjeResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [arsivedOpen, setArsivedOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchProjeler = useCallback(async () => {
    try {
      const data = await api.getProjeler();
      setProjeler(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Projeler yüklenemedi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProjeler(); }, [fetchProjeler]);

  const handleToggle = async (proje: ProjeResponse, aktif: boolean) => {
    const yeniDurum = aktif ? 'aktif' : 'pasif';
    setTogglingId(proje.id);
    try {
      await api.updateProje(proje.id, { durum: yeniDurum });
      setProjeler((prev) =>
        prev.map((p) => (p.id === proje.id ? { ...p, durum: yeniDurum } : p))
      );
    } catch {
      // Sessizce geri al
    } finally {
      setTogglingId(null);
    }
  };

  const handleCreate = async (data: ProjeCreate) => {
    const yeni = await api.createProje(data);
    setProjeler((prev) => [yeni, ...prev]);
  };

  const aktifProjeler = projeler.filter((p) => p.durum === 'aktif');
  const pasifProjeler = projeler.filter((p) => p.durum !== 'aktif');

  return (
    <div className="min-h-screen bg-[#0E1117] px-4 py-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[#F1F5F9] text-xl font-bold font-[var(--font-syne)]">Projeler</h1>
          {!loading && (
            <p className="text-[#94A3B8] text-xs mt-0.5">
              <span className="text-[#F59E0B] font-medium">{aktifProjeler.length} aktif</span>
              {pasifProjeler.length > 0 && ` · ${pasifProjeler.length} pasif`}
            </p>
          )}
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 bg-[#F59E0B] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#D97706] transition-colors"
        >
          <span>+</span>
          <span>Yeni Proje</span>
        </button>
      </div>

      {/* Hata */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-[#1E2636] rounded-2xl p-4 animate-pulse">
              <div className="h-4 bg-[#2A3447] rounded w-2/3 mb-2" />
              <div className="h-3 bg-[#2A3447] rounded w-1/3 mb-3" />
              <div className="h-2 bg-[#2A3447] rounded w-full" />
            </div>
          ))}
        </div>
      )}

      {/* Aktif Projeler */}
      {!loading && (
        <div className="space-y-3 mb-5">
          {aktifProjeler.length === 0 ? (
            <div className="bg-[#1E2636] rounded-2xl p-8 text-center border border-[rgba(255,255,255,0.07)]">
              <p className="text-[#94A3B8] text-sm">Aktif proje bulunamadı</p>
              <button
                onClick={() => setModalOpen(true)}
                className="mt-3 text-[#F59E0B] text-sm font-medium hover:underline"
              >
                İlk projeyi oluştur →
              </button>
            </div>
          ) : (
            aktifProjeler.map((proje) => (
              <div
                key={proje.id}
                className="bg-[#1E2636] rounded-2xl p-4 border border-[rgba(255,255,255,0.07)] hover:border-[rgba(255,255,255,0.12)] transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0 mr-3">
                    <Link href={`/yonetim/projeler/${proje.id}`} className="block hover:text-[#F59E0B] transition-colors">
                    <h3 className="text-[#F1F5F9] font-bold text-sm font-[var(--font-syne)] truncate">
                      {proje.isim}
                    </h3>
                    </Link>
                    {(proje.il || proje.ilce) && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <svg className="w-3 h-3 text-[#94A3B8] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="text-[#94A3B8] text-xs">{[proje.il, proje.ilce].filter(Boolean).join(', ')}</span>
                      </div>
                    )}
                  </div>
                  <ToggleSwitch
                    checked={proje.durum === 'aktif'}
                    onChange={(val) => handleToggle(proje, val)}
                    disabled={togglingId === proje.id}
                  />
                </div>

                {/* Meta chips */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {proje.baslangic_tarihi && (
                    <span className="text-[10px] text-[#94A3B8] bg-[#2A3447] px-2 py-0.5 rounded-full">
                      📅 {proje.baslangic_tarihi}
                    </span>
                  )}
                  {proje.proje_muduru && (
                    <span className="text-[10px] text-[#94A3B8] bg-[#2A3447] px-2 py-0.5 rounded-full">
                      👤 {proje.proje_muduru}
                    </span>
                  )}
                </div>

                {/* İlerleme barı */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[#94A3B8] text-[10px]">İlerleme</span>
                    <span className="text-[#F59E0B] text-[10px] font-semibold">%{proje.ilerleme_yuzdesi}</span>
                  </div>
                  <ProgressBar value={proje.ilerleme_yuzdesi} />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Arşiv Klasörü (Pasif Projeler) */}
      {!loading && pasifProjeler.length > 0 && (
        <div>
          <button
            className="w-full flex items-center justify-between bg-[#1E2636] rounded-2xl p-4 border border-[rgba(255,255,255,0.07)] text-left"
            onClick={() => setArsivedOpen(!arsivedOpen)}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">📁</span>
              <span className="text-[#94A3B8] text-sm font-medium">
                Pasif / Tamamlanan Projeler ({pasifProjeler.length})
              </span>
            </div>
            <svg
              className={`w-4 h-4 text-[#94A3B8] transition-transform ${arsivedOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {arsivedOpen && (
            <div className="mt-2 space-y-2">
              {pasifProjeler.map((proje) => (
                <div
                  key={proje.id}
                  className="bg-[#161B26] rounded-xl px-4 py-3 border border-[rgba(255,255,255,0.05)] flex items-center justify-between"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-[#94A3B8] text-sm truncate block">{proje.isim}</span>
                  </div>
                  <div className="flex items-center gap-3 ml-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      proje.durum === 'tamamlandi'
                        ? 'bg-green-500/20 text-green-400'
                        : proje.durum === 'iptal'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-[#2A3447] text-[#94A3B8]'
                    }`}>
                      {proje.durum}
                    </span>
                    <ToggleSwitch
                      checked={false}
                      onChange={(val) => handleToggle(proje, val)}
                      disabled={togglingId === proje.id}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      <YeniProjeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleCreate}
      />
    </div>
  );
}
