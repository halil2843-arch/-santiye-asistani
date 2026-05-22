'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { SablonResponse, SantiyeResponse } from '@/types';
import { formatDate } from '@/lib/utils';

export default function SablonlarPage() {
  const { loading: authLoading, musteriId } = useAuth();
  const [sablonlar, setSablonlar] = useState<SablonResponse[]>([]);
  const [santiyeler, setSantiyeler] = useState<SantiyeResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [isim, setIsim] = useState('');
  const [santiyeId, setSantiyeId] = useState('');
  const [dosya, setDosya] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [sabs, sites] = await Promise.all([api.getSablonlar(), api.getSantiyeler()]);
      setSablonlar(sabs);
      setSantiyeler(sites);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dosya || !isim || !musteriId) return;
    setError('');
    setSuccess('');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('isim', isim);
      fd.append('dosya', dosya);
      if (santiyeId) fd.append('santiye_id', santiyeId);
      await api.uploadSablon(fd);
      setSuccess('Şablon başarıyla yüklendi');
      setIsim('');
      setSantiyeId('');
      setDosya(null);
      if (fileRef.current) fileRef.current.value = '';
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yükleme hatası');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu şablonu silmek istediğinize emin misiniz?')) return;
    setDeleting(id);
    try {
      await api.deleteSablon(id);
      setSablonlar((prev) => prev.filter((s) => s.id !== id));
    } finally {
      setDeleting(null);
    }
  };

  const siteName = (id: string | null) =>
    id ? santiyeler.find((s) => s.id === id)?.isim ?? id.slice(0, 8) : '—';

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Şablonlar</h1>
        <p className="text-slate-500 text-sm mt-1">Excel ve Word rapor şablonlarınızı yönetin</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload form */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Yeni Şablon Yükle</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Şablon Adı</label>
                <input
                  type="text"
                  value={isim}
                  onChange={(e) => setIsim(e.target.value)}
                  required
                  placeholder="Günlük Rapor Şablonu"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Şantiye (opsiyonel)</label>
                <select
                  value={santiyeId}
                  onChange={(e) => setSantiyeId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
                >
                  <option value="">Tüm şantiyeler</option>
                  {santiyeler.map((s) => (
                    <option key={s.id} value={s.id}>{s.isim}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Dosya (.xlsx / .docx)</label>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.docx"
                  required
                  onChange={(e) => setDosya(e.target.files?.[0] ?? null)}
                  className="w-full text-sm text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{error}</div>
              )}
              {success && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm text-emerald-700">{success}</div>
              )}

              <Button type="submit" loading={uploading} className="w-full">
                Yükle
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Şablon listesi */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Mevcut Şablonlar</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin w-6 h-6 border-4 border-orange-500 border-t-transparent rounded-full" />
              </div>
            ) : sablonlar.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-12">Henüz şablon yüklenmemiş</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Şablon</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Format</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Şantiye</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Alanlar</th>
                      <th className="text-right px-6 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sablonlar.map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-medium text-slate-900">{s.isim}</p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            s.format === 'xlsx'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {s.format.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-500 text-xs">{siteName(s.santiye_id)}</td>
                        <td className="px-6 py-4 text-slate-500 text-xs">
                          {Object.keys(s.alan_esleme).length} alan
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button
                            variant="danger"
                            size="sm"
                            loading={deleting === s.id}
                            onClick={() => handleDelete(s.id)}
                          >
                            Sil
                          </Button>
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
    </div>
  );
}
