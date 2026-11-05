// Service worker : installation (écran d'accueil / bureau) + MODE HORS LIGNE
// DOWNLOAD OFFLINE MODE : tous les fichiers du jeu sont mis en cache ; ensuite le jeu marche sans internet.
// Réseau d'abord (toujours la dernière version quand on est connecté), copie locale si pas de réseau.
const CACHE = 'nsf-offline-v1';
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

async function offlineOn() { const c = await caches.open(CACHE); return !!(await c.match('__offline_ready__')); }

self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url), same = url.origin === location.origin, font = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!same && !font) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    try {
      const res = await fetch(req);
      if (res && (res.ok || res.type === 'opaque') && await offlineOn()) c.put(req, res.clone()).catch(() => {});   // garde la copie à jour
      return res;
    } catch (err) {
      const hit = await c.match(req) || await c.match(req, { ignoreSearch: true }) || (req.mode === 'navigate' ? (await c.match('./index.html', { ignoreSearch: true }) || await c.match('./')) : null);
      if (hit) return hit;
      throw err;
    }
  })());
});

self.addEventListener('message', e => {
  const d = e.data || {}, port = e.source;
  if (d.type !== 'download') return;
  (async () => {
    const c = await caches.open(CACHE);
    let list = [];
    try { list = await (await fetch('offline-files.json', { cache: 'no-store' })).json(); } catch (err) { port && port.postMessage({ type: 'offline', error: true }); return; }
    list = list.concat(d.extra || []);
    const total = list.length + 1; let done = 0, fail = 0;
    const send = () => port && port.postMessage({ type: 'offline', done, total });
    for (const u of list) {
      try { const res = await fetch(u, { cache: 'no-store' }); if (res.ok) await c.put(u, res); else fail++; } catch (err) { fail++; }
      done++; send();
    }
    try {   // police pixel (Google Fonts) : la feuille de style puis les fichiers de police
      const css = await (await fetch(FONT_CSS)).text(); await c.put(FONT_CSS, new Response(css, { headers: { 'Content-Type': 'text/css' } }));
      for (const m of css.matchAll(/url\((https:[^)]+)\)/g)) { try { const r = await fetch(m[1]); await c.put(m[1], r); } catch (err) {} }
    } catch (err) {}
    done++;
    if (fail < 3) await c.put('__offline_ready__', new Response('1'));
    port && port.postMessage({ type: 'offline', done, total, ready: fail < 3, fail });
  })();
});
