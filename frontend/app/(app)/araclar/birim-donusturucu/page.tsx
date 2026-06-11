'use client';

import { useState } from 'react';
import Link from 'next/link';

type Kategori = 'Uzunluk' | 'Alan' | 'Hacim' | 'Agirlik' | 'Sicaklik' | 'Hiz';

interface BirimTanim {
  label: string;
  toBase: number;
}

type SicaklikDonusum = {
  toBase: (v: number) => number;
  fromBase: (v: number) => number;
};

const uzunlukBirimleri: Record<string, BirimTanim> = {
  mm:    { label: 'mm',    toBase: 0.001 },
  cm:    { label: 'cm',    toBase: 0.01 },
  m:     { label: 'm',     toBase: 1 },
  km:    { label: 'km',    toBase: 1000 },
  inc:   { label: 'inç',   toBase: 0.0254 },
  fit:   { label: 'fit',   toBase: 0.3048 },
  yarda: { label: 'yarda', toBase: 0.9144 },
  mil:   { label: 'mil',   toBase: 1609.344 },
};

const alanBirimleri: Record<string, BirimTanim> = {
  'mm²':   { label: 'mm²',    toBase: 0.000001 },
  'cm²':   { label: 'cm²',    toBase: 0.0001 },
  'm²':    { label: 'm²',     toBase: 1 },
  'km²':   { label: 'km²',    toBase: 1e6 },
  'donum': { label: 'dönüm',  toBase: 1000 },
  hektar:  { label: 'hektar', toBase: 10000 },
};

const hacimBirimleri: Record<string, BirimTanim> = {
  ml:  { label: 'ml',  toBase: 0.001 },
  cl:  { label: 'cl',  toBase: 0.01 },
  dl:  { label: 'dl',  toBase: 0.1 },
  l:   { label: 'l',   toBase: 1 },
  'm³':{ label: 'm³',  toBase: 1000 },
  'ft³':{ label: 'ft³', toBase: 28.3168 },
};

const agirlikBirimleri: Record<string, BirimTanim> = {
  mg:   { label: 'mg',   toBase: 0.000001 },
  g:    { label: 'g',    toBase: 0.001 },
  kg:   { label: 'kg',   toBase: 1 },
  ton:  { label: 'ton',  toBase: 1000 },
  libre:{ label: 'libre',toBase: 0.453592 },
  ons:  { label: 'ons',  toBase: 0.0283495 },
};

const sicaklikBirimleri: Record<string, SicaklikDonusum> = {
  'C': { toBase: (v) => v,             fromBase: (v) => v },
  'F': { toBase: (v) => (v - 32) * 5/9, fromBase: (v) => v * 9/5 + 32 },
  'K': { toBase: (v) => v - 273.15,    fromBase: (v) => v + 273.15 },
};

const hizBirimleri: Record<string, BirimTanim> = {
  'ms':   { label: 'm/s',   toBase: 1 },
  'kmh':  { label: 'km/h',  toBase: 1/3.6 },
  'mph':  { label: 'mph',   toBase: 0.44704 },
  'knot': { label: 'knot',  toBase: 0.514444 },
};

const kategoriBirimleri: Record<Exclude<Kategori, 'Sicaklik'>, Record<string, BirimTanim>> = {
  Uzunluk: uzunlukBirimleri,
  Alan: alanBirimleri,
  Hacim: hacimBirimleri,
  Agirlik: agirlikBirimleri,
  Hiz: hizBirimleri,
};

const kategoriListesi: { id: Kategori; label: string }[] = [
  { id: 'Uzunluk',  label: 'Uzunluk'  },
  { id: 'Alan',     label: 'Alan'     },
  { id: 'Hacim',    label: 'Hacim'    },
  { id: 'Agirlik',  label: 'Ağırlık'  },
  { id: 'Sicaklik', label: 'Sıcaklık' },
  { id: 'Hiz',      label: 'Hız'      },
];

