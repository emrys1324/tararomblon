/* ================= SETTINGS — edit these ================= */
const CONFIG = {
  // '/api' when deployed on Vercel with Supabase (see README). Leave '' to run in demo mode.
  apiUrl: '',
  // Page names on your site (Vercel serves /merchant and /admin from merchant.html and admin.html)
  customerUrl: 'index.html', merchantUrl: 'merchant.html'
};

/* ================= DEFAULT CATALOG (used until a Super Admin saves the real one) ================= */
const DEFAULT_CATALOG = {
  business: {
    name: 'Tara Romblon', phone: '', email: 'mjvservicesopc@gmail.com', facebook: '',
    downpaymentPct: 50,
    refundPolicy:
`• A 50% downpayment is required to confirm stays and scooter rentals. The balance is paid on check-in or pick-up.
• Cancel 7 or more days before check-in / pick-up: full refund of the downpayment.
• Cancel 3–6 days before: 50% of the downpayment is refunded.
• Cancel less than 3 days before, or no-show: the downpayment is non-refundable.
• Weather cancellations (PAGASA storm signal or Coast Guard no-sail advisory): full refund or free rebooking.
• Approved refunds are returned to the original payment method within 7 business days.`,
    rentalTerms:
`• Present a valid driver's license (with motorcycle restriction) and one valid ID at pick-up.
• The security deposit is paid at pick-up and returned in full when the scooter is returned in good condition.
• Fuel is not included. Return the scooter with the same fuel level.
• The renter is responsible for damage, loss and traffic violations during the rental.
• Rental agreement is with MJV Services OPC.`
  },
  settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
  businesses: [
    { id: 'hiraya', name: 'Hiraya Beach House', type: 'Stay', town: 'San Agustin', email: '', phone: '', active: true, platformFee: { type: 'percent', value: 10 } },
    { id: 'casados', name: 'Casa Dos', type: 'Stay', town: 'San Agustin', email: '', phone: '', active: true, platformFee: { type: 'percent', value: 10 } },
    { id: 'baybayin', name: 'Baybayin Vehicle Rental', type: 'Rental', town: 'San Agustin', email: 'mjvservicesopc@gmail.com', phone: '', active: true, platformFee: { type: 'percent', value: 8 } },
    { id: 'pahuway', name: 'Pahuway Café', type: 'Food', town: 'San Agustin', email: 'mjvservicesopc@gmail.com', phone: '', active: true, platformFee: { type: 'fixed', value: 10 }, acceptCodes: true, loyverseAllowed: true,
      address: 'Sitio Sawang, Brgy. Dubduban, San Agustin, Romblon', paymentMethods: ['Cash', 'GCash', 'Maya', 'HitPay online'],
      hours: { mon: { open: '07:00', close: '21:00' }, tue: { open: '07:00', close: '21:00' }, wed: { open: '07:00', close: '21:00' }, thu: { open: '07:00', close: '21:00' }, fri: { open: '07:00', close: '21:00' }, sat: { open: '07:00', close: '21:00' }, sun: { open: '07:00', close: '21:00' } },
      rewards: { enabled: true, loyverse: true, pesoPerPoint: 20, pointValue: 1, signupBonus: 20, birthdayBonus: 50, minRedeem: 50, redeemStep: 10 } },
    { id: 'kusina', name: 'Kusina sa Hiraya', type: 'Food', town: 'San Agustin', email: '', phone: '', active: true, platformFee: { type: 'percent', value: 10 } }
  ],
  stays: [
    { id: 'hiraya', bizId: 'hiraya', name: 'Hiraya Beach House', town: 'San Agustin', location: 'Cabolutan, San Agustin, Romblon', rate: 5000, maxGuests: 8, checkInTime: '2:00 PM', checkOutTime: '12:00 NN', photo: '', active: true,
      amenities: 'Beachfront house with direct beach access\nAir-conditioned bedrooms\nPrivate bathrooms with hot shower\nKitchen access and dining area\nWi-Fi\nFree parking\nKusina sa Hiraya on-site (ramen, gyoza, dimsum)' },
    { id: 'casados1', bizId: 'casados', name: 'Casa Dos (Unit 1)', town: 'San Agustin', location: 'San Agustin, Romblon', rate: 2500, maxGuests: 4, checkInTime: '2:00 PM', checkOutTime: '12:00 NN', photo: '', active: true,
      amenities: 'Air-conditioned bedroom\nQueen bed + sofa bed\nPrivate bathroom with hot shower\nKitchenette with fridge and cooking basics\nWi-Fi and smart TV\nTowels and toiletries' },
    { id: 'casados2', bizId: 'casados', name: 'Casa Dos (Unit 2)', town: 'San Agustin', location: 'San Agustin, Romblon', rate: 2500, maxGuests: 4, checkInTime: '2:00 PM', checkOutTime: '12:00 NN', photo: '', active: true,
      amenities: 'Air-conditioned bedroom\nQueen bed + sofa bed\nPrivate bathroom with hot shower\nKitchenette with fridge and cooking basics\nWi-Fi and smart TV\nTowels and toiletries' }
  ],
  rentals: {
    graceMinutes: 0, capExtraHoursAtDailyRate: true, includedHelmets: 1, maxHelmets: 2, extraHelmetFee: 0,
    locations: [
      { id: 'office', name: 'Baybayin Office (Sitio Sawang, Dubduban)', fee: 0 },
      { id: 'hiraya', name: 'Hiraya Beach House, Cabolutan', fee: 100 },
      { id: 'port', name: 'San Agustin Port', fee: 100 }
    ],
    units: [
      { id: 'nmax', name: 'Yamaha NMAX 155', desc: '155cc · automatic · ABS · roomy for two', dailyRate: 800, hourlyRate: 80, deposit: 2000, bizId: 'baybayin', town: 'San Agustin', photo: '', active: true },
      { id: 'pcx', name: 'Honda PCX 160', desc: '160cc · automatic · ABS · smart key', dailyRate: 850, hourlyRate: 85, deposit: 2000, bizId: 'baybayin', town: 'San Agustin', photo: '', active: true },
      { id: 'click1', name: 'Honda Click 125 (Unit 1)', desc: '125cc · automatic · easy to ride', dailyRate: 500, hourlyRate: 50, deposit: 1000, bizId: 'baybayin', town: 'San Agustin', photo: '', active: true },
      { id: 'click2', name: 'Honda Click 125 (Unit 2)', desc: '125cc · automatic · easy to ride', dailyRate: 500, hourlyRate: 50, deposit: 1000, bizId: 'baybayin', town: 'San Agustin', photo: '', active: true },
      { id: 'fazzio', name: 'Yamaha Fazzio 125', desc: '125cc hybrid · automatic · retro style', dailyRate: 600, hourlyRate: 60, deposit: 1000, bizId: 'baybayin', town: 'San Agustin', photo: '', active: true }
    ]
  },
  foods: [{
    storeName: 'Pahuway Café', bizId: 'pahuway', town: 'San Agustin', address: 'Sitio Sawang, Brgy. Dubduban, San Agustin, Romblon', hours: '7:00 AM – 9:00 PM',
    lat: 12.5703, lng: 122.1312, open: true, deliveryEnabled: true, pickupEnabled: true, codEnabled: true, onlineEnabled: true,
    matrix: [ { upToKm: 1, fee: 30 }, { upToKm: 3, fee: 50 }, { upToKm: 5, fee: 80 }, { upToKm: 8, fee: 120 } ],
    categories: [ { id: 'seasonal', name: 'Seasonal' }, { id: 'coffee', name: 'Coffee' }, { id: 'noncoffee', name: 'Non-coffee' } ],
    items: [
      { id: 'chocomallow', catId: 'seasonal', name: 'Choco-Mallow', desc: 'Chocolate topped with marshmallows, whipped cream and chocolate sauce.', price: 160, photo: '', available: true, addons: [ { id: 'xmallow', name: 'Extra marshmallows', price: 15 } ] },
      { id: 'americano', catId: 'coffee', name: 'Americano', desc: 'Espresso and water. Hot or iced.', price: 110, photo: '', available: true, addons: [ { id: 'shot', name: 'Extra shot', price: 30 }, { id: 'iced', name: 'Make it iced', price: 0 } ] },
      { id: 'latte', catId: 'coffee', name: 'Café Latte', desc: 'Espresso and steamed milk. Hot or iced.', price: 130, photo: '', available: true, addons: [ { id: 'shot', name: 'Extra shot', price: 30 }, { id: 'oat', name: 'Oat milk', price: 40 }, { id: 'iced', name: 'Make it iced', price: 0 } ] },
      { id: 'spanish', catId: 'coffee', name: 'Spanish Latte', desc: 'Espresso, milk and condensed milk.', price: 140, photo: '', available: true, addons: [ { id: 'shot', name: 'Extra shot', price: 30 }, { id: 'oat', name: 'Oat milk', price: 40 } ] },
      { id: 'caramel', catId: 'coffee', name: 'Caramel Macchiato', desc: 'Vanilla, milk, espresso and caramel drizzle.', price: 150, photo: '', available: true, addons: [ { id: 'shot', name: 'Extra shot', price: 30 }, { id: 'oat', name: 'Oat milk', price: 40 } ] },
      { id: 'strawberry', catId: 'noncoffee', name: 'Blended Strawberry', desc: 'Creamy blended strawberry.', price: 150, photo: '', available: true, addons: [ { id: 'cream', name: 'Whipped cream', price: 15 } ] },
      { id: 'cookies', catId: 'noncoffee', name: 'Cookies & Cream', desc: 'Blended with cookie crumbs.', price: 150, photo: '', available: true, addons: [ { id: 'cream', name: 'Whipped cream', price: 15 } ] },
      { id: 'ichoco', catId: 'noncoffee', name: 'Iced Chocolate', desc: 'Rich chocolate over ice.', price: 130, photo: '', available: true, addons: [] }
    ]
  },
  {
    storeName: 'Kusina sa Hiraya', bizId: 'kusina', town: 'San Agustin', address: 'Hiraya Beach House, Cabolutan, San Agustin, Romblon', hours: '11:00 AM – 9:00 PM',
    lat: 12.5872, lng: 122.1189, open: true, deliveryEnabled: true, pickupEnabled: true, codEnabled: true, onlineEnabled: true,
    matrix: [ { upToKm: 1, fee: 30 }, { upToKm: 3, fee: 50 }, { upToKm: 5, fee: 80 }, { upToKm: 8, fee: 120 } ],
    categories: [ { id: 'ramen', name: 'Ramen' }, { id: 'dimsum', name: 'Gyoza & dimsum' }, { id: 'drinks', name: 'Drinks' } ],
    items: [
      { id: 'tonkotsu', catId: 'ramen', name: 'Tonkotsu Ramen', desc: 'Rich pork broth, chashu, soft egg, nori and spring onion.', price: 280, photo: '', available: true, addons: [ { id: 'egg', name: 'Extra egg', price: 30 }, { id: 'chashu', name: 'Extra chashu', price: 70 }, { id: 'noodles', name: 'Extra noodles', price: 50 } ] },
      { id: 'shoyu', catId: 'ramen', name: 'Shoyu Ramen', desc: 'Soy-seasoned chicken broth, chashu, bamboo shoots and egg.', price: 260, photo: '', available: true, addons: [ { id: 'egg', name: 'Extra egg', price: 30 }, { id: 'chashu', name: 'Extra chashu', price: 70 } ] },
      { id: 'miso', catId: 'ramen', name: 'Spicy Miso Ramen', desc: 'Miso broth with chili oil, ground pork, corn and egg.', price: 290, photo: '', available: true, addons: [ { id: 'egg', name: 'Extra egg', price: 30 }, { id: 'spicy', name: 'Extra spicy', price: 0 } ] },
      { id: 'gyoza', catId: 'dimsum', name: 'Pork Gyoza (6 pcs)', desc: 'Pan-fried dumplings with soy-vinegar dip.', price: 150, photo: '', available: true, addons: [] },
      { id: 'siomai', catId: 'dimsum', name: 'Pork Siomai (4 pcs)', desc: 'Steamed pork and shrimp dumplings.', price: 120, photo: '', available: true, addons: [ { id: 'chili', name: 'Chili garlic', price: 0 } ] },
      { id: 'hakaw', catId: 'dimsum', name: 'Shrimp Hakaw (4 pcs)', desc: 'Steamed crystal shrimp dumplings.', price: 140, photo: '', available: true, addons: [] },
      { id: 'icedtea', catId: 'drinks', name: 'House Iced Tea', desc: 'Freshly brewed, lightly sweet.', price: 60, photo: '', available: true, addons: [] }
    ]
  }],
  tours: []
};

