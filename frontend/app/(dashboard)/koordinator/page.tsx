'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Koordinator {
  id: string;
  musteri_id: string;
  whatsapp_numara: string;
  aciklama: string | null;
  aktif: boolean;
}

export default function KoordinatorPage() {
  const { loading: authLoading } = useAuth();
  const [liste, setListe] = useState<Koordinator[]>([]);
  const [loading, setLoading] = useState(true);
  const [numara, setNumara] = useState('');
  const [aciklama, setAciklama] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getKoordinatorler();
      setListe(data as Koordinator[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.createKoordinatör(numara.trim(), aciklama.trim() || undefined);
      setNumara('');
      setAciklama('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kayıt hatası');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await api.deleteKoordinatör(id);
      setListe((prev) => prev.filter((k) => k.id !== id));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Koordinatör Numaraları</h1>
        <p className="text-slate-500 text-sm mt-1">
          Bu numaralardan gelen mesajlar otomatik olarak ilgili şantiyeye yönlendirilir
        </p>
      </div>

      {/* Akış açıklaması */}
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-blue-900 mb-2">Nasıl çalışır?</h2>
        <div className="flex flex-col sm:flex-row gap-2 text-sm text-blue-800">
          {[
            '1. Koordinatör WhatsApp grubuna tüm şantiyelerin raporunu yazar',
            '2. Twilio numarasına mesaj iletilir',
            '3. Yapay zeka mesajı okur, hangi bölüm hangi şantiyeye ait belirler',
            '4. Her şantiye kendi raporunu alır',
          ].map((s) => (
            <div key={s} className="flex-1 bg-white/60 rounded-lg px-3 py-2 text-xs leading-relaxed">
              {s}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <Card className="lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle>Koordinatör Ekle</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  WhatsApp Numarası
                </label>
                <input
                  type="text"
                  value={numara}
                  onChange={(e) => setNumara(e.target.value)}
                  required
                  placeholder="+905551234567"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
                <p className="text-xs text-slate-400 mt-1">E.164 format: +90 ile başlamalı</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Açıklama <span className="text-slate-400 font-normal">(opsiyonel)</span>
                </label>
                <input
                  type="text"
                  value={aciklama}
                  onChange={(e) => setAciklama(e.target.value)}
                  placeholder="Saha koordinatörü — Ahmet Bey"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              )}
              <Button type="submit" loading={saving} className="w-full">
                Ekle
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Liste */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Kayıtlı Koordinatörler</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin w-6 h-6 border-4 border-orange-500 border-t-transparent rounded-full" />
              </div>
            ) : liste.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-400 text-sm">Henüz koordinatör eklenmemiş</p>
                <p className="text-slate-300 text-xs mt-1">
                  Koordinatör numarası ekleyerek grup mesajlarını otomatik yönlendirin
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {liste.map((k) => (
                  <li key={k.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 text-lg">
                        📱
                      </div>
                      <div>
                        <p className="font-mono text-sm font-semibold text-slate-900">
                          {k.whatsapp_numara}
                        </p>
                        <p className="text-xs text-slate-400">
                          {k.aciklama ?? 'Açıklama yok'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                        Aktif
                      </span>
                      <Button
                        variant="danger"
                        size="sm"
                        loading={deleting === k.id}
                        onClick={() => handleDelete(k.id)}
                      >
                        Kaldır
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Test senaryosu */}
      <div className="mt-8 bg-slate-50 border border-slate-200 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Örnek Koordinatör Mesajı</h2>
        <pre className="text-xs text-slate-600 bg-white rounded-lg p-4 border border-slate-100 whitespace-pre-wrap leading-relaxed">
{`Bağcılar-1:
Bugün 12 işçi çalıştı. Hafriyat 200m³ tamamlandı.
JCB 8 saat çalıştı. Hava güneşli.

Bağcılar-2:
8 işçi, betonarme döküm yapıldı (3. kat kolon).
Vinç 6 saat. Malzeme: 40 torba çimento geldi.

Bağcılar-3:
Bugün çalışma yok, malzeme bekleniyordu gelmedi.`}
        </pre>
        <p className="text-xs text-slate-400 mt-2">
          Yapay zeka bu mesajı 3 ayrı şantiye raporuna böler ve her birini ilgili şantiyeye kaydeder.
        </p>
      </div>
    </div>
  );
}
