'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { SantiyeResponse, RaporResponse } from '@/types';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';

export default function DashboardPage() {
  const { loading: authLoading } = useAuth();
  const [santiyeler, setSantiyeler] = useState<SantiyeResponse[]>([]);
  const [sonRaporlar, setSonRaporlar] = useState<RaporResponse[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    const load = async () => {
      try {
        const sites = await api.getSantiyeler();
        setSantiyeler(sites);
        const raporPromises = sites.slice(0, 3).map((s) => api.getRaporlar(s.id));
        const results = await Promise.all(raporPromises);
        const all = results.flat().sort((a, b) => b.tarih.localeCompare(a.tarih));
        setSonRaporlar(all.slice(0, 5));
      } catch {
        // sessizce geç
      } finally {
        setLoadingData(false);
      }
    };
    load();
  }, [authLoading]);

  const aktifSantiye = santiyeler.filter((s) => s.aktif).length;
  const taslakRapor = sonRaporlar.filter((r) => r.durum === 'taslak').length;
  const onayliRapor = sonRaporlar.filter((r) => r.durum === 'onaylandi').length;

  const siteName = (id: string) => santiyeler.find((s) => s.id === id)?.isim ?? id.slice(0, 8);

  if (loadingData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Genel Bakış</h1>
        <p className="text-slate-500 text-sm mt-1">Şantiyelerinizin güncel durumu</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        <StatCard
          label="Aktif Şantiye"
          value={aktifSantiye}
          icon="🏗️"
          color="bg-blue-50 text-blue-600"
        />
        <StatCard
          label="Bekleyen Rapor"
          value={taslakRapor}
          icon="📋"
          color="bg-amber-50 text-amber-600"
        />
        <StatCard
          label="Onaylanan Rapor"
          value={onayliRapor}
          icon="✅"
          color="bg-emerald-50 text-emerald-600"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Şantiyeler */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Şantiyeler</CardTitle>
            <Link href="/raporlar">
              <Button variant="ghost" size="sm">Tümü →</Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {santiyeler.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">Şantiye bulunamadı</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {santiyeler.map((s) => (
                  <li key={s.id} className="flex items-center justify-between px-6 py-3.5">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{s.isim}</p>
                      <p className="text-xs text-slate-400">{s.whatsapp_numara ?? 'Numara bağlı değil'}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.aktif ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                      {s.aktif ? 'Aktif' : 'Pasif'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Son raporlar */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Son Raporlar</CardTitle>
            <Link href="/raporlar">
              <Button variant="ghost" size="sm">Tümü →</Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {sonRaporlar.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">Henüz rapor yok</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {sonRaporlar.map((r) => (
                  <li key={r.id} className="flex items-center justify-between px-6 py-3.5">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{siteName(r.santiye_id)}</p>
                      <p className="text-xs text-slate-400">{formatDate(r.tarih)}</p>
                    </div>
                    <Badge status={r.durum} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-5">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${color}`}>
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          <p className="text-sm text-slate-500">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
