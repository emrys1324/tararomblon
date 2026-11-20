/* ===== PRICING (shared by the website and the Vercel API — keep identical) ===== */
var Pricing = {
  find: function (arr, id) { for (var i = 0; i < (arr || []).length; i++) if (arr[i].id === id) return arr[i]; return null; },
  dayNum: function (s) { var p = String(s).split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]) / 864e5; },
  minutes: function (s) {
    var d = String(s).split('T'), p = d[0].split('-'), t = (d[1] || '00:00').split(':');
    return Date.UTC(+p[0], +p[1] - 1, +p[2], +t[0], +t[1]) / 6e4;
  },
  round: function (n) { return Math.round(n * 100) / 100; },
  /* Listing promo discount (% off), set by the Merchant Admin or Super Admin */
  promo: function (x) { return Math.min(Math.max(+(x && x.promoPct) || 0, 0), 90); },
  off: function (amount, pct) { return Pricing.round(amount * (100 - pct) / 100); },
  addMin: function (s, m) { return new Date((Pricing.minutes(s) + m) * 6e4).toISOString().slice(0, 16); },
  /* Food stores: one per food business (older catalogs had a single "food" store) */
  stores: function (cat) { return (cat && (cat.foods || (cat.food ? [cat.food] : []))) || []; },
  store: function (cat, bizId) { var L = Pricing.stores(cat); for (var i = 0; i < L.length; i++) if (L[i].bizId === bizId) return L[i]; return bizId ? null : L[0] || null; },
  norm: function (cat) {
    if (!cat) return cat;
    if (!cat.foods) cat.foods = cat.food ? [cat.food] : [];
    delete cat.food;
    cat.foods.forEach(function (f) { f.bizId = f.bizId || 'pahuway'; f.items = f.items || []; f.categories = f.categories || []; f.matrix = f.matrix || []; });
    cat.tours = cat.tours || []; cat.stays = cat.stays || []; cat.rentals = cat.rentals || { locations: [], units: [] };
    return cat;
  },

  /* Stay: rate per night × nights between check-in and check-out */
  stay: function (cat, l) {
    var st = Pricing.find(cat.stays, l.itemId);
    if (!st || !st.active) return { error: 'This accommodation is not available.' };
    if (!l.checkin || !l.checkout) return { error: 'Choose check-in and check-out dates.' };
    var n = Pricing.dayNum(l.checkout) - Pricing.dayNum(l.checkin);
    if (!(n >= 1)) return { error: 'Check-out must be at least one day after check-in.' };
    var g = +l.guests || 0;
    if (g < 1 || g > +st.maxGuests) return { error: 'Guests must be between 1 and ' + st.maxGuests + '.' };
    var pr = Pricing.promo(st), list = n * +st.rate, total = Pricing.off(list, pr);
    return { ok: true, type: 'stay', bizId: st.bizId || 'hiraya', itemId: st.id, label: st.name, start: l.checkin, end: l.checkout, nights: n, rate: +st.rate, guests: g, promoPct: pr, listTotal: list, total: total, deposit: +st.deposit || 0 };
  },

  /* Rental: daily rate per full 24 hours (minimum 1 day) + hourly rate for each started hour beyond the last full 24 hours */
  rental: function (cat, l) {
    var R = cat.rentals, u = Pricing.find(R.units, l.itemId);
    if (!u || !u.active) return { error: 'This scooter is not available.' };
    if (!l.start || !l.end) return { error: 'Choose pick-up and return date and time.' };
    var mins = Pricing.minutes(l.end) - Pricing.minutes(l.start);
    if (!(mins > 0)) return { error: 'Return must be after pick-up.' };
    var days = Math.max(1, Math.floor(mins / 1440));
    var rem = mins < 1440 ? 0 : mins - days * 1440;
    var extraHours = rem <= (+R.graceMinutes || 0) ? 0 : Math.ceil(rem / 60);
    var extra = extraHours * +u.hourlyRate;
    var capped = false;
    if (R.capExtraHoursAtDailyRate && extra > +u.dailyRate) { extra = +u.dailyRate; capped = true; }
    var helmets = +l.helmets || 1;
    if (helmets < 1 || helmets > +R.maxHelmets) return { error: 'Helmets must be between 1 and ' + R.maxHelmets + '.' };
    var helmetFee = Math.max(0, helmets - (+R.includedHelmets || 0)) * (+R.extraHelmetFee || 0);
    var pick = Pricing.find(R.locations, l.pickup), ret = Pricing.find(R.locations, l.ret);
    if (!pick || !ret) return { error: 'Choose pick-up and return locations.' };
    var locFee = (+pick.fee || 0) + (+ret.fee || 0);
    var base = days * +u.dailyRate, pr = Pricing.promo(u);
    var total = Pricing.off(base + extra, pr) + helmetFee + locFee;
    return { ok: true, type: 'rental', bizId: u.bizId || 'baybayin', itemId: u.id, label: u.name, start: l.start, end: l.end, days: days, extraHours: extraHours,
      dailyRate: +u.dailyRate, hourlyRate: +u.hourlyRate, base: base, extra: extra, capped: capped, helmets: helmets, helmetFee: helmetFee,
      pickup: pick.name, ret: ret.name, locFee: locFee, promoPct: pr, listTotal: base + extra + helmetFee + locFee, total: total, deposit: +u.deposit || 0 };
  },

  /* Tour or other service: rate per person (or per group) for a date and start time; one group per time slot */
  tour: function (cat, l) {
    var t = Pricing.find(cat.tours, l.itemId);
    if (!t || !t.active) return { error: 'This tour or service is not available.' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(l.date || ''))) return { error: 'Choose a date.' };
    var times = String(t.times || '08:00').split(',').map(function (x) { return x.trim(); }).filter(Boolean);
    var time = l.time || times[0] || '08:00';
    if (times.length && times.indexOf(time) < 0) return { error: 'Choose one of the available start times.' };
    var pax = Math.floor(+l.pax || 0), max = Math.max(1, +t.maxPax || 1);
    if (pax < 1 || pax > max) return { error: 'Number of ' + (t.category === 'service' ? 'persons' : 'guests') + ' must be between 1 and ' + max + '.' };
    var list = t.rateUnit === 'group' ? +t.rate : +t.rate * pax, pr = Pricing.promo(t), start = l.date + 'T' + time;
    return { ok: true, type: 'tour', bizId: t.bizId, itemId: t.id, label: t.name, category: t.category || 'tour', start: start, end: Pricing.addMin(start, Math.max(30, (+t.durationHours || 1) * 60)), date: l.date, time: time,
      pax: pax, rate: +t.rate, rateUnit: t.rateUnit || 'person', promoPct: pr, listTotal: list, total: Pricing.off(list, pr), deposit: +t.deposit || 0 };
  },

  /* Booking (stays + rentals): sum of lines; downpayment % due now; security deposits paid at pick-up */
  booking: function (cat, lines) {
    if (!lines || !lines.length) return { error: 'Your booking is empty.' };
    var out = [], total = 0, deposit = 0;
    for (var i = 0; i < lines.length; i++) {
      var q = lines[i].type === 'stay' ? Pricing.stay(cat, lines[i]) : lines[i].type === 'tour' ? Pricing.tour(cat, lines[i]) : Pricing.rental(cat, lines[i]);
      if (q.error) return q;
      out.push(q); total += q.total; deposit += q.deposit;
    }
    var pct = +cat.business.downpaymentPct || 50;
    var due = Math.round(total * pct / 100);
    return { ok: true, lines: out, total: total, pct: pct, dueNow: due, balance: total - due, deposit: deposit };
  },

  km: function (lat1, lng1, lat2, lng2) {
    var r = Math.PI / 180, dLat = (lat2 - lat1) * r, dLng = (lng2 - lng1) * r;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },
  bands: function (food) { return (food.matrix || []).slice().sort(function (a, b) { return a.upToKm - b.upToKm; }); },
  deliveryFee: function (food, km) {
    var b = Pricing.bands(food);
    for (var i = 0; i < b.length; i++) if (km <= +b[i].upToKm) return +b[i].fee;
    return null;
  },
  /* Delivery fee rule (Super Admin > Settings > Delivery): free within freeKm of the store, then perKm for each started km.
     The customer pays customerPct % of that fee, the store pays the rest, and the rider earns the whole fee.
     Within freeKm the customer pays nothing and the store pays the rider baseFee. Beyond the store's delivery area: null. */
  DELIVERY: { freeKm: 1.5, perKm: 10, customerPct: 70, baseFee: 20, maxKm: 10 },
  deliveryRule: function (cat) { var d = (cat && cat.settings && cat.settings.delivery) || {}, D = Pricing.DELIVERY, o = {}; for (var k in D) o[k] = d[k] == null || d[k] === '' || isNaN(+d[k]) ? D[k] : +d[k]; return o; },
  deliverySplit: function (cat, food, km) {
    var R = Pricing.deliveryRule(cat), b = Pricing.bands(food), max = +food.maxKm || (b.length ? +b[b.length - 1].upToKm : R.maxKm);
    if (km == null || km > max + 1e-9) return null;
    if (km <= R.freeKm + 1e-9) return { km: km, fee: 0, riderFee: R.baseFee, storeShare: R.baseFee, extraKm: 0 };
    var extra = Math.ceil(Pricing.round(km - R.freeKm) - 1e-9), full = extra * R.perKm, cust = Math.round(full * R.customerPct / 100);
    return { km: km, fee: cust, riderFee: full, storeShare: Pricing.round(full - cust), extraKm: extra };
  },

  /* Add-on groups on a menu item: [{ id, name, active, required, max (1-3), options: [{ id, name, price, active }] }].
     Older menus had a flat "addons" list; it becomes one optional group. */
  addonGroups: function (it) {
    if (it.addonGroups) return it.addonGroups;
    var a = (it.addons || []).filter(function (x) { return x && x.name; });
    return a.length ? [{ id: 'addons', name: 'Add-ons', active: true, required: false, max: Math.min(3, a.length), options: a }] : [];
  },
  /* picked: option keys "groupId:optionId" (older carts used just the option id) */
  addonCheck: function (it, picked) {
    var groups = Pricing.addonGroups(it).filter(function (g) { return g.active !== false; }), names = [], sum = 0, count = {};
    picked = picked || [];
    for (var i = 0; i < picked.length; i++) {
      var key = String(picked[i]), gi = key.indexOf(':'), gid = gi > 0 ? key.slice(0, gi) : '', oid = gi > 0 ? key.slice(gi + 1) : key, g = null, o = null;
      for (var k = 0; k < groups.length && !o; k++) { if (gid && groups[k].id !== gid) continue; var f = Pricing.find(groups[k].options, oid); if (f) { g = groups[k]; o = f; } }
      if (!o || o.active === false) return { error: it.name + ': an add-on you chose is no longer available. Please remove it and add the item again.' };
      count[g.id] = (count[g.id] || 0) + 1; names.push(o.name); sum += +o.price || 0;
    }
    for (var m = 0; m < groups.length; m++) {
      var G = groups[m], n = count[G.id] || 0, max = Math.min(3, Math.max(1, +G.max || 1));
      if (G.required && !n && G.options.some(function (x) { return x.active !== false; })) return { error: it.name + ': please choose ' + G.name + '.' };
      if (n > max) return { error: it.name + ': choose up to ' + max + ' for ' + G.name + '.' };
    }
    return { names: names, sum: Pricing.round(sum) };
  },

  /* Food: (item price + add-ons) × qty, plus delivery fee from the distance matrix */
  food: function (cat, p) {
    var F = Pricing.store(cat, p.bizId);
    if (!F) return { error: 'This restaurant is not available.' };
    if (!F.open) return { error: F.storeName + ' is not accepting orders right now.' };
    if (!p.lines || !p.lines.length) return { error: 'Your order is empty.' };
    var out = [], sub = 0;
    for (var i = 0; i < p.lines.length; i++) {
      var l = p.lines[i], it = Pricing.find(F.items, l.itemId);
      if (!it || !it.available) return { error: 'An item in your order is no longer available.' };
      var ch = Pricing.addonCheck(it, l.addons);
      if (ch.error) return { error: ch.error };
      var adds = ch.names, addSum = ch.sum;
      var qty = Math.max(1, Math.floor(+l.qty || 1));
      var unit = Pricing.off(+it.price, Pricing.promo(it)) + addSum, lt = Pricing.round(unit * qty);
      out.push({ bizId: F.bizId || 'pahuway', itemId: it.id, name: it.name, qty: qty, unit: unit, addons: adds, note: l.note || '', total: lt });
      sub += lt;
    }
    var fee = 0, km = null, split = null;
    if (p.fulfillment === 'delivery') {
      if (!F.deliveryEnabled) return { error: 'Delivery is not available right now.' };
      if (p.lat != null && p.lng != null) km = Pricing.round(Pricing.km(+F.lat, +F.lng, +p.lat, +p.lng));
      else if (p.band != null && Pricing.bands(F)[+p.band]) km = +Pricing.bands(F)[+p.band].upToKm;
      else return { error: 'Pin your delivery location.' };
      split = Pricing.deliverySplit(cat, F, km);
      if (!split) return { error: 'Sorry, that location is outside our delivery area.' };
      fee = split.fee;
    } else if (p.fulfillment === 'pickup' && !F.pickupEnabled) return { error: 'Pick-up is not available right now.' };
    return { ok: true, bizId: F.bizId, storeName: F.storeName, lines: out, subtotal: Pricing.round(sub), km: km, deliveryFee: fee, total: Pricing.round(sub + fee),
      riderFee: split ? split.riderFee : 0, storeDeliveryShare: split ? split.storeShare : 0 };
  }
};
/* ===== END PRICING ===== */
