'use client';

export default function OfflinePage() {
  return (
    <div style={{ background: '#0E1117', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
      <div style={{ fontSize: '64px' }}>🔌</div>
      <h1 style={{ color: '#F1F5F9', fontFamily: 'Syne, sans-serif', fontSize: '24px', fontWeight: 800 }}>
        İnternet Bağlantısı Yok
      </h1>
      <p style={{ color: '#64748B', fontSize: '14px', textAlign: 'center', maxWidth: '280px' }}>
        Bağlantı kurulduğunda Şantiye Asistanı otomatik olarak yeniden yüklenecek.
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{ background: '#F59E0B', color: '#000', border: 'none', borderRadius: '12px', padding: '12px 24px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
      >
        Yeniden Dene
      </button>
    </div>
  )
}
