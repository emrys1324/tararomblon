/* Website icon (browser tab, bookmarks, iPhone home screen): Super Admin → Settings → Website icon, or the default. */
const { createEnv } = require('./_lib/env');
module.exports = async function handler(req, res) {
  let icon = '';
  try { const cat = await createEnv().db.kvGet('catalog'); icon = (cat && cat.settings && cat.settings.siteIcon) || ''; } catch (e) { console.error('icon', e); }
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.writeHead(302, { Location: icon || '/img/icon-192.png' }); res.end();
};
