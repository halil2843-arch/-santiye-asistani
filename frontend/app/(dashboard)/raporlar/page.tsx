'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { SantiyeResponse, RaporResponse, PreviewResponse } from '@/types';
import { formatDate } from '@/lib/utils';

export default function RaporlarPage() {
  const { loading: authLoading } = useAuth();
  const [santiyeler, setSantiyeler] = useState<SantiyeResponse[]>([]);
  const [secilenSantiye, setSecilenSantiye] = useState('');
  const [raporlar, setRaporlar] = useState<RaporResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState<string | null>(null);

  // Önizleme
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
  const [activeSheet, setActiveSheet] = useState(0);

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
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `rapor_${raporId.slice(0, 8)}.xlsx`;
        link.click();
      });
  };

  const handlePreview = async (raporId: string) => {
    setPreviewLoading(raporId);
    try {
      const data = await api.previewRapor(raporId);
      setPreview(data);
      setActiveSheet(0);
    } finally {
      setPreviewLoading(null);
    }
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
                            <>
                              <Button
                                variant="secondary"
                                size="sm"
                                loading={previewLoading === r.id}
                                onClick={() => handlePreview(r.id)}
                              >
                                🔍 Önizle
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleDownload(r.id)}
                              >
                                ⬇ İndir
                              </Button>
                            </>
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

      {/* Önizleme Modal */}
      {preview && (
        <PreviewModal
          preview={preview}
          activeSheet={activeSheet}
          onSheetChange={setActiveSheet}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}

function PreviewModal({
  preview,
  activeSheet,
  onSheetChange,
  onClose,
}: {
  preview: PreviewResponse;
  activeSheet: number;
  onSheetChange: (i: number) => void;
  onClose: () => void;
}) {
  const sayfa = preview.sayfalar[activeSheet];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-[95vw] max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Rapor Önizleme</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-xl font-bold leading-none"
          >
            ×
          </button>
        </div>

        {/* Sekme seçici */}
        {preview.sayfalar.length > 1 && (
          <div className="flex gap-1 px-6 pt-3 border-b border-slate-200">
            {preview.sayfalar.map((s, i) => (
              <button
                key={i}
                onClick={() => onSheetChange(i)}
                className={`px-4 py-2 text-sm rounded-t-lg font-medium transition-colors ${
                  activeSheet === i
                    ? 'bg-orange-500 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {s.isim}
              </button>
            ))}
          </div>
        )}

        {/* Tablo */}
        <div className="flex-1 overflow-auto p-4">
          {sayfa ? (
            <table className="border-collapse text-xs font-mono">
              <tbody>
                {sayfa.satirlar.map((satir, ri) => (
                  <tr key={ri}>
                    {satir.map((hucre, ci) => (
                      <td
                        key={ci}
                        style={{
                          minWidth: sayfa.sutun_genislikleri[ci]
                            ? `${Math.min(Math.max(sayfa.sutun_genislikleri[ci] * 7, 60), 300)}px`
                            : '80px',
                          textAlign: hucre.hizalama === 'center' ? 'center' : hucre.hizalama === 'right' ? 'right' : 'left',
                        }}
                        className={`border border-slate-200 px-2 py-1 whitespace-pre-wrap break-words align-top ${
                          hucre.kalin ? 'font-bold bg-slate-50' : ''
                        } ${hucre.deger === null ? 'text-slate-300' : 'text-slate-800'}`}
                      >
                        {hucre.deger ?? ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-slate-400 text-sm text-center py-8">Veri yok</p>
          )}
        </div>
      </div>
    </div>
  );
}
