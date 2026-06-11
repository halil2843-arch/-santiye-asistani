'use client';

import { useState } from 'react';
import Link from 'next/link';

type Tab = 'mesafe' | 'derece' | 'referans';

interface EgimSonuc {
  yuzde: number;
  derece: number;
  oran: number;
}

function hesaplaEgimdenMesafe(yukselti: number, yatay: number): EgimSonuc | null {
  if (yatay <= 0 || yukselti < 0) return null;
  const oran = yukselti / yatay;
  return {
    yuzde: oran * 100,
    derece: Math.atan(oran) * (180 / Math.PI),
    oran: yatay / Math.max(yukselti, 0.0001),
  };
}

function hesaplaEgimdenDerece(derece: number): EgimSonuc | null {
  if (derece < 0 || derece >= 90) return null;
  const rad = (derece * Math.PI) / 180;
  const tan = Math.tan(rad);
  return {
    yuzde: tan * 100,
    derece,
    oran: 1 / Math.max(tan, 0.0001),
  };
}

function fmt2(n: number): string {
  return parseFloat(n.toFixed(2)).toString();
}

const referanslar = [
  { label: 'Çatı eğimi (standart)',   min: 30, max: 50, minDer: 16.7, maxDer: 26.6, renk: 'text-blue-400' },
  { label: 'Yol eğimi (maksimum)',     min: 8,  max: 8,  minDer: 4.6,  maxDer: 4.6,  renk: 'text-green-400' },
  { label: 'Engelli rampası (maks)',   min: 8,  max: 8,  minDer: 4.6,  maxDer: 4.6,  renk: 'text-cyan-400' },
  { label: 'Merdivenler',              min: 58, max: 87, minDer: 30,   maxDer: 41,   renk: 'text-orange-400' },
  { label: 'Bina koridoru (min)',      min: 1,  max: 2,  minDer: 0.57, maxDer: 1.15, renk: 'text-purple-400' },
  { label: 'Park yeri rampası (maks)', min: 15, max: 20, minDer: 8.5,  maxDer: 11.3, renk: 'text-rose-400' },
];

