'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { IsgKaydi } from '@/types';

// ── Sabitler ─────────────────────────────────────────────────────────────────

const onemRenk: Record<string, string> = {
  kritik: 'bg-red-500/20 text-red-400 border-red-500/30',
  yuksek: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  orta:   'bg-amber-500/20 text-amber-400 border-amber-500/30',
  dusuk:  'bg-green-500/20 text-green-400 border-green-500/30',
};
const onemLabel: Record<string, string> = {
  kritik: 'Kritik', yuksek: 'Yüksek', orta: 'Orta', dusuk: 'Düşük',
};
const durumRenk: Record<string, string> = {
  acik:      'bg-red-500/20 text-red-400',
  kapandi:   'bg-green-500/20 text-green-400',
  ertelendi: 'bg-[#2A3447] text-[#94A3B8]',
};
const durumLabel: Record<string, string> = {
  acik: 'Açık', kapandi: 'Kapandı', ertelendi: 'Ertelendi',
};
const tipLabel: Record<string, string> = {
  olay: 'Olay', denetim: 'Denetim', egitim: 'Eğitim', ramak_kala: 'Ramak Kala',
};

// ── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-[#1E2636] rounded-2xl p-4 animate-pulse">
          <div className="h-4 bg-[#2A3447] rounded w-2/3 mb-2" />
          <div className="h-3 bg-[#2A3447] rounded w-1/3" />
        </div>
      ))}
    </div>
  );
}

// ── Yeni Kayıt Modal ──────────────────────────────────────────────────────────

function YeniKayitModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<IsgKaydi>) => Promise<void>;
}) {
  const [form, setForm] = useState<Partial<IsgKaydi>>({
    tip: 'olay',
    tarih: new Date().toISOString().split('T')[0],
    aciklama: '',
    onem_seviyesi: 'orta',
    sorumlu: '',
    durum: 'acik',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.tarih) { setErr('Tarih zorunludur'); return; }
    setSaving(true);
    setErr(null);
    try {
      await onSave(form);
      setForm({
        tip: 'olay',
        tarih: new Date().toISOString().split('T')[0],
        aciklama: '',
        onem_seviyesi: 'orta',
        sorumlu: '',
        durum: 'acik',
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
        <h2 className="text-[#F1F5F9] text-lg font-bold font-[var(--font-syne)] mb-4">Yeni ISG Kaydı</h2>
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Tip */}
          <div>
            <label className="text-[#94A3B8] text-xs mb-1.5 block">Tip</label>
            <div className="grid grid-cols-2 gap-2">
              {(['olay', 'denetim', 'egitim', 'ramak_kala'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm({ ...form, tip: t })}
                  className={`py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    form.tip === t
                      ? 'bg-[#F59E0B] text-black'
                      : 'bg-[#1E2636] border border-white/[0.1] text-[#94A3B8] hover:border-[#F59E0B]/40'
                  }`}
                >
                  {tipLabel[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Tarih */}
          <div>
            <label className="text-[#94A3B8] text-xs mb-1.5 block">Tarih</label>
            <input
              type="date"
              required
              className="w-full bg-[#1E2636] border border-white/[0.1] rounded-xl px-4 py-3 text-[#F1F5F9] text-sm focus:outline-none focus:border-[#F59E0B]/60"
              value={form.tarih}
              onChange={(e) => setForm({ ...form, tarih: e.target.value })}
            />
          </div>

          {/* Açıklama */}
          <div>
            <label className="text-[#94A3B8] text-xs mb-1.5 block">Açıklama</label>
            <textarea
              rows={3}
              className="w-full bg-[#1E2636] border border-white/[0.1] rounded-xl px-4 py-3 text-[#F1F5F9] text-sm placeholder-[#94A3B8] focus:outline-none focus:border-[#F59E0B]/60 resize-none"
              placeholder="Olay / denetim detayları..."
              value={form.aciklama ?? ''}
              onChange={(e) => setForm({ ...form, aciklama: e.target.value })}
            />
          </div>

          {/* Önem Seviyesi */}
          <div>
            <label className="text-[#94A3B8] text-xs mb-1.5 block">Önem Seviyesi</label>
            <div className="grid grid-cols-4 gap-2">
              {(['dusuk', 'orta', 'yuksek', 'kritik'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setForm({ ...form, onem_seviyesi: s })}
                  className={`py-2 rounded-xl text-xs font-semibold border transition-colors ${
                    form.onem_seviyesi === s
                      ? onemRenk[s]
                      : 'bg-[#1E2636] border-white/[0.1] text-[#94A3B8]'
                  }`}
                >
                  {onemLabel[s]}
                </button>
              ))}
            </div>
          </div>

          {/* Sorumlu */}
          <div>
            <label className="text-[#94A3B8] text-xs mb-1.5 block">Sorumlu</label>
            <input
              className="w-full bg-[#1E2636] border border-white/[0.1] rounded-xl px-4 py-3 text-[#F1F5F9] text-sm placeholder-[#94A3B8] focus:outline-none focus:border-[#F59E0B]/60"
              placeholder="Sorumlu kişi adı"
              value={form.sorumlu ?? ''}
              onChange={(e) => setForm({ ...form, sorumlu: e.target.value })}
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

export default function IsgPage() {
  const [kayitlar, setKayitlar] = useState<IsgKaydi[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [kapatiyor, setKapatiyor] = useState<string | null>(null);

  useEffect(() => {
    api.getIsgKayitlari()
      .then(setKayitlar)
      .catch(() => setKayitlar([]))
      .finally(() => setLoading(false));
  }, []);

  const handleCreate = async (data: Partial<IsgKaydi>) => {
    const yeni = await api.createIsgKaydi(data);
    setKayitlar((prev) => [yeni, ...prev]);
  };

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

  // Özet hesapla
  const toplam = kayitlar.length;
  const acik = kayitlar.filter((k) => k.durum === 'acik').length;
  const tamamlanan = kayitlar.filter((k) => k.durum === 'kapandi').length;
  const buAy = kayitlar.filter((k) => {
    const tarih = new Date(k.tarih);
    const now = new Date();
    return tarih.getFullYear() === now.getFullYear() && tarih.getMonth() === now.getMonth();
  }).length;

  return (
    <div className="min-h-screen bg-[#0E1117] px-4 py-5 pb-24">
      {/* Başlık */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[#F1F5F9] text-xl font-bold font-[var(--font-syne)]">İSG Yönetimi</h1>
          <p className="text-[#94A3B8] text-xs mt-0.5">İş Sağlığı ve Güvenliği</p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 bg-[#F59E0B] text-black text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#D97706] transition-colors"
        >
          <span>+</span>
          <span>Yeni Kayıt</span>
        </button>
      </div>

      {/* Özet Kartları */}
      {!loading && (
        <div className="grid grid-cols-4 gap-2 mb-5">
          {[
            { label: 'Toplam', value: toplam, color: 'text-[#F1F5F9]' },
            { label: 'Açık', value: acik, color: acik > 0 ? 'text-red-400' : 'text-[#F1F5F9]' },
            { label: 'Tamamlanan', value: tamamlanan, color: 'text-green-400' },
            { label: 'Bu Ay', value: buAy, color: 'text-[#F59E0B]' },
          ].map((s) => (
            <div key={s.label} className="bg-[#1E2636] rounded-xl p-3 border border-white/[0.07] text-center">
              <p className={`text-xl font-bold font-[var(--font-syne)] ${s.color}`}>{s.value}</p>
              <p className="text-[#94A3B8] text-[10px] mt-0.5 leading-tight">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && <Skeleton />}

      {/* Boş Durum */}
      {!loading && kayitlar.length === 0 && (
        <div className="bg-[#1E2636] rounded-2xl p-10 text-center border border-white/[0.07]">
          <span className="text-4xl block mb-3">⛑️</span>
          <p className="text-[#94A3B8] text-sm">Henüz ISG kaydı eklenmedi</p>
          <button
            onClick={() => setModalOpen(true)}
            className="mt-3 text-[#F59E0B] text-sm font-medium hover:underline"
          >
            İlk kaydı oluştur →
          </button>
        </div>
      )}

      {/* Liste */}
      {!loading && kayitlar.length > 0 && (
        <div className="space-y-3">
          {kayitlar.map((k) => (
            <div key={k.id} className="bg-[#1E2636] rounded-2xl border border-white/[0.07] p-4">
              {/* Badges */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs border px-2 py-0.5 rounded-full font-semibold ${onemRenk[k.onem_seviyesi]}`}>
                    {onemLabel[k.onem_seviyesi]}
                  </span>
                  <span className="text-xs bg-[#2A3447] text-[#94A3B8] px-2 py-0.5 rounded-full">
                    {tipLabel[k.tip] ?? k.tip}
                  </span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${durumRenk[k.durum]}`}>
                  {durumLabel[k.durum]}
                </span>
              </div>

              {/* Tarih */}
              <p className="text-[#94A3B8] text-xs mb-1.5">
                {new Date(k.tarih).toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </p>

              {/* Açıklama */}
              {k.aciklama && (
                <p className="text-[#F1F5F9] text-sm mb-2 leading-relaxed">{k.aciklama}</p>
              )}

              {/* Sorumlu */}
              {k.sorumlu && (
                <p className="text-[#94A3B8] text-xs mb-2">
                  Sorumlu: <span className="text-[#F1F5F9] font-medium">{k.sorumlu}</span>
                </p>
              )}

              {/* Kapat Butonu */}
              {k.durum === 'acik' && (
                <button
                  disabled={kapatiyor === k.id}
                  onClick={() => handleKapat(k.id)}
                  className="text-xs bg-green-500/20 border border-green-500/30 text-green-400 px-3 py-1.5 rounded-lg hover:bg-green-500/30 disabled:opacity-40 transition-colors"
                >
                  {kapatiyor === k.id ? 'Kapatılıyor...' : '✓ Kapat'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      <YeniKayitModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleCreate}
      />
    </div>
  );
}
