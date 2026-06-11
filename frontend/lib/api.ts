import type {
  TokenResponse,
  SantiyeResponse,
  RaporResponse,
  SablonResponse,
  RaporOlusturRequest,
  RaporOlusturResponse,
  PendingPhoneResponse,
  KullaniciResponse,
  NumaraResponse,
  PreviewResponse,
  WeatherResponse,
  DashboardSummary,
  ProjeResponse,
  ProjeCreate,
  StokKalemi,
  MedyaDosyasi,
  IsgKaydi,
  Toplanti,
  Aktivite,
  PuantajKaydi,
  ProjeIstatistik,
  ProjeNot,
} from '@/types';
import { tokenStore, refreshAccessToken, logout } from '@/lib/auth';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

function getToken(): string | null {
  return tokenStore.getAccess();
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  auth = true,
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers });

  if (res.status === 401 && auth) {
    // Access token süresi dolmuş olabilir — refresh token ile yenile
    const newToken = await refreshAccessToken();

    if (newToken) {
      // Yeni token ile orijinal isteği tekrar gönder
      const retryHeaders: Record<string, string> = {
        ...(options.headers as Record<string, string>),
      };
      retryHeaders['Authorization'] = `Bearer ${newToken}`;
      if (!(options.body instanceof FormData)) {
        retryHeaders['Content-Type'] = 'application/json';
      }

      const retryRes = await fetch(`${BASE}${path}`, { ...options, headers: retryHeaders });

      if (retryRes.status === 401) {
        // Yeni token da geçersiz — oturumu kapat
        logout();
        throw new Error('Oturum süresi doldu');
      }

      if (!retryRes.ok) {
        const err = await retryRes.json().catch(() => ({ detail: retryRes.statusText }));
        throw new Error(err.detail ?? 'Bilinmeyen hata');
      }

      if (retryRes.status === 204) return undefined as T;
      return retryRes.json();
    } else {
      // Refresh token da geçersiz veya yok — login'e yönlendir
      logout();
      throw new Error('Oturum süresi doldu');
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? 'Bilinmeyen hata');
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

// Auth
export const api = {
  /**
   * Giriş yap — dönen access_token ve refresh_token'ı depolar.
   * Çağıran kod ayrıca tokenStore.set() çağırmasına gerek yok.
   */
  login: async (email: string, sifre: string): Promise<TokenResponse> => {
    const data = await request<TokenResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, sifre }),
    }, false);
    tokenStore.set(data.access_token, data.refresh_token);
    return data;
  },

  // Sites
  getSantiyeler: () =>
    request<SantiyeResponse[]>('/api/v1/sites/'),

  createSantiye: (payload: { musteri_id: string; isim: string; adres?: string; whatsapp_numara?: string }) =>
    request<SantiyeResponse>('/api/v1/sites/', { method: 'POST', body: JSON.stringify(payload) }),

  updateSantiye: (santiye_id: string, payload: { isim?: string; adres?: string; aktif?: boolean }) =>
    request<SantiyeResponse>(`/api/v1/sites/${santiye_id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  getPendingPhones: () =>
    request<PendingPhoneResponse[]>('/api/v1/sites/pending-phones'),

  linkPhone: (santiye_id: string, whatsapp_numara: string) =>
    request('/api/v1/sites/' + santiye_id + '/link-phone', {
      method: 'POST',
      body: JSON.stringify({ whatsapp_numara }),
    }),

  // Koordinatör
  getKoordinatorler: () =>
    request<{ id: string; musteri_id: string; whatsapp_numara: string; aciklama: string | null; aktif: boolean }[]>('/api/v1/koordinator/'),

  createKoordinatör: (whatsapp_numara: string, aciklama?: string) =>
    request('/api/v1/koordinator/', { method: 'POST', body: JSON.stringify({ whatsapp_numara, aciklama }) }),

  deleteKoordinatör: (id: string) =>
    request<void>(`/api/v1/koordinator/${id}`, { method: 'DELETE' }),

  // Reports
  getRaporlar: (santiye_id: string, tarih?: string) => {
    const q = tarih ? `?tarih=${tarih}` : '';
    return request<RaporResponse[]>(`/api/v1/reports/${santiye_id}${q}`);
  },

  generateRapor: (payload: RaporOlusturRequest) =>
    request<RaporOlusturResponse>('/api/v1/reports/generate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  approveRapor: (rapor_id: string) =>
    request<RaporResponse>(`/api/v1/reports/${rapor_id}/approve`, { method: 'PATCH' }),

  downloadRapor: (rapor_id: string) =>
    `${BASE}/api/v1/reports/${rapor_id}/download?token=${getToken()}`,

  // Templates
  getSablonlar: (tip?: string) =>
    request<SablonResponse[]>(`/api/v1/templates/${tip ? `?tip=${tip}` : ''}`),

  uploadSablon: (formData: FormData) =>
    request<SablonResponse>('/api/v1/templates/upload', {
      method: 'POST',
      body: formData,
    }),

  deleteSablon: (template_id: string) =>
    request<void>(`/api/v1/templates/${template_id}`, { method: 'DELETE' }),

  // Preview
  previewRapor: (rapor_id: string) =>
    request<PreviewResponse>(`/api/v1/reports/${rapor_id}/preview`),

  // Kullanıcı yönetimi
  getKullanicilar: () =>
    request<KullaniciResponse[]>('/api/v1/users/'),

  createKullanici: (payload: { ad_soyad: string; email: string; sifre: string; rol: string; telefon_no?: string }) =>
    request<KullaniciResponse>('/api/v1/users/', { method: 'POST', body: JSON.stringify(payload) }),

  updateKullanici: (id: string, payload: { ad_soyad?: string; rol?: string; aktif?: boolean; telefon_no?: string }) =>
    request<KullaniciResponse>(`/api/v1/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),

  deleteKullanici: (id: string) =>
    request<void>(`/api/v1/users/${id}`, { method: 'DELETE' }),

  // Çoklu numara
  getSantiyeNumaralari: (santiye_id: string) =>
    request<NumaraResponse[]>(`/api/v1/sites/${santiye_id}/phones`),

  addSantiyeNumarasi: (santiye_id: string, numara: string) =>
    request<NumaraResponse>(`/api/v1/sites/${santiye_id}/phones`, { method: 'POST', body: JSON.stringify({ numara }) }),

  deleteSantiyeNumarasi: (santiye_id: string, numara_id: string) =>
    request<void>(`/api/v1/sites/${santiye_id}/phones/${numara_id}`, { method: 'DELETE' }),

  // Dashboard & Weather
  getWeather: (il: string, ilce: string, lat?: number, lon?: number) => {
    const params = new URLSearchParams();
    if (lat !== undefined && lon !== undefined) {
      params.set('lat', lat.toString());
      params.set('lon', lon.toString());
    } else {
      params.set('il', il);
      params.set('ilce', ilce);
    }
    return request<WeatherResponse>(`/api/v1/dashboard/weather?${params.toString()}`);
  },

  getDashboardSummary: () =>
    request<DashboardSummary>('/api/v1/dashboard/summary'),

  // Projeler
  getProjeler: (durum?: string) =>
    request<ProjeResponse[]>('/api/v1/projects/' + (durum ? `?durum=${durum}` : '')),

  updateProje: (id: string, data: Partial<ProjeResponse>) =>
    request<ProjeResponse>(`/api/v1/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  createProje: (data: ProjeCreate) =>
    request<ProjeResponse>('/api/v1/projects/', { method: 'POST', body: JSON.stringify(data) }),

  getProje: (id: string) =>
    request<ProjeResponse>(`/api/v1/projects/${id}`),

  getProjeIstatistik: (proje_id: string) =>
    request<ProjeIstatistik>(`/api/v1/projects/${proje_id}/istatistik`),

  // Stok
  getStokKalemleri: (proje_id?: string, kritik?: boolean) =>
    request<StokKalemi[]>(`/api/v1/stok/${proje_id ? `?proje_id=${proje_id}` : ''}${kritik ? '&kritik=true' : ''}`),

  createStokKalemi: (data: Partial<StokKalemi>) =>
    request<StokKalemi>('/api/v1/stok/', { method: 'POST', body: JSON.stringify(data) }),

  stokHareket: (id: string, tip: string, miktar: number, aciklama?: string) =>
    request<StokKalemi>(`/api/v1/stok/${id}/hareket`, { method: 'POST', body: JSON.stringify({ tip, miktar, aciklama }) }),

  // Medya
  getMedya: (proje_id?: string, tip?: string) =>
    request<MedyaDosyasi[]>(`/api/v1/media/${proje_id ? `?proje_id=${proje_id}` : ''}${tip ? `&tip=${tip}` : ''}`),

  uploadMedya: (formData: FormData) =>
    request<MedyaDosyasi>('/api/v1/media/upload', { method: 'POST', body: formData }),

  deleteMedya: (id: string) => request<void>(`/api/v1/media/${id}`, { method: 'DELETE' }),

  // Galeri klasör metodları
  getGaleriKlasorleri: (proje_id?: string) => {
    const q = proje_id ? `?proje_id=${proje_id}` : '';
    return request<string[]>(`/api/v1/media/klasorler${q}`);
  },

  klasoreYerlesit: (medya_id: string, klasor: string | null) =>
    request<{ mesaj: string; klasor: string | null }>(
      `/api/v1/media/${medya_id}/klasor`,
      { method: 'PATCH', body: JSON.stringify({ klasor }) }
    ),

  medyaKopyala: (medya_id: string, klasor?: string) => {
    const q = klasor ? `?klasor=${encodeURIComponent(klasor)}` : '';
    return request<MedyaDosyasi>(`/api/v1/media/${medya_id}/kopyala${q}`, { method: 'POST' });
  },

  // ISG
  getIsgKayitlari: (proje_id?: string) =>
    request<IsgKaydi[]>(`/api/v1/isg/${proje_id ? `?proje_id=${proje_id}` : ''}`),

  createIsgKaydi: (data: Partial<IsgKaydi>) =>
    request<IsgKaydi>('/api/v1/isg/', { method: 'POST', body: JSON.stringify(data) }),

  updateIsgKaydi: (id: string, data: Partial<IsgKaydi>) =>
    request<IsgKaydi>(`/api/v1/isg/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  // Toplantı
  getToplantilar: (proje_id?: string) =>
    request<Toplanti[]>(`/api/v1/toplanti/${proje_id ? `?proje_id=${proje_id}` : ''}`),

  createToplanti: (data: Partial<Toplanti>) =>
    request<Toplanti>('/api/v1/toplanti/', { method: 'POST', body: JSON.stringify(data) }),

  // Aktivite
  getAktiviteler: (proje_id: string) =>
    request<Aktivite[]>(`/api/v1/projects/${proje_id}/aktivite`),

  createAktivite: (proje_id: string, data: { tip: string; baslik: string; aciklama?: string; renk?: string }) =>
    request<Aktivite>(`/api/v1/projects/${proje_id}/aktivite`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Chat
  getChatCommands: () =>
    request<{ komutlar: Array<{ key: string; label: string }> }>('/api/v1/chat/commands'),

  // Malzeme tahmini
  malzemeTahmin: (data: { yapi_tipi: string; alan_m2: number; kat_sayisi: number; ek_bilgi?: string }) =>
    request<{ malzemeler: Array<{ ad: string; miktar: number; birim: string; aciklama: string }>; uyari: string }>('/api/v1/malzeme/tahmin', { method: 'POST', body: JSON.stringify(data) }),

  // Medya view URL (token gerektirmez, sadece URL döner)
  getMedyaViewUrl: (id: string) => `${BASE}/api/v1/media/${id}/view`,

  // Puantaj
  getPuantaj: (tarih?: string, proje_id?: string) => {
    const params = new URLSearchParams();
    if (tarih) params.set('tarih', tarih);
    if (proje_id) params.set('proje_id', proje_id);
    const q = params.toString() ? `?${params.toString()}` : '';
    return request<PuantajKaydi[]>(`/api/v1/puantaj/${q}`);
  },

  createPuantaj: (data: Partial<PuantajKaydi>) =>
    request<PuantajKaydi>('/api/v1/puantaj/', { method: 'POST', body: JSON.stringify(data) }),

  topluPuantaj: (data: Partial<PuantajKaydi>[]) =>
    request<PuantajKaydi[]>('/api/v1/puantaj/toplu', { method: 'POST', body: JSON.stringify(data) }),

  deletePuantaj: (id: string) =>
    request<void>(`/api/v1/puantaj/${id}`, { method: 'DELETE' }),

  // Hakediş
  hakedisOlustur: (data: { santiye_adi: string; donem: string; is_kalemleri: object[]; kdv_orani?: number }) =>
    fetch(`${BASE}/api/v1/hakedis/olustur`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenStore.getAccess() ?? ''}` },
      body: JSON.stringify(data),
    }).then((r) => r.blob()),

  hakedisOrnekSablon: () =>
    fetch(`${BASE}/api/v1/hakedis/ornek-sablon`, {
      headers: { Authorization: `Bearer ${tokenStore.getAccess() ?? ''}` },
    }).then((r) => r.blob()),

  // Taslak raporlar
  getTaslaklar: (santiye_id: string) =>
    request<RaporResponse[]>(`/api/v1/reports/${santiye_id}?durum=taslak`),

  // VAPID public key (push bildirim)
  getVapidKey: () =>
    request<{ vapid_public_key: string }>('/api/v1/bildirim/vapid-public-key'),

  // Proje notları
  getProjeNotlari: (proje_id: string) =>
    request<ProjeNot[]>(`/api/v1/projects/${proje_id}/notlar`),

  createProjeNot: (proje_id: string, data: { baslik: string; icerik: string; renk?: string }) =>
    request<ProjeNot>(`/api/v1/projects/${proje_id}/notlar`, { method: 'POST', body: JSON.stringify(data) }),

  updateProjeNot: (proje_id: string, not_id: string, data: Partial<ProjeNot>) =>
    request<ProjeNot>(`/api/v1/projects/${proje_id}/notlar/${not_id}`, { method: 'PATCH', body: JSON.stringify(data) }),

  deleteProjeNot: (proje_id: string, not_id: string) =>
    request<void>(`/api/v1/projects/${proje_id}/notlar/${not_id}`, { method: 'DELETE' }),

  // Proje milestone
  createMilestone: (proje_id: string, data: { baslik: string; hedef_tarih: string; aciklama?: string }) =>
    request<Aktivite>(`/api/v1/projects/${proje_id}/milestone`, { method: 'POST', body: JSON.stringify(data) }),
};
