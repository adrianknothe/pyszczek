/* Pyszczek: service worker. Pliki aplikacji działają offline; dane użytkowniczki są tylko w localStorage. */
const CACHE = 'pyszczek-v5';
const ASSETS = ['./', 'index.html', 'style.css', 'foods.js', 'analysis.js', 'insights.js', 'demo.js', 'charts.js', 'app.js', 'pet.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // czcionki i Open Food Facts idą bezpośrednio do sieci
  // najpierw sieć (świeże wersje po aktualizacji), a gdy brak internetu: z pamięci podręcznej
  e.respondWith(
    fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
      return res;
    }).catch(() => caches.match(req).then((r) => r || caches.match('index.html')))
  );
});
