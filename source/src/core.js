/* ===== CORE BACKEND — one implementation, used by demo mode (browser) and by the Vercel + Supabase API ===== */
var DEFAULT_SETTINGS = {
  requireIdVerification: true, idUploadAtCheckout: 'optional', proofUpload: 'required', transferEnabled: true,
  transferInstructions: 'Send your payment to GCash 0917 000 0000 (Beyond Tech Solutions) or BPI 0000-0000-00 (Beyond Tech Solutions), then upload a screenshot of your receipt.',
  riderSharePct: 100, codCashTo: 'rider', codMinCompleted: 3, codMax: 500, riderPayoutDays: 3, riderDispatch: true, dispatchKm: 5, dispatchWidenMin: 3, dispatchAlertMin: 15, codExemptBefore: '2026-11-21', email: { customers: true, merchants: true, admins: true, riders: true },
  /* Stays and Things to do show "Coming soon" until a Super Admin opens them in Settings */
  staysLive: false, toursLive: false
};
/* env (all methods may return a value or a Promise):
   db.all(table) · db.get(table, id) · db.byToken(table, token) (optional) · db.put(table, obj) · db.tail(table, n) · db.replaceAll(table, list) · db.kvGet(key) · db.kvPut(key, value)
   cache.get(key) · cache.put(key, value, seconds) · cache.remove(key)
   files.save(dataUrl, name, isPrivate) -> {id, url} · files.read(id) -> url or data URL
   hitpay.create({amount, ref, email, name, phone, purpose}) -> {id, url} | null · hitpay.status(id) -> 'completed' | other
   loyverse (optional): find(token, email, phone) -> customer | null · save(token, customer) -> customer
   mail(to, subject, body) · now() · today() · uuid() · demo · defaultCatalog · siteUrl · notifyEmail */
