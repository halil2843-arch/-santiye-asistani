// public/sw.js
const CACHE_NAME = 'santiye-v1'
const OFFLINE_URL = '/offline'

// Önbelleğe alınacak statik dosyalar
const STATIC_ASSETS = [
  '/',
  '/anasayfa',
  '/yonetim',
  '/araclar',
  '/asistan',
  '/offline',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  // API isteklerini önbelleğe alma
  if (event.request.url.includes('/api/')) return

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Başarılı yanıtı önbelleğe al
        if (response.ok && event.request.method === 'GET') {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() =>
        caches.match(event.request).then(cached =>
          cached || caches.match(OFFLINE_URL)
        )
      )
  )
})
