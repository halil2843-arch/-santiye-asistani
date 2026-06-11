'use client';
import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div style={{ background: '#0E1117', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div style={{ background: '#1E2636', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '1rem', padding: '2rem', maxWidth: '400px', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
        <h2 style={{ color: '#F1F5F9', fontFamily: 'Syne, sans-serif', marginBottom: '0.5rem' }}>Bir hata oluştu</h2>
        <p style={{ color: '#94A3B8', fontSize: '0.875rem', marginBottom: '1.5rem' }}>{error.message || 'Beklenmedik bir hata meydana geldi.'}</p>
        <button
          onClick={reset}
          style={{ background: '#F59E0B', color: '#000', padding: '0.75rem 1.5rem', borderRadius: '0.75rem', fontWeight: '600', border: 'none', cursor: 'pointer' }}
        >
          Tekrar Dene
        </button>
      </div>
    </div>
  );
}
