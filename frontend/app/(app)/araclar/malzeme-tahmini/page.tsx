'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface MalzemeItem {
  ad: string;
  miktar: number;
  birim: string;
  aciklama: string;
}

interface TahminSonuc {
  malzemeler: MalzemeItem[];
  uyari: string;
}

const yapiTipleri = [
  { value: 'konut',   label: 'Konut',    icon: '🏠' },
  { value: 'ofis',    label: 'Ofis',     icon: '🏢' },
  { value: 'fabrika', label: 'Fabrika',  icon: '🏭' },
  { value: 'depo',    label: 'Depo',     icon: '🏗️' },
  { value: 'okul',    label: 'Okul',     icon: '🏫' },
  { value: 'hastane', label: 'Hastane',  icon: '🏥' },
];

function fmt(n: number): string {
  return n.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
}

export default function MalzemeTahmini() {
  const [yapiTipi, setYapiTipi] = useState('konut');
  const [alan, setAlan] = useState('');
  const [katSayisi, setKatSayisi] = useState(1);
  const [ekBilgi, setEkBilgi] = useState('');
  const [yukleniyor, setYukleniyor] = useState(false);
  const [sonuc, setSonuc] = useState<TahminSonuc | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [kopyalandi, setKopyalandi] = useState(false);

  const handleHesapla = async () => {
    const alanVal = parseFloat(alan);
    if (isNaN(alanVal) || alanVal <= 0) {
      setHata('Geçerli bir alan değeri girin.');
      return;
    }

    setHata(null);
    setSonuc(null);
    setYukleniyor(true);

    try {
      const result = await api.malzemeTahmin({
        yapi_tipi: yapiTipi,
        alan_m2: alanVal,
        kat_sayisi: katSayisi,
        ek_bilgi: ekBilgi || undefined,
      });
      setSonuc(result);
    } catch (err) {
      setHata(err instanceof Error ? err.message : 'Tahmin yapılırken bir hata oluştu.');
    } finally {
      setYukleniyor(false);
    }
  };

  const handleKopyala = async () => {
    if (!sonuc) return;
    const metin = sonuc.malzemeler
      .map((m) => `${m.ad}: ${fmt(m.miktar)} ${m.birim}`)
      .join('\n');
    await navigator.clipboard.writeText(metin);
    setKopyalandi(true);
    setTimeout(() => setKopyalandi(false), 1500);
  };

  const artir = () => setKatSayisi((v) => Math.min(50, v + 1));
  const azalt = () => setKatSayisi((v) => Math.max(1, v - 1));

  return (
    <div className="min-h-screen bg-[#0E1117] px-4 py-5">
      <Link
        href="/araclar"
        className="inline-flex items-center gap-1.5 text-[#94A3B8] text-sm mb-5 hover:text-white transition-colors"
      >
        ← Araçlar
      </Link>

      <div className="mb-6">
        <h1 className="font-[var(--font-syne)] text-2xl font-black text-white">
          Malzeme Tahmini
        </h1>
        <p className="text-[#94A3B8] text-sm mt-1">Yapay zeka destekli malzeme listesi</p>
      </div>

      {/* Form */}
      <div className="bg-[#1E2636] rounded-2xl border border-white/[0.07] p-4 space-y-4 mb-4">
        {/* Yapı tipi */}
        <div>
          <label className="text-[#94A3B8] text-xs font-semibold mb-2 block">Yapı Tipi</label>
          <div className="grid grid-cols-3 gap-2">
            {yapiTipleri.map(({ value, label, icon }) => (
              <button
                key={value}
                onClick={() => setYapiTipi(value)}
                className={`py-3 rounded-xl text-sm font-semibold transition-all flex flex-col items-center gap-1 ${
                  yapiTipi === value
                    ? 'bg-amber-500 text-black'
                    : 'bg-[#252F42] text-[#94A3B8] hover:text-white'
                }`}
              >
                <span>{icon}</span>
                <span className="text-xs">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Alan */}
        <div>
          <label className="text-[#94A3B8] text-xs font-semibold mb-1.5 block">Toplam Alan (m²)</label>
          <input
            type="number"
            min="1"
            value={alan}
            onChange={(e) => setAlan(e.target.value)}
            placeholder="örn: 120"
            className="w-full bg-[#252F42] rounded-xl px-4 py-3 text-white border border-white/[0.07] text-sm focus:outline-none focus:border-amber-500/50 placeholder-[#4A5568]"
          />
        </div>

        {/* Kat sayısı stepper */}
        <div>
          <label className="text-[#94A3B8] text-xs font-semibold mb-1.5 block">Kat Sayısı</label>
          <div className="flex items-center gap-3">
            <button
              onClick={azalt}
              className="w-11 h-11 rounded-xl bg-[#252F42] text-white text-xl font-bold flex items-center justify-center hover:bg-[#2D3A52] transition-colors border border-white/[0.07] active:scale-95"
            >
              −
            </button>
            <div className="flex-1 bg-[#252F42] rounded-xl border border-white/[0.07] py-3 text-center text-white font-bold text-lg">
              {katSayisi}
            </div>
            <button
              onClick={artir}
              className="w-11 h-11 rounded-xl bg-[#252F42] text-white text-xl font-bold flex items-center justify-center hover:bg-[#2D3A52] transition-colors border border-white/[0.07] active:scale-95"
            >
              +
            </button>
          </div>
          <p className="text-[#64748B] text-xs mt-1">1–50 kat arası</p>
        </div>

        {/* Ek bilgi */}
        <div>
          <label className="text-[#94A3B8] text-xs font-semibold mb-1.5 block">
            Ek Bilgi <span className="font-normal opacity-60">(opsiyonel)</span>
          </label>
          <textarea
            value={ekBilgi}
            onChange={(e) => setEkBilgi(e.target.value)}
            placeholder="Özel istekler, malzeme tercihleri, bölge bilgisi..."
            rows={3}
            className="w-full bg-[#252F42] rounded-xl px-4 py-3 text-white border border-white/[0.07] text-sm focus:outline-none focus:border-amber-500/50 placeholder-[#4A5568] resize-none"
          />
        </div>
      </div>

      {/* Hata */}
      {hata && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4">
          <p className="text-red-400 text-sm">{hata}</p>
        </div>
      )}

      {/* Hesapla butonu */}
      <button
        onClick={handleHesapla}
        disabled={yukleniyor || alan === ''}
        className="w-full bg-amber-500 text-black rounded-xl px-6 py-3.5 font-bold text-sm disabled:opacity-60 disabled:cursor-not-allowed transition-all active:scale-[0.98] mb-4"
      >
        {yukleniyor ? 'AI hesaplıyor...' : 'Tahmin Et'}
      </button>

      {/* Loading */}
      {yukleniyor && (
        <div className="bg-[#1E2636] rounded-2xl border border-white/[0.07] p-8 text-center mb-4">
          <div className="flex justify-center gap-1.5 mb-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 bg-amber-500 rounded-full animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
          <p className="text-white text-sm font-semibold mb-1">AI hesaplıyor...</p>
          <p className="text-[#94A3B8] text-xs">Yapay zeka malzeme listesi hazırlıyor</p>
        </div>
      )}

      {/* Sonuç */}
      {sonuc && !yukleniyor && (
        <div className="space-y-3">
          {sonuc.uyari && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-start gap-2">
              <span className="text-amber-400 text-sm shrink-0">⚠️</span>
              <p className="text-amber-400 text-sm">{sonuc.uyari}</p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-[#94A3B8] text-xs font-semibold">TAHMİNİ MALZEME LİSTESİ</p>
            <button
              onClick={handleKopyala}
              className="text-xs px-3 py-1.5 rounded-lg border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-colors"
            >
              {kopyalandi ? '✓ Kopyalandı' : 'Listeyi Kopyala'}
            </button>
          </div>

          {sonuc.malzemeler.map((m, i) => (
            <div key={i} className="bg-[#1E2636] rounded-xl p-4 border border-white/[0.07]">
              <div className="flex justify-between items-start mb-1">
                <span className="text-white text-sm font-semibold">{m.ad}</span>
                <span className="text-amber-500 text-sm font-bold shrink-0 ml-2">
                  {fmt(m.miktar)} {m.birim}
                </span>
              </div>
              {m.aciklama && (
                <p className="text-[#64748B] text-xs mt-1">{m.aciklama}</p>
              )}
            </div>
          ))}

          {/* Toplam bilgi */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-amber-400 text-xs font-semibold">ÖZET</p>
                <p className="text-white text-sm mt-0.5">
                  {yapiTipleri.find(y => y.value === yapiTipi)?.label} · {alan} m² · {katSayisi} kat
                </p>
              </div>
              <div className="text-right">
                <p className="text-[#94A3B8] text-xs">Malzeme kalemi</p>
                <p className="text-white text-lg font-bold">{sonuc.malzemeler.length}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {!sonuc && !yukleniyor && !hata && (
        <div className="bg-[#1E2636] rounded-2xl border border-white/[0.07] p-8 text-center">
          <p className="text-4xl mb-3">🤖</p>
          <p className="text-white text-sm font-semibold mb-1">AI Destekli Tahmin</p>
          <p className="text-[#94A3B8] text-xs">Formu doldurun, yapay zeka size malzeme listesi çıkarsın</p>
        </div>
      )}
    </div>
  );
}
