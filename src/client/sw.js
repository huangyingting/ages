/* Offline support (written to dist/sw.js by the `serviceWorker` plugin in vite.config.ts, which fills in VERSION and
 * PRECACHE per build).
 * Same-origin GETs only; cross-origin requests (Wikipedia, terrain tiles, music) go straight to the network.
 * - install: the shell and every build file (all eras' model packs, workers, terrain, shapes) are fetched at once, so
 *   after the first visit the whole atlas works offline, not just the parts that visit happened to load;
 * - pages: network first, the cached shell when offline;
 * - hashed build files (assets/): cache first, they never change;
 * - everything else (data/, icons, manifest): cached copy at once, refreshed in the background.
 * Each deploy has a new VERSION, so the previous build's cache is dropped on activation. */
const VERSION = '__VERSION__';
const PRECACHE = [/* __PRECACHE__ */];
const CACHE = `ages-${VERSION}`;
const SCOPE = new URL(self.registration.scope);

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    // one by one, so a single failed file does not void the rest (it is fetched again on first use)
    .then(c => Promise.all([SCOPE.href, ...PRECACHE.map(f => new URL(f, SCOPE).href)]
      .map(u => c.add(new Request(u, { cache: 'no-cache' })).catch(() => {}))))
    .catch(() => {})
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('ages-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// install-time copies carry no Origin header, while module scripts and CSS are fetched in CORS mode with one: a server
// that sends `Vary: Origin` (vite preview, some CDNs) would make every precached copy miss, so match on the URL alone
const match = req => caches.match(req, { ignoreVary: true });
const put = (key, res) => {
  if (res.ok && res.type === 'basic') { const copy = res.clone(); void caches.open(CACHE).then(c => c.put(key, copy)); }
  return res;
};

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== SCOPE.origin || !url.pathname.startsWith(SCOPE.pathname) || req.headers.has('range')) return;

  if (req.mode === 'navigate') {
    // one shell for every deep link (?year=…, #e=…): the app reads its state from the URL
    e.respondWith(fetch(req).then(res => put(SCOPE.href, res)).catch(async () => (await match(SCOPE.href)) ?? Response.error()));
    return;
  }
  if (url.pathname.startsWith(`${SCOPE.pathname}assets/`)) {
    e.respondWith(match(req).then(hit => hit ?? fetch(req).then(res => put(req, res))));
    return;
  }
  e.respondWith(match(req).then(hit => {
    const net = fetch(req).then(res => put(req, res));
    if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
    return net;
  }));
});
