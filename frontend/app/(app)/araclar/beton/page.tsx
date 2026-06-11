'use client';

import { useState } from 'react';
import Link from 'next/link';

type BetonSinifi = 'C16' | 'C20' | 'C25' | 'C30' | 'C35' | 'C40';

interface KarisimOrani {
  cimento: number;  // kg/m³
  kum: number;      // m³/m³
  cakil: number;    // m³/m³
  su: number;       // L/m³
  aciklama: string;
}

const karisimlar: Record<BetonSinifi, KarisimOrani> = {
  C16: { cimento: 280, kum: 0.45, cakil: 0.75, su: 185, aciklama: 'Dolgu, tesviye betonu' },
  C20: { cimento: 300, kum: 0.43, cakil: 0.73, su: 180, aciklama: 'Hafif yük elemanları' },
  C25: { cimento: 340, kum: 0.40, cakil: 0.70, su: 175, aciklama: 'Standart konut betonu' },
  C30: { cimento: 380, kum: 0.37, cakil: 0.67, su: 168, aciklama: 'Yüksek dayanım, perde duvar' },
  C35: { cimento: 420, kum: 0.34, cakil: 0.64, su: 160, aciklama: 'Köprü, yüksek katlı yapı' },
  C40: { cimento: 460, kum: 0.31, cakil: 0.61, su: 155, aciklama: 'Özel yapılar, endüstriyel' },
};

const sinifSirasi: BetonSinifi[] = ['C16', 'C20', 'C25', 'C30', 'C35', 'C40'];

function fmt(n: number, d = 2): string {
  return n.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: d });
}