export default function EgimHesaplayici() {
  const [tab, setTab] = useState<Tab>('mesafe');

  // Tab 1 — mesafe
  const [yukselti, setYukselti] = useState('');
  const [yatay, setYatay] = useState('');

  // Tab 2 — derece
  const [dereceDeger, setDereceDeger] = useState('');

  const sonuc1: EgimSonuc | null = (() => {
    const y = parseFloat(yukselti);
    const x = parseFloat(yatay);
    if (isNaN(y) || isNaN(x) || x <= 0) return null;
    return hesaplaEgimdenMesafe(y, x);
  })();

  const sonuc2: EgimSonuc | null = (() => {
    const d = parseFloat(dereceDeger);
    if (isNaN(d)) return null;
    return hesaplaEgimdenDerece(d);
  })();

  const aktivSonuc = tab === 'mesafe' ? sonuc1 : tab === 'derece' ? sonuc2 : null;

  // Eğim açısı animasyonu için derece değeri
  const animasyonDerece = aktivSonuc ? Math.min(aktivSonuc.derece, 89) : 0;

  return (
    <div className="min-h-screen bg-[#0E1117] px-4 py-5">
      <Link
        href="/araclar"
        className="inline-flex items-center gap-1.5 text-[#94A3B8] text-sm mb-5 hover:text-white transition-colors"
      >
        ← Araçlar
      </Link>

      <h1 className="font-[var(--font-syne)] text-2xl font-black text-white mb-6">
        Eğim Hesaplayıcı
      </h1>

      {/* Tab seçici */}
      <div className="bg-[#1E2636] rounded-2xl border border-white/[0.07] p-1 flex gap-1 mb-4">
        {([
          { id: 'mesafe',  label: 'Mesafe → Eğim'  },
          { id: 'derece',  label: 'Derece → Eğim'  },
          { id: 'referans',label: 'Referanslar'    },
        ] as { id: Tab; label: string }[]).map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all ${
              tab === id ? 'bg-amber-500 text-black' : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* TAB 1 — Yükseklik / Mesafe → Eğim */}
      {tab === 'mesafe' && (
        <>
          <div className="bg-[#1E2636] rounded-2xl border border-white/[0.07] p-4 space-y-3 mb-4">
            <div>
              <label className="text-[#94A3B8] text-xs font-semibold mb-1.5 block">Yükseklik Farkı (m)</label>
              <input
                type="number"
                min="0"
                value={yukselti}
                onChange={(e) => setYukselti(e.target.value)}
                placeholder="örn: 1.5"
                className="w-full bg-[#252F42] rounded-xl px-4 py-3 text-white border border-white/[0.07] text-sm focus:outline-none focus:border-amber-500/50 placeholder-[#4A5568]"
              />
            </div>
            <div>
              <label className="text-[#94A3B8] text-xs font-semibold mb-1.5 block">Yatay Mesafe (m)</label>
              <input
                type="number"
                min="0"
                value={yatay}
                onChange={(e) => setYatay(e.target.value)}
                placeholder="örn: 10"
                className="w-full bg-[#252F42] rounded-xl px-4 py-3 text-white border border-white/[0.07] text-sm focus:outline-none focus:border-amber-500/50 placeholder-[#4A5568]"
              />
            </div>
          </div>

          {sonuc1 ? (
            <EgimSonucPanel sonuc={sonuc1} animDerece={animasyonDerece} />
          ) : (
            <BosPanelEgim />
          )}
        </>
      )}

      {/* TAB 2 — Derece → Yüzde + Oran */}
      {tab === 'derece' && (
        <>
          <div className="bg-[#1E2636] rounded-2xl border border-white/[0.07] p-4 mb-4">
            <label className="text-[#94A3B8] text-xs font-semibold mb-1.5 block">Açı (°)</label>
            <input
              type="number"
              min="0"
              max="89"
              step="0.1"
              value={dereceDeger}
              onChange={(e) => setDereceDeger(e.target.value)}
              placeholder="örn: 15"
              className="w-full bg-[#252F42] rounded-xl px-4 py-3 text-white border border-white/[0.07] text-sm focus:outline-none focus:border-amber-500/50 placeholder-[#4A5568]"
            />
            <p className="text-[#64748B] text-xs mt-1">0° – 89° arası değer girin</p>
          </div>

          {sonuc2 ? (
            <EgimSonucPanel sonuc={sonuc2} animDerece={animasyonDerece} />
          ) : (
            <BosPanelEgim />
          )}
        </>
      )}

      {/* TAB 3 — İnşaat Referansları */}
      {tab === 'referans' && (
        <div className="space-y-3">
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
            <p className="text-amber-400 text-xs">
              Türk standartları (TS) ve genel inşaat uygulamalarına göre referans eğim değerleri.
            </p>
          </div>

          {referanslar.map(({ label, min, max, minDer, maxDer, renk }) => (
            <div key={label} className="bg-[#1E2636] rounded-xl p-4 border border-white/[0.07]">
              <div className="flex justify-between items-start mb-2">
                <p className={`text-sm font-semibold ${renk}`}>{label}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[#64748B] text-xs mb-0.5">Eğim %</p>
                  <p className="text-white text-sm font-bold">
                    {min === max ? `%${min}` : `%${min} – %${max}`}
                  </p>
                </div>
                <div>
                  <p className="text-[#64748B] text-xs mb-0.5">Derece °</p>
                  <p className="text-white text-sm font-bold">
                    {minDer === maxDer ? `${minDer}°` : `${minDer}° – ${maxDer}°`}
                  </p>
                </div>
              </div>
              {/* Görsel çizgi */}
              <div className="mt-2 h-1.5 bg-[#252F42] rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min((max / 90) * 100, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EgimSonucPanel({ sonuc, animDerece }: { sonuc: EgimSonuc; animDerece: number }) {
  return (
    <div className="space-y-3">
      {/* Ana sonuç */}
      <div className="bg-[#1E2636] rounded-xl p-4 border-l-4 border-amber-500">
        <p className="text-[#94A3B8] text-xs font-semibold mb-1">Eğim Yüzdesi</p>
        <p className="text-white text-3xl font-bold">%{fmt2(sonuc.yuzde)}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#1E2636] rounded-xl p-3 border border-white/[0.07]">
          <p className="text-[#94A3B8] text-xs mb-1">Derece</p>
          <p className="text-white text-lg font-bold">{fmt2(sonuc.derece)}°</p>
        </div>
        <div className="bg-[#1E2636] rounded-xl p-3 border border-white/[0.07]">
          <p className="text-[#94A3B8] text-xs mb-1">Oran</p>
          <p className="text-white text-lg font-bold">1:{fmt2(sonuc.oran)}</p>
        </div>
      </div>

      {/* Görsel eğim animasyonu */}
      <div className="bg-[#1E2636] rounded-2xl border border-white/[0.07] p-4 overflow-hidden">
        <p className="text-[#94A3B8] text-xs font-semibold mb-3">GÖRSEL EĞİM</p>
        <div className="relative h-24 flex items-end">
          {/* Zemin */}
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10" />
          {/* Yüzey çizgisi */}
          <div
            className="absolute bottom-0 left-0 w-3/4 h-1 bg-amber-500 rounded origin-bottom-left transition-all duration-700"
            style={{ transform: `rotate(-${animDerece}deg)` }}
          />
          {/* Etiket */}
          <div className="absolute bottom-2 right-4 text-amber-500 text-xs font-bold">
            {fmt2(animDerece)}°
          </div>
          {/* Dikey */}
          <div
            className="absolute bottom-0 left-0 w-0.5 bg-white/20 transition-all duration-700"
            style={{ height: `${Math.min(animDerece * 1.5, 90)}%` }}
          />
        </div>
      </div>

      {/* Yorum */}
      {sonuc.yuzde > 0 && (
        <div className={`rounded-xl p-3 border ${
          sonuc.yuzde <= 8 ? 'bg-green-500/10 border-green-500/30' :
          sonuc.yuzde <= 30 ? 'bg-amber-500/10 border-amber-500/30' :
          'bg-red-500/10 border-red-500/30'
        }`}>
          <p className={`text-xs ${
            sonuc.yuzde <= 8 ? 'text-green-400' :
            sonuc.yuzde <= 30 ? 'text-amber-400' :
            'text-red-400'
          }`}>
            {sonuc.yuzde <= 2 && 'Düz yüzey — yeterli drenaj için min %2 önerilir.'}
            {sonuc.yuzde > 2 && sonuc.yuzde <= 8 && 'Rampa/yol için uygun eğim.'}
            {sonuc.yuzde > 8 && sonuc.yuzde <= 30 && 'Araba rampası için dik. Yaya rampası olarak kullanılamaz.'}
            {sonuc.yuzde > 30 && sonuc.yuzde <= 87 && 'Çatı eğim aralığında.'}
            {sonuc.yuzde > 87 && 'Çok dik — özel yapısal önlemler gerektirir.'}
          </p>
        </div>
      )}
    </div>
  );
}

function BosPanelEgim() {
  return (
    <div className="bg-[#1E2636] rounded-2xl border border-white/[0.07] p-8 text-center">
      <p className="text-4xl mb-3">📐</p>
      <p className="text-[#94A3B8] text-sm">Değerleri girerek eğimi hesaplayın</p>
    </div>
  );
}
