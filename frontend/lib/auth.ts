/**
 * JWT token yönetimi — access + refresh token
 *
 * GÜVENLİK NOTU:
 * Tokenlar şu an localStorage'da tutuluyor (XSS riski taşır).
 * Production'a geçmeden önce httpOnly cookie tabanlı saklama
 * değerlendirin. Mevcut Next.js yapısıyla localStorage kullanımı
 * devam ettiriliyor; CSP header'ları XSS riskini azaltıyor.
 */

const ACCESS_TOKEN_KEY = 'access_token'
const REFRESH_TOKEN_KEY = 'refresh_token'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

// ---------------------------------------------------------------------------
// Token depolama
// ---------------------------------------------------------------------------

export const tokenStore = {
  getAccess: (): string | null =>
    typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null,

  getRefresh: (): string | null =>
    typeof window !== 'undefined' ? localStorage.getItem(REFRESH_TOKEN_KEY) : null,

  /**
   * Token'ları depolar.
   * @param access  - Yeni access token
   * @param refresh - Yeni refresh token (opsiyonel, sadece login'de gönderilir)
   */
  set: (access: string, refresh?: string): void => {
    if (typeof window === 'undefined') return
    localStorage.setItem(ACCESS_TOKEN_KEY, access)
    if (refresh) localStorage.setItem(REFRESH_TOKEN_KEY, refresh)
  },

  /** Her iki token'ı da siler (logout / session sonlanma). */
  clear: (): void => {
    if (typeof window === 'undefined') return
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
  },
}

// ---------------------------------------------------------------------------
// Refresh akışı
// ---------------------------------------------------------------------------

/** Birden fazla eş zamanlı 401 isteğinin aynı anda refresh yapmasını önler. */
let _refreshPromise: Promise<string | null> | null = null

/**
 * Mevcut refresh token ile yeni bir access token alır.
 *
 * @returns Yeni access token veya başarısız olursa null.
 *          null dönerse oturum tamamen sonlanmıştır; /login'e yönlendirin.
 */
export async function refreshAccessToken(): Promise<string | null> {
  // Eş zamanlı birden fazla refresh isteğini tek isteğe indir
  if (_refreshPromise) return _refreshPromise

  _refreshPromise = _doRefresh().finally(() => {
    _refreshPromise = null
  })

  return _refreshPromise
}

async function _doRefresh(): Promise<string | null> {
  const refreshToken = tokenStore.getRefresh()
  if (!refreshToken) return null

  try {
    const res = await fetch(`${BASE}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })

    if (!res.ok) {
      // Refresh token geçersiz veya süresi dolmuş → oturumu temizle
      tokenStore.clear()
      return null
    }

    const data: { access_token: string } = await res.json()
    tokenStore.set(data.access_token)
    return data.access_token
  } catch {
    // Ağ hatası — tokenları koruyoruz, çağıran karar verir
    return null
  }
}

// ---------------------------------------------------------------------------
// Yardımcı: oturumu kapat ve login'e yönlendir
// ---------------------------------------------------------------------------

export function logout(): void {
  tokenStore.clear()
  if (typeof window !== 'undefined') {
    window.location.href = '/login'
  }
}
