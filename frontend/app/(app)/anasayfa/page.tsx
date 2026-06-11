'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { WeatherResponse, DashboardSummary } from '@/types';

const VAPID_KEY_URL = 'http://localhost:8000/api/v1/bildirim/vapid-public-key';
const SUBSCRIBE_URL = 'http://localhost:8000/api/v1/bildirim/subscribe';

const SHORTCUTS = [
  { label: 'Günlük Rapor', icon: '📋', href: '/yonetim/raporlar' },
  { label: 'Hesaplayıcı', icon: '🧮', href: '/araclar/hesaplayici' },
  { label: 'Fotoğraf', icon: '📷', href: '/araclar/fotograf-not' },
  { label: 'Stok', icon: '📦', href: '/yonetim/stok' },
  { label: 'Ekip', icon: '👷', href: '/yonetim/ekip' },
  { label: 'İş Planı', icon: '📅', href: '/yonetim/is-plani' },
  { label: 'Ölçüm', icon: '📐', href: '/araclar/alan-hacim' },
  { label: 'Ekle', icon: '+', href: '#' },
];

function WeatherIcon({ durum }: { durum: string }) {
  const d = durum.toLowerCase();
  if (d.includes('güneş') || d.includes('açık') || d.includes('clear')) return <span className="text-4xl">☀️</span>;
  if (d.includes('bulut') || d.includes('cloud')) return <span className="text-4xl">⛅</span>;
  if (d.includes('yağmur') || d.includes('rain')) return <span className="text-4xl">🌧️</span>;
  if (d.includes('kar') || d.includes('snow')) return <span className="text-4xl">❄️</span>;
  if (d.includes('fırtına') || d.includes('storm')) return <span className="text-4xl">⛈️</span>;
  return <span className="text-4xl">🌤️</span>;
}

function SkeletonCard() {
  return (
    <div className="bg-[#1E2636] rounded-2xl p-4 animate-pulse">
      <div className="h-4 bg-[#2A3447] rounded w-1/3 mb-3"></div>
      <div className="h-8 bg-[#2A3447] rounded w-1/2 mb-2"></div>
      <div className="h-3 bg-[#2A3447] rounded w-2/3"></div>
    </div>
  );
}

