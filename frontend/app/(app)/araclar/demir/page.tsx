'use client';

import { useState } from 'react';
import Link from 'next/link';

interface CapBilgi {
  cap: number;
  birimAgirlik: number;  // kg/m
  kesitAlani: number;    // cm²
}

const caplar: CapBilgi[] = [
  { cap:  8, birimAgirlik: 0.395, kesitAlani: 0.503 },
  { cap: 10, birimAgirlik: 0.617, kesitAlani: 0.785 },
  { cap: 12, birimAgirlik: 0.888, kesitAlani: 1.131 },
  { cap: 14, birimAgirlik: 1.208, kesitAlani: 1.539 },
  { cap: 16, birimAgirlik: 1.578, kesitAlani: 2.011 },
  { cap: 18, birimAgirlik: 1.998, kesitAlani: 2.545 },
  { cap: 20, birimAgirlik: 2.466, kesitAlani: 3.142 },
  { cap: 22, birimAgirlik: 2.984, kesitAlani: 3.801 },
  { cap: 25, birimAgirlik: 3.853, kesitAlani: 4.909 },
  { cap: 28, birimAgirlik: 4.834, kesitAlani: 6.158 },
  { cap: 32, birimAgirlik: 6.313, kesitAlani: 8.042 },
];

interface DemirKalemi {
  id: number;
  cap: number;
  uzunluk: number;
  adet: number;
}

function fmt(n: number, d = 3): string {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: d });
}

let nextId = 1;

