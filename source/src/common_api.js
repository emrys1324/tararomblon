
let CAT = clone(DEFAULT_CATALOG);

/* ================= API (Vercel /api backed by Supabase, or the same core running in the browser for demo mode) ================= */
const DEMO = !CONFIG.apiUrl;
let _demoQ = Promise.resolve();
async function api(action, data) {
  if (window.API_BIZ && data && data.token && data.biz == null) data = Object.assign({}, data, { biz: window.API_BIZ }); /* Merchant app: the business being worked on */
  if (DEMO) { const run = async () => { DemoStore.load(); try { const r = await demoCore().handle(action, JSON.parse(JSON.stringify(data || {}))); return { ok: true, ...JSON.parse(JSON.stringify(r)) }; } finally { DemoStore.save(); } }; const p = _demoQ.then(run, run); _demoQ = p.catch(() => {}); if (action === 'getCatalog') p.then(j => j && j.catalog && setSiteIcon(j.catalog.settings && j.catalog.settings.siteIcon)).catch(() => {}); return p; }
  const r = await fetch(CONFIG.apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...(data || {}) }) });
  let j; try { j = await r.json(); if (action === 'getCatalog' && j && j.maps) window.MAPCFG = j.maps; if (action === 'getCatalog' && j && j.google) window.GOOGLE_CLIENT = j.google; if (action === 'getCatalog' && j && j.catalog) setSiteIcon(j.catalog.settings && j.catalog.settings.siteIcon); } catch (e) { throw new Error(r.status === 413 ? 'That photo is too large. Try a smaller one.' : 'Could not reach the server. Check your connection and try again.'); }
  if (!j.ok) throw new Error(j.error || 'Something went wrong.');
  return j;
}
const DemoStore = {
  KEY: 'tr8_demo', d: null,
  load() { this.d = store(this.KEY); if (!this.d) { this.d = { tables: {}, kv: {}, files: {}, cache: {} }; demoSeed(this.d); store(this.KEY, this.d); } },
  save() { try { localStorage.setItem(this.KEY, JSON.stringify(this.d)); } catch (e) { } }
};
function demoEnv() {
  const D = () => DemoStore.d, tb = t => (D().tables[t] = D().tables[t] || {});
  return {
    demo: true, defaultCatalog: DEFAULT_CATALOG, notifyEmail: '', siteUrl: '',
    now: () => new Date().toISOString(), today: () => today, uuid: () => (crypto.randomUUID ? crypto.randomUUID() : uid() + uid() + uid()),
    db: {
      all: t => Object.values(tb(t)), get: (t, id) => tb(t)[id] || null, put: (t, o) => { tb(t)[o.id] = o; },
      tail: (t, n) => Object.values(tb(t)).slice(-n), replaceAll: (t, list) => { D().tables[t] = {}; list.forEach(o => tb(t)[o.id] = o); },
      kvGet: k => D().kv[k] || null, kvPut: (k, v) => { D().kv[k] = v; }
    },
    cache: { get: k => { const c = D().cache[k]; return c && c.exp > Date.now() ? c.v : null; }, put: (k, v, sec) => { D().cache[k] = { v, exp: Date.now() + sec * 1000 }; }, remove: k => { delete D().cache[k]; } },
    files: { save: (dataUrl, name, priv) => { const id = 'file-' + uid() + uid(); D().files[id] = dataUrl; return { id, url: dataUrl }; }, read: id => D().files[id] || '' },
    hitpay: { create: o => ({ id: 'demo-' + o.ref, url: 'demo' }), status: () => 'pending' },
    mail: () => { }
  };
}
let _core = null; function demoCore() { return _core || (_core = createCore(demoEnv())); }

