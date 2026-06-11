'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Arac {
  icon: string;
  title: string;
  subtitle: string;
  href: string;
  color?: string;
}

const araclar: Arac[] = [
  {
    icon: '📏',
    title: 'Birim Dönüştürücü',
    subtitle: 'Uzunluk, alan, hacim',
    href: '/araclar/birim-donusturucu',
    color: '#3B82F6',
  },
  {
    icon: '🧮',
    title: 'Hesaplayıcı',
    subtitle: 'Genel hesaplamalar',
    href: '/araclar/hesaplayici',
    color: '#8B5CF6',
  },
  {
    icon: '🏗️',
    title: 'Malzeme Tahmini',
    subtitle: 'Miktar hesaplama',
    href: '/araclar/malzeme-tahmini',
    color: '#F59E0B',
  },
  {
    icon: '🫧',
    title: 'Su Terazisi',
    subtitle: 'Eğim ölçer',
    href: '/araclar/su-terazisi',
    color: '#06B6D4',
  },
  {
    icon: '🧱',
    title: 'Beton Hesaplayıcı',
    subtitle: 'Karışım oranları',
    href: '/araclar/beton',
    color: '#6B7280',
  },
  {
    icon: '📐',
    title: 'Alan & Hacim',
    subtitle: 'Geometrik hesaplar',
    href: '/araclar/alan-hacim',
    color: '#10B981',
  },
  {
    icon: '📉',
    title: 'Eğim Hesaplayıcı',
    subtitle: 'Yüzde ve derece',
    href: '/araclar/egim',
    color: '#F97316',
  },
  {
    icon: '⚙️',
    title: 'Demir/Çelik Ağırlık',
    subtitle: 'Ağırlık hesaplama',
    href: '/araclar/demir',
    color: '#94A3B8',
  },
  {
    icon: '📷',
    title: 'QR Okuyucu',
    subtitle: 'Kamera ile tara',
    href: '/araclar/qr',
    color: '#EC4899',
  },
  {
    icon: '📍',
    title: 'Mesafe Ölçer',
    subtitle: 'GPS destekli',
    href: '/araclar/mesafe',
    color: '#EF4444',
  },
  {
    icon: '🖼️',
    title: 'Fotoğraf Notları',
    subtitle: 'Resimli notlar',
    href: '/araclar/fotograf-not',
    color: '#F59E0B',
  },
  {
    icon: '📖',
    title: 'Şantiye Rehberi',
    subtitle: 'Mevzuat & standartlar',
    href: '/araclar/rehber',
    color: '#3B82F6',
  },
];

export default function AraclarPage() {
  const [arama, setArama] = useState('');

  const filtreliAraclar = araclar.filter(
    (a) =>
      a.title.toLowerCase().includes(arama.toLowerCase()) ||
      a.subtitle.toLowerCase().includes(arama.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#0E1117] px-4 py-5">
      <div className="mb-4">
        <h1 className="text-[#F1F5F9] text-xl font-bold font-[var(--font-syne)]">Araçlar</h1>
        <p className="text-[#94A3B8] text-sm mt-0.5">Şantiye araç kutusu</p>
      </div>

      {/* Arama */}
      <div className="relative mb-5">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-4.35-4.35M17 11A6 6 0 1 0 5 11a6 6 0 0 0 12 0z"
          />
        </svg>
        <input
          type="text"
          value={arama}
          onChange={(e) => setArama(e.target.value)}
          placeholder="Araç ara..."
          className="w-full bg-[#1E2636] rounded-xl pl-9 pr-4 py-2.5 text-white text-sm border border-white/[0.07] focus:outline-none focus:border-amber-500/50 placeholder-[#4A5568]"
        />
        {arama && (
          <button
            onClick={() => setArama('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-white text-lg leading-none"
          >
            ×
          </button>
        )}
      </div>

      {filtreliAraclar.length === 0 && (
        <div className="text-center py-12">
          <p className="text-4xl mb-3">🔍</p>
          <p className="text-[#94A3B8] text-sm">
            &quot;{arama}&quot; için sonuç bulunamadı
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {filtreliAraclar.map((arac) => (
          <Link
            key={arac.href}
            href={arac.href}
            className="bg-[#1E2636] rounded-2xl p-4 border border-[rgba(255,255,255,0.07)] hover:border-[rgba(255,255,255,0.15)] transition-all active:scale-95 group"
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl mb-3"
              style={{ backgroundColor: `${arac.color ?? '#F59E0B'}20` }}
            >
              {arac.icon}
            </div>
            <p className="text-[#F1F5F9] text-sm font-semibold font-[var(--font-syne)] leading-tight group-hover:text-white">
              {arac.title}
            </p>
            <p className="text-[#94A3B8] text-xs mt-0.5 leading-tight">{arac.subtitle}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