export default function DemirHesaplayici() {
  const [secilenCap, setSecilenCap] = useState(12);
  const [uzunluk, setUzunluk] = useState('');
  const [adet, setAdet] = useState('');
  const [liste, setListe] = useState<DemirKalemi[]>([]);
  const [kopyalandi, setKopyalandi] = useState(false);
  const [tabloGoster, setTabloGoster] = useState(false);

  const secilen = caplar.find((c) => c.cap === secilenCap) ?? caplar[2];

  const uzunlukVal = parseFloat(uzunluk);
  const adetVal = parseFloat(adet);
  const gecerli = !isNaN(uzunlukVal) && uzunlukVal > 0 && !isNaN(adetVal) && adetVal > 0;

  const tekAgirlik = gecerli
    ? uzunlukVal * adetVal * secilen.birimAgirlik
    : null;

  const listeToplamAgirlik = liste.reduce((acc, k) => {
    const cb = caplar.find((c) => c.cap === k.cap);
    return acc + k.uzunluk * k.adet * (cb?.birimAgirlik ?? 0);
  }, 0);

  const listeToplamUzunluk = liste.reduce((acc, k) => acc + k.uzunluk * k.adet, 0);

  const listeEkle = () => {
    if (!gecerli) return;
    setListe((prev) => [
      ...prev,
      { id: nextId++, cap: secilenCap, uzunluk: uzunlukVal, adet: adetVal },
    ]);
    setUzunluk('');
    setAdet('');
  };

  const listeSil = (id: number) => {
    setListe((prev) => prev.filter((k) => k.id !== id));
  };

  const listeSifirla = () => setListe([]);

  const handleKopyala = async () => {
    const satirlar = liste.map((k) => {
      const cb = caplar.find((c) => c.cap === k.cap);
      const ag = k.uzunluk * k.adet * (cb?.birimAgirlik ?? 0);
      return `Ø${k.cap} | ${k.adet} adet × ${fmt(k.uzunluk)} m | ${fmt(ag)} kg`;
    });
    satirlar.push(`\nToplam: ${fmt(listeToplamAgirlik)} kg (${fmt(listeToplamAgirlik / 1000, 4)} ton)`);
    await navigator.clipboard.writeText(satirlar.join('\n'));
    setKopyalandi(true);
    setTimeout(() => setKopyalandi(false), 1500);
  };

  return (
    <div className="min-h-screen bg-[#0E1117] px-4 py-5">
      <Link
        href="/araclar"
        className="inline-flex items-center gap-1.5 text-[#94A3B8] text-sm mb-5 hover:text-white transition-colors"
      >
        ← Araçlar
      </Link>

      <h1 className="font-[var(--font-syne)] text-2xl font-black text-white mb-6">
        Demir / Çelik Ağırlık
      </h1>

      {/* Çap seçici */}
      <div className="bg-[#1E2636] rounded-2xl border border-white/[0.07] p-4 mb-4">
        <p className="text-[#94A3B8] text-xs font-semibold mb-3">ÇAP SEÇİN (TS 708)</p>
        <div className="flex flex-wrap gap-2">
          {caplar.map(({ cap, birimAgirlik }) => (
            <button
              key={cap}
              onClick={() => setSecilenCap(cap)}
              className={`px-3 py-2 rounded-xl text-sm font-semibold transition-all flex flex-col items-center min-w-[3.2rem] ${
                secilenCap === cap
                  ? 'bg-amber-500 text-black'
                  : 'bg-[#252F42] text-[#94A3B8] hover:text-white'
              }`}
            >
              <span>Ø{cap}</span>
              <span className="text-[0.6rem] opacity-70">{birimAgirlik}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Seçilen çap bilgisi */}
      <div className="bg-[#1E2636] rounded-xl p-3 border border-amber-500/30 grid grid-cols-2 gap-2 mb-4">
        <div>
          <p className="text-[#64748B] text-xs">Birim Ağırlık</p>
          <p className="text-amber-500 font-bold text-sm">{secilen.birimAgirlik} kg/m</p>
        </div>
        <div>
          <p className="text-[#64748B] text-xs">Kesit Alanı</p>
          <p className="text-amber-500 font-bold text-sm">{secilen.kesitAlani} cm²</p>
        </div>
      </div>

      {/* Giriş */}
      <div className="bg-[#1E2636] rounded-2xl border border-white/[0.07] p-4 mb-4">
        <p className="text-[#94A3B8] text-xs font-semibold mb-3">HESAPLAMA</p>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-[#94A3B8] text-xs font-semibold mb-1.5 block">Boy (m)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={uzunluk}
              onChange={(e) => setUzunluk(e.target.value)}
              placeholder="örn: 6.0"
              className="w-full bg-[#252F42] rounded-xl px-4 py-3 text-white border border-white/[0.07] text-sm focus:outline-none focus:border-amber-500/50 placeholder-[#4A5568]"
            />
          </div>
          <div>
            <label className="text-[#94A3B8] text-xs font-semibold mb-1.5 block">Adet</label>
            <input
              type="number"
              min="1"
              step="1"
              value={adet}
              onChange={(e) => setAdet(e.target.value)}
              placeholder="örn: 10"
              className="w-full bg-[#252F42] rounded-xl px-4 py-3 text-white border border-white/[0.07] text-sm focus:outline-none focus:border-amber-500/50 placeholder-[#4A5568]"
            />
          </div>
        </div>

        {/* Anlık sonuç */}
        {tekAgirlik !== null && (
          <div className="bg-[#0E1117] rounded-xl p-3 border border-white/[0.07] mb-3">
            <div className="flex justify-between items-center">
              <span className="text-[#94A3B8] text-xs">
                Ø{secilenCap} × {fmt(uzunlukVal)} m × {Math.round(adetVal)} adet
              </span>
              <div className="text-right">
                <span className="text-white font-bold text-sm">{fmt(tekAgirlik)} kg</span>
                <span className="text-[#64748B] text-xs ml-2">{fmt(tekAgirlik / 1000, 4)} ton</span>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={listeEkle}
          disabled={!gecerli}
          className="w-full bg-amber-500 text-black rounded-xl py-3 font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
        >
          + Listeye Ekle
        </button>
      </div>

      {/* Demir listesi */}
      {liste.length > 0 && (
        <div className="bg-[#1E2636] rounded-2xl border border-white/[0.07] overflow-hidden mb-4">
          <div className="p-4 flex items-center justify-between border-b border-white/[0.07]">
            <p className="text-[#94A3B8] text-xs font-semibold">DEMİR LİSTESİ ({liste.length} kalem)</p>
            <div className="flex gap-2">
              <button
                onClick={handleKopyala}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-colors"
              >
                {kopyalandi ? '✓ Kopyalandı' : 'Kopyala'}
              </button>
              <button
                onClick={listeSifirla}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
              >
                Temizle
              </button>
            </div>
          </div>

          {/* Tablo başlığı */}
          <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-2 px-4 py-2 text-[#64748B] text-xs font-semibold border-b border-white/[0.04]">
            <span>Ø</span>
            <span>Boy × Adet</span>
            <span className="text-right">Uzunluk</span>
            <span className="text-right">Ağırlık</span>
            <span></span>
          </div>

          {liste.map((k) => {
            const cb = caplar.find((c) => c.cap === k.cap);
            const ag = k.uzunluk * k.adet * (cb?.birimAgirlik ?? 0);
            return (
              <div
                key={k.id}
                className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-2 items-center px-4 py-2.5 border-b border-white/[0.04] last:border-0"
              >
                <span className="text-amber-500 text-xs font-bold w-7">{k.cap}</span>
                <span className="text-white text-xs">{fmt(k.uzunluk)} m × {Math.round(k.adet)}</span>
                <span className="text-[#94A3B8] text-xs text-right">{fmt(k.uzunluk * k.adet)} m</span>
                <span className="text-white text-xs font-semibold text-right">{fmt(ag)} kg</span>
                <button
                  onClick={() => listeSil(k.id)}
                  className="text-[#64748B] hover:text-red-400 transition-colors text-sm w-6 text-right"
                >
                  ×
                </button>
              </div>
            );
          })}

          {/* Toplam */}
          <div className="p-4 bg-amber-500/10 border-t border-amber-500/20">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-amber-400 text-xs font-semibold">TOPLAM</p>
                <p className="text-[#94A3B8] text-xs">{fmt(listeToplamUzunluk)} m toplam boy</p>
              </div>
              <div className="text-right">
                <p className="text-white text-xl font-bold">{fmt(listeToplamAgirlik)} kg</p>
                <p className="text-amber-500 text-sm font-semibold">{fmt(listeToplamAgirlik / 1000, 4)} ton</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Referans tablosu toggle */}
      <button
        onClick={() => setTabloGoster(!tabloGoster)}
        className="w-full py-3 rounded-xl text-sm font-semibold text-[#94A3B8] border border-white/[0.07] hover:text-white transition-colors mb-3"
      >
        {tabloGoster ? 'Tabloyu Gizle' : 'TS 708 Referans Tablosu'}
      </button>

      {tabloGoster && (
        <div className="bg-[#1E2636] rounded-2xl border border-white/[0.07] p-4">
          <p className="text-[#94A3B8] text-xs font-semibold mb-3">TS 708 — BİRİM AĞIRLIKLAR</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[#64748B] border-b border-white/[0.07]">
                  <th className="text-left py-1.5">Çap (mm)</th>
                  <th className="text-right py-1.5">kg/m</th>
                  <th className="text-right py-1.5">Kesit (cm²)</th>
                  <th className="text-right py-1.5">6m ağırlık</th>
                </tr>
              </thead>
              <tbody>
                {caplar.map(({ cap, birimAgirlik, kesitAlani }) => (
                  <tr
                    key={cap}
                    className={`border-b border-white/[0.04] last:border-0 ${
                      secilenCap === cap ? 'text-amber-500' : 'text-white'
                    }`}
                  >
                    <td className="py-1.5 font-bold">Ø{cap}</td>
                    <td className="text-right py-1.5">{birimAgirlik}</td>
                    <td className="text-right py-1.5">{kesitAlani}</td>
                    <td className="text-right py-1.5">{fmt(birimAgirlik * 6)} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