/* Add-on groups for the sample menus (required/optional, customers pick up to 3 per group) */
(function () {
  const g = (id, name, required, max, opts) => ({ id, name, active: true, required, max, options: opts.map(([oid, n, price]) => ({ id: oid, name: n, price, active: true })) });
  const set = (biz, ids, groups) => DEFAULT_CATALOG.foods.find(f => f.bizId === biz).items.filter(i => ids.includes(i.id)).forEach(i => { i.addonGroups = groups; delete i.addons; });
  set('pahuway', ['americano', 'latte', 'spanish', 'caramel'], [g('temp', 'Hot or iced', true, 1, [['hot', 'Hot', 0], ['iced', 'Iced', 0]]), g('milk', 'Milk', false, 1, [['oat', 'Oat milk', 40], ['soy', 'Soy milk', 30]]), g('extras', 'Extras', false, 3, [['shot', 'Extra shot', 30], ['syrup', 'Vanilla syrup', 20], ['cream', 'Whipped cream', 15]])]);
  set('pahuway', ['strawberry', 'cookies'], [g('size', 'Size', true, 1, [['reg', 'Regular 16 oz', 0], ['lrg', 'Large 22 oz', 30]]), g('extras', 'Extras', false, 3, [['cream', 'Whipped cream', 15], ['drizzle', 'Chocolate drizzle', 15]])]);
  set('kusina', ['tonkotsu', 'shoyu', 'miso'], [g('spice', 'Spice level', true, 1, [['mild', 'Mild', 0], ['med', 'Medium', 0], ['hot', 'Spicy', 0]]), g('extras', 'Extras', false, 3, [['egg', 'Extra egg', 30], ['chashu', 'Extra chashu', 70], ['noodles', 'Extra noodles', 50], ['nori', 'Extra nori', 20]])]);
})();

