'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { PuantajKaydi, ProjeResponse } from '@/types';

type YeniKayit = {
  personel_adi: string;
  meslek: string;
  giris_saati: string;
  cikis_saati: string;
  devamsizlik: boolean;
};

const MESLEK_LISTESI = ['Formen', 'İşçi', 'Operatör', 'Mühendis', 'Tekniker', 'Güvenlik'];

function saatFarki(giris: string, cikis: string): number {
  if (!giris || !cikis) return 0;
  const [gh, gm] = giris.split(':').map(Number);
  const [ch, cm] = cikis.split(':').map(Number);
  const diff = (ch * 60 + cm) - (gh * 60 + gm);
  return diff > 0 ? Math.round((diff / 60) * 10) / 10 : 0;
}

export default function PuantajPage() {
  const router = useRouter();
  const bugun = new Date().toISOString().slice(0, 10);

  const [tarih, setTarih] = useState(bugun);
  const [projeId, setProjeId] = useState('');
  const [projeler, setProjeler] = useState<ProjeResponse[]>([]);
  const [kayitlar, setKayitlar] = useState<PuantajKaydi[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Yeni kayıt formu
  const [form, setForm] = useState<YeniKayit>({
    personel_adi: '',
    meslek: 'İşçi',
    giris_saati: '08:00',
    cikis_saati: '17:00',
    devamsizlik: false,
  });

  // Toplu ekleme
  const [topluAcik, setTopluAcik] = useState(false);
  const [topluMetin, setTopluMetin] = useState('');
  const [topluGiris, setTopluGiris] = useState('08:00');
  const [topluCikis, setTopluCikis] = useState('17:00');
  const [topluNeden, setTopluNeden] = useState('Çalıştı');

  const fetchKayitlar = useCallback(() => {
    setLoading(true);
    api.getPuantaj(tarih, projeId || undefined)
      .then(setKayitlar)
      .catch(() => setKayitlar([]))
      .finally(() => setLoading(false));
  }, [tarih, projeId]);

  useEffect(() => {
    api.getProjeler().then(setProjeler).catch(() => setProjeler([]));
  }, []);

  useEffect(() => {
    fetchKayitlar();
  }, [fetchKayitlar]);

  const calismaSaati = form.devamsizlik ? 0 : saatFarki(form.giris_saati, form.cikis_saati);
  const fazlaMesai = Math.max(0, calismaSaati - 8);

  const handleEkle = async () => {
    if (!form.personel_adi.trim()) {
      setError('Personel adı zorunlu');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.createPuantaj({
        tarih,
        personel_adi: form.personel_adi.trim(),
        meslek: form.meslek || null,
        giris_saati: form.devamsizlik ? null : form.giris_saati || null,
        cikis_saati: form.devamsizlik ? null : form.cikis_saati || null,
        calisma_saati: calismaSaati,
        fazla_mesai: fazlaMesai,
        devamsizlik: form.devamsizlik,
        proje_id: projeId || null,
        santiye_id: null,
        notlar: null,
        musteri_id: '',
      });
      setForm({ personel_adi: '', meslek: 'İşçi', giris_saati: '08:00', cikis_saati: '17:00', devamsizlik: false });
      fetchKayitlar();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Kayıt eklenemedi');
    } finally {
      setSaving(false);
    }
  };

  const handleSil = async (id: string) => {
    try {
      await api.deletePuantaj(id);
      setKayitlar((prev) => prev.filter((k) => k.id !== id));
    } catch {
      // sessiz
    }
  };

  const handleTopluEkle = async () => {
    const satirlar = topluMetin
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!satirlar.length) return;

    const devamsizlik = topluNeden !== 'Çalıştı';
    const topluCalisma = devamsizlik ? 0 : saatFarki(topluGiris, topluCikis);
    const topluFazla = Math.max(0, topluCalisma - 8);

    setSaving(true);
    setError(null);
    try {
      const data = satirlar.map((personel_adi) => ({
        tarih,
        personel_adi,
        meslek: 'İşçi',
        giris_saati: devamsizlik ? null : topluGiris,
        cikis_saati: devamsizlik ? null : topluCikis,
        calisma_saati: topluCalisma,
        fazla_mesai: topluFazla,
        devamsizlik,
        notlar: devamsizlik && topluNeden !== 'Çalıştı' ? topluNeden : null,
        proje_id: projeId || null,
        santiye_id: null,
        musteri_id: '',
      }));
      await api.topluPuantaj(data);
      setTopluMetin('');
      setTopluAcik(false);
      fetchKayitlar();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Toplu kayıt başarısız');
    } finally {
      setSaving(false);
    }
  };

  const toplamSaat = kayitlar.filter((k) => !k.devamsizlik).reduce((acc, k) => acc + (k.calisma_saati ?? 0), 0);
  const devamsizSayisi = kayitlar.filter((k) => k.devamsizlik).length;

  return (
    <div className="min-h-screen bg-[#0E1117] px-4 py-5 pb-28">
      {/* Geri + Başlık */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => router.push('/yonetim')}
          className="text-[#94A3B8] hover:text-[#F1F5F9] text-sm transition-colors"
        >
          ← Yönetim
        </button>
        <span className="text-[#94A3B8]/40">|</span>
        <h1 className="text-[#F1F5F9] text-xl font-bold font-[var(--font-syne)]">Puantaj</h1>
      </div>

      {/* Filtreler */}
      <div className="flex gap-3 mb-5">
        <input
          type="date"
          value={tarih}
          onChange={(e) => setTarih(e.target.value)}
          className="bg-[#252F42] rounded-xl border border-white/[0.07] text-white px-4 py-3 text-sm focus:outline-none focus:border-[#F59E0B]/60"
        />
        <select
          value={projeId}
          onChange={(e) => setProjeId(e.target.value)}
          className="flex-1 bg-[#252F42] rounded-xl border border-white/[0.07] text-[#F1F5F9] px-4 py-3 text-sm focus:outline-none focus:border-[#F59E0B]/60"
        >
          <option value="">Tüm Projeler</option>
          {projeler.map((p) => (
            <option key={p.id} value={p.id}>{p.isim}</option>
          ))}
        </select>
      </div>

      {/* Hata */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Hızlı Ekleme Formu */}
      <div className="bg-[#1E2636] rounded-2xl border border-white/[0.07] p-4 mb-5">
        <h2 className="text-[#F1F5F9] text-sm font-semibold mb-3 font-[var(--font-syne)]">Personel Ekle</h2>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <input
            type="text"
            placeholder="Personel adı soyadı"
            value={form.personel_adi}
            onChange={(e) => setForm({ ...form, personel_adi: e.target.value })}
            className="col-span-2 bg-[#252F42] rounded-xl border border-white/[0.07] text-white px-4 py-3 text-sm focus:outline-none focus:border-[#F59E0B]/60 placeholder:text-[#64748B]"
          />
          <select
            value={form.meslek}
            onChange={(e) => setForm({ ...form, meslek: e.target.value })}
            className="bg-[#252F42] rounded-xl border border-white/[0.07] text-[#F1F5F9] px-4 py-3 text-sm focus:outline-none focus:border-[#F59E0B]/60"
          >
            {MESLEK_LISTESI.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          {/* Devamsız toggle */}
          <button
            type="button"
            onClick={() => setForm({ ...form, devamsizlik: !form.devamsizlik })}
            className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-medium transition-colors ${
              form.devamsizlik
                ? 'bg-red-500/20 border-red-500/50 text-red-400'
                : 'bg-[#252F42] border-white/[0.07] text-[#94A3B8]'
            }`}
          >
            {form.devamsizlik ? '✗ Devamsız' : '✓ Geldi'}
          </button>
        </div>

        {!form.devamsizlik && (
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div>
              <label className="text-[#94A3B8] text-[10px] mb-1 block">Giriş</label>
              <input
                type="time"
                value={form.giris_saati}
                onChange={(e) => setForm({ ...form, giris_saati: e.target.value })}
                className="w-full bg-[#252F42] rounded-xl border border-white/[0.07] text-white px-3 py-2.5 text-sm focus:outline-none focus:border-[#F59E0B]/60"
              />
            </div>
            <div>
              <label className="text-[#94A3B8] text-[10px] mb-1 block">Çıkış</label>
              <input
                type="time"
                value={form.cikis_saati}
                onChange={(e) => setForm({ ...form, cikis_saati: e.target.value })}
                className="w-full bg-[#252F42] rounded-xl border border-white/[0.07] text-white px-3 py-2.5 text-sm focus:outline-none focus:border-[#F59E0B]/60"
              />
            </div>
            <div>
              <label className="text-[#94A3B8] text-[10px] mb-1 block">Toplam Saat</label>
              <div className="w-full bg-[#0E1117] rounded-xl border border-white/[0.07] text-[#F59E0B] px-3 py-2.5 text-sm font-semibold">
                {calismaSaati}s {fazlaMesai > 0 ? <span className="text-xs text-orange-400">(+{fazlaMesai}FM)</span> : null}
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleEkle}
            disabled={saving}
            className="flex-1 bg-[#F59E0B] text-black text-sm font-semibold py-3 rounded-xl hover:bg-[#D97706] transition-colors disabled:opacity-60"
          >
            {saving ? 'Kaydediliyor...' : '+ Ekle'}
          </button>
          <button
            onClick={() => setTopluAcik(!topluAcik)}
            className="bg-[#252F42] text-[#94A3B8] text-sm px-4 py-3 rounded-xl hover:text-[#F1F5F9] border border-white/[0.07] transition-colors"
          >
            Toplu
          </button>
        </div>

        {/* Toplu ekleme alanı */}
        {topluAcik && (
          <div className="mt-3 border-t border-white/[0.07] pt-3 space-y-3">
            {/* Devamsızlık nedeni */}
            <div>
              <label className="text-[#94A3B8] text-[10px] mb-1.5 block">Devam Durumu</label>
              <select
                value={topluNeden}
                onChange={(e) => setTopluNeden(e.target.value)}
                className="w-full bg-[#252F42] rounded-xl border border-white/[0.07] text-[#F1F5F9] px-4 py-2.5 text-sm focus:outline-none focus:border-[#F59E0B]/60"
              >
                {['Çalıştı', 'Hasta', 'İzinli', 'Mazeret', 'İzinsiz'].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            {/* Giriş / Çıkış saatleri — sadece "Çalıştı" ise göster */}
            {topluNeden === 'Çalıştı' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[#94A3B8] text-[10px] mb-1.5 block">Giriş Saati</label>
                  <input
                    type="time"
                    value={topluGiris}
                    onChange={(e) => setTopluGiris(e.target.value)}
                    className="w-full bg-[#252F42] rounded-xl border border-white/[0.07] text-white px-3 py-2.5 text-sm focus:outline-none focus:border-[#F59E0B]/60"
                  />
                </div>
                <div>
                  <label className="text-[#94A3B8] text-[10px] mb-1.5 block">Çıkış Saati</label>
                  <input
                    type="time"
                    value={topluCikis}
                    onChange={(e) => setTopluCikis(e.target.value)}
                    className="w-full bg-[#252F42] rounded-xl border border-white/[0.07] text-white px-3 py-2.5 text-sm focus:outline-none focus:border-[#F59E0B]/60"
                  />
                </div>
              </div>
            )}

            {/* Personel listesi */}
            <div>
              <p className="text-[#94A3B8] text-xs mb-2">Her satıra bir personel adı yazın:</p>
              <textarea
                value={topluMetin}
                onChange={(e) => setTopluMetin(e.target.value)}
                placeholder={"Ahmet Yılmaz\nMehmet Demir\nAli Kaya"}
                rows={5}
                className="w-full bg-[#252F42] rounded-xl border border-white/[0.07] text-white px-4 py-3 text-sm focus:outline-none focus:border-[#F59E0B]/60 placeholder:text-[#64748B] resize-none"
              />
            </div>

            <button
              onClick={handleTopluEkle}
              disabled={saving || !topluMetin.trim()}
              className="w-full bg-[#F59E0B] text-black text-sm font-semibold py-2.5 rounded-xl hover:bg-[#D97706] transition-colors disabled:opacity-60"
            >
              {saving ? 'Kaydediliyor...' : 'Toplu Aktar'}
            </button>
          </div>
        )}
      </div>

      {/* Özet */}
      {!loading && kayitlar.length > 0 && (
        <div className="flex gap-3 mb-4">
          <div className="flex-1 bg-[#1E2636] rounded-xl border border-white/[0.07] p-3 text-center">
            <p className="text-[#F59E0B] text-xl font-bold">{kayitlar.length}</p>
            <p className="text-[#94A3B8] text-xs">Personel</p>
          </div>
          <div className="flex-1 bg-[#1E2636] rounded-xl border border-white/[0.07] p-3 text-center">
            <p className="text-[#F59E0B] text-xl font-bold">{toplamSaat.toFixed(1)}</p>
            <p className="text-[#94A3B8] text-xs">Toplam Saat</p>
          </div>
          <div className="flex-1 bg-[#1E2636] rounded-xl border border-white/[0.07] p-3 text-center">
            <p className="text-red-400 text-xl font-bold">{devamsizSayisi}</p>
            <p className="text-[#94A3B8] text-xs">Devamsız</p>
          </div>
        </div>
      )}

      {/* Tablo */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-[#1E2636] rounded-xl h-14 animate-pulse" />
          ))}
        </div>
      ) : kayitlar.length === 0 ? (
        <div className="bg-[#1E2636] rounded-2xl p-10 text-center border border-white/[0.07]">
          <span className="text-4xl block mb-3">📋</span>
          <p className="text-[#94A3B8] text-sm">Bu tarih için kayıt bulunamadı</p>
        </div>
      ) : (
        <div className="bg-[#1E2636] rounded-2xl border border-white/[0.07] overflow-hidden">
          {/* Tablo başlık */}
          <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 px-4 py-2 border-b border-white/[0.07]">
            <span className="text-[#64748B] text-[10px] uppercase tracking-wide">Personel</span>
            <span className="text-[#64748B] text-[10px] uppercase tracking-wide">Giriş</span>
            <span className="text-[#64748B] text-[10px] uppercase tracking-wide">Çıkış</span>
            <span className="text-[#64748B] text-[10px] uppercase tracking-wide">Saat</span>
            <span className="text-[#64748B] text-[10px] uppercase tracking-wide w-6"></span>
          </div>

          {kayitlar.map((k, idx) => (
            <div
              key={k.id}
              className={`grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-center px-4 py-3 ${
                idx !== kayitlar.length - 1 ? 'border-b border-white/[0.05]' : ''
              } ${k.devamsizlik ? 'opacity-60' : ''}`}
            >
              <div>
                <p className="text-[#F1F5F9] text-sm font-medium truncate">{k.personel_adi}</p>
                {k.meslek && (
                  <span className="text-[#64748B] text-[10px]">{k.meslek}</span>
                )}
                {k.devamsizlik && (
                  <span className="ml-2 text-[10px] text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded-full">Devamsız</span>
                )}
              </div>
              <span className="text-[#94A3B8] text-xs">{k.giris_saati ?? '—'}</span>
              <span className="text-[#94A3B8] text-xs">{k.cikis_saati ?? '—'}</span>
              <span className="text-[#F59E0B] text-xs font-semibold">
                {k.devamsizlik ? '—' : `${k.calisma_saati}s`}
              </span>
              <button
                onClick={() => handleSil(k.id)}
                className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-red-500/20 text-[#64748B] hover:text-red-400 transition-colors"
                aria-label="Sil"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