/* Sample data so every app has something to show in demo mode */
function demoSeed(d) {
  const T = (t, o) => { (d.tables[t] = d.tables[t] || {})[o.id] = o; };
  const at = (days, h, m) => { const x = new Date(); x.setDate(x.getDate() + days); x.setHours(h, m || 0, 0, 0); return x.toISOString(); };
  const idSvg = n => 'data:image/svg+xml;base64,' + btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="480" height="300"><rect width="480" height="300" rx="16" fill="#e4eaf3"/><rect x="24" y="24" width="120" height="150" rx="8" fill="#13305a"/><text x="170" y="60" font-family="Arial" font-size="22" fill="#13305a">REPUBLIC OF THE PHILIPPINES</text><text x="170" y="100" font-family="Arial" font-size="18" fill="#333">Sample ID (demo)</text><text x="170" y="140" font-family="Arial" font-size="24" font-weight="bold" fill="#0f1f38">${n}</text></svg>`);
  [['admin1@mjv.demo', 'MJV Admin 1', 'super', ''], ['admin2@mjv.demo', 'MJV Admin 2', 'super', ''], ['admin@pahuway.demo', 'Pahuway Admin', 'manager', 'pahuway'], ['staff@pahuway.demo', 'Pahuway Staff', 'staff', 'pahuway'],
   ['admin@baybayin.demo', 'Baybayin Admin', 'manager', 'baybayin'], ['staff@baybayin.demo', 'Baybayin Staff', 'staff', 'baybayin'], ['admin@hiraya.demo', 'Hiraya Admin', 'manager', 'hiraya'], ['admin@casados.demo', 'Casa Dos Admin', 'manager', 'casados'],
   ['admin@kusina.demo', 'Kusina Admin', 'manager', 'kusina'], ['cashier@pahuway.demo', 'Pahuway Cashier', 'staff', 'pahuway'],
   ['rider1@rider.demo', 'Jun Rider', 'rider', ''], ['rider2@rider.demo', 'Rey Rider', 'rider', '']].forEach(([email, name, role, bizId], i) => T('staff', { id: email, email, name, role, bizId, phone: '0917 555 01' + (10 + i), tokens: [], available: email === 'rider1@rider.demo', lastSeen: '' }));
  const lic = n => 'data:image/svg+xml;base64,' + btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="480" height="300"><rect width="480" height="300" rx="16" fill="#fff4e6"/><rect x="24" y="24" width="120" height="150" rx="8" fill="#e8742c"/><text x="170" y="60" font-family="Arial" font-size="20" fill="#13305a">LAND TRANSPORTATION OFFICE</text><text x="170" y="100" font-family="Arial" font-size="18" fill="#333">Driver's License (demo)</text><text x="170" y="140" font-family="Arial" font-size="24" font-weight="bold" fill="#0f1f38">${n}</text></svg>`);
  d.files['file-lic-1'] = lic('Jun Rider'); d.files['file-lic-2'] = lic('Rey Rider'); d.files['file-lic-3'] = lic('Paolo Fabila');
  Object.assign(d.tables.staff['rider1@rider.demo'], { address: 'Brgy. Dubduban, San Agustin', town: 'San Agustin', vehicle: 'Honda Click 125', plate: '123 ABC', licenseNo: 'N01-23-456789', licenseExpiry: addDays(today, 400), licenseFile: 'file-lic-1', licenseStatus: 'verified', active: true, joined: at(-60, 9) });
  Object.assign(d.tables.staff['rider2@rider.demo'], { address: 'Brgy. Poblacion, San Agustin', town: 'San Agustin', vehicle: 'Yamaha Mio', plate: '456 DEF', licenseNo: 'N02-11-223344', licenseExpiry: addDays(today, 200), licenseFile: 'file-lic-2', licenseStatus: 'pending', active: true, joined: at(-3, 9) });
  d.kv.payees = { 'biz:pahuway': { accountName: 'MJV Services OPC', bank: 'BPI', accountNo: '1234-5678-90' }, 'biz:baybayin': { accountName: 'MJV Services OPC', bank: 'BPI', accountNo: '1234-5678-90' },
    'biz:hiraya': { accountName: 'Hiraya Beach House', bank: 'BDO', accountNo: '0011-2233-4455' }, 'biz:kusina': { accountName: 'Kusina sa Hiraya', bank: 'GCash', accountNo: '0917 555 0199' }, 'rider:rider1@rider.demo': { accountName: 'Jun Rider', bank: 'GCash', accountNo: '0917 555 0118' } };
  const custs = [{ email: 'ana.reyes@email.demo', name: 'Ana Reyes', phone: '0917 555 0101', address: 'Brgy. Poblacion, San Agustin, Romblon', v: 'verified' },
    { email: 'mark.santos@email.demo', name: 'Mark Santos', phone: '0998 555 0202', address: 'Makati City, Metro Manila', v: 'verified' },
    { email: 'joy.mendoza@email.demo', name: 'Joy Mendoza', phone: '0927 555 0303', address: 'Odiongan, Romblon', v: 'pending' }];
  custs.forEach(c => { const f = 'file-id-' + c.name.split(' ')[0]; d.files[f] = idSvg(c.name); T('customers', { id: c.email, email: c.email, name: c.name, phone: c.phone, address: c.address, created: at(-20, 9), tokens: [], verify: { status: c.v, idType: "Driver's license", file: f, submitted: at(c.v === 'pending' ? 0 : -15, 8) } }); });
  const cat = DEFAULT_CATALOG, biz = id => cat.businesses.find(b => b.id === id);
  let n = 0;
  const mk = (c, kind, bizId, q, o) => {
    const ref = 'TR-' + String(today).slice(2).replace(/-/g, '') + '-' + 'D' + (++n) + 'X' + n;
    const b = { id: ref, ref, group: o.group || 'G-' + ref.slice(3), created: o.created, updated: o.created, kind, bizId, email: c.email, customer: { name: c.name, phone: c.phone, address: c.address }, lines: q.lines, quote: q,
      payMethod: o.pay, fulfillment: o.ful || '', landmark: o.landmark || '', lat: null, lng: null, notes: o.notes || '', dueNow: o.due != null ? o.due : (kind === 'food' ? (Rules.NONCASH.includes(o.pay) ? q.total : 0) : q.dueNow),
      status: o.status, payStatus: o.payStatus, fee: Rules.feeFor(biz(bizId), kind === 'food' ? q.subtotal : q.total), discount: o.discount || 0, idFile: '', proofFile: o.proof || '', rider: o.rider || '', riderAccepted: !!o.rider, riderPaidAt: o.riderPaidAt || '',
      history: [{ at: o.created, status: o.status, by: 'Demo data', role: 'system' }] };
    T('bookings', b); return b;
  };
  const day = k => addDays(today, k), [ana, mark] = custs;
  const qs = (l) => Pricing.booking(cat, [l]), qf = p => Pricing.food(cat, p);
  const g1 = 'G-DEMO1';
  const b1 = mk(mark, 'stay', 'hiraya', qs({ type: 'stay', itemId: 'hiraya', checkin: day(6), checkout: day(9), guests: 6 }), { group: g1, created: at(-2, 15), pay: 'online', status: 'Accepted', payStatus: 'Paid', notes: 'Arriving on the 9 AM boat.' });
  mk(mark, 'rental', 'baybayin', qs({ type: 'rental', itemId: 'nmax', start: day(6) + 'T10:00', end: day(8) + 'T13:00', helmets: 2, pickup: 'hiraya', ret: 'hiraya' }), { group: g1, created: at(-2, 15), pay: 'online', status: 'Payment Confirmed', payStatus: 'Paid' });
  mk(ana, 'rental', 'baybayin', qs({ type: 'rental', itemId: 'click1', start: day(0) + 'T08:00', end: day(1) + 'T10:00', helmets: 1, pickup: 'office', ret: 'office' }), { created: at(-1, 10), pay: 'online', status: 'Order Picked Up', payStatus: 'Paid' });
  d.files['file-proof-1'] = idSvg('GCash receipt P2,500');
  mk(ana, 'stay', 'casados', qs({ type: 'stay', itemId: 'casados1', checkin: day(12), checkout: day(14), guests: 2 }), { created: at(0, 7), pay: 'transfer', status: 'Awaiting Payment', payStatus: 'Pending', proof: 'file-proof-1' });
  const f1 = mk(ana, 'food', 'pahuway', qf({ lines: [{ itemId: 'latte', qty: 2, addons: ['temp:iced', 'extras:shot'] }, { itemId: 'chocomallow', qty: 1, addons: [] }], fulfillment: 'delivery', band: 1 }), { created: at(0, 8, 5), pay: 'cod', ful: 'delivery', landmark: 'Blue gate near the chapel', status: 'Preparing', payStatus: 'Unpaid', rider: 'rider1@rider.demo' });
  mk(mark, 'food', 'pahuway', qf({ lines: [{ itemId: 'spanish', qty: 3, addons: ['temp:hot'] }], fulfillment: 'pickup' }), { created: at(-1, 16), pay: 'online', ful: 'pickup', status: 'Completed', payStatus: 'Paid' });
  mk(ana, 'food', 'pahuway', qf({ lines: [{ itemId: 'americano', qty: 2, addons: ['temp:hot'] }, { itemId: 'cookies', qty: 1, addons: ['size:reg'] }], fulfillment: 'delivery', band: 0 }), { created: at(-1, 9), pay: 'cod', ful: 'delivery', landmark: 'Dubduban chapel', status: 'Completed', payStatus: 'Paid', rider: 'rider1@rider.demo' });
  mk(mark, 'food', 'pahuway', qf({ lines: [{ itemId: 'strawberry', qty: 2, addons: ['size:reg', 'extras:cream'] }], fulfillment: 'delivery', band: 2 }), { created: at(0, 8, 40), pay: 'cod', ful: 'delivery', landmark: 'Hiraya Beach House, Cabolutan', status: 'New', payStatus: 'Unpaid' });
  mk(ana, 'food', 'pahuway', qf({ lines: [{ itemId: 'latte', qty: 1, addons: ['temp:hot'] }], fulfillment: 'pickup' }), { created: at(0, 7, 30), pay: 'pickup', ful: 'pickup', status: 'Payment Collected', payStatus: 'Paid' });
  mk(mark, 'food', 'kusina', qf({ bizId: 'kusina', lines: [{ itemId: 'tonkotsu', qty: 2, addons: ['spice:med', 'extras:egg'] }, { itemId: 'gyoza', qty: 1, addons: [] }], fulfillment: 'delivery', band: 1 }), { created: at(-1, 19), pay: 'online', ful: 'delivery', landmark: 'Hiraya Beach House', status: 'Completed', payStatus: 'Paid', rider: 'rider2@rider.demo' });
  mk(ana, 'stay', 'casados', qs({ type: 'stay', itemId: 'casados2', checkin: day(-6), checkout: day(-4), guests: 2 }), { created: at(-12, 10), pay: 'online', status: 'Completed', payStatus: 'Paid' });
  const th = (id, type, ref, bizId, c, msgs) => { T('threads', { id, type, ref, bizId, email: c.email, name: c.name, created: msgs[0][2], updated: msgs[msgs.length - 1][2], last: { text: msgs[msgs.length - 1][1], name: msgs[msgs.length - 1][0], at: msgs[msgs.length - 1][2] } });
    msgs.forEach(([name, text, when, role], i) => T('messages', { id: id + '-' + i, threadId: id, at: when, role, name, email: role === 'customer' ? c.email : '', text })); };
  th('T-' + b1.ref, 'order', b1.ref, 'hiraya', mark, [['Mark Santos', 'Hi! Can we request an early check-in around 11 AM? We will be 6 adults.', at(-1, 9), 'customer'], ['Hiraya Admin', 'Hi Mark! 11 AM works. We will have the house ready. See you!', at(-1, 10), 'manager']]);
  th('T-' + f1.ref, 'order', f1.ref, 'pahuway', ana, [['Ana Reyes', 'Please call when you are near the blue gate. Thanks!', at(0, 8, 10), 'customer']]);
  th('I-' + ana.email + '-hiraya', 'inquiry', '', 'hiraya', ana, [['Ana Reyes', 'Hello, is the beach house pet-friendly? We have a small dog.', at(0, 7, 50), 'customer']]);
  const ev = (type, text, aud, ref, bizId, w) => T('events', { id: 'ev-' + (++n), at: w, type, text, aud, ref: ref || '', bizId: bizId || '' });
  ev('new', 'New order ' + f1.ref + ' for Pahuway Café from Ana Reyes', ['biz:pahuway', 'super'], f1.ref, 'pahuway', at(0, 8, 5));
  ev('message', 'Ana Reyes - Inquiry / Hiraya Beach House: is the beach house pet-friendly?', ['biz:hiraya', 'super'], '', 'hiraya', at(0, 7, 50));
  ev('assigned', 'Delivery ' + f1.ref + ' assigned to you - Blue gate near the chapel', ['rider:rider1@rider.demo'], f1.ref, 'pahuway', at(0, 8, 6));
  ev('verification', 'Joy Mendoza submitted an ID for verification', ['super'], '', '', at(0, 8));
  T('applications', { id: 'app-1', created: at(-1, 14), status: 'New', adminNotes: '', platformFee: { type: 'percent', value: 10 }, businessName: 'Looc Bay Homestay', type: 'Stay', town: 'Looc', address: 'Brgy. Poblacion, Looc', contactName: 'Liza Fetalvero', position: 'Owner', phone: '0919 555 0303', email: 'liza@homestay.demo', website: 'facebook.com/loocbayhomestay', registration: 'DTI 1234567', permits: 'Yes, current', capacity: '3 rooms, up to 10 guests', priceRange: 'P1,200 - P2,500 / night', description: 'Family-run homestay by the bay, 5 minutes from the marine sanctuary.', startDate: day(30), heardFrom: 'Facebook', photos: [], appType: 'business', bank: { accountName: 'Liza Fetalvero', bank: 'Landbank', accountNo: '0123-4567-89' } });
  [[-30, 'signup', 20, 'Welcome bonus'], [-30, 'earn', 18, 'Earned on earlier orders'], [-10, 'earn', 22, 'Earned on earlier orders'], [-1, 'earn', 7, 'Earned on ' + 'TR-demo']].forEach(([dd, type, pts, note], i) => T('points', { id: 'pt-' + i, at: at(dd, 10), email: ana.email, phone: Rules.mobile(ana.phone), name: ana.name, bizId: 'pahuway', points: pts, type, ref: '', note }));
  d.kv.discounts = [{ id: 'dc-1', code: 'WELCOME10', name: 'Welcome to Romblon', desc: '10% off your first order or booking, up to P300', bizIds: [], type: 'percent', value: 10, minOrder: 0, maxDiscount: 300, maxUses: 0, onePerCustomer: true, fundedBy: 'tara', validFrom: '', validTo: '', active: true, created: at(-5, 9) },
    { id: 'dc-2', code: 'KAPE20', name: 'Coffee break', desc: 'P20 off Pahuway Café orders of P150 or more', bizIds: ['pahuway'], type: 'fixed', value: 20, minOrder: 150, maxDiscount: 0, maxUses: 100, onePerCustomer: false, fundedBy: 'merchant', validFrom: '', validTo: '', active: true, created: at(-5, 9) }];
  T('applications', { id: 'app-2', appType: 'rider', created: at(0, 9, 20), status: 'New', adminNotes: '', name: 'Paolo Fabila', phone: '0920 555 0404', email: 'paolo@rider.demo', address: 'Brgy. Cabolutan, San Agustin', town: 'San Agustin', vehicle: 'Honda XRM 125', plate: '789 GHI', licenseNo: 'N03-22-998877', licenseExpiry: day(500), experience: '2 years delivering for a local grocery.', availability: 'Weekdays 10 AM - 8 PM', heardFrom: 'Friend', licenseFile: 'file-lic-3', bank: { accountName: 'Paolo Fabila', bank: 'GCash', accountNo: '0920 555 0404' }, photos: [] });
  T('applications', { id: 'app-3', appType: 'business', created: at(0, 10), status: 'New', adminNotes: '', platformFee: { type: 'percent', value: 10 }, businessName: 'Cantingas River Tours', type: 'Tour', town: 'San Jose', address: 'Brgy. Busay, San Jose', contactName: 'Lito Gadon', position: 'Owner', phone: '0918 555 0505', email: 'lito@tours.demo', website: '', registration: 'DTI 7654321', permits: 'BP-2026-0112', capacity: '12', priceRange: 'P800 / person', description: 'Half-day kayak and river tour with local guide, snacks included.', startDate: day(14), heardFrom: 'Facebook', photos: [], bank: { accountName: 'Lito Gadon', bank: 'GCash', accountNo: '0918 555 0505' } });
}