export default function BetonHesaplayici() {
  const [sinif, setSinif] = useState<BetonSinifi>('C25');
  const [hacim, setHacim] = useState('');

  // Maliyet inputları (₺/birim)
  const [cimentoFiyat, setCimentoFiyat] = useState('250');  // ₺/torba (50kg)
  const [kumFiyat, setKumFiyat] = useState('350');          // ₺/m³
  const [cakilFiyat, setCakilFiyat] = useState('400');      // ₺/m³
  const [maliyetAcik, setMaliyetAcik] = useState(false);

  const hacimVal = parseFloat(hacim);
  const gecerli = !isNaN(hacimVal) && hacimVal > 0;
  const k = karisimlar[sinif];

  const sonuc = gecerli ? {
    cimento_kg: k.cimento * hacimVal,
    cimento_torba: Math.ceil((k.cimento * hacimVal) / 50),
    kum_m3: k.kum * hacimVal,
    cakil_m3: k.cakil * hacimVal,
    su_l: k.su * hacimVal,
  } : null;

  const maliyet = sonuc && maliyetAcik ? (() => {
    const cFiyat = parseFloat(cimentoFiyat) || 0;
    const kFiyat = parseFloat(kumFiyat) || 0;
    const caFiyat = parseFloat(cakilFiyat) || 0;
    return (
      sonuc.cimento_torba * cFiyat +
      sonuc.kum_m3 * kFiyat +
      sonuc.cakil_m3 * caFiyat
    );
  })() : null;

  return (
    <div className="min-h-screen bg-[#0E1117] px-4 py-5">
      <Link
        href="/araclar"
        className="inline-flex items-center gap-1.5 text-[#94A3B8] text-sm mb-5 hover:text-white transition-colors"
      >
        ← Araçlar
      </Link>

      <h1 className="font-[var(--font-syne)] text-2xl font-black text-white mb-6">
        Beton Hesaplayıcı
      </h1>

      {/* Beton sınıfı seçici — yatay scroll pill */}
      <div className="bg-[#1E2636] rounded-2xl border border-white/[0.07] p-4 mb-4">
        <p className="text-[#94A3B8] text-xs font-semibold mb-3">BETON SINIFI</p>
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', scrollbarWidth: 'none' }}>
          {sinifSirasi.map((s) => (
            <button
              key={s}
              onClick={() => setSinif(s)}
              style={{
                flexShrink: 0, padding: '10px 20px', borderRadius: '50px',
                background: sinif === s ? '#F59E0B' : '#252F42',
                color: sinif === s ? '#000' : '#94A3B8',
                border: `1px solid ${sinif === s ? '#F59E0B' : 'rgba(255,255,255,0.07)'}`,
                fontWeight: '700', fontSize: '16px', whiteSpace: 'nowrap',
                cursor: 'pointer', transition: 'all 0.15s',
                fontFamily: 'Syne, sans-serif',
              }}
            >
              {s}
            </button>
          ))}
        </div>
        <p className="text-[#64748B] text-xs mt-1">{karisimlar[sinif].aciklama}</p>
      </div>

      {/* Hacim girişi */}
      <div className="bg-[#1E2636] rounded-2xl border border-white/[0.07] p-4 mb-4">
        <label className="text-[#94A3B8] text-xs font-semibold mb-1.5 block">Beton Hacmi (m³)</label>
        <input
          type="number"
          min="0"
          step="0.1"
          value={hacim}
          onChange={(e) => setHacim(e.target.value)}
          placeholder="örn: 5.0"
          className="w-full bg-[#252F42] rounded-xl px-4 py-3 text-white border border-white/[0.07] text-sm focus:outline-none focus:border-amber-500/50 placeholder-[#4A5568]"
        />
      </div>

      {/* Sonuç */}
      {sonuc !== null ? (
        <div className="space-y-3">
          {/* Hacim özet */}
          <div className="bg-[#1E2636] rounded-xl p-4 border-l-4 border-amber-500">
            <p className="text-[#94A3B8] text-xs font-semibold mb-1">Toplam Hacim</p>
            <p className="text-white text-2xl font-bold">
              {fmt(hacimVal, 3)} <span className="text-amber-500 text-lg">m³</span>
            </p>
            <p className="text-[#64748B] text-xs mt-1">Sınıf: {sinif} — {karisimlar[sinif].aciklama}</p>
          </div>

          {/* Malzeme tablosu */}
          <div className="bg-[#1E2636] rounded-2xl border border-white/[0.07] p-4">
            <p className="text-[#94A3B8] text-xs font-semibold mb-3">KARIŞIM MATERYALLERİ</p>
            <div className="space-y-3">
              {/* Çimento */}
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <div>
                    <p className="text-white text-sm font-semibold">Çimento</p>
                    <p className="text-[#64748B] text-xs">{k.cimento} kg/m³</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white text-sm font-semibold">{fmt(sonuc.cimento_kg)} kg</p>
                  <p className="text-amber-500 text-xs font-semibold">{sonuc.cimento_torba} torba (50 kg)</p>
                </div>
              </div>

              <div className="border-b border-white/[0.05]" />

              {/* Kum */}
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-yellow-600" />
                  <div>
                    <p className="text-white text-sm font-semibold">Kum</p>
                    <p className="text-[#64748B] text-xs">{k.kum} m³/m³</p>
                  </div>
                </div>
                <p className="text-white text-sm font-semibold">{fmt(sonuc.kum_m3, 3)} m³</p>
              </div>

              <div className="border-b border-white/[0.05]" />

              {/* Çakıl */}
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-gray-400" />
                  <div>
                    <p className="text-white text-sm font-semibold">Çakıl</p>
                    <p className="text-[#64748B] text-xs">{k.cakil} m³/m³</p>
                  </div>
                </div>
                <p className="text-white text-sm font-semibold">{fmt(sonuc.cakil_m3, 3)} m³</p>
              </div>

              <div className="border-b border-white/[0.05]" />

              {/* Su */}
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-cyan-400" />
                  <div>
                    <p className="text-white text-sm font-semibold">Su</p>
                    <p className="text-[#64748B] text-xs">{k.su} L/m³</p>
                  </div>
                </div>
                <p className="text-white text-sm font-semibold">{fmt(sonuc.su_l)} litre</p>
              </div>
            </div>
          </div>

          {/* Maliyet tahmini */}
          <div className="bg-[#1E2636] rounded-2xl border border-white/[0.07] overflow-hidden">
            <button
              onClick={() => setMaliyetAcik(!maliyetAcik)}
              className="w-full p-4 flex items-center justify-between text-sm font-semibold text-white"
            >
              <span>Maliyet Tahmini</span>
              <span className="text-[#94A3B8] text-xs">{maliyetAcik ? '▲ Kapat' : '▼ Fiyatları Düzenle'}</span>
            </button>

            {maliyetAcik && (
              <div className="px-4 pb-4 space-y-3 border-t border-white/[0.07] pt-3">
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[#94A3B8] text-xs mb-1 block">Çimento (₺/torba)</label>
                    <input
                      type="number"
                      min="0"
                      value={cimentoFiyat}
                      onChange={(e) => setCimentoFiyat(e.target.value)}
                      className="w-full bg-[#252F42] rounded-lg px-2 py-2 text-white border border-white/[0.07] text-xs focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-[#94A3B8] text-xs mb-1 block">Kum (₺/m³)</label>
                    <input
                      type="number"
                      min="0"
                      value={kumFiyat}
                      onChange={(e) => setKumFiyat(e.target.value)}
                      className="w-full bg-[#252F42] rounded-lg px-2 py-2 text-white border border-white/[0.07] text-xs focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-[#94A3B8] text-xs mb-1 block">Çakıl (₺/m³)</label>
                    <input
                      type="number"
                      min="0"
                      value={cakilFiyat}
                      onChange={(e) => setCakilFiyat(e.target.value)}
                      className="w-full bg-[#252F42] rounded-lg px-2 py-2 text-white border border-white/[0.07] text-xs focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                </div>

                {maliyet !== null && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex justify-between items-center">
                    <span className="text-amber-400 text-sm font-semibold">Tahmini Toplam</span>
                    <span className="text-white text-lg font-bold">
                      ₺{fmt(maliyet)}
                    </span>
                  </div>
                )}

                <p className="text-[#64748B] text-xs">
                  * İşçilik ve nakliye dahil değildir. Fiyatlar yaklaşık değerdir.
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-[#1E2636] rounded-2xl border border-white/[0.07] p-8 text-center">
          <p className="text-4xl mb-3">🏗️</p>
          <p className="text-white text-sm font-semibold mb-1">Beton Karışım Hesabı</p>
          <p className="text-[#94A3B8] text-xs">Sınıfı seçin, hacim girin — anlık hesaplama yapar</p>
        </div>
      )}

      {/* Referans tablosu */}
      <div className="mt-4 bg-[#1E2636] rounded-2xl border border-white/[0.07] p-4">
        <p className="text-[#94A3B8] text-xs font-semibold mb-3">KARIŞIM REFERANS TABLOSU (m³ başına)</p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[#64748B]">
                <th className="text-left py-1.5 font-semibold">Sınıf</th>
                <th className="text-right py-1.5 font-semibold">Çim. kg</th>
                <th className="text-right py-1.5 font-semibold">Kum m³</th>
                <th className="text-right py-1.5 font-semibold">Çkl m³</th>
                <th className="text-right py-1.5 font-semibold">Su L</th>
              </tr>
            </thead>
            <tbody>
              {sinifSirasi.map((s) => (
                <tr
                  key={s}
                  className={`border-t border-white/[0.04] ${sinif === s ? 'text-amber-500' : 'text-white'}`}
                >
                  <td className="py-1.5 font-bold">{s}</td>
                  <td className="text-right py-1.5">{karisimlar[s].cimento}</td>
                  <td className="text-right py-1.5">{karisimlar[s].kum}</td>
                  <td className="text-right py-1.5">{karisimlar[s].cakil}</td>
                  <td className="text-right py-1.5">{karisimlar[s].su}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
