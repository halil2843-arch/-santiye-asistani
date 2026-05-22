'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { SantiyeResponse, PendingPhoneResponse } from '@/types';

interface SantiyeFormData {
  isim: string;
  adres: string;
  whatsapp_numara: string;
}

const EMPTY_FORM: SantiyeFormData = { isim: '', adres: '', whatsapp_numara: '' };

export default function SantiyelerPage() {
  const { musteriId, loading: authLoading } = useAuth();
  const [santiyeler, setSantiyeler] = useState<SantiyeResponse[]>([]);
  const [pending, setPending] = useState<PendingPhoneResponse[]>([]);
  const [loading, setLoading] = useState(true);

  // Yeni şantiye formu
  const [yeniForm, setYeniForm] = useState<SantiyeFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Düzenleme
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<SantiyeFormData>(EMPTY_FORM);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  // Numara bağlama
  const [linkingId, setLinkingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [sites, pend] = await Promise.all([api.getSantiyeler(), api.getPendingPhones()]);
      setSantiyeler(sites);
      setPending(pend);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading]);

  // --- Yeni şantiye ekle ---
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!musteriId) return;
    setSaveError('');
    setSaving(true);
    try {
      const payload: Parameters<typeof api.createSantiye>[0] = {
        musteri_id: musteriId,
        isim: yeniForm.isim,
      };
      if (yeniForm.adres.trim()) payload.adres = yeniForm.adres.trim();
      if (yeniForm.whatsapp_numara.trim()) payload.whatsapp_numara = yeniForm.whatsapp_numara.trim();
      const yeni = await api.createSantiye(payload);
      setSantiyeler((prev) => [...prev, yeni]);
      setYeniForm(EMPTY_FORM);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Kayıt hatası');
    } finally {
      setSaving(false);
    }
  };

  // --- Düzenlemeyi aç ---
  const startEdit = (s: SantiyeResponse) => {
    setEditId(s.id);
    setEditForm({ isim: s.isim, adres: s.adres ?? '', whatsapp_numara: s.whatsapp_numara ?? '' });
    setEditError('');
  };

  // --- Düzenlemeyi kaydet ---
  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId) return;
    setEditError('');
    setEditSaving(true);
    try {
      const updated = await api.updateSantiye(editId, {
        isim: editForm.isim,
        adres: editForm.adres || undefined,
      });
      setSantiyeler((prev) => prev.map((s) => (s.id === editId ? updated : s)));
      setEditId(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Güncelleme hatası');
    } finally {
      setEditSaving(false);
    }
  };

  // --- Aktiflik toggle ---
  const toggleAktif = async (s: SantiyeResponse) => {
    try {
      const updated = await api.updateSantiye(s.id, { aktif: !s.aktif });
      setSantiyeler((prev) => prev.map((x) => (x.id === s.id ? updated : x)));
    } catch {
      // sessiz
    }
  };

  // --- Numara bağla (pending listesinden) ---
  const linkPhone = async (santiyeId: string, numara: string) => {
    setLinkingId(santiyeId + numara);
    try {
      await api.linkPhone(santiyeId, numara);
      await load();
    } finally {
      setLinkingId(null);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Şantiyeler</h1>
        <p className="text-slate-500 text-sm mt-1">Şantiyelerinizi ekleyin ve yönetin</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sol: Yeni şantiye formu */}
        <Card className="lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle>Yeni Şantiye Ekle</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <Field label="Şantiye Adı *">
                <input
                  type="text"
                  value={yeniForm.isim}
                  onChange={(e) => setYeniForm((f) => ({ ...f, isim: e.target.value }))}
                  required
                  placeholder="Bağcılar-1 Şantiyesi"
                  className={inputCls}
                />
              </Field>
              <Field label="Adres">
                <textarea
                  value={yeniForm.adres}
                  onChange={(e) => setYeniForm((f) => ({ ...f, adres: e.target.value }))}
                  placeholder="İstanbul, Bağcılar…"
                  rows={2}
                  className={inputCls}
                />
              </Field>
              <Field label="WhatsApp Numarası">
                <input
                  type="text"
                  value={yeniForm.whatsapp_numara}
                  onChange={(e) => setYeniForm((f) => ({ ...f, whatsapp_numara: e.target.value }))}
                  placeholder="+905551234567"
                  className={inputCls}
                />
                <p className="text-xs text-slate-400 mt-1">Sonradan da bağlanabilir</p>
              </Field>
              {saveError && <ErrorBox msg={saveError} />}
              <Button type="submit" loading={saving} className="w-full">
                Şantiye Ekle
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Sağ: Şantiye listesi */}
        <div className="lg:col-span-2 space-y-4">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin w-7 h-7 border-4 border-orange-500 border-t-transparent rounded-full" />
            </div>
          ) : santiyeler.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12 text-slate-400 text-sm">
                Henüz şantiye eklenmemiş
              </CardContent>
            </Card>
          ) : (
            santiyeler.map((s) =>
              editId === s.id ? (
                /* --- Düzenleme formu satırı --- */
                <Card key={s.id} className="border-orange-300">
                  <CardContent className="pt-4">
                    <form onSubmit={handleUpdate} className="space-y-3">
                      <Field label="Şantiye Adı *">
                        <input
                          type="text"
                          value={editForm.isim}
                          onChange={(e) => setEditForm((f) => ({ ...f, isim: e.target.value }))}
                          required
                          className={inputCls}
                        />
                      </Field>
                      <Field label="Adres">
                        <textarea
                          value={editForm.adres}
                          onChange={(e) => setEditForm((f) => ({ ...f, adres: e.target.value }))}
                          rows={2}
                          className={inputCls}
                        />
                      </Field>
                      {editError && <ErrorBox msg={editError} />}
                      <div className="flex gap-2">
                        <Button type="submit" loading={editSaving} size="sm">Kaydet</Button>
                        <Button type="button" variant="secondary" size="sm" onClick={() => setEditId(null)}>İptal</Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              ) : (
                /* --- Normal kart --- */
                <Card key={s.id}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-slate-900">{s.isim}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.aktif ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                            {s.aktif ? 'Aktif' : 'Pasif'}
                          </span>
                        </div>
                        {s.adres && (
                          <p className="text-sm text-slate-500 mb-1">📍 {s.adres}</p>
                        )}
                        <p className="text-sm text-slate-500">
                          {s.whatsapp_numara ? (
                            <span className="text-emerald-600">📱 {s.whatsapp_numara}</span>
                          ) : (
                            <span className="text-amber-600">⚠ WhatsApp bağlı değil</span>
                          )}
                        </p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button variant="secondary" size="sm" onClick={() => startEdit(s)}>
                          Düzenle
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleAktif(s)}
                          className="text-xs"
                        >
                          {s.aktif ? 'Pasife Al' : 'Aktife Al'}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            )
          )}
        </div>
      </div>

      {/* Bekleyen numaralar */}
      {pending.length > 0 && (
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>
                Bekleyen WhatsApp Numaraları
                <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                  {pending.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <p className="text-sm text-slate-500 px-6 pb-3">
                Bu numaralar sistem dışından mesaj gönderdi. Bir şantiyeye bağlayın.
              </p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-y border-slate-100 bg-slate-50">
                    <th className="text-left px-6 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">Numara</th>
                    <th className="text-left px-6 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">İlk Mesaj</th>
                    <th className="text-right px-6 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pending.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-6 py-3 font-mono text-slate-800">{p.whatsapp_numara}</td>
                      <td className="px-6 py-3 text-slate-500 truncate max-w-xs">{p.ilk_mesaj_metni ?? '—'}</td>
                      <td className="px-6 py-3 text-right">
                        <select
                          defaultValue=""
                          onChange={(e) => {
                            if (e.target.value) linkPhone(e.target.value, p.whatsapp_numara);
                          }}
                          disabled={linkingId !== null}
                          className="text-sm border border-slate-300 rounded-lg px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
                        >
                          <option value="">Şantiye seç…</option>
                          {santiyeler.map((s) => (
                            <option key={s.id} value={s.id}>{s.isim}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">{msg}</div>
  );
}