/* ================= SHEETS, CSV & SHARED UI ================= */
/* Website icon from Super Admin → Settings (browser tab + home-screen icon) */
function setSiteIcon(url) { if (!url) return; ['icon', 'apple-touch-icon'].forEach(r => { let l = document.querySelector(`link[rel="${r}"]`); if (!l) { l = document.createElement('link'); l.rel = r; document.head.appendChild(l); } l.href = url; }); }
/* Square PNG for app icons: the picture is fitted inside a square (nothing cut off) on the chosen background */
function squareIcon(file, size, bg) {
  return new Promise((ok, no) => { const r = new FileReader(); r.onerror = () => no(new Error('Could not read that file.')); r.onload = () => { const im = new Image(); im.onerror = () => no(new Error('Please choose a PNG or JPG image.')); im.onload = () => {
    const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d'); if (bg) { x.fillStyle = bg; x.fillRect(0, 0, size, size); }
    const k = Math.min(size / im.width, size / im.height), w = im.width * k, h = im.height * k; x.drawImage(im, (size - w) / 2, (size - h) / 2, w, h); ok(c.toDataURL('image/png')); }; im.src = r.result; }; r.readAsDataURL(file); });
}
function openSheet(html) { $('#sheet').innerHTML = `<button class="sx" onclick="closeSheet()" aria-label="Close">${ic('x')}</button>` + html; $('#ov').classList.add('show'); $('#sheet').scrollTop = 0; }
function closeSheet() { $('#ov').classList.remove('show'); if (window._map) { try { window._map.remove(); } catch (e) { } window._map = null; } }
document.addEventListener('click', e => { if (e.target.id === 'ov') closeSheet(); });
const bizName = id => ((CAT.businesses || []).find(b => b.id === id) || {}).name || id;
function csvOf(rows) { return rows.map(r => r.map(v => { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(',')).join('\n'); }
async function downloadCSV(name, rows) {
  const csv = '\ufeff' + csvOf(rows);
  if (window.claude && window.claude.use) {   // inside the Claude artifact preview
    try { const d = await window.claude.use('downloads'); if (d) { await d.save({ filename: name, data: csv }); return; } } catch (e) { toast('Download cancelled'); return; }
  }
  try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = name; document.body.appendChild(a); a.click(); a.remove(); toast('Downloading ' + name); }
  catch (e) { copyText(csv, 'Download blocked here — CSV copied instead'); }
}
function copyText(t, msg) { (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast(msg || 'Copied'), () => { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast(msg || 'Copied'); } catch (e) { toast('Copy not available'); } ta.remove(); }); }
function bookingDates(l) { return l.type === 'stay' ? fmtD(l.start) + ' to ' + fmtD(l.end) + ' · ' + l.nights + ' night' + (l.nights > 1 ? 's' : '') : l.type === 'rental' ? fmtDT(l.start) + ' to ' + fmtDT(l.end) + ' · ' + l.days + 'd' + (l.extraHours ? ' ' + l.extraHours + 'h' : '') : l.type === 'tour' ? fmtDT(l.start) + ' to ' + fmtT(l.end.slice(11, 16)) : ''; }
function lineText(l) { return l.type ? l.label + ' - ' + bookingDates(l) + (l.type === 'rental' ? ' · ' + l.helmets + ' helmet(s) · ' + l.pickup + ' → ' + l.ret : l.type === 'tour' ? ' · ' + l.pax + (l.category === 'service' ? ' person(s)' : ' guest(s)') : ' · ' + l.guests + ' guest(s)') : l.qty + '× ' + l.name + (l.addons && l.addons.length ? ' (' + l.addons.join(', ') + ')' : '') + (l.note ? ' “' + l.note + '”' : ''); }

