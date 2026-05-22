'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { SantiyeResponse, RaporResponse } from '@/types';
import { formatDate } from '@/lib/utils';

export default function RaporlarPage() {
  const { loading: authLoading } = useAuth();
  const [santiyeler, setSantiyeler] = useState<SantiyeResponse[]>([]);
  const [secilenSantiye, setSecilenSantiye] = useState('');
  const [raporlar, setRaporlar] = useState<RaporResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    api.getSantiyeler().then((s) => {
      setSantiyeler(s);
      if (s.length > 0) setSecilenSantiye(s[0].id);
    });
  }, [authLoading]);

  useEffect(() => {
    if (!secilenSantiye) return;
    setLoading(true);
    api.getRaporlar(secilenSantiye)
      .then(setRaporlar)
      .finally(() => setLoading(false));
  }, [secilenSantiye]);

  const handleApprove = async (raporId: string) => {
    setApproving(raporId);
    try {
      const updated = await api.approveRapor(raporId);
      setRaporlar((prev) => prev.map((r) => (r.id === raporId ? updated : r)));
    } finally {
      setApproving(null);
    }
  };

  const handleDownload = (raporId: string) => {
    const token = localStorage.getItem('access_token');
    const url = `http://localhost:8000/api/v1/reports/${raporId}/download`;
    const a = document.createElement('a');
    a.href = url;
    // Bearer token için fetch ile indir
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `rapor_${raporId.slice(0, 8)}.xlsx`;
        link.click();
      });
    void a;
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Raporlar</h1>
        <p className="text-slate-500 text-sm mt-1">Şantiye günlük faaliyet raporları</p>
      </div>

      {/* Şantiye seçimi */}
      <div className="mb-6">
        <div className="flex gap-2 flex-wrap">
          {santiyeler.map((s) => (
            <button
              key={s.id}
              onClick={() => setSecilenSantiye(s.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                secilenSantiye === s.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {s.isim}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {santiyeler.find((s) => s.id === secilenSantiye)?.isim ?? 'Raporlar'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-6 h-6 border-4 border-orange-500 border-t-transparent rounded-full" />
            </div>
          ) : raporlar.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-12">Bu şantiyeye ait rapor yok</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Tarih</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Durum</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Dosya</th>
                    <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {raporlar.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900">{formatDate(r.tarih)}</td>
                      <td className="px-6 py-4"><Badge status={r.durum} /></td>
                      <td className="px-6 py-4 text-slate-400 text-xs">
                        {r.cikti_dosya_yolu
                          ? r.cikti_dosya_yolu.split('\\').pop()
                          : '—'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2 justify-end">
                          {r.cikti_dosya_yolu && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleDownload(r.id)}
                            >
                              ⬇ İndir
                            </Button>
                          )}
                          {r.durum === 'taslak' && (
                            <Button
                              variant="primary"
                              size="sm"
                              loading={approving === r.id}
                              onClick={() => handleApprove(r.id)}
                            >
                              Onayla
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
