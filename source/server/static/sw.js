/* Tara Romblon: minimal service worker so the site can be installed as an app. Pages always load fresh from the network. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
