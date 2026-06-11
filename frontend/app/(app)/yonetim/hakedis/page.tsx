'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

type IsKalemi = {
  tanim: string;
  miktar: string;
  birim: string;
  birim_fiyat: string;
};

const BIRIM_LISTESI = ['m²', 'm³', 'adet', 'ton', 'kg', 'm', 'saat', 'gün'];

function blobIndir(blob: Blob, dosyaAdi: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = dosyaAdi;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function buAyDonem() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function HakedisPage() {
  const router = useRouter();

  const [santiyeAdi, setSantiyeAdi] = useState('');
  const [donem, setDonem] = useState(buAyDonem());
  const [kdvOrani, setKdvOrani] = useState(20);
  const [isKalemleri, setIsKalemleri] = useState<IsKalemi[]>([
    { tanim: '', miktar: '', birim: 'm²', birim_fiyat: '' },
  ]);
  const [olusturuluyor, setOlusturuluyor] = useState(false);
  const [ornekIndiriliyor, setOrnekIndiriliyor] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kalemEkle = () => {
    setIsKalemleri((prev) => [...prev, { tanim: '', miktar: '', birim: 'm²', birim_fiyat: '' }]);
  };

  const kalemGuncelle = (idx: number, alan: keyof IsKalemi, deger: string) => {
    setIsKalemleri((prev) => prev.map((k, i) => (i === idx ? { ...k, [alan]: deger } : k)));
  };

  const kalemSil = (idx: number) => {
    if (isKalemleri.length === 1) return;
    setIsKalemleri((prev) => prev.filter((_, i) => i !== idx));
  };

  // Toplam hesaplama
  const araToplam = isKalemleri.reduce((sum, k) => {
    const m = parseFloat(k.miktar) || 0;
    const bp = parseFloat(k.birim_fiyat) || 0;
    return sum + m * bp;
  }, 0);
  const kdvTutar = (araToplam * kdvOrani) / 100;
  const genelToplam = araToplam + kdvTutar;

  const formatPara = (n: number) =>
    n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₺';

  const handleOlustur = async () => {
    if (!santiyeAdi.trim()) {
      setError('Şantiye adı zorunlu');
      return;
    }
    const gecerliKalemler = isKalemleri.filter((k) => k.tanim.trim() && k.miktar && k.birim_fiyat);
    if (!gecerliKalemler.length) {
      setError('En az bir geçerli iş kalemi gerekli');
      return;
    }
    setOlusturuluyor(true);
    setError(null);
    try {
      const kalemler = gecerliKalemler.map((k) => ({
        tanim: k.tanim,
        miktar: parseFloat(k.miktar),
        birim: k.birim,
        birim_fiyat: parseFloat(k.birim_fiyat),
      }));
      const blob = await api.hakedisOlustur({
        santiye_adi: santiyeAdi,
        donem,
        is_kalemleri: kalemler,
        kdv_orani: kdvOrani,
      });
      if (!blob || blob.size === 0) {
        throw new Error('Dosya oluşturulamadı, lütfen tekrar deneyin');
      }
      const dosyaAdi = `hakedis_${santiyeAdi.replace(/\s+/g, '_')}_${donem}.xlsx`;
      blobIndir(blob, dosyaAdi);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Hakediş oluşturulamadı');
    } finally {
      setOlusturuluyor(false);
    }
  };

  const handleOrnekIndir = async () => {
    setOrnekIndiriliyor(true);
    setError(null);
    try {
      const blob = await api.hakedisOrnekSablon();
      if (!blob || blob.size === 0) {
        throw new Error('Örnek şablon alınamadı, lütfen tekrar deneyin');
      }
      blobIndir(blob, 'hakedis_ornek_sablon.xlsx');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Örnek şablon indirilemedi');
    } finally {
      setOrnekIndiriliyor(false);
    }
  };

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
        <h1 className="text-[#F1F5F9] text-xl font-bold font-[var(--font-syne)]">Hakediş</h1>
      </div>

      {/* Banner */}
      <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-2xl p-4 mb-5">
        <p className="text-[#F59E0B] text-sm font-semibold mb-1 font-[var(--font-syne)]">Hakediş Yönetimi</p>
        <p className="text-[#94A3B8] text-xs mb-3">
          Kendi şablonunuzu yükleyerek özelleştirilmiş hakediş belgeleri oluşturun.
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleOrnekIndir}
            disabled={ornekIndiriliyor}
            className="flex items-center gap-1.5 bg-[#252F42] text-[#F59E0B] text-xs font-medium px-3 py-2 rounded-xl border border-[#F59E0B]/30 hover:bg-[#F59E0B]/10 transition-colors disabled:opacity-60"
          >
            {ornekIndiriliyor ? 'İndiriliyor...' : '⬇ Örnek Şablon İndir'}
          </button>
          <button
            onClick={() => router.push('/yonetim/sablonlar?tip=hakedis')}
            className="flex items-center gap-1.5 bg-[#252F42] text-[#94A3B8] text-xs font-medium px-3 py-2 rounded-xl border border-white/[0.07] hover:text-[#F1F5F9] transition-colors"
          >
            ↑ Kendi Şablonumu Yükle
          </button>
        </div>
      </div>

      {/* Hata */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Hızlı Hakediş Oluştur */}
      <div className="bg-[#1E2636] rounded-2xl border border-white/[0.07] p-4 mb-5">
        <h2 className="text-[#F1F5F9] text-sm font-semibold mb-4 font-[var(--font-syne)]">Hızlı Hakediş Oluştur</h2>

        {/* Şantiye + Dönem */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="col-span-2">
            <label className="text-[#94A3B8] text-xs mb-1.5 block">Şantiye Adı</label>
            <input
              type="text"
              placeholder="örn. Karayolu Köprü Projesi"
              value={santiyeAdi}
              onChange={(e) => setSantiyeAdi(e.target.value)}
              className="w-full bg-[#252F42] rounded-xl border border-white/[0.07] text-white px-4 py-3 text-sm focus:outline-none focus:border-[#F59E0B]/60 placeholder:text-[#64748B]"
            />
          </div>
          <div>
            <label className="text-[#94A3B8] text-xs mb-1.5 block">Dönem (Ay/Yıl)</label>
            <input
              type="month"
              value={donem}
              onChange={(e) => setDonem(e.target.value)}
              className="w-full bg-[#252F42] rounded-xl border border-white/[0.07] text-white px-4 py-3 text-sm focus:outline-none focus:border-[#F59E0B]/60"
            />
          </div>
          <div>
            <label className="text-[#94A3B8] text-xs mb-1.5 block">KDV Oranı (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              value={kdvOrani}
              onChange={(e) => setKdvOrani(Number(e.target.value))}
              className="w-full bg-[#252F42] rounded-xl border border-white/[0.07] text-white px-4 py-3 text-sm focus:outline-none focus:border-[#F59E0B]/60"
            />
          </div>
        </div>

        {/* İş Kalemleri */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-[#94A3B8] text-xs">İş Kalemleri</label>
            <button
              onClick={kalemEkle}
              className="text-[#F59E0B] text-xs font-medium hover:text-[#D97706] transition-colors"
            >
              + İş Kalemi Ekle
            </button>
          </div>

          {/* Tablo başlık */}
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 mb-1.5 px-1">
            {['Tanım', 'Miktar', 'Birim', 'Birim Fiyat', ''].map((h) => (
              <span key={h} className="text-[#64748B] text-[10px] uppercase tracking-wide">{h}</span>
            ))}
          </div>

          <div className="space-y-2">
            {isKalemleri.map((k, idx) => (
              <div key={idx} className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-2 items-center">
                <input
                  type="text"
                  placeholder="Beton dökümü..."
                  value={k.tanim}
                  onChange={(e) => kalemGuncelle(idx, 'tanim', e.target.value)}
                  className="bg-[#252F42] rounded-xl border border-white/[0.07] text-white px-3 py-2.5 text-xs focus:outline-none focus:border-[#F59E0B]/60 placeholder:text-[#4B5563]"
                />
                <input
                  type="number"
                  placeholder="0"
                  value={k.miktar}
                  onChange={(e) => kalemGuncelle(idx, 'miktar', e.target.value)}
                  className="bg-[#252F42] rounded-xl border border-white/[0.07] text-white px-3 py-2.5 text-xs focus:outline-none focus:border-[#F59E0B]/60"
                />
                <select
                  value={k.birim}
                  onChange={(e) => kalemGuncelle(idx, 'birim', e.target.value)}
                  className="bg-[#252F42] rounded-xl border border-white/[0.07] text-[#F1F5F9] px-2 py-2.5 text-xs focus:outline-none focus:border-[#F59E0B]/60"
                >
                  {BIRIM_LISTESI.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="0"
                  value={k.birim_fiyat}
                  onChange={(e) => kalemGuncelle(idx, 'birim_fiyat', e.target.value)}
                  className="bg-[#252F42] rounded-xl border border-white/[0.07] text-white px-3 py-2.5 text-xs focus:outline-none focus:border-[#F59E0B]/60"
                />
                <button
                  onClick={() => kalemSil(idx)}
                  disabled={isKalemleri.length === 1}
                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-500/20 text-[#64748B] hover:text-red-400 transition-colors disabled:opacity-30"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Toplam Preview */}
        <div className="bg-[#0E1117] rounded-xl p-3 mb-4 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-[#94A3B8]">Ara Toplam</span>
            <span className="text-[#F1F5F9] font-medium">{formatPara(araToplam)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-[#94A3B8]">KDV (%{kdvOrani})</span>
            <span className="text-[#F1F5F9] font-medium">{formatPara(kdvTutar)}</span>
          </div>
          <div className="border-t border-white/[0.07] pt-1.5 flex justify-between">
            <span className="text-[#F1F5F9] text-sm font-semibold">Genel Toplam</span>
            <span className="text-[#F59E0B] text-sm font-bold">{formatPara(genelToplam)}</span>
          </div>
        </div>

        <button
          onClick={handleOlustur}
          disabled={olusturuluyor}
          className="w-full bg-[#F59E0B] text-black text-sm font-semibold py-3 rounded-xl hover:bg-[#D97706] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {olusturuluyor ? (
            <>
              <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              Oluşturuluyor...
            </>
          ) : (
            '⬇ Excel Oluştur ve İndir'
          )}
        </button>
      </div>

      {/* Kayıtlı Hakedişler — Yakında */}
      <div className="bg-[#1E2636] rounded-2xl border border-white/[0.07] p-6 text-center">
        <span className="text-3xl block mb-2">🗂️</span>
        <p className="text-[#F1F5F9] text-sm font-medium mb-1">Kayıtlı Hakedişler</p>
        <p className="text-[#64748B] text-xs">Yakında — geçmiş hakediş arşiviniz burada görünecek</p>
      </div>
    </div>
  );
}