function createCore(env) {
  var T = { cust: 'customers', staff: 'staff', book: 'bookings', thr: 'threads', msg: 'messages', ev: 'events', app: 'applications', pay: 'payouts', pts: 'points' };
  function err(m) { throw new Error(m); }
  function now() { return env.now(); }
  function low(e) { return String(e || '').trim().toLowerCase(); }
  function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  async function catalog(required) { var c = (await env.db.kvGet('catalog')) || (env.demo ? clone(env.defaultCatalog) : null); if (!c && required) err('Bookings are not open yet. (Super Admin: open Listings & rates and tap Save once.)'); return Pricing.norm(c); }
  function settings(cat) { var s = clone(DEFAULT_SETTINGS), x = (cat && cat.settings) || {}; for (var k in x) s[k] = x[k]; s.email = Object.assign({}, DEFAULT_SETTINGS.email, x.email || {}); return s; }
  function biz(cat, id) { return ((cat && cat.businesses) || []).filter(function (b) { return b.id === id; })[0] || null; }
  function bizName(cat, id) { var b = biz(cat, id); return b ? b.name : id; }
  async function staffAll() { return await env.db.all(T.staff); }
  function newRef(prefix) { return (prefix || 'TR') + '-' + env.today().slice(2).replace(/-/g, '') + '-' + env.uuid().replace(/[^a-z0-9]/gi, '').slice(-5).toUpperCase(); }
  /* Merchant users can work for several businesses: access = [{ bizId, role }]. role/bizId hold the first one (older records have only those). */
  function isMerchantRole(r) { return r === 'manager' || r === 'staff'; }
  function accessOf(s) { return s && isMerchantRole(s.role) ? (s.access && s.access.length ? s.access : [{ bizId: s.bizId || '', role: s.role }]).filter(function (a) { return a.bizId && isMerchantRole(a.role); }) : []; }
  function roleIn(s, bizId) { var a = accessOf(s).filter(function (x) { return x.bizId === bizId; })[0]; return a ? a.role : ''; }
  function setAccess(s, list) { s.access = list; if (list.length) { s.role = list[0].role; s.bizId = list[0].bizId; } return s; }
  function pubStaff(s) { var o = { email: s.email, name: s.name, role: s.role, bizId: s.bizId || '', phone: s.phone || '', available: !!s.available, lastSeen: s.lastSeen || '' }; if (isMerchantRole(s.role)) o.access = accessOf(s); return o; }
  /* one row per business, for the Super Admin user editor */
  function staffRows(list) { var out = []; list.forEach(function (s) { var a = accessOf(s); if (a.length > 1) a.forEach(function (x) { out.push(Object.assign(adminStaff(s), { role: x.role, bizId: x.bizId })); }); else out.push(adminStaff(s)); }); return out; }
  var RIDER_FIELDS = ['address', 'town', 'vehicle', 'plate', 'licenseNo', 'licenseExpiry', 'licenseFile', 'licenseStatus', 'licenseNote', 'active', 'joined', 'appId'];
  function adminStaff(s) { var o = pubStaff(s); if (s.role === 'rider') RIDER_FIELDS.forEach(function (k) { if (s[k] != null) o[k] = s[k]; }); return o; }
  function str(v, n) { return String(v == null ? '' : v).trim().slice(0, n || 200); }
  function cleanBank(b) { b = b || {}; return { accountName: str(b.accountName, 120), bank: str(b.bank, 80), accountNo: str(b.accountNo, 40), notes: str(b.notes, 200) }; }
  async function payees() { return (await env.db.kvGet('payees')) || {}; }
  async function savePayee(party, bank) { var p = await payees(); p[party] = Object.assign(cleanBank(bank), { updated: now() }); await env.db.kvPut('payees', p); return p[party]; }
  function slug(t) { return String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30); }
  function pubCust(c) { return { email: c.email, name: c.name || '', phone: c.phone || '', address: c.address || '', birthday: c.birthday || '', created: c.created, verify: c.verify || { status: 'unverified' }, hasPassword: !!c.pw, google: c.signup === 'google' }; }
  function strip(b, keep) { var c = clone(b); delete c.hitpayId; if (!keep) { delete c.adminNotes; } return c; }

  /* ---------- auth ---------- */
  /* change a few fields on the latest copy of a record (never write back an older copy: it could drop a session created meanwhile on another device) */
  async function patch(t, id, fn) { var g = env.db.fresh || env.db.get; var r = await g.call(env.db, t, id); if (!r) return null; fn(r); await env.db.put(t, r); return r; }
  function addToken(rec) { var t = env.uuid() + env.uuid().slice(0, 8); rec.tokens = [t].concat(rec.tokens || []).slice(0, 10); return t; }
  /* every session is also kept on its own (cache table, 180 days), so a background save of the account can never sign someone out.
     sessEpoch goes up on password reset / deactivation / role change, which ends all older sessions on purpose. */
  var SESS_DAYS = 180;
  async function remember(table, rec, t) { await env.cache.put('sess:' + t, table + '|' + (rec.id || rec.email) + '|' + (rec.sessEpoch || 0), SESS_DAYS * 86400); return t; }
  async function fromSession(table, token) {
    if (!/^[A-Za-z0-9-]{20,80}$/.test(String(token || ''))) return null;
    var v = await env.cache.get('sess:' + token); if (!v) return null; var p = String(v).split('|'); if (p[0] !== table) return null;
    var g = env.db.fresh || env.db.get, r = await g.call(env.db, table, p[1]); if (!r || String(r.sessEpoch || 0) !== p[2]) return null;
    if ((r.tokens || []).indexOf(token) < 0) r = await patch(table, r.id || p[1], function (x) { x.tokens = [token].concat(x.tokens || []).slice(0, 10); });   /* heal */
    return r;
  }
  var reqBiz = ''; /* the business a merchant user is working on (sent by the Merchant app as "biz") */
  async function auth(token, need) {
    if (!token) err('Please sign in again.');
    var c = env.db.byToken ? await env.db.byToken(T.cust, token) : (await env.db.all(T.cust)).filter(function (x) { return (x.tokens || []).indexOf(token) >= 0; })[0];
    if (!c) c = await fromSession(T.cust, token);
    if (c) { if (need && need !== 'customer') err('Not allowed.'); return { kind: 'customer', role: 'customer', email: c.email, name: c.name, rec: c }; }
    var s = env.db.byToken ? await env.db.byToken(T.staff, token) : (await staffAll()).filter(function (x) { return (x.tokens || []).indexOf(token) >= 0; })[0];
    if (!s) s = await fromSession(T.staff, token);
    if (!s) err('Please sign in again.');
    var who = { kind: 'staff', role: s.role, bizId: s.bizId || '', email: s.email, name: s.name || s.email, rec: s };
    if (isMerchantRole(s.role)) {
      var acc = accessOf(s), pick = acc.filter(function (a) { return a.bizId === reqBiz; })[0] || acc[0];
      if (reqBiz && pick.bizId !== reqBiz) err('You no longer have access to that business. Please sign in again.');
      if (pick) { who.role = pick.role; who.bizId = pick.bizId; }
    }
    if (need === 'customer') err('Not allowed.');
    if (need === 'super' && s.role !== 'super') err('Super Admin access only.');
    if (need === 'merchant' && !isMerchantRole(who.role)) err('Merchant access only.');
    if (need === 'manager' && who.role !== 'manager') err('Merchant Admin access only.');
    if (need === 'rider' && s.role !== 'rider') err('Rider access only.');
    return who;
  }
  async function code(key, email, cat, purpose) {
    var n = +((await env.cache.get('otpn_' + key)) || 0); if (n >= 5) err('Too many codes requested. Try again in 15 minutes.');
    var c = String(Math.floor(100000 + Math.random() * 900000));
    await env.cache.put('otp_' + key, c, 600); await env.cache.put('otpn_' + key, String(n + 1), 900); await env.cache.remove('otpt_' + key);
    var app = (cat && cat.business && cat.business.name) || 'Tara Romblon';
    if (purpose === 'reset') await env.mail(email, 'Your ' + app + ' password reset code: ' + c, 'Use this code to set a new password: ' + c + '. It expires in 10 minutes. If you did not ask to reset your password, ignore this email.');
    else await env.mail(email, 'Your ' + app + ' sign-in code: ' + c, 'Your sign-in code is ' + c + '. It expires in 10 minutes. If you did not request this, ignore this email.');
    return env.demo ? { demoCode: c } : {};
  }
  async function check(key, c) {
    var t = +((await env.cache.get('otpt_' + key)) || 0); if (t >= 6) err('Too many attempts. Request a new code.');
    var saved = await env.cache.get('otp_' + key);
    if (!saved || saved !== String(c || '').trim()) { await env.cache.put('otpt_' + key, String(t + 1), 600); err('That code is incorrect or has expired.'); }
    await env.cache.remove('otp_' + key); await env.cache.remove('otpt_' + key);
  }

  /* ---------- notifications ---------- */
  async function audEmails(a, cat) {
    if (a.indexOf('cust:') === 0 || a.indexOf('rider:') === 0) return [a.slice(a.indexOf(':') + 1)];
    var all = await staffAll();
    if (a === 'super') return all.filter(function (s) { return s.role === 'super'; }).map(function (s) { return s.email; }).concat(env.notifyEmail ? [env.notifyEmail] : []);
    if (a.indexOf('biz:') === 0) { var id = a.slice(4), b = biz(cat, id); return all.filter(function (s) { return !!roleIn(s, id); }).map(function (s) { return s.email; }).concat(b && b.email ? [low(b.email)] : []); }
    return [];
  }
  function emailOk(a, st) { return a.indexOf('cust:') === 0 ? st.email.customers : a.indexOf('biz:') === 0 ? st.email.merchants : a === 'super' ? st.email.admins : st.email.riders; }
  /* event: shown in-app (bell) to every audience; emailed to the mailTo audiences */
  async function event(type, text, aud, ref, bizId, mailTo, subject, body, actorEmail) {
    var e = { id: env.uuid(), at: now(), type: type, text: text, ref: ref || '', bizId: bizId || '', aud: aud, by: actorEmail || '' };
    await env.db.put(T.ev, e);
    await pushEvent(e);
    var cat = await catalog(), st = settings(cat), sent = {};
    for (var i = 0; i < (mailTo || []).length; i++) {
      var a = mailTo[i]; if (!emailOk(a, st)) continue;
      var list = await audEmails(a, cat);
      for (var j = 0; j < list.length; j++) {
        var m = list[j]; if (!m || sent[m] || m === actorEmail) continue; sent[m] = 1;
        try { await env.mail(m, subject || text, (body || text) + (env.siteUrl ? '\n\nOpen the app: ' + env.siteUrl : '')); } catch (x) { }
      }
    }
  }
  /* ---------- passwords (customers and riders) ---------- */
  async function makePw(pw) { pw = String(pw || ''); if (pw.length < 8) err('Password must be at least 8 characters.'); if (pw.length > 200) err('Password is too long.'); var salt = env.uuid(); return { salt: salt, hash: await env.hashPw(pw, salt), at: now() }; }
  async function pwMatches(rec, pw) { return !!(rec && rec.pw && rec.pw.salt && (await env.hashPw(String(pw || ''), rec.pw.salt)) === rec.pw.hash); }
  async function pwGate(key) { var n = +((await env.cache.get('lgn_' + key)) || 0); if (n >= 10) err('Too many attempts. Try again in 15 minutes or tap "Forgot password?".'); return n; }
  async function pwFail(key, n) { await env.cache.put('lgn_' + key, String(n + 1), 900); err('Incorrect email or password.'); }
  /* ---------- phone notifications (Web Push) ---------- */
  var PUSH_TYPES = ['offer', 'status', 'new', 'assigned', 'message', 'application', 'verification', 'proof', 'payout', 'points'];
  async function pushRecipients(aud, actor) {
    var out = [], seen = {}, staff = null;
    for (var i = 0; i < aud.length; i++) {
      var a = aud[i], recs = [];
      if (a.indexOf('cust:') === 0) { var c = await env.db.get(T.cust, a.slice(5)); if (c) recs.push([T.cust, c, '/#orders']); }
      else { staff = staff || await staffAll();
        if (a.indexOf('rider:') === 0) staff.filter(function (s) { return s.email === a.slice(6) && s.role === 'rider'; }).forEach(function (s) { recs.push([T.staff, s, '/rider']); });
        else if (a === 'super') staff.filter(function (s) { return s.role === 'super'; }).forEach(function (s) { recs.push([T.staff, s, '/admin']); });
        else if (a.indexOf('biz:') === 0) staff.filter(function (s) { return !!roleIn(s, a.slice(4)); }).forEach(function (s) { recs.push([T.staff, s, '/merchant']); }); }
      recs.forEach(function (r) { if (r[1].email !== actor && !seen[r[1].email] && (r[1].push || []).length) { seen[r[1].email] = 1; out.push(r); } });
    }
    return out;
  }
  async function pushEvent(e) {
    if (!env.push || PUSH_TYPES.indexOf(e.type) < 0) return;
    try {
      var cat = await catalog(), title = (cat && cat.business && cat.business.name) || 'Tara Romblon', list = await pushRecipients(e.aud || [], e.by);
      await Promise.all(list.map(async function (r) {
        var rec = r[1], gone = [];
        await Promise.all(rec.push.map(async function (sub) { var res = await env.push(sub, { title: title, body: String(e.text).slice(0, 180), url: r[2], tag: e.ref || e.type }); if (res === 'gone') gone.push(sub.endpoint); }));
        if (gone.length) { var fresh = await env.db.get(r[0], rec.id || rec.email); if (fresh) { fresh.push = (fresh.push || []).filter(function (s) { return gone.indexOf(s.endpoint) < 0; }); await env.db.put(r[0], fresh); } }
      }));
    } catch (x) { console.error('push', x && x.message); }
  }
  function myAud(who) { return who.kind === 'customer' ? ['cust:' + who.email] : who.role === 'super' ? ['super'] : who.role === 'rider' ? ['rider:' + who.email] : ['biz:' + who.bizId]; }

  /* ---------- rider dispatch: nearby online riders get the delivery request; the first to accept takes it ---------- */
  function storeOf(cat, b) { var F = Pricing.store(cat, b.bizId) || {}; return { lat: +F.lat, lng: +F.lng, town: F.town || '', name: F.storeName || bizName(cat, b.bizId), address: F.address || '' }; }
  function riderKm(r, S) { return r.loc && r.loc.at && (Date.parse(now()) - Date.parse(r.loc.at)) < 20 * 6e4 && isFinite(S.lat) ? Pricing.round(Pricing.km(S.lat, S.lng, r.loc.lat, r.loc.lng)) : null; }
  async function candidates(b, cat, wide) {
    var st = settings(cat), S = storeOf(cat, b), max = +st.dispatchKm || 5, dec = (b.offer && b.offer.declined) || [];
    return (await staffAll()).filter(function (r) {
      if (r.role !== 'rider' || r.active === false || !r.available || dec.indexOf(r.email) >= 0) return false;
      if (r.lastSeen && (Date.parse(now()) - Date.parse(r.lastSeen)) > 30 * 6e4) return false;   /* app not open for 30 min */
      if (wide) return true;
      var k = riderKm(r, S); return k != null ? k <= max : (!S.town || !r.town || r.town === S.town);
    });
  }
  async function notifyOffer(b, cat, list) {
    if (!list.length) return;
    var S = storeOf(cat, b), q = b.quote || {};
    await event('offer', 'New delivery request: ' + S.name + ' → ' + (b.landmark || (b.customer && b.customer.address) || 'customer') + (q.km != null ? ' (' + q.km + ' km)' : '') + ' · you earn P' + (q.riderFee || 0) + '. Open the Rider app to accept.',
      list.map(function (r) { return 'rider:' + r.email; }), b.ref, b.bizId, [], '', '', '');
  }
  async function startOffer(b, cat) {
    var list = await candidates(b, cat, false), wide = false;
    if (!list.length) { list = await candidates(b, cat, true); wide = true; }
    b.offer = { at: now(), round: wide ? 2 : 1, riders: list.map(function (r) { return r.email; }), declined: (b.offer && b.offer.declined) || [] };
    await env.db.put(T.book, b); await notifyOffer(b, cat, list);
    if (!list.length) await event('status', 'No rider is online for ' + b.ref + ' (' + bizName(cat, b.bizId) + '). Assign one in Super Admin, or ask riders to go online.', ['super'], b.ref, b.bizId, ['super'], 'No rider online for ' + b.ref, 'No delivery rider is online for order ' + b.ref + '.', '');
  }
  /* run on every rider / customer refresh: widen a request nobody took, and warn the Super Admin if it waits too long */
  async function sweepOffers() {
    var cat = await catalog(), st = settings(cat), t = Date.parse(now()), open = (await allBookings()).filter(function (b) { return b.dispatch && !b.rider && b.offer && !b.offer.closed && Rules.CLOSED.indexOf(b.status) < 0 && b.status !== 'Awaiting Payment'; });
    for (var i = 0; i < open.length; i++) {
      var b = open[i], age = (t - Date.parse(b.offer.at)) / 6e4, changed = false;
      if (b.offer.round < 2 && age >= (+st.dispatchWidenMin || 3)) {
        var more = (await candidates(b, cat, true)).filter(function (r) { return b.offer.riders.indexOf(r.email) < 0; });
        b.offer.round = 2; b.offer.riders = b.offer.riders.concat(more.map(function (r) { return r.email; })); changed = true; await env.db.put(T.book, b); await notifyOffer(b, cat, more);
      }
      if (!b.offer.alerted && age >= (+st.dispatchAlertMin || 15)) {
        b.offer.alerted = now(); changed = true; await env.db.put(T.book, b);
        await event('status', 'No rider has accepted ' + b.ref + ' (' + bizName(cat, b.bizId) + ') after ' + Math.round(age) + ' min. Please assign a rider in Super Admin.', ['super'], b.ref, b.bizId, ['super'], 'Order ' + b.ref + ' still needs a rider', 'No rider has accepted order ' + b.ref + ' yet.', '');
        await event('status', b.ref + ': we are still finding a rider for your order. You can wait or cancel it in My orders.', ['cust:' + b.email], b.ref, b.bizId, [], '', '', '');
      }
      if (!changed) continue;
    }
  }
  function offerView(b, cat, me) {
    var S = storeOf(cat, b), q = b.quote || {}, k = riderKm(me, S);
    return { ref: b.ref, status: b.status, created: b.created, offerAt: b.offer.at, store: { name: S.name, address: S.address, lat: S.lat, lng: S.lng }, dropoff: { label: b.landmark || '', area: (b.customer && b.customer.address) || '', lat: b.lat, lng: b.lng },
      km: q.km, kmToStore: k, riderFee: q.riderFee || 0, subsidy: q.riderSubsidy || 0, customerFee: q.deliveryFee || 0, storeFee: q.storeDeliveryShare || 0, incentive: q.deliveryIncentive || 0, payMethod: b.payMethod, collect: b.payMethod === 'cod' ? Rules.payable(b) : 0, payStore: b.payMethod === 'cod' && b.riderPaysStore ? Rules.codAmounts(b).payStore : 0, items: (b.lines || []).reduce(function (t, l) { return t + (+l.qty || 1); }, 0) };
  }

  /* ---------- bookings ---------- */
  async function allBookings() { return await env.db.all(T.book); }
  async function getB(ref) { var b = await env.db.get(T.book, ref); if (!b) err('Booking not found.'); return b; }
  async function busy() {
    var own = (await allBookings()).filter(function (b) { return b.kind !== 'food' && Rules.FREE.indexOf(b.status) < 0; })
      .reduce(function (o, b) { return o.concat(b.lines.map(function (l) { return { type: l.type, itemId: l.itemId, start: l.start, end: l.end }; })); }, []);
    var ext = []; try { var d = await icalData(false); Object.keys(d).forEach(function (id) { (d[id].events || []).forEach(function (e) { ext.push({ type: 'stay', itemId: id, start: e.start, end: e.end, ext: true }); }); }); } catch (x) { }
    return own.concat(ext);
  }
  /* ---------- calendar sync (Airbnb, Booking.com, Vrbo, Google… any iCal link) ---------- */
  function parseIcs(txt) {
    var lines = String(txt || '').replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n'), out = [], ev = null;
    var day = function (v) { var m = /(\d{4})(\d{2})(\d{2})(T(\d{2})(\d{2})(\d{2})(Z)?)?/.exec(v || ''); if (!m) return null; if (m[8]) { var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[5], +m[6], +m[7]) + 8 * 3600e3); return d.toISOString().slice(0, 10); } return m[1] + '-' + m[2] + '-' + m[3]; };
    lines.forEach(function (ln) {
      if (ln === 'BEGIN:VEVENT') ev = {}; else if (ln === 'END:VEVENT') { if (ev && ev.start && ev.status !== 'CANCELLED') { if (!ev.end || ev.end <= ev.start) { var d2 = new Date(ev.start + 'T00:00:00Z'); d2.setUTCDate(d2.getUTCDate() + 1); ev.end = d2.toISOString().slice(0, 10); } out.push({ start: ev.start, end: ev.end, summary: String(ev.summary || '').slice(0, 60) }); } ev = null; }
      else if (ev) { var i = ln.indexOf(':'), k = ln.slice(0, i).split(';')[0].toUpperCase(), v = ln.slice(i + 1); if (k === 'DTSTART') ev.start = day(v); else if (k === 'DTEND') ev.end = day(v); else if (k === 'SUMMARY') ev.summary = v; else if (k === 'STATUS') ev.status = v.trim().toUpperCase(); }
    });
    return out;
  }
  async function icalData(force) {
    var d = (await env.db.kvGet('ical')) || {}; if (!env.fetchText) return d;
    var t = Date.parse(now()), ids = Object.keys(d).filter(function (id) { return (d[id].urls || []).length; });
    var stale = ids.filter(function (id) { return force === id || force === true || !d[id].synced || t - Date.parse(d[id].synced) > 15 * 6e4; });
    if (!stale.length || (!force && await env.cache.get('icslock'))) return d;
    await env.cache.put('icslock', '1', 60);
    for (var i = 0; i < stale.length; i++) {
      var id = stale[i], evs = [], errs = [];
      for (var j = 0; j < d[id].urls.length; j++) { try { evs = evs.concat(parseIcs(await env.fetchText(d[id].urls[j]))); } catch (x) { errs.push((j + 1) + ': ' + String(x.message || x).slice(0, 80)); } }
      d[id].synced = now(); d[id].error = errs.join(' · ');
      if (evs.length || !errs.length) d[id].events = evs.filter(function (e) { return e.end >= env.today(); }).slice(0, 400);
    }
    await env.db.kvPut('ical', d); return d;
  }
  function icsEsc(s) { return String(s).replace(/[\;,]/g, function (c) { return '\\' + c; }); }
  async function icsFeed(stayId, key) {
    if (!env.sign || !stayId || key !== env.sign('ical:' + stayId)) err('Not found.');
    var cat = await catalog(), s = cat.stays.filter(function (x) { return x.id === stayId; })[0]; if (!s) err('Not found.');
    var ymd = function (d) { return String(d).replace(/-/g, '').slice(0, 8); }, stamp = now().replace(/[-:]/g, '').replace(/\.\d+/, '');
    var ev = (await allBookings()).filter(function (b) { return b.kind !== 'food' && Rules.FREE.indexOf(b.status) < 0; }).reduce(function (o, b) { return o.concat(b.lines.filter(function (l) { return l.type === 'stay' && l.itemId === stayId && l.end >= env.today(); }).map(function (l) { return ['BEGIN:VEVENT', 'UID:' + b.ref + '-' + l.itemId + '@tararomblon', 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + ymd(l.start), 'DTEND;VALUE=DATE:' + ymd(l.end), 'SUMMARY:' + icsEsc('Reserved - Tara Romblon (' + b.ref + ')'), 'END:VEVENT'].join('\r\n'); })); }, []);
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Tara Romblon//Calendar//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:' + icsEsc(s.name + ' - Tara Romblon')].concat(ev, ['END:VCALENDAR']).join('\r\n') + '\r\n';
  }
  function summary(b) {
    var s = b.lines.map(function (l) {
      return l.type === 'stay' ? l.label + ': ' + l.start + ' to ' + l.end + ' (' + l.nights + ' night/s, ' + l.guests + ' guest/s) P' + l.total
        : l.type === 'tour' ? l.label + ': ' + l.start.replace('T', ' ') + ' (' + l.pax + ' ' + (l.category === 'service' ? 'person/s' : 'guest/s') + ') P' + l.total
        : l.type === 'rental' ? l.label + ': ' + l.start.replace('T', ' ') + ' to ' + l.end.replace('T', ' ') + ' (' + l.days + 'd ' + l.extraHours + 'h, ' + l.helmets + ' helmet/s) ' + l.pickup + ' to ' + l.ret + ' P' + l.total
        : l.qty + ' x ' + l.name + (l.addons && l.addons.length ? ' (' + l.addons.join(', ') + ')' : '') + (l.note ? ' "' + l.note + '"' : '') + ' P' + l.total;
    }).join('\n');
    if (b.kind === 'food') s += '\n' + (b.fulfillment === 'delivery' ? 'Delivery to ' + (b.landmark || b.customer.address) + (b.lat != null ? ' https://maps.google.com/?q=' + b.lat + ',' + b.lng : '') + ' (fee P' + b.quote.deliveryFee + ')' : 'Pick-up');
    var R = Rules.reductions(b); if (R.total) s += '\nDiscounts: -P' + R.total + (b.code ? ' (code ' + b.code.code + ')' : '') + (b.points ? ' (' + b.points.points + ' points)' : '');
    return s + '\nTotal: P' + Rules.payable(b) + ' | ' + (Rules.PAY_LABEL[b.payMethod] || b.payMethod) + (b.notes ? '\nNote: ' + b.notes : '');
  }
  function audFor(b) { var a = ['cust:' + b.email, 'biz:' + b.bizId, 'super']; if (b.rider) a.push('rider:' + b.rider); return a; }
  async function setStatus(who, ref, status, note, amount) {
    var b = await getB(ref), actor = { role: who.role === 'system' ? 'super' : who.role, bizId: who.bizId, email: who.email };
    if (Rules.STATUSES.indexOf(status) < 0) err('Unknown status.');
    /* a paid delivery order goes to nearby riders first; the merchant gets it once a rider accepts */
    if (status === 'Payment Confirmed' && b.dispatch && !b.rider && b.status === 'Awaiting Payment') {
      if (!(who.role === 'system' || who.role === 'super' || ((who.role === 'manager' || who.role === 'staff') && who.bizId === b.bizId && b.payMethod !== 'online'))) err('You can\'t set that status.');
      b.payStatus = 'Paid'; b.status = 'Finding Rider'; b.history = (b.history || []).concat([{ at: now(), status: 'Payment Confirmed', by: who.name || who.email || 'System', role: who.role, note: 'Paid. Finding a rider.' }]);
      b.updated = now(); await env.db.put(T.book, b);
      await event('status', b.ref + ': payment confirmed. Finding a nearby rider.', ['cust:' + b.email, 'super'], b.ref, b.bizId, ['cust:' + b.email], 'Payment received for ' + b.ref, 'We received your payment for ' + b.ref + '. We are finding a nearby rider; the store starts preparing as soon as one accepts.', who.email);
      await startOffer(b, await catalog()); return b;
    }
    if (Rules.allowed(b, actor).indexOf(status) < 0) err(who.role === 'staff' ? 'Merchant Staff can only move an order to its next step. Ask your Merchant Admin to override.' : 'You can\'t set that status.');
    var prev = b.status, cat0 = await catalog();
    if (status === 'Payment Collected' && who.role !== 'system') {
      var exp = Rules.cashExpected(b);
      if (amount == null || amount === '' || !(+amount >= 0) || (b.payMethod === 'cod' && !(+amount > 0))) err('Enter the amount collected (expected P' + exp + '). This is required.');
      b.cashCollected = { amount: Rules.r2(+amount), expected: exp, by: who.name || who.email, role: who.role, at: now() };
      if (Rules.r2(+amount) !== exp) note = (note ? note + ' · ' : '') + 'Cash received P' + Rules.r2(+amount) + ' (expected P' + exp + ')';
    }
    b.status = status; b.payStatus = Rules.payStatusFor(b, status);
    if (status === 'Completed') await awardPoints(b, cat0);
    if (b.rider && (Rules.delivered(Object.assign({}, b, { status: status })) || Rules.CLOSED.indexOf(status) >= 0)) {
      var others = (await allBookings()).filter(function (x) { return x.ref !== b.ref && x.rider === b.rider && liveFor(x); });
      if (!others.length) { var rr = await env.db.get(T.staff, b.rider); if (rr && rr.loc && !rr.available) { delete rr.loc; await env.db.put(T.staff, rr); } }
    }
    if (Rules.FREE.indexOf(status) >= 0) await refundPoints(b, cat0);
    b.history = (b.history || []).concat([{ at: now(), status: status, by: who.name || who.email || 'System', role: who.role, note: note || '' }]);
    b.updated = now(); await env.db.put(T.book, b);
    var cat = await catalog(), bn = bizName(cat, b.bizId), txt = b.ref + ' (' + bn + '): ' + prev + ' to ' + status;
    if (prev === 'Finding Rider') { if (b.offer) b.offer.closed = now(), await env.db.put(T.book, b); await event('status', txt, ['cust:' + b.email, 'super'].concat(((b.offer && b.offer.riders) || []).map(function (e) { return 'rider:' + e; })), b.ref, b.bizId, ['cust:' + b.email], 'Update on ' + b.ref + ': ' + status, 'Your order ' + b.ref + ' is now: ' + status + (note ? '\nNote: ' + note : ''), who.email); return b; }
    var mailTo = ['cust:' + b.email]; if (who.role === 'super' || who.role === 'system' || who.role === 'rider') mailTo.push('biz:' + b.bizId);
    if (b.rider && ['Ready for Pick-up', 'Cancelled', 'Rejected'].indexOf(status) >= 0) mailTo.push('rider:' + b.rider);
    await event('status', txt, audFor(b), b.ref, b.bizId, mailTo, 'Update on ' + b.ref + ': ' + status, 'Your ' + (b.kind === 'food' ? 'order' : 'booking') + ' ' + b.ref + ' with ' + bn + ' is now: ' + status + (note ? '\nNote: ' + note : '') + '\n\n' + summary(b), who.email);
    return b;
  }
  async function createBooking(who, p) {
    var me = who.rec, cat = await catalog(true), st = settings(cat);
    if (!me.name || !me.phone || !me.address) err('Please complete your profile first.');
    var drafts = [];
    if (p.kind === 'food') {
      var F = Pricing.store(cat, p.bizId), pm = p.payMethod;
      if (!F) err('This restaurant is not available.');
      if (['delivery', 'pickup'].indexOf(p.fulfillment) < 0) err('Choose delivery or pick-up.');
      var ok = (pm === 'cod' && p.fulfillment === 'delivery' && F.codEnabled) || (pm === 'pickup' && p.fulfillment === 'pickup') || (pm === 'online' && F.onlineEnabled) || (pm === 'transfer' && st.transferEnabled);
      if (!ok) err('That payment option is not available.');
      if (p.fulfillment === 'delivery' && (p.lat == null || p.lng == null || !isFinite(+p.lat) || !isFinite(+p.lng))) err('Pin your delivery location on the map.');
      var q = Pricing.food(cat, { bizId: p.bizId, lines: p.lines, fulfillment: p.fulfillment, lat: p.lat, lng: p.lng }); if (q.error) err(q.error);
      if (pm === 'cod') { var cb = Rules.codBlock(st, Rules.completedCount(await allBookings(), who.email), q.total, me.created); if (cb) err(cb); }
      drafts.push({ kind: 'food', bizId: F.bizId || 'pahuway', lines: q.lines, quote: q, payMethod: pm, fulfillment: p.fulfillment, landmark: String(p.landmark || '').slice(0, 200), lat: p.lat, lng: p.lng, dueNow: Rules.NONCASH.indexOf(pm) >= 0 ? q.total : 0 });
    } else {
      if (!p.agree) err('Please agree to the cancellation & refund policy.');
      if (st.requireIdVerification && (!me.verify || me.verify.status !== 'verified')) err(me.verify && me.verify.status === 'pending' ? 'ID_PENDING: Your ID is being reviewed. You can book stays and rentals once it is approved.' : 'ID_REQUIRED: Please upload a valid ID before booking stays and rentals.');
      if (['online', 'transfer'].indexOf(p.payMethod) < 0 || (p.payMethod === 'transfer' && !st.transferEnabled)) err('Choose a payment option.');
      if (!st.staysLive && p.lines.some(function (l) { return l.type === 'stay'; })) err('Stays are coming soon. For now you can rent a scooter or order food.');
      if (!st.toursLive && p.lines.some(function (l) { return l.type === 'tour'; })) err('Things to do are coming soon. For now you can rent a scooter or order food.');
      var all = Pricing.booking(cat, p.lines); if (all.error) err(all.error);
      var hasRental = all.lines.some(function (l) { return l.type === 'rental'; });
      if (hasRental && cat.business.rentalTerms && !(p.rentalTerms && p.rentalTerms.at)) err('Please read and accept the Rental Terms and Conditions first.');
      var bz = await busy();
      all.lines.forEach(function (l) {
        bz.forEach(function (x) { if (x.type === l.type && x.itemId === l.itemId && l.start < x.end && l.end > x.start) err(l.label + ' is already booked for those dates. Please choose other dates.'); });
        if (l.type === 'stay' && l.start < env.today()) err('Check-in date has passed.');
        if (l.type === 'tour' && l.start.slice(0, 10) < env.today()) err('That date has passed.');
      });
      var groups = {};
      p.lines.forEach(function (l, i) { var id = all.lines[i].bizId; (groups[id] = groups[id] || []).push(l); });
      Object.keys(groups).forEach(function (id) {
        var q2 = Pricing.booking(cat, groups[id]);
        var has = function (t) { return q2.lines.some(function (l) { return l.type === t; }); };
        var dr = { kind: has('stay') ? 'stay' : has('rental') ? 'rental' : 'tour', bizId: id, lines: q2.lines, quote: q2, payMethod: p.payMethod, dueNow: q2.dueNow };
        if (has('rental') && cat.business.rentalTerms) dr.rentalTerms = { acceptedAt: now(), clientAt: str(p.rentalTerms.at, 40), text: cat.business.rentalTerms };
        drafts.push(dr);
      });
    }
    /* discount code and reward points */
    var pct = +cat.business.downpaymentPct || 50;
    if (p.code) {
      var dc = await findCode(p.code, me.email), amts = {};
      drafts.forEach(function (d) { amts[d.bizId] = (amts[d.bizId] || 0) + Rules.gross(d); });
      var split = codeSplit(dc, cat, amts);
      drafts.forEach(function (d) { if (split[d.bizId]) d.code = { code: dc.code, name: dc.name, amount: split[d.bizId], fundedBy: dc.fundedBy === 'tara' ? 'tara' : 'merchant' }; });
    }
    var redeem = p.redeem || {};
    for (var di = 0; di < drafts.length; di++) {
      var d = drafts[di], want = Math.floor(+redeem[d.bizId] || 0); if (!want) continue;
      var prog = Rules.rewardsOf(biz(cat, d.bizId)); if (!prog.enabled) err(bizName(cat, d.bizId) + ' does not offer reward points.');
      if (!Rules.mobile(me.phone)) err('Add your mobile number to your profile to use reward points.');
      var bal = (await pointsBalance(cat, member(me), d.bizId)).balance, room = Rules.gross(d) - (d.code ? d.code.amount : 0);
      if (Rules.redeemOptions(prog, bal, room).indexOf(want) < 0) err('You can redeem ' + prog.minRedeem + ' points or more in steps of ' + prog.redeemStep + ', up to your balance of ' + bal + '.');
      d.points = { points: want, amount: Rules.r2(want * prog.pointValue) };
    }
    drafts.forEach(function (d) { if (d.code || d.points) d.dueNow = d.kind === 'food' ? (Rules.NONCASH.indexOf(d.payMethod) >= 0 ? Rules.payable(d) : 0) : Math.round(Rules.payable(d) * pct / 100); });
    var idVerified = !!(me.verify && me.verify.status === 'verified' && me.verify.file);
    var needId = drafts[0].kind !== 'food' && st.idUploadAtCheckout !== 'off' && !idVerified, needProof = drafts[0].payMethod === 'transfer' && st.proofUpload !== 'off';
    if (needId && st.idUploadAtCheckout === 'required' && !p.idPhoto) err('Please upload a photo of your ID.');
    if (needProof && st.proofUpload === 'required' && !p.proofPhoto) err('Please upload your payment proof.');
    var idFile = needId && p.idPhoto ? (await env.files.save(p.idPhoto, 'id-' + me.email, true)).id : (idVerified && drafts[0].kind !== 'food' ? me.verify.file : '');
    var proofFile = needProof && p.proofPhoto ? (await env.files.save(p.proofPhoto, 'proof-' + me.email, true)).id : '';
    var group = newRef('G'), created = now(), out = [];
    drafts.forEach(function (d) {
      var b = Object.assign(d, { id: '', ref: newRef('TR'), group: group, created: created, updated: created, email: me.email, customer: { name: me.name, phone: me.phone, address: me.address }, notes: String(p.notes || '').slice(0, 500),
        status: Rules.CASH.indexOf(d.payMethod) >= 0 ? 'New' : 'Awaiting Payment', payStatus: Rules.CASH.indexOf(d.payMethod) >= 0 ? 'Unpaid' : 'Pending',
        fee: Rules.feeFor(biz(cat, d.bizId), Rules.gross(d)), discount: 0, idFile: idFile, proofFile: proofFile, rider: '', riderAccepted: false, history: [] });
      if (b.kind === 'food' && b.fulfillment === 'delivery' && st.riderDispatch !== false) { b.dispatch = true; if (b.status === 'New') b.status = 'Finding Rider'; }
      if (b.kind === 'food' && b.fulfillment === 'delivery' && st.codCashTo === 'merchant') b.platformPaysRider = true;   /* riders hand all COD cash to the store; the platform pays their earnings */
      if (b.kind === 'food' && b.fulfillment === 'delivery' && b.payMethod === 'cod' && st.codCashTo === 'tara') b.codToRider = true;
      if (b.kind === 'food' && b.fulfillment === 'delivery' && b.payMethod === 'cod' && (st.codCashTo || 'rider') === 'rider') { b.riderPaysStore = true; b.payAtPickup = true; }   /* the rider pays the store for the food at pick-up, collects everything from the customer and keeps the customer's delivery fee */   /* the rider keeps the COD cash; it is settled against their earnings and the platform pays the store */
      b.id = b.ref; b.history.push({ at: created, status: b.status, by: me.name, role: 'customer' }); out.push(b);
    });
    var due = out.reduce(function (t, b) { return t + (+b.dueNow || 0); }, 0);
    if (out[0].payMethod === 'online' && due > 0) {
      var hp = await env.hitpay.create({ amount: due, ref: group, email: me.email, name: me.name, phone: me.phone, purpose: (out[0].kind === 'food' ? 'Food order ' : 'Downpayment ') + group + ' - ' + out.map(function (b) { return bizName(cat, b.bizId); }).join(', ') });
      if (hp) out.forEach(function (b) { b.hitpayId = hp.id; b.payUrl = hp.url; });
    }
    for (var i = 0; i < out.length; i++) {
      var b = out[i], bn = bizName(cat, b.bizId), what = b.kind === 'food' ? 'order' : 'booking';
      if (b.points) await addPoints(cat, member(me), b.bizId, -b.points.points, 'redeem', b.ref, 'Redeemed on ' + b.ref);
      await env.db.put(T.book, b);
      if (b.dispatch) { await event('new', 'New delivery order ' + b.ref + ' for ' + bn + ' from ' + me.name + ' - P' + b.quote.total + ' (' + (b.status === 'Finding Rider' ? 'finding a rider' : b.status) + ')', ['super', 'cust:' + b.email], b.ref, b.bizId, [], '', '', me.email); if (b.status === 'Finding Rider') await startOffer(b, cat); continue; }
      await event('new', 'New ' + what + ' ' + b.ref + ' for ' + bn + ' from ' + me.name + ' - P' + b.quote.total + ' (' + b.status + ')', ['biz:' + b.bizId, 'super', 'cust:' + b.email], b.ref, b.bizId,
        ['biz:' + b.bizId, 'super'], 'New ' + what + ' ' + b.ref + ' - ' + bn, me.name + ' | ' + me.phone + ' | ' + me.email + '\n' + me.address + '\n\n' + summary(b) + (b.code ? '\nDiscount code ' + b.code.code + ': -P' + b.code.amount : '') + (b.points ? '\nPoints redeemed: ' + b.points.points + ' (-P' + b.points.amount + ')' : ''), '');
    }
    try { await env.mail(me.email, 'We received your ' + (out[0].kind === 'food' ? 'order' : 'booking') + ' ' + group, 'Hi ' + me.name + ',\n\n' + out.map(function (b) { return b.ref + ' - ' + bizName(cat, b.bizId) + '\n' + summary(b); }).join('\n\n') +
      (due ? '\n\nAmount due now: P' + due + (out[0].payUrl ? '\nPay here: ' + out[0].payUrl : out[0].payMethod === 'transfer' ? '\n' + st.transferInstructions : '') : '') + (out[0].kind !== 'food' ? '\n\nCancellation & refund policy:\n' + (cat.business.refundPolicy || '') : '')); } catch (x) { }
    return { group: group, refs: out.map(function (b) { return b.ref; }), dueNow: due, payUrl: out[0].payUrl || null, payMethod: out[0].payMethod, bookings: out.map(function (b) { return strip(b); }) };
  }
  async function confirmGroup(group) {
    var bs = (await allBookings()).filter(function (b) { return b.group === group && b.status === 'Awaiting Payment'; });
    for (var i = 0; i < bs.length; i++) await setStatus({ role: 'system', name: 'HitPay', email: '' }, bs[i].ref, 'Payment Confirmed');
    return bs.length;
  }
  async function checkHitpay(group) {
    var bs = (await allBookings()).filter(function (b) { return b.group === group && b.status === 'Awaiting Payment' && b.hitpayId; });
    if (bs.length && (await env.hitpay.status(bs[0].hitpayId)) === 'completed') { await confirmGroup(group); return true; }
    return false;
  }

  /* ---------- discount codes (created by Super Admins; merchants can switch acceptance off) ---------- */
  async function discounts() { return (await env.db.kvGet('discounts')) || []; }
  async function findCode(code, email) {
    var c = String(code || '').trim().toUpperCase(); if (!c) return null;
    var d = (await discounts()).filter(function (x) { return String(x.code).toUpperCase() === c; })[0], td = env.today();
    if (!d || !d.active) err('That discount code is not valid.');
    if (d.validFrom && td < d.validFrom) err('That discount code is not active yet.');
    if (d.validTo && td > d.validTo) err('That discount code has expired.');
    var used = (await allBookings()).filter(function (b) { return b.code && String(b.code.code).toUpperCase() === c && Rules.FREE.indexOf(b.status) < 0; });
    var groups = {}; used.forEach(function (b) { groups[b.group] = b.email; });
    if (d.maxUses > 0 && Object.keys(groups).length >= d.maxUses) err('That discount code has been fully used.');
    if (d.onePerCustomer && email && Object.keys(groups).some(function (g) { return groups[g] === email; })) err('You have already used this discount code.');
    return d;
  }
  function codeEligible(d, cat, bizId) { var b = biz(cat, bizId); return (!d.bizIds || !d.bizIds.length || d.bizIds.indexOf(bizId) >= 0) && !!b && b.acceptCodes !== false; }
  /* splits a code's discount across eligible businesses in proportion to their amounts */
  function codeSplit(d, cat, amounts) {
    var ids = Object.keys(amounts).filter(function (id) { return codeEligible(d, cat, id) && amounts[id] > 0; });
    if (!ids.length) err('This discount code does not apply to ' + Object.keys(amounts).map(function (id) { return bizName(cat, id); }).join(', ') + '.');
    var E = ids.reduce(function (t, id) { return t + amounts[id]; }, 0);
    if (d.minOrder > 0 && E < d.minOrder) err('This code needs a minimum order of P' + d.minOrder + '.');
    var total = Rules.codeAmount(d, E), out = {}, left = total;
    ids.forEach(function (id, i) { var a = i === ids.length - 1 ? left : Rules.r2(total * amounts[id] / E); out[id] = a; left = Rules.r2(left - a); });
    return out;
  }
  function pubCode(d) { return { code: d.code, name: d.name, desc: d.desc, type: d.type, value: d.value, bizIds: d.bizIds || [], minOrder: d.minOrder || 0, maxDiscount: d.maxDiscount || 0 }; }

  /* ---------- reward points (ledger in "points"; Loyverse-linked businesses keep the balance in Loyverse) ---------- */
  async function secrets() { return (await env.db.kvGet('secrets')) || {}; }
  async function lvToken(cat, bizId) { var b = biz(cat, bizId); if (!b || !Rules.rewardsOf(b).loyverse || !env.loyverse) return ''; return (await secrets())['loyverse:' + bizId] || (bizId === 'pahuway' && env.loyverseToken) || ''; }
  /* a rewards member is identified by their registered mobile number (email only for older entries without one) */
  function member(c) { return { email: c.email, phone: Rules.mobile(c.phone), name: c.name || '' }; }
  function isMine(x, m) { return m.phone ? (x.phone ? x.phone === m.phone : x.email === m.email) : x.email === m.email; }
  async function pointsRows(m, bizId) { return (await env.db.all(T.pts)).filter(function (x) { return (!m || isMine(x, m)) && (!bizId || x.bizId === bizId); }); }
  async function pointsBalance(cat, m, bizId) {
    var tok = await lvToken(cat, bizId);
    if (tok) { try { var c = await env.loyverse.find(tok, m.email, m.phone); if (c) return { balance: +c.total_points || 0, source: 'loyverse' }; } catch (x) { } }
    return { balance: (await pointsRows(m, bizId)).reduce(function (t, x) { return t + x.points; }, 0), source: 'app' };
  }
  async function addPoints(cat, m, bizId, points, type, ref, note) {
    if (!points) return;
    var e = { id: env.uuid(), at: now(), email: m.email, phone: m.phone, name: m.name, bizId: bizId, points: points, type: type, ref: ref || '', note: note || '' };
    var tok = await lvToken(cat, bizId);
    if (tok) {
      try {
        var c = await env.loyverse.find(tok, m.email, m.phone);
        if (!c) c = { name: m.name || m.email, email: m.email, phone_number: m.phone || null, total_points: 0 };
        c.total_points = Math.max(0, (+c.total_points || 0) + points); await env.loyverse.save(tok, c); e.loyverse = 'synced';
      } catch (x) { e.loyverse = 'failed: ' + String(x.message || x).slice(0, 80); }
    }
    await env.db.put(T.pts, e);
    return e;
  }
  async function awardPoints(b, cat) {
    var bz = biz(cat, b.bizId), prog = Rules.rewardsOf(bz); if (!prog.enabled || b.pointsAwarded != null) return;
    var m = member({ email: b.email, phone: b.customer.phone, name: b.customer.name }), rows = await pointsRows(m, b.bizId), earned = Rules.pointsFor(prog, Rules.payable(b) - (b.kind === 'food' ? +b.quote.deliveryFee || 0 : 0));
    if (!rows.some(function (x) { return x.type === 'signup'; }) && prog.signupBonus > 0) await addPoints(cat, m, b.bizId, +prog.signupBonus, 'signup', b.ref, 'Welcome bonus');
    if (earned > 0) await addPoints(cat, m, b.bizId, earned, 'earn', b.ref, 'Earned on ' + b.ref);
    b.pointsAwarded = earned;
    if (earned > 0 || prog.signupBonus > 0) await event('points', 'You earned ' + earned + ' points with ' + bizName(cat, b.bizId), ['cust:' + b.email], b.ref, b.bizId, []);
  }
  async function refundPoints(b, cat) {
    if (b.points && b.points.points && !b.pointsRefunded) { await addPoints(cat, member({ email: b.email, phone: b.customer.phone, name: b.customer.name }), b.bizId, +b.points.points, 'refund', b.ref, 'Returned: ' + b.ref + ' ' + b.status); b.pointsRefunded = true; }
  }
  async function birthdayBonus(c, cat) {
    if (!c || !c.birthday) return;
    var md = String(c.birthday).slice(-5), td = env.today(); if (td.slice(5) !== md) return;
    var cm = member(c), all = await pointsRows(cm);
    for (var i = 0; i < (cat.businesses || []).length; i++) {
      var z = cat.businesses[i], prog = Rules.rewardsOf(z); if (!prog.enabled || !(prog.birthdayBonus > 0)) continue;
      var mine = all.filter(function (x) { return x.bizId === z.id; });
      if (!mine.length || mine.some(function (x) { return x.type === 'birthday' && x.at.slice(0, 4) === td.slice(0, 4); })) continue;
      await addPoints(cat, cm, z.id, +prog.birthdayBonus, 'birthday', '', 'Happy birthday!');
      await event('points', 'Happy birthday! ' + prog.birthdayBonus + ' bonus points from ' + z.name, ['cust:' + c.email], '', z.id, []);
    }
  }

  /* ---------- threads (in-app messaging) ---------- */
  async function canSee(who, t) {
    if (who.role === 'super') return true;
    if (who.kind === 'customer') return t.email === who.email && (t.type !== 'rider' || t.with === 'customer');
    if (who.role === 'manager' || who.role === 'staff') return t.bizId === who.bizId && (t.type !== 'rider' || t.with === 'merchant');
    if (who.role === 'rider') { if (t.type !== 'rider') return false; var b = await env.db.get(T.book, t.ref); return !!b && b.rider === who.email; }
    return false;
  }
  async function threadFor(who, p) {
    if (p.threadId) { var t = await env.db.get(T.thr, p.threadId); if (t) { if (!(await canSee(who, t))) err('Conversation not found.'); return t; } if (!p.ref && !p.inquiryBizId) err('Conversation not found.'); }
    if (p.ref && (p.chan || who.role === 'rider')) {
      /* separate rider chats: rider and customer, rider and merchant */
      var rb = await getB(p.ref), withWho = who.role === 'rider' ? p.chan : who.kind === 'customer' ? 'customer' : who.role === 'super' ? p.chan : 'merchant';
      if (['customer', 'merchant'].indexOf(withWho) < 0) err('Choose who to message: the customer or the merchant.');
      if (!rb.rider) err('No rider is assigned to this order yet.');
      var rid = 'R-' + rb.ref + '-' + (withWho === 'customer' ? 'cust' : 'biz'), rt = await env.db.get(T.thr, rid);
      if (!rt) rt = { id: rid, type: 'rider', with: withWho, ref: rb.ref, bizId: rb.bizId, email: rb.email, name: rb.customer.name, rider: rb.rider, created: now(), updated: now(), last: null };
      if (!(await canSee(who, rt))) err('You can\'t message about this order.');
      return rt;
    }
    if (p.ref) {
      var b = await getB(p.ref), t2 = await env.db.get(T.thr, 'T-' + b.ref);
      if (!t2) t2 = { id: 'T-' + b.ref, type: 'order', ref: b.ref, bizId: b.bizId, email: b.email, name: b.customer.name, created: now(), updated: now(), last: null };
      if (!(await canSee(who, t2))) err('You can\'t message about this booking.');
      return t2;
    }
    if (p.inquiryBizId) {
      if (who.kind !== 'customer') err('Only customers can start an inquiry.');
      if (!Rules.canInquire(who.email, p.inquiryBizId, p.cartBizIds)) err('You can message a business once something from it is in your cart.');
      var id = 'I-' + who.email + '-' + p.inquiryBizId, t3 = await env.db.get(T.thr, id);
      return t3 || { id: id, type: 'inquiry', ref: '', bizId: p.inquiryBizId, email: who.email, name: who.name || who.email, created: now(), updated: now(), last: null };
    }
    err('Conversation not found.');
  }
  async function threadsFor(who) {
    var all = await env.db.all(T.thr), out = [];
    for (var i = 0; i < all.length; i++) if (await canSee(who, all[i])) out.push(all[i]);
    return out.sort(function (a, b) { return String(b.updated).localeCompare(String(a.updated)); });
  }
  async function sendMsg(who, p) {
    var t = await threadFor(who, p), text = String(p.text || '').trim().slice(0, 1500);
    if (text.length < 1) err('Type a message.');
    var key = 'msgn_' + who.email, n = +((await env.cache.get(key)) || 0); if (n >= 40) err('Too many messages. Please wait a moment.'); await env.cache.put(key, String(n + 1), 600);
    var m = { id: env.uuid(), threadId: t.id, at: now(), role: who.role, name: who.name || who.email, email: who.email, text: text };
    await env.db.put(T.msg, m);
    t.updated = m.at; t.last = { text: text.slice(0, 140), name: m.name, role: m.role, at: m.at }; await env.db.put(T.thr, t);
    var cat = await catalog(), bn = bizName(cat, t.bizId), aud = ['cust:' + t.email, 'biz:' + t.bizId, 'super'];
    if (t.type === 'rider') { var b = await env.db.get(T.book, t.ref); aud = [t.with === 'customer' ? 'cust:' + t.email : 'biz:' + t.bizId, 'super'].concat(b && b.rider ? ['rider:' + b.rider] : []); }
    var mine = myAud(who)[0], mailTo = aud.filter(function (a) { return a !== mine && a !== 'super'; });
    var throttle = 'mailthr_' + t.id + '_' + mine; if (await env.cache.get(throttle)) mailTo = []; else await env.cache.put(throttle, '1', 600);
    await event('message', (who.name || who.email) + ' (' + (Rules.ROLE_LABEL[who.role] || 'Customer') + ') - ' + (t.ref || 'Inquiry') + ' / ' + bn + ': ' + text.slice(0, 120), aud.filter(function (a) { return a !== mine; }), t.ref, t.bizId,
      mailTo, 'New message about ' + (t.ref || 'your inquiry') + ' - ' + bn, (who.name || who.email) + ' wrote:\n\n' + text + '\n\nReply in the app.', who.email);
    return { thread: t, message: m };
  }

  /* ---------- actions ---------- */
  var A = {};
  /* public */
  A.getCatalog = async function () { return { catalog: Pricing.norm(await env.db.kvGet('catalog')), maps: env.maps || null, google: env.googleClientId || null }; };
  A.availability = async function () { return { busy: await busy() }; };
  /* Super Admin: calendar links per stay (import from Airbnb etc., export to them) */
  A.adminIcal = async function (p) {
    await auth(p.token, 'super'); var cat = await catalog(), d = p.sync ? await icalData(p.sync === true ? true : String(p.sync)) : ((await env.db.kvGet('ical')) || {});
    return { live: !!env.fetchText, stays: cat.stays.map(function (s) { var x = d[s.id] || {}; return { id: s.id, name: s.name, urls: x.urls || [], synced: x.synced || '', error: x.error || '', nights: (x.events || []).reduce(function (t, e) { return t + Math.max(1, Math.round((Date.parse(e.end) - Date.parse(e.start)) / 864e5)); }, 0), blocks: (x.events || []).slice(0, 30), exportPath: env.sign ? '/api/ical?stay=' + encodeURIComponent(s.id) + '&key=' + env.sign('ical:' + s.id) : '' }; }) };
  };
  A.adminSaveIcal = async function (p) {
    await auth(p.token, 'super'); var cat = await catalog(); if (!cat.stays.some(function (s) { return s.id === p.stayId; })) err('Stay not found.');
    var urls = (p.urls || []).map(function (u) { return String(u || '').trim(); }).filter(Boolean).slice(0, 5);
    urls.forEach(function (u) { if (!/^(https?|webcal):\/\/[^\s]+$/i.test(u)) err('Paste the full calendar link (it starts with https://).'); });
    urls = urls.map(function (u) { return u.replace(/^webcal:/i, 'https:'); });
    var d = (await env.db.kvGet('ical')) || {}; d[p.stayId] = Object.assign(d[p.stayId] || {}, { urls: urls, synced: '' }); if (!urls.length) d[p.stayId].events = [];
    await env.db.kvPut('ical', d); await icalData(p.stayId);
    return await A.adminIcal({ token: p.token });
  };
  A.submitApplication = async function (p) {
    var f = p.application || {}, rider = f.appType === 'rider';
    var need = rider ? ['name', 'phone', 'email', 'address', 'town', 'vehicle', 'plate', 'licenseNo'] : ['businessName', 'type', 'town', 'contactName', 'phone', 'email', 'description', 'registration', 'permits'];
    need.forEach(function (k) { if (!String(f[k] || '').trim()) err(k === 'registration' ? 'DTI / SEC / CDA registration number is required.' : k === 'permits' ? "Mayor's / Business permit number is required." : 'Please fill in all required fields.'); });
    var bank = cleanBank(f.bank); if (!bank.accountName || !bank.bank || !bank.accountNo) err('Please add the bank or e-wallet account for payouts (name, bank and account number).');
    if (rider && !f.licensePhoto) err("Please upload a photo of the driver's license.");
    if (rider) { var pwr = await makePw(f.password); var exr = await env.db.get(T.staff, low(f.email)); if (exr && exr.role === 'rider') err('You already have a rider account. Sign in to the Rider app instead.'); }
    if (!validEmail(f.email)) err('Enter a valid email address.');
    var n = +((await env.cache.get('appn_' + low(f.email))) || 0); if (n >= 3) err('Too many submissions. Please try again later.'); await env.cache.put('appn_' + low(f.email), String(n + 1), 3600);
    var a = { id: env.uuid(), appType: rider ? 'rider' : 'business', created: now(), status: 'New', adminNotes: '', bank: bank };
    var keys = rider ? ['name', 'phone', 'email', 'address', 'town', 'vehicle', 'plate', 'licenseNo', 'licenseExpiry', 'experience', 'availability', 'heardFrom']
      : ['businessName', 'type', 'town', 'address', 'contactName', 'position', 'phone', 'email', 'website', 'registration', 'permits', 'capacity', 'priceRange', 'description', 'startDate', 'heardFrom'];
    keys.forEach(function (k) { a[k] = str(f[k], k === 'description' || k === 'experience' ? 1500 : 200); });
    a.email = low(a.email); a.photos = [];
    if (rider) {
      a.pw = pwr;
      a.licenseFile = (await env.files.save(f.licensePhoto, 'license-' + a.email, true)).id;
      await env.db.put(T.app, a);
      await event('application', 'New rider application: ' + a.name + ' (' + a.town + ')', ['super'], '', '', ['super'], 'New rider application: ' + a.name, a.name + ' - ' + a.vehicle + ' ' + a.plate + ' - ' + a.town + '\n' + a.phone + ' ' + a.email + "\nDriver's license " + a.licenseNo + '\n\nReview it in the Super Admin app > Rider applications.');
      try { await env.mail(a.email, 'We received your rider application', 'Hi ' + a.name + ',\n\nThanks for applying to deliver with us. We will review your details and driver\'s license and contact you within 3 working days.\n\nBeyond Tech Solutions'); } catch (x) { }
      return {};
    }
    a.platformFee = { type: 'percent', value: 10 };
    var ph = (f.photos || []).slice(0, 3);
    for (var i = 0; i < ph.length; i++) { try { a.photos.push((await env.files.save(ph[i], 'app-' + a.businessName, false)).url); } catch (x) { } }
    await env.db.put(T.app, a);
    await event('application', 'New business application: ' + a.businessName + ' (' + a.town + ')', ['super'], '', '', ['super'], 'New business application: ' + a.businessName, a.businessName + ' - ' + a.type + ' - ' + a.town + '\n' + a.contactName + ' ' + a.phone + ' ' + a.email + '\n\n' + a.description);
    try { await env.mail(a.email, 'We received your application - ' + a.businessName, 'Hi ' + a.contactName + ',\n\nThanks for applying to list ' + a.businessName + '. Our team will contact you within 3 working days.\n\nBeyond Tech Solutions'); } catch (x) { }
    return {};
  };
  /* customer sign-in & profile */
  A.sendOtp = async function (p) { var e = low(p.email); if (!validEmail(e)) err('Enter a valid email address.'); return await code('cust:' + e, e, await catalog()); };
  /* "Continue with Google": the server checks the token with Google, then signs in (or creates) the customer with that email */
  A.googleSignIn = async function (p) {
    if (!env.verifyGoogle || !env.googleClientId) err('Google sign-in is not set up yet. Use your email instead.');
    var g = await env.verifyGoogle(String(p.credential || '')), e = low(g.email);
    if (!validEmail(e)) err('Google sign-in failed. Please try again.');
    var c = await env.db.get(T.cust, e), created = !c;
    if (!c) c = { id: e, email: e, name: g.name || '', phone: '', address: '', created: now(), verify: { status: 'unverified' }, signup: 'google' };
    else if (!c.name && g.name) c.name = g.name;
    var t = addToken(c); await env.db.put(T.cust, c); await remember(T.cust, c, t); return { token: t, profile: pubCust(c), created: created };
  };
  A.verifyOtp = async function (p) {
    var e = low(p.email); await check('cust:' + e, p.code);
    var c = (await env.db.get(T.cust, e)) || { id: e, email: e, name: '', phone: '', address: '', created: now(), verify: { status: 'unverified' } };
    var t = addToken(c); await env.db.put(T.cust, c); await remember(T.cust, c, t); return { token: t, profile: pubCust(c) };
  };
  /* Customers: create an account with email + password, log in, reset a forgotten password */
  A.signUp = async function (p) {
    var e = low(p.email); if (!validEmail(e)) err('Enter a valid email address.');
    var n = +((await env.cache.get('sgn_' + e)) || 0); if (n >= 5) err('Too many attempts. Please try again later.'); await env.cache.put('sgn_' + e, String(n + 1), 3600);
    var c = await env.db.get(T.cust, e);
    if (c && c.pw) err('An account with this email already exists. Log in instead.');
    if (c) err('NO_PASSWORD: This email already has an account without a password. Tap "Forgot password?" to set one.');
    c = { id: e, email: e, name: str(p.name, 120), phone: '', address: '', created: now(), verify: { status: 'unverified' }, signup: 'password', pw: await makePw(p.password) };
    var t = addToken(c); await env.db.put(T.cust, c); await remember(T.cust, c, t); return { token: t, profile: pubCust(c), created: true };
  };
  A.login = async function (p) {
    var e = low(p.email); if (!validEmail(e)) err('Enter a valid email address.');
    var n = await pwGate('cust:' + e), c = await env.db.get(T.cust, e);
    if (!c) { await env.cache.put('lgn_cust:' + e, String(n + 1), 900); err('No account found for this email. Tap "Create account".'); }
    if (!c.pw) err('NO_PASSWORD: This account has no password yet' + (c.signup === 'google' ? ' (you signed up with Google; you can keep using Continue with Google)' : '') + '. Tap "Forgot password?" to set one.');
    if (!(await pwMatches(c, p.password))) await pwFail('cust:' + e, n);
    await env.cache.remove('lgn_cust:' + e);
    var t = addToken(c); await env.db.put(T.cust, c); await remember(T.cust, c, t); return { token: t, profile: pubCust(c) };
  };
  /* Forgot password (customers and riders): a one-time code by email, then a new password */
  A.pwResetSend = async function (p) {
    var e = low(p.email), kind = p.kind === 'rider' ? 'rider' : 'cust'; if (!validEmail(e)) err('Enter a valid email address.');
    var rec = kind === 'rider' ? await env.db.get(T.staff, e) : await env.db.get(T.cust, e);
    if (!rec || (kind === 'rider' && rec.role !== 'rider')) err(kind === 'rider' ? 'This email is not registered as a rider. Apply to become a rider first.' : 'No account found for this email. Tap "Create account".');
    return await code('reset:' + kind + ':' + e, e, await catalog(), 'reset');
  };
  A.pwReset = async function (p) {
    var e = low(p.email), kind = p.kind === 'rider' ? 'rider' : 'cust', tb = kind === 'rider' ? T.staff : T.cust;
    var pw = await makePw(p.password); await check('reset:' + kind + ':' + e, p.code);
    var rec = await env.db.get(tb, e); if (!rec || (kind === 'rider' && rec.role !== 'rider')) err('Account not found.');
    rec.pw = pw; rec.tokens = []; rec.sessEpoch = (rec.sessEpoch || 0) + 1; var t = addToken(rec); await env.db.put(tb, rec); await remember(tb, rec, t); await env.cache.remove('lgn_' + kind + ':' + e);
    return kind === 'rider' ? { token: t, me: pubStaff(rec) } : { token: t, profile: pubCust(rec) };
  };
  A.changePassword = async function (p) {
    var who = await auth(p.token); if (who.kind !== 'customer' && who.role !== 'rider') err('Not allowed.');
    var rec = who.rec; if (rec.pw && !(await pwMatches(rec, p.current))) err('Your current password is incorrect.');
    rec.pw = await makePw(p.password); rec.tokens = [p.token]; rec.sessEpoch = (rec.sessEpoch || 0) + 1; await env.db.put(who.kind === 'customer' ? T.cust : T.staff, rec); await remember(who.kind === 'customer' ? T.cust : T.staff, rec, p.token); return {};
  };
  /* Riders: sign in with email + password */
  A.riderLogin = async function (p) {
    var e = low(p.email); if (!validEmail(e)) err('Enter a valid email address.');
    var n = await pwGate('rider:' + e), s = await env.db.get(T.staff, e);
    if (!s || s.role !== 'rider') { await env.cache.put('lgn_rider:' + e, String(n + 1), 900); err('This email is not registered as a rider. Tap "Create rider account" to apply.'); }
    if (s.active === false) err('Your rider account is not active. Contact Beyond Tech Solutions.');
    if (!s.pw) err('NO_PASSWORD: Your rider account has no password yet. Tap "Forgot password?" to set one.');
    if (!(await pwMatches(s, p.password))) await pwFail('rider:' + e, n);
    await env.cache.remove('lgn_rider:' + e);
    var t = null; s = await patch(T.staff, s.id || e, function (r) { t = addToken(r); }); await remember(T.staff, s, t); return { token: t, me: pubStaff(s) };
  };
  /* Phone notifications: public key, subscribe and unsubscribe this device */
  A.pushKey = async function () { return { key: env.pushKey ? await env.pushKey() : '' }; };
  A.pushSubscribe = async function (p) {
    var who = await auth(p.token), s = p.sub || {}; if (!s.endpoint || !/^https:\/\//.test(s.endpoint) || !s.keys || !s.keys.p256dh || !s.keys.auth) err('Notifications are not supported on this device.');
    var sub = { endpoint: String(s.endpoint).slice(0, 800), keys: { p256dh: String(s.keys.p256dh).slice(0, 200), auth: String(s.keys.auth).slice(0, 100) }, at: now() };
    await patch(who.kind === 'customer' ? T.cust : T.staff, who.rec.id || who.email, function (r) { r.push = [sub].concat((r.push || []).filter(function (x) { return x.endpoint !== sub.endpoint; })).slice(0, 6); }); return { ok: true };
  };
  A.pushUnsubscribe = async function (p) { var who = await auth(p.token); await patch(who.kind === 'customer' ? T.cust : T.staff, who.rec.id || who.email, function (r) { r.push = (r.push || []).filter(function (x) { return x.endpoint !== p.endpoint; }); }); return {}; };
  A.me = async function (p) { var who = await auth(p.token, 'customer'); if (!(await env.cache.get('sess:' + p.token))) await remember(T.cust, who.rec, p.token); return { profile: pubCust(who.rec) }; };
  A.saveProfile = async function (p) {
    var who = await auth(p.token, 'customer'), c = who.rec, pr = p.profile || {};
    if (!pr.name || !pr.phone || !pr.address) err('Name, contact number and address are required.');
    var mob = Rules.mobile(pr.phone); if (!mob) err('Enter a valid PH mobile number (e.g. 0917 123 4567).');
    if ((await env.db.all(T.cust)).some(function (x) { return x.email !== c.email && Rules.mobile(x.phone) === mob; })) err('This mobile number is already registered to another account. Sign in with that account, or use a different number.');
    c.name = String(pr.name).slice(0, 120); c.phone = mob; c.address = String(pr.address).slice(0, 300); c.updated = now();
    if (pr.birthday != null) { if (pr.birthday && !/^\d{4}-\d{2}-\d{2}$/.test(pr.birthday)) err('Enter a valid birthday.'); c.birthday = pr.birthday || ''; }
    await env.db.put(T.cust, c); return { profile: pubCust(c) };
  };
  A.submitId = async function (p) {
    var who = await auth(p.token, 'customer'), c = who.rec;
    if (!p.dataUrl) err('Choose a photo of your ID.');
    var f = await env.files.save(p.dataUrl, 'verify-' + c.email, true);
    c.verify = { status: 'pending', idType: String(p.idType || 'Valid ID').slice(0, 60), file: f.id, submitted: now() }; await env.db.put(T.cust, c);
    await event('verification', (c.name || c.email) + ' submitted an ID for verification', ['super', 'cust:' + c.email], '', '', ['super'], 'ID verification request - ' + (c.name || c.email), (c.name || '') + ' (' + c.email + ', ' + (c.phone || '') + ') uploaded a ' + c.verify.idType + '. Review it in the Super Admin app > Customers.');
    return { profile: pubCust(c) };
  };
  A.createBooking = async function (p) { return await createBooking(await auth(p.token, 'customer'), p); };
  A.verifyPayment = async function (p) {
    var bs = (await allBookings()).filter(function (b) { return b.group === p.group || b.ref === p.group; });
    if (!bs.length) err('Booking not found.');
    if (env.demo && p.demoPaid) await confirmGroup(bs[0].group); else await checkHitpay(bs[0].group);
    return { bookings: (await allBookings()).filter(function (b) { return b.group === bs[0].group; }).map(function (b) { return strip(b); }) };
  };
  A.uploadProof = async function (p) {
    var who = await auth(p.token, 'customer'), bs = (await allBookings()).filter(function (b) { return b.group === p.group && b.email === who.email; });
    if (!bs.length) err('Booking not found.'); if (!p.dataUrl) err('Choose a photo.');
    var f = await env.files.save(p.dataUrl, 'proof-' + who.email, true);
    for (var i = 0; i < bs.length; i++) {
      var b = bs[i]; b.proofFile = f.id; b.updated = now(); await env.db.put(T.book, b);
      await event('proof', 'Payment proof uploaded for ' + b.ref, ['biz:' + b.bizId, 'super'], b.ref, b.bizId, ['biz:' + b.bizId, 'super'], 'Payment proof uploaded - ' + b.ref, who.name + ' uploaded a payment proof for ' + b.ref + '. Confirm the payment in the app.');
    }
    return {};
  };
  A.myBookings = async function (p) {
    var who = await auth(p.token, 'customer'); await sweepOffers(); var mine = (await allBookings()).filter(function (b) { return b.email === who.email; }), riders = {};
    for (var i = 0; i < mine.length; i++) { var e = mine[i].rider; if (e && !riders[e]) { var r = await env.db.get(T.staff, e) || {}; riders[e] = { name: r.name || 'Your rider', phone: r.phone || '', vehicle: r.vehicle || '', plate: r.plate || '' }; } }
    return { bookings: mine.map(function (b) { var c = strip(b); delete c.fee; if (b.rider) c.riderInfo = riders[b.rider]; return c; }).sort(function (a, b) { return b.created.localeCompare(a.created); }) };
  };
  /* discount codes and rewards (customer) */
  A.checkCode = async function (p) {
    var who = p.token ? await auth(p.token, 'customer') : null, cat = await catalog(true), d = await findCode(p.code, who && who.email);
    return { code: pubCode(d), split: codeSplit(d, cat, p.amounts || {}) };
  };
  A.myRewards = async function (p) {
    var who = await auth(p.token, 'customer'), cat = await catalog(true); await birthdayBonus(who.rec, cat);
    var me = member(who.rec), rows = await pointsRows(me), out = [];
    for (var i = 0; i < cat.businesses.length; i++) {
      var z = cat.businesses[i], prog = Rules.rewardsOf(z); if (!prog.enabled) continue;
      var mine = rows.filter(function (x) { return x.bizId === z.id; }), bal = await pointsBalance(cat, me, z.id);
      out.push({ bizId: z.id, name: z.name, program: prog, balance: bal.balance, source: bal.source, earned: mine.filter(function (x) { return x.points > 0; }).reduce(function (t, x) { return t + x.points; }, 0),
        redeemed: -mine.filter(function (x) { return x.type === 'redeem'; }).reduce(function (t, x) { return t + x.points; }, 0), history: mine.slice(-15).reverse() });
    }
    return { rewards: out, mobile: me.phone };
  };
  /* merchant: store settings, team, rewards, Loyverse */
  var DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], PAY_METHODS = ['Cash', 'GCash', 'Maya', 'Credit / debit card', 'Bank transfer', 'HitPay online'];
  A.mStore = async function (p) {
    var who = await auth(p.token, 'merchant'), cat = await catalog(true), z = biz(cat, who.bizId); if (!z) err('Business not found.');
    var tok = Rules.rewardsOf(z).loyverse ? ((await secrets())['loyverse:' + z.id] || (z.id === 'pahuway' && env.loyverseToken) || '') : '';
    return { business: z, loyverseConnected: !!tok, loyverseAllowed: !!z.loyverseAllowed || z.id === 'pahuway' };
  };
  A.mSaveStore = async function (p) {
    var who = await auth(p.token, 'manager'), cat = await catalog(true), z = biz(cat, who.bizId), f = p.fields || {}; if (!z) err('Business not found.');
    if (!str(f.name)) err('Business name is required.');
    ['name', 'tagline', 'description', 'phone', 'email', 'facebook', 'address', 'landmark', 'notes'].forEach(function (k) { if (f[k] != null) z[k] = str(f[k], k === 'description' || k === 'notes' ? 1000 : 160); });
    if (f.town && TOWNS_OK(f.town)) z.town = f.town;
    if (f.hours) { z.hours = {}; DAYS.forEach(function (d) { var h = f.hours[d] || {}; z.hours[d] = { closed: !!h.closed, open: /^\d{2}:\d{2}$/.test(h.open) ? h.open : '08:00', close: /^\d{2}:\d{2}$/.test(h.close) ? h.close : '20:00' }; }); }
    if (f.paymentMethods) z.paymentMethods = f.paymentMethods.filter(function (m) { return PAY_METHODS.indexOf(m) >= 0; });
    if (f.acceptCodes != null) z.acceptCodes = !!f.acceptCodes;
    if (f.rewards) { var r = f.rewards, cur = Rules.rewardsOf(z); z.rewards = { enabled: !!r.enabled, loyverse: !!r.loyverse && (!!z.loyverseAllowed || z.id === 'pahuway') };
      ['pesoPerPoint', 'pointValue', 'signupBonus', 'birthdayBonus', 'minRedeem', 'redeemStep'].forEach(function (k) { var v = r[k] == null || r[k] === '' ? cur[k] : +r[k]; if (!(v >= 0)) err('Reward settings must be zero or more.'); z.rewards[k] = v; });
      if (!(z.rewards.pesoPerPoint > 0) || !(z.rewards.pointValue > 0) || !(z.rewards.redeemStep > 0)) err('Peso per point, point value and redeem step must be more than zero.'); }
    var st = Pricing.store(cat, z.id);
    if (st) { st.storeName = z.name; if (z.address) st.address = z.address; if (z.town) st.town = z.town;
      ['deliveryEnabled', 'pickupEnabled', 'codEnabled', 'onlineEnabled'].forEach(function (k) { if (f[k] != null) st[k] = !!f[k]; });
      if (z.hours) st.hours = hoursText(z.hours); }
    if (f.checkInTime || f.checkOutTime) cat.stays.forEach(function (x) { if (x.bizId === z.id) { if (f.checkInTime) x.checkInTime = str(f.checkInTime, 20); if (f.checkOutTime) x.checkOutTime = str(f.checkOutTime, 20); } });
    await env.db.kvPut('catalog', cat);
    await event('listing', who.name + ' updated store settings for ' + z.name, ['super', 'biz:' + z.id], '', z.id, [], '', '', who.email);
    return { business: z };
  };
  function TOWNS_OK(t) { return /^[A-Za-z .'-]{3,40}$/.test(t); }
  function hoursText(h) { var fmt = function (t) { var x = t.split(':'), hh = +x[0]; return (hh % 12 || 12) + ':' + x[1] + (hh < 12 ? ' AM' : ' PM'); }, open = DAYS.filter(function (d) { return h[d] && !h[d].closed; });
    if (!open.length) return 'Closed'; var same = open.every(function (d) { return h[d].open === h[open[0]].open && h[d].close === h[open[0]].close; });
    return (same ? fmt(h[open[0]].open) + ' – ' + fmt(h[open[0]].close) : 'Hours vary by day') + (open.length < 7 ? ' (closed ' + DAYS.filter(function (d) { return open.indexOf(d) < 0; }).map(function (d) { return d.charAt(0).toUpperCase() + d.slice(1); }).join(', ') + ')' : ''); }
  A.mSaveLoyverse = async function (p) {
    var who = await auth(p.token, 'manager'), cat = await catalog(true), z = biz(cat, who.bizId);
    if (!z || !(z.loyverseAllowed || z.id === 'pahuway')) err('Loyverse is not enabled for this business. Ask Beyond Tech Solutions.');
    var tok = str(p.loyverseToken, 200), sec = await secrets();
    if (tok && env.loyverse && env.loyverse.test) { try { await env.loyverse.test(tok); } catch (x) { err('Loyverse did not accept that token: ' + x.message); } }
    if (tok) sec['loyverse:' + z.id] = tok; else delete sec['loyverse:' + z.id];
    await env.db.kvPut('secrets', sec); return { loyverseConnected: !!tok };
  };
  A.mSaveTeam = async function (p) {
    var who = await auth(p.token, 'manager'), all = await staffAll(), bid = who.bizId;
    var team = (p.team || []).map(function (u) { return { email: low(u.email), name: str(u.name, 80), role: u.role === 'manager' ? 'manager' : 'staff', bizId: bid, phone: str(u.phone, 30) }; }).filter(function (u) { return u.email; });
    if (!team.some(function (u) { return u.email === who.email && u.role === 'manager'; })) err('You can\'t remove your own Merchant Admin access.');
    var byEmail = {}; all.forEach(function (s) { byEmail[s.email] = s; });
    team.forEach(function (u) { var o = byEmail[u.email]; if (o && !isMerchantRole(o.role)) err(u.email + ' is a ' + (Rules.ROLE_LABEL[o.role] || o.role) + ' account and can\'t be added to a business. Use a different email.'); });
    var check = []; all.forEach(function (s) { accessOf(s).forEach(function (x) { if (x.bizId !== bid) check.push({ email: s.email, role: x.role, bizId: x.bizId }); }); if (!isMerchantRole(s.role)) check.push({ email: s.email, role: s.role, bizId: '' }); });
    var e = Rules.staffCheck(check.concat(team)); if (e) err(e);
    var added = [], out = [];
    all.forEach(function (s) {
      if (!isMerchantRole(s.role)) { out.push(s); return; }
      var keep = accessOf(s).filter(function (x) { return x.bizId !== bid; }), mine = team.filter(function (u) { return u.email === s.email; })[0];
      if (mine) { keep = keep.concat([{ bizId: bid, role: mine.role }]); if (mine.name) s.name = mine.name; if (mine.phone) s.phone = mine.phone; if (!roleIn(s, bid)) added.push(mine); }
      if (keep.length) out.push(setAccess(s, keep));
    });
    team.forEach(function (u) { if (!byEmail[u.email]) { out.push(setAccess({ id: u.email, email: u.email, name: u.name, phone: u.phone, tokens: [], sessEpoch: Date.parse(now()) }, [{ bizId: bid, role: u.role }])); added.push(u); } });
    await env.db.replaceAll(T.staff, out);
    for (var i = 0; i < added.length; i++) { try { await env.mail(added[i].email, 'You have been added to ' + bizName(await catalog(), bid), 'Hi ' + (added[i].name || '') + ',\n\n' + who.name + ' added you as ' + Rules.ROLE_LABEL[added[i].role] + ' of ' + bizName(await catalog(), bid) + '. Sign in to the Merchant app with this email' + (byEmail[added[i].email] ? ' and pick the business at the top.' : '.') + (env.siteUrl ? '\n\n' + env.siteUrl.replace(/\/+$/, '') + '/merchant' : '')); } catch (x) { } }
    return { team: teamOf(out, bid) };
  };
  A.mRewardsReport = async function (p) {
    var who = await auth(p.token, 'manager'), cat = await catalog(true), rows = await pointsRows('', who.bizId), bk = (await allBookings()).filter(function (b) { return b.bizId === who.bizId && Rules.FREE.indexOf(b.status) < 0; });
    var cust = {}, get = function (k, e) { var c = cust[k] = cust[k] || { key: k, email: e || '', phone: /^09/.test(k) ? k : '', name: '', earned: 0, bonus: 0, redeemed: 0, balance: 0, codeUses: 0, codeAmount: 0, pointsAmount: 0, manual: 0, codes: {} }; if (e && !c.email) c.email = e; return c; };
    rows.forEach(function (x) { var c = get(x.phone || x.email, x.email); if (x.name && !c.name) c.name = x.name; c.balance += x.points; if (x.type === 'earn') c.earned += x.points; else if (x.points > 0 && x.type !== 'refund') c.bonus += x.points; if (x.type === 'redeem') c.redeemed -= x.points; if (x.type === 'refund') c.redeemed -= x.points; });
    bk.forEach(function (b) { var c = get(Rules.mobile(b.customer.phone) || b.email, b.email); c.name = b.customer.name; if (b.code) { c.codeUses++; c.codeAmount = Rules.r2(c.codeAmount + b.code.amount); c.codes[b.code.code] = 1; } if (b.points) c.pointsAmount = Rules.r2(c.pointsAmount + b.points.amount); if (b.discount) c.manual = Rules.r2(c.manual + (+b.discount)); });
    var list = Object.keys(cust).map(function (k) { var c = cust[k]; c.codes = Object.keys(c.codes); return c; }).filter(function (c) { return c.earned || c.bonus || c.redeemed || c.codeUses || c.manual; });
    var z = biz(cat, who.bizId);
    if (Rules.rewardsOf(z).loyverse && await lvToken(cat, who.bizId)) for (var i = 0; i < list.length; i++) { try { var lc = await env.loyverse.find(await lvToken(cat, who.bizId), list[i].email, list[i].phone); if (lc) list[i].loyverseBalance = +lc.total_points || 0; } catch (x) { } }
    return { customers: list, program: Rules.rewardsOf(z), acceptCodes: z.acceptCodes !== false };
  };
  /* messaging & notifications (all roles) */
  A.threads = async function (p) { return { threads: await threadsFor(await auth(p.token)) }; };
  A.thread = async function (p) {
    var who = await auth(p.token), t = await threadFor(who, p);
    return { thread: t, messages: (await env.db.all(T.msg)).filter(function (m) { return m.threadId === t.id; }).sort(function (a, b) { return a.at.localeCompare(b.at); }) };
  };
  A.send = async function (p) { return await sendMsg(await auth(p.token), p); };
  A.feed = async function (p) {
    var who = await auth(p.token), aud = myAud(who), since = p.since || '';
    if (who.role === 'rider') await patch(T.staff, who.rec.id || who.email, function (r) { r.lastSeen = now(); });
    return { now: now(), events: (await env.db.tail(T.ev, 400)).filter(function (e) { return e.at > since && e.aud.some(function (a) { return aud.indexOf(a) >= 0; }); }).slice(-60) };
  };
  /* staff sign-in */
  A.staffSendOtp = async function (p) {
    var e = low(p.email), s = await env.db.get(T.staff, e), roles = { admin: ['super'], merchant: ['manager', 'staff'], rider: ['rider'] }[p.portal] || [];
    if (!s || roles.indexOf(s.role) < 0) err(p.portal === 'admin' ? 'This email is not a Super Admin.' : p.portal === 'rider' ? 'This email is not registered as a rider. Ask Beyond Tech Solutions to add you.' : 'This email is not registered to a business. Ask your Merchant Admin or Beyond Tech Solutions to add you.');
    return await code('staff:' + e, e, await catalog());
  };
  A.staffVerifyOtp = async function (p) {
    var e = low(p.email); await check('staff:' + e, p.code);
    var s = await env.db.get(T.staff, e); if (!s) err('Access removed.');
    var t = addToken(s); await env.db.put(T.staff, s); await remember(T.staff, s, t); return { token: t, me: pubStaff(s) };
  };
  A.staffMe = async function (p) { var who = await auth(p.token); if (!(await env.cache.get('sess:' + p.token))) await remember(T.staff, who.rec, p.token); return { me: pubStaff(who.rec) }; };
  A.riders = async function (p) { var who = await auth(p.token); if (['super', 'manager', 'staff'].indexOf(who.role) < 0) err('Not allowed.'); return { riders: (await staffAll()).filter(function (s) { return s.role === 'rider' && (!s.bizId || s.bizId === who.bizId || who.role === 'super'); }).map(pubStaff) }; };
  /* merchant */
  A.mBookings = async function (p) {
    var who = await auth(p.token, 'merchant'), td = env.today();
    var list = (await allBookings()).filter(function (b) { return b.bizId === who.bizId && !(b.dispatch && (b.status === 'Finding Rider' || (b.status === 'Awaiting Payment' && b.payMethod === 'online') || (b.status === 'Cancelled' && !b.rider && (b.history || []).every(function (h) { return h.status !== 'New' && h.status !== 'Accepted'; })))); });
    if (who.role === 'staff') list = list.filter(function (b) { return Rules.CLOSED.indexOf(b.status) < 0 || b.created.slice(0, 10) === td || String(b.updated || '').slice(0, 10) === td; });
    return { bookings: list.map(function (b) { var c = strip(b); if (who.role === 'staff') { delete c.fee; delete c.discount; } return c; }) };
  };
  A.setStatus = async function (p) { var who = await auth(p.token); if (who.kind === 'customer') err('Not allowed.'); return { booking: strip(await setStatus(who, p.ref, p.status, p.note, p.amount), who.role === 'super') }; };
  A.mUpdate = async function (p) {
    var who = await auth(p.token, 'manager'), b = await getB(p.ref); if (b.bizId !== who.bizId) err('Booking not found.');
    if (p.discount != null) { var d = +p.discount; if (!(d >= 0) || d > Rules.gross(b)) err('Discount must be between 0 and the booking amount.'); b.discount = d; }
    if (p.merchantNotes != null) b.merchantNotes = String(p.merchantNotes).slice(0, 1000);
    b.updated = now(); await env.db.put(T.book, b); return { booking: strip(b) };
  };
  A.assignRider = async function (p) {
    var who = await auth(p.token), b = await getB(p.ref);
    if (!(who.role === 'super' || ((who.role === 'manager' || who.role === 'staff') && b.bizId === who.bizId && !b.dispatch))) err(b.dispatch ? 'Riders accept delivery orders themselves. Ask Beyond Tech Solutions if you need help.' : 'Not allowed.');
    if (b.kind !== 'food' || b.fulfillment !== 'delivery') err('Only delivery orders can have a rider.');
    var r = p.rider ? await env.db.get(T.staff, low(p.rider)) : null; if (p.rider && (!r || r.role !== 'rider')) err('Rider not found.');
    var old = b.rider; b.rider = r ? r.email : ''; b.riderAccepted = false; b.updated = now(); await env.db.put(T.book, b);
    if (r && b.dispatch && !old && b.status === 'Finding Rider') { b.offer = b.offer || { at: now(), round: 2, riders: [], declined: [] }; b.rider = ''; b.offer.riders = b.offer.riders.filter(function (e) { return e !== r.email; }).concat([r.email]); b.offer.closed = null; b.offer.declined = (b.offer.declined || []).filter(function (e) { return e !== r.email; }); await env.db.put(T.book, b); await event('offer', 'Delivery request ' + b.ref + ' sent to you by Beyond Tech Solutions. Open the Rider app to accept.', ['rider:' + r.email], b.ref, b.bizId, ['rider:' + r.email], 'Delivery request ' + b.ref, summary(b), who.email); return { booking: strip(b) }; }
    if (r) await event('assigned', 'Delivery ' + b.ref + ' assigned to you - ' + (b.landmark || b.customer.address), ['rider:' + r.email, 'biz:' + b.bizId, 'super'], b.ref, b.bizId, ['rider:' + r.email], 'New delivery assigned: ' + b.ref, summary(b), who.email);
    if (old && old !== b.rider) await event('unassigned', 'Delivery ' + b.ref + ' was reassigned', ['rider:' + old], b.ref, b.bizId, [], '', '', who.email);
    return { booking: strip(b) };
  };
  function findListing(cat, kind, id, bizId) {
    if (kind === 'stay') return cat.stays.filter(function (x) { return x.id === id && x.bizId === bizId; })[0];
    if (kind === 'unit') return cat.rentals.units.filter(function (x) { return x.id === id && x.bizId === bizId; })[0];
    if (kind === 'tour') return cat.tours.filter(function (x) { return x.id === id && x.bizId === bizId; })[0];
    if (kind === 'item') { var st = Pricing.store(cat, bizId); return st ? st.items.filter(function (x) { return x.id === id; })[0] : null; }
    return null;
  }
  A.mAvailability = async function (p) {
    var who = await auth(p.token, 'merchant'), cat = await catalog(true), v = !!p.value;
    if (p.kind === 'store') { var st = Pricing.store(cat, who.bizId); if (!st) err('Listing not found.'); st.open = v; await env.db.kvPut('catalog', cat); return {}; }
    var it = findListing(cat, p.kind, p.id, who.bizId); if (!it) err('Listing not found.');
    if (p.kind === 'item') it.available = v; else it.active = v;
    await env.db.kvPut('catalog', cat); return {};
  };
  /* Merchant Admin: photo for any of their listings (menu item, stay, rental unit, tour) or the store logo */
  A.mPhoto = async function (p) {
    var who = await auth(p.token, 'manager'), cat = await catalog(true), it = p.kind === 'store' ? Pricing.store(cat, who.bizId) || biz(cat, who.bizId) : findListing(cat, p.kind, p.id, who.bizId);
    if (!it) err('Listing not found.');
    if (p.remove) it.photo = '';
    else { if (!p.dataUrl) err('Choose a photo.'); it.photo = (await env.files.save(p.dataUrl, who.bizId + '-' + (p.id || 'logo'), false)).url; }
    await env.db.kvPut('catalog', cat); return { photo: it.photo };
  };
  /* Stay photo gallery (Merchant Admin of the stay, or Super Admin): add a photo, or save the new order / removals. First photo = cover. */
  A.mGallery = async function (p) {
    var who = await auth(p.token); if (who.role !== 'super' && who.role !== 'manager') err('Merchant Admin access only.');
    var cat = await catalog(true), st = cat.stays.filter(function (x) { return x.id === p.id && (who.role === 'super' || x.bizId === who.bizId); })[0]; if (!st) err('Stay not found.');
    var cur = Pricing.stayPhotos(st);
    if (p.add) { if (cur.length >= 30) err('A stay can have up to 30 photos.'); cur = cur.concat([(await env.files.save(p.add, (st.bizId || 'stay') + '-' + st.id + '-gallery', false)).url]); }
    else if (Array.isArray(p.photos)) { var seen = {}; cur = p.photos.filter(function (u) { if (cur.indexOf(u) < 0 || seen[u]) return false; seen[u] = 1; return true; }); }
    st.photos = cur; st.photo = cur[0] || '';
    await env.db.kvPut('catalog', cat); return { photos: cur };
  };
  /* Merchant Admin: add-on groups of a menu item (on/off, required or optional, customers pick up to 3 per group) */
  A.mAddons = async function (p) {
    var who = await auth(p.token, 'manager'), cat = await catalog(true), it = findListing(cat, 'item', p.id, who.bizId); if (!it) err('Menu item not found.');
    var seen = {};
    var groups = (p.groups || []).slice(0, 10).map(function (g) {
      var name = str(g.name, 40); if (!name) err('Give each add-on group a name (e.g. Size, Sugar level, Extras).');
      var gid = /^[a-z0-9_-]{1,30}$/i.test(g.id || '') && !seen[g.id] ? g.id : env.uuid().slice(0, 8); seen[gid] = 1;
      var oseen = {}, opts = (g.options || []).slice(0, 20).map(function (o) {
        var on = str(o.name, 50); if (!on) err(name + ': give each choice a name.');
        var pr = o.price == null || o.price === '' ? 0 : +o.price; if (!(pr >= 0)) err(name + ': prices must be zero or more.');
        var oid = /^[a-z0-9_-]{1,30}$/i.test(o.id || '') && !oseen[o.id] ? o.id : env.uuid().slice(0, 8); oseen[oid] = 1;
        return { id: oid, name: on, price: Math.round(pr * 100) / 100, active: o.active !== false };
      });
      if (!opts.length) err(name + ': add at least one choice.');
      var max = Math.floor(+g.max || 1); if (max < 1 || max > 3) err(name + ': customers can pick 1 to 3 choices.');
      return { id: gid, name: name, active: g.active !== false, required: !!g.required, max: Math.min(max, opts.length), options: opts };
    });
    it.addonGroups = groups; delete it.addons;
    await env.db.kvPut('catalog', cat);
    await event('listing', who.name + ' updated add-ons for ' + it.name, ['super', 'biz:' + who.bizId], '', who.bizId, [], '', '', who.email);
    return { item: it };
  };
  /* Merchant Admin: save the whole menu at once — add new items, edit name/category/description/price/discount/availability, remove items.
     Items not in the list are removed. Photos and add-ons of existing items are kept. */
  A.mMenu = async function (p) {
    var who = await auth(p.token, 'manager'), cat = await catalog(true), F = Pricing.store(cat, who.bizId); if (!F) err('This business has no menu.');
    var list = Array.isArray(p.items) ? p.items : err('Nothing to save.'); if (list.length > 300) err('A menu can have up to 300 items.');
    var old = {}, cats = {}, used = {}, added = 0, out;
    F.items.forEach(function (i) { old[i.id] = i; });
    /* categories: optional full list [{id, name}]; new ones (no or unknown id) get an id from their name, and items may refer to them by the id the app sent */
    var newCats = F.categories || [], cmap = {};
    if (Array.isArray(p.categories)) {
      if (p.categories.length > 50) err('A menu can have up to 50 categories.');
      var oldC = {}, names = {}, cused = {}; newCats.forEach(function (c) { oldC[c.id] = c; });
      newCats = p.categories.map(function (c) {
        var nm = str(c.name, 40); if (!nm) err('Give each category a name.');
        if (names[nm.toLowerCase()]) err('There are two categories named "' + nm + '".'); names[nm.toLowerCase()] = 1;
        var cid = c.id && oldC[c.id] && !cused[c.id] ? c.id : null;
        if (!cid) { var b0 = slug(nm) || 'cat', k0 = 2; cid = b0; while (oldC[cid] || cused[cid]) cid = b0.slice(0, 26) + '-' + k0++; }
        cused[cid] = 1; if (c.id) cmap[c.id] = cid; cmap[cid] = cid;
        return { id: cid, name: nm };
      });
    }
    newCats.forEach(function (c) { cats[c.id] = 1; cmap[c.id] = cmap[c.id] || c.id; });
    out = list.map(function (x, n) {
      var name = str(x.name, 80); if (!name) err('Item ' + (n + 1) + ': enter a name.');
      var pr = +x.price; if (!(pr > 0)) err(name + ': price must be more than zero.');
      var pc = x.promoPct == null || x.promoPct === '' ? 0 : +x.promoPct; if (!(pc >= 0) || pc > 90) err(name + ': discount must be 0 to 90%.');
      var it = x.id && old[x.id] && !used[x.id] ? clone(old[x.id]) : null;
      if (!it) { var base = slug(name) || 'item', id = base, k = 2; while (old[id] || used[id]) id = base.slice(0, 26) + '-' + k++; it = { id: id, photo: '', addonGroups: [] }; added++; }
      used[it.id] = 1;
      it.name = name; it.desc = str(x.desc, 200); var want = cmap[x.catId]; if (x.catId && !want && Array.isArray(p.categories)) err(name + ': choose a category.'); it.catId = want || (it.catId && cats[it.catId] ? it.catId : (newCats[0] || {}).id || '');
      it.price = Math.round(pr * 100) / 100; if (pc) it.promoPct = Math.round(pc * 100) / 100; else delete it.promoPct;
      it.available = x.available !== false;
      return it;
    });
    var removed = F.items.filter(function (i) { return !used[i.id]; }).map(function (i) { return i.name; });
    F.items = out; F.categories = newCats; await env.db.kvPut('catalog', cat);
    await event('listing', who.name + ' saved the menu of ' + F.storeName + ' (' + out.length + ' items' + (added ? ', ' + added + ' added' : '') + (removed.length ? ', removed: ' + removed.join(', ') : '') + ')', ['super', 'biz:' + who.bizId], '', who.bizId, [], '', '', who.email);
    return { items: out, added: added, removed: removed.length };
  };
  /* Merchant Admin: simple delivery fees per distance (what the customer pays). Riders earn it; the platform tops them up to the minimum. */
  A.mSaveDelivery = async function (p) {
    var who = await auth(p.token, 'manager'), cat = await catalog(true), F = Pricing.store(cat, who.bizId); if (!F) err('This business has no food store.');
    var bands = (p.bands || []).map(function (b) { return { upToKm: Pricing.round(+b.upToKm), fee: Pricing.round(+b.fee), subsidy: Pricing.round(+b.subsidy || 0) }; });
    if (!bands.length) err('Add at least one distance.'); if (bands.length > 12) err('Up to 12 distances.');
    bands.forEach(function (b, i) { if (!(b.upToKm > 0) || b.upToKm > 30) err('Distance ' + (i + 1) + ': enter "up to" km between 0.1 and 30.'); if (!(b.fee >= 0)) err('Distance ' + (i + 1) + ': the fee must be ₱0 or more.'); if (!(b.subsidy >= 0) || b.subsidy > 1000) err('Distance ' + (i + 1) + ': the rider subsidy must be ₱0 to ₱1,000.'); if (i && b.upToKm <= bands[i - 1].upToKm) err('Each distance must be farther than the one before it.'); });
    F.matrix = bands.map(function (b) { var o = { upToKm: b.upToKm, customerFee: b.fee }; if (b.subsidy) o.subsidy = b.subsidy; return o; }); F.matrixFees = true; F.simpleFees = true; delete F.maxKm;
    await env.db.kvPut('catalog', cat);
    await event('listing', who.name + ' updated delivery fees for ' + F.storeName + ': ' + bands.map(function (b, i) { return (i ? bands[i - 1].upToKm : 0) + '-' + b.upToKm + ' km P' + b.fee + (b.subsidy ? ' (+P' + b.subsidy + ' rider subsidy)' : ''); }).join(', '), ['super', 'biz:' + who.bizId], '', who.bizId, [], '', '', who.email);
    return { matrix: F.matrix };
  };
  /* Merchant Admin: prices, promo discount and security deposit of their own listings */
  var EDITABLE = { stay: ['rate', 'deposit', 'promoPct'], unit: ['dailyRate', 'hourlyRate', 'deposit', 'promoPct'], tour: ['rate', 'deposit', 'promoPct'], item: ['price', 'promoPct'] };
  A.mListing = async function (p) {
    var who = await auth(p.token, 'manager'), cat = await catalog(true), it = findListing(cat, p.kind, p.id, who.bizId), f = p.fields || {};
    if (!it || !EDITABLE[p.kind]) err('Listing not found.');
    EDITABLE[p.kind].forEach(function (k) {
      if (f[k] == null || f[k] === '') return;
      var v = +f[k]; if (!(v >= 0)) err('Prices, discounts and deposits must be zero or more.');
      if (k === 'promoPct' && v > 90) err('Discount can be at most 90%.');
      if ((k === 'rate' || k === 'dailyRate' || k === 'price') && !(v > 0)) err('Price must be more than zero.');
      it[k] = Math.round(v * 100) / 100;
    });
    await env.db.kvPut('catalog', cat);
    await event('listing', who.name + ' updated pricing for ' + (it.name || it.id), ['super', 'biz:' + who.bizId], '', who.bizId, [], '', '', who.email);
    return { listing: it };
  };
  function teamOf(all, bizId) { return all.filter(function (s) { return !!roleIn(s, bizId); }).map(function (s) { return Object.assign(pubStaff(s), { role: roleIn(s, bizId), bizId: bizId }); }); }
  A.mTeam = async function (p) { var who = await auth(p.token, 'merchant'); return { team: teamOf(await staffAll(), who.bizId) }; };
  A.viewUpload = async function (p) {
    var who = await auth(p.token), id = p.fileId, ok = who.role === 'super';
    if (!ok && who.role === 'manager') ok = (await allBookings()).some(function (b) { return b.bizId === who.bizId && (b.idFile === id || b.proofFile === id); });
    if (!ok) err('Not allowed.');
    return { dataUrl: await env.files.read(id) };
  };
  /* rider */
  /* the store's rider subsidy is shown to the rider only at the store (pick-up) and after delivery */
  A.rOrders = async function (p) { var who = await auth(p.token, 'rider'); await sweepOffers(); var cat = await catalog(), all = await allBookings(); return { me: pubStaff(who.rec), offers: who.rec.available ? all.filter(function (b) { return b.dispatch && !b.rider && b.offer && !b.offer.closed && b.offer.riders.indexOf(who.email) >= 0 && (b.offer.declined || []).indexOf(who.email) < 0 && Rules.CLOSED.indexOf(b.status) < 0; }).map(function (b) { return offerView(b, cat, who.rec); }) : [], orders: (await allBookings()).filter(function (b) { return b.rider === who.email; }).map(function (b) { var c = strip(b); delete c.fee; delete c.discount; delete c.idFile; delete c.proofFile; return c; }) }; };
  A.rAvailable = async function (p) { var who = await auth(p.token, 'rider'), still = !p.value && (await allBookings()).some(function (b) { return b.rider === who.email && liveFor(b); }); who.rec = await patch(T.staff, who.rec.id || who.email, function (r) { r.available = !!p.value; r.lastSeen = now(); if (!p.value && !still) delete r.loc; }) || who.rec; await event('rider', who.name + ' is now ' + (p.value ? 'available' : 'offline'), ['super'], '', '', []); return { me: pubStaff(who.rec) }; };
  A.rOffer = async function (p) {
    var who = await auth(p.token, 'rider'), b = await getB(p.ref), cat = await catalog();
    if (b.rider && b.dispatch) err(b.rider === who.email ? 'You already accepted this delivery.' : 'Another rider already accepted this delivery.');
    if (!b.dispatch || !b.offer || b.offer.closed || Rules.CLOSED.indexOf(b.status) >= 0) err('This delivery request is no longer available.');
    if (b.offer.riders.indexOf(who.email) < 0) err('This delivery request was not sent to you.');
    if (!p.accept) {
      b.offer.declined = (b.offer.declined || []).concat([who.email]); await env.db.put(T.book, b);
      if (b.offer.riders.every(function (e) { return b.offer.declined.indexOf(e) >= 0; }) && b.offer.round < 2) { b.offer.at = new Date(Date.parse(now()) - 60 * 6e4).toISOString(); await env.db.put(T.book, b); await sweepOffers(); }
      return { ok: true };
    }
    if (!who.rec.available) err('Go online first to accept deliveries.');
    var prev = b.status; b.rider = who.email; b.riderAccepted = true; b.offer.closed = now(); b.offer.by = who.email;
    if (b.status === 'Finding Rider') b.status = b.payMethod === 'online' || b.payMethod === 'transfer' ? 'Payment Confirmed' : 'New';
    b.history = (b.history || []).concat([{ at: now(), status: b.status, by: who.name, role: 'rider', note: 'Rider ' + who.name + ' accepted the delivery' }]);
    b.updated = now(); await env.db.put(T.book, b);
    var bn = bizName(cat, b.bizId), me = b.customer || {};
    if (prev === 'Finding Rider') await event('new', 'New delivery order ' + b.ref + ' for ' + bn + ' from ' + (me.name || b.email) + ' - P' + b.quote.total + ' · rider ' + who.name + ' accepted', ['biz:' + b.bizId, 'super'], b.ref, b.bizId, ['biz:' + b.bizId], 'New order ' + b.ref + ' - ' + bn + ' (rider ' + who.name + ')', (me.name || '') + ' | ' + (me.phone || '') + '\n' + (b.landmark || me.address || '') + '\n\n' + summary(b) + '\n\nRider: ' + who.name + (who.rec.phone ? ' ' + who.rec.phone : ''), who.email);
    else await event('assigned', 'Rider ' + who.name + ' accepted delivery ' + b.ref, ['biz:' + b.bizId, 'super'], b.ref, b.bizId, [], '', '', who.email);
    await event('status', b.ref + ': rider ' + who.name + ' accepted your order' + (prev === 'Finding Rider' ? ' and it was sent to ' + bn : '') + '.', ['cust:' + b.email], b.ref, b.bizId, ['cust:' + b.email], 'A rider accepted ' + b.ref, 'Good news! ' + who.name + ' will deliver your order ' + b.ref + ' from ' + bn + '.', who.email);
    var others = b.offer.riders.filter(function (e) { return e !== who.email; }); if (others.length) await event('unassigned', 'Delivery request ' + b.ref + ' was taken by another rider', others.map(function (e) { return 'rider:' + e; }), b.ref, b.bizId, [], '', '', who.email);
    return { booking: strip(b) };
  };
  A.custCancel = async function (p) {
    var who = await auth(p.token, 'customer'), b = await getB(p.ref); if (b.email !== who.email) err('Booking not found.');
    if (b.payMethod === 'online' && b.status === 'Awaiting Payment' && b.hitpayId && await checkHitpay(b.group)) err('We already received your payment for ' + b.ref + ', so it can no longer be cancelled here. Message the store.');
    b = await getB(p.ref);
    if (!Rules.custCanCancel(b)) err(b.payStatus === 'Paid' ? 'This is already paid, so it can no longer be cancelled here. Message the store about a refund.' : b.payMethod === 'transfer' && b.proofFile ? 'Your payment proof is being checked. Message the store to cancel.' : 'This can no longer be cancelled here (it is already being prepared or in progress). Message the store.');
    /* an unpaid online payment link covers the whole group, so the whole group is cancelled */
    var group = b.payMethod === 'online' && b.status === 'Awaiting Payment' ? (await allBookings()).filter(function (x) { return x.group === b.group && x.status === 'Awaiting Payment'; }) : [b];
    if (b.hitpayId && b.status === 'Awaiting Payment' && env.hitpay.cancel) await env.hitpay.cancel(b.hitpayId);
    var out = [];
    for (var i = 0; i < group.length; i++) out.push(strip(await setStatus(who, group[i].ref, 'Cancelled', 'Cancelled by the customer' + (group[i].payStatus === 'Paid' ? '. Refund due.' : ''))));
    return { booking: out.filter(function (x) { return x.ref === p.ref; })[0] || out[0], bookings: out };
  };
  A.rRespond = async function (p) {
    var who = await auth(p.token, 'rider'), b = await getB(p.ref); if (b.rider !== who.email) err('This delivery is not assigned to you.');
    if (p.accept) { b.riderAccepted = true; } else { b.rider = ''; b.riderAccepted = false; }
    b.updated = now(); await env.db.put(T.book, b);
    if (!p.accept && b.dispatch) { b.offer = { at: now(), round: 1, riders: [], declined: [who.email] }; await startOffer(b, await catalog()); }
    await event('rider', who.name + (p.accept ? ' accepted' : ' declined') + ' delivery ' + b.ref, ['biz:' + b.bizId, 'super'], b.ref, b.bizId, p.accept ? [] : ['biz:' + b.bizId], 'Rider declined ' + b.ref, who.name + ' declined delivery ' + b.ref + '. Please assign another rider.', who.email);
    return { booking: strip(b) };
  };
  /* ---------- live rider location (shared only while the rider has an active delivery) ---------- */
  function liveFor(b) { return Rules.trackable(b); }
  A.rLocation = async function (p) {
    var who = await auth(p.token, 'rider'), lat = +p.lat, lng = +p.lng;
    if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) err('Invalid location.');
    var active = (await allBookings()).filter(function (b) { return b.rider === who.email && liveFor(b); });
    if (!active.length && !who.rec.available) { if (who.rec.loc) await patch(T.staff, who.rec.id || who.email, function (r) { delete r.loc; }); return { sharing: false, refs: [] }; }
    var loc = { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6, acc: Math.round(+p.acc || 0), heading: isFinite(+p.heading) ? Math.round(+p.heading) : null, at: now() };
    await patch(T.staff, who.rec.id || who.email, function (r) { r.loc = loc; r.lastSeen = now(); });
    return { sharing: true, area: !active.length, refs: active.map(function (b) { return b.ref; }) };
  };
  A.track = async function (p) {
    var who = await auth(p.token), b = await getB(p.ref), cat = await catalog(true);
    var ok = who.role === 'super' || (who.kind === 'customer' && b.email === who.email) || ((who.role === 'manager' || who.role === 'staff') && b.bizId === who.bizId) || (who.role === 'rider' && b.rider === who.email);
    if (!ok) err('Booking not found.');
    if (b.kind !== 'food' || b.fulfillment !== 'delivery') err('Only deliveries can be tracked.');
    var st = Pricing.store(cat, b.bizId) || { lat: 12.57, lng: 122.13, storeName: bizName(cat, b.bizId) };
    var store = { lat: +st.lat, lng: +st.lng, name: st.storeName }, dest = { lat: b.lat != null ? +b.lat : null, lng: b.lng != null ? +b.lng : null, label: b.landmark || b.customer.address };
    var out = { ref: b.ref, status: b.status, store: store, dest: dest, live: false, done: Rules.delivered(b) || Rules.CLOSED.indexOf(b.status) >= 0, rider: null, loc: null, eta: null };
    if (!b.rider) return out;
    var r = await env.db.get(T.staff, b.rider) || {};
    out.rider = { name: r.name || 'Your rider', phone: r.phone || '', vehicle: r.vehicle || '', plate: r.plate || '', accepted: !!b.riderAccepted };
    if (!liveFor(b)) return out;
    var loc = r.loc && (Date.parse(now()) - Date.parse(r.loc.at)) < 15 * 6e4 ? r.loc : null;
    if (!loc && env.demo) {   /* demo: simulate the ride from the store to the customer */
      var to = dest.lat != null ? dest : { lat: store.lat + 0.012, lng: store.lng - 0.01 }, h = (b.history || []).filter(function (x) { return x.status === 'Out for Delivery'; }).pop();
      var t = b.status === 'Out for Delivery' && h ? Math.min(0.95, (Date.parse(now()) - Date.parse(h.at)) / (8 * 6e4)) : 0;
      loc = { lat: store.lat + (to.lat - store.lat) * t + (t ? 0 : 0.0006), lng: store.lng + (to.lng - store.lng) * t, acc: 10, at: now(), simulated: true };
    }
    if (loc) {
      out.loc = loc; out.live = true;
      var to2 = dest.lat != null ? dest : null, km = 0;
      if (b.status === 'Out for Delivery') km = to2 ? Pricing.km(loc.lat, loc.lng, to2.lat, to2.lng) : 0;
      else km = Pricing.km(loc.lat, loc.lng, store.lat, store.lng) + (to2 ? Pricing.km(store.lat, store.lng, to2.lat, to2.lng) : 0);
      out.km = Pricing.round(km); out.eta = Math.max(1, Math.round(km * 1.3 / 25 * 60) + (b.status === 'Out for Delivery' ? 0 : 5));
    }
    return out;
  };

  /* super admin */
  A.saveCatalog = async function (p) { await auth(p.token, 'super'); if (!p.catalog || !p.catalog.businesses) err('Catalog is incomplete.'); await env.db.kvPut('catalog', Pricing.norm(p.catalog)); return {}; };
  A.uploadPhoto = async function (p) { await auth(p.token, 'super'); return { url: (await env.files.save(p.dataUrl, p.name, false)).url }; };
  A.adminData = async function (p) {
    await auth(p.token, 'super');
    return { bookings: (await allBookings()).map(function (b) { return strip(b, true); }), customers: (await env.db.all(T.cust)).map(pubCust), applications: (await env.db.all(T.app)).map(function (a) { var c = clone(a); delete c.pw; return c; }), staff: staffRows(await staffAll()),
      threads: await env.db.all(T.thr), events: await env.db.tail(T.ev, 100), payees: await payees(), payouts: await env.db.all(T.pay), discounts: await discounts() };
  };
  A.adminUpdate = async function (p) {
    await auth(p.token, 'super'); var b = await getB(p.ref), f = p.fields || {};
    if (f.discount != null) { var d = +f.discount; if (!(d >= 0) || d > Rules.gross(b)) err('Discount must be between 0 and the booking amount.'); b.discount = d; }
    if (f.fee != null) { var fe = +f.fee; if (!(fe >= 0)) err('Invalid platform fee.'); b.fee = fe; }
    if (f.payStatus && Rules.PAY_STATUSES.indexOf(f.payStatus) >= 0) b.payStatus = f.payStatus;
    if (f.adminNotes != null) b.adminNotes = String(f.adminNotes).slice(0, 2000);
    if (f.customer) ['name', 'phone', 'address'].forEach(function (k) { if (f.customer[k] != null) b.customer[k] = String(f.customer[k]).slice(0, 300); });
    b.updated = now(); await env.db.put(T.book, b); return { booking: strip(b, true) };
  };
  A.adminVerify = async function (p) {
    var who = await auth(p.token, 'super'), c = await env.db.get(T.cust, low(p.email)); if (!c || !c.verify) err('Customer not found.');
    if (['verified', 'rejected'].indexOf(p.decision) < 0) err('Choose approve or reject.');
    c.verify.status = p.decision; c.verify.note = String(p.note || '').slice(0, 300); c.verify.decided = now(); c.verify.by = who.email; await env.db.put(T.cust, c);
    await event('verification', 'ID ' + (p.decision === 'verified' ? 'approved' : 'not approved') + ' for ' + (c.name || c.email), ['cust:' + c.email, 'super'], '', '', ['cust:' + c.email],
      p.decision === 'verified' ? 'Your account is verified' : 'We could not verify your ID', p.decision === 'verified' ? 'Hi ' + c.name + ', your ID has been approved. You can now book stays and rentals.' : 'Hi ' + c.name + ', we could not verify the ID you uploaded' + (c.verify.note ? ' (' + c.verify.note + ')' : '') + '. Please upload a clear photo of a valid government ID in the app.', who.email);
    return { profile: pubCust(c) };
  };
  A.adminUpdateApplication = async function (p) {
    await auth(p.token, 'super'); var a = await env.db.get(T.app, p.id); if (!a) err('Application not found.');
    if (p.status) { if (Rules.APP_STATUSES.indexOf(p.status) < 0) err('Unknown status.'); a.status = p.status; }
    if (p.adminNotes != null) a.adminNotes = String(p.adminNotes).slice(0, 2000);
    if (p.platformFee) a.platformFee = { type: p.platformFee.type === 'fixed' ? 'fixed' : 'percent', value: Math.max(0, +p.platformFee.value || 0) };
    await env.db.put(T.app, a); return { application: a };
  };
  A.adminSaveStaff = async function (p) {
    var me = await auth(p.token, 'super');
    var rows = (p.staff || []).map(function (s) { return { email: low(s.email), name: String(s.name || '').slice(0, 80), role: s.role, bizId: s.role === 'super' || s.role === 'rider' ? '' : String(s.bizId || ''), phone: String(s.phone || '').slice(0, 30) }; });
    var e = Rules.staffCheck(rows); if (e) err(e);
    if (!rows.some(function (s) { return s.email === me.email && s.role === 'super'; })) err('You can\'t remove your own Super Admin access.');
    var old = {}; (await staffAll()).forEach(function (s) { old[s.email] = s; });
    var merged = {}, order = [];
    rows.forEach(function (r) {
      var m = merged[r.email];
      if (!m) { m = merged[r.email] = { id: r.email, email: r.email, name: r.name, role: r.role, bizId: r.bizId, phone: r.phone, access: [] }; order.push(r.email); }
      if (!m.name && r.name) m.name = r.name;
      if (isMerchantRole(r.role)) m.access.push({ bizId: r.bizId, role: r.role });
    });
    await env.db.replaceAll(T.staff, order.map(function (k) {
      var s = merged[k], o = old[k];
      if (isMerchantRole(s.role)) setAccess(s, s.access); else delete s.access;
      var sameKind = o && (isMerchantRole(o.role) ? isMerchantRole(s.role) : o.role === s.role);
      s.tokens = sameKind ? o.tokens || [] : []; s.sessEpoch = o ? (o.sessEpoch || 0) + (sameKind ? 0 : 1) : Date.parse(now()); if (o && sameKind) ['pw', 'push', 'loc', 'vehicle', 'plate'].forEach(function (f) { if (o[f] != null && s[f] == null) s[f] = o[f]; }); s.available = o ? !!o.available : false; s.lastSeen = o ? o.lastSeen || '' : '';
      if (o && s.role === 'rider') RIDER_FIELDS.forEach(function (f) { if (o[f] != null) s[f] = o[f]; });
      return s;
    }));
    return {};
  };
  /* Super Admin: deactivate / reactivate a rider (signs them out, no new requests) or remove them for good */
  async function riderChecks(e) {
    var all = await allBookings(), st = settings(await catalog());
    var active = all.filter(function (b) { return b.rider === e && b.kind === 'food' && !Rules.delivered(b) && Rules.CLOSED.indexOf(b.status) < 0; });
    var net = Rules.r2(all.filter(function (b) { return b.rider === e && Rules.riderPayable(b); }).reduce(function (t, b) { return t + Rules.ledger(b, st).riderNet; }, 0));
    return { active: active, net: net, all: all };
  }
  A.adminRiderActive = async function (p) {
    var who = await auth(p.token, 'super'), e = low(p.email), r = await env.db.get(T.staff, e); if (!r || r.role !== 'rider') err('Rider not found.');
    r.active = !!p.active; if (!r.active) { r.available = false; r.tokens = []; r.sessEpoch = (r.sessEpoch || 0) + 1; delete r.loc; }
    await env.db.put(T.staff, r);
    await event('rider', (r.name || e) + ' was ' + (r.active ? 'reactivated' : 'deactivated') + ' by ' + who.name, ['super', 'rider:' + e], '', '', r.active ? ['rider:' + e] : [], 'Your rider account is active again', 'Hi ' + (r.name || '') + ',\n\nYour rider account is active again. Sign in to the Rider app to receive deliveries.', who.email);
    return { rider: adminStaff(r) };
  };
  A.adminRemoveRider = async function (p) {
    var who = await auth(p.token, 'super'), e = low(p.email), staff = await staffAll(), r = staff.filter(function (s) { return s.email === e; })[0];
    if (!r || r.role !== 'rider') err('Rider not found.');
    var c = await riderChecks(e);
    if (c.active.length) err((r.name || e) + ' still has ' + c.active.length + ' active deliver' + (c.active.length === 1 ? 'y' : 'ies') + ' (' + c.active.map(function (b) { return b.ref; }).join(', ') + '). Reassign or finish them first.');
    if (c.net && !p.force) err('UNSETTLED: ' + (r.name || e) + ' has an unsettled balance of P' + Math.abs(c.net) + (c.net > 0 ? ' to pay them' : ' to collect from them') + '. Settle it in Payouts first, or remove anyway.');
    /* take them off any open delivery requests */
    for (var i = 0; i < c.all.length; i++) { var b = c.all[i]; if (b.offer && (b.offer.riders || []).indexOf(e) >= 0 && !b.offer.closed) { b.offer.riders = b.offer.riders.filter(function (x) { return x !== e; }); await env.db.put(T.book, b); } }
    await env.db.replaceAll(T.staff, staff.filter(function (s) { return s.email !== e; }));
    await event('rider', 'Rider ' + (r.name || e) + ' was removed by ' + who.name + (c.net ? ' (unsettled P' + c.net + ')' : ''), ['super'], '', '', [], '', '', who.email);
    try { await env.mail(e, 'Your rider account was removed', 'Hi ' + (r.name || '') + ',\n\nYour Tara Romblon rider account has been removed. Your past deliveries stay on record. If you think this is a mistake, contact Beyond Tech Solutions.'); } catch (x) { }
    return { removed: e, net: c.net };
  };
  /* Riders: profile, driver's license and payout account */
  A.adminSaveRider = async function (p) {
    var who = await auth(p.token, 'super'), r = p.rider || {}, e = low(r.email);
    if (!validEmail(e)) err('Enter a valid email for the rider.');
    if (!str(r.name)) err('Enter the rider\'s name.');
    var all = await staffAll(), old = all.filter(function (s) { return s.email === e; })[0];
    if (old && old.role !== 'rider') err(e + ' already has a ' + (Rules.ROLE_LABEL[old.role] || old.role) + ' account.');
    var rec = old || { id: e, email: e, role: 'rider', bizId: '', tokens: [], sessEpoch: Date.parse(now()), available: false, lastSeen: '', joined: now(), licenseStatus: 'pending' };
    rec.name = str(r.name, 80); rec.phone = str(r.phone, 30);
    ['address', 'town', 'vehicle', 'plate', 'licenseNo', 'licenseExpiry'].forEach(function (k) { if (r[k] != null) rec[k] = str(r[k], 120); });
    if (r.active != null) rec.active = !!r.active; else if (rec.active == null) rec.active = true;
    if (p.licensePhoto) { rec.licenseFile = (await env.files.save(p.licensePhoto, 'license-' + e, true)).id; rec.licenseStatus = 'pending'; }
    if (r.licenseStatus && ['pending', 'verified', 'rejected'].indexOf(r.licenseStatus) >= 0 && r.licenseStatus !== rec.licenseStatus) {
      rec.licenseStatus = r.licenseStatus; rec.licenseNote = str(r.licenseNote, 200); rec.licenseBy = who.email; rec.licenseAt = now();
      await event('rider', "Driver's license " + (rec.licenseStatus === 'verified' ? 'verified' : rec.licenseStatus === 'rejected' ? 'not approved' : 'pending') + ' for ' + rec.name, ['rider:' + e, 'super'], '', '', ['rider:' + e],
        rec.licenseStatus === 'verified' ? 'Your driver\'s license is verified' : 'Update on your driver\'s license', 'Hi ' + rec.name + ', your driver\'s license status is now: ' + rec.licenseStatus + (rec.licenseNote ? ' (' + rec.licenseNote + ')' : '') + '.', who.email);
    }
    await env.db.put(T.staff, rec);
    if (p.bank) await savePayee('rider:' + e, p.bank);
    return { rider: adminStaff(rec) };
  };
  A.adminSaveDiscounts = async function (p) {
    await auth(p.token, 'super'); var seen = {};
    var list = (p.discounts || []).map(function (d) {
      var code = str(d.code, 30).toUpperCase().replace(/\s+/g, '');
      if (!/^[A-Z0-9_-]{3,30}$/.test(code)) err('Codes need 3 to 30 letters or numbers (no spaces): ' + (d.code || '(blank)'));
      if (seen[code]) err(code + ' is listed twice.'); seen[code] = 1;
      var v = +d.value; if (!(v > 0)) err(code + ': enter the discount amount.'); if (d.type !== 'fixed' && v > 100) err(code + ': a percentage can be at most 100.');
      return { id: d.id || env.uuid(), code: code, name: str(d.name, 80), desc: str(d.desc, 240), bizIds: (d.bizIds || []).map(String), type: d.type === 'fixed' ? 'fixed' : 'percent', value: v,
        minOrder: Math.max(0, +d.minOrder || 0), maxDiscount: Math.max(0, +d.maxDiscount || 0), maxUses: Math.max(0, Math.floor(+d.maxUses || 0)), onePerCustomer: !!d.onePerCustomer,
        fundedBy: d.fundedBy === 'tara' ? 'tara' : 'merchant', validFrom: /^\d{4}-\d{2}-\d{2}$/.test(d.validFrom) ? d.validFrom : '', validTo: /^\d{4}-\d{2}-\d{2}$/.test(d.validTo) ? d.validTo : '', active: d.active !== false, created: d.created || now() };
    });
    await env.db.kvPut('discounts', list); return { discounts: list };
  };
  A.adminSavePayee = async function (p) {
    await auth(p.token, 'super'); var party = String(p.party || '');
    if (!/^(biz|rider):.+/.test(party)) err('Choose a business or rider.');
    return { payee: await savePayee(party, p.bank) };
  };
  /* Approve a business (creates it, its listings and its Merchant Admin) or a rider application */
  A.adminApproveApplication = async function (p) {
    var who = await auth(p.token, 'super'), a = await env.db.get(T.app, p.id); if (!a) err('Application not found.');
    if (a.status === 'Approved') err('Already approved.');
    if (a.appType === 'rider') {
      var e = a.email, all = await staffAll(), ex = all.filter(function (s) { return s.email === e; })[0];
      if (ex && ex.role !== 'rider') err(e + ' already has a ' + (Rules.ROLE_LABEL[ex.role] || ex.role) + ' account.');
      var rec = ex || { id: e, email: e, role: 'rider', bizId: '', tokens: [], sessEpoch: Date.parse(now()), available: false, lastSeen: '' };
      Object.assign(rec, { name: a.name, phone: a.phone, address: a.address, town: a.town, vehicle: a.vehicle, plate: a.plate, licenseNo: a.licenseNo, licenseExpiry: a.licenseExpiry || '', licenseFile: a.licenseFile, licenseStatus: p.licenseVerified === false ? 'pending' : 'verified', licenseBy: who.email, licenseAt: now(), active: true, joined: now(), appId: a.id });
      if (a.pw) rec.pw = a.pw;
      await env.db.put(T.staff, rec);
      if (a.bank) await savePayee('rider:' + e, a.bank);
      a.status = 'Approved'; a.decided = now(); a.adminNotes = (a.adminNotes ? a.adminNotes + '\n' : '') + 'Approved as rider'; await env.db.put(T.app, a);
      await event('application', 'Rider approved: ' + a.name, ['super', 'rider:' + e], '', '', ['rider:' + e], 'You are now a delivery rider', 'Hi ' + a.name + ',\n\nYour rider application is approved. Sign in to the Rider app with ' + e + ' and the password you created to start receiving deliveries.' + (env.siteUrl ? '\n\n' + env.siteUrl.replace(/\/+$/, '') + '/rider' : ''), who.email);
      return { rider: adminStaff(rec) };
    }
    var cat = await catalog(true), bid = slug(p.bizId || a.businessName) || env.uuid().slice(0, 8);
    if (cat.businesses.some(function (b) { return b.id === bid; })) err('Business ID "' + bid + '" is already used. Choose another.');
    var type = Rules.BIZ_TYPES.map(function (t) { return t[0]; }).indexOf(p.type) >= 0 ? p.type : 'Stay';
    var pf = p.platformFee || a.platformFee || { type: 'percent', value: 10 }; pf = { type: pf.type === 'fixed' ? 'fixed' : 'percent', value: Math.max(0, +pf.value || 0) };
    var mgrEmail = low(p.managerEmail || a.email), staff = await staffAll();
    if (!validEmail(mgrEmail)) err('Enter a valid Merchant Admin email.');
    var existing = staff.filter(function (s) { return s.email === mgrEmail; })[0];
    if (existing && !isMerchantRole(existing.role)) err(mgrEmail + ' is a ' + (Rules.ROLE_LABEL[existing.role] || existing.role) + ' account. Use another email for the Merchant Admin.');
    cat.businesses.push({ id: bid, name: a.businessName, type: type, town: a.town, email: a.email, phone: a.phone, active: true, platformFee: pf });
    var town = a.town || 'San Agustin', base = { bizId: bid, town: town, photo: '', promoPct: 0 }, cap = Math.max(1, parseInt(a.capacity, 10) || 0);
    if (type === 'Stay') cat.stays.push(Object.assign({ id: bid, name: a.businessName, location: a.address || town + ', Romblon', rate: 0, maxGuests: cap > 1 ? cap : 2, deposit: 0, checkInTime: '2:00 PM', checkOutTime: '12:00 NN', amenities: a.description, active: false }, base));
    if (type === 'Rental') cat.rentals.units.push(Object.assign({ id: bid + '-1', name: a.businessName + ' (Unit 1)', desc: '', dailyRate: 0, hourlyRate: 0, deposit: 0, active: false }, base));
    if (type === 'Food') cat.foods.push({ bizId: bid, storeName: a.businessName, town: town, address: a.address || town + ', Romblon', hours: '', lat: p.lat || 12.57, lng: p.lng || 122.13, open: false,
      deliveryEnabled: true, pickupEnabled: true, codEnabled: true, onlineEnabled: true, matrix: clone((cat.foods[0] && cat.foods[0].matrix) || [{ upToKm: 3, fee: 50 }]), categories: [{ id: 'menu', name: 'Menu' }], items: [] });
    if (type === 'Tour' || type === 'Service') cat.tours.push(Object.assign({ id: bid, category: type === 'Service' ? 'service' : 'tour', name: a.businessName, location: a.address || town + ', Romblon', desc: a.description, rate: 0, rateUnit: 'person', maxPax: cap > 1 ? cap : 10, durationHours: type === 'Service' ? 1 : 4, times: '08:00', deposit: 0, active: false }, base));
    await env.db.kvPut('catalog', cat);
    if (existing) await env.db.put(T.staff, setAccess(existing, accessOf(existing).concat([{ bizId: bid, role: 'manager' }])));
    else await env.db.put(T.staff, setAccess({ id: mgrEmail, email: mgrEmail, name: str(p.managerName || a.contactName, 80), phone: a.phone || '', tokens: [], sessEpoch: Date.parse(now()) }, [{ bizId: bid, role: 'manager' }]));
    if (a.bank) await savePayee('biz:' + bid, a.bank);
    a.status = 'Approved'; a.platformFee = pf; a.bizId = bid; a.decided = now(); a.adminNotes = (a.adminNotes ? a.adminNotes + '\n' : '') + 'Approved as ' + bid; await env.db.put(T.app, a);
    await event('application', 'Business approved: ' + a.businessName + ' (' + type + ')', ['super', 'biz:' + bid], '', bid, ['biz:' + bid], 'Welcome to ' + ((cat.business && cat.business.name) || 'Tara Romblon'),
      'Hi ' + (a.contactName || '') + ',\n\n' + a.businessName + ' is approved. Sign in to the Merchant app with ' + mgrEmail + ' to manage your listings, prices and bookings.' + (env.siteUrl ? '\n\n' + env.siteUrl.replace(/\/+$/, '') + '/merchant' : ''), who.email);
    return { bizId: bid, catalog: cat };
  };
  /* Payouts: net = non-cash collected for the party − platform fees − cash they kept, ± adjustment */
  A.adminPayout = async function (p) {
    var who = await auth(p.token, 'super'), party = String(p.party || ''), cat = await catalog(true), st = settings(cat);
    var isBiz = party.indexOf('biz:') === 0, id = party.slice(party.indexOf(':') + 1);
    if (!/^(biz|rider):.+/.test(party)) err('Choose a business or rider.');
    var refs = p.refs || [], list = (await allBookings()).filter(function (b) { return refs.indexOf(b.ref) >= 0; });
    if (!list.length && !+p.adjustment) err('Choose at least one transaction or enter an adjustment.');
    var lines = [], gross = 0, fees = 0, nonCash = 0, cash = 0, earned = 0, net = 0;
    list.forEach(function (b) {
      var L = Rules.ledger(b, st);
      if (isBiz) { if (b.bizId !== id || !Rules.bizPayable(b)) err(b.ref + ' is not ready for payout.'); gross += L.gross - L.discount; fees += L.fee; nonCash += L.taraBiz; cash += L.cashBiz; net += L.bizNet; lines.push({ ref: b.ref, net: L.bizNet }); }
      else { if (b.rider !== id || !Rules.riderPayable(b)) err(b.ref + ' is not ready for payout.'); earned += L.riderShare; cash += L.riderCash; net += L.riderNet; lines.push({ ref: b.ref, net: L.riderNet }); }
    });
    var adj = Math.round((+p.adjustment || 0) * 100) / 100; net = Math.round((net + adj) * 100) / 100;
    var bank = (await payees())[party] || {}, at = now();
    var po = { id: 'PO-' + env.today().slice(2).replace(/-/g, '') + '-' + env.uuid().replace(/[^a-z0-9]/gi, '').slice(-5).toUpperCase(), party: party, name: isBiz ? bizName(cat, id) : (((await env.db.get(T.staff, id)) || {}).name || id),
      at: at, by: who.email, refs: list.map(function (b) { return b.ref; }), lines: lines, gross: Rules.r2(gross), fees: Rules.r2(fees), nonCash: Rules.r2(nonCash), cash: Rules.r2(cash), earned: Rules.r2(earned), adjustment: adj, adjustmentNote: str(p.adjustmentNote, 200),
      net: net, direction: net >= 0 ? 'pay' : 'collect', bank: cleanBank(bank), method: str(p.method, 60), reference: str(p.reference, 80), note: str(p.note, 300) };
    await env.db.put(T.pay, po);
    for (var i = 0; i < list.length; i++) { var b = list[i]; if (isBiz) { b.bizPaidAt = at; b.bizPayout = po.id; } else { b.riderPaidAt = at; b.riderPayout = po.id; } await env.db.put(T.book, b); }
    var aud = isBiz ? 'biz:' + id : 'rider:' + id, msg = net >= 0 ? 'Payout ' + po.id + ': P' + net + ' sent' + (bank.bank ? ' to ' + bank.bank + ' ' + bank.accountNo : '') : 'Payout ' + po.id + ': P' + (-net) + ' cash collections to remit to ' + ((cat.business && cat.business.name) || 'Tara Romblon');
    await event('payout', msg + ' (' + list.length + ' transaction/s)', [aud, 'super'], '', isBiz ? id : '', [aud], 'Payout statement ' + po.id, msg + '\n\nTransactions: ' + po.refs.join(', ') + (adj ? '\nAdjustment: P' + adj + (po.adjustmentNote ? ' (' + po.adjustmentNote + ')' : '') : '') + (po.reference ? '\nReference: ' + po.reference : ''), who.email);
    return { payout: po };
  };

  /* riders are paid by the platform every N days (Settings → riderPayoutDays): list who is due */
  async function ridersDue() {
    var cat = await catalog(), st = settings(cat), days = +st.riderPayoutDays || 3, t = Date.parse(now()), all = await allBookings(), pays = await env.db.all(T.pay), out = [];
    (await staffAll()).filter(function (r) { return r.role === 'rider'; }).forEach(function (r) {
      var un = all.filter(function (b) { return b.rider === r.email && Rules.riderPayable(b); }); if (!un.length) return;
      var net = Rules.r2(un.reduce(function (s, b) { return s + Rules.ledger(b, st).riderNet; }, 0)); if (!net) return;
      var last = pays.filter(function (p) { return p.party === 'rider:' + r.email; }).map(function (p) { return p.at || p.created || ''; }).sort().pop();
      var from = last || un.map(function (b) { return b.updated || b.created; }).sort()[0];
      if (t - Date.parse(from) >= days * 864e5) out.push({ email: r.email, name: r.name || r.email, net: net, n: un.length });
    });
    return out;
  }
  /* merchants are paid the next day: everything Completed before today (Philippine time) and not yet paid out */
  async function merchantsDue() {
    var cat = await catalog(), st = settings(cat), td = env.today(), pay = await payees(), all = await allBookings(), out = [];
    var doneDay = function (b) { var h = (b.history || []).filter(function (x) { return x.status === 'Completed'; }).pop(); var at = (h && h.at) || b.updated || b.created; return new Date(Date.parse(at) + 8 * 3600e3).toISOString().slice(0, 10); };
    cat.businesses.forEach(function (z) {
      var l = all.filter(function (b) { return b.bizId === z.id && Rules.bizPayable(b) && doneDay(b) < td; }); if (!l.length) return;
      var net = Rules.r2(l.reduce(function (s, b) { return s + Rules.ledger(b, st).bizNet; }, 0)); if (!net) return;
      var bk = pay['biz:' + z.id] || {};
      out.push({ bizId: z.id, name: z.name, net: net, n: l.length, refs: l.map(function (b) { return b.ref; }), from: l.map(doneDay).sort()[0], to: l.map(doneDay).sort().pop(), bank: { accountName: bk.accountName || '', bank: bk.bank || '', accountNo: bk.accountNo || '' } });
    });
    return out;
  }
  A.merchantsDue = async function (p) { await auth(p.token, 'super'); return { due: await merchantsDue(), today: env.today() }; };
  A.ridersDue = async function (p) { await auth(p.token, 'super'); return { due: await ridersDue() }; };
  return {
    icsFeed: icsFeed,
    handle: async function (action, p) { var h = A[action]; if (!h) err('Unknown action: ' + action); reqBiz = String((p && p.biz) || ''); return await h(p || {}); },
    /* Confirms HitPay payments found by the webhook or the daily check, and expires unpaid online bookings after 60 minutes */
    paymentWebhook: async function (ref) { var bs = (await allBookings()).filter(function (b) { return b.group === ref || b.ref === ref; }); if (bs.length) return await checkHitpay(bs[0].group); return false; },
    reconcile: async function () {
      try { var md = (await merchantsDue()).filter(function (m) { return m.net > 0; }), mk = 'merchantsdue_' + env.today(); if (md.length && !(await env.cache.get(mk))) { await env.cache.put(mk, '1', 86400); var tot = Rules.r2(md.reduce(function (s, m) { return s + m.net; }, 0)); await event('payout', 'Merchant payouts due today: ' + md.map(function (m) { return m.name + ' P' + m.net; }).join(', ') + ' (total P' + tot + '). Download the CSV in Super Admin → Payouts.', ['super'], '', '', ['super'], 'Merchant payouts due today (P' + tot + ')', md.map(function (m) { return m.name + ': P' + m.net + ' (' + m.n + ' transactions) -> ' + (m.bank.bank ? m.bank.bank + ' ' + m.bank.accountNo + ' (' + m.bank.accountName + ')' : 'NO PAYOUT ACCOUNT SAVED'); }).join('\n') + '\n\nOpen Super Admin → Payouts to download the CSV and record the payouts.', ''); } } catch (x) { }
      try { var due = await ridersDue(), dk = 'ridersdue_' + env.today(); if (due.length && !(await env.cache.get(dk))) { await env.cache.put(dk, '1', 86400); await event('payout', 'Rider settlements due: ' + due.map(function (r) { return r.name + (r.net < 0 ? ' owes P' + (-r.net) : ' P' + r.net); }).join(', ') + '. Pay them in Super Admin → Payouts.', ['super'], '', '', ['super'], 'Rider payouts due (' + due.length + ')', due.map(function (r) { return r.name + ': P' + r.net + ' (' + r.n + ' deliveries)'; }).join('\n') + '\n\nRiders are paid every ' + (+settings(await catalog()).riderPayoutDays || 3) + ' days. Open Super Admin → Payouts.', ''); } } catch (x) { }
      var seen = {}, list = (await allBookings()).filter(function (b) { return b.status === 'Awaiting Payment' && b.payMethod === 'online'; });
      for (var i = 0; i < list.length; i++) {
        var b = list[i]; if (seen[b.group]) continue; seen[b.group] = 1;
        var paid = b.hitpayId ? await checkHitpay(b.group) : false;
        if (!paid && b.hitpayId && (Date.parse(now()) - Date.parse(b.created)) / 6e4 > 60) {
          var grp = (await allBookings()).filter(function (x) { return x.group === b.group && x.status === 'Awaiting Payment'; });
          for (var j = 0; j < grp.length; j++) await setStatus({ role: 'system', name: 'System', email: '' }, grp[j].ref, 'Expired', 'Unpaid after 60 minutes');
        }
      }
    },
    seedStaff: async function (supers) {
      var list = await staffAll(); if (list.some(function (s) { return s.role === 'super'; })) return;
      for (var i = 0; i < supers.length; i++) { var e = low(supers[i]); if (e) await env.db.put(T.staff, { id: e, email: e, name: '', role: 'super', bizId: '', tokens: [], sessEpoch: Date.parse(now()) }); }
    }
  };
}
/* ===== END CORE ===== */