/* ================= ROMBLON TOWNS ================= */
const ISLANDS = [
  { id: 'tablas', name: 'Tablas Island', towns: ['Alcantara', 'Calatrava', 'Ferrol', 'Looc', 'Odiongan', 'San Agustin', 'San Andres', 'Santa Fe', 'Santa Maria'] },
  { id: 'romblon', name: 'Romblon Island', towns: ['Romblon'] },
  { id: 'sibuyan', name: 'Sibuyan Island', towns: ['Cajidiocan', 'Magdiwang', 'San Fernando'] },
  { id: 'carabao', name: 'Carabao Island', towns: ['San Jose'] },
  { id: 'banton', name: 'Banton Island', towns: ['Banton'] },
  { id: 'simara', name: 'Simara Island', towns: ['Corcuera'] },
  { id: 'maestro', name: 'Maestro de Campo Island', towns: ['Concepcion'] }
];
const TOWNS = ISLANDS.flatMap(i => i.towns).sort();
/* Approximate town centres, used by "Use current location" */
const TOWN_GEO = { Alcantara: [12.258, 122.054], Calatrava: [12.618, 122.071], Ferrol: [12.336, 121.938], Looc: [12.260, 121.993], Odiongan: [12.401, 121.987], 'San Agustin': [12.570, 122.130],
  'San Andres': [12.585, 122.012], 'Santa Fe': [12.158, 122.000], 'Santa Maria': [12.490, 122.096], Romblon: [12.576, 122.270], Cajidiocan: [12.367, 122.681], Magdiwang: [12.483, 122.513],
  'San Fernando': [12.305, 122.600], 'San Jose': [12.062, 121.951], Banton: [12.951, 122.069], Corcuera: [12.802, 122.050], Concepcion: [12.920, 121.707] };
