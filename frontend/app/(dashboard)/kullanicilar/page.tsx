'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { KullaniciResponse } from '@/types';

const ROL_RENK: Record<string, string> = {
  admin: 'bg-red-100 text-red-700',
  editor: 'bg-blue-100 text-blue-700',
  viewer: 'bg-gray-100 text-gray-600',
};

const ROL_ETIKET: Record<string, string> = {
  admin: 'Admin',
  editor: 'Editör',
  viewer: 'İzleyici',
};

interface YeniKullanici {
  ad_soyad: string;
  email: string;
  sifre: string;
  rol: 'editor' | 'viewer';
  telefon_no: string;
}

export default function KullanicilarPage() {
  const [kullanicilar, setKullanicilar] = useState<KullaniciResponse[]>([]);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [basari, setBasari] = useState<string | null>(null);
  const [modalAcik, setModalAcik] = useState(false);
  const [form, setForm] = useState<YeniKullanici>({
    ad_soyad: '',
    email: '',
    sifre: '',
    rol: 'viewer',
    telefon_no: '',
  });
  const [kaydediliyor, setKaydediliyor] = useState(false);

  const yukle = async () => {
    try {
      const data = await api.getKullanicilar();
      setKullanicilar(data);
    } catch (e: unknown) {
      setHata(e instanceof Error ? e.message : 'Yüklenirken hata oluştu');
    } finally {
      setYukleniyor(false);
    }
  };

  useEffect(() => { yukle(); }, []);

  const goster = (mesaj: string, hataM = false) => {
    if (hataM) setHata(mesaj); else setBasari(mesaj);
    setTimeout(() => { setHata(null); setBasari(null); }, 3000);
  };

  const rolDegistir = async (id: string, rol: 'admin' | 'editor' | 'viewer') => {
    try {
      const guncellendi = await api.updateKullanici(id, { rol });
      setKullanicilar(prev => prev.map(k => k.id === id ? guncellendi : k));
      goster('Rol güncellendi.');
    } catch (e: unknown) {
      goster(e instanceof Error ? e.message : 'Güncelleme hatası', true);
    }
  };

  const aktifToggle = async (id: string, aktif: boolean) => {
    try {
      const guncellendi = await api.updateKullanici(id, { aktif });
      setKullanicilar(prev => prev.map(k => k.id === id ? guncellendi : k));
      goster(aktif ? 'Kullanıcı aktif edildi.' : 'Kullanıcı pasif edildi.');
    } catch (e: unknown) {
      goster(e instanceof Error ? e.message : 'İşlem hatası', true);
    }
  };

  const kaydet = async () => {
    if (!form.ad_soyad || !form.email || !form.sifre) {
      goster('Ad Soyad, E-posta ve Şifre zorunludur.', true);
      return;
    }
    setKaydediliyor(true);
    try {
      const yeni = await api.createKullanici({
        ad_soyad: form.ad_soyad,
        email: form.email,
        sifre: form.sifre,
        rol: form.rol,
        telefon_no: form.telefon_no || undefined,
      });
      setKullanicilar(prev => [...prev, yeni]);
      setModalAcik(false);
      setForm({ ad_soyad: '', email: '', sifre: '', rol: 'viewer', telefon_no: '' });
      goster('Kullanıcı eklendi.');
    } catch (e: unknown) {
      goster(e instanceof Error ? e.message : 'Kayıt hatası', true);
    } finally {
      setKaydediliyor(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Kullanıcı Yönetimi</h1>
          <p className="text-sm text-gray-500 mt-1">{kullanicilar.length} kullanıcı</p>
        </div>
        <button
          onClick={() => setModalAcik(true)}
          className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
        >
          + Yeni Kullanıcı
        </button>
      </div>

      {hata && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{hata}</div>}
      {basari && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">{basari}</div>}

      {yukleniyor ? (
        <div className="text-center py-12 text-gray-400">Yükleniyor...</div>
      ) : kullanicilar.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Henüz kullanıcı yok.</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Ad Soyad</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">E-posta</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Telefon</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Rol</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {kullanicilar.map(k => (
                <tr key={k.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{k.ad_soyad}</td>
                  <td className="px-4 py-3 text-gray-600">{k.email}</td>
                  <td className="px-4 py-3 text-gray-500">{k.telefon_no ?? '—'}</td>
                  <td className="px-4 py-3">
                    <select
                      value={k.rol}
                      onChange={e => rolDegistir(k.id, e.target.value as 'admin' | 'editor' | 'viewer')}
                      className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${ROL_RENK[k.rol] ?? ''}`}
                    >
                      <option value="admin">Admin</option>
                      <option value="editor">Editör</option>
                      <option value="viewer">İzleyici</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => aktifToggle(k.id, !k.aktif)}
                      className={`text-xs px-3 py-1 rounded-full font-medium transition-colors ${
                        k.aktif
                          ? 'bg-green-100 text-green-700 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {k.aktif ? 'Aktif' : 'Pasif'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalAcik && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900">Yeni Kullanıcı</h2>
              <button onClick={() => setModalAcik(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ad Soyad *</label>
                <input
                  type="text"
                  value={form.ad_soyad}
                  onChange={e => setForm(p => ({ ...p, ad_soyad: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-posta *</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Şifre * (min 8 karakter)</label>
                <input
                  type="password"
                  value={form.sifre}
                  onChange={e => setForm(p => ({ ...p, sifre: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                <input
                  type="tel"
                  value={form.telefon_no}
                  onChange={e => setForm(p => ({ ...p, telefon_no: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                <select
                  value={form.rol}
                  onChange={e => setForm(p => ({ ...p, rol: e.target.value as 'editor' | 'viewer' }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-400 focus:border-transparent outline-none"
                >
                  <option value="viewer">İzleyici — Sadece görüntüler</option>
                  <option value="editor">Editör — Rapor üretir ve onaylar</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setModalAcik(false)}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                onClick={kaydet}
                disabled={kaydediliyor}
                className="flex-1 bg-orange-500 text-white py-2 rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
              >
                {kaydediliyor ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
