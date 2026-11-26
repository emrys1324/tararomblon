/* Tara Romblon — server environment for the shared core.
   Supabase (Postgres via the REST API, files via Storage), Resend for email, HitPay for payments.
   No npm packages needed: everything uses the built-in fetch and crypto of Node 18+. */
const crypto = require('crypto');

const E = (k, d = '') => (process.env[k] == null ? d : String(process.env[k]).trim());
const SB = () => E('SUPABASE_URL').replace(/\/+$/, '');
const KEY = () => E('SUPABASE_SERVICE_ROLE_KEY');
const TABLES = ['customers', 'staff', 'bookings', 'threads', 'messages', 'events', 'applications', 'payouts', 'points'];
const PAGE = 1000; // Supabase returns at most 1000 rows per request by default

function need() {
  if (!SB() || !KEY()) throw new Error('Server is not set up yet: add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel > Settings > Environment Variables, then redeploy.');
}
async function rest(path, opt = {}) {
  need();
  const r = await fetch(SB() + '/rest/v1/' + path, {
    method: opt.method || 'GET',
    headers: Object.assign({ apikey: KEY(), Authorization: 'Bearer ' + KEY(), 'Content-Type': 'application/json' }, opt.headers || {}),
    body: opt.body == null ? undefined : JSON.stringify(opt.body)
  });
  const text = await r.text();
  if (!r.ok) { console.error('Supabase', r.status, path, text.slice(0, 300)); throw new Error('Database error (' + r.status + '). Please try again.'); }
  return text ? JSON.parse(text) : null;
}
const tbl = t => { if (TABLES.indexOf(t) < 0) throw new Error('Unknown table ' + t); return t; };
const enc = encodeURIComponent;