const islandOf = t => (ISLANDS.find(i => i.towns.includes(t)) || {}).id;
const townOf = x => (x && x.town) || 'San Agustin';

/* ================= HELPERS ================= */
const $ = s => document.querySelector(s);
const peso = n => { n = Number(n || 0); return '₱' + n.toLocaleString('en-PH', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }); };
const pad = n => String(n).padStart(2, '0');
const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); return iso(new Date(y, m - 1, d + n)); };
const today = iso(new Date());
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = o => JSON.parse(JSON.stringify(o));
const uid = () => Math.random().toString(36).slice(2, 8);
const fmtT = t => { const [h, m] = t.split(':').map(Number); return (h % 12 || 12) + ':' + pad(m) + (h < 12 ? ' AM' : ' PM'); };
const fmtD = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }); };
const fmtDT = s => { const [d, t] = s.split('T'); return fmtD(d).replace(/, \d{4}$/, '') + ' ' + fmtT(t || '00:00'); };
const validPhone = p => /^(\+?63|0)9\d{9}$/.test(String(p).replace(/[\s-]/g, ''));
const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
function setTxt(sel, v) { const e = $(sel); if (e) e.textContent = v; }
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2600); }
function loading(on, txt) { $('#loading').classList.toggle('show', !!on); $('#loadingText').textContent = txt || 'Loading…'; }
const TIMES = (() => { const a = []; for (let h = 6; h <= 21; h++) { a.push(pad(h) + ':00'); a.push(pad(h) + ':30'); } return a; })();
const timeOpts = sel => TIMES.map(t => `<option value="${t}" ${t === sel ? 'selected' : ''}>${fmtT(t)}</option>`).join('');
const photoOr = (url, icon, cls) => url ? `<img src="${esc(url)}" alt="" loading="lazy">` : `<div class="${cls || 'ph'}">${ic(icon || 'box', 34)}</div>`;
