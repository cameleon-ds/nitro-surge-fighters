// Service worker minimal : permet d'installer Nitro Surge Fighters comme application (écran d'accueil / bureau)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});   // pas de cache : tout passe par le réseau
