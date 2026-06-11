'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Toplanti } from '@/types';

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-[#1E2636] rounded-2xl p-4 animate-pulse">
          <div className="h-5 bg-[#2A3447] rounded w-2/3 mb-2" />
          <div className="h-3 bg-[#2A3447] rounded w-1/3 mb-3" />
          <div className="h-3 bg-[#2A3447] rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}

// ── Tag Input ─────────────────────────────────────────────────────────────────

function TagInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const tags = value ? value.split(',').map((t) => t.trim()).filter(Boolean) : [];
  const [input, setInput] = useState('');

  const addTag = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    const yeni = [...tags, trimmed].join(', ');
    onChange(yeni);
    setInput('');
  };

  const removeTag = (idx: number) => {
    const yeni = tags.filter((_, i) => i !== idx).join(', ');
    onChange(yeni);
  };

  return (
    <div className="bg-[#1E2636] border border-white/[0.1] rounded-xl px-3 py-2 focus-within:border-[#F59E0B]/60">
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map((tag, i) => (
          <span key={i} className="flex items-center gap-1 bg-[#2A3447] text-[#F1F5F9] text-xs px-2 py-1 rounded-lg">
            {tag}
            <button
              type="button"
              onClick={() => removeTag(i)}
              className="text-[#94A3B8] hover:text-red-400 ml-0.5 text-xs leading-none"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 bg-transparent text-[#F1F5F9] text-sm placeholder-[#94A3B8] focus:outline-none"
          placeholder={placeholder ?? 'İsim yaz, Enter ile ekle'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); addTag(); }
          }}
        />
        {input.trim() && (
          <button
            type="button"
            onClick={addTag}
            className="text-[#F59E0B] text-xs font-semibold px-2"
          >
            Ekle
          </button>
        )}
      </div>
    </div>
  );
}

// ── Yeni Toplantı Modal ───────────────────────────────────────────────────────

function YeniToplantiModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<Toplanti>) => Promise<void>;
}) {
  const [form, setForm] = useState<Partial<Toplanti>>({
    baslik: '',
    tarih: new Date().toISOString().split('T')[0],
    yer: '',
    katilanlar: '',
    notlar: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.baslik?.trim()) { setErr('Başlık zorunludur'); return; }
    if (!form.tarih) { setErr('Tarih zorunludur'); return; }
    setSaving(true);
    setErr(null);
    try {
      await onSave(form);
      setForm({
        baslik: '',
        tarih: new Date().toISOString().split('T')[0],
        yer: '',
        katilanlar: '',
        notlar: '',
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
        className="bg-[#161B26] rounded-t-3xl w-full max-w-lg border-t border-white/[0.1] p-5 pb-8 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 bg-[#2A3447] rounded-full mx-auto mb-5" />
        <h2 className="text-[#F1F5F9] text-lg font-bold font-[var(--font-syne)] mb-4">Yeni Toplantı</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Başlık */}
          <input
            required
            className="w-full bg-[#1E2636] border border-white/[0.1] rounded-xl px-4 py-3 text-[#F1F5F9] text-sm placeholder-[#94A3B8] focus:outline-none focus:border-[#F59E0B]/60"
            placeholder="Toplantı başlığı *"
            value={form.baslik}
            onChange={(e) => setForm({ ...form, baslik: e.target.value })}
          />

          {/* Tarih & Yer */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[#94A3B8] text-xs mb-1 block">Tarih *</label>
              <input
                type="date"
                required
                className="w-full bg-[#1E2636] border border-white/[0.1] rounded-xl px-4 py-3 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#F59E0B]/60"
                value={form.tarih}
                onChange={(e) => setForm({ ...form, tarih: e.target.value })}
              />
            </div>
            <div>
              <label className="text-[#94A3B8] text-xs mb-1 block">Yer</label>
              <input
                className="w-full bg-[#1E2636] border border-white/[0.1] rounded-xl px-4 py-3 text-[#F1F5F9] text-sm placeholder-[#94A3B8] focus:outline-none focus:border-[#F59E0B]/60"
                placeholder="Toplantı yeri"
                value={form.yer ?? ''}
                onChange={(e) => setForm({ ...form, yer: e.target.value })}
              />
            </div>
          </div>

          {/* Katılanlar */}
          <div>
            <label className="text-[#94A3B8] text-xs mb-1.5 block">Katılanlar</label>
            <TagInput
              value={form.katilanlar ?? ''}
              onChange={(v) => setForm({ ...form, katilanlar: v })}
              placeholder="İsim yaz, Enter ile ekle..."
            />
          </div>

          {/* Notlar */}
          <div>
            <label className="text-[#94A3B8] text-xs mb-1 block">Notlar</label>
            <textarea
              rows={4}
              className="w-full bg-[#1E2636] border border-white/[0.1] rounded-xl px-4 py-3 text-[#F1F5F9] text-sm placeholder-[#94A3B8] focus:outline-none focus:border-[#F59E0B]/60 resize-none"
              placeholder="Toplantı notları, kararlar, eylem maddeleri..."
              value={form.notlar ?? ''}
              onChange={(e) => setForm({ ...form, notlar: e.target.value })}
            />
          </div>

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

export default function ToplantiPage() {
  const [toplantilar, setToplantilar] = useState<Toplanti[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [acikKart, setAcikKart] = useState<string | null>(null);

  useEffect(() => {
    api.getToplantilar()
      .then(setToplantilar)
      .catch(() => setToplantilar([]))
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (data: Partial<Toplanti>) => {
    const yeni = await api.createToplanti(data);
    setToplantilar((prev) => [yeni, ...prev]);
  };

  const katılanSayisi = (katilanlar: string | null) => {
    if (!katilanlar) return 0;
    return katilanlar.split(',').filter(Boolean).length;
  };

  return (
    <div className="min-h-screen bg-[#0E1117] px-4 py-5 pb-24">
      {/* Başlık */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[#F1F5F9] text-xl font-bold font-[var(--font-syne)]">Toplantı Notları</h1>
          {!loading && (
            <p className="text-[#94A3B8] text-xs mt-0.5">{toplantilar.length} toplantı</p>
          )}
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 bg-[#F59E0B] text-black text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#D97706] transition-colors"
        >
          <span>+</span>
          <span>Yeni Toplantı</span>
        </button>
      </div>

      {/* Loading */}
      {loading && <Skeleton />}

      {/* Boş Durum */}
      {!loading && toplantilar.length === 0 && (
        <div className="bg-[#1E2636] rounded-2xl p-10 text-center border border-white/[0.07]">
          <span className="text-4xl block mb-3">🗒️</span>
          <p className="text-[#94A3B8] text-sm">Henüz toplantı notu eklenmedi</p>
          <button
            onClick={() => setModalOpen(true)}
            className="mt-3 text-[#F59E0B] text-sm font-medium hover:underline"
          >
            İlk toplantıyı ekle →
          </button>
        </div>
      )}

      {/* Toplantı Listesi */}
      {!loading && toplantilar.length > 0 && (
        <div className="space-y-3">
          {toplantilar.map((t) => {
            const acik = acikKart === t.id;
            const sayi = katılanSayisi(t.katilanlar);
            return (
              <div key={t.id} className="bg-[#1E2636] rounded-2xl border border-white/[0.07] overflow-hidden">
                {/* Kart başlığı */}
                <div
                  className="p-4 cursor-pointer hover:bg-[#252f42] transition-colors"
                  onClick={() => setAcikKart(acik ? null : t.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[#F1F5F9] font-bold text-sm font-[var(--font-syne)] leading-snug">
                        {t.baslik}
                      </h3>
                      <div className="flex items-center flex-wrap gap-3 mt-1.5">
                        <span className="text-[#94A3B8] text-xs flex items-center gap-1">
                          <span>📅</span>
                          {new Date(t.tarih).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </span>
                        {t.yer && (
                          <span className="text-[#94A3B8] text-xs flex items-center gap-1">
                            <span>📍</span>
                            {t.yer}
                          </span>
                        )}
                        {sayi > 0 && (
                          <span className="text-[#94A3B8] text-xs flex items-center gap-1">
                            <span>👥</span>
                            {sayi} katılımcı
                          </span>
                        )}
                      </div>
                    </div>
                    <svg
                      className={`w-4 h-4 text-[#94A3B8] flex-shrink-0 mt-1 transition-transform ${acik ? 'rotate-180' : ''}`}
                      fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Accordion: Katılanlar + Notlar */}
                {acik && (
                  <div className="border-t border-white/[0.07] p-4 space-y-3">
                    {t.katilanlar && (
                      <div>
                        <p className="text-[#94A3B8] text-xs font-medium mb-2">Katılanlar</p>
                        <div className="flex flex-wrap gap-1.5">
                          {t.katilanlar.split(',').map((k, i) => (
                            k.trim() && (
                              <span key={i} className="bg-[#2A3447] text-[#F1F5F9] text-xs px-2.5 py-1 rounded-lg">
                                {k.trim()}
                              </span>
                            )
                          ))}
                        </div>
                      </div>
                    )}
                    {t.notlar && (
                      <div>
                        <p className="text-[#94A3B8] text-xs font-medium mb-2">Notlar</p>
                        <p className="text-[#F1F5F9] text-sm leading-relaxed whitespace-pre-wrap">{t.notlar}</p>
                      </div>
                    )}
                    {!t.katilanlar && !t.notlar && (
                      <p className="text-[#94A3B8] text-sm text-center py-2">Not eklenmemiş</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <YeniToplantiModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleCreate}
      />
    </div>
  );
}
