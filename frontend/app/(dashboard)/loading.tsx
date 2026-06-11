export default function Loading() {
  return (
    <div style={{ background: '#0E1117', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
        <div style={{ width: '48px', height: '48px', border: '3px solid rgba(245,158,11,0.3)', borderTop: '3px solid #F59E0B', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ color: '#94A3B8', fontSize: '0.875rem' }}>Yükleniyor...</p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
