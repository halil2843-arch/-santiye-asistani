'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { StokKalemi, ProjeResponse } from '@/types';

// ── Yardımcı Bileşenler ──────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-[#1E2636] rounded-2xl p-4 animate-pulse">
          <div className="h-4 bg-[#2A3447] rounded w-2/3 mb-2" />
          <div className="h-3 bg-[#2A3447] rounded w-1/3 mb-3" />
          <div className="h-2 bg-[#2A3447] rounded w-full" />
        </div>
      ))}
    </div>
  );
}

// Yeni Kalem Modal
function YeniKalemModal({
  open,
  onClose,
  onSave,
  projeler,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<StokKalemi>) => Promise<void>;
  projeler: ProjeResponse[];
}) {
  const [form, setForm] = useState<Partial<StokKalemi>>({
    malzeme_adi: '',
    birim: '',
    miktar: 0,
    min_miktar: 0,
    proje_id: null,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.malzeme_adi?.trim()) { setErr('Malzeme adı zorunludur'); return; }
    setSaving(true);
    setErr(null);
    try {
      await onSave(form);
      setForm({ malzeme_adi: '', birim: '', miktar: 0, min_miktar: 0, proje_id: null });
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
        className="bg-[#161B26] rounded-t-3xl w-full max-w-lg border-t border-white/[0.1] p-5 pb-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-[#2A3447] rounded-full mx-auto mb-5" />
        <h2 className="text-[#F1F5F9] text-lg font-bold font-[var(--font-syne)] mb-4">Yeni Stok Kalemi</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            className="w-full bg-[#1E2636] border border-white/[0.1] rounded-xl px-4 py-3 text-[#F1F5F9] text-sm placeholder-[#94A3B8] focus:outline-none focus:border-[#F59E0B]/60"
            placeholder="Malzeme adı *"
            value={form.malzeme_adi}
            onChange={(e) => setForm({ ...form, malzeme_adi: e.target.value })}
          />
          <div className="grid grid-cols-3 gap-3">
            <input
              className="bg-[#1E2636] border border-white/[0.1] rounded-xl px-4 py-3 text-[#F1F5F9] text-sm placeholder-[#94A3B8] focus:outline-none focus:border-[#F59E0B]/60"
              placeholder="Birim (adet, kg...)"
              value={form.birim ?? ''}
              onChange={(e) => setForm({ ...form, birim: e.target.value })}
            />
            <input
              type="number"
              min="0"
              className="bg-[#1E2636] border border-white/[0.1] rounded-xl px-4 py-3 text-[#F1F5F9] text-sm placeholder-[#94A3B8] focus:outline-none focus:border-[#F59E0B]/60"
              placeholder="Miktar"
              value={form.miktar ?? 0}
              onChange={(e) => setForm({ ...form, miktar: parseFloat(e.target.value) || 0 })}
            />
            <input
              type="number"
              min="0"
              className="bg-[#1E2636] border border-white/[0.1] rounded-xl px-4 py-3 text-[#F1F5F9] text-sm placeholder-[#94A3B8] focus:outline-none focus:border-[#F59E0B]/60"
              placeholder="Min. miktar"
              value={form.min_miktar ?? 0}
              onChange={(e) => setForm({ ...form, min_miktar: parseFloat(e.target.value) || 0 })}
            />
          </div>
          {projeler.length > 0 && (
            <select
              className="w-full bg-[#1E2636] border border-white/[0.1] rounded-xl px-4 py-3 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#F59E0B]/60"
              value={form.proje_id ?? ''}
              onChange={(e) => setForm({ ...form, proje_id: e.target.value || null })}
            >
              <option value="">Proje seç (opsiyonel)</option>
              {projeler.map((p) => (
                <option key={p.id} value={p.id}>{p.isim}</option>
              ))}
            </select>
          )}

          {err && <p className="text-red-400 text-sm">{err}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-[#F59E0B] text-black font-semibold py-3 rounded-xl mt-2 disabled:opacity-50 transition-colors hover:bg-[#D97706]"
          >
            {saving ? 'Kaydediliyor...' : 'Kaydet'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Ana Sayfa ─────────────────────────────────────────────────────────────────

export default function StokPage() {
  const [kalemler, setKalemler] = useState<StokKalemi[]>([]);
  const [projeler, setProjeler] = useState<ProjeResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [secilenProje, setSecilenProje] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [hareketAcik, setHareketAcik] = useState<string | null>(null);
  const [girisValue, setGirisValue] = useState('');
  const [cikisValue, setCikisValue] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchStok = () => {
    api.getStokKalemleri(secilenProje || undefined)
      .then(setKalemler)
      .catch(() => setKalemler([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    api.getProjeler()
      .then(setProjeler)
      .catch(() => setProjeler([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchStok();
  }, [secilenProje]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async (data: Partial<StokKalemi>) => {
    const yeni = await api.createStokKalemi(data);
    setKalemler((prev) => [yeni, ...prev]);
  };

  const handleHareket = async (id: string, tip: 'giris' | 'cikis') => {
    const val = tip === 'giris' ? parseFloat(girisValue) : parseFloat(cikisValue);
    if (isNaN(val) || val <= 0) return;
    setSaving(true);
    try {
      await api.stokHareket(id, tip, val);
      setGirisValue('');
      setCikisValue('');
      setHareketAcik(null);
      fetchStok();
    } catch {
      // sessiz
    } finally {
      setSaving(false);
    }
  };

  const kritikler = kalemler.filter((k) => k.kritik);

  const formatPct = (k: StokKalemi) =>
    k.min_miktar > 0 ? Math.min(100, Math.round((k.miktar / k.min_miktar) * 100)) : 100;

  return (
    <div className="min-h-screen bg-[#0E1117] px-4 py-5 pb-24">
      {/* Başlık */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[#F1F5F9] text-xl font-bold font-[var(--font-syne)]">Stok Yönetimi</h1>
          {!loading && (
            <p className="text-[#94A3B8] text-xs mt-0.5">{kalemler.length} kalem</p>
          )}
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 bg-[#F59E0B] text-black text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#D97706] transition-colors"
        >
          <span>+</span>
          <span>Yeni Kalem</span>
        </button>
      </div>

      {/* Proje Filtresi */}
      <div className="mb-4">
        <select
          className="w-full bg-[#1E2636] border border-white/[0.07] rounded-xl px-4 py-3 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#F59E0B]/60"
          value={secilenProje}
          onChange={(e) => setSecilenProje(e.target.value)}
        >
          <option value="">Tüm Projeler</option>
          {projeler.map((p) => (
            <option key={p.id} value={p.id}>{p.isim}</option>
          ))}
        </select>
      </div>

      {/* Kritik Uyarı Banner */}
      {!loading && kritikler.length > 0 && (
        <div style={{
          background: 'rgba(239,68,68,0.15)',
          border: '2px solid rgba(239,68,68,0.5)',
          borderRadius: '12px', padding: '12px 16px',
          marginBottom: '16px',
          display: 'flex', alignItems: 'center', gap: '12px',
          animation: 'kritik-pulse 2s ease-in-out infinite',
        }}>
          <style>{`
            @keyframes kritik-pulse {
              0%, 100% { border-color: rgba(239,68,68,0.5); box-shadow: none; }
              50% { border-color: rgba(239,68,68,0.9); box-shadow: 0 0 12px rgba(239,68,68,0.3); }
            }
          `}</style>
          <span style={{ fontSize: 22 }}>⚠️</span>
          <div>
            <p style={{ color: '#F87171', fontSize: 13, fontWeight: 700, marginBottom: 2 }}>
              Kritik Stok Uyarısı
            </p>
            <p style={{ color: 'rgba(248,113,113,0.75)', fontSize: 11 }}>
              {kritikler.length} kalem kritik seviyenin altında: {kritikler.map((k) => k.malzeme_adi).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Liste */}
      {loading ? (
        <Skeleton />
      ) : kalemler.length === 0 ? (
        <div className="bg-[#1E2636] rounded-2xl p-10 text-center border border-white/[0.07]">
          <span className="text-4xl block mb-3">📦</span>
          <p className="text-[#94A3B8] text-sm">Henüz stok kalemi eklenmedi</p>
          <button
            onClick={() => setModalOpen(true)}
            className="mt-3 text-[#F59E0B] text-sm font-medium hover:underline"
          >
            İlk kalemi ekle →
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {kalemler.map((k) => {
            const pct = formatPct(k);
            const acik = hareketAcik === k.id;
            return (
              <div
                key={k.id}
                className={`bg-[#1E2636] rounded-2xl border transition-colors ${
                  k.kritik ? 'border-red-500/40' : 'border-white/[0.07]'
                }`}
              >
                {/* Kalem başlığı */}
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => setHareketAcik(acik ? null : k.id)}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-[#2A3447] rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="text-lg">📦</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[#F1F5F9] text-sm font-semibold font-[var(--font-syne)] truncate">
                          {k.malzeme_adi}
                        </p>
                        {k.kritik && (
                          <span className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full flex-shrink-0">
                            Kritik
                          </span>
                        )}
                      </div>
                      <p className="text-[#94A3B8] text-xs mt-0.5">
                        {k.miktar} {k.birim ?? 'adet'} · min {k.min_miktar} {k.birim ?? 'adet'}
                      </p>
                    </div>
                    <svg
                      className={`w-4 h-4 text-[#94A3B8] flex-shrink-0 transition-transform ${acik ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[#94A3B8] text-[10px]">Stok seviyesi</span>
                      <span className={`text-[10px] font-semibold ${pct < 50 ? 'text-red-400' : 'text-[#F59E0B]'}`}>
                        %{pct}
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

                {/* Hareket Accordion */}
                {acik && (
                  <div className="border-t border-white/[0.07] p-4 space-y-3">
                    <p className="text-[#94A3B8] text-xs font-medium mb-2">Stok Hareketi</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[#94A3B8] text-xs mb-1.5 block">Giriş Miktarı</label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            min="0"
                            value={girisValue}
                            onChange={(e) => setGirisValue(e.target.value)}
                            placeholder="0"
                            className="flex-1 bg-[#0E1117] border border-white/[0.1] rounded-xl px-3 py-2.5 text-[#F1F5F9] text-sm focus:outline-none focus:border-green-500/60"
                          />
                          <button
                            disabled={saving || !girisValue}
                            onClick={() => handleHareket(k.id, 'giris')}
                            className="bg-green-500/20 border border-green-500/30 text-green-400 px-3 rounded-xl text-xs font-semibold hover:bg-green-500/30 disabled:opacity-40 transition-colors"
                          >
                            + Giriş
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="text-[#94A3B8] text-xs mb-1.5 block">Çıkış Miktarı</label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            min="0"
                            value={cikisValue}
                            onChange={(e) => setCikisValue(e.target.value)}
                            placeholder="0"
                            className="flex-1 bg-[#0E1117] border border-white/[0.1] rounded-xl px-3 py-2.5 text-[#F1F5F9] text-sm focus:outline-none focus:border-red-500/60"
                          />
                          <button
                            disabled={saving || !cikisValue}
                            onClick={() => handleHareket(k.id, 'cikis')}
                            className="bg-red-500/20 border border-red-500/30 text-red-400 px-3 rounded-xl text-xs font-semibold hover:bg-red-500/30 disabled:opacity-40 transition-colors"
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

      {/* Modal */}
      <YeniKalemModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleCreate}
        projeler={projeler}
      />
    </div>
  );
}
