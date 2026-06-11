'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';

type Mod = 'gps' | 'adim' | 'manuel';

// ─── Haversine formülü ────────────────────────────────────────────────────────
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // metre
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatMesafe(metre: number): string {
  if (metre >= 1000) return `${(metre / 1000).toFixed(3)} km`;
  return `${metre.toFixed(2)} m`;
}

interface Koordinat {
  lat: number;
  lng: number;
  label: string;
}

// ─── Tab 1: GPS Mesafesi ──────────────────────────────────────────────────────
function GpsModu() {
  const [noktalar, setNoktalar] = useState<Koordinat[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [kopyalandi, setKopyalandi] = useState(false);

  const konumAl = () => {
    if (!navigator.geolocation) {
      setHata('Tarayıcınız GPS desteklemiyor.');
      return;
    }
    setYukleniyor(true);
    setHata(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setYukleniyor(false);
        const yeni: Koordinat = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: noktalar.length === 0 ? 'Nokta A' : 'Nokta B',
        };
        setNoktalar((prev) => {
          if (prev.length >= 2) return [yeni]; // sıfırla
          return [...prev, yeni];
        });
      },
      (err) => {
        setYukleniyor(false);
        setHata('Konum alınamadı: ' + err.message);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const mesafe = noktalar.length === 2
    ? haversine(noktalar[0].lat, noktalar[0].lng, noktalar[1].lat, noktalar[1].lng)
    : null;

  const kopyala = async () => {
    if (mesafe === null) return;
    await navigator.clipboard.writeText(formatMesafe(mesafe));
    setKopyalandi(true);
    setTimeout(() => setKopyalandi(false), 1500);
  };

  const sifirla = () => {
    setNoktalar([]);
    setHata(null);
  };

  return (
    <div className="space-y-4">
      <p className="text-[#94A3B8] text-sm leading-relaxed">
        İki nokta arasındaki GPS mesafesini Haversine formülüyle hesaplar.
        Hassasiyet: ±3–10 m (açık alanda).
      </p>

      {/* Kaydedilen noktalar */}
      {noktalar.map((n, i) => (
        <div key={i} className="bg-[#252F42] rounded-xl p-3 border border-white/[0.07]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-amber-400 text-xs font-bold">{n.label}</span>
            <span className="text-green-400 text-[10px]">✓ Kaydedildi</span>
          </div>
          <p className="text-white text-xs font-mono">
            {n.lat.toFixed(6)}, {n.lng.toFixed(6)}
          </p>
        </div>
      ))}

      {/* Buton */}
      <button
        onClick={noktalar.length >= 2 ? sifirla : konumAl}
        disabled={yukleniyor}
        className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-60"
        style={{
          background: noktalar.length >= 2 ? '#6B7280' : '#EF4444',
          color: '#fff',
        }}
      >
        {yukleniyor
          ? '📡 Konum alınıyor...'
          : noktalar.length === 0
          ? '📍 Nokta A — Konumumu Al'
          : noktalar.length === 1
          ? '📍 Nokta B — Konumumu Al'
          : '🔄 Sıfırla ve Yeniden Başla'}
      </button>

      {hata && (
        <p className="text-red-400 text-xs bg-red-500/10 rounded-lg p-3">{hata}</p>
      )}

      {/* Sonuç */}
      {mesafe !== null && (
        <div className="bg-[#1E2636] rounded-xl p-4 border-l-4 border-amber-500">
          <p className="text-[#94A3B8] text-xs font-semibold mb-1 uppercase tracking-wide">Mesafe</p>
          <p className="text-white text-3xl font-bold font-[var(--font-syne)]">
            {mesafe >= 1000 ? (
              <>{(mesafe / 1000).toFixed(3)} <span className="text-amber-500 text-xl">km</span></>
            ) : (
              <>{mesafe.toFixed(2)} <span className="text-amber-500 text-xl">m</span></>
            )}
          </p>
          <p className="text-[#64748B] text-xs mt-1">{(mesafe * 100).toFixed(1)} cm</p>
          <button
            onClick={kopyala}
            className="mt-2 text-xs px-3 py-1.5 rounded-lg border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-colors"
          >
            {kopyalandi ? '✓ Kopyalandı' : '📋 Kopyala'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Tab 2: Adım Sayacı ───────────────────────────────────────────────────────
function AdimModu() {
  const [aktif, setAktif] = useState(false);
  const [adimSayisi, setAdimSayisi] = useState(0);
  const [adimUzunlugu, setAdimUzunlugu] = useState(0.75);
  const [destekleniyor, setDestekleniyor] = useState(true);

  const sonOkuma = useRef(0);
  const ESIK = 12; // m/s²

  useEffect(() => {
    if (typeof window !== 'undefined' && !('DeviceMotionEvent' in window)) {
      setDestekleniyor(false);
    }
  }, []);

  const adimTespit = useCallback((event: DeviceMotionEvent) => {
    const acc = event.accelerationIncludingGravity;
    if (!acc) return;
    const y = acc.y ?? 0;
    if (y > ESIK && sonOkuma.current <= ESIK) {
      setAdimSayisi((prev) => prev + 1);
    }
    sonOkuma.current = y;
  }, []);

  useEffect(() => {
    if (!aktif) return;
    window.addEventListener('devicemotion', adimTespit);
    return () => window.removeEventListener('devicemotion', adimTespit);
  }, [aktif, adimTespit]);

  const toggle = async () => {
    if (!aktif) {
      // iOS 13+ izin
      if (
        typeof (DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> })
          .requestPermission === 'function'
      ) {
        const izin = await (
          DeviceMotionEvent as unknown as { requestPermission: () => Promise<string> }
        ).requestPermission();
        if (izin !== 'granted') return;
      }
      setAdimSayisi(0);
    }
    setAktif((prev) => !prev);
  };

  const mesafe = adimSayisi * adimUzunlugu;

  return (
    <div className="space-y-4">
      <p className="text-[#94A3B8] text-sm leading-relaxed">
        İvmeölçer ile adım sayar. Ortalama adım uzunluğunu ayarlayabilirsiniz.
        Tahmini hassasiyet: ±%10–15.
      </p>

      {!destekleniyor && (
        <p className="text-yellow-400 text-xs bg-yellow-500/10 rounded-lg p-3">
          Bu cihaz DeviceMotionEvent desteklemiyor. Masaüstü tarayıcılarda çalışmaz.
        </p>
      )}

      {/* Adım uzunluğu ayarı */}
      <div className="bg-[#252F42] rounded-xl p-3 border border-white/[0.07]">
        <label className="text-[#94A3B8] text-xs font-semibold mb-2 block">
          Ortalama Adım Uzunluğu (m)
        </label>
        <input
          type="number"
          value={adimUzunlugu}
          onChange={(e) => setAdimUzunlugu(parseFloat(e.target.value) || 0.75)}
          step="0.01"
          min="0.3"
          max="1.2"
          className="w-full bg-[#1E2636] rounded-lg px-3 py-2 text-white text-sm border border-white/[0.07] focus:outline-none focus:border-amber-500/50"
        />
      </div>

      {/* Sayaç */}
      <div className="text-center py-6">
        <p className="text-[#94A3B8] text-xs mb-2 uppercase tracking-wide">Adım Sayısı</p>
        <p className="text-white text-6xl font-bold font-[var(--font-syne)] font-mono">{adimSayisi}</p>
        <p className="text-amber-400 text-base mt-2">≈ {mesafe.toFixed(2)} m</p>
      </div>

      {/* Başla/Durdur */}
      <button
        onClick={toggle}
        disabled={!destekleniyor}
        className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-40"
        style={{ background: aktif ? '#EF4444' : '#10B981', color: '#fff' }}
      >
        {aktif ? '⏹ Durdur' : '▶ Başla'}
      </button>

      {/* Sonuç */}
      {adimSayisi > 0 && !aktif && (
        <div className="bg-[#1E2636] rounded-xl p-4 border-l-4 border-amber-500">
          <p className="text-[#94A3B8] text-xs font-semibold mb-1 uppercase tracking-wide">Sonuç</p>
          <p className="text-white text-3xl font-bold font-[var(--font-syne)]">
            {mesafe.toFixed(2)} <span className="text-amber-500 text-xl">m</span>
          </p>
          <p className="text-[#64748B] text-xs mt-1">
            {adimSayisi} adım × {adimUzunlugu} m/adım
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Tab 3: Manuel Koordinat Hesabı ──────────────────────────────────────────
function ManuelModu() {
  const [lat1, setLat1] = useState('');
  const [lon1, setLon1] = useState('');
  const [lat2, setLat2] = useState('');
  const [lon2, setLon2] = useState('');
  const [sonuc, setSonuc] = useState<number | null>(null);
  const [hata, setHata] = useState<string | null>(null);
  const [kopyalandi, setKopyalandi] = useState(false);

  const hesapla = () => {
    const la1 = parseFloat(lat1);
    const lo1 = parseFloat(lon1);
    const la2 = parseFloat(lat2);
    const lo2 = parseFloat(lon2);

    if ([la1, lo1, la2, lo2].some(isNaN)) {
      setHata('Lütfen tüm koordinatları doğru formatta girin.');
      setSonuc(null);
      return;
    }
    if (la1 < -90 || la1 > 90 || la2 < -90 || la2 > 90) {
      setHata('Enlem -90 ile 90 arasında olmalıdır.');
      setSonuc(null);
      return;
    }
    if (lo1 < -180 || lo1 > 180 || lo2 < -180 || lo2 > 180) {
      setHata('Boylam -180 ile 180 arasında olmalıdır.');
      setSonuc(null);
      return;
    }
    setHata(null);
    setSonuc(haversine(la1, lo1, la2, lo2));
  };

  const sifirla = () => {
    setLat1(''); setLon1(''); setLat2(''); setLon2('');
    setSonuc(null); setHata(null);
  };

  const kopyala = async () => {
    if (sonuc === null) return;
    await navigator.clipboard.writeText(formatMesafe(sonuc));
    setKopyalandi(true);
    setTimeout(() => setKopyalandi(false), 1500);
  };

  const inputClass =
    'bg-[#0E1117] border border-white/[0.1] rounded-xl px-3 py-2.5 text-[#F1F5F9] text-sm ' +
    'placeholder-[#4A5568] focus:outline-none focus:border-amber-500/50 w-full font-mono';

  return (
    <div className="space-y-4">
      <p className="text-[#94A3B8] text-sm leading-relaxed">
        Koordinatları manuel girin. Haversine formülüyle küresel mesafeyi hesaplar.
      </p>

      {/* Koordinat 1 */}
      <div className="bg-[#252F42] rounded-xl p-3 border border-white/[0.07]">
        <p className="text-amber-400 text-xs font-semibold mb-2">📍 Koordinat 1</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[#94A3B8] text-[10px] mb-1 block">Enlem (lat)</label>
            <input
              type="number"
              value={lat1}
              onChange={(e) => setLat1(e.target.value)}
              placeholder="ör. 41.015137"
              step="0.000001"
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-[#94A3B8] text-[10px] mb-1 block">Boylam (lon)</label>
            <input
              type="number"
              value={lon1}
              onChange={(e) => setLon1(e.target.value)}
              placeholder="ör. 28.979530"
              step="0.000001"
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Koordinat 2 */}
      <div className="bg-[#252F42] rounded-xl p-3 border border-white/[0.07]">
        <p className="text-amber-400 text-xs font-semibold mb-2">📍 Koordinat 2</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[#94A3B8] text-[10px] mb-1 block">Enlem (lat)</label>
            <input
              type="number"
              value={lat2}
              onChange={(e) => setLat2(e.target.value)}
              placeholder="ör. 39.925533"
              step="0.000001"
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-[#94A3B8] text-[10px] mb-1 block">Boylam (lon)</label>
            <input
              type="number"
              value={lon2}
              onChange={(e) => setLon2(e.target.value)}
              placeholder="ör. 32.866287"
              step="0.000001"
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {hata && (
        <p className="text-red-400 text-xs bg-red-500/10 rounded-lg p-3">{hata}</p>
      )}

      <div className="flex gap-3">
        <button
          onClick={hesapla}
          disabled={!lat1 || !lon1 || !lat2 || !lon2}
          className="flex-1 py-3.5 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-50"
          style={{ background: '#F59E0B', color: '#000' }}
        >
          Hesapla
        </button>
        <button
          onClick={sifirla}
          className="px-4 py-3.5 rounded-xl text-sm font-semibold bg-[#252F42] text-[#94A3B8] border border-white/[0.07] hover:text-white transition-colors"
        >
          Sıfırla
        </button>
      </div>

      {sonuc !== null && (
        <div className="bg-[#1E2636] rounded-xl p-4 border-l-4 border-amber-500">
          <p className="text-[#94A3B8] text-xs font-semibold mb-1 uppercase tracking-wide">Mesafe</p>
          <p className="text-white text-3xl font-bold font-[var(--font-syne)]">
            {sonuc >= 1000 ? (
              <>{(sonuc / 1000).toFixed(3)} <span className="text-amber-500 text-xl">km</span></>
            ) : (
              <>{sonuc.toFixed(2)} <span className="text-amber-500 text-xl">m</span></>
            )}
          </p>
          <p className="text-[#64748B] text-xs mt-1">{(sonuc * 100).toFixed(1)} cm</p>
          <button
            onClick={kopyala}
            className="mt-2 text-xs px-3 py-1.5 rounded-lg border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-colors"
          >
            {kopyalandi ? '✓ Kopyalandı' : '📋 Kopyala'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Ana Bileşen ─────────────────────────────────────────────────────────────

const MODLAR: { id: Mod; label: string; icon: string }[] = [
  { id: 'gps',    label: 'GPS',    icon: '📍' },
  { id: 'adim',   label: 'Adım',   icon: '🚶' },
  { id: 'manuel', label: 'Manuel', icon: '✏️' },
];

export default function MesafeOlcer() {
  const [aktifMod, setAktifMod] = useState<Mod>('gps');

  return (
    <div className="min-h-screen bg-[#0E1117] px-4 py-5 pb-24">
      <Link
        href="/araclar"
        className="inline-flex items-center gap-1.5 text-[#94A3B8] text-sm mb-5 hover:text-white transition-colors"
      >
        ← Araçlar
      </Link>

      <h1 className="font-[var(--font-syne)] text-2xl font-black text-white mb-1">
        Mesafe Ölçer
      </h1>
      <p className="text-[#64748B] text-xs mb-5">GPS · Adım Sayacı · Manuel Koordinat</p>

      {/* Mod seçici */}
      <div className="bg-[#1E2636] rounded-2xl border border-white/[0.07] p-1 flex gap-1 mb-5">
        {MODLAR.map((m) => (
          <button
            key={m.id}
            onClick={() => setAktifMod(m.id)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
              aktifMod === m.id
                ? 'bg-amber-500 text-black'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            <span>{m.icon}</span>
            <span>{m.label}</span>
          </button>
        ))}
      </div>

      {/* İçerik */}
      <div className="bg-[#1E2636] rounded-2xl border border-white/[0.07] p-4">
        {aktifMod === 'gps'    && <GpsModu />}
        {aktifMod === 'adim'   && <AdimModu />}
        {aktifMod === 'manuel' && <ManuelModu />}
      </div>

      {/* Bilgi notu */}
      <div className="mt-4 bg-[#252F42]/50 rounded-xl p-3 border border-white/[0.05]">
        <p className="text-[#64748B] text-xs leading-relaxed">
          <span className="text-amber-400 font-semibold">GPS:</span> Açık alanda ±3–10 m hassasiyet.{' '}
          <span className="text-amber-400 font-semibold">Adım:</span> Tahmini, düz yolda daha doğru.{' '}
          <span className="text-amber-400 font-semibold">Manuel:</span> Haversine ile küresel mesafe.
        </p>
      </div>
    </div>
  );
}
