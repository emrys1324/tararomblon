/* Tara Romblon service worker: makes the site installable and shows phone notifications (Web Push). Pages always load fresh from the network. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
self.addEventListener('push', e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Tara Romblon', { body: d.body || '', icon: '/api/icon', badge: '/img/icon-192.png', tag: d.tag || undefined, renotify: !!d.tag, data: { url: d.url || '/' }, vibrate: [120, 60, 120] }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close(); const url = new URL((e.notification.data && e.notification.data.url) || '/', self.location.origin).href, path = new URL(url).pathname;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const same = list.find(c => new URL(c.url).pathname === path) || list.find(c => new URL(c.url).pathname.startsWith(path === '/' ? '/index' : path));
    if (same) { same.focus(); if (url.includes('#')) same.navigate(url).catch(() => {}); return; }
    return self.clients.openWindow(url);
  }));
});
