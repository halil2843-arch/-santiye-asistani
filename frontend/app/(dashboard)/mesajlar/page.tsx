'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { SantiyeResponse, WhatsappMesaji } from '@/types';
import { formatDateTime } from '@/lib/utils';

const BASE = 'http://localhost:8000';

function getToken() {
  return typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
}

async function getMesajlar(santiye_id: string): Promise<WhatsappMesaji[]> {
  const res = await fetch(`${BASE}/api/v1/webhook/messages/${santiye_id}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) return [];
  return res.json();
}

export default function MesajlarPage() {
  const { loading: authLoading } = useAuth();
  const [santiyeler, setSantiyeler] = useState<SantiyeResponse[]>([]);
  const [secilenSantiye, setSecilenSantiye] = useState('');
  const [mesajlar, setMesajlar] = useState<WhatsappMesaji[]>([]);
  const [loading, setLoading] = useState(false);

  const loadSantiyeler = useCallback(async () => {
    const token = getToken();
    const res = await fetch(`${BASE}/api/v1/sites/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const sites: SantiyeResponse[] = await res.json();
    setSantiyeler(sites);
    if (sites.length > 0) setSecilenSantiye(sites[0].id);
  }, []);

  useEffect(() => {
    if (!authLoading) loadSantiyeler();
  }, [authLoading, loadSantiyeler]);

  useEffect(() => {
    if (!secilenSantiye) return;
    setLoading(true);
    getMesajlar(secilenSantiye)
      .then(setMesajlar)
      .finally(() => setLoading(false));
  }, [secilenSantiye]);

  const refresh = () => {
    if (!secilenSantiye) return;
    setLoading(true);
    getMesajlar(secilenSantiye)
      .then(setMesajlar)
      .finally(() => setLoading(false));
  };

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">WhatsApp Mesajları</h1>
          <p className="text-slate-500 text-sm mt-1">Şantiyelerden gelen mesajlar</p>
        </div>
        <Button variant="secondary" size="sm" onClick={refresh}>
          ↻ Yenile
        </Button>
      </div>

      {/* Şantiye tabs */}
      <div className="mb-6 flex gap-2 flex-wrap">
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

      <Card>
        <CardHeader>
          <CardTitle>Mesajlar</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-6 h-6 border-4 border-orange-500 border-t-transparent rounded-full" />
            </div>
          ) : mesajlar.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-12">Henüz mesaj yok</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {mesajlar.map((m) => (
                <li key={m.id} className="px-6 py-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                          {m.gonderen_no}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          m.islendi
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {m.islendi ? 'İşlendi' : 'Bekliyor'}
                        </span>
                        {m.rapor_id && (
                          <span className="text-xs text-blue-600">📋 Rapora bağlı</span>
                        )}
                      </div>
                      <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap break-words">
                        {m.icerik ?? <span className="text-slate-400 italic">Medya mesajı</span>}
                      </p>
                      {m.medya_url && (
                        <p className="text-xs text-slate-400 mt-1">📎 Medya eki var</p>
                      )}
                    </div>
                    <span className="text-xs text-slate-400 whitespace-nowrap">
                      {formatDateTime(m.created_at)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
