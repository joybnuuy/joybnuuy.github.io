// 앱 껍데기만 캐시한다 (대국 상태는 항상 서버에서)
const CACHE = 'jimothy-mvru2gmi';
const SHELL = ['./', 'style.css', 'tiles.js', 'app.js', 'manifest.webmanifest', 'icons/icon.svg'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  // 같은 출처의 GET만 캐시한다 (API, Firebase 통신은 건드리지 않음)
  if (u.origin !== location.origin || u.pathname.includes('/api/') || e.request.method !== 'GET') return;
  // 네트워크 우선, 실패하면 캐시 (최신 코드를 먼저 받는다)
  e.respondWith(fetch(e.request, { cache: 'no-cache' }).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});
