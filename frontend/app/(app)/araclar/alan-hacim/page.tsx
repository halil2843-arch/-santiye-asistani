'use client';

import { useState } from 'react';
import Link from 'next/link';

type AnaTab = 'alan' | 'hacim' | 'cevre';

interface SonucItem {
  label: string;
  value_m: number;
  birim: string;
}

function fmt(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '—';
  if (n === 0) return '0';
  if (Math.abs(n) >= 1e9 || (Math.abs(n) < 0.00001 && n !== 0)) return n.toExponential(4);
  return parseFloat(n.toPrecision(8)).toLocaleString('tr-TR', { maximumFractionDigits: 6 });
}

function DonuşumSatiri({ label, value_m, birim }: SonucItem) {
  // birim: 'm²', 'm³', 'm'
  let cm: number, mm: number;
  if (birim === 'm²') {
    cm = value_m * 10000;
    mm = value_m * 1e6;
  } else if (birim === 'm³') {
    cm = value_m * 1e6;
    mm = value_m * 1e9;
  } else {
    cm = value_m * 100;
    mm = value_m * 1000;
  }
  const cm_unit = birim === 'm²' ? 'cm²' : birim === 'm³' ? 'cm³' : 'cm';
  const mm_unit = birim === 'm²' ? 'mm²' : birim === 'm³' ? 'mm³' : 'mm';

  return (
    <div>
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-[#94A3B8] text-sm">{label}</span>
        <span className="text-white text-xl font-bold">
          {fmt(value_m)} <span className="text-amber-500 text-base font-semibold">{birim}</span>
        </span>
      </div>
      <div className="flex gap-3 justify-end">
        <span className="text-[#64748B] text-xs">{fmt(cm)} {cm_unit}</span>
        <span className="text-[#64748B] text-xs">{fmt(mm)} {mm_unit}</span>
      </div>
    </div>
  );
}

function InputField({ label, value, onChange, placeholder = '0' }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-[#94A3B8] text-xs font-semibold mb-1.5 block">{label}</label>
      <input
        type="number"
        min="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-[#252F42] rounded-xl px-4 py-3 text-white border border-white/[0.07] text-sm focus:outline-none focus:border-amber-500/50 placeholder-[#4A5568]"
      />
    </div>
  );
}

// --- ALAN sekilleri ---
type AlanSekil = 'dikdortgen' | 'ucgen' | 'daire' | 'trapez' | 'lsekli';
type HacimSekil = 'kup' | 'silindir' | 'koni' | 'kure' | 'prizma';
type CevreSekil = 'dikdortgen' | 'daire';

const alanSekilleri: { id: AlanSekil; label: string }[] = [
  { id: 'dikdortgen', label: 'Dikdörtgen' },
  { id: 'ucgen',      label: 'Üçgen'      },
  { id: 'daire',      label: 'Daire'      },
  { id: 'trapez',     label: 'Trapez'     },
  { id: 'lsekli',     label: 'L-Şekli'   },
];

const hacimSekilleri: { id: HacimSekil; label: string }[] = [
  { id: 'kup',      label: 'Küp/Dikdörtgen' },
  { id: 'silindir', label: 'Silindir'        },
  { id: 'koni',     label: 'Koni'            },
  { id: 'kure',     label: 'Küre'            },
  { id: 'prizma',   label: 'Prizma'          },
];

const cevreSekilleri: { id: CevreSekil; label: string }[] = [
  { id: 'dikdortgen', label: 'Dikdörtgen' },
  { id: 'daire',      label: 'Daire'      },
];

// SVG ikonları
function DiagramDikdortgenAlan() {
  return (
    <svg viewBox="0 0 80 50" className="w-16 h-10 mx-auto mb-2">
      <rect x="5" y="5" width="70" height="40" fill="none" stroke="#F59E0B" strokeWidth="2" />
      <text x="40" y="27" textAnchor="middle" fill="#94A3B8" fontSize="9">en × boy</text>
    </svg>
  );
}

function DiagramDaire() {
  return (
    <svg viewBox="0 0 60 60" className="w-12 h-12 mx-auto mb-2">
      <circle cx="30" cy="30" r="24" fill="none" stroke="#F59E0B" strokeWidth="2" />
      <line x1="30" y1="30" x2="54" y2="30" stroke="#94A3B8" strokeWidth="1.5" strokeDasharray="3,2" />
      <text x="42" y="26" textAnchor="middle" fill="#94A3B8" fontSize="8">r</text>
    </svg>
  );
}

export default function AlanHacim() {
  const [anaTab, setAnaTab] = useState<AnaTab>('alan');

  // Alan inputs
  const [alanSekil, setAlanSekil] = useState<AlanSekil>('dikdortgen');
  const [aEn, setAEn] = useState('');
  const [aBoy, setABoy] = useState('');
  const [aTaban, setATaban] = useState('');
  const [aYukseklik, setAYukseklik] = useState('');
  const [aYariCap, setAYariCap] = useState('');
  const [aTabanBuyuk, setATabanBuyuk] = useState('');
  const [aTabanKucuk, setATabanKucuk] = useState('');
  const [aL1En, setAL1En] = useState('');
  const [aL1Boy, setAL1Boy] = useState('');
  const [aL2En, setAL2En] = useState('');
  const [aL2Boy, setAL2Boy] = useState('');

  // Hacim inputs
  const [hacimSekil, setHacimSekil] = useState<HacimSekil>('kup');
  const [hEn, setHEn] = useState('');
  const [hBoy, setHBoy] = useState('');
  const [hYukseklik, setHYukseklik] = useState('');
  const [hYariCap, setHYariCap] = useState('');
  const [hKenar, setHKenar] = useState('');

  // Çevre inputs
  const [cevreSekil, setCevreSekil] = useState<CevreSekil>('dikdortgen');
  const [cEn, setCEn] = useState('');
  const [cBoy, setCBoy] = useState('');
  const [cYariCap, setCYariCap] = useState('');

  const n = (v: string) => parseFloat(v);
  const ok = (...vals: string[]) => vals.every((v) => v !== '' && !isNaN(parseFloat(v)) && parseFloat(v) > 0);

  // --- Alan hesapları ---
  const getAlanSonuc = (): SonucItem[] | null => {
    switch (alanSekil) {
      case 'dikdortgen':
        if (!ok(aEn, aBoy)) return null;
        return [{ label: 'Alan', value_m: n(aEn) * n(aBoy), birim: 'm²' }];
      case 'ucgen':
        if (!ok(aTaban, aYukseklik)) return null;
        return [{ label: 'Alan', value_m: 0.5 * n(aTaban) * n(aYukseklik), birim: 'm²' }];
      case 'daire':
        if (!ok(aYariCap)) return null;
        return [{ label: 'Alan', value_m: Math.PI * n(aYariCap) ** 2, birim: 'm²' }];
      case 'trapez':
        if (!ok(aTabanBuyuk, aTabanKucuk, aYukseklik)) return null;
        return [{ label: 'Alan', value_m: ((n(aTabanBuyuk) + n(aTabanKucuk)) / 2) * n(aYukseklik), birim: 'm²' }];
      case 'lsekli':
        if (!ok(aL1En, aL1Boy, aL2En, aL2Boy)) return null;
        return [{ label: 'Alan (L-şekli)', value_m: n(aL1En) * n(aL1Boy) + n(aL2En) * n(aL2Boy), birim: 'm²' }];
    }
  };

  // --- Hacim hesapları ---
  const getHacimSonuc = (): SonucItem[] | null => {
    switch (hacimSekil) {
      case 'kup':
        if (!ok(hEn, hBoy, hYukseklik)) return null;
        return [
          { label: 'Hacim', value_m: n(hEn) * n(hBoy) * n(hYukseklik), birim: 'm³' },
          { label: 'Yüzey Alanı', value_m: 2 * (n(hEn)*n(hBoy) + n(hBoy)*n(hYukseklik) + n(hEn)*n(hYukseklik)), birim: 'm²' },
        ];
      case 'silindir': {
        if (!ok(hYariCap, hYukseklik)) return null;
        const r = n(hYariCap);
        const h = n(hYukseklik);
        return [
          { label: 'Hacim', value_m: Math.PI * r * r * h, birim: 'm³' },
          { label: 'Toplam Yüzey', value_m: 2 * Math.PI * r * (r + h), birim: 'm²' },
        ];
      }
      case 'koni': {
        if (!ok(hYariCap, hYukseklik)) return null;
        const r = n(hYariCap);
        const h = n(hYukseklik);
        const l = Math.sqrt(r * r + h * h);
        return [
          { label: 'Hacim', value_m: (1/3) * Math.PI * r * r * h, birim: 'm³' },
          { label: 'Yan Yüzey', value_m: Math.PI * r * l, birim: 'm²' },
        ];
      }
      case 'kure': {
        if (!ok(hYariCap)) return null;
        const r = n(hYariCap);
        return [
          { label: 'Hacim', value_m: (4/3) * Math.PI * r ** 3, birim: 'm³' },
          { label: 'Yüzey Alanı', value_m: 4 * Math.PI * r * r, birim: 'm²' },
        ];
      }
      case 'prizma': {
        if (!ok(hEn, hBoy, hYukseklik)) return null;
        return [{ label: 'Hacim', value_m: n(hEn) * n(hBoy) * n(hYukseklik), birim: 'm³' }];
      }
    }
  };

  // --- Çevre hesapları ---
  const getCevreSonuc = (): SonucItem[] | null => {
    switch (cevreSekil) {
      case 'dikdortgen':
        if (!ok(cEn, cBoy)) return null;
        return [{ label: 'Çevre', value_m: 2 * (n(cEn) + n(cBoy)), birim: 'm' }];
      case 'daire':
        if (!ok(cYariCap)) return null;
        return [{ label: 'Çevre (Çember)', value_m: 2 * Math.PI * n(cYariCap), birim: 'm' }];
    }
  };

  const resetAlanInputs = () => {
    setAEn(''); setABoy(''); setATaban(''); setAYukseklik('');
    setAYariCap(''); setATabanBuyuk(''); setATabanKucuk('');
    setAL1En(''); setAL1Boy(''); setAL2En(''); setAL2Boy('');
  };

  const resetHacimInputs = () => {
    setHEn(''); setHBoy(''); setHYukseklik(''); setHYariCap(''); setHKenar('');
  };

  const resetCevreInputs = () => {
    setCEn(''); setCBoy(''); setCYariCap('');
  };

  const alanSonuc = getAlanSonuc();
  const hacimSonuc = getHacimSonuc();
  const cevreSonuc = getCevreSonuc();

  return (
    <div className="min-h-screen bg-[#0E1117] px-4 py-5">
      <Link
        href="/araclar"
        className="inline-flex items-center gap-1.5 text-[#94A3B8] text-sm mb-5 hover:text-white transition-colors"
      >
        ← Araçlar
      </Link>

      <h1 className="font-[var(--font-syne)] text-2xl font-black text-white mb-6">
        Alan & Hacim Hesaplayıcı
      </h1>

      {/* Ana Tab */}
      <div className="bg-[#1E2636] rounded-2xl border border-white/[0.07] p-1 flex gap-1 mb-4">
        {([
          { id: 'alan',  label: 'Alan (m²)'  },
          { id: 'hacim', label: 'Hacim (m³)' },
          { id: 'cevre', label: 'Çevre (m)'  },
        ] as { id: AnaTab; label: string }[]).map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setAnaTab(id)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              anaTab === id ? 'bg-amber-500 text-black' : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ALAN TAB */}
      {anaTab === 'alan' && (
        <>
          {/* Şekil seçici */}
          <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
            {alanSekilleri.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => { setAlanSekil(id); resetAlanInputs(); }}
                className={`shrink-0 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  alanSekil === id
                    ? 'bg-amber-500 text-black'
                    : 'bg-[#1E2636] text-[#94A3B8] border border-white/[0.07] hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Diyagram */}
          <div className="bg-[#1E2636] rounded-2xl border border-white/[0.07] p-4 mb-4">
            {alanSekil === 'daire' ? <DiagramDaire /> : <DiagramDikdortgenAlan />}
            <div className="space-y-3">
              {alanSekil === 'dikdortgen' && (
                <div className="grid grid-cols-2 gap-3">
                  <InputField label="En (m)" value={aEn} onChange={setAEn} />
                  <InputField label="Boy (m)" value={aBoy} onChange={setABoy} />
                </div>
              )}
              {alanSekil === 'ucgen' && (
                <div className="grid grid-cols-2 gap-3">
                  <InputField label="Taban (m)" value={aTaban} onChange={setATaban} />
                  <InputField label="Yükseklik (m)" value={aYukseklik} onChange={setAYukseklik} />
                </div>
              )}
              {alanSekil === 'daire' && (
                <InputField label="Yarıçap (m)" value={aYariCap} onChange={setAYariCap} />
              )}
              {alanSekil === 'trapez' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <InputField label="Büyük Taban (m)" value={aTabanBuyuk} onChange={setATabanBuyuk} />
                    <InputField label="Küçük Taban (m)" value={aTabanKucuk} onChange={setATabanKucuk} />
                  </div>
                  <InputField label="Yükseklik (m)" value={aYukseklik} onChange={setAYukseklik} />
                </div>
              )}
              {alanSekil === 'lsekli' && (
                <div className="space-y-3">
                  <p className="text-[#94A3B8] text-xs">Bölüm 1</p>
                  <div className="grid grid-cols-2 gap-3">
                    <InputField label="En₁ (m)" value={aL1En} onChange={setAL1En} />
                    <InputField label="Boy₁ (m)" value={aL1Boy} onChange={setAL1Boy} />
                  </div>
                  <p className="text-[#94A3B8] text-xs">Bölüm 2</p>
                  <div className="grid grid-cols-2 gap-3">
                    <InputField label="En₂ (m)" value={aL2En} onChange={setAL2En} />
                    <InputField label="Boy₂ (m)" value={aL2Boy} onChange={setAL2Boy} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {alanSonuc ? (
            <div className="bg-[#1E2636] rounded-xl p-4 border-l-4 border-amber-500 space-y-3">
              <p className="text-[#94A3B8] text-xs font-semibold">SONUÇ</p>
              {alanSonuc.map((item) => (
                <DonuşumSatiri key={item.label} {...item} />
              ))}
            </div>
          ) : (
            <div className="bg-[#1E2636] rounded-2xl border border-white/[0.07] p-8 text-center">
              <p className="text-4xl mb-3">📐</p>
              <p className="text-[#94A3B8] text-sm">Değerleri girerek alan hesabını başlatın</p>
            </div>
          )}
        </>
      )}

      {/* HACİM TAB */}
      {anaTab === 'hacim' && (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
            {hacimSekilleri.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => { setHacimSekil(id); resetHacimInputs(); }}
                className={`shrink-0 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  hacimSekil === id
                    ? 'bg-amber-500 text-black'
                    : 'bg-[#1E2636] text-[#94A3B8] border border-white/[0.07] hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="bg-[#1E2636] rounded-2xl border border-white/[0.07] p-4 mb-4">
            <div className="space-y-3">
              {(hacimSekil === 'kup' || hacimSekil === 'prizma') && (
                <div className="grid grid-cols-3 gap-3">
                  <InputField label="En (m)" value={hEn} onChange={setHEn} />
                  <InputField label="Boy (m)" value={hBoy} onChange={setHBoy} />
                  <InputField label="Yükseklik (m)" value={hYukseklik} onChange={setHYukseklik} />
                </div>
              )}
              {hacimSekil === 'silindir' && (
                <div className="grid grid-cols-2 gap-3">
                  <InputField label="Yarıçap (m)" value={hYariCap} onChange={setHYariCap} />
                  <InputField label="Yükseklik (m)" value={hYukseklik} onChange={setHYukseklik} />
                </div>
              )}
              {hacimSekil === 'koni' && (
                <div className="grid grid-cols-2 gap-3">
                  <InputField label="Taban Yarıçap (m)" value={hYariCap} onChange={setHYariCap} />
                  <InputField label="Yükseklik (m)" value={hYukseklik} onChange={setHYukseklik} />
                </div>
              )}
              {hacimSekil === 'kure' && (
                <InputField label="Yarıçap (m)" value={hYariCap} onChange={setHYariCap} />
              )}
            </div>
          </div>

          {hacimSonuc ? (
            <div className="bg-[#1E2636] rounded-xl p-4 border-l-4 border-amber-500 space-y-3">
              <p className="text-[#94A3B8] text-xs font-semibold">SONUÇ</p>
              {hacimSonuc.map((item) => (
                <DonuşumSatiri key={item.label} {...item} />
              ))}
            </div>
          ) : (
            <div className="bg-[#1E2636] rounded-2xl border border-white/[0.07] p-8 text-center">
              <p className="text-4xl mb-3">📦</p>
              <p className="text-[#94A3B8] text-sm">Değerleri girerek hacim hesabını başlatın</p>
            </div>
          )}
        </>
      )}

      {/* ÇEVRE TAB */}
      {anaTab === 'cevre' && (
        <>
          <div className="flex gap-2 mb-4">
            {cevreSekilleri.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => { setCevreSekil(id); resetCevreInputs(); }}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  cevreSekil === id
                    ? 'bg-amber-500 text-black'
                    : 'bg-[#1E2636] text-[#94A3B8] border border-white/[0.07] hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="bg-[#1E2636] rounded-2xl border border-white/[0.07] p-4 mb-4">
            {cevreSekil === 'dikdortgen' && (
              <div className="grid grid-cols-2 gap-3">
                <InputField label="En (m)" value={cEn} onChange={setCEn} />
                <InputField label="Boy (m)" value={cBoy} onChange={setCBoy} />
              </div>
            )}
            {cevreSekil === 'daire' && (
              <InputField label="Yarıçap (m)" value={cYariCap} onChange={setCYariCap} />
            )}
          </div>

          {cevreSonuc ? (
            <div className="bg-[#1E2636] rounded-xl p-4 border-l-4 border-amber-500 space-y-3">
              <p className="text-[#94A3B8] text-xs font-semibold">SONUÇ</p>
              {cevreSonuc.map((item) => (
                <DonuşumSatiri key={item.label} {...item} />
              ))}
            </div>
          ) : (
            <div className="bg-[#1E2636] rounded-2xl border border-white/[0.07] p-8 text-center">
              <p className="text-4xl mb-3">📏</p>
              <p className="text-[#94A3B8] text-sm">Değerleri girerek çevre hesabını başlatın</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