/* Staff sign-in (Super Admin, merchant and rider apps) */
function staffLogin(portal, onDone) {
  const root = $('#root'), title = { admin: 'Super Admin', merchant: 'Merchant app', rider: 'Rider app' }[portal], roles = { admin: ['super'], merchant: ['manager', 'staff'], rider: ['rider'] }[portal];
  let demoList = []; if (DEMO) { DemoStore.load(); demoList = Object.values(DemoStore.d.tables.staff || {}).filter(s => roles.indexOf(s.role) >= 0); }
  root.innerHTML = `<div class="acard login"><div class="lmark">${ic(portal === 'admin' ? 'shield' : portal === 'rider' ? 'bike' : 'store', 34)}</div><h2>${title}</h2><p class="meta">Sign in with your registered email. We'll send a 6-digit code.</p>
    <div class="field mt"><label>Email</label><input id="lgE" type="email" autocomplete="email"></div><div class="err" id="lgErr"></div>
    <button class="btn navy full mt" id="lgBtn">Send code</button>
    ${DEMO ? `<div class="warn mt"><b>Demo accounts</b> (tap to fill)<div class="demoacc">${demoList.map(s => `<button onclick="$('#lgE').value='${s.email}'">${s.email}<small>${Rules.ROLE_LABEL[s.role]}${s.bizId ? ' · ' + esc(bizName(s.bizId)) : ''}</small></button>`).join('')}</div></div>` : ''}</div>`;
  $('#lgBtn').onclick = async () => {
    const email = $('#lgE').value.trim().toLowerCase(); if (!validEmail(email)) { $('#lgErr').textContent = 'Enter a valid email.'; return; }
    loading(true, 'Sending code…');
    try {
      const r = await api('staffSendOtp', { email, portal }); loading(false);
      root.querySelector('.login').innerHTML = `<div class="lmark">${ic('mail', 34)}</div><h2>Enter your code</h2><p class="meta">Sent to <b>${esc(email)}</b>.</p>${r.demoCode ? `<div class="warn">Demo code: <b>${r.demoCode}</b></div>` : ''}
        <div class="field mt"><input id="lgC" class="otp" inputmode="numeric" maxlength="6" autocomplete="one-time-code" value="${r.demoCode || ''}"></div><div class="err" id="lgErr"></div><button class="btn navy full mt" id="lgV">Verify</button>`;
      $('#lgV').onclick = async () => {
        loading(true, 'Verifying…');
        try { const v = await api('staffVerifyOtp', { email, code: $('#lgC').value.trim() }); store('tr5_staff_' + portal, { token: v.token, me: v.me }); loading(false); onDone({ token: v.token, me: v.me }); }
        catch (x) { loading(false); $('#lgErr').textContent = x.message; }
      };
    } catch (x) { loading(false); $('#lgErr').textContent = x.message; }
  };
}
function loadMap(elId, lat, lng, ready, failMsg) {
  const fail = () => { const m = document.getElementById(elId); if (m) m.outerHTML = '<div class="warn">' + (failMsg || 'The map could not load here. Tap <b>Use my current location</b> below to set your delivery location.') + '</div>'; };
  const init = () => {
    if (!window.L || !document.getElementById(elId)) return fail();
    const map = L.map(elId).setView([lat, lng], 14); window._map = map;
    let tileErr = 0;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).on('tileerror', () => { if (++tileErr === 4) toast('Map tiles are not loading — you can tap Use my current location instead.'); }).addTo(map);
    ready(map); setTimeout(() => map.invalidateSize(), 100);
  };
  if (window.L) return init();
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'; document.head.appendChild(css);
  const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'; s.onload = init; s.onerror = fail; document.head.appendChild(s);
}

function resizeImage(file, max) {
  return new Promise((res, rej) => {
    const r = new FileReader(); r.onerror = rej;
    r.onload = () => { const img = new Image(); img.onerror = () => rej(new Error('Not an image')); img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.8)); }; img.src = r.result; };
    r.readAsDataURL(file);
  });
}
