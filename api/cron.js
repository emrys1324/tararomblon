/* Daily safety net (vercel.json "crons"): confirms paid HitPay links the webhook missed and expires unpaid ones.
   Vercel sends "Authorization: Bearer <CRON_SECRET>" automatically when CRON_SECRET is set. */
const { createCore } = require('./_lib/shared');
const { createEnv, E } = require('./_lib/env');

module.exports = async function handler(req, res) {
  const secret = E('CRON_SECRET');
  if (!secret || req.headers.authorization !== 'Bearer ' + secret) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const env = createEnv();
    await createCore(env).reconcile();
    /* tidy expired cache rows (sign-in codes, rate limits) */
    await fetch(E('SUPABASE_URL').replace(/\/+$/, '') + '/rest/v1/cache?expires_at=lt.' + encodeURIComponent(new Date().toISOString()), { method: 'DELETE', headers: { apikey: E('SUPABASE_SERVICE_ROLE_KEY'), Authorization: 'Bearer ' + E('SUPABASE_SERVICE_ROLE_KEY'), Prefer: 'return=minimal' } });
    return res.status(200).json({ ok: true });
  } catch (e) { console.error('cron', e); return res.status(500).json({ ok: false }); }
};
