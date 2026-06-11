'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { DashboardSummary } from '@/types';

interface ModuleCard {
  icon: string;
  title: string;
  subtitle: string;
  href: string;
  badge?: number;
  badgeColor?: 'red' | 'amber' | 'blue' | 'green';
  borderColor?: string;
}

export default function YonetimPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDashboardSummary()
      .then(setSummary)
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  const modules: ModuleCard[] = [
    {
      icon: '📋',
      title: 'Günlük Raporlar',
      subtitle: 'Rapor oluştur & onayla',
      href: '/yonetim/raporlar',
      badge: summary?.bekleyen_rapor_sayisi,
      badgeColor: 'red',
    },
    {
      icon: '📝',
      title: 'Taslaklar',
      subtitle: 'Kayıtlı taslaklar',
      href: '/yonetim/taslaklar',
    },
    {
      icon: '🏗️',
      title: 'Projeler',
      subtitle: 'Proje yönetimi',
      href: '/yonetim/projeler',
      badge: summary?.aktif_proje_sayisi,
      badgeColor: 'blue',
    },
    {
      icon: '📦',
      title: 'Stok',
      subtitle: 'Malzeme takibi',
      href: '/yonetim/stok',
      borderColor: '#F59E0B',
    },
    {
      icon: '📁',
      title: 'Dosyalar',
      subtitle: 'Belge yönetimi',
      href: '/yonetim/dosyalar',
    },
    {
      icon: '🖼️',
      title: 'Galeri',
      subtitle: 'Fotoğraf & video',
      href: '/yonetim/galeri',
    },
    {
      icon: '📅',
      title: 'İş Planı',
      subtitle: 'Zaman çizelgesi',
      href: '/yonetim/is-plani',
    },
    {
      icon: '👷',
      title: 'Ekip',
      subtitle: 'Personel yönetimi',
      href: '/yonetim/ekip',
    },
    {
      icon: '⛑️',
      title: 'İSG',
      subtitle: 'İş güvenliği',
      href: '/yonetim/isg',
      borderColor: '#EF4444',
    },
    {
      icon: '📊',
      title: 'Puantaj',
      subtitle: 'Çalışma takibi',
      href: '/yonetim/puantaj',
    },
    {
      icon: '💰',
      title: 'Hakediş',
      subtitle: 'Ödeme takibi',
      href: '/yonetim/hakedis',
    },
    {
      icon: '🗒️',
      title: 'Toplantı Notları',
      subtitle: 'Görüşme kayıtları',
      href: '/yonetim/toplanti',
    },
  ];

  const badgeClass = {
    red: 'bg-red-500/20 text-red-400',
    amber: 'bg-[#F59E0B]/20 text-[#F59E0B]',
    blue: 'bg-blue-500/20 text-blue-400',
    green: 'bg-green-500/20 text-green-400',
  };

  return (
    <div className="min-h-screen bg-[#0E1117] px-4 py-5">
      <div className="mb-5">
        <h1 className="text-[#F1F5F9] text-xl font-bold font-[var(--font-syne)]">Yönetim</h1>
        <p className="text-[#94A3B8] text-sm mt-0.5">Tüm modüllere hızlı erişim</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {modules.map((mod) => (
          <Link
            key={mod.href}
            href={mod.href}
            className="bg-[#1E2636] rounded-2xl p-4 border transition-all active:scale-95"
            style={{
              borderColor: mod.borderColor ?? 'rgba(255,255,255,0.07)',
              boxShadow: mod.borderColor ? `0 0 0 1px ${mod.borderColor}30` : undefined,
            }}
          >
            <div className="flex items-start justify-between mb-2">
              <span className="text-2xl">{mod.icon}</span>
              {!loading && mod.badge !== undefined && mod.badge > 0 && (
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badgeClass[mod.badgeColor ?? 'amber']}`}>
                  {mod.badge}
                </span>
              )}
            </div>
            <p className="text-[#F1F5F9] text-sm font-semibold font-[var(--font-syne)] leading-tight">
              {mod.title}
            </p>
            <p className="text-[#94A3B8] text-xs mt-0.5 leading-tight">{mod.subtitle}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
