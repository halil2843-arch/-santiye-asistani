'use client';

import { usePathname, useRouter } from 'next/navigation';
import { BottomTabBar } from '@/components/layout/BottomTabBar';
import { Sidebar } from '@/components/layout/Sidebar';
import Link from 'next/link';
import { tokenStore } from '@/lib/auth';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    const token = tokenStore.getAccess();
    if (token) {
      fetch('http://localhost:8000/api/v1/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
    tokenStore.clear();
    router.replace('/login');
  };

  return (
    <>
      {/* Masaüstü: Sidebar layout (lg ve üzeri) */}
      <div className="hidden lg:flex min-h-screen bg-[#0E1117]">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>

      {/* Mobil: Bottom tab bar layout */}
      <div className="flex flex-col min-h-screen bg-[#0E1117] lg:hidden">
        {/* Top Header */}
        <header className="sticky top-0 z-40 bg-[#161B26] border-b border-[rgba(255,255,255,0.07)] px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-[#F59E0B] rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <p className="text-[#F1F5F9] font-bold text-sm leading-tight font-[var(--font-syne)]">Şantiye</p>
                <p className="text-[#F59E0B] font-bold text-xs leading-tight font-[var(--font-syne)]">Asistanı</p>
              </div>
            </div>

            {/* Sağ ikonlar */}
            <div className="flex items-center gap-1">
              <Link href="/anasayfa" className="relative p-2 text-[#94A3B8] hover:text-[#F1F5F9] transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {/* Bildirim badge */}
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
              </Link>
              {/* Logout butonu */}
              <button
                onClick={handleLogout}
                className="p-2 text-[#94A3B8] hover:text-red-400 transition-colors"
                aria-label="Çıkış Yap"
                title="Çıkış Yap"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        {/* İçerik Alanı */}
        <main className="flex-1 overflow-auto pb-[68px]">
          {children}
        </main>

        {/* Bottom Tab Bar */}
        <BottomTabBar activeTab={pathname} />
      </div>
    </>
  );
}