export default function AnasayfaPage() {
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setError] = useState<string | null>(null);
  const [gpsKonum, setGpsKonum] = useState<{ lat: number; lon: number } | null>(null);
  const [notifDurum, setNotifDurum] = useState<NotificationPermission>('default');

  useEffect(() => {
    if ('Notification' in window) {
      setNotifDurum(Notification.permission);
    }
  }, []);

  const bildirimIzniIste = async () => {
    if (!('Notification' in window)) return;
    const izin = await Notification.requestPermission();
    setNotifDurum(izin);
    if (izin === 'granted') {
      try {
        const reg = await navigator.serviceWorker.ready;
        const token = localStorage.getItem('access_token');
        const res = await fetch(VAPID_KEY_URL, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const { public_key } = await res.json() as { public_key: string };
          const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: public_key,
          });
          await fetch(SUBSCRIBE_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(sub.toJSON()),
          });
        }
      } catch {
        /* VAPID yapılandırılmamış olabilir — sessizce devam et */
      }
    }
  };

  // Hava durumu: önce GPS dene, yoksa İstanbul/Kadıköy fallback
  useEffect(() => {
    async function fetchWeather() {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const { latitude, longitude } = pos.coords;
            setGpsKonum({ lat: latitude, lon: longitude });
            try {
              // Backend il/ilçe beklediğinden GPS koordinatlarını "lat,lon" olarak gönder
              // Backend GPS desteği yoksa fallback görünümü göster
              const w = await api.getWeather('', '', latitude, longitude).catch(() => null);
              if (w) {
                setWeather(w);
              } else {
                api.getWeather('istanbul', 'kadikoy').then(setWeather).catch(() => {});
              }
            } catch {
              api.getWeather('istanbul', 'kadikoy').then(setWeather).catch(() => {});
            } finally {
              setLoading(false);
            }
          },
          async () => {
            // GPS izni reddedildi — fallback
            try {
              const w = await api.getWeather('istanbul', 'kadikoy');
              setWeather(w);
            } catch {
              // sessiz
            } finally {
              setLoading(false);
            }
          },
          { timeout: 8000, maximumAge: 300000 }
        );
      } else {
        // Geolocation API mevcut değil
        api.getWeather('istanbul', 'kadikoy').then(setWeather).catch(() => {}).finally(() => setLoading(false));
      }
    }

    async function fetchSummary() {
      try {
        const s = await api.getDashboardSummary();
        setSummary(s);
      } catch {
        // sessiz
      }
    }

    fetchWeather();
    fetchSummary();
  }, []);

  const notifications = [];
  if (summary) {
    if (summary.bekleyen_rapor_sayisi > 0) {
      notifications.push({
        id: 'rapor',
        type: 'danger' as const,
        title: `${summary.bekleyen_rapor_sayisi} rapor onay bekliyor`,
        time: 'Şimdi',
        icon: '📋',
      });
    }
    if (summary.okunmamis_mesaj_sayisi > 0) {
      notifications.push({
        id: 'mesaj',
        type: 'info' as const,
        title: `${summary.okunmamis_mesaj_sayisi} yeni mesaj`,
        time: 'Az önce',
        icon: '💬',
      });
    }
  }

  return (
    <div className="min-h-screen bg-[#0E1117] px-4 py-5 space-y-5">

      {/* Hero: Hava Durumu Kartı */}
      {loading ? (
        <SkeletonCard />
      ) : (
        <div
          className="rounded-2xl p-5 border border-[#F59E0B]/30 overflow-hidden relative"
          style={{ background: 'linear-gradient(135deg, #1A2540 0%, #111827 100%)' }}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <svg className="w-3.5 h-3.5 text-[#94A3B8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-[#94A3B8] text-xs">
                  {gpsKonum
                    ? weather
                      ? `${weather.il}, ${weather.ilce}`
                      : `${gpsKonum.lat.toFixed(4)}, ${gpsKonum.lon.toFixed(4)}`
                    : weather
                    ? `${weather.il}, ${weather.ilce}`
                    : 'İstanbul, Kadıköy'}
                </span>
              </div>
              <p className="text-[#F1F5F9] text-4xl font-bold font-[var(--font-syne)] leading-none">
                {weather ? `${weather.sicaklik}°C` : '--°C'}
              </p>
              <p className="text-[#94A3B8] text-sm mt-1">
                {weather?.durum ?? 'Veri yok'}
              </p>
            </div>
            <div>
              <WeatherIcon durum={weather?.durum ?? ''} />
            </div>
          </div>

          {weather && (
            <div className="flex gap-4 mt-4 pt-4 border-t border-[rgba(255,255,255,0.08)]">
              <div className="flex items-center gap-1.5">
                <span className="text-[#94A3B8] text-xs">💧</span>
                <span className="text-[#F1F5F9] text-xs font-medium">%{weather.nem} Nem</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[#94A3B8] text-xs">💨</span>
                <span className="text-[#F1F5F9] text-xs font-medium">{weather.ruzgar} km/h Rüzgar</span>
              </div>
            </div>
          )}

          {/* Dekoratif amber çizgi */}
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#F59E0B]/0 via-[#F59E0B]/60 to-[#F59E0B]/0" />
        </div>
      )}

      {/* Push Bildirim Banner */}
      {notifDurum === 'default' && (
        <div style={{
          margin: '0 0',
          background: 'rgba(245,158,11,0.1)',
          border: '1px solid rgba(245,158,11,0.25)',
          borderRadius: '14px',
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}>
          <span style={{ fontSize: '20px' }}>🔔</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#F1F5F9' }}>
              Bildirimleri Etkinleştir
            </div>
            <div style={{ fontSize: '11px', color: '#64748B' }}>
              Rapor hatırlatıcıları ve stok uyarıları alın
            </div>
          </div>
          <button
            onClick={bildirimIzniIste}
            style={{
              background: '#F59E0B',
              color: '#000',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Etkinleştir
          </button>
        </div>
      )}

      {/* Bugünün Toplamı */}
      {loading ? (
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#1E2636] rounded-xl p-3 border border-[rgba(255,255,255,0.07)] text-center">
            <p className="text-[#F59E0B] text-xl font-bold font-[var(--font-syne)]">
              {summary?.toplam_personel ?? 0}
            </p>
            <p className="text-[#94A3B8] text-[10px] mt-0.5 leading-tight">İşçi</p>
          </div>
          <div className="bg-[#1E2636] rounded-xl p-3 border border-[rgba(255,255,255,0.07)] text-center">
            <p className="text-[#F59E0B] text-xl font-bold font-[var(--font-syne)]">
              {summary?.aktif_proje_sayisi ?? 0}
            </p>
            <p className="text-[#94A3B8] text-[10px] mt-0.5 leading-tight">Proje</p>
          </div>
          <div className="bg-[#1E2636] rounded-xl p-3 border border-[rgba(255,255,255,0.07)] text-center">
            <p className={`text-xl font-bold font-[var(--font-syne)] ${(summary?.bekleyen_rapor_sayisi ?? 0) > 0 ? 'text-red-400' : 'text-[#F59E0B]'}`}>
              {summary?.bekleyen_rapor_sayisi ?? 0}
            </p>
            <p className="text-[#94A3B8] text-[10px] mt-0.5 leading-tight">Bekleyen</p>
          </div>
        </div>
      )}

      {/* Bildirimler */}
      {notifications.length > 0 && (
        <div>
          <h2 className="text-[#F1F5F9] text-sm font-semibold font-[var(--font-syne)] mb-3">Bildirimler</h2>
          <div className="space-y-2">
            {notifications.map((n) => (
              <div
                key={n.id}
                className="bg-[#1E2636] rounded-xl border border-[rgba(255,255,255,0.07)] flex items-center overflow-hidden"
              >
                <div
                  className={`w-1 self-stretch ${
                    n.type === 'danger' ? 'bg-red-500' :
                    n.type === 'info' ? 'bg-blue-500' :
                    'bg-[#F59E0B]'
                  }`}
                />
                <div className="flex-1 flex items-center gap-3 p-3">
                  <span className="text-lg">{n.icon}</span>
                  <div className="flex-1">
                    <p className="text-[#F1F5F9] text-sm font-medium">{n.title}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      n.type === 'danger' ? 'bg-red-500/20 text-red-400' :
                      n.type === 'info' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-[#F59E0B]/20 text-[#F59E0B]'
                    }`}>
                      {n.time}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sık Kullanılanlar */}
      <div>
        <h2 className="text-[#F1F5F9] text-sm font-semibold font-[var(--font-syne)] mb-3">Sık Kullanılanlar</h2>
        <div className="grid grid-cols-4 gap-3">
          {SHORTCUTS.map((s) => (
            <Link
              key={s.label}
              href={s.href}
              className="flex flex-col items-center gap-2 group"
            >
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl transition-colors ${
                s.icon === '+'
                  ? 'bg-[#1E2636] border-2 border-dashed border-[rgba(255,255,255,0.15)] text-[#94A3B8] group-hover:border-[#F59E0B] group-hover:text-[#F59E0B]'
                  : 'bg-[#1E2636] border border-[rgba(255,255,255,0.07)] group-hover:border-[#F59E0B]/40'
              }`}>
                {s.icon === '+' ? (
                  <span className="text-2xl font-light">+</span>
                ) : (
                  <span>{s.icon}</span>
                )}
              </div>
              <span className="text-[#94A3B8] text-[10px] text-center leading-tight group-hover:text-[#F1F5F9] transition-colors">
                {s.label}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* FAB: Rapor Ekle */}
      <div className="fixed bottom-[84px] right-4 z-40">
        <Link
          href="/yonetim/raporlar"
          className="w-14 h-14 bg-[#F59E0B] rounded-full flex items-center justify-center shadow-lg shadow-[#F59E0B]/30 hover:bg-[#D97706] transition-colors"
          aria-label="Rapor Ekle"
        >
          <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
        </Link>
        <p className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[#94A3B8] text-[9px] whitespace-nowrap">Rapor Ekle</p>
      </div>

      {/* Alt boşluk */}
      <div className="h-6" />
    </div>
  );
}