function formatSonuc(val: number): string {
  if (!isFinite(val)) return '—';
  if (val === 0) return '0';
  if (Math.abs(val) >= 0.001 && Math.abs(val) < 1e12) {
    return parseFloat(val.toPrecision(8)).toString();
  }
  return val.toExponential(4);
}

function hesaplaSicaklik(val: number, kaynakId: string, hedefId: string): number {
  const base = sicaklikBirimleri[kaynakId].toBase(val);
  return sicaklikBirimleri[hedefId].fromBase(base);
}

export default function BirimDonusturucu() {
  const [kategori, setKategori] = useState<Kategori>('Uzunluk');
  const [kaynak, setKaynak] = useState('m');
  const [hedef, setHedef] = useState('cm');
  const [miktar, setMiktar] = useState('');
  const [kopyalandi, setKopyalandi] = useState(false);

  const kategoriDegistir = (k: Kategori) => {
    setKategori(k);
    setMiktar('');
    if (k === 'Sicaklik') {
      setKaynak('C');
      setHedef('F');
    } else {
      const birimler = kategoriBirimleri[k];
      const anahtarlar = Object.keys(birimler);
      setKaynak(anahtarlar[0]);
      setHedef(anahtarlar[1] ?? anahtarlar[0]);
    }
  };

  const sonuc = (() => {
    const val = parseFloat(miktar);
    if (isNaN(val) || miktar === '') return null;
    if (kategori === 'Sicaklik') {
      return hesaplaSicaklik(val, kaynak, hedef);
    }
    const birimler = kategoriBirimleri[kategori as Exclude<Kategori, 'Sicaklik'>];
    const kb = birimler[kaynak];
    const hb = birimler[hedef];
    if (!kb || !hb) return null;
    return (val * kb.toBase) / hb.toBase;
  })();

  const sonucKopyala = async () => {
    if (sonuc === null) return;
    const label = kategori === 'Sicaklik' ? `°${hedef}` : (kategoriBirimleri[kategori as Exclude<Kategori, 'Sicaklik'>][hedef]?.label ?? hedef);
    await navigator.clipboard.writeText(`${formatSonuc(sonuc)} ${label}`);
    setKopyalandi(true);
    setTimeout(() => setKopyalandi(false), 1500);
  };

  const getBirimLabel = (id: string): string => {
    if (kategori === 'Sicaklik') return `°${id}`;
    const birimler = kategoriBirimleri[kategori as Exclude<Kategori, 'Sicaklik'>];
    return birimler[id]?.label ?? id;
  };

  const getBirimListesi = (): string[] => {
    if (kategori === 'Sicaklik') return Object.keys(sicaklikBirimleri);
    return Object.keys(kategoriBirimleri[kategori as Exclude<Kategori, 'Sicaklik'>]);
  };

  const birimListesi = getBirimListesi();

  return (
    <div className="min-h-screen bg-[#0E1117] px-4 py-5">
      <Link
        href="/araclar"
        className="inline-flex items-center gap-1.5 text-[#94A3B8] text-sm mb-5 hover:text-white transition-colors"
      >
        ← Araçlar
      </Link>

      <h1 className="font-[var(--font-syne)] text-2xl font-black text-white mb-6">
        Birim Dönüştürücü
      </h1>

      {/* Kategori seçici */}
      <div className="bg-[#1E2636] rounded-2xl border border-white/[0.07] p-1 mb-4">
        <div className="grid grid-cols-3 gap-1">
          {kategoriListesi.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => kategoriDegistir(id)}
              className={`py-2 px-2 rounded-xl text-xs font-semibold transition-all ${
                kategori === id
                  ? 'bg-amber-500 text-black'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Dönüşüm paneli */}
      <div className="bg-[#1E2636] rounded-2xl border border-white/[0.07] p-4 space-y-4 mb-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[#94A3B8] text-xs font-semibold mb-1.5 block">Nereden</label>
            <select
              value={kaynak}
              onChange={(e) => setKaynak(e.target.value)}
              className="w-full bg-[#252F42] rounded-xl px-3 py-3 text-white border border-white/[0.07] text-sm appearance-none cursor-pointer focus:outline-none focus:border-amber-500/50"
            >
              {birimListesi.map((b) => (
                <option key={b} value={b} className="bg-[#252F42]">{getBirimLabel(b)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[#94A3B8] text-xs font-semibold mb-1.5 block">Nereye</label>
            <select
              value={hedef}
              onChange={(e) => setHedef(e.target.value)}
              className="w-full bg-[#252F42] rounded-xl px-3 py-3 text-white border border-white/[0.07] text-sm appearance-none cursor-pointer focus:outline-none focus:border-amber-500/50"
            >
              {birimListesi.map((b) => (
                <option key={b} value={b} className="bg-[#252F42]">{getBirimLabel(b)}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-[#94A3B8] text-xs font-semibold mb-1.5 block">Değer</label>
          <input
            type="number"
            value={miktar}
            onChange={(e) => setMiktar(e.target.value)}
            placeholder="Değer girin..."
            className="w-full bg-[#252F42] rounded-xl px-4 py-3 text-white border border-white/[0.07] text-sm focus:outline-none focus:border-amber-500/50 placeholder-[#4A5568]"
          />
        </div>
      </div>

      {/* Sonuç */}
      {sonuc !== null && (
        <div className="bg-[#1E2636] rounded-xl p-4 border-l-4 border-amber-500 mb-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[#94A3B8] text-xs font-semibold mb-1">Sonuç</p>
              <p className="text-white text-2xl font-bold">
                {formatSonuc(sonuc)}{' '}
                <span className="text-amber-500 text-lg">{getBirimLabel(hedef)}</span>
              </p>
              <p className="text-[#64748B] text-xs mt-1">
                {miktar} {getBirimLabel(kaynak)} = {formatSonuc(sonuc)} {getBirimLabel(hedef)}
              </p>
            </div>
            <button
              onClick={sonucKopyala}
              className="mt-1 text-xs px-3 py-1.5 rounded-lg border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-colors shrink-0"
            >
              {kopyalandi ? '✓ Kopyalandı' : 'Kopyala'}
            </button>
          </div>
        </div>
      )}

      {/* Tüm birimler tablosu */}
      {miktar !== '' && sonuc !== null && kategori !== 'Sicaklik' && (
        <div className="bg-[#1E2636] rounded-2xl border border-white/[0.07] p-4">
          <p className="text-[#94A3B8] text-xs font-semibold mb-3">Tüm {kategoriListesi.find(k => k.id === kategori)?.label} Birimleri</p>
          <div className="space-y-2">
            {birimListesi.map((b) => {
              const val = parseFloat(miktar);
              if (isNaN(val)) return null;
              const birimler = kategoriBirimleri[kategori as Exclude<Kategori, 'Sicaklik'>];
              const deger = (val * birimler[kaynak].toBase) / birimler[b].toBase;
              return (
                <div key={b} className="flex justify-between items-center py-1 border-b border-white/[0.04] last:border-0">
                  <span className="text-[#94A3B8] text-sm">{getBirimLabel(b)}</span>
                  <span className={`text-sm font-semibold ${b === hedef ? 'text-amber-500' : 'text-white'}`}>
                    {formatSonuc(deger)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sıcaklık referansları */}
      {kategori === 'Sicaklik' && (
        <div className="bg-[#1E2636] rounded-2xl border border-white/[0.07] p-4">
          <p className="text-[#94A3B8] text-xs font-semibold mb-3">Referans Noktalar</p>
          <div className="space-y-2">
            {[
              { label: 'Suyun donma noktası', c: 0 },
              { label: 'Oda sıcaklığı', c: 20 },
              { label: 'Vücut sıcaklığı', c: 37 },
              { label: 'Suyun kaynama noktası', c: 100 },
            ].map(({ label, c }) => (
              <div key={label} className="flex justify-between items-center text-sm">
                <span className="text-[#94A3B8]">{label}</span>
                <span className="text-white font-semibold">
                  {c}°C / {(c * 9/5 + 32).toFixed(1)}°F / {(c + 273.15).toFixed(2)}K
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
