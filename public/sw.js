const CACHE_NAME = 'hirecanvas-offline-v1'
const OFFLINE_URL = '/offline.html'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.add(OFFLINE_URL))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return

  event.respondWith(
    fetch(event.request, { timeout: 10000 })
      .then((response) => {
        // Only use offline page for actual network errors (not HTTP errors)
        return response
      })
      .catch(() => {
        // Only serve offline page on fetch failure (actual network error)
        return caches.match(OFFLINE_URL).then((response) => response || new Response('Offline', { status: 503 }))
      })
  )
})
