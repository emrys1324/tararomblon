/* Web app manifest (makes the site installable). The icon comes from Super Admin → Settings → Website icon. */
const { createEnv } = require('./_lib/env');
module.exports = async function handler(req, res) {
  let icon = '';
  try { const cat = await createEnv().db.kvGet('catalog'); icon = (cat && cat.settings && cat.settings.siteIcon) || ''; } catch (e) { console.error('manifest', e); }
  const icons = icon ? [{ src: icon, sizes: '192x192 512x512', type: 'image/png', purpose: 'any' }]
    : [{ src: '/img/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: '/img/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }];
  res.setHeader('Content-Type', 'application/manifest+json'); res.setHeader('Cache-Control', 'public, max-age=300');
  const app = { rider: ['Tara Romblon Rider', 'TR Rider', '/rider'], merchant: ['Tara Romblon Merchant', 'TR Merchant', '/merchant'], admin: ['Tara Romblon Admin', 'TR Admin', '/admin'] }[String((req.query && req.query.app) || '')];
  const m = app ? { id: app[2], name: app[0], short_name: app[1], description: app[0] + ' app', start_url: app[2], scope: '/' } : { id: '/', name: 'Tara Romblon', short_name: 'Tara Romblon', description: 'Food delivery, scooter rentals, stays and things to do in Romblon.', start_url: '/?source=app', scope: '/' };
  res.status(200).send(JSON.stringify(Object.assign(m, { display: 'standalone', background_color: '#f6f3ec', theme_color: '#13305a', icons })));
};
