/* Web app manifest (makes the site installable). The icon comes from Super Admin → Settings → Website icon. */
const { createEnv } = require('./_lib/env');
module.exports = async function handler(req, res) {
  let icon = '';
  try { const cat = await createEnv().db.kvGet('catalog'); icon = (cat && cat.settings && cat.settings.siteIcon) || ''; } catch (e) { console.error('manifest', e); }
  const icons = icon ? [{ src: icon, sizes: '192x192 512x512', type: 'image/png', purpose: 'any' }]
    : [{ src: '/img/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: '/img/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }];
  res.setHeader('Content-Type', 'application/manifest+json'); res.setHeader('Cache-Control', 'public, max-age=300');
  res.status(200).send(JSON.stringify({ name: 'Tara Romblon', short_name: 'Tara Romblon', description: 'Food delivery, scooter rentals, stays and things to do in Romblon.', start_url: '/?source=app', scope: '/', display: 'standalone', background_color: '#f6f3ec', theme_color: '#13305a', icons }));
};