/* One env per request. Reads are remembered for the rest of the request so the core can call db.all() freely. */
function createEnv() {
  const memo = {};
  const remember = (t, rows) => (memo[t] = rows);
  const touch = (t, o) => { if (!memo[t]) return; const i = memo[t].findIndex(x => x.id === o.id); if (i >= 0) memo[t][i] = o; else memo[t].push(o); };

  const db = {
    async all(t) {
      if (memo[tbl(t)]) return memo[t];
      let out = [], from = 0;
      for (;;) {
        const rows = await rest(t + '?select=data&order=seq.asc&limit=' + PAGE + '&offset=' + from);
        out = out.concat(rows.map(r => r.data));
        if (rows.length < PAGE) break; from += PAGE;
      }
      return remember(t, out);
    },
    async get(t, id) {
      if (memo[tbl(t)]) return memo[t].find(x => x.id === id) || null;
      const rows = await rest(t + '?select=data&id=eq.' + enc(id) + '&limit=1');
      return rows[0] ? rows[0].data : null;
    },
    async byToken(t, token) {
      if (!/^[A-Za-z0-9-]{20,80}$/.test(token)) return null;
      const rows = await rest(tbl(t) + '?select=data&data->tokens=cs.' + enc(JSON.stringify([token])) + '&limit=1');
      return rows[0] ? rows[0].data : null;
    },
    async put(t, o) {
      await rest(tbl(t) + '?on_conflict=id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: { id: o.id, data: o, updated_at: new Date().toISOString() } });
      touch(t, o);
    },
    async tail(t, n) {
      const rows = await rest(tbl(t) + '?select=data&order=seq.desc&limit=' + (+n || 100));
      return rows.map(r => r.data).reverse();
    },
    async replaceAll(t, list) {
      await rest(tbl(t) + '?id=not.is.null', { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      if (list.length) await rest(t, { method: 'POST', headers: { Prefer: 'return=minimal' }, body: list.map(o => ({ id: o.id, data: o })) });
      memo[t] = list.slice();
    },
    async kvGet(k) {
      if (('kv:' + k) in memo) return memo['kv:' + k];
      const rows = await rest('kv?select=value&key=eq.' + enc(k) + '&limit=1');
      return (memo['kv:' + k] = rows[0] ? rows[0].value : null);
    },
    async kvPut(k, v) {
      await rest('kv?on_conflict=key', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: { key: k, value: v, updated_at: new Date().toISOString() } });
      memo['kv:' + k] = v;
    }
  };

  const cache = {
    async get(k) {
      const rows = await rest('cache?select=value&key=eq.' + enc(k) + '&expires_at=gt.' + enc(new Date().toISOString()) + '&limit=1');
      return rows[0] ? rows[0].value : null;
    },
    async put(k, v, sec) {
      await rest('cache?on_conflict=key', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: { key: k, value: String(v), expires_at: new Date(Date.now() + (sec || 600) * 1000).toISOString() } });
    },
    async remove(k) { await rest('cache?key=eq.' + enc(k), { method: 'DELETE', headers: { Prefer: 'return=minimal' } }); }
  };

  /* Storage: "photos" bucket is public (listing photos), "uploads" bucket is private (IDs, payment proofs). */
  const files = {
    async save(dataUrl, name, priv) {
      need();
      const m = /^data:([\w/+.-]+);base64,(.+)$/.exec(String(dataUrl || ''));
      if (!m) throw new Error('Unsupported file. Please upload a photo.');
      const type = m[1], ext = (type.split('/')[1] || 'bin').replace('jpeg', 'jpg').replace(/[^a-z0-9]/g, '');
      if (!/^image\//.test(type)) throw new Error('Please upload an image file.');
      const bytes = Buffer.from(m[2], 'base64');
      if (bytes.length > 3.5 * 1024 * 1024) throw new Error('That photo is too large. Try a smaller one.');
      const bucket = priv ? 'uploads' : 'photos';
      const path = new Date().toISOString().slice(0, 7) + '/' + String(name || 'file').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) + '-' + crypto.randomUUID().slice(0, 8) + '.' + ext;
      const r = await fetch(SB() + '/storage/v1/object/' + bucket + '/' + path, { method: 'POST', headers: { apikey: KEY(), Authorization: 'Bearer ' + KEY(), 'Content-Type': type, 'x-upsert': 'true' }, body: bytes });
      if (!r.ok) { console.error('Storage', r.status, await r.text()); throw new Error('Upload failed. Please try again.'); }
      return { id: bucket + '/' + path, url: priv ? '' : SB() + '/storage/v1/object/public/' + bucket + '/' + path };
    },
    /* Private files are shown through a signed link that works for 10 minutes */
    async read(id) {
      need();
      if (!/^uploads\//.test(String(id || ''))) return '';
      const r = await fetch(SB() + '/storage/v1/object/sign/' + id, { method: 'POST', headers: { apikey: KEY(), Authorization: 'Bearer ' + KEY(), 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 600 }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.signedURL) throw new Error('File not found.');
      return SB() + '/storage/v1' + j.signedURL;
    }
  };

  const hitpay = {
    base: () => (E('HITPAY_SANDBOX', 'true') === 'true' ? 'https://api.sandbox.hit-pay.com/v1/' : 'https://api.hit-pay.com/v1/'),
    async create(o) {
      const key = E('HITPAY_API_KEY'); if (!key) return null;
      const form = new URLSearchParams({ amount: Number(o.amount).toFixed(2), currency: 'PHP', email: o.email || '', name: o.name || '', phone: o.phone || '', purpose: String(o.purpose || '').slice(0, 250), reference_number: o.ref, redirect_url: E('SITE_URL').replace(/\/+$/, '') + '/?paid=' + enc(o.ref) });
      const r = await fetch(hitpay.base() + 'payment-requests', { method: 'POST', headers: { 'X-BUSINESS-API-KEY': key, 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/x-www-form-urlencoded' }, body: form });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.url) throw new Error('Payment link could not be created. Please try again or contact us. (' + (j.message || r.status) + ')');
      return { id: j.id, url: j.url };
    },
    async status(id) {
      const key = E('HITPAY_API_KEY'); if (!key || !id) return '';
      const r = await fetch(hitpay.base() + 'payment-requests/' + enc(id), { headers: { 'X-BUSINESS-API-KEY': key, 'X-Requested-With': 'XMLHttpRequest' } });
      const j = await r.json().catch(() => null); if (!j) return '';
      return String(j.status).toLowerCase() === 'completed' || (j.payments || []).some(p => String(p.status).toLowerCase() === 'succeeded') ? 'completed' : String(j.status || '');
    }
  };

  async function mail(to, subject, body) {
    const key = E('RESEND_API_KEY');
    if (!key) { console.log('[mail skipped: RESEND_API_KEY not set]', to, subject); return; }
    const cat = await db.kvGet('catalog').catch(() => null);
    const name = (cat && cat.business && cat.business.name) || 'Tara Romblon';
    const from = E('MAIL_FROM') ? (E('MAIL_FROM').indexOf('<') >= 0 ? E('MAIL_FROM') : name + ' <' + E('MAIL_FROM') + '>') : name + ' <onboarding@resend.dev>';
    const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [to], subject: String(subject).slice(0, 250), text: body }) });
    if (!r.ok) console.error('Resend', r.status, (await r.text()).slice(0, 300));
  }

  /* Loyverse POS (reward points for Pahuway Café): personal access token from Loyverse Back Office > Access tokens */
  const LV = 'https://api.loyverse.com/v1.0/';
  async function lv(token, path, opt = {}) {
    const r = await fetch(LV + path, { method: opt.method || 'GET', headers: { Authorization: 'Bearer ' + token, Accept: 'application/json', 'Content-Type': 'application/json' }, body: opt.body ? JSON.stringify(opt.body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((j.errors && j.errors[0] && (j.errors[0].details || j.errors[0].code)) || 'Loyverse error ' + r.status);
    return j;
  }
  const digits = x => String(x || '').replace(/\D/g, '').slice(-10);
  const loyverse = {
    async test(token) { await lv(token, 'customers?limit=1'); return true; },
    /* finds the Loyverse customer by registered mobile number first, then by email */
    async find(token, email, phone) {
      const e = String(email || '').toLowerCase(), ph = digits(phone);
      let cursor = '', pages = 0, byEmail = null;
      do {
        const j = await lv(token, 'customers?limit=250' + (cursor ? '&cursor=' + enc(cursor) : ''));
        for (const x of j.customers || []) {
          if (ph && digits(x.phone_number) === ph) return x;
          if (!byEmail && e && String(x.email || '').toLowerCase() === e) byEmail = x;
        }
        cursor = j.cursor || ''; pages++;
      } while (cursor && pages < 20);
      return byEmail;
    },
    /* create (no id) or update (with id): Loyverse needs the full customer record */
    async save(token, c) {
      const keep = ['id', 'name', 'email', 'phone_number', 'address', 'city', 'region', 'postal_code', 'country_code', 'customer_code', 'note', 'total_points'], body = {};
      keep.forEach(k => { if (c[k] != null && c[k] !== '') body[k] = c[k]; });
      return await lv(token, 'customers', { method: 'POST', body });
    }
  };

  /* Google sign-in: check the ID token with Google, and that it was made for this site (aud = GOOGLE_CLIENT_ID) */
  async function verifyGoogle(idToken) {
    const clientId = E('GOOGLE_CLIENT_ID');
    if (!clientId) throw new Error('Google sign-in is not set up yet.');
    if (!/^[A-Za-z0-9._-]{100,4096}$/.test(idToken || '')) throw new Error('Google sign-in failed. Please try again.');
    const r = await fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken));
    const g = await r.json().catch(() => ({}));
    const fresh = +g.exp * 1000 > Date.now();
    const verified = g.email_verified === true || g.email_verified === 'true';
    if (!r.ok || g.aud !== clientId || !['accounts.google.com', 'https://accounts.google.com'].includes(g.iss) || !fresh || !verified || !g.email) {
      console.warn('Google sign-in rejected', r.status, g.aud === clientId, g.iss, fresh, verified);
      throw new Error('Google sign-in failed. Please try again.');
    }
    return { email: String(g.email).toLowerCase(), name: String(g.name || '').slice(0, 120) };
  }

  /* Web Push (phone notifications) with built-in crypto: VAPID keys are created once and kept in the kv table */
  let vapid = null;
  async function vapidKeys() {
    if (vapid) return vapid;
    let v = await db.kvGet('vapid').catch(() => null);
    if (!v || !v.jwk) {
      const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
      const jwk = privateKey.export({ format: 'jwk' });
      v = { jwk, pub: b64u(Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')])), created: new Date().toISOString() };
      await db.kvPut('vapid', v);
    }
    return (vapid = v);
  }
  async function push(sub, msg) {
    try {
      const v = await vapidKeys(), url = new URL(sub.endpoint);
      const jwtB = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' })) + '.' + b64u(JSON.stringify({ aud: url.origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: 'mailto:' + (E('NOTIFY_EMAIL') || 'admin@example.com') }));
      const sig = crypto.sign('sha256', Buffer.from(jwtB), { key: crypto.createPrivateKey({ key: v.jwk, format: 'jwk' }), dsaEncoding: 'ieee-p1363' });
      const body = encryptPush(Buffer.from(JSON.stringify(msg)), Buffer.from(sub.keys.p256dh, 'base64url'), Buffer.from(sub.keys.auth, 'base64url'));
      const r = await fetch(sub.endpoint, { method: 'POST', headers: { TTL: '86400', Urgency: 'high', 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', Authorization: 'vapid t=' + jwtB + '.' + b64u(sig) + ', k=' + v.pub }, body });
      if (r.status === 404 || r.status === 410) return 'gone';
      if (!r.ok) console.error('push', r.status, (await r.text().catch(() => '')).slice(0, 200));
      return r.ok ? 'ok' : 'error';
    } catch (e) { console.error('push', e.message); return 'error'; }
  }
  const ph = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10); // Philippine date
  return {
    demo: false, defaultCatalog: null, siteUrl: E('SITE_URL'), notifyEmail: E('NOTIFY_EMAIL').toLowerCase(),
    now: () => new Date().toISOString(), today: ph, uuid: () => crypto.randomUUID(),
    db, cache, files, hitpay, mail, loyverse, loyverseToken: E('LOYVERSE_TOKEN'),
    /* public OAuth client ID for "Continue with Google" (not a secret) */
    googleClientId: E('GOOGLE_CLIENT_ID') || null, verifyGoogle,
    /* passwords: scrypt with a random salt per account */
    hashPw: async (pw, salt) => crypto.scryptSync(String(pw), 'tr:' + salt, 32).toString('hex'),
    push, pushKey: async () => (await vapidKeys()).pub,
    /* public browser key (restrict it to your site in Google Cloud) */
    maps: E('GOOGLE_MAPS_API_KEY') ? { key: E('GOOGLE_MAPS_API_KEY'), mapId: E('GOOGLE_MAPS_MAP_ID', 'DEMO_MAP_ID') } : null
  };
}

function b64u(x) { return Buffer.from(x).toString('base64url'); }
/* RFC 8291 message encryption (aes128gcm) for a push subscription */
function encryptPush(plain, uaPub, authSecret) {
  const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys(); const asPub = ecdh.getPublicKey(), secret = ecdh.computeSecret(uaPub);
  const hmac = (k, d) => crypto.createHmac('sha256', k).update(d).digest();
  const ikm = hmac(hmac(authSecret, secret), Buffer.concat([Buffer.from('WebPush: info\0'), uaPub, asPub, Buffer.from([1])]));
  const salt = crypto.randomBytes(16), prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01', 'binary')).subarray(0, 16), nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01', 'binary')).subarray(0, 12);
  const c = crypto.createCipheriv('aes-128-gcm', cek, nonce), ct = Buffer.concat([c.update(Buffer.concat([plain, Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([salt, rs, Buffer.from([asPub.length]), asPub, ct]);
}
/* HitPay webhook check: Hitpay-Signature = hex HMAC-SHA256 of the raw body, keyed with the webhook endpoint's salt */
function hitpaySignatureOk(raw, sig) {
  const salt = E('HITPAY_SALT'); if (!salt || !sig) return false;
  const want = crypto.createHmac('sha256', salt).update(raw).digest('hex');
  const a = Buffer.from(want), b = Buffer.from(String(sig).trim().toLowerCase());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { createEnv, hitpaySignatureOk, E, encryptPush };
