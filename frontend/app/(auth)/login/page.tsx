'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sifre, setSifre] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.login(email, sifre);
      localStorage.setItem('access_token', res.access_token);
      if (res.refresh_token) localStorage.setItem('refresh_token', res.refresh_token);
      localStorage.setItem('musteri_id', res.musteri_id);
      localStorage.setItem('kullanici_id', res.kullanici_id);
      localStorage.setItem('rol', res.rol);
      router.replace('/anasayfa');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Giriş başarısız');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{ background: '#0E1117' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
               style={{ background: 'linear-gradient(135deg, #F59E0B, #B45309)' }}>
            <svg className="w-9 h-9 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Syne, sans-serif' }}>
            Şantiye Asistanı
          </h1>
          <p className="text-sm mt-1" style={{ color: '#64748B' }}>Hesabınıza giriş yapın</p>
        </div>

        {/* Form */}
        <div className="rounded-2xl p-6"
             style={{ background: '#1E2636', border: '1px solid rgba(255,255,255,0.07)' }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#94A3B8' }}>
                E-posta
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="admin@firma.com"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition"
                style={{
                  background: '#252F42',
                  border: '1px solid rgba(255,255,255,0.07)',
                  color: '#F1F5F9',
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#94A3B8' }}>
                Şifre
              </label>
              <input
                type="password"
                value={sifre}
                onChange={(e) => setSifre(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition"
                style={{
                  background: '#252F42',
                  border: '1px solid rgba(255,255,255,0.07)',
                  color: '#F1F5F9',
                }}
              />
            </div>

            {error && (
              <div className="rounded-xl px-4 py-3 text-sm"
                   style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#FCA5A5' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold transition-opacity"
              style={{ background: '#F59E0B', color: '#000', opacity: loading ? 0.6 : 1 }}
            >
              {loading ? 'Giriş yapılıyor…' : 'Giriş Yap'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-4" style={{ color: '#334155' }}>
          Şantiye Asistanı v2.0
        </p>
      </div>
    </div>
  );
}
