import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Şantiye Asistanı',
    short_name: 'Şantiye',
    description: 'İnşaat sahası yönetim asistanı',
    start_url: '/anasayfa',
    display: 'standalone',
    background_color: '#0E1117',
    theme_color: '#F59E0B',
    orientation: 'portrait',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
