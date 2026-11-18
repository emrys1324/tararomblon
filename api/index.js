/* POST /api  { action, ...data }  ->  { ok: true, ... } | { ok: false, error } */
const { createCore } = require('./_lib/shared');
const { createEnv, E } = require('./_lib/env');

let seeded = false;
const BACKGROUND = { feed: 1, mBookings: 1, adminData: 1, rOrders: 1, myBookings: 1 };

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Use POST.' });
  let body = req.body;
  try { if (typeof body === 'string') body = JSON.parse(body); } catch (e) { return res.status(400).json({ ok: false, error: 'Bad request.' }); }
  body = body || {};
  const action = String(body.action || '');
  try {
    const env = createEnv(), core = createCore(env);
    if (!seeded) { await core.seedStaff(E('SUPER_ADMINS').split(',')); seeded = true; }
    const out = await core.handle(action, body);
    /* Hobby plan cron runs once a day, so also check unpaid HitPay links at most every 5 minutes while staff are online */
    if (BACKGROUND[action] && !(await env.cache.get('reconcile_lock'))) {
      await env.cache.put('reconcile_lock', '1', 300);
      try { await createCore(createEnv()).reconcile(); } catch (e) { console.error('reconcile', e); }
    }
    return res.status(200).json(Object.assign({ ok: true }, out));
  } catch (e) {
    const msg = (e && e.message) || 'Something went wrong.';
    console.warn('[' + action + ']', msg);
    return res.status(200).json({ ok: false, error: msg });
  }
};
