'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface AuthState {
  token: string | null;
  musteriId: string | null;
  kullaniciId: string | null;
  rol: string | null;
}

export function useAuth(requireAuth = true) {
  const router = useRouter();
  const [auth, setAuth] = useState<AuthState>({
    token: null,
    musteriId: null,
    kullaniciId: null,
    rol: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    const musteriId = localStorage.getItem('musteri_id');
    const kullaniciId = localStorage.getItem('kullanici_id');
    const rol = localStorage.getItem('rol');

    if (!token && requireAuth) {
      router.replace('/login');
      return;
    }

    setAuth({ token, musteriId, kullaniciId, rol });
    setLoading(false);
  }, [requireAuth, router]);

  const logout = () => {
    localStorage.clear();
    router.replace('/login');
  };

  return { ...auth, loading, logout };
}
