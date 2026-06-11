'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

const MAX_OFFSET = 60; // px — kabarcık hareket alanı yarıçapı

export default function SuTerazisi() {
  const [beta, setBeta] = useState<number | null>(null);
  const [gamma, setGamma] = useState<number | null>(null);
  const [aktif, setAktif] = useState(false);
  const [izinHata, setIzinHata] = useState<string | null>(null);
  const [desteklenmiyor, setDesteklenmiyor] = useState(false);
  const [ekreanKilit, setEkranKilit] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    if (event.beta !== null) setBeta(event.beta);
    if (event.gamma !== null) setGamma(event.gamma);
  }, []);

  // Ekran kilidi aç/kapat
  const toggleEkranKilit = async () => {
    if (!('wakeLock' in navigator)) return;
    if (wakeLockRef.current) {
      await wakeLockRef.current.release();
      wakeLockRef.current = null;
      setEkranKilit(false);
    } else {
      try {
        wakeLockRef.current = await (navigator as Navigator & { wakeLock: { request: (type: string) => Promise<WakeLockSentinel> } }).wakeLock.request('screen');
        setEkranKilit(true);
        wakeLockRef.current.addEventListener('release', () => {
          wakeLockRef.current = null;
          setEkranKilit(false);
        });
      } catch {
        // desteklenmiyor veya izin yok
      }
    }
  };

  const baslat = async () => {
    setIzinHata(null);
    try {
      // iOS 13+ için DeviceOrientationEvent.requestPermission
      if (
        typeof DeviceOrientationEvent !== 'undefined' &&
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        typeof (DeviceOrientationEvent as any).requestPermission === 'function'
      ) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const perm = await (DeviceOrientationEvent as any).requestPermission();
        if (perm !== 'granted') {
          setIzinHata('Sensör izni reddedildi. Tarayıcı ayarlarından izin verin.');
          return;
        }
      }
      if (!window.DeviceOrientationEvent) {
        setDesteklenmiyor(true);
        return;
      }
      window.addEventListener('deviceorientation', handleOrientation, true);
      setAktif(true);
    } catch {
      setIzinHata('Sensöre erişilemedi.');
    }
  };

  const durdur = () => {
    window.removeEventListener('deviceorientation', handleOrientation, true);
    setAktif(false);
    setBeta(null);
    setGamma(null);
  };

  useEffect(() => {
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
      }
    };
  }, [handleOrientation]);

  // Kabarcık pozisyonu hesapla
  // Telefon dikey tutulduğunda beta ~90, gamma ~0
  const bubbleX = gamma !== null
    ? Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, gamma * 2))
    : 0;
  const bubbleY = beta !== null
    ? Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, (beta - 90) * 2))
    : 0;

  // ±2° toleransta düzgün
  const duzgun = aktif &&
    beta !== null && gamma !== null &&
    Math.abs(beta - 90) <= 2 && Math.abs(gamma) <= 2;

  const formatDerece = (v: number | null) =>
    v !== null ? `${v.toFixed(1)}°` : '—';

  const wakeLockDestekli = typeof window !== 'undefined' && 'wakeLock' in navigator;

  return (
    <div className="min-h-screen bg-[#0E1117] px-4 py-5">
      <Link
        href="/araclar"
        className="inline-flex items-center gap-1.5 text-[#94A3B8] text-sm mb-5 hover:text-white transition-colors"
      >
        ← Araçlar
      </Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="font-[var(--font-syne)] text-2xl font-black text-white">
          Su Terazisi
        </h1>
        {/* Ekranı Koru toggle */}
        {wakeLockDestekli && (
          <button
            onClick={toggleEkranKilit}
            className={`flex items-center gap-2 text-xs px-3 py-2 rounded-xl border transition-colors ${
              ekreanKilit
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                : 'bg-[#1E2636] border-white/[0.07] text-[#94A3B8] hover:text-white'
            }`}
          >
            <span>{ekreanKilit ? '🔒' : '🔓'}</span>
            <span>Ekranı Koru</span>
          </button>
        )}
      </div>

      {desteklenmiyor ? (
        <div className="bg-[#1E2636] rounded-2xl border border-white/[0.07] p-8 text-center">
          <p className="text-4xl mb-3">📱</p>
          <p className="text-[#94A3B8] text-sm">
            Bu cihazda jiroskop sensörü bulunamadı veya tarayıcı erişimine kapalı.
          </p>
        </div>
      ) : (
        <>
          {/* Kabarcık görselleştirme */}
          <div className="flex flex-col items-center mb-6">
            <div
              className="relative rounded-full border-4 flex items-center justify-center"
              style={{
                width: 280,
                height: 280,
                borderColor: duzgun ? '#22C55E' : aktif ? '#F59E0B' : '#2A3447',
                backgroundColor: '#1E2636',
                boxShadow: duzgun
                  ? '0 0 40px rgba(34,197,94,0.15)'
                  : aktif
                  ? '0 0 30px rgba(245,158,11,0.1)'
                  : 'none',
                transition: 'border-color 0.3s, box-shadow 0.3s',
              }}
            >
              {/* Çapraz kılavuz çizgiler */}
              <div className="absolute w-px h-full bg-white/[0.06]" />
              <div className="absolute h-px w-full bg-white/[0.06]" />

              {/* Dış çember halkası */}
              <div
                className="absolute rounded-full border"
                style={{
                  width: 200,
                  height: 200,
                  borderColor: 'rgba(255,255,255,0.05)',
                }}
              />

              {/* Orta hedef nokta */}
              <div
                className="absolute w-10 h-10 rounded-full border-2"
                style={{
                  borderColor: duzgun ? 'rgba(34,197,94,0.4)' : 'rgba(245,158,11,0.2)',
                }}
              />
              <div
                className="absolute w-2 h-2 rounded-full"
                style={{
                  backgroundColor: duzgun ? 'rgba(34,197,94,0.5)' : 'rgba(245,158,11,0.3)',
                }}
              />

              {/* Kabarcık */}
              {aktif ? (
                <div
                  className="absolute rounded-full transition-transform"
                  style={{
                    width: 44,
                    height: 44,
                    backgroundColor: duzgun ? '#22C55E' : '#F59E0B',
                    transform: `translate(${bubbleX}px, ${bubbleY}px)`,
                    opacity: 0.92,
                    boxShadow: duzgun
                      ? '0 0 20px rgba(34,197,94,0.7)'
                      : '0 0 14px rgba(245,158,11,0.6)',
                    transitionDuration: '80ms',
                    transitionProperty: 'transform',
                  }}
                />
              ) : (
                <p className="text-[#4A5568] text-xs text-center px-6">
                  Başlat butonuna basın
                </p>
              )}
            </div>

            {/* Durum etiketi */}
            <div className="mt-5 h-9 flex items-center justify-center">
              {aktif && (
                <div
                  className="px-8 py-2 rounded-full text-sm font-bold tracking-wide transition-all"
                  style={{
                    backgroundColor: duzgun ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
                    color: duzgun ? '#22C55E' : '#F59E0B',
                    border: `1px solid ${duzgun ? 'rgba(34,197,94,0.4)' : 'rgba(245,158,11,0.4)'}`,
                  }}
                >
                  {duzgun ? '✓ DÜZGÜN' : 'EĞİK'}
                </div>
              )}
            </div>
          </div>

          {/* Açı değerleri */}
          {aktif && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-[#1E2636] rounded-xl p-4 border border-white/[0.07] text-center">
                <p className="text-[#94A3B8] text-xs mb-1.5 font-medium">Sol / Sağ</p>
                <p className="text-white text-2xl font-bold font-[var(--font-syne)]">
                  {formatDerece(gamma)}
                </p>
                <p className="text-[#4A5568] text-[10px] mt-0.5">gamma</p>
              </div>
              <div className="bg-[#1E2636] rounded-xl p-4 border border-white/[0.07] text-center">
                <p className="text-[#94A3B8] text-xs mb-1.5 font-medium">İleri / Geri</p>
                <p className="text-white text-2xl font-bold font-[var(--font-syne)]">
                  {formatDerece(beta !== null ? beta - 90 : null)}
                </p>
                <p className="text-[#4A5568] text-[10px] mt-0.5">beta (−90°)</p>
              </div>
            </div>
          )}

          {/* Hata banner */}
          {izinHata && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4">
              <p className="text-red-400 text-sm">{izinHata}</p>
            </div>
          )}

          {/* Başlat / Durdur */}
          <button
            onClick={aktif ? durdur : baslat}
            className={`w-full rounded-xl px-6 py-3.5 font-semibold text-sm transition-all active:scale-[0.98] ${
              aktif
                ? 'bg-[#252F42] text-[#94A3B8] border border-white/[0.07] hover:bg-[#2A3447]'
                : 'bg-amber-500 text-black hover:bg-amber-400'
            }`}
          >
            {aktif ? 'Durdur' : 'Başlat'}
          </button>

          <p className="text-[#4A5568] text-xs text-center mt-3 leading-relaxed">
            Telefonu dikey tutun. ±2° toleransta yeşil gösterir.
          </p>
        </>
      )}
    </div>
  );
}
