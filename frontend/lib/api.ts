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
} from '@/types';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
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

  if (res.status === 401) {
    localStorage.removeItem('access_token');
    window.location.href = '/login';
    throw new Error('Oturum süresi doldu');
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
  login: (email: string, sifre: string) =>
    request<TokenResponse>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, sifre }),
    }, false),

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
  getSablonlar: () =>
    request<SablonResponse[]>('/api/v1/templates/'),

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
};
