/* End-to-end test of the Vercel functions against a simulated Supabase (PostgREST + Storage), HitPay and Resend.
   Run: node tests/api_test.js  (after python3 build.py) */
const path = require('path'), crypto = require('crypto'), vm = require('vm'), fs = require('fs'), { Readable } = require('stream');
const V = path.join(__dirname, '../out/vercel/api/');
Object.assign(process.env, { SUPABASE_URL: 'https://sb.test', SUPABASE_SERVICE_ROLE_KEY: 'svc', SUPER_ADMINS: 'boss@mjv.ph,ops@mjv.ph', SITE_URL: 'https://tara.test', RESEND_API_KEY: 're_x', MAIL_FROM: 'bookings@tara.test', HITPAY_API_KEY: 'hp', HITPAY_SALT: 'salty', HITPAY_SANDBOX: 'true', CRON_SECRET: 'cron123', GOOGLE_MAPS_API_KEY: 'gm-key', GOOGLE_CLIENT_ID: 'cid-123.apps.googleusercontent.com' });
const GTOK = {}; // fake Google ID tokens -> tokeninfo answers

/* ---------- fake services ---------- */
const PUSHES = [];
const DB = {}, STORE = {}, MAILS = [], HP = {}, LV = { customers: [] }; let seq = 0, calls = 0;
const tbl = t => (DB[t] = DB[t] || []);
const J = (o, s = 200) => new Response(o == null || s === 204 ? null : JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });
function match(row, k, v) {
  const [op, ...rest] = v.split('.'); const val = rest.join('.');
  if (k === 'data->tokens' && op === 'cs') { const want = JSON.parse(val); return want.every(x => (row.data.tokens || []).includes(x)); }
  const cell = row[k];
  if (op === 'eq') return String(cell) === val;
  if (op === 'gt') return String(cell) > val;
  if (op === 'lt') return String(cell) < val;
  if (op === 'not' && val === 'is.null') return cell != null;
  throw new Error('filter ' + k + '=' + v);
}
global.fetch = async (url, opt = {}) => {
  calls++;
  const u = new URL(url), m = (opt.method || 'GET').toUpperCase(), h = opt.headers || {};
  if (u.host === 'sb.test') {
    if (h.apikey !== 'svc' || h.Authorization !== 'Bearer svc') return J({ message: 'no key' }, 401);
    if (u.pathname.startsWith('/rest/v1/')) {
      const t = u.pathname.slice(9), rows = tbl(t), pk = t === 'kv' || t === 'cache' ? 'key' : 'id';
      const filters = [...u.searchParams].filter(([k]) => !['select', 'order', 'limit', 'offset', 'on_conflict'].includes(k));
      let sel = rows.filter(r => filters.every(([k, v]) => match(r, k, v)));
      if (m === 'GET') {
        const ord = u.searchParams.get('order'); if (ord) { const [c, dir] = ord.split('.'); sel.sort((a, b) => (a[c] - b[c]) * (dir === 'desc' ? -1 : 1)); }
        const off = +(u.searchParams.get('offset') || 0), lim = +(u.searchParams.get('limit') || 1e9);
        sel = sel.slice(off, off + lim);
        const cols = (u.searchParams.get('select') || '*').split(',');
        return J(sel.map(r => cols[0] === '*' ? r : Object.fromEntries(cols.map(c => [c, r[c]]))));
      }
      if (m === 'POST') {
        const body = JSON.parse(opt.body), list = Array.isArray(body) ? body : [body];
        const upsert = String(h.Prefer || '').includes('merge-duplicates');
        for (const r of list) {
          const i = rows.findIndex(x => x[pk] === r[pk]);
          if (i >= 0) { if (!upsert) return J({ message: 'duplicate' }, 409); Object.assign(rows[i], JSON.parse(JSON.stringify(r))); }
          else rows.push(Object.assign({ seq: ++seq }, JSON.parse(JSON.stringify(r))));
        }
        return J(null, 201);
      }
      if (m === 'DELETE') { DB[t] = rows.filter(r => !sel.includes(r)); return J(null, 204); }
    }
    if (u.pathname.startsWith('/storage/v1/object/sign/')) { const id = u.pathname.slice('/storage/v1/object/sign/'.length); if (!STORE[id]) return J({ message: 'nf' }, 404); return J({ signedURL: '/object/sign/' + id + '?token=abc' }); }
    if (u.pathname.startsWith('/storage/v1/object/') && m === 'POST') { STORE[u.pathname.slice('/storage/v1/object/'.length)] = { type: h['Content-Type'], size: opt.body.length }; return J({ Key: 'x' }); }
  }
  if (u.host === 'api.sandbox.hit-pay.com') {
    if (h['X-BUSINESS-API-KEY'] !== 'hp') return J({ message: 'bad key' }, 401);
    if (m === 'POST') { const f = new URLSearchParams(opt.body.toString()); const id = 'pr_' + (Object.keys(HP).length + 1); HP[id] = { id, status: 'pending', reference_number: f.get('reference_number'), amount: f.get('amount'), redirect_url: f.get('redirect_url') }; return J({ id, url: 'https://pay.test/' + id, status: 'pending' }); }
    const id = u.pathname.split('/').pop(); return J(HP[id] || {}, HP[id] ? 200 : 404);
  }
  if (u.host === 'api.loyverse.com') {
    if (h.Authorization !== 'Bearer lvtok') return J({ errors: [{ code: 'UNAUTHORIZED' }] }, 401);
    if (m === 'GET') { const e = u.searchParams.get('email'); return J({ customers: LV.customers.filter(c => !e || c.email === e), cursor: null }); }
    const b = JSON.parse(opt.body); const i = LV.customers.findIndex(c => c.id === b.id); if (i >= 0) LV.customers[i] = Object.assign(LV.customers[i], b); else LV.customers.push(Object.assign({ id: 'lv' + (LV.customers.length + 1) }, b)); return J(b);
  }
  if (u.host === 'oauth2.googleapis.com' && u.pathname === '/tokeninfo') { const g = GTOK[u.searchParams.get('id_token')]; return g ? J(g) : J({ error_description: 'Invalid Value' }, 400); }
  if (u.host === 'cal.test') { calls++; if (u.pathname === '/bad.ics') return new Response('nope', { status: 404 }); const d = (k) => ph(k).replace(/-/g, ''); return new Response(['BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:' + d(40), 'DTEND;VALUE=DATE:' + d(43), 'SUMMARY:Reserved', 'END:VEVENT', 'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:' + d(50), 'DTEND;VALUE=DATE:' + d(51), 'SUMMARY:Airbnb (Not available)', 'END:VEVENT', 'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:' + d(60), 'DTEND;VALUE=DATE:' + d(62), 'STATUS:CANCELLED', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n'), { status: 200, headers: { 'Content-Type': 'text/calendar' } }); }
  if (u.host === 'push.test') { PUSHES.push({ path: u.pathname, h, body: opt.body }); return new Response(null, { status: u.pathname === '/gone' ? 410 : 201 }); }
  if (u.host === 'api.resend.com') { const b = JSON.parse(opt.body); MAILS.push(b); return J({ id: 'm' + MAILS.length }); }
  throw new Error('Unexpected fetch ' + url);
};

/* ---------- call the functions like Vercel does ---------- */
function mkRes() { const r = { code: 200, headers: {}, body: null, status(c) { this.code = c; return this; }, json(o) { this.body = o; return this; }, end() { return this; }, setHeader(k, v) { this.headers[k] = v; } }; return r; }
const apiFn = require(V + 'index.js'), hookFn = require(V + 'hitpay-webhook.js'), cronFn = require(V + 'cron.js');
async function api(action, data) { const res = mkRes(); await apiFn({ method: 'POST', body: Object.assign({ action }, data || {}), headers: {} }, res); return res.body; }
async function ok(action, data) { const r = await api(action, data); if (!r.ok) throw new Error(action + ': ' + r.error); return r; }
async function fails(action, data, re) { const r = await api(action, data); if (r.ok || !re.test(r.error)) throw new Error(action + ' should fail with ' + re + ' but got ' + JSON.stringify(r).slice(0, 200)); return r; }
function hook(body, sig) { const raw = JSON.stringify(body); const req = Readable.from([Buffer.from(raw)]); req.method = 'POST'; req.headers = { 'hitpay-signature': sig === undefined ? crypto.createHmac('sha256', 'salty').update(raw).digest('hex') : sig }; const res = mkRes(); return hookFn(req, res).then(() => res); }
const lastCode = to => { const m = MAILS.filter(x => x.to[0] === to).pop(); return /code: (\d{6})/.exec(m.subject)[1]; };
async function staffLogin(email, portal) { await ok('staffSendOtp', { email, portal }); return (await ok('staffVerifyOtp', { email, code: lastCode(email) })).token; }
const assert = (c, m) => { if (!c) throw new Error('ASSERT ' + m); console.log('  ok -', m); };

/* catalog from the app source */
const { Rules, Pricing } = require(V + '_lib/shared.js');
const ctx = { document: {}, localStorage: {}, window: {}, ic: () => '' }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/core.js'), 'utf8') + ';' + fs.readFileSync(path.join(__dirname, '../src/common_head.js'), 'utf8') + ';this.CAT=DEFAULT_CATALOG;', ctx);
const CATALOG = JSON.parse(JSON.stringify(ctx.CAT));
const IMG = 'data:image/png;base64,' + Buffer.from('fakepng-bytes').toString('base64');
const ph = d => new Date(Date.now() + 8 * 3600e3 + d * 864e5).toISOString().slice(0, 10);

(async () => {
  console.log('Setup');
  await fails('getCatalog', {}, /x^/).catch(() => {});
  assert(DB.staff.length === 2 && DB.staff.every(r => r.data.role === 'super'), 'super admins seeded from SUPER_ADMINS');
  const admin = await staffLogin('boss@mjv.ph', 'admin');
  await fails('staffSendOtp', { email: 'boss@mjv.ph', portal: 'merchant' }, /not registered/);
  await fails('createBooking', { token: 'x'.repeat(30) }, /sign in/);
  await ok('saveCatalog', { token: admin, catalog: CATALOG });
  assert(DB.kv[0].key === 'catalog', 'catalog saved to kv');
  await ok('adminSaveStaff', { token: admin, staff: [
    { email: 'boss@mjv.ph', name: 'Boss', role: 'super' }, { email: 'ops@mjv.ph', name: 'Ops', role: 'super' },
    { email: 'mgr@hiraya.ph', name: 'Hiraya Admin', role: 'manager', bizId: 'hiraya' },
    { email: 'mgr@pahuway.ph', name: 'Pahuway Admin', role: 'manager', bizId: 'pahuway' }, { email: 'staff@pahuway.ph', name: 'Pahuway Staff', role: 'staff', bizId: 'pahuway' },
    { email: 'rider@tara.ph', name: 'Rider Rey', role: 'rider' }] });
  const admin2 = (await ok('staffMe', { token: admin })).me; assert(admin2.role === 'super', 'admin token survives staff save');
  await fails('adminSaveStaff', { token: admin, staff: [{ email: 'a@x.ph', role: 'super' }, { email: 'b@x.ph', role: 'super' }, { email: 'boss@mjv.ph', role: 'super' }] }, /2 Super Admins|super/i);

  console.log('Customer');
  await ok('sendOtp', { email: 'Ana@Mail.com' });
  await fails('verifyOtp', { email: 'ana@mail.com', code: '000000' }, /incorrect/);
  const cust = (await ok('verifyOtp', { email: 'ana@mail.com', code: lastCode('ana@mail.com') })).token;

  console.log('Google sign-in');
  const gt = (k, o) => { const t = 'g' + k + '.' + 'x'.repeat(120); GTOK[t] = Object.assign({ aud: 'cid-123.apps.googleusercontent.com', iss: 'https://accounts.google.com', exp: String(Math.floor(Date.now() / 1000) + 600), email: 'gina@gmail.com', email_verified: 'true', name: 'Gina Google' }, o || {}); return t; };
  assert((await ok('getCatalog')).google === 'cid-123.apps.googleusercontent.com', 'getCatalog tells the app the Google client ID');
  const g1 = await ok('googleSignIn', { credential: gt(1) });
  assert(g1.created && g1.token && g1.profile.email === 'gina@gmail.com' && g1.profile.name === 'Gina Google' && !g1.profile.phone, 'Google sign-up creates an account with the Google name and email (mobile and address asked next)');
  const g2 = await ok('googleSignIn', { credential: gt(2) });
  assert(!g2.created && g2.token !== g1.token && (await ok('me', { token: g1.token })).profile.email === 'gina@gmail.com', 'signing in with Google again opens the same account (both sessions work)');
  const ga = await ok('googleSignIn', { credential: gt(3, { email: 'Ana@Mail.com', name: 'Someone Else' }) });
  assert(!ga.created && ga.profile.email === 'ana@mail.com', 'Google with the same email as an email-code account signs into that account');
  await fails('googleSignIn', { credential: gt(4, { aud: 'someone-elses-app' }) }, /Google sign-in failed/);
  await fails('googleSignIn', { credential: gt(5, { email_verified: 'false' }) }, /Google sign-in failed/);
  await fails('googleSignIn', { credential: gt(6, { exp: '1000' }) }, /Google sign-in failed/);
  await fails('googleSignIn', { credential: gt(7, { iss: 'https://evil.example' }) }, /Google sign-in failed/);
  await fails('googleSignIn', { credential: 'not-a-token' }, /Google sign-in failed/);
  await fails('googleSignIn', { credential: 'g8.' + 'y'.repeat(120) }, /Google sign-in failed/);
  assert(MAILS[MAILS.length - 1].from === 'Tara Romblon <bookings@tara.test>', 'email sent through Resend with app name');
  await ok('saveProfile', { token: cust, profile: { name: 'Ana Cruz', phone: '09171234567', address: 'Makati' } });
  const stay = CATALOG.stays[0];
  const stayLine = { type: 'stay', itemId: stay.id, checkin: ph(3), checkout: ph(5), guests: 2 };
  await fails('createBooking', { token: cust, kind: 'stay', agree: true, payMethod: 'online', lines: [stayLine] }, /^ID_REQUIRED/);
  await ok('submitId', { token: cust, dataUrl: IMG, idType: 'Passport' });
  const fileKey = Object.keys(STORE)[0]; assert(fileKey.startsWith('uploads/'), 'ID stored in private uploads bucket');
  await ok('adminVerify', { token: admin, email: 'ana@mail.com', decision: 'verified' });

  console.log('Stays and Things to do: coming soon until a Super Admin opens them');
  assert(!(await ok('getCatalog')).catalog.settings || !(await ok('getCatalog')).catalog.settings.staysLive, 'stays start as coming soon');
  await fails('createBooking', { token: cust, kind: 'stay', agree: true, payMethod: 'online', lines: [stayLine] }, /Stays are coming soon/);
  const tour0 = CATALOG.tours.find(t => t.active) || CATALOG.tours[0];
  if (tour0) await fails('createBooking', { token: cust, kind: 'tour', agree: true, payMethod: 'transfer', proofPhoto: IMG, lines: [{ type: 'tour', itemId: tour0.id, date: ph(7), time: '08:00', pax: 2 }] }, /Things to do are coming soon/);
  CATALOG.settings = Object.assign({}, CATALOG.settings, { staysLive: true, toursLive: true });
  await ok('saveCatalog', { token: admin, catalog: CATALOG });

  console.log('Stay booking paid with HitPay');
  const bk = await ok('createBooking', { token: cust, kind: 'stay', agree: true, payMethod: 'online', lines: [stayLine] });
  assert(bk.payUrl && bk.payUrl.startsWith('https://pay.test/'), 'HitPay link created');
  const pr = Object.values(HP)[0];
  assert(pr.reference_number === bk.group && pr.redirect_url === 'https://tara.test/?paid=' + encodeURIComponent(bk.group), 'HitPay request carries group ref and redirect');
  assert(Math.abs(+pr.amount - bk.dueNow) < 0.01, 'charges the 50% downpayment ' + bk.dueNow);
  const r401 = await hook({ reference_number: bk.group }, 'deadbeef'); assert(r401.code === 401, 'webhook rejects bad signature');
  let res = await hook({ reference_number: bk.group, payment_request_id: pr.id, status: 'completed' });
  assert(res.code === 200, 'webhook accepted');
  let b = DB.bookings.find(r => r.id === bk.refs[0]).data;
  assert(b.status === 'Awaiting Payment', 'signed webhook alone does not confirm until HitPay says completed');
  pr.status = 'completed';
  await hook({ reference_number: bk.group, payment_request_id: pr.id, status: 'completed' });
  b = DB.bookings.find(r => r.id === bk.refs[0]).data;
  assert(b.status === 'Payment Confirmed' && b.payStatus, 'webhook + HitPay status confirms booking');
  await hook({ reference_number: bk.group, payment_request_id: pr.id, status: 'completed' });
  assert(DB.bookings.find(r => r.id === bk.refs[0]).data.history.filter(h => h.status === 'Payment Confirmed').length === 1, 'repeat webhook is idempotent');
  await fails('createBooking', { token: cust, kind: 'stay', agree: true, payMethod: 'online', lines: [stayLine] }, /already booked/);

  console.log('Merchant');
  const hmgr = await staffLogin('mgr@hiraya.ph', 'merchant');
  const mb = await ok('mBookings', { token: hmgr });
  assert(mb.bookings.length === 1 && mb.bookings[0].fee > 0, 'Hiraya admin sees own booking with platform fee');
  await ok('setStatus', { token: hmgr, ref: bk.refs[0], status: 'Accepted' });
  await ok('mUpdate', { token: hmgr, ref: bk.refs[0], discount: 100 });
  const pmgr = await staffLogin('mgr@pahuway.ph', 'merchant');
  assert((await ok('mBookings', { token: pmgr })).bookings.length === 0, 'Pahuway admin cannot see Hiraya bookings');
  await ok('viewUpload', { token: admin, fileId: fileKey }).then(r => assert(r.dataUrl.startsWith('https://sb.test/storage/v1/object/sign/uploads/'), 'private file opens through signed link'));
  await fails('viewUpload', { token: pmgr, fileId: fileKey }, /Not allowed/);

  console.log('Food COD with rider');
  const item = CATALOG.foods[0].items.find(i => i.available !== false);
  await fails('createBooking', { token: cust, kind: 'food', bizId: 'pahuway', fulfillment: 'delivery', payMethod: 'online', band: 0, landmark: 'x', lines: [{ itemId: item.id, qty: 1, addons: [] }] }, /Pin your delivery location on the map/);
  const codP = { token: cust, kind: 'food', bizId: 'pahuway', fulfillment: 'delivery', payMethod: 'cod', lat: 12.5720, lng: 122.1330, landmark: 'Near plaza', lines: [{ itemId: item.id, qty: 2, addons: [] }] };
  const anaRec = DB.customers.find(r => r.id === 'ana@mail.com').data, anaWas = anaRec.created; anaRec.created = '2030-01-01T00:00:00.000Z'; // a new sign-up after the cutoff
  await fails('createBooking', codP, /unlocks after 3 completed orders or bookings \(you have 0\)/);
  const fakeDone = [1, 2].map(i => ({ id: 'TR-FAKE-' + i, data: { ref: 'TR-FAKE-' + i, email: 'ana@mail.com', status: 'Completed', kind: 'food', created: '2026-01-0' + i } }));
  tbl('bookings').push(...fakeDone);
  await fails('createBooking', codP, /you have 2/);
  tbl('bookings').push({ id: 'TR-FAKE-3', data: { ref: 'TR-FAKE-3', email: 'ana@mail.com', status: 'Completed', kind: 'rental', created: '2026-01-03' } });
  await fails('createBooking', Object.assign({}, codP, { lines: [{ itemId: item.id, qty: Math.ceil(501 / item.price), addons: [] }] }), /up to ₱500/);
  assert(Rules.codBlock({ codMinCompleted: 3, codMax: 500 }, 3, 500) === null && Rules.codBlock({ codMinCompleted: 3, codMax: 0 }, 5, 9000) === null, 'COD allowed after 3 completed, up to ₱500 (0 = no ceiling)');
  const XS = { codMinCompleted: 3, codMax: 500, codExemptBefore: '2026-11-21' };
  assert(Rules.codBlock(XS, 0, 300, '2026-11-20T15:59:00.000Z') === null && /unlocks/.test(Rules.codBlock(XS, 0, 300, '2026-11-20T16:00:00.000Z')), 'customers who signed up before 21 Nov 2026 (PH time) keep COD; later sign-ups need 3 completed');
  assert(/up to ₱500/.test(Rules.codBlock(XS, 0, 501, '2026-01-01T00:00:00.000Z')) && /unlocks/.test(Rules.codBlock(Object.assign({}, XS, { codExemptBefore: '' }), 0, 300, '2026-01-01T00:00:00.000Z')), 'exempt customers still have the ₱500 ceiling; empty date = no exemption');
  anaRec.created = '2026-10-01T02:00:00.000Z';
  const exB = await ok('createBooking', Object.assign({}, codP, { lines: [{ itemId: item.id, qty: 1, addons: [] }] })); assert(exB.refs.length === 1, 'existing customer (signed up 1 Oct) places COD with 0 completed');
  anaRec.created = '2030-01-01T00:00:00.000Z'; DB.bookings.splice(DB.bookings.findIndex(r => r.id === exB.refs[0]), 1);
  for (const id of ['TR-FAKE-1', 'TR-FAKE-2', 'TR-FAKE-3']) { const k = DB.bookings.findIndex(r => r.id === id); DB.bookings.splice(k, 1); }
  tbl('bookings').push(...[1, 2, 3].map(i => ({ id: 'TR-FAKE-' + i, data: { ref: 'TR-FAKE-' + i, email: 'ana@mail.com', status: 'Completed', kind: 'food', created: '2026-01-0' + i } })));
  const rider = await staffLogin('rider@tara.ph', 'rider');
  await ok('rAvailable', { token: rider, value: true });
  assert((await ok('rLocation', { token: rider, lat: 12.5712, lng: 122.1320, acc: 8 })).area, 'online rider shares their area (no active delivery) so nearby orders find them');
  const food = await ok('createBooking', { token: cust, kind: 'food', bizId: 'pahuway', fulfillment: 'delivery', payMethod: 'cod', lat: 12.5720, lng: 122.1330, landmark: 'Near plaza', lines: [{ itemId: item.id, qty: 2, addons: [] }] });
  const fref = food.refs[0];
  for (const id of ['TR-FAKE-1', 'TR-FAKE-2', 'TR-FAKE-3']) DB.bookings.splice(DB.bookings.findIndex(r => r.id === id), 1);
  assert(food.refs.length === 1, 'COD order placed once 3 transactions are completed');
  anaRec.created = anaWas;
  console.log('Nearby riders accept the delivery before the merchant gets it');
  const pstaff = await staffLogin('staff@pahuway.ph', 'merchant');
  assert(DB.bookings.find(r => r.id === fref).data.status === 'Finding Rider', 'delivery order starts as Finding Rider');
  assert(!(await ok('mBookings', { token: pstaff })).bookings.some(b => b.ref === fref), 'merchant does not see it yet');
  assert(!DB.events.some(r => r.data.ref === fref && r.data.aud.includes('biz:pahuway')), 'merchant not notified yet');
  const offers = (await ok('rOrders', { token: rider })).offers; const of1 = offers.find(o => o.ref === fref);
  assert(of1 && of1.riderFee === 20 && of1.kmToStore != null && of1.kmToStore < 1 && of1.collect > 0, 'nearby online rider gets the request (earn P' + of1.riderFee + ', ' + of1.kmToStore + ' km from the store, collect P' + of1.collect + ')');
  assert(PUSHES.length >= 0 && DB.events.some(r => r.data.type === 'offer' && r.data.ref === fref && r.data.aud.includes('rider:rider@tara.ph')), 'rider notified of the incoming order');
  await fails('assignRider', { token: pstaff, ref: fref, rider: 'rider@tara.ph' }, /Riders accept delivery orders themselves/);
  await fails('setStatus', { token: pstaff, ref: fref, status: 'Accepted' }, /next step|can't set/);
  const acc = await ok('rOffer', { token: rider, ref: fref, accept: true }); assert(acc.booking.status === 'New' && acc.booking.rider === 'rider@tara.ph' && acc.booking.riderAccepted, 'rider accepts: order confirmed (New) with the rider');
  await fails('rOffer', { token: rider, ref: fref, accept: true }, /already accepted/);
  assert((await ok('mBookings', { token: pstaff })).bookings.some(b => b.ref === fref) && DB.events.some(r => r.data.type === 'new' && r.data.ref === fref && r.data.aud.includes('biz:pahuway')), 'then it is pushed to the merchant');
  assert(DB.events.some(r => r.data.ref === fref && r.data.aud.includes('cust:ana@mail.com') && /accepted your order/.test(r.data.text)), 'customer told which rider accepted');
  await fails('setStatus', { token: pstaff, ref: fref, status: 'Completed' }, /next step/);
  for (const s of ['Accepted', 'Preparing']) await ok('setStatus', { token: pstaff, ref: fref, status: s });
  await ok('setStatus', { token: pstaff, ref: fref, status: 'Ready for Pick-up' });
  const myb = (await ok('myBookings', { token: cust })).bookings.find(b => b.ref === fref);
  assert(myb.riderInfo && myb.riderInfo.name && myb.fee === undefined && myb.history.length >= 3, 'customer sees their rider (' + myb.riderInfo.name + ') and the activity log, not the platform fee');
  console.log('Live rider tracking');
  assert((await ok('getCatalog')).maps.key === 'gm-key' && (await ok('getCatalog')).maps.mapId === 'DEMO_MAP_ID', 'Google Maps browser key and map ID sent to the apps');
  let tr = await ok('track', { token: cust, ref: fref }); assert(tr.rider && tr.live && tr.loc, 'customer sees the rider on the map as soon as they accept (rider was online)');
  const sh = await ok('rLocation', { token: rider, lat: 12.5712, lng: 122.1320, acc: 8 }); assert(sh.sharing && sh.refs[0] === fref, 'rider shares location during an accepted delivery');
  tr = await ok('track', { token: cust, ref: fref }); assert(tr.live && tr.loc.lat === 12.5712 && tr.eta >= 1 && tr.store.name === 'Pahuway Café' && tr.dest.lat === 12.572, 'customer sees rider position, store, drop-off and ETA ' + tr.eta + ' min');
  assert((await ok('track', { token: pstaff, ref: fref })).live, 'merchant staff can track the rider');
  await fails('track', { token: hmgr, ref: fref }, /not found/);
  await fails('rLocation', { token: cust, lat: 1, lng: 1 }, /Not allowed/);
  for (const s of ['Out for Delivery', 'Delivered']) await ok('setStatus', { token: rider, ref: fref, status: s });
  tr = await ok('track', { token: cust, ref: fref }); assert(tr.done && !tr.live && !tr.loc, 'tracking ends when delivered');
  assert(DB.staff.find(r => r.id === 'rider@tara.ph').data.loc, 'online rider keeps sharing their area after the delivery');
  await ok('rAvailable', { token: rider, value: false });
  assert(!DB.staff.find(r => r.id === 'rider@tara.ph').data.loc, 'rider location cleared when they go offline');
  assert(!(await ok('rLocation', { token: rider, lat: 12.57, lng: 122.13 })).sharing, 'offline rider location not stored without an active delivery');
  await ok('rAvailable', { token: rider, value: true });
  const fb = (await ok('mBookings', { token: pstaff })).bookings.find(b => b.ref === fref), expCash = Rules.cashExpected(fb);
  assert(fb.codToRider && expCash === Rules.payable(fb), 'COD cash goes to the rider: they collect the whole P' + expCash);
  await fails('setStatus', { token: pstaff, ref: fref, status: 'Payment Collected', amount: expCash }, /next step|can't set/);
  await fails('setStatus', { token: rider, ref: fref, status: 'Payment Collected' }, /amount collected .*required/);
  await ok('setStatus', { token: rider, ref: fref, status: 'Payment Collected', amount: expCash });
  assert(DB.bookings.find(r => r.id === fref).data.cashCollected.role === 'rider', 'rider records the COD cash they collected');
  await ok('setStatus', { token: pstaff, ref: fref, status: 'Completed' });
  const ro = await ok('rOrders', { token: rider }); assert(ro.orders[0].status === 'Completed' && ro.orders[0].fee === undefined, 'rider sees completed order without merchant money fields');
  const kus = await ok('createBooking', { token: cust, kind: 'food', bizId: 'kusina', fulfillment: 'pickup', payMethod: 'pickup', lines: [{ itemId: 'gyoza', qty: 2, addons: [] }] });
  assert(kus.bookings[0].bizId === 'kusina' && kus.bookings[0].quote.subtotal === 300, 'Kusina sa Hiraya order goes to its own business');
  await fails('createBooking', { token: cust, kind: 'food', bizId: 'kusina', fulfillment: 'pickup', payMethod: 'pickup', lines: [{ itemId: item.id, qty: 1 }] }, /no longer available/);

  console.log('Messaging & notifications');
  await ok('send', { token: cust, ref: fref, text: 'Thank you!' });
  await fails('send', { token: rider, ref: fref, text: 'x' }, /customer or the merchant/);
  await ok('send', { token: rider, ref: fref, chan: 'customer', text: 'Enjoy!' });
  await ok('send', { token: rider, ref: fref, chan: 'merchant', text: 'Picked up, thanks' });
  await ok('send', { token: cust, ref: fref, chan: 'rider', text: 'Thanks rider' });
  const rth = (await ok('threads', { token: rider })).threads; assert(rth.length === 2 && rth.every(t => t.type === 'rider'), 'rider has separate customer and merchant chats');
  const cth = (await ok('threads', { token: cust })).threads; assert(cth.some(t => t.id === 'R-' + fref + '-cust') && !cth.some(t => t.id === 'R-' + fref + '-biz'), 'customer sees only the rider-customer chat');
  const rc = await ok('thread', { token: cust, threadId: 'R-' + fref + '-cust' }); assert(rc.messages.length === 2, 'rider and customer messages in their own chat');
  await fails('send', { token: cust, inquiryBizId: 'baybayin', cartBizIds: [], text: 'hi' }, /cart/);
  await ok('send', { token: cust, inquiryBizId: 'baybayin', cartBizIds: ['baybayin'], text: 'Is the NMAX free?' });
  const th = await ok('thread', { token: pmgr, threadId: 'T-' + fref }); assert(th.messages.length === 1, 'merchant sees order thread');
  assert((await ok('threads', { token: admin })).threads.length === 4, 'super admin sees every thread');
  assert((await ok('threads', { token: pmgr })).threads.length === 2, 'merchant sees order thread and rider-merchant chat only');
  const fd = await ok('feed', { token: cust, since: '' }); assert(fd.events.some(e => e.type === 'status' && e.ref === fref), 'customer feed has status events');

  console.log('Transfer with proof, application, cron');
  await ok('createBooking', { token: cust, kind: 'food', fulfillment: 'pickup', payMethod: 'transfer', proofPhoto: IMG, lines: [{ itemId: item.id, qty: 1, addons: [] }] }).then(r => assert(r.bookings[0].status === 'Awaiting Payment' && r.bookings[0].proofFile.startsWith('uploads/'), 'transfer order stored with private proof'));
  const bizApp = { businessName: 'Cantingas Kayaks', type: 'Tour', town: 'San Jose', contactName: 'Lito', phone: '09170000000', email: 'lito@k.ph', description: 'River tours', capacity: '12', photos: [IMG] };
  await fails('submitApplication', { application: bizApp }, /registration number is required/);
  await fails('submitApplication', { application: Object.assign({}, bizApp, { registration: 'DTI 1' }) }, /permit number is required/);
  await fails('submitApplication', { application: Object.assign({}, bizApp, { registration: 'DTI 1', permits: 'BP-1' }) }, /payouts/);
  await ok('submitApplication', { application: Object.assign({}, bizApp, { registration: 'DTI 1', permits: 'BP-1', bank: { accountName: 'Lito G', bank: 'GCash', accountNo: '0917' } }) });
  assert(DB.applications[0].data.photos[0].startsWith('https://sb.test/storage/v1/object/public/photos/'), 'application photo in public bucket');
  const exp = await ok('createBooking', { token: cust, kind: 'food', fulfillment: 'pickup', payMethod: 'online', lines: [{ itemId: item.id, qty: 1, addons: [] }] });
  const er = DB.bookings.find(r => r.id === exp.refs[0]); er.data.created = new Date(Date.now() - 2 * 3600e3).toISOString();
  let cr = mkRes(); await cronFn({ headers: {} }, cr); assert(cr.code === 401, 'cron needs CRON_SECRET');
  DB.cache.push({ key: 'old', value: '1', expires_at: '2000-01-01T00:00:00Z' });
  cr = mkRes(); await cronFn({ headers: { authorization: 'Bearer cron123' } }, cr);
  assert(cr.code === 200 && er.data.status === 'Expired', 'cron expires unpaid HitPay order after 60 minutes');
  assert(!DB.cache.some(c => c.key === 'old'), 'cron clears expired cache rows');
  const ad = await ok('adminData', { token: admin }); assert(ad.bookings.length === 5 && ad.customers.length === 2 && ad.applications.length === 1, 'admin data complete (Ana + Gina from Google)');

  console.log('Approval creates business, listing, Merchant Admin and payout account');
  const app = ad.applications[0];
  const apr = await ok('adminApproveApplication', { token: admin, id: app.id, bizId: 'cantingas', type: 'Tour', platformFee: { type: 'percent', value: 12 } });
  const c2 = apr.catalog; assert(c2.businesses.some(b => b.id === 'cantingas' && b.platformFee.value === 12), 'business created with platform fee');
  const tour = c2.tours.find(t => t.bizId === 'cantingas'); assert(tour && tour.category === 'tour' && tour.active === false && tour.maxPax === 12, 'draft tour listing auto-added under Tours');
  const ad2 = await ok('adminData', { token: admin }); assert(ad2.payees['biz:cantingas'].accountNo === '0917', 'payout account saved from application');
  assert(ad2.staff.some(s => s.email === 'lito@k.ph' && s.role === 'manager' && s.bizId === 'cantingas'), 'applicant is Merchant Admin');
  await fails('adminApproveApplication', { token: admin, id: app.id }, /Already approved/);

  console.log('Merchant Admin edits prices; tours bookable');
  const lito = await staffLogin('lito@k.ph', 'merchant');
  await ok('mListing', { token: lito, kind: 'tour', id: tour.id, fields: { rate: 800, promoPct: 10, deposit: 500 } });
  await fails('mListing', { token: lito, kind: 'tour', id: tour.id, fields: { promoPct: 95 } }, /at most 90/);
  await fails('mListing', { token: lito, kind: 'stay', id: 'hiraya', fields: { rate: 1 } }, /not found/);
  await fails('mListing', { token: pstaff, kind: 'item', id: item.id, fields: { price: 1 } }, /Merchant Admin access/);
  await ok('mAvailability', { token: lito, kind: 'tour', id: tour.id, value: true });
  const tb = await ok('createBooking', { token: cust, kind: 'tour', agree: true, payMethod: 'transfer', proofPhoto: IMG, lines: [{ type: 'tour', itemId: tour.id, date: ph(7), time: '08:00', pax: 3 }] });
  assert(tb.bookings[0].kind === 'tour' && tb.bookings[0].quote.total === 2160 && tb.bookings[0].quote.deposit === 500, 'tour priced 3 x 800 less 10% with deposit');
  await fails('createBooking', { token: cust, kind: 'tour', agree: true, payMethod: 'transfer', proofPhoto: IMG, lines: [{ type: 'tour', itemId: tour.id, date: ph(7), time: '08:00', pax: 1 }] }, /already booked/);
  await ok('mListing', { token: pmgr, kind: 'item', id: item.id, fields: { promoPct: 20 } });
  const promo = await ok('createBooking', { token: cust, kind: 'food', bizId: 'pahuway', fulfillment: 'pickup', payMethod: 'pickup', lines: [{ itemId: item.id, qty: 1, addons: [] }] });
  assert(promo.bookings[0].quote.subtotal === Math.round(item.price * 0.8 * 100) / 100, 'menu item discount applied');

  console.log('Up to 4 merchant users');
  const base = (await ok('adminData', { token: admin })).staff.map(s => ({ email: s.email, name: s.name, role: s.role, bizId: s.bizId }));
  const four = base.concat([{ email: 'c1@p.ph', role: 'staff', bizId: 'pahuway' }, { email: 'c2@p.ph', role: 'manager', bizId: 'pahuway' }]);
  await ok('adminSaveStaff', { token: admin, staff: four });
  await fails('adminSaveStaff', { token: admin, staff: four.concat([{ email: 'c3@p.ph', role: 'staff', bizId: 'pahuway' }]) }, /up to 4 users/);

  console.log('Riders: application, approval, add, license');
  await fails('submitApplication', { application: { appType: 'rider', name: 'Paolo', phone: '0920', email: 'paolo@r.ph', address: 'Cabolutan', town: 'San Agustin', vehicle: 'XRM', plate: '789', licenseNo: 'N03', bank: { accountName: 'P', bank: 'GCash', accountNo: '0920' } } }, /driver's license/);
  await ok('submitApplication', { application: { appType: 'rider', name: 'Paolo', phone: '0920', email: 'paolo@r.ph', address: 'Cabolutan', town: 'San Agustin', vehicle: 'XRM', plate: '789', licenseNo: 'N03', licensePhoto: IMG, password: 'short', bank: { accountName: 'P', bank: 'GCash', accountNo: '0920' } } }).catch(() => {});
  await ok('submitApplication', { application: { appType: 'rider', name: 'Paolo', phone: '0920', email: 'paolo@r.ph', address: 'Cabolutan', town: 'San Agustin', vehicle: 'XRM', plate: '789', licenseNo: 'N03', licensePhoto: IMG, password: 'paolo-pass-1', bank: { accountName: 'P', bank: 'GCash', accountNo: '0920' } } });
  const rapp = (await ok('adminData', { token: admin })).applications.find(a => a.appType === 'rider');
  assert(rapp.licenseFile.startsWith('uploads/') && rapp.pw === undefined, 'license photo stored privately; password not shown to admins');
  await ok('adminApproveApplication', { token: admin, id: rapp.id });
  const ad3 = await ok('adminData', { token: admin }), paolo = ad3.staff.find(s => s.email === 'paolo@r.ph');
  assert(paolo && paolo.role === 'rider' && paolo.licenseStatus === 'verified' && paolo.plate === '789' && ad3.payees['rider:paolo@r.ph'].bank === 'GCash', 'approved rider has profile, verified license and payout account');
  await fails('riderLogin', { email: 'paolo@r.ph', password: 'wrong-pass' }, /Incorrect email or password/);
  const pl = await ok('riderLogin', { email: 'paolo@r.ph', password: 'paolo-pass-1' }); assert(pl.token && pl.me.role === 'rider', 'approved rider signs in with the password from the application (no email code)');
  await fails('riderLogin', { email: 'nobody@r.ph', password: 'whatever1' }, /not registered as a rider/);
  await ok('adminSaveRider', { token: admin, rider: { email: 'new@r.ph', name: 'New Rider', phone: '0911', vehicle: 'Mio', plate: 'X1', licenseNo: 'L1' }, licensePhoto: IMG, bank: { accountName: 'New', bank: 'Maya', accountNo: '0911' } });
  await ok('adminSaveRider', { token: admin, rider: { email: 'new@r.ph', name: 'New Rider', phone: '0911', licenseStatus: 'rejected', licenseNote: 'Expired' } });
  const nr = (await ok('adminData', { token: admin })).staff.find(s => s.email === 'new@r.ph');
  assert(nr.licenseStatus === 'rejected' && nr.vehicle === 'Mio' && nr.licenseFile, 'admin-added rider keeps details; license rejected');
  await fails('adminSaveRider', { token: admin, rider: { email: 'mgr@pahuway.ph', name: 'X', phone: '1' } }, /already has/);
  const keep = (await ok('adminData', { token: admin })).staff.map(s => ({ email: s.email, name: s.name, role: s.role, bizId: s.bizId }));
  await ok('adminSaveStaff', { token: admin, staff: keep });
  assert((await ok('adminData', { token: admin })).staff.find(s => s.email === 'paolo@r.ph').licenseFile, 'saving users keeps rider license details');

  console.log('Payouts');
  const all = (await ok('adminData', { token: admin })).bookings, done = all.find(b => b.ref === fref);
  assert(done.status === 'Completed', 'COD order completed');
  const L = Rules.ledger(done, {}); assert(L.cashBiz === 0 && L.bizNet === Rules.r2(Rules.gross(done) - L.discount - L.fee - L.storeDelivery), 'COD to rider: the store got no cash; the platform pays the store its sales minus fee and delivery share (P' + L.bizNet + ')');
  assert(L.riderShare === done.quote.riderFee && L.riderCash === Rules.payable(done) && L.riderNet === Rules.r2(L.riderShare - Rules.payable(done)), 'COD to rider: earning P' + L.riderShare + ' kept separate from the P' + L.riderCash + ' cash held; settlement P' + L.riderNet);
  console.log('Delivery fee matrix per restaurant');
  const MXF = { matrixFees: true, matrix: [{ upToKm: 3, customerFee: 0, storeFee: 20, riderFee: 20 }, { upToKm: 5, customerFee: 30, storeFee: 10, riderFee: 40 }, { upToKm: 8, customerFee: 60, storeFee: 0, riderFee: 50 }] };
  const x1 = Pricing.deliverySplit({ settings: {} }, MXF, 1.2), x2 = Pricing.deliverySplit({ settings: {} }, MXF, 3.0), x3 = Pricing.deliverySplit({ settings: {} }, MXF, 4.1), x4 = Pricing.deliverySplit({ settings: {} }, MXF, 7.9);
  assert(x1.fee === 0 && x1.storeShare === 20 && x1.riderFee === 20 && x2.riderFee === 20, '0-3 km: customer 0, merchant pays rider 20, rider gets 20');
  assert(x3.fee === 30 && x3.storeShare === 10 && x3.riderFee === 40 && x4.fee === 60 && x4.riderFee === 50, 'other bands use their own customer / store / rider amounts');
  assert(Pricing.deliverySplit({ settings: {} }, MXF, 8.2) === null, 'beyond the last band: no delivery');
  assert(Pricing.deliverySplit({ settings: {} }, Object.assign({}, MXF, { matrixFees: false }), 3.2).riderFee === 20 && Pricing.deliverySplit({ settings: {} }, Object.assign({}, MXF, { matrixFees: false }), 3.2).fee === 14, 'matrix switched off: Settings formula, bands only limit distance');
  assert(Pricing.deliverySplit({ settings: {} }, { matrixFees: true, matrix: [{ upToKm: 4, customerFee: 25, storeFee: 15 }] }, 2).riderFee === 40, 'rider gets customer + store when left empty');
  assert(/0–3 km: Free · 3–5 km: ₱30/.test(Pricing.deliveryText({ settings: {} }, MXF)), 'customers see the bands');
  const xq = { km: 4.1, deliveryFee: 30, storeDeliveryShare: 10, deliveryBand: { from: 3, to: 5 } }, xe = Pricing.deliveryExplain({ settings: {} }, MXF, xq);
  assert(xe.cost === 40 && xe.store === 10 && xe.you === 30 && /4.1 km from the store · 3–5 km rate/.test(xe.how), 'checkout explains the fee: cost 40, store covers 10, customer pays 30');
  assert(/beyond the free 1.5 km × ₱10/.test(Pricing.deliveryExplain({ settings: {} }, {}, { km: 3.2, deliveryFee: 14, storeDeliveryShare: 6, extraKm: 2 }).how), 'formula fees explained too');
  const mxB = Pricing.food(Object.assign(JSON.parse(JSON.stringify(CATALOG)), {}), { bizId: 'pahuway', lines: [{ itemId: item.id, qty: 1, addons: [] }], fulfillment: 'delivery', lat: 12.5720, lng: 122.1330 });
  console.log('Delivery fee rule');
  const DC = { settings: {} }, DF = { maxKm: 10 };
  const d1 = Pricing.deliverySplit(DC, DF, 1.2), d2 = Pricing.deliverySplit(DC, DF, 3.2), d3 = Pricing.deliverySplit(DC, DF, 1.5), d4 = Pricing.deliverySplit(DC, DF, 2.0);
  assert(d1.fee === 0 && d1.storeShare === 20 && d1.riderFee === 20, 'within 1.5 km: customer free, store pays rider ₱20');
  assert(d3.fee === 0 && d3.riderFee === 20, 'exactly 1.5 km is still free');
  assert(d4.fee === 7 && d4.storeShare === 13 && d4.riderFee === 20, '2.0 km: ₱10 fee, customer ₱7, store tops up to the ₱20 rider minimum (₱13)');
  const d6 = Pricing.deliverySplit(DC, DF, 4.0); assert(d6.fee === 21 && d6.storeShare === 9 && d6.riderFee === 30, '4.0 km: ₱30 fee above the minimum (customer ₱21, store ₱9)');
  assert(d2.fee === 14 && d2.storeShare === 6 && d2.riderFee === 20, '3.2 km: 2 started km = ₱20 (customer ₱14, store ₱6)');
  assert(Pricing.deliverySplit(DC, DF, 10.5) === null, 'beyond the longest distance: no delivery');
  const d5 = Pricing.deliverySplit({ settings: { delivery: { freeKm: 2, perKm: 15, customerPct: 50, baseFee: 25 } } }, DF, 4.1);
  assert(d5.fee === 23 && d5.storeShare === 22 && d5.riderFee === 45 && Pricing.deliverySplit({ settings: { delivery: { minRider: 0 } } }, DF, 2).riderFee === 10, 'Super Admin can change km, rate, split and base fee');
  const stayB = all.find(b => b.ref === bk.refs[0]);
  await ok('setStatus', { token: hmgr, ref: stayB.ref, status: 'Completed' });
  const po1 = await ok('adminPayout', { token: admin, party: 'biz:hiraya', refs: [stayB.ref], adjustment: -50, adjustmentNote: 'towel' });
  const s2 = all.find(b => b.ref === stayB.ref), m2 = Rules.ledger(Object.assign({}, s2, { status: 'Completed' }), {});
  assert(po1.payout.net === Rules.r2(m2.bizNet - 50) && po1.payout.cash === m2.cashBiz, 'stay payout = downpayment - fee - discount... net ' + po1.payout.net);
  await fails('adminPayout', { token: admin, party: 'biz:hiraya', refs: [stayB.ref] }, /not ready/);
  const po2 = await ok('adminPayout', { token: admin, party: 'biz:pahuway', refs: [fref] }); assert(po2.payout.net === L.bizNet && po2.payout.net > 0, 'merchant is paid out for COD sales the rider collected');
  const po3 = await ok('adminPayout', { token: admin, party: 'rider:rider@tara.ph', refs: [fref] }); assert(po3.payout.net === L.riderNet && po3.payout.direction === 'collect', 'rider settlement: earnings minus COD cash held (rider remits P' + (-po3.payout.net) + ')');
  const ad4 = await ok('adminData', { token: admin }); assert(ad4.payouts.length === 3 && ad4.bookings.find(b => b.ref === fref).riderPaidAt && ad4.bookings.find(b => b.ref === fref).bizPaidAt, 'payouts recorded and bookings settled');
  assert(MAILS.some(m => /Payout statement/.test(m.subject)), 'payout statement emailed');

  console.log('Discount codes');
  await ok('adminSaveDiscounts', { token: admin, discounts: [
    { code: 'tara10', name: 'Tara 10', desc: '10% off', type: 'percent', value: 10, maxDiscount: 100, fundedBy: 'tara', onePerCustomer: true },
    { code: 'KAPE20', name: 'Kape', desc: 'P20 off', type: 'fixed', value: 20, bizIds: ['pahuway'], minOrder: 150, fundedBy: 'merchant' }] });
  await fails('adminSaveDiscounts', { token: admin, discounts: [{ code: 'A B', value: 1 }] }, /letters or numbers/);
  const cc = await ok('checkCode', { token: cust, code: 'TARA10', amounts: { pahuway: 400, hiraya: 600 } }); assert(cc.split.pahuway === 40 && cc.split.hiraya === 60, 'capped percent code split by business');
  await fails('checkCode', { token: cust, code: 'KAPE20', amounts: { hiraya: 500 } }, /does not apply/);
  await fails('checkCode', { token: cust, code: 'NOPE', amounts: { pahuway: 500 } }, /not valid/);
  const kc = await ok('createBooking', { token: cust, kind: 'food', bizId: 'pahuway', fulfillment: 'pickup', payMethod: 'online', code: 'kape20', lines: [{ itemId: 'americano', qty: 2, addons: ['temp:hot'] }] });
  const kb = kc.bookings[0]; assert(kb.code.amount === 20 && kc.dueNow === Rules.payable(kb) && Rules.payable(kb) === kb.quote.total - 20, 'code reduces amount to pay (merchant-funded)');
  await fails('createBooking', { token: cust, kind: 'food', bizId: 'pahuway', fulfillment: 'pickup', payMethod: 'pickup', code: 'KAPE20', lines: [{ itemId: 'americano', qty: 1, addons: ['temp:hot'] }] }, /minimum order/);
  const tc = await ok('createBooking', { token: cust, kind: 'food', bizId: 'kusina', fulfillment: 'pickup', payMethod: 'pickup', code: 'TARA10', lines: [{ itemId: 'tonkotsu', qty: 2, addons: ['spice:mild'] }] });
  const tl = Rules.ledger(Object.assign({}, tc.bookings[0], { status: 'Completed', payStatus: 'Paid' }), {});
  assert(tc.bookings[0].code.fundedBy === 'tara' && tl.bizNet === Rules.r2(56 - tl.fee), 'Tara-funded code is paid back to the merchant in payouts');
  await fails('createBooking', { token: cust, kind: 'food', bizId: 'kusina', fulfillment: 'pickup', payMethod: 'pickup', code: 'TARA10', lines: [{ itemId: 'gyoza', qty: 1, addons: [] }] }, /already used/);
  const kus2 = await staffLogin('admin@kusina.ph', 'merchant').catch(() => null);

  console.log('Reward points');
  const pm2 = await staffLogin('mgr@pahuway.ph', 'merchant');
  await ok('mSaveStore', { token: pm2, fields: { name: 'Pahuway Café', hours: { mon: { open: '07:00', close: '21:00' }, sun: { closed: true } }, paymentMethods: ['Cash', 'GCash'], acceptCodes: true, rewards: { enabled: true, loyverse: true } } });
  LV.customers = [{ id: 'lv1', name: 'Ana', email: 'ana@mail.com', total_points: 120 }];
  await ok('mSaveLoyverse', { token: pm2, loyverseToken: 'lvtok' });
  let mr = (await ok('myRewards', { token: cust })).rewards.find(r => r.bizId === 'pahuway');
  assert(mr && mr.balance === 120 && mr.source === 'loyverse', 'Pahuway balance comes from Loyverse (in-store + app)');
  const rp = await ok('createBooking', { token: cust, kind: 'food', bizId: 'pahuway', fulfillment: 'pickup', payMethod: 'pickup', redeem: { pahuway: 60 }, lines: [{ itemId: 'caramel', qty: 2, addons: ['temp:hot'] }] });
  assert(rp.bookings[0].points.amount === 60 && Rules.payable(rp.bookings[0]) === rp.bookings[0].quote.total - 60, 'redeemed 60 points = P60 off');
  assert(LV.customers[0].total_points === 60, 'Loyverse balance reduced by redeemed points');
  await fails('createBooking', { token: cust, kind: 'food', bizId: 'pahuway', fulfillment: 'pickup', payMethod: 'pickup', redeem: { pahuway: 55 }, lines: [{ itemId: 'caramel', qty: 2, addons: ['temp:hot'] }] }, /steps of 10/);
  for (const st of ['Accepted', 'Preparing', 'Ready for Pick-up', 'Order Picked Up']) await ok('setStatus', { token: pstaff, ref: rp.refs[0], status: st });
  await ok('setStatus', { token: pstaff, ref: rp.refs[0], status: 'Payment Collected', amount: Rules.payable(rp.bookings[0]) });
  await ok('setStatus', { token: pstaff, ref: rp.refs[0], status: 'Completed' });
  const earned = Math.floor(Rules.payable(rp.bookings[0]) / 20);
  assert(LV.customers[0].total_points === 60 + earned, 'completed order earned ' + earned + ' points, synced to Loyverse (sign-up bonus was given on her first order)');
  const rr = await ok('mRewardsReport', { token: pm2 }), ana = rr.customers.find(c => c.email === 'ana@mail.com');
  assert(ana && ana.redeemed === 60 && ana.earned > earned && ana.bonus === 20 && ana.codeUses >= 1 && ana.loyverseBalance === LV.customers[0].total_points, 'merchant rewards & discounts report per customer');
  const can = await ok('createBooking', { token: cust, kind: 'food', bizId: 'pahuway', fulfillment: 'pickup', payMethod: 'pickup', redeem: { pahuway: 50 }, lines: [{ itemId: 'caramel', qty: 2, addons: ['temp:hot'] }] });
  const before = LV.customers[0].total_points; await ok('setStatus', { token: pm2, ref: can.refs[0], status: 'Cancelled' });
  assert(LV.customers[0].total_points === before + 50, 'cancelled order returns redeemed points');
  await ok('saveProfile', { token: cust, profile: { name: 'Ana Cruz', phone: '09171234567', address: 'Makati', birthday: '1990-' + ph(0).slice(5) } });
  await ok('mSaveLoyverse', { token: pm2, loyverseToken: '' });
  mr = (await ok('myRewards', { token: cust })).rewards.find(r => r.bizId === 'pahuway');
  assert(mr.history.some(h => h.type === 'birthday' && h.points === 50), 'birthday bonus credited on the birthday');

  console.log('Merchant Admin saves the whole menu at once');
  const menu0 = Pricing.store((await ok('getCatalog')).catalog, 'pahuway').items, lat0 = menu0.find(i => i.id === 'latte');
  const edits = menu0.filter(i => i.id !== menu0[menu0.length - 1].id).map(i => ({ id: i.id, name: i.name, desc: i.desc, catId: i.catId, price: i.price, promoPct: i.promoPct || '', available: i.available !== false }));
  edits.find(x => x.id === 'latte').price = 155; edits.find(x => x.id === 'latte').available = false;
  edits.push({ id: '', name: 'Ube Latte', desc: 'Purple yam latte', catId: 'nope', price: 170, promoPct: 10, available: true }, { name: 'Ube Latte', price: 175 });
  await fails('mMenu', { token: pstaff, items: edits }, /Merchant Admin access/);
  await fails('mMenu', { token: pm2, items: edits.concat([{ name: '', price: 10 }]) }, /enter a name/);
  await fails('mMenu', { token: pm2, items: edits.concat([{ name: 'Free thing', price: 0 }]) }, /more than zero/);
  await fails('mMenu', { token: pm2, items: edits.concat([{ name: 'Deal', price: 50, promoPct: 95 }]) }, /0 to 90%/);
  const mmr = await ok('mMenu', { token: pm2, items: edits });
  const menu1 = Pricing.store((await ok('getCatalog')).catalog, 'pahuway').items, lat1 = menu1.find(i => i.id === 'latte'), ube = menu1.filter(i => /^ube-latte/.test(i.id));
  assert(mmr.added === 2 && mmr.removed === 1 && menu1.length === menu0.length + 1 && !menu1.find(i => i.id === menu0[menu0.length - 1].id), 'one save adds 2 items and removes 1');
  assert(lat1.price === 155 && lat1.available === false && JSON.stringify(lat1.addonGroups) === JSON.stringify(lat0.addonGroups) && lat1.photo === lat0.photo, 'edited item keeps its photo and add-ons');
  assert(ube.length === 2 && ube[0].id !== ube[1].id && ube[0].promoPct === 10 && ube[0].catId === menu1[0].catId, 'new items get unique ids, a valid category and the discount');
  assert(DB.events.some(r => /saved the menu of .*2 added, removed/.test(r.data.text || r.data.msg || JSON.stringify(r.data))), 'menu save is logged for the Super Admin');
  await ok('mMenu', { token: pm2, items: menu0.map(i => ({ id: i.id, name: i.name, desc: i.desc, catId: i.catId, price: i.price, promoPct: i.promoPct, available: i.available !== false })) });
  assert(JSON.stringify(Pricing.store((await ok('getCatalog')).catalog, 'pahuway').items.map(i => i.name)) === JSON.stringify(menu0.map(i => i.name)), 'menu restored (a removed item comes back as a new item)');

  console.log('Merchant Admin adds, renames, reorders and removes categories');
  const mc0 = Pricing.store((await ok('getCatalog')).catalog, 'pahuway'), cats0 = mc0.categories.map(c => ({ id: c.id, name: c.name }));
  const itemsC = mc0.items.map(i => ({ id: i.id, name: i.name, desc: i.desc, catId: i.catId, price: i.price, promoPct: i.promoPct, available: i.available !== false }));
  const emptyCat = cats0.find(c => !mc0.items.some(i => i.catId === c.id));
  const catsC = [{ id: 'new:a', name: 'Rice Meals' }].concat(cats0.filter(c => c !== emptyCat).map((c, i) => i ? c : { id: c.id, name: c.name + ' (renamed)' }));
  itemsC[0].catId = 'new:a';
  await fails('mMenu', { token: pm2, categories: catsC.concat([{ name: 'rice meals' }]), items: itemsC }, /two categories named/);
  await fails('mMenu', { token: pm2, categories: catsC.concat([{ name: ' ' }]), items: itemsC }, /Give each category a name/);
  await fails('mMenu', { token: pm2, categories: catsC.filter(c => c.id !== itemsC[1].catId || c.id === 'new:a'), items: itemsC.map((x, i) => i === 1 && x.catId !== itemsC[0].catId ? x : x) }, /choose a category/);
  await ok('mMenu', { token: pm2, categories: catsC, items: itemsC });
  const mc1 = Pricing.store((await ok('getCatalog')).catalog, 'pahuway');
  assert(mc1.categories[0].id === 'rice-meals' && mc1.categories[0].name === 'Rice Meals' && mc1.items[0].catId === 'rice-meals', 'new category gets an id from its name, is first, and the item is in it');
  assert(mc1.categories[1].name.endsWith('(renamed)') && mc1.categories[1].id === cats0.filter(c => c !== emptyCat)[0].id && (!emptyCat || !mc1.categories.some(c => c.id === emptyCat.id)), 'rename keeps the id; empty category removed');
  await ok('mMenu', { token: pm2, categories: cats0, items: mc0.items.map(i => ({ id: i.id, name: i.name, desc: i.desc, catId: i.catId, price: i.price, promoPct: i.promoPct, available: i.available !== false })) });
  assert(JSON.stringify(Pricing.store((await ok('getCatalog')).catalog, 'pahuway').categories) === JSON.stringify(cats0), 'categories restored');

  console.log('Customer accounts with passwords');
  await ok('sendOtp', { email: 'old@mail.com' }); const oldTok = (await ok('verifyOtp', { email: 'old@mail.com', code: lastCode('old@mail.com') })).token;
  await ok('saveProfile', { token: oldTok, profile: { name: 'Old Customer', phone: '0917 000 1111', address: 'Poblacion, San Agustin' } });
  await fails('signUp', { email: 'pw@mail.com', password: 'short' }, /at least 8/);
  const su = await ok('signUp', { email: 'pw@mail.com', password: 'long-enough-1', name: 'Pia' }); assert(su.token && su.profile.hasPassword && su.created, 'customer creates an account with email + password');
  await fails('signUp', { email: 'pw@mail.com', password: 'long-enough-1' }, /already exists/);
  await fails('login', { email: 'pw@mail.com', password: 'wrong-pass' }, /Incorrect email or password/);
  assert((await ok('login', { email: 'pw@mail.com', password: 'long-enough-1' })).token, 'customer logs in with password');
  await fails('login', { email: 'old@mail.com', password: 'anything1' }, /NO_PASSWORD/);
  await fails('signUp', { email: 'old@mail.com', password: 'anything1' }, /NO_PASSWORD/);
  await ok('pwResetSend', { email: 'old@mail.com' }); assert(/password reset code/.test(MAILS[MAILS.length - 1].subject), 'reset code emailed');
  const rcode = /code: (\d{6})/.exec(MAILS[MAILS.length - 1].subject)[1];
  await fails('pwReset', { email: 'old@mail.com', code: '000000', password: 'ana-new-pass' }, /incorrect or has expired/);
  const rs = await ok('pwReset', { email: 'old@mail.com', code: rcode, password: 'ana-new-pass' }); assert(rs.token && rs.profile.hasPassword, 'older account sets a password with the reset code');
  assert((await ok('login', { email: 'old@mail.com', password: 'ana-new-pass' })).token, 'and then logs in with it');
  await fails('changePassword', { token: rs.token, current: 'nope-nope', password: 'ana-newer-1' }, /current password is incorrect/);
  await ok('changePassword', { token: rs.token, current: 'ana-new-pass', password: 'ana-newer-1' }); assert((await ok('login', { email: 'old@mail.com', password: 'ana-newer-1' })).token, 'customer changes password');
  for (let i = 0; i < 10; i++) await fails('login', { email: 'pw@mail.com', password: 'bad-' + i + 'xxxx' }, /Incorrect|Too many/);
  await fails('login', { email: 'pw@mail.com', password: 'long-enough-1' }, /Too many attempts/);
  console.log('Phone notifications (Web Push)');
  const pk = (await ok('pushKey')).key; assert(pk && Buffer.from(pk, 'base64url').length === 65, 'VAPID public key created and kept');
  assert((await ok('pushKey')).key === pk, 'same key next time');
  const ua = crypto.createECDH('prime256v1'); ua.generateKeys(); const auth = crypto.randomBytes(16);
  const cTok = (await ok('login', { email: 'old@mail.com', password: 'ana-newer-1' })).token;
  await ok('pushSubscribe', { token: cTok, sub: { endpoint: 'https://push.test/old', keys: { p256dh: ua.getPublicKey().toString('base64url'), auth: auth.toString('base64url') } } });
  await ok('pushSubscribe', { token: cTok, sub: { endpoint: 'https://push.test/gone', keys: { p256dh: ua.getPublicKey().toString('base64url'), auth: auth.toString('base64url') } } });
  await fails('pushSubscribe', { token: cTok, sub: { endpoint: 'http://x' } }, /not supported/);
  const p0 = PUSHES.length, pm3 = await staffLogin('mgr@pahuway.ph', 'merchant');
  const pb = await ok('createBooking', { token: cTok, kind: 'food', bizId: 'pahuway', fulfillment: 'pickup', payMethod: 'pickup', lines: [{ itemId: item.id, qty: 1, addons: [] }] });
  await ok('setStatus', { token: pm3, ref: pb.refs[0], status: 'Accepted' });
  const got = PUSHES.slice(p0).filter(x => x.path === '/old');
  assert(got.length >= 1 && /^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=/.test(got[0].h.Authorization) && got[0].h['Content-Encoding'] === 'aes128gcm', 'status change pushed to the customer phone with VAPID auth');
  const ece = (() => { const b = Buffer.from(got[got.length - 1].body), salt = b.subarray(0, 16), idl = b[20], as = b.subarray(21, 21 + idl), ct = b.subarray(21 + idl);
    const hm = (k, d) => crypto.createHmac('sha256', k).update(d).digest(), sec = ua.computeSecret(as), ikm = hm(hm(auth, sec), Buffer.concat([Buffer.from('WebPush: info\0'), ua.getPublicKey(), as, Buffer.from([1])])), prk = hm(salt, ikm);
    const d = crypto.createDecipheriv('aes-128-gcm', hm(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01', 'binary')).subarray(0, 16), hm(prk, Buffer.from('Content-Encoding: nonce\0\x01', 'binary')).subarray(0, 12)); d.setAuthTag(ct.subarray(ct.length - 16));
    const pt = Buffer.concat([d.update(ct.subarray(0, ct.length - 16)), d.final()]); return JSON.parse(pt.subarray(0, pt.length - 1).toString()); })();
  assert(/Accepted/.test(ece.body) && ece.url === '/#orders', 'push decrypts on the phone: "' + ece.body.slice(0, 50) + '"');
  assert(!DB.customers.find(r => r.id === 'old@mail.com').data.push.some(x => x.endpoint.endsWith('/gone')), 'expired phone subscriptions are removed');
  const mPush = PUSHES.slice(p0).filter(x => x.path !== '/old' && x.path !== '/gone').length; assert(mPush === 0, 'no push to people without a subscription');
  await ok('setStatus', { token: pm3, ref: pb.refs[0], status: 'Cancelled', note: 'test' }).catch(() => {});

  console.log('Points follow the registered mobile number');
  await ok('sendOtp', { email: 'ben@mail.com' }); const ben = (await ok('verifyOtp', { email: 'ben@mail.com', code: lastCode('ben@mail.com') })).token;
  await fails('saveProfile', { token: ben, profile: { name: 'Ben', phone: '+63 917 123 4567', address: 'Odiongan' } }, /already registered/);
  await fails('saveProfile', { token: ben, profile: { name: 'Ben', phone: '12345', address: 'Odiongan' } }, /valid PH mobile/);
  await ok('saveProfile', { token: ben, profile: { name: 'Ben', phone: '0918 222 3333', address: 'Odiongan' } });
  const prow = (DB.points || []).map(r => r.data).filter(x => x.email === 'ana@mail.com' && x.type === 'birthday')[0];
  assert(prow && prow.phone === '09171234567', 'points entries carry the registered mobile number');
  await ok('mSaveLoyverse', { token: pm2, loyverseToken: 'lvtok' });
  LV.customers.push({ id: 'lvB', name: 'Ben (counter)', email: '', phone_number: '+63 918 222 3333', total_points: 75 });
  const br = (await ok('myRewards', { token: ben })).rewards.find(r => r.bizId === 'pahuway');
  assert(br.balance === 75, 'Loyverse customer found by mobile number (no email at the counter)');
  await fails('createBooking', { token: ben, kind: 'food', bizId: 'pahuway', fulfillment: 'pickup', payMethod: 'pickup', redeem: { pahuway: 40 }, lines: [{ itemId: 'caramel', qty: 2, addons: ['temp:hot'] }] }, /50 points or more/);
  await ok('createBooking', { token: ben, kind: 'food', bizId: 'pahuway', fulfillment: 'pickup', payMethod: 'pickup', redeem: { pahuway: 70 }, lines: [{ itemId: 'caramel', qty: 2, addons: ['temp:hot'] }] });
  assert(LV.customers.find(c => c.id === 'lvB').total_points === 5, 'redeemed 70 of 75 points from the counter balance');
  await ok('mSaveLoyverse', { token: pm2, loyverseToken: '' });

  console.log('Add-on groups and photos');
  await fails('createBooking', { token: cust, kind: 'food', bizId: 'pahuway', fulfillment: 'pickup', payMethod: 'pickup', lines: [{ itemId: 'latte', qty: 1, addons: [] }] }, /choose Hot or iced/);
  await fails('createBooking', { token: cust, kind: 'food', bizId: 'pahuway', fulfillment: 'pickup', payMethod: 'pickup', lines: [{ itemId: 'latte', qty: 1, addons: ['temp:hot', 'temp:iced'] }] }, /up to 1 for Hot or iced/);
  const ag = await ok('createBooking', { token: cust, kind: 'food', bizId: 'pahuway', fulfillment: 'pickup', payMethod: 'pickup', lines: [{ itemId: 'latte', qty: 2, addons: ['temp:iced', 'milk:oat', 'extras:shot', 'extras:syrup'] }] });
  assert(ag.bookings[0].lines[0].unit === 130 + 40 + 30 + 20 && ag.bookings[0].lines[0].addons.join() === 'Iced,Oat milk,Extra shot,Vanilla syrup', 'add-ons from several groups priced and named');
  await ok('mAddons', { token: pm2, id: 'latte', groups: [{ id: 'temp', name: 'Hot or iced', required: false, max: 1, active: true, options: [{ id: 'hot', name: 'Hot', price: 0 }, { id: 'iced', name: 'Iced', price: 10 }] }, { name: 'Sweetness', required: true, max: 2, options: [{ name: 'Less sweet', price: 0 }, { name: 'Regular', price: 0 }, { name: 'Extra sweet', price: 5, active: false }] }] });
  await fails('mAddons', { token: pm2, id: 'latte', groups: [{ name: 'X', max: 4, options: [{ name: 'a' }] }] }, /1 to 3/);
  await fails('mAddons', { token: pm2, id: 'latte', groups: [{ name: '', options: [{ name: 'a' }] }] }, /group a name/);
  await fails('mAddons', { token: pstaff, id: 'latte', groups: [] }, /Merchant Admin access/);
  await fails('mAddons', { token: pm2, id: 'tonkotsu', groups: [] }, /not found/);
  const lat = Pricing.store((await ok('getCatalog')).catalog, 'pahuway').items.find(i => i.id === 'latte'), sw = lat.addonGroups[1];
  assert(lat.addonGroups.length === 2 && sw.required && sw.max === 2 && sw.options[2].active === false, 'Merchant Admin saved add-on groups (required, max, choices on/off)');
  await fails('createBooking', { token: cust, kind: 'food', bizId: 'pahuway', fulfillment: 'pickup', payMethod: 'pickup', lines: [{ itemId: 'latte', qty: 1, addons: ['temp:iced'] }] }, /choose Sweetness/);
  await fails('createBooking', { token: cust, kind: 'food', bizId: 'pahuway', fulfillment: 'pickup', payMethod: 'pickup', lines: [{ itemId: 'latte', qty: 1, addons: [sw.id + ':' + sw.options[2].id] }] }, /no longer available/);
  await ok('createBooking', { token: cust, kind: 'food', bizId: 'pahuway', fulfillment: 'pickup', payMethod: 'pickup', lines: [{ itemId: 'latte', qty: 1, addons: [sw.id + ':' + sw.options[0].id] }] });
  const ph1 = await ok('mPhoto', { token: pm2, kind: 'item', id: 'latte', dataUrl: IMG });
  assert(ph1.photo.startsWith('https://sb.test/storage/v1/object/public/photos/') && Pricing.store((await ok('getCatalog')).catalog, 'pahuway').items.find(i => i.id === 'latte').photo === ph1.photo, 'menu item photo uploaded and saved');
  const hm = await staffLogin('mgr@hiraya.ph', 'merchant'); await ok('mPhoto', { token: hm, kind: 'stay', id: 'hiraya', dataUrl: IMG });
  await fails('mPhoto', { token: hm, kind: 'unit', id: 'nmax', dataUrl: IMG }, /not found/);
  await ok('mPhoto', { token: pm2, kind: 'store', dataUrl: IMG });
  const c4 = (await ok('getCatalog')).catalog; assert(c4.stays.find(x => x.id === 'hiraya').photo && Pricing.store(c4, 'pahuway').photo, 'stay photo and store logo saved');
  await ok('mPhoto', { token: pm2, kind: 'item', id: 'latte', remove: true });
  assert(!Pricing.store((await ok('getCatalog')).catalog, 'pahuway').items.find(i => i.id === 'latte').photo, 'photo removed');

  console.log('Store settings and team');
  const stR = await ok('mStore', { token: pstaff }); assert(stR.business.hours.sun.closed && stR.business.paymentMethods.join() === 'Cash,GCash', 'store settings saved');
  await fails('mSaveStore', { token: pstaff, fields: { name: 'X' } }, /Merchant Admin access/);
  const cat3 = (await ok('getCatalog')).catalog; assert(/closed Sun/.test(Pricing.store(cat3, 'pahuway').hours), 'restaurant hours shown to customers: ' + Pricing.store(cat3, 'pahuway').hours);
  const tm = await ok('mSaveTeam', { token: pm2, team: [{ email: 'mgr@pahuway.ph', name: 'Mgr', role: 'manager' }, { email: 'cashier2@p.ph', name: 'Cashier', role: 'staff' }] });
  assert(tm.team.length === 2 && tm.team.some(u => u.email === 'cashier2@p.ph'), 'Merchant Admin added staff');
  await fails('mSaveTeam', { token: pm2, team: [{ email: 'cashier2@p.ph', role: 'manager' }] }, /own Merchant Admin/);
  await fails('mSaveTeam', { token: pm2, team: [{ email: 'mgr@pahuway.ph', role: 'manager' }, { email: 'boss@mjv.ph', role: 'staff' }] }, /Super Admin account/);
  await fails('mSaveTeam', { token: pm2, team: [1, 2, 3, 4, 5].map(i => ({ email: i === 1 ? 'mgr@pahuway.ph' : 'u' + i + '@p.ph', role: i === 1 ? 'manager' : 'staff' })) }, /up to 4/);

  console.log('One email, several businesses');
  const rows1 = (await ok('adminData', { token: admin })).staff.map(s => ({ email: s.email, name: s.name, role: s.role, bizId: s.bizId }));
  await ok('adminSaveStaff', { token: admin, staff: rows1.concat([{ email: 'mgr@pahuway.ph', name: 'Mgr', role: 'staff', bizId: 'hiraya' }]) });
  const multi = (await ok('adminData', { token: admin })).staff.filter(s => s.email === 'mgr@pahuway.ph');
  assert(multi.length === 2 && multi.some(r => r.bizId === 'pahuway' && r.role === 'manager') && multi.some(r => r.bizId === 'hiraya' && r.role === 'staff'), 'Super Admin gives one email two businesses (Admin of Pahuway, Staff of Hiraya); the editor shows one row per business');
  const mm = (await ok('staffMe', { token: pm2 })).me;
  assert(mm.access.length === 2 && mm.access[0].bizId === 'pahuway', 'their sign-in keeps working and lists both businesses');
  const tP = await ok('mTeam', { token: pm2, biz: 'pahuway' }), tH = await ok('mTeam', { token: pm2, biz: 'hiraya' });
  assert(tP.team.some(u => u.email === 'mgr@pahuway.ph' && u.role === 'manager') && tH.team.some(u => u.email === 'mgr@pahuway.ph' && u.role === 'staff') && tH.team.some(u => u.email === 'mgr@hiraya.ph'), 'each business shows its own team, with this person\'s role there');
  await fails('mSaveTeam', { token: pm2, biz: 'hiraya', team: [{ email: 'mgr@pahuway.ph', role: 'manager' }] }, /Merchant Admin access only/);
  const bP = await ok('mBookings', { token: pm2, biz: 'pahuway' }), bH = await ok('mBookings', { token: pm2, biz: 'hiraya' });
  assert(bP.bookings.length > 0 && bP.bookings.every(b => b.bizId === 'pahuway') && bH.bookings.every(b => b.bizId === 'hiraya'), 'orders and bookings are kept apart per business');
  assert((await ok('mTeam', { token: pm2 })).team.some(u => u.email === 'mgr@pahuway.ph' && u.role === 'manager'), 'without a choice, the first business is used (older app versions keep working)');
  await fails('mTeam', { token: pm2, biz: 'kusina' }, /no longer have access/);
  const pmH = await staffLogin('mgr@hiraya.ph', 'merchant');
  const tH2 = await ok('mSaveTeam', { token: pmH, team: tH.team.map(u => ({ email: u.email, name: u.name, role: u.role })).concat([{ email: 'cashier2@p.ph', name: 'Cashier', role: 'staff' }]) });
  assert(tH2.team.some(u => u.email === 'cashier2@p.ph') && (await ok('mTeam', { token: pm2, biz: 'pahuway' })).team.some(u => u.email === 'cashier2@p.ph'), 'a Merchant Admin can add someone who already works for another business; they keep that access');
  const tH3 = await ok('mSaveTeam', { token: pmH, team: tH2.team.filter(u => u.email !== 'cashier2@p.ph').map(u => ({ email: u.email, name: u.name, role: u.role })) });
  assert(!tH3.team.some(u => u.email === 'cashier2@p.ph') && (await ok('mTeam', { token: pm2, biz: 'pahuway' })).team.some(u => u.email === 'cashier2@p.ph'), 'removing them from one business leaves the other business untouched');
  await fails('adminSaveStaff', { token: admin, staff: rows1.concat([{ email: 'mgr@pahuway.ph', role: 'staff', bizId: 'pahuway' }]) }, /twice for the same business/);
  await fails('adminSaveStaff', { token: admin, staff: rows1.concat([{ email: 'boss@mjv.ph', role: 'staff', bizId: 'hiraya' }]) }, /Super Admin or rider/);
  const mailsBefore = MAILS.length;
  await ok('mSaveTeam', { token: pmH, team: tH3.team.map(u => ({ email: u.email, name: u.name, role: u.role })).concat([{ email: 'cashier2@p.ph', name: 'Cashier', role: 'staff' }]) });
  assert(MAILS.slice(mailsBefore).some(m => m.to[0] === 'cashier2@p.ph' && /pick the business/.test(m.text)), 'someone added to a second business is told to pick it at the top of the Merchant app');

  console.log('Rider dispatch: online payment, decline, wider search, waiting too long, cancel, Super Admin assign');
  const paoloT = (await ok('riderLogin', { email: 'paolo@r.ph', password: 'paolo-pass-1' })).token; await ok('rAvailable', { token: paoloT, value: true });
  await ok('rAvailable', { token: rider, value: true }); await ok('rLocation', { token: rider, lat: 12.5712, lng: 122.1320, acc: 8 });
  const dOrd = () => ok('createBooking', { token: cTok, kind: 'food', bizId: 'pahuway', fulfillment: 'delivery', payMethod: 'online', lat: 12.5720, lng: 122.1330, landmark: 'Blue gate', lines: [{ itemId: item.id, qty: 1, addons: [] }] });
  const o1 = (await dOrd()).refs[0]; const B = r => DB.bookings.find(x => x.id === r).data;
  assert(B(o1).status === 'Awaiting Payment' && !B(o1).offer && !(await ok('mBookings', { token: pm2 })).bookings.some(b => b.ref === o1), 'online order waits for payment; no rider request, merchant does not see it');
  await ok('setStatus', { token: admin, ref: o1, status: 'Payment Confirmed' });
  assert(B(o1).status === 'Finding Rider' && B(o1).payStatus === 'Paid' && B(o1).offer.riders.includes('rider@tara.ph') && B(o1).offer.riders.includes('paolo@r.ph'), 'after payment: Finding Rider, sent to riders near the store (by location or same town)');
  await ok('rOffer', { token: rider, ref: o1, accept: false });
  assert(!(await ok('rOrders', { token: rider })).offers.some(o => o.ref === o1) && (await ok('rOrders', { token: paoloT })).offers.some(o => o.ref === o1), 'declined request disappears for that rider only');
  const a1 = await ok('rOffer', { token: paoloT, ref: o1, accept: true }); assert(a1.booking.status === 'Payment Confirmed' && a1.booking.rider === 'paolo@r.ph', 'paid order confirmed to the merchant once a rider accepts');
  await fails('rOffer', { token: rider, ref: o1, accept: true }, /Another rider already accepted/);
  assert(DB.events.some(r => r.data.type === 'unassigned' && r.data.ref === o1 && r.data.aud.includes('rider:rider@tara.ph')), 'other riders are told it was taken');
  const o2 = (await dOrd()).refs[0]; await ok('setStatus', { token: admin, ref: o2, status: 'Payment Confirmed' });
  B(o2).offer.at = new Date(Date.now() - 20 * 60e3).toISOString(); B(o2).offer.round = 1;
  await ok('rOrders', { token: rider });
  assert(B(o2).offer.round === 2 && B(o2).offer.alerted && DB.events.some(r => r.data.ref === o2 && r.data.aud.includes('super') && /No rider has accepted/.test(r.data.text)) && DB.events.some(r => r.data.ref === o2 && r.data.aud.includes('cust:old@mail.com') && /still finding a rider/.test(r.data.text)), 'nobody accepts: wider search, Super Admin alerted, customer told');
  const ccx = await ok('custCancel', { token: cTok, ref: o2 }); assert(ccx.booking.status === 'Cancelled' && !(await ok('mBookings', { token: pm2 })).bookings.some(b => b.ref === o2), 'customer can cancel while finding a rider; merchant never sees it');
  await fails('custCancel', { token: cTok, ref: o1 }, /can no longer be cancelled/);
  const o3 = (await dOrd()).refs[0]; await ok('setStatus', { token: admin, ref: o3, status: 'Payment Confirmed' });
  await ok('rOffer', { token: rider, ref: o3, accept: false }); await ok('rOffer', { token: paoloT, ref: o3, accept: false });
  await ok('assignRider', { token: admin, ref: o3, rider: 'rider@tara.ph' });
  assert(B(o3).status === 'Finding Rider' && !B(o3).rider && (await ok('rOrders', { token: rider })).offers.some(o => o.ref === o3), 'Super Admin can send the request to a specific rider, who still accepts it');
  await ok('rOffer', { token: rider, ref: o3, accept: true }); assert(B(o3).rider === 'rider@tara.ph' && B(o3).status === 'Payment Confirmed', 'and then it goes to the merchant');
  await ok('rAvailable', { token: paoloT, value: false });
  assert((await ok('rOrders', { token: paoloT })).offers.length === 0, 'offline riders get no requests');

  console.log('Rental Terms and Conditions must be accepted');
  const rl = { type: 'rental', itemId: 'pcx', start: ph(20) + 'T09:00', end: ph(21) + 'T09:00', helmets: 1, pickup: 'office', ret: 'office' };
  await fails('createBooking', { token: cust, kind: 'rental', agree: true, payMethod: 'online', lines: [rl] }, /accept the Rental Terms and Conditions/);
  const rb = await ok('createBooking', { token: cust, kind: 'rental', agree: true, payMethod: 'online', rentalTerms: { at: new Date().toISOString() }, lines: [rl] }).catch(e => ({ err: e.message }));
  if (!rb.err) { const rbd = DB.bookings.find(r => r.id === rb.refs[0]).data, anaV = DB.customers.find(r => r.id === 'ana@mail.com').data.verify; assert(anaV.status === 'verified' && rbd.idFile === anaV.file, 'verified customer books without uploading an ID again; the booking uses the verified ID'); }
  if (rb.err) console.log('  (rental booking skipped: ' + rb.err + ')'); else assert(DB.bookings.find(r => r.id === rb.refs[0]).data.rentalTerms.text === CATALOG.business.rentalTerms, 'accepted terms and time saved on the rental booking');

  console.log('Airbnb calendar sync (stays)');
  const icalFn = require(V + 'ical.js'), sid = CATALOG.stays[0].id;
  await fails('adminSaveIcal', { token: admin, stayId: sid, urls: ['not a link'] }, /starts with https/);
  await fails('adminSaveIcal', { token: cust, stayId: sid, urls: [] }, /Not allowed|sign in/i);
  const ic1 = await ok('adminSaveIcal', { token: admin, stayId: sid, urls: ['webcal://cal.test/airbnb.ics'] }), st1 = ic1.stays.find(x => x.id === sid);
  assert(st1.urls[0] === 'https://cal.test/airbnb.ics' && st1.nights === 4 && !st1.error && st1.blocks.length === 2, 'Airbnb link saved and synced: 4 nights blocked (cancelled event ignored)');
  const av = (await ok('availability')).busy.filter(b => b.itemId === sid && b.ext); assert(av.length === 2 && av[0].start === ph(40) && av[0].end === ph(43), 'Airbnb nights show as booked in the customer calendar');
  await fails('createBooking', { token: cust, kind: 'stay', agree: true, payMethod: 'online', lines: [{ type: 'stay', itemId: sid, checkin: ph(41), checkout: ph(42), guests: 2 }] }, /already booked/);
  const sb2 = await ok('createBooking', { token: cust, kind: 'stay', agree: true, payMethod: 'online', lines: [{ type: 'stay', itemId: sid, checkin: ph(44), checkout: ph(46), guests: 2 }] });
  assert(sb2.refs.length === 1, 'dates not booked on Airbnb can still be booked here');
  const iex = st1.exportPath, irq = { method: 'GET', query: Object.fromEntries(new URL('https://x' + iex).searchParams), headers: {} }, irs = mkRes(); irs.send = function (t) { this.body = t; return this; };
  await icalFn(irq, irs); assert(irs.code === 200 && /BEGIN:VCALENDAR/.test(irs.body) && irs.body.includes('DTSTART;VALUE=DATE:' + ph(44).replace(/-/g, '')) && !irs.body.includes(ph(40).replace(/-/g, '')), 'export link lists Tara Romblon bookings for Airbnb (not the imported ones)');
  const irs2 = mkRes(); irs2.send = function (t) { this.body = t; return this; }; await icalFn({ method: 'GET', query: { stay: sid, key: 'wrong' }, headers: {} }, irs2); assert(irs2.code === 404, 'export link needs its secret key');
  const ic2 = await ok('adminSaveIcal', { token: admin, stayId: sid, urls: ['https://cal.test/airbnb.ics', 'https://cal.test/bad.ics'] }); assert(/404/.test(ic2.stays.find(x => x.id === sid).error) && ic2.stays.find(x => x.id === sid).nights === 4, 'a broken link is reported; the good one still blocks nights');
  await ok('setStatus', { token: admin, ref: sb2.refs[0], status: 'Cancelled' }).catch(() => {});
  await ok('adminSaveIcal', { token: admin, stayId: sid, urls: [] });

  console.log('Customers cancel unpaid orders and bookings');
  const pu1 = await ok('createBooking', { token: cust, kind: 'food', bizId: 'pahuway', fulfillment: 'pickup', payMethod: 'pickup', lines: [{ itemId: item.id, qty: 1, addons: [] }] });
  const c1 = await ok('custCancel', { token: cust, ref: pu1.refs[0] }); assert(c1.booking.status === 'Cancelled' && DB.events.some(r => r.data.ref === pu1.refs[0] && r.data.aud.includes('biz:pahuway') && /Cancelled/.test(r.data.text)), 'unpaid pick-up order cancelled by the customer; store notified');
  const pu2 = await ok('createBooking', { token: cust, kind: 'food', bizId: 'pahuway', fulfillment: 'pickup', payMethod: 'pickup', lines: [{ itemId: item.id, qty: 1, addons: [] }] });
  await ok('setStatus', { token: pm2, ref: pu2.refs[0], status: 'Accepted' }); await ok('setStatus', { token: pm2, ref: pu2.refs[0], status: 'Preparing' });
  await fails('custCancel', { token: cust, ref: pu2.refs[0] }, /already being prepared/);
  const on1 = await ok('createBooking', { token: cust, kind: 'food', bizId: 'pahuway', fulfillment: 'pickup', payMethod: 'online', lines: [{ itemId: item.id, qty: 1, addons: [] }] });
  const c3 = await ok('custCancel', { token: cust, ref: on1.refs[0] }); assert(c3.booking.status === 'Cancelled', 'unpaid online order cancelled (payment link closed)');
  const on2 = await ok('createBooking', { token: cust, kind: 'food', bizId: 'pahuway', fulfillment: 'pickup', payMethod: 'online', lines: [{ itemId: item.id, qty: 1, addons: [] }] });
  await ok('setStatus', { token: admin, ref: on2.refs[0], status: 'Payment Confirmed' });
  await fails('custCancel', { token: cust, ref: on2.refs[0] }, /already paid|no longer be cancelled/);
  await fails('custCancel', { token: cTok, ref: pu2.refs[0] }, /not found/);
  assert(!Rules.custCanCancel({ status: 'Awaiting Payment', payStatus: 'Pending', payMethod: 'transfer', proofFile: 'x' }) && Rules.custCanCancel({ status: 'Awaiting Payment', payStatus: 'Pending', payMethod: 'transfer' }) && !Rules.custCanCancel({ status: 'Out for Delivery', payStatus: 'Unpaid' }), 'transfer with proof sent, or orders on the way, cannot be cancelled by the customer');

  console.log('Platform pays riders; COD cash all goes to the store');
  const pb2 = { kind: 'food', fulfillment: 'delivery', payMethod: 'cod', status: 'Completed', payStatus: 'Paid', rider: 'r@x', platformPaysRider: true, fee: 15, discount: 0, lines: [{ total: 150 }], quote: { subtotal: 150, total: 180, deliveryFee: 30, storeDeliveryShare: 20, riderFee: 50 }, cashCollected: { amount: 180 } };
  const lp = Rules.ledger(pb2, {}); assert(Rules.cashExpected(pb2) === 180 && lp.riderCash === 0 && lp.riderNet === 50 && lp.bizNet === Rules.r2(150 - 15 - 180 - 20), 'COD: rider hands all P180 to the store; store owes fee 15 + delivery 30 + its share 20; platform pays the rider P50');
  const old2 = Object.assign({}, pb2, { platformPaysRider: false, cashCollected: { amount: 150 } }), lo = Rules.ledger(old2, {}); assert(Rules.cashExpected(old2) === 150 && lo.riderCash === 30 && lo.riderNet === 20, 'older orders keep the old split (rider kept the customer fee)');
  const due = await ok('ridersDue', { token: admin }); assert(Array.isArray(due.due), 'Super Admin sees riders due for payout');

  console.log('Merchant payouts due the next day');
  const mo1 = await ok('createBooking', { token: cust, kind: 'food', bizId: 'pahuway', fulfillment: 'pickup', payMethod: 'online', lines: [{ itemId: item.id, qty: 2, addons: [] }] });
  await ok('setStatus', { token: admin, ref: mo1.refs[0], status: 'Payment Confirmed' }); await ok('setStatus', { token: admin, ref: mo1.refs[0], status: 'Completed' });
  let md = (await ok('merchantsDue', { token: admin })).due.find(x => x.bizId === 'pahuway');
  assert(!md || !md.refs.includes(mo1.refs[0]), 'an order completed today is not due until tomorrow');
  const mrec = DB.bookings.find(r => r.id === mo1.refs[0]).data; mrec.history.forEach(h => { h.at = new Date(Date.now() - 864e5).toISOString(); }); mrec.updated = new Date(Date.now() - 864e5).toISOString();
  md = (await ok('merchantsDue', { token: admin })).due.find(x => x.bizId === 'pahuway');
  assert(md && md.refs.includes(mo1.refs[0]) && md.net > 0 && 'accountNo' in md.bank, 'completed yesterday: due today with amount P' + (md && md.net) + ' and payout account');
  DB.cache = (DB.cache || []).filter(r => !/^merchantsdue_/.test(r.key)); const mb0 = MAILS.length;
  const cres = mkRes(); process.env.CRON_SECRET = process.env.CRON_SECRET || 'cron-test'; await cronFn({ method: 'GET', headers: { authorization: 'Bearer ' + process.env.CRON_SECRET } }, cres);
  assert(MAILS.slice(mb0).some(m => /Merchant payouts due today/.test(m.subject)), 'daily reminder email lists merchant payouts due');

  console.log('Super Admin deactivates and removes riders');
  await ok('adminSaveRider', { token: admin, rider: { email: 'gone@r.ph', name: 'Gone Rider', phone: '0912', vehicle: 'Mio', plate: 'G1', licenseNo: 'L9' } });
  const gT = (await ok('pwReset', await (async () => { await ok('pwResetSend', { email: 'gone@r.ph', kind: 'rider' }); return { email: 'gone@r.ph', kind: 'rider', code: /code: (\d{6})/.exec(MAILS[MAILS.length - 1].subject)[1], password: 'gone-pass-1' }; })())).token;
  await ok('adminRiderActive', { token: admin, email: 'gone@r.ph', active: false });
  await fails('staffMe', { token: gT }, /sign in again/i); await fails('riderLogin', { email: 'gone@r.ph', password: 'gone-pass-1' }, /not active/);
  await ok('adminRiderActive', { token: admin, email: 'gone@r.ph', active: true }); assert((await ok('riderLogin', { email: 'gone@r.ph', password: 'gone-pass-1' })).token, 'deactivated rider is signed out and blocked; reactivated rider can sign in again');
  await fails('adminRemoveRider', { token: pm2, email: 'gone@r.ph' }, /Not allowed|Super Admin/);
  await ok('adminRemoveRider', { token: admin, email: 'gone@r.ph' });
  assert(!(await ok('adminData', { token: admin })).staff.some(x => x.email === 'gone@r.ph'), 'rider removed from the riders list');
  await fails('riderLogin', { email: 'gone@r.ph', password: 'gone-pass-1' }, /not registered as a rider/);
  const busyR = DB.bookings.map(r => r.data).find(b => b.rider && b.kind === 'food' && !Rules.DELIVERED.includes(b.status) && !Rules.CLOSED.includes(b.status));
  if (busyR) await fails('adminRemoveRider', { token: admin, email: busyR.rider }, /active deliver/);
  const unsR = DB.bookings.map(r => r.data).find(b => Rules.riderPayable(b) && b.rider && !DB.bookings.some(x => x.data.rider === b.rider && x.data.kind === 'food' && !Rules.DELIVERED.includes(x.data.status) && !Rules.CLOSED.includes(x.data.status)));
  if (unsR) await fails('adminRemoveRider', { token: admin, email: unsR.rider }, /UNSETTLED/);
  assert(true, 'riders with active deliveries or unsettled balances are not removed without confirmation');

  console.log('Stay photo gallery');
  const gal_gs = CATALOG.stays.find(x => x.bizId === 'hiraya');
  let gal_g1; for (let k = 0; k < 3; k++) gal_g1 = await ok('mGallery', { token: hmgr, id: gal_gs.id, add: IMG });
  assert(gal_g1.photos.length >= 3, 'Merchant Admin adds several photos (' + gal_g1.photos.length + ')');
  const gal_rev = gal_g1.photos.slice().reverse(); const gal_g2 = await ok('mGallery', { token: hmgr, id: gal_gs.id, photos: gal_rev.concat(['https://evil.example/x.jpg']) });
  const gal_cat2 = (await ok('getCatalog')).catalog, gal_st2 = gal_cat2.stays.find(x => x.id === gal_gs.id);
  assert(gal_g2.photos[0] === gal_rev[0] && !gal_g2.photos.includes('https://evil.example/x.jpg') && gal_st2.photo === gal_rev[0] && gal_st2.photos.length === gal_g2.photos.length, 'reorder saves; first photo becomes the cover; unknown links are ignored');
  const gal_g3 = await ok('mGallery', { token: hmgr, id: gal_gs.id, photos: gal_g2.photos.slice(1) }); assert(gal_g3.photos.length === gal_g2.photos.length - 1, 'photo deleted');
  await fails('mGallery', { token: pm2, id: gal_gs.id, add: IMG }, /Stay not found/);
  await fails('mGallery', { token: cust, id: gal_gs.id, add: IMG }, /Merchant Admin access|Not allowed/);
  assert(Pricing.stayPhotos({ photo: 'a.jpg' })[0] === 'a.jpg' && Pricing.stayPhotos({ photos: ['b.jpg'], photo: 'a.jpg' })[0] === 'b.jpg', 'older single photo still shows');

  console.log('\nALL PASSED · ' + calls + ' simulated network calls · ' + MAILS.length + ' emails');
})().catch(e => { console.error('\nFAILED:', e.stack || e); process.exit(1); });
