/* ================= STATE ================= */
let BUSY = [];
let session = store('tr4_session');           // {token, profile}
let cart = store('tr3_cart') || { booking: [], food: [] };
if (cart.food.length && !cart.foodBiz) cart.foodBiz = 'pahuway';
const S = { town: (function () { try { return JSON.parse(localStorage.getItem('tr3_town')) || 'all'; } catch (e) { return 'all'; } })(), sIn: addDays(today, 1), sOut: addDays(today, 3), guests: 2, rD: addDays(today, 1), rT: '09:00', rRD: addDays(today, 3), rRT: '09:00', cat: 'all', store: null, geo: null };
const storeOf = id => Pricing.store(CAT, id);
const cartStore = () => storeOf(cart.foodBiz) || Pricing.stores(CAT)[0];
let currentView = 'home';
const inTown = t => S.town === 'all' || (S.town.startsWith('isl:') ? islandOf(t) === S.town.slice(4) : t === S.town);
const locLabel = () => S.town === 'all' ? 'All of Romblon' : S.town.startsWith('isl:') ? (ISLANDS.find(i => 'isl:' + i.id === S.town) || {}).name : S.town;
function townCounts() {
  const c = {}; const add = t => c[t] = (c[t] || 0) + 1;
  CAT.stays.filter(x => x.active).forEach(x => add(townOf(x))); CAT.rentals.units.filter(x => x.active).forEach(x => add(townOf(x))); Pricing.stores(CAT).forEach(f => add(townOf(f))); CAT.tours.filter(x => x.active).forEach(x => add(townOf(x)));
  return c;
}
function setTown(v) { S.town = v; store('tr3_town', v); closeSheet(); renderAll(); if (currentView === 'explore') renderExplore(); }
function renderLocSlots() { document.querySelectorAll('.locslot').forEach(el => el.innerHTML = `<button class="townchip" onclick="openTownPicker()"><span>${ic('pin')}</span><b>${esc(locLabel())}</b><span class="car" aria-hidden="true">${ic('chev', 14)}</span></button>`); }
function openTownPicker() {
  const c = townCounts(), tag = n => n ? `<i>${n}</i>` : '';
  openSheet(`<div class="sbody"><h2>Where in Romblon?</h2><p class="meta" style="margin-top:4px">17 towns across 7 islands. Numbers show listings available now.</p>
    <button class="tbtn all locme" onclick="useMyLocation()">${ic('locate')} Use current location</button>
    <button class="tbtn all ${S.town === 'all' ? 'on' : ''}" onclick="setTown('all')">${ic('map')} All of Romblon</button>
    ${ISLANDS.map(i => `<div class="tisl"><button class="tislh ${S.town === 'isl:' + i.id ? 'on' : ''}" onclick="setTown('isl:${i.id}')">${esc(i.name)}${i.towns.length > 1 ? ' <span>· all ' + i.towns.length + ' towns</span>' : ''}</button>
      <div class="tgrid">${i.towns.map(t => `<button class="tbtn ${S.town === t ? 'on' : ''}" onclick="setTown('${t}')">${t}${tag(c[t])}</button>`).join('')}</div></div>`).join('')}</div>`);
}
/* "Use current location": nearest Romblon town; asks the customer to turn on location services when needed */
function locationHelp(code) {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent), android = /android/i.test(navigator.userAgent);
  const how = ios ? 'On iPhone: Settings > Privacy & Security > Location Services > turn it on, then set Safari Websites (or your browser) to "While Using".'
    : android ? 'On Android: swipe down and turn on Location, then in your browser tap the lock icon next to the address and allow Location.'
    : 'Turn on location in your device settings, then allow location for this site (lock icon next to the address).';
  openSheet(`<div class="sbody"><h2>${ic('locate', 22)} Turn on location services</h2><p class="meta" style="margin-top:6px">${code === 1 ? 'Location access is blocked for this site.' : 'We could not detect your location.'} ${esc(how)}</p>
    <p class="hint mt">You can also choose your town from the list.</p><div class="row2 mt"><button class="btn ghost" onclick="openTownPicker()">Choose a town</button><button class="btn" onclick="useMyLocation()">Try again</button></div></div>`);
}
function getLocation(ok) {
  if (!navigator.geolocation) { locationHelp(2); return; }
  if (window.isSecureContext === false) { toast('Location needs a secure (https) page.'); locationHelp(2); return; }
  loading(true, 'Finding your location…');
  navigator.geolocation.getCurrentPosition(pos => { loading(false); S.geo = { lat: pos.coords.latitude, lng: pos.coords.longitude }; ok(S.geo); }, e => { loading(false); locationHelp(e && e.code); }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 });
}
function nearestTown(g) { let best = null, d = 1e9; Object.entries(TOWN_GEO).forEach(([t, c]) => { const k = Pricing.km(g.lat, g.lng, c[0], c[1]); if (k < d) { d = k; best = t; } }); return { town: best, km: d }; }
function useMyLocation() {
  getLocation(g => { const n = nearestTown(g); if (n.km > 40) { setTown('all'); toast('You seem to be outside Romblon. Showing all of Romblon.'); } else { setTown(n.town); toast('Showing listings near you in ' + n.town); } });
}
function emptyTown(what) {
  return `<div class="empty" style="grid-column:1/-1"><div class="big">${ic('map', 40)}</div><p>No ${what} in <b>${esc(locLabel())}</b> yet — we're growing across Romblon.</p>
    <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:12px"><button class="btn navy sm" onclick="setTown('all')">Show all of Romblon</button>${CAT.business.email ? `<a class="btn ghost sm" href="mailto:${esc(CAT.business.email)}?subject=List%20my%20business%20on%20${encodeURIComponent(CAT.business.name)}">List your business</a>` : ''}</div></div>`;
}
const saveCart = () => { store('tr3_cart', cart); renderBadges(); };
const cartRange = x => { if (x.type === 'stay') return [x.checkin, x.checkout]; if (x.type === 'tour') { const q = Pricing.tour(CAT, x); return q.ok ? [q.start, q.end] : ['', '']; } return [x.start, x.end]; };
const isBusy = (type, id, a, b) => BUSY.some(x => x.type === type && x.itemId === id && a < x.end && b > x.start) ||
  cart.booking.some(x => { if (x.type !== type || x.itemId !== id) return false; const r = cartRange(x); return a < r[1] && b > r[0]; });

async function loadCatalog() {
  try { const r = await api('getCatalog'); window.CAT_SAVED = !!r.catalog; if (r.catalog) CAT = r.catalog; } catch (e) { toast('Could not load latest rates: ' + e.message); }
  try { const r = await api('availability'); BUSY = r.busy || []; } catch (e) { }
  $('#brandName').textContent = CAT.business.name; $('#footBrand').textContent = CAT.business.name;
  const c = [CAT.business.phone && 'Tel: ' + CAT.business.phone, CAT.business.facebook && CAT.business.facebook].filter(Boolean).join('\n');
  $('#footContact').textContent = c; if ($('#footYear')) $('#footYear').textContent = new Date().getFullYear();
}

/* ================= STAYS ================= */
function stayCard(st) {
  const free = !isBusy('stay', st.id, S.sIn, S.sOut);
  const n = Pricing.dayNum(S.sOut) - Pricing.dayNum(S.sIn);
  return `<button class="card" onclick="openStay('${st.id}')"><div class="thumb">${(st.photo ? photoOr(st.photo) : sceneArt('beach'))}<span class="tag ${free ? 'ok' : 'no'}">${free ? 'Available' : 'Booked on your dates'}</span></div>
  <div class="cbody"><span class="brandl">${esc(st.location)}</span><h3>${esc(st.name)}</h3><span class="meta">${ic('pin', 14)} ${esc(townOf(st))} · up to ${st.maxGuests} guests</span>
  <div class="price">${Pricing.promo(st) ? `<span class="was">${peso(st.rate)}</span>` : ''}<b>${peso(Pricing.off(st.rate, Pricing.promo(st)))}</b> / night${Pricing.promo(st) ? `<span class="promo">-${Pricing.promo(st)}%</span>` : ''}${n > 1 ? ` · ${peso(Pricing.off(st.rate * n, Pricing.promo(st)))} for ${n} nights` : ''}</div></div></button>`;
}
/* Stays and Things to do are "coming soon" until a Super Admin opens them (Settings) */
const isLive = k => !!(CAT.settings || {})[k + 'Live'];
function soonBlock(icon, title, text) { return `<div class="empty soonbox" style="grid-column:1/-1;padding-top:30px"><div class="big">${ic(icon, 40)}</div><span class="soonb on">Coming soon</span><h2 style="font-size:28px;color:var(--ink);margin-top:8px">${title}</h2><p style="margin:8px auto 16px;max-width:420px">${text}</p><div class="rowbtns" style="justify-content:center"><button class="btn" data-go="food">Order food</button><button class="btn ghost" data-go="rentals">Rent a scooter</button></div></div>`; }
function renderSoon() {
  document.querySelectorAll('[data-soonb]').forEach(el => el.classList.toggle('on', !isLive(el.dataset.soonb)));
  const sec = $('#homeStaysSec'); if (sec) sec.style.display = isLive('stays') ? '' : 'none';
  const sb = $('#v-stays .sbar'); if (sb) sb.style.display = isLive('stays') ? '' : 'none';
  const sh = $('#v-stays .shead'); if (sh) sh.style.display = isLive('stays') ? '' : 'none';
}
function renderStays() {
  renderSoon();
  if (!isLive('stays')) { $('#staysGrid').innerHTML = soonBlock('home', 'Stays are coming soon', 'Beach houses, resorts and homestays across Romblon, bookable right here. Meanwhile, order food or rent a scooter.'); $('#homeStays').innerHTML = ''; setTxt('#hStays', ''); return; }
  const list = CAT.stays.filter(s => s.active && inTown(townOf(s)));
  const g = +S.guests;
  $('#staysGrid').innerHTML = !list.length ? emptyTown('stays') : list.filter(s => s.maxGuests >= g).map(stayCard).join('') || `<div class="empty" style="grid-column:1/-1">No accommodation in ${esc(locLabel())} fits ${g} guests.</div>`;
  $('#homeStays').innerHTML = list.map(stayCard).join('') || emptyTown('stays');
  setTxt('#hStays', list.length ? 'from ' + peso(Math.min(...list.map(s => s.rate))) + ' / night' : '');
}
function openStay(id) {
  const st = CAT.stays.find(s => s.id === id);
  openSheet(`<div class="thumb">${(st.photo ? photoOr(st.photo) : sceneArt('beach'))}</div><div class="sbody">
    <span class="brandl">${esc(st.location)}</span><h2>${esc(st.name)}</h2>
    <p class="meta">${peso(st.rate)} per night · up to ${st.maxGuests} guests · check-in ${esc(st.checkInTime)} · check-out ${esc(st.checkOutTime)}</p>
    <div class="amen"><b style="display:block;margin-bottom:4px">Amenities</b>${esc(st.amenities)}</div>
    <div class="row2"><div class="field"><label>Check-in</label><input type="date" id="bIn" min="${today}" value="${S.sIn}"></div><div class="field"><label>Check-out</label><input type="date" id="bOut" value="${S.sOut}"></div></div>
    <div class="field mt"><label>Number of guests</label><select id="bG">${Array.from({ length: st.maxGuests }, (_, i) => `<option value="${i + 1}" ${i + 1 === Math.min(+S.guests, st.maxGuests) ? 'selected' : ''}>${i + 1} guest${i ? 's' : ''}</option>`).join('')}</select></div>
    <div class="sum" id="bSum"></div><div class="err" id="bErr"></div>
    <button class="btn full mt" id="bAdd">Add to cart</button>
    <p class="note">${CAT.business.downpaymentPct}% downpayment confirms your booking. Balance is paid on check-in.</p></div>`);
  const calc = () => {
    const a = $('#bIn').value, b = $('#bOut').value; $('#bOut').min = a ? addDays(a, 1) : today;
    const q = Pricing.stay(CAT, { itemId: id, checkin: a, checkout: b, guests: $('#bG').value });
    let err = q.error || (isBusy('stay', id, a, b) ? 'Sorry, these dates are already booked. Please choose other dates.' : '');
    $('#bErr').textContent = err; $('#bAdd').disabled = !!err;
    if (q.error) { $('#bSum').innerHTML = '<div class="l">Choose your dates</div>'; return; }
    const due = Math.round(q.total * CAT.business.downpaymentPct / 100);
    $('#bSum').innerHTML = `<div class="l"><span>${fmtD(a)} → ${fmtD(b)}</span></div>
      <div class="l"><span>${peso(q.rate)} × ${q.nights} night${q.nights > 1 ? 's' : ''}</span><span>${peso(q.total)}</span></div>
      <div class="l t"><span>Total</span><span>${peso(q.total)}</span></div>
      <div class="l due"><span>Downpayment (${CAT.business.downpaymentPct}%)</span><span>${peso(due)}</span></div>
      <div class="l"><span>Balance on check-in</span><span>${peso(q.total - due)}</span></div>`;
  };
  ['bIn', 'bOut', 'bG'].forEach(i => $('#' + i).addEventListener('change', calc)); calc();
  $('#bAdd').onclick = () => {
    cart.booking.push({ uid: uid(), type: 'stay', itemId: id, checkin: $('#bIn').value, checkout: $('#bOut').value, guests: +$('#bG').value });
    S.sIn = $('#bIn').value; S.sOut = $('#bOut').value; saveCart(); closeSheet(); renderStays(); toast('Stay added to cart');
  };
}

/* ================= RENTALS ================= */
const rStart = () => S.rD + 'T' + S.rT, rEnd = () => S.rRD + 'T' + S.rRT;
function rideCard(u) {
  const free = !isBusy('rental', u.id, rStart(), rEnd());
  const q = Pricing.rental(CAT, { itemId: u.id, start: rStart(), end: rEnd(), helmets: 1, pickup: CAT.rentals.locations[0].id, ret: CAT.rentals.locations[0].id });
  return `<button class="card" onclick="openRide('${u.id}')"><div class="thumb">${(u.photo ? photoOr(u.photo) : sceneArt('ride'))}<span class="tag ${free ? 'ok' : 'no'}">${free ? 'Available' : 'Booked for these times'}</span></div>
  <div class="cbody"><span class="brandl">${esc(bizName(u.bizId || 'baybayin'))} · ${esc(townOf(u))}</span><h3>${esc(u.name)}</h3><span class="meta">${esc(u.desc)}</span>
  <span class="meta">${peso(u.hourlyRate)}/extra hour · ${peso(u.deposit)} deposit</span>
  <div class="price">${Pricing.promo(u) ? `<span class="was">${peso(u.dailyRate)}</span>` : ''}<b>${peso(Pricing.off(u.dailyRate, Pricing.promo(u)))}</b> / 24 hrs${Pricing.promo(u) ? `<span class="promo">-${Pricing.promo(u)}%</span>` : ''}${q.ok ? ` · ${peso(Pricing.off(q.base + q.extra, Pricing.promo(u)))} for your dates` : ''}</div></div></button>`;
}
function renderRides() {
  const list = CAT.rentals.units.filter(u => u.active && inTown(townOf(u)));
  $('#ridesGrid').innerHTML = list.map(rideCard).join('') || emptyTown('scooter rentals');
  $('#homeRides').innerHTML = list.map(rideCard).join('') || emptyTown('scooter rentals');
  setTxt('#hRides', list.length ? list.length + ' scooters · from ' + peso(Math.min(...list.map(u => u.dailyRate))) + '/day' : '');
}
function openRide(id) {
  const u = CAT.rentals.units.find(x => x.id === id), R = CAT.rentals;
  const locOpts = R.locations.map((l, i) => `<option value="${l.id}" ${i === 0 ? 'selected' : ''}>${esc(l.name)}${l.fee ? ' (+' + peso(l.fee) + ')' : ''}</option>`).join('');
  openSheet(`<div class="thumb">${(u.photo ? photoOr(u.photo) : sceneArt('ride'))}</div><div class="sbody">
    <span class="brandl">Baybayin Vehicle Rental</span><h2>${esc(u.name)}</h2><p class="meta">${esc(u.desc)}</p>
    <div class="sum" style="margin-top:10px"><div class="l"><span>Daily rate (per 24 hours)</span><span>${peso(u.dailyRate)}</span></div><div class="l"><span>Each extra hour</span><span>${peso(u.hourlyRate)}</span></div><div class="l"><span>Security deposit (refundable)</span><span>${peso(u.deposit)}</span></div></div>
    <div class="row2"><div class="field"><label>Pick-up date</label><input type="date" id="kD" min="${today}" value="${S.rD}"></div><div class="field"><label>Pick-up time</label><select id="kT">${timeOpts(S.rT)}</select></div></div>
    <div class="row2"><div class="field"><label>Return date</label><input type="date" id="kRD" min="${S.rD}" value="${S.rRD}"></div><div class="field"><label>Return time</label><select id="kRT">${timeOpts(S.rRT)}</select></div></div>
    <div class="field mt"><label>Helmets needed</label><select id="kH">${Array.from({ length: R.maxHelmets }, (_, i) => `<option value="${i + 1}">${i + 1} helmet${i ? 's' : ''}${i + 1 > R.includedHelmets && R.extraHelmetFee ? ' (+' + peso(R.extraHelmetFee * (i + 1 - R.includedHelmets)) + ')' : ''}</option>`).join('')}</select></div>
    <div class="field mt"><label>Pick-up location</label><select id="kP">${locOpts}</select></div>
    <div class="field mt"><label>Return location</label><select id="kR">${locOpts}</select></div>
    <label class="check"><input type="checkbox" id="kLic"><span>I have a valid driver's license with motorcycle restriction and will bring it with a valid ID at pick-up.</span></label>
    <div class="sum" id="kSum"></div><div class="err" id="kErr"></div>
    <button class="btn full mt" id="kAdd">Add to cart</button>
    <p class="note">Charged per 24 hours from pick-up (minimum 1 day). Time beyond each full 24 hours is charged per started hour${R.capExtraHoursAtDailyRate ? ', up to one extra day' : ''}${R.graceMinutes ? `, after a ${R.graceMinutes}-minute grace period` : ''}.</p></div>`);
  const line = () => ({ itemId: id, start: $('#kD').value + 'T' + $('#kT').value, end: $('#kRD').value + 'T' + $('#kRT').value, helmets: +$('#kH').value, pickup: $('#kP').value, ret: $('#kR').value });
  const calc = () => {
    if ($('#kD').value) { $('#kRD').min = $('#kD').value; if ($('#kRD').value < $('#kD').value) $('#kRD').value = $('#kD').value; }
    const l = line(), q = Pricing.rental(CAT, l);
    const err = q.error || (isBusy('rental', id, l.start, l.end) ? 'This scooter is already booked during those times.' : '');
    $('#kErr').textContent = err; $('#kAdd').disabled = !!err;
    if (q.error) { $('#kSum').innerHTML = '<div class="l">Choose pick-up and return</div>'; return; }
    const due = Math.round(q.total * CAT.business.downpaymentPct / 100);
    $('#kSum').innerHTML = `<div class="l"><span>${fmtDT(q.start)} → ${fmtDT(q.end)}</span></div>
      <div class="l"><span>${peso(q.dailyRate)} × ${q.days} day${q.days > 1 ? 's' : ''}</span><span>${peso(q.base)}</span></div>
      ${q.extraHours ? `<div class="l"><span>${q.extraHours} extra hour${q.extraHours > 1 ? 's' : ''} × ${peso(q.hourlyRate)}${q.capped ? ' (capped at 1 day)' : ''}</span><span>${peso(q.extra)}</span></div>` : ''}
      ${q.helmetFee ? `<div class="l"><span>Extra helmet${q.helmets - R.includedHelmets > 1 ? 's' : ''}</span><span>${peso(q.helmetFee)}</span></div>` : ''}
      ${q.locFee ? `<div class="l"><span>Delivery / pick-up location fee</span><span>${peso(q.locFee)}</span></div>` : ''}
      <div class="l t"><span>Rental total</span><span>${peso(q.total)}</span></div>
      <div class="l due"><span>Downpayment (${CAT.business.downpaymentPct}%)</span><span>${peso(due)}</span></div>
      <div class="l"><span>Balance at pick-up</span><span>${peso(q.total - due)}</span></div>
      <div class="l"><span>Security deposit at pick-up (refundable)</span><span>${peso(q.deposit)}</span></div>`;
  };
  $('#sheet').querySelectorAll('input,select').forEach(el => el.addEventListener('change', calc)); calc();
  $('#kAdd').onclick = () => {
    if (!$('#kLic').checked) { $('#kErr').textContent = "Please confirm you have a valid driver's license."; return; }
    const l = line(); cart.booking.push({ uid: uid(), type: 'rental', ...l });
    S.rD = $('#kD').value; S.rT = $('#kT').value; S.rRD = $('#kRD').value; S.rRT = $('#kRT').value;
    saveCart(); closeSheet(); renderRides(); toast('Scooter added to cart');
  };
}

/* ================= FOOD (several restaurants; menus show only after choosing one) ================= */
function storeCard(F) {
  const photo = F.photo || (F.items.find(i => i.photo) || {}).photo, n = F.items.filter(i => i.available).length;
  return `<button class="scard" onclick="openStore('${esc(F.bizId)}')"><div class="sl">${photo ? `<img src="${esc(photo)}" alt="">` : ic('cup', 30)}</div><div><b>${esc(F.storeName)}</b><span>${esc(townOf(F))}${F.hours ? ' · ' + esc(F.hours) : ''}</span><span>${n} item${n === 1 ? '' : 's'} · ${[F.deliveryEnabled && 'Delivery', F.pickupEnabled && 'Pick-up'].filter(Boolean).join(' & ')}</span><span class="pill">${F.open ? 'Open' : 'Closed'}</span></div></button>`;
}
function openStore(id) { S.store = id; S.cat = 'all'; if (currentView !== 'food') go('food'); else renderFood(); window.scrollTo(0, 0); }
function renderFood() {
  const stores = Pricing.stores(CAT), here = stores.filter(f => inTown(townOf(f)));
  $('#homeFood').innerHTML = here.map(storeCard).join('') || emptyTown('restaurants');
  setTxt('#hFood', here.length ? here.length + ' restaurant' + (here.length > 1 ? 's' : '') : '');
  const F = S.store ? storeOf(S.store) : null;
  if (!F) {
    S.store = null;
    $('#foodNotice').innerHTML = '';
    $('#storeHead').innerHTML = `<div class="sm">${ic('cup', 28)}</div><div><h2>Where to eat</h2><p>Choose a restaurant to see its menu. Delivery and pick-up${S.town === 'all' ? ' across Romblon' : ' in ' + esc(locLabel())}.</p></div>`;
    $('#mcats').innerHTML = '';
    $('#menu').innerHTML = `<div class="storecards">${(here.length ? here : stores).map(storeCard).join('')}</div>${!here.length && stores.length ? `<p class="hint mt">No restaurants in ${esc(locLabel())} yet. Showing all of Romblon.</p>` : ''}`;
    return;
  }
  $('#storeHead').innerHTML = `<button class="sm" data-go="home" title="Back to home" aria-label="Back to home">${F.photo ? `<img src="${esc(F.photo)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">` : ic('cup', 28)}</button><div><button class="backlink link" onclick="S.store=null;renderFood()">‹ All restaurants</button><h2>${esc(F.storeName)}</h2><p>${esc(F.address)}${F.hours ? ' · ' + esc(F.hours) : ''}</p>
    <span class="pill">${F.open ? '● Open' : '● Closed'}</span>${F.deliveryEnabled ? '<span class="pill">Delivery</span>' : ''}${F.pickupEnabled ? '<span class="pill">Pick-up</span>' : ''}${Rules.rewardsOf(bizRec(F.bizId)).enabled ? `<span class="pill">${ic('star', 12)} 1 point per ${peso(Rules.rewardsOf(bizRec(F.bizId)).pesoPerPoint)}</span>` : ''}</div>`;
  const cats = F.categories.filter(c => F.items.some(i => i.catId === c.id));
  if (S.cat !== 'all' && !cats.some(c => c.id === S.cat)) S.cat = 'all';
  $('#mcats').innerHTML = [{ id: 'all', name: 'All' }, ...cats].map(c => `<button class="${c.id === S.cat ? 'on' : ''}" onclick="S.cat='${c.id}';renderFood()">${esc(c.name)}</button>`).join('');
  const items = F.items.filter(i => S.cat === 'all' || i.catId === S.cat);
  $('#foodNotice').innerHTML = inTown(townOf(F)) ? '' : `<div class="warn" style="margin:0 0 14px">${esc(F.storeName)} is in ${esc(townOf(F))} and delivers within its delivery area only. You can still order for pick-up.</div>`;
  $('#menu').innerHTML = items.map(i => menuItem(i, F)).join('') || '<div class="empty">No items yet.</div>';
}
function menuItem(i, F) {
  const pr = Pricing.promo(i);
  return `<button class="mitem ${i.available && F.open ? '' : 'na'}" onclick="openItem('${i.id}','${esc(F.bizId)}')"><div class="mph">${photoOr(i.photo, 'cup', 'x')}</div>
  <div class="mi"><b>${esc(i.name)}</b><div class="d">${esc(i.desc)}</div><div class="p">${pr ? `<span class="was">${peso(i.price)}</span>` : ''}${peso(Pricing.off(i.price, pr))}${pr ? `<span class="promo">-${pr}%</span>` : ''}${i.available ? '' : ' · Sold out'}</div></div><span class="plus">+</span></button>`;
}
function addonHtml(it) {
  return Pricing.addonGroups(it).filter(g => g.active !== false && g.options.some(o => o.active !== false)).map(g => {
    const max = Math.min(3, Math.max(1, +g.max || 1)), radio = max === 1, opts = g.options.filter(o => o.active !== false);
    return `<div class="adgrp" data-grp="${esc(g.id)}" data-max="${max}"><div class="adh"><b>${esc(g.name)}</b><span class="${g.required ? 'req' : ''}">${g.required ? 'Required' : 'Optional'} · ${radio ? 'choose 1' : 'up to ' + max}</span></div>
      ${opts.map((o, k) => `<label class="check"><input type="${radio ? 'radio' : 'checkbox'}" name="ad_${esc(g.id)}" data-ad="${esc(g.id + ':' + o.id)}" ${radio && g.required && k === 0 ? 'checked' : ''}><span style="flex:1">${esc(o.name)}</span><b>${o.price ? '+' + peso(o.price) : 'Free'}</b></label>`).join('')}
      ${radio && !g.required ? `<label class="check"><input type="radio" name="ad_${esc(g.id)}" checked><span style="flex:1;color:var(--mute)">None</span></label>` : ''}</div>`;
  }).join('');
}
function openItem(id, bizId) {
  const F = storeOf(bizId || S.store) || cartStore(), it = F.items.find(i => i.id === id); if (!it) return;
  const ok = it.available && F.open, pr = Pricing.promo(it);
  openSheet(`<div class="thumb" style="background:#f3e9dd">${photoOr(it.photo, 'cup')}</div><div class="sbody">
    <span class="brandl">${esc(F.storeName)}</span><h2>${esc(it.name)}</h2><p class="meta" style="margin-top:4px">${esc(it.desc)}</p><p style="font-weight:600;font-size:18px;margin-top:6px">${pr ? `<span class="was">${peso(it.price)}</span>` : ''}${peso(Pricing.off(it.price, pr))}${pr ? `<span class="promo">-${pr}%</span>` : ''}</p>
    ${addonHtml(it)}
    <div class="field mt"><label>Note (optional)</label><input id="iNote" placeholder="e.g. less sweet, no onions"></div>
    <div style="display:flex;gap:12px;align-items:center;margin-top:14px"><div class="qty"><button onclick="iq(-1)">−</button><span id="iQ">1</span><button onclick="iq(1)">+</button></div>
    <button class="btn" style="flex:1" id="iAdd" ${ok ? '' : 'disabled'}>${ok ? 'Add' : F.open ? 'Sold out' : 'Store closed'}</button></div></div>`);
  window.iq = d => { const q = Math.max(1, +$('#iQ').textContent + d); $('#iQ').textContent = q; calc(); };
  const adds = () => [...$('#sheet').querySelectorAll('[data-ad]')].filter(x => x.checked).map(x => x.dataset.ad);
  /* each group: radio when only 1 can be picked; otherwise checkboxes that stop at the group's maximum */
  $('#sheet').querySelectorAll('[data-grp]').forEach(box => { const max = +box.dataset.max; box.querySelectorAll('input[type=checkbox]').forEach(x => x.addEventListener('change', () => {
    const on = [...box.querySelectorAll('input:checked')]; box.querySelectorAll('input[type=checkbox]').forEach(y => { y.disabled = !y.checked && on.length >= max; }); })); });
  const calc = () => { if (!ok) return; const q = Pricing.food({ foods: [{ ...F, deliveryEnabled: true, pickupEnabled: true }] }, { bizId: F.bizId, lines: [{ itemId: id, qty: +$('#iQ').textContent, addons: adds() }], fulfillment: 'quote' }); if (q.ok) $('#iAdd').textContent = 'Add · ' + peso(q.subtotal); };
  $('#sheet').querySelectorAll('[data-ad]').forEach(x => x.addEventListener('change', calc)); calc();
  $('#iAdd').onclick = () => {
    const chk = Pricing.addonCheck(it, adds()); if (chk.error) { toast(chk.error.replace(it.name + ': ', '')); const g = $('#sheet').querySelector('[data-grp].need'); return; }
    const line = { uid: uid(), itemId: id, qty: +$('#iQ').textContent, addons: adds(), note: $('#iNote').value.trim() };
    const add = () => { cart.foodBiz = F.bizId; cart.food.push(line); saveCart(); closeSheet(); toast(it.name + ' added'); };
    if (cart.food.length && cart.foodBiz && cart.foodBiz !== F.bizId) {
      const other = storeOf(cart.foodBiz);
      openSheet(`<div class="sbody"><h2>Start a new order?</h2><p class="meta" style="margin-top:6px">Your cart has items from ${esc(other ? other.storeName : 'another restaurant')}. One food order can only be from one restaurant.</p><div class="row2 mt"><button class="btn ghost" onclick="closeSheet()">Keep current order</button><button class="btn" id="newOrd">Start new order</button></div></div>`);
      $('#newOrd').onclick = () => { cart.food = []; add(); };
      return;
    }
    add();
  };
}

/* ================= TOURS & OTHER SERVICES ================= */
function tourCard(t) {
  const pr = Pricing.promo(t);
  return `<button class="card" onclick="openTour('${t.id}')"><div class="thumb">${t.photo ? photoOr(t.photo) : sceneArt(t.category === 'service' ? 'group' : 'boat')}</div>
  <div class="cbody"><span class="brandl">${esc(bizName(t.bizId))} · ${esc(townOf(t))}</span><h3>${esc(t.name)}</h3><span class="meta">${esc(String(t.desc || '').slice(0, 110))}</span>
  <div class="price">${pr ? `<span class="was">${peso(t.rate)}</span>` : ''}<b>${peso(Pricing.off(t.rate, pr))}</b> / ${t.rateUnit === 'group' ? 'group' : 'person'}${pr ? `<span class="promo">-${pr}%</span>` : ''}</div></div></button>`;
}
function renderTours() {
  const el = $('#toursBody'); if (!el) return;
  if (!isLive('tours')) { el.innerHTML = `<div class="locslot" style="margin-bottom:10px"></div>` + soonBlock('boat', 'Things to do are coming soon', 'Island hopping, guided tours and other services from local operators. Meanwhile, order food or rent a scooter.'); renderLocSlots(); return; }
  const all = CAT.tours.filter(t => t.active), list = all.filter(t => inTown(townOf(t))), T = list.filter(t => t.category !== 'service'), Sv = list.filter(t => t.category === 'service');
  if (!all.length) { el.innerHTML = `<div class="empty" style="padding-top:30px"><div class="big">${ic('boat', 40)}</div><h2 style="font-size:28px;color:var(--ink)">Tours & other services</h2><p style="margin-top:8px">Coming soon! Island hopping, guided tours, transfers and more from partners across Romblon.</p><div class="soonlist"><span>Island hopping</span><span>Waterfall & river trips</span><span>Port & airport transfers</span><span>Laundry & errands</span></div><button class="btn ghost mt" data-go="list">List your tour or service</button></div>`; return; }
  el.innerHTML = `<div class="locslot" style="margin-bottom:10px"></div><h2 class="kh" style="margin-top:0">Things to do</h2>
    ${T.length ? `<div class="shead"><h2>Tours</h2></div><div class="grid">${T.map(tourCard).join('')}</div>` : ''}
    ${Sv.length ? `<div class="shead mt"><h2>Other services</h2></div><div class="grid">${Sv.map(tourCard).join('')}</div>` : ''}
    ${!list.length ? emptyTown('tours or services') : ''}`;
  renderLocSlots();
}
function openTour(id) {
  const t = CAT.tours.find(x => x.id === id); if (!t) return;
  const times = String(t.times || '08:00').split(',').map(x => x.trim()).filter(Boolean), pax = t.category === 'service' ? 'persons' : 'guests';
  openSheet(`<div class="thumb">${t.photo ? photoOr(t.photo) : sceneArt(t.category === 'service' ? 'group' : 'boat')}</div><div class="sbody"><span class="brandl">${esc(bizName(t.bizId))} · ${esc(townOf(t))}</span><h2>${esc(t.name)}</h2>
    <p class="meta" style="margin-top:4px;white-space:pre-line">${esc(t.desc || '')}</p>${t.location ? `<p class="hint">${ic('pin', 14)} ${esc(t.location)}</p>` : ''}
    <p class="hint">${(+t.durationHours || 1)} hour${+t.durationHours > 1 ? 's' : ''} · up to ${t.maxPax} ${pax}${t.deposit ? ' · ' + peso(t.deposit) + ' refundable deposit' : ''}</p>
    <div class="row2 mt"><div class="field"><label>Date</label><input type="date" id="tD" min="${today}" value="${addDays(today, 1)}"></div><div class="field"><label>Start time</label><select id="tT">${times.map(x => `<option value="${x}">${fmtT(x)}</option>`).join('')}</select></div></div>
    <div class="field mt"><label>Number of ${pax}</label><select id="tP">${Array.from({ length: Math.max(1, +t.maxPax || 1) }, (_, i) => `<option value="${i + 1}" ${i === 1 ? 'selected' : ''}>${i + 1}</option>`).join('')}</select></div>
    <div class="sum" id="tSum"></div><div class="err" id="tErr"></div><button class="btn full mt" id="tAdd">Add to cart</button></div>`);
  const line = () => ({ type: 'tour', itemId: id, date: $('#tD').value, time: $('#tT').value, pax: +$('#tP').value });
  const calc = () => { const l = line(), q = Pricing.tour(CAT, l); if (q.error) { $('#tSum').innerHTML = ''; $('#tErr').textContent = q.error; $('#tAdd').disabled = true; return; }
    const busy = isBusy('tour', id, q.start, q.end); $('#tErr').textContent = busy ? 'That time is already booked. Choose another date or time.' : ''; $('#tAdd').disabled = busy;
    $('#tSum').innerHTML = `<div class="l t"><span>Total</span><span>${q.promoPct ? `<span class="was">${peso(q.listTotal)}</span>` : ''}${peso(q.total)}</span></div><div class="l due"><span>Downpayment (${CAT.business.downpaymentPct || 50}%)</span><span>${peso(Math.round(q.total * (CAT.business.downpaymentPct || 50) / 100))}</span></div>`; };
  ['tD', 'tT', 'tP'].forEach(x => $('#' + x).onchange = calc); calc();
  $('#tAdd').onclick = () => { cart.booking.push(Object.assign({ uid: uid() }, line())); saveCart(); closeSheet(); toast(t.name + ' added to cart'); };
}

/* ================= CART ================= */
function renderBadges() {
  const n = cart.booking.length + cart.food.reduce((t, l) => t + l.qty, 0);
  $('#cartBadge').textContent = n || ''; $('#cartBadge').dataset.n = n;
  const fn = cart.food.reduce((t, l) => t + l.qty, 0);
  const q = fn ? Pricing.food(CAT, { bizId: cart.foodBiz, lines: cart.food, fulfillment: 'quote' }) : null;
  $('#floatcart').classList.toggle('show', currentView === 'food' && fn > 0);
  $('#fcText').textContent = fn + ' item' + (fn > 1 ? 's' : '') + (q && q.ok ? ' · ' + peso(q.subtotal) : '');
  $('#acctBtn').classList.toggle('signed', !!session);
  const b2 = $('#cartBadge2'); b2.textContent = n || ''; b2.dataset.n = n;
  const first = session && session.profile && session.profile.name ? session.profile.name.split(' ')[0] : '';
  $('#loginPill').textContent = session ? (first ? 'Hi, ' + first : 'Account') : 'Log in';
  $('#bnAcct').textContent = session ? 'Account' : 'Log in';
}
function bookingLineHtml(c) {
  if (c.type === 'tour') {
    const t = CAT.tours.find(x => x.id === c.itemId), q = Pricing.tour(CAT, c);
    return `<div class="citem"><div class="ci">${t && t.photo ? `<img src="${esc(t.photo)}">` : ic('boat', 22)}</div><div class="cx"><b>${esc(t ? t.name : 'Unavailable')}</b><div class="d">${q.ok ? fmtDT(q.start) : esc(c.date)} · ${c.pax} ${t && t.category === 'service' ? 'person' : 'guest'}${c.pax > 1 ? 's' : ''}</div>${q.error ? `<div class="err">${q.error}</div>` : ''}<button class="rm" onclick="rmB('${c.uid}')">Remove</button></div><b>${q.ok ? peso(q.total) : ''}</b></div>`;
  }
  if (c.type === 'stay') {
    const st = CAT.stays.find(s => s.id === c.itemId), q = Pricing.stay(CAT, c);
    return `<div class="citem"><div class="ci">${st && st.photo ? `<img src="${esc(st.photo)}">` : ic('bed', 22)}</div><div class="cx"><b>${esc(st ? st.name : 'Unavailable')}</b><div class="d">${fmtD(c.checkin)} → ${fmtD(c.checkout)} · ${q.nights || '?'} night${q.nights > 1 ? 's' : ''} · ${c.guests} guest${c.guests > 1 ? 's' : ''}</div>${q.error ? `<div class="err">${q.error}</div>` : ''}<button class="rm" onclick="rmB('${c.uid}')">Remove</button></div><b>${q.ok ? peso(q.total) : ''}</b></div>`;
  }
  const u = CAT.rentals.units.find(x => x.id === c.itemId), q = Pricing.rental(CAT, c);
  return `<div class="citem"><div class="ci">${u && u.photo ? `<img src="${esc(u.photo)}">` : ic('scooter', 22)}</div><div class="cx"><b>${esc(u ? u.name : 'Unavailable')}</b><div class="d">${fmtDT(c.start)} → ${fmtDT(c.end)} · ${q.days || '?'}d${q.extraHours ? ' ' + q.extraHours + 'h' : ''} · ${c.helmets} helmet${c.helmets > 1 ? 's' : ''}<br>${q.ok ? esc(q.pickup) + (q.ret !== q.pickup ? ' → ' + esc(q.ret) : '') : ''}</div>${q.error ? `<div class="err">${q.error}</div>` : ''}<button class="rm" onclick="rmB('${c.uid}')">Remove</button></div><b>${q.ok ? peso(q.total) : ''}</b></div>`;
}
function foodLineHtml(c, i) {
  const it = (cartStore() || { items: [] }).items.find(x => x.id === c.itemId);
  if (!it) return '';
  const q = Pricing.food(CAT, { bizId: cart.foodBiz, lines: [c], fulfillment: 'quote' });
  const ck = Pricing.addonCheck(it, c.addons), adds = ck.names || [];
  return `<div class="citem"><div class="ci" style="background:#f3e9dd">${it.photo ? `<img src="${esc(it.photo)}">` : ic('cup', 22)}</div><div class="cx"><b>${esc(it.name)}</b><div class="d">${adds.length ? esc(adds.join(', ')) : 'No add-ons'}${c.note ? ' · “' + esc(c.note) + '”' : ''}</div>
  <div class="qty" style="margin-top:6px"><button onclick="fq(${i},-1)">−</button><span>${c.qty}</span><button onclick="fq(${i},1)">+</button></div></div><b>${q.ok ? peso(q.subtotal) : ''}</b></div>`;
}
function rmB(u) { cart.booking = cart.booking.filter(x => x.uid !== u); saveCart(); renderCart(); renderStays(); renderRides(); }
function fq(i, d) { cart.food[i].qty += d; if (cart.food[i].qty < 1) cart.food.splice(i, 1); if (!cart.food.length) cart.foodBiz = null; saveCart(); renderCart(); }
function renderCart() {
  const hasB = cart.booking.length, hasF = cart.food.length;
  if (!hasB && !hasF) { $('#cartBody').innerHTML = `<div class="empty"><div class="big">${ic('receipt', 40)}</div><p>Your cart is empty.</p><div style="display:flex;gap:8px;justify-content:center;margin-top:14px;flex-wrap:wrap"><button class="btn navy" data-go="stays">Find a stay</button><button class="btn ghost" data-go="rentals">Rent a scooter</button><button class="btn ghost" data-go="food">Order food</button></div></div>`; return; }
  let h = '';
  if (hasB) {
    const q = Pricing.booking(CAT, cart.booking);
    h += `<div class="cgroup"><h3>Stays, rentals & tours</h3>${cart.booking.map(bookingLineHtml).join('')}
      ${q.ok ? `<div class="sum"><div class="l t" style="margin:0;border:0;padding-top:0"><span>Total</span><span>${peso(q.total)}</span></div><div class="l due"><span>Downpayment due now (${q.pct}%)</span><span>${peso(q.dueNow)}</span></div><div class="l"><span>Balance on check-in / pick-up</span><span>${peso(q.balance)}</span></div>${q.deposit ? `<div class="l"><span>Security deposit at pick-up</span><span>${peso(q.deposit)}</span></div>` : ''}</div>` : ''}
      <button class="btn full mt" onclick="checkoutBooking()" ${q.ok ? '' : 'disabled'}>Checkout · pay ${q.ok ? peso(q.dueNow) : ''} downpayment</button></div>`;
  }
  if (hasF) {
    const q = Pricing.food(CAT, { bizId: cart.foodBiz, lines: cart.food, fulfillment: 'quote' });
    h += `<div class="cgroup"><h3>${esc((cartStore() || {}).storeName || 'Food')} order</h3>${cart.food.map(foodLineHtml).join('')}
      ${q.ok ? `<div class="sum"><div class="l t" style="margin:0;border:0;padding-top:0"><span>Subtotal</span><span>${peso(q.subtotal)}</span></div><div class="l"><span>Delivery fee</span><span>calculated at checkout</span></div>${earnText(cart.foodBiz, q.subtotal) ? `<div class="l earn"><span>${ic('star', 14)} Earn ${earnText(cart.foodBiz, q.subtotal)} reward points with this order</span><span></span></div>` : ''}</div>` : `<div class="err">${q.error}</div>`}
      <button class="btn navy full mt" onclick="checkoutFood()" ${q.ok ? '' : 'disabled'}>Checkout food order</button></div>`;
  }
  $('#cartBody').innerHTML = h;
}

/* ================= SIGN-IN ================= */
function requireSignIn(next) {
  if (session && session.profile && session.profile.name && session.profile.phone && session.profile.address) return next();
  openSignIn(next);
}
function signedIn(r, next, pre, msg) { session = { token: r.token, profile: r.profile }; store('tr4_session', session); loading(false); renderBadges(); startCustomerNotif(); if (msg) toast(msg); openProfileSheet(next, pre); }
/* Log in: email + password (or Google) */
function openSignIn(next, email) {
  if (session && session.token) return openProfileSheet(next);
  openSheet(`<div class="sbody"><h2>Log in</h2><p class="meta" style="margin-top:4px">Welcome back! Log in with your email and password${window.GOOGLE_CLIENT ? ', or continue with Google' : ''}.</p>
    ${googleBlock()}
    <div class="field mt"><label>Email</label><input type="email" id="siE" autocomplete="email" placeholder="you@email.com" value="${esc(email || '')}"></div>
    ${pwField('siP', 'Password', 'current-password')}
    <div class="err" id="siErr"></div><button class="btn navy full mt" id="siBtn">Log in</button>
    <button class="link" style="display:block;margin:12px auto 0" id="toForgot">Forgot password?</button>
    <p class="meta swap">New to Tara Romblon? <button class="link" id="toSignUp">Create an account</button></p></div>`);
  mountGoogle(next, 'signin'); wireEyes();
  $('#toSignUp').onclick = () => openSignUp(next);
  $('#toForgot').onclick = () => openForgot(next, $('#siE').value.trim().toLowerCase());
  const go = async () => {
    $('#siErr').textContent = '';
    const e = $('#siE').value.trim().toLowerCase(), pw = $('#siP').value;
    if (!validEmail(e)) { $('#siErr').textContent = 'Enter a valid email address.'; return; }
    if (!pw) { $('#siErr').textContent = 'Enter your password.'; return; }
    loading(true, 'Logging in…');
    try { signedIn(await api('login', { email: e, password: pw }), next); }
    catch (x) { loading(false); const m = x.message.replace(/^NO_PASSWORD: /, ''); $('#siErr').innerHTML = esc(m) + (/NO_PASSWORD|Forgot/.test(x.message) ? ` <button class="link" onclick="openForgot(null,'${esc(e)}')">Set a password</button>` : ''); }
  };
  $('#siBtn').onclick = go; $('#siP').onkeydown = ev => { if (ev.key === 'Enter') go(); };
}
/* Create account: Google in one tap, or name + mobile + email + password. Address is asked right after. */
function openSignUp(next) {
  if (session && session.token) return openProfileSheet(next);
  openSheet(`<div class="sbody"><h2>Create your account</h2><p class="meta" style="margin-top:4px">Book stays, rentals, food and tours across Romblon, and keep your reward points in one place.</p>
    ${googleBlock('signup')}
    <div class="field mt"><label>Full name</label><input id="suN" autocomplete="name" placeholder="Juan dela Cruz"></div>
    <div class="field mt"><label>Mobile number</label><input id="suP" inputmode="tel" autocomplete="tel" placeholder="09XX XXX XXXX"></div>
    <div class="field mt"><label>Email</label><input type="email" id="suE" autocomplete="email" placeholder="you@email.com"></div>
    ${pwField('suW', 'Create a password (at least 8 characters)', 'new-password')}${pwField('suW2', 'Confirm password', 'new-password')}
    <div class="err" id="suErr"></div><button class="btn navy full mt" id="suBtn">Create account</button>
    <p class="meta swap">Already have an account? <button class="link" id="toSignIn">Log in</button></p></div>`);
  mountGoogle(next, 'signup'); wireEyes();
  $('#toSignIn').onclick = () => openSignIn(next);
  $('#suBtn').onclick = async () => {
    $('#suErr').textContent = '';
    const pre = { name: $('#suN').value.trim(), phone: $('#suP').value.trim() }, e = $('#suE').value.trim().toLowerCase(), pw = $('#suW').value;
    if (pre.name.length < 2) { $('#suErr').textContent = 'Enter your full name.'; return; }
    if (!validPhone(pre.phone)) { $('#suErr').textContent = 'Enter a valid PH mobile number (e.g. 0917 123 4567).'; return; }
    if (!validEmail(e)) { $('#suErr').textContent = 'Enter a valid email address.'; return; }
    if (pw.length < 8) { $('#suErr').textContent = 'Your password must be at least 8 characters.'; return; }
    if (pw !== $('#suW2').value) { $('#suErr').textContent = 'The passwords do not match.'; return; }
    loading(true, 'Creating your account…');
    try { signedIn(await api('signUp', { email: e, password: pw, name: pre.name }), next, pre, 'Welcome to Tara Romblon!'); }
    catch (x) { loading(false); const m = x.message.replace(/^NO_PASSWORD: /, ''); $('#suErr').innerHTML = esc(m) + (/already/.test(m) ? ` <button class="link" onclick="${/NO_PASSWORD/.test(x.message) ? `openForgot(null,'${esc(e)}')">Set a password` : `openSignIn(null,'${esc(e)}')">Log in`}</button>` : ''); }
  };
}
/* Forgot password / set a password for an older account: one-time code by email, then a new password */
function openForgot(next, email) {
  openSheet(`<div class="sbody"><h2>Reset your password</h2><p class="meta" style="margin-top:4px">We'll email you a 6-digit code so you can set a new password.</p>
    <div class="field mt"><label>Email</label><input type="email" id="fgE" autocomplete="email" value="${esc(email || '')}"></div>
    <div class="err" id="fgErr"></div><button class="btn navy full mt" id="fgBtn">Send reset code</button>
    <button class="link" style="display:block;margin:12px auto 0" id="fgBack">Back to log in</button></div>`);
  $('#fgBack').onclick = () => openSignIn(next, $('#fgE').value.trim());
  $('#fgBtn').onclick = async () => {
    const e = $('#fgE').value.trim().toLowerCase(); if (!validEmail(e)) { $('#fgErr').textContent = 'Enter a valid email address.'; return; }
    loading(true, 'Sending code…');
    try { const r = await api('pwResetSend', { email: e }); loading(false);
      openSheet(`<div class="sbody"><h2>Set a new password</h2><p class="meta" style="margin-top:4px">Enter the code we sent to <b>${esc(e)}</b> (check spam too) and choose a new password.</p>
        ${r.demoCode ? `<div class="warn">Demo mode: your code is <b>${r.demoCode}</b></div>` : ''}
        <div class="field mt"><label>6-digit code</label><input id="fgC" class="otp" inputmode="numeric" maxlength="6" autocomplete="one-time-code"></div>
        ${pwField('fgW', 'New password (at least 8 characters)', 'new-password')}${pwField('fgW2', 'Confirm new password', 'new-password')}
        <div class="err" id="fgErr"></div><button class="btn navy full mt" id="fgOk">Save password and log in</button></div>`);
      wireEyes();
      $('#fgOk').onclick = async () => { const pw = $('#fgW').value;
        if (pw.length < 8) { $('#fgErr').textContent = 'Your password must be at least 8 characters.'; return; } if (pw !== $('#fgW2').value) { $('#fgErr').textContent = 'The passwords do not match.'; return; }
        loading(true, 'Saving…'); try { signedIn(await api('pwReset', { email: e, code: $('#fgC').value.trim(), password: pw }), next, null, 'Password saved. You are logged in.'); } catch (x) { loading(false); $('#fgErr').textContent = x.message; } };
    } catch (x) { loading(false); $('#fgErr').textContent = x.message; }
  };
}
/* "Continue with Google" (only when GOOGLE_CLIENT_ID is set on the server) */
function googleBlock(mode) { return window.GOOGLE_CLIENT ? `<div class="gwrap mt"><div id="gBtn" class="gbtn" data-mode="${mode || 'signin'}"></div></div><div class="ordiv"><span>or with email</span></div>` : ''; }
let gsiLoading = null, gsiReady = false, gsiNext = null;
function loadGsi() {
  if (window.google && google.accounts && google.accounts.id) return Promise.resolve();
  return gsiLoading || (gsiLoading = new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = 'https://accounts.google.com/gsi/client'; sc.async = true; sc.onload = res; sc.onerror = () => { gsiLoading = null; rej(new Error('Could not load Google sign-in. Check your connection, or use your email.')); }; document.head.appendChild(sc); }));
}
async function mountGoogle(next, mode) {
  const el = $('#gBtn'); if (!el || !window.GOOGLE_CLIENT) return;
  try {
    await loadGsi(); if (!document.body.contains(el)) return;
    gsiNext = next; /* where to go after Google sign-in (the latest screen wins) */
    if (!gsiReady) { google.accounts.id.initialize({ client_id: window.GOOGLE_CLIENT, callback: r => googleDone(r.credential, gsiNext), ux_mode: 'popup' }); gsiReady = true; }
    google.accounts.id.renderButton(el, { theme: 'outline', size: 'large', shape: 'pill', text: mode === 'signup' ? 'signup_with' : 'continue_with', logo_alignment: 'center', width: Math.max(220, Math.min(380, el.offsetWidth || 320)) });
  } catch (x) { el.innerHTML = `<p class="err">${esc(x.message)}</p>`; }
}
async function googleDone(credential, next) {
  loading(true, 'Signing in with Google…');
  try { const r = await api('googleSignIn', { credential }); session = { token: r.token, profile: r.profile }; store('tr4_session', session); loading(false); renderBadges(); startCustomerNotif(); if (r.created) toast('Welcome to Tara Romblon!'); openProfileSheet(next); }
  catch (x) { loading(false); const er = $('#siErr') || $('#suErr'); if (er) er.textContent = x.message; else toast(x.message); }
}
function profileFields(p) {
  return `<div class="field mt"><label>Full name</label><input id="pfN" autocomplete="name" value="${esc(p.name)}"></div>
    <div class="field mt"><label>Contact number</label><input id="pfP" inputmode="tel" autocomplete="tel" placeholder="09XX XXX XXXX" value="${esc(p.phone)}"></div>
    <div class="field mt"><label>Address</label><textarea id="pfA" rows="2" autocomplete="street-address" placeholder="House no., street, barangay, town, province">${esc(p.address)}</textarea></div>
    <div class="field mt"><label>Birthday (optional, for birthday reward points)</label><input id="pfB" type="date" max="${today}" value="${esc(p.birthday || '')}"></div>
    <div class="field mt"><label>Email (used to sign in)</label><input value="${esc(p.email)}" disabled></div>`;
}
async function saveProfileFromFields(errSel) {
  const pr = { name: $('#pfN').value.trim(), phone: $('#pfP').value.trim(), address: $('#pfA').value.trim() };
  if ($('#pfB')) pr.birthday = $('#pfB').value;
  if (!pr.name) { $(errSel).textContent = 'Enter your full name.'; return false; }
  if (!validPhone(pr.phone)) { $(errSel).textContent = 'Enter a valid PH mobile number (e.g. 0917 123 4567).'; return false; }
  if (pr.address.length < 5) { $(errSel).textContent = 'Enter your address.'; return false; }
  loading(true, 'Saving…');
  try { const r = await api('saveProfile', { token: session.token, profile: pr }); session.profile = r.profile; store('tr4_session', session); loading(false); return true; }
  catch (x) { loading(false); $(errSel).textContent = x.message; if (/sign in/i.test(x.message)) signOut(); return false; }
}
function openProfileSheet(next, pre) {
  const p = session.profile || {};
  if (p.name && p.phone && p.address && next) { closeSheet(); return next(); }
  /* sign-up form values fill the blanks (they are saved with the address below) */
  const shown = Object.assign({}, p, { name: p.name || (pre && pre.name) || '', phone: p.phone || (pre && pre.phone) || '' });
  openSheet(`<div class="sbody"><h2>${p.name || p.phone ? 'Your details' : 'Almost done'}</h2><p class="meta" style="margin-top:4px">We need these for your bookings and deliveries.</p>${profileFields(shown)}
    <div class="err" id="pfErr"></div><button class="btn navy full mt" id="pfBtn">Save and continue</button></div>`);
  $('#pfBtn').onclick = async () => { if (await saveProfileFromFields('#pfErr')) { closeSheet(); toast('Signed in as ' + session.profile.email); if (next) next(); else go('account'); } };
}
function startCustomerNotif() {
  Chat.token = () => session && session.token; Chat.me = session && session.profile;
  $('#bellSlot').innerHTML = session ? bellBtn() : ''; if (session) refreshActive();
  if (session) Notif.start(session.token, 'c_' + session.profile.email, () => { if (currentView === 'messages') renderMessages(); if (currentView === 'account') renderAccount(); if (currentView === 'orders') renderOrders(true); else refreshActive(); refreshAvailability(); }); else Notif.stop();
}
function signOut() { session = null; store('tr4_session', null); window._myB = []; activeBadges(); if (currentView === 'orders') renderOrders(); startCustomerNotif(); renderBadges(); if (currentView === 'account') renderAccount(); if (currentView === 'messages') renderMessages(); }

/* ================= CHECKOUT: STAYS & RENTALS ================= */
const SET = () => Object.assign({}, DEFAULT_SETTINGS, CAT.settings || {});
const UP = {};
function uploadField(id, label, mode, hint) {
  if (mode === 'off') return '';
  return `<div class="field mt"><label>${esc(label)}${mode === 'required' ? ' *' : ' (optional)'}</label>${hint ? `<span class="hint">${esc(hint)}</span>` : ''}
    <label class="upbox" id="${id}Box">${ic('upload', 22)}<span id="${id}Txt">Tap to take or choose a photo</span><input type="file" accept="image/*" capture="environment" id="${id}" hidden></label></div>`;
}
function wireUpload(id) {
  const el = $('#' + id); if (!el) return; delete UP[id];
  el.onchange = async () => { const f = el.files[0]; if (!f) return; try { UP[id] = await resizeImage(f, 1400); $('#' + id + 'Box').classList.add('done'); $('#' + id + 'Box').innerHTML = `<img src="${UP[id]}" alt=""><span>Photo added. Tap to change.</span>`; $('#' + id + 'Box').appendChild(el); } catch (x) { toast('That file is not an image.'); } };
}
function payChoice(name, opts) { return `<div class="opts one">${opts.map((o, i) => `<label><input type="radio" name="${name}" value="${o[0]}" ${i ? '' : 'checked'}> ${ic(o[0] === 'online' ? 'card' : o[0] === 'transfer' ? 'wallet' : o[0] === 'cod' ? 'cash' : 'store')} ${o[1]}</label>`).join('')}</div>`; }
/* First stay/rental booking needs a verified ID */
function verifyGate(next) {
  const v = (session.profile.verify || {}).status || 'unverified';
  if (!SET().requireIdVerification || v === 'verified') return next();
  if (v === 'pending') return openSheet(`<div class="sbody confirm"><div class="ok">${ic('clock', 34)}</div><h2>ID under review</h2><p class="meta" style="max-width:380px;margin:6px auto 0">Thanks for uploading your ID. Our team will verify it shortly, and we'll notify you in the app and by email. Your cart is saved.</p><button class="btn navy mt" onclick="closeSheet()">OK</button></div>`);
  openSheet(`<div class="sbody"><h2>Verify your account</h2><p class="meta" style="margin-top:4px">Before your first stay or rental booking, please upload a valid government ID. This keeps bookings safe for guests and hosts. It is reviewed by Beyond Tech Solutions and kept private.</p>
    ${v === 'rejected' ? `<div class="warn">Your previous ID could not be verified${session.profile.verify.note ? ': ' + esc(session.profile.verify.note) : ''}. Please upload a clearer photo.</div>` : ''}
    <div class="field mt"><label>ID type</label><select id="idType">${["Driver's license", 'Passport', 'UMID / SSS', 'PhilSys National ID', "Voter's ID", 'PRC ID', 'Postal ID', 'Other government ID'].map(t => `<option>${t}</option>`).join('')}</select></div>
    ${uploadField('idUp', 'Photo of your ID', 'required', 'Make sure your name and photo are clear.')}<div class="err" id="idErr"></div><button class="btn full mt" id="idGo">Submit for verification</button></div>`);
  wireUpload('idUp');
  $('#idGo').onclick = async () => {
    if (!UP.idUp) { $('#idErr').textContent = 'Add a photo of your ID.'; return; }
    loading(true, 'Uploading…');
    try { const r = await api('submitId', { token: session.token, idType: $('#idType').value, dataUrl: UP.idUp }); session.profile = r.profile; store('tr4_session', session); loading(false); verifyGate(next); }
    catch (x) { loading(false); $('#idErr').textContent = x.message; }
  };
}
/* ================= DISCOUNT CODES & REWARD POINTS AT CHECKOUT ================= */
const PROMO = { code: null, split: {}, redeem: {}, rewards: [] };
async function loadRewards() { PROMO.rewards = []; if (!session) return []; try { const r = await api('myRewards', { token: session.token }); PROMO.rewards = r.rewards; PROMO.mobile = r.mobile; } catch (e) { } return PROMO.rewards; }
const bizRec = id => (CAT.businesses || []).find(b => b.id === id);
const earnText = (id, amount) => { const n = Rules.pointsEstimate(bizRec(id), amount); return n > 0 ? n : 0; };
const rwRule = p => `1 point for every ${peso(p.pesoPerPoint)} spent · 1 point = ${peso(p.pointValue)} off · redeem from ${p.minRedeem} points in steps of ${p.redeemStep}`;
const promoFor = id => { const r = PROMO.rewards.find(x => x.bizId === id), pts = +PROMO.redeem[id] || 0; return Pricing.round((PROMO.split[id] || 0) + (r ? pts * r.program.pointValue : 0)); };
const promoTotal = () => Object.keys(Object.assign({}, PROMO.split, PROMO.redeem)).reduce((t, id) => t + promoFor(id), 0);
function promoHtml() {
  return `<h3 class="ck">Discount code & reward points</h3><div class="pcrow"><input id="pcIn" placeholder="Discount code" autocapitalize="characters" autocomplete="off"><button class="btn ghost" id="pcBtn" type="button">Apply</button></div><div id="pcMsg" class="hint"></div><div id="ptBox"></div>`;
}
/* amounts(): { bizId: amount before discounts }; onChange(): recompute the summary */
async function wirePromo(amounts, onChange) {
  Object.assign(PROMO, { code: null, split: {}, redeem: {} });
  const pts = () => {
    const a = amounts(), list = PROMO.rewards.filter(r => a[r.bizId] > 0);
    $('#ptBox').innerHTML = list.map(r => { const P = r.program, room = a[r.bizId] - (PROMO.split[r.bizId] || 0), opts = Rules.redeemOptions(P, r.balance, room);
      if (PROMO.redeem[r.bizId] && opts.indexOf(PROMO.redeem[r.bizId]) < 0) PROMO.redeem[r.bizId] = 0;
      const short = Math.max(0, P.minRedeem - r.balance), earn = earnText(r.bizId, Math.max(0, room - (+PROMO.redeem[r.bizId] || 0) * P.pointValue));
      return `<div class="ptrow">${ic('star')}<div><b>${esc(r.name)} reward points: ${r.balance}</b>
        <span class="hint">${short ? `Redeem points once you reach ${P.minRedeem} points. You need ${short} more.` : `Redeem in steps of ${P.redeemStep} points (1 point = ${peso(P.pointValue)} off).`}${earn ? ` You'll earn ${earn} point${earn === 1 ? '' : 's'} when this is completed.` : ''}</span>
        ${PROMO.mobile ? `<span class="hint">Points are linked to your mobile number ${esc(PROMO.mobile)}.</span>` : ''}</div>
        <select data-redeem="${esc(r.bizId)}" ${opts.length ? '' : 'disabled'}><option value="0">${opts.length ? "Don't redeem points" : 'Redeem points (from ' + P.minRedeem + ' points)'}</option>${opts.map(o => `<option value="${o}" ${+PROMO.redeem[r.bizId] === o ? 'selected' : ''}>Redeem ${o} points (-${peso(o * P.pointValue)})</option>`).join('')}</select></div>`; }).join('');
    document.querySelectorAll('[data-redeem]').forEach(x => x.onchange = () => { PROMO.redeem[x.dataset.redeem] = +x.value; pts(); onChange(); });
  };
  $('#pcBtn').onclick = async () => {
    if (PROMO.code) { PROMO.code = null; PROMO.split = {}; $('#pcIn').value = ''; $('#pcIn').disabled = false; $('#pcBtn').textContent = 'Apply'; $('#pcMsg').textContent = ''; pts(); onChange(); return; }
    const code = $('#pcIn').value.trim(); if (!code) { $('#pcMsg').textContent = 'Enter a discount code.'; return; }
    $('#pcBtn').disabled = true;
    try { const r = await api('checkCode', { token: session.token, code, amounts: amounts() }); PROMO.code = r.code.code; PROMO.split = r.split;
      $('#pcIn').value = r.code.code; $('#pcIn').disabled = true; $('#pcBtn').textContent = 'Remove'; $('#pcMsg').innerHTML = `<b class="ok">${esc(r.code.code)} applied: -${peso(Object.values(r.split).reduce((t, v) => t + v, 0))}</b>${r.code.name ? ' · ' + esc(r.code.name) : ''}${r.code.desc ? '<br>' + esc(r.code.desc) : ''}`; }
    catch (x) { PROMO.code = null; PROMO.split = {}; $('#pcMsg').innerHTML = `<span class="err" style="margin:0">${esc(x.message)}</span>`; }
    $('#pcBtn').disabled = false; pts(); onChange();
  };
  $('#pcIn').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('#pcBtn').click(); } };
  await loadRewards(); pts(); onChange();
}
const promoPayload = () => ({ code: PROMO.code || undefined, redeem: Object.keys(PROMO.redeem).some(k => PROMO.redeem[k]) ? PROMO.redeem : undefined });

/* Rentals: the customer reads and accepts the Rental Terms and Conditions before the checkout page opens */
let RENTAL_OK = null;
function rentalTermsGate(next) {
  const q = Pricing.booking(CAT, cart.booking); if (q.error || !q.lines.some(l => l.type === 'rental')) return next();
  const units = [...new Set(q.lines.filter(l => l.type === 'rental').map(l => bizName(l.bizId)))].join(', ');
  openSheet(`<div class="sbody"><span class="brandl">${esc(units)}</span><h2>Rental Terms and Conditions</h2><p class="meta" style="margin-top:4px">Please read and accept these terms before you continue to checkout.</p>
    <div class="policy termsbox" id="rtBox" tabindex="0">${esc(CAT.business.rentalTerms || '')}</div>
    <label class="check"><input type="checkbox" id="rtOk"><span>I have read and accept the Rental Terms and Conditions.</span></label>
    <div class="row2 mt"><button class="btn ghost" onclick="closeSheet()">Cancel</button><button class="btn" id="rtGo" disabled>Accept and continue</button></div></div>`);
  $('#rtOk').onchange = () => { $('#rtGo').disabled = !$('#rtOk').checked; };
  $('#rtGo').onclick = () => { if (!$('#rtOk').checked) return; RENTAL_OK = { at: new Date().toISOString(), text: CAT.business.rentalTerms || '' }; next(); };
}
function checkoutBooking() {
  requireSignIn(() => verifyGate(() => rentalTermsGate(() => {
    const q = Pricing.booking(CAT, cart.booking); if (q.error) { toast(q.error); return; }
    const p = session.profile, st = SET(), rentals = q.lines.some(l => l.type === 'rental');
    const bizs = [...new Set(q.lines.map(l => l.bizId))];
    const pays = [['online', `Pay ${peso(q.dueNow)} now via HitPay — GCash, Maya & other e-wallets, QR Ph or card`]].concat(st.transferEnabled ? [['transfer', `Bank or e-wallet transfer of ${peso(q.dueNow)} (upload proof)`]] : []);
    openSheet(`<div class="sbody"><h2>Confirm your booking</h2>${bizs.length > 1 ? `<p class="hint" style="margin-top:4px">This creates ${bizs.length} bookings, one per business (${bizs.map(bizName).map(esc).join(', ')}), paid together.</p>` : ''}
      <div class="sum">${q.lines.map(l => `<div class="l"><span>${esc(l.label)}<br><small>${esc(bizName(l.bizId))} · ${l.type === 'stay' ? fmtD(l.start) + ' to ' + fmtD(l.end) + ' · ' + l.nights + 'N' : l.type === 'tour' ? fmtDT(l.start) + ' · ' + l.pax + ' pax' : fmtDT(l.start) + ' to ' + fmtDT(l.end)}</small></span><span>${peso(l.total)}</span></div>`).join('')}
        <div id="bSum"></div></div>
      ${promoHtml()}
      <h3 class="ck">Guest details</h3>${profileFields(p)}
      ${uploadField('ckId', 'Photo of a valid ID for check-in / pick-up', st.idUploadAtCheckout)}
      <div class="field mt"><label>Notes (arrival time, requests)</label><textarea id="ckN" rows="2"></textarea></div>
      <h3 class="ck">Payment</h3>${payChoice('bpay', pays)}
      <div id="trBox" style="display:none"><div class="warn">${esc(st.transferInstructions)}</div>${uploadField('ckProof', 'Payment proof (receipt screenshot)', st.proofUpload)}</div>
      <div class="field mt"><label>Cancellation & refund policy</label></div><div class="policy">${esc(CAT.business.refundPolicy)}</div>
      ${rentals ? `<details class="okline"><summary>${ic('check', 16)} You accepted the Rental Terms and Conditions <span class="link">View</span></summary><div class="policy">${esc(CAT.business.rentalTerms || '')}</div></details>` : ''}
      <label class="check"><input type="checkbox" id="ckAgree"><span>I have read and agree to the cancellation & refund policy.</span></label>
      <div class="err" id="ckErr"></div><button class="btn full mt" id="ckBtn" style="padding:15px">Pay ${peso(q.dueNow)} downpayment</button></div>`);
    wireUpload('ckId'); wireUpload('ckProof');
    const pm = () => document.querySelector('input[name=bpay]:checked').value;
    const bizAmt = () => { const a = {}; q.lines.forEach(l => a[l.bizId] = Pricing.round((a[l.bizId] || 0) + l.total)); return a; };
    let due = q.dueNow;
    const sum = () => { const a = bizAmt(), red = promoTotal(); due = Object.keys(a).reduce((t, id) => t + Math.round((a[id] - promoFor(id)) * q.pct / 100), 0); const tot = Pricing.round(q.total - red);
      $('#bSum').innerHTML = `${red ? `<div class="l"><span>Subtotal</span><span>${peso(q.total)}</span></div>${PROMO.code ? `<div class="l ok"><span>Code ${esc(PROMO.code)}</span><span>-${peso(Object.values(PROMO.split).reduce((t, v) => t + v, 0))}</span></div>` : ''}${Object.keys(PROMO.redeem).filter(k => PROMO.redeem[k]).map(k => `<div class="l ok"><span>${PROMO.redeem[k]} points · ${esc(bizName(k))}</span><span>-${peso(promoFor(k) - (PROMO.split[k] || 0))}</span></div>`).join('')}` : ''}
        <div class="l t"><span>Total</span><span>${peso(tot)}</span></div><div class="l due"><span>Pay now: ${q.pct}% downpayment</span><span>${peso(due)}</span></div><div class="l"><span>Balance on check-in / pick-up</span><span>${peso(tot - due)}</span></div>
        ${q.deposit ? `<div class="l"><span>Security deposit at pick-up (refundable)</span><span>${peso(q.deposit)}</span></div>` : ''}
        ${Object.keys(a).map(id => { const e = earnText(id, a[id] - promoFor(id)); return e ? `<div class="l earn"><span>${ic('star', 14)} ${esc(bizName(id))} points you'll earn when completed</span><span>+${e}</span></div>` : ''; }).join('')}`;
      $('#ckBtn').textContent = pm() === 'transfer' ? 'Submit booking' : 'Pay ' + peso(due) + ' downpayment'; };
    sum(); wirePromo(bizAmt, sum);
    document.querySelectorAll('input[name=bpay]').forEach(r => r.onchange = () => { $('#trBox').style.display = pm() === 'transfer' ? '' : 'none'; sum(); });
    $('#ckBtn').onclick = async () => {
      if (!$('#ckAgree').checked) { $('#ckErr').textContent = 'Please agree to the cancellation & refund policy.'; return; }
      if (st.idUploadAtCheckout === 'required' && !UP.ckId) { $('#ckErr').textContent = 'Please add a photo of your ID.'; return; }
      if (pm() === 'transfer' && st.proofUpload === 'required' && !UP.ckProof) { $('#ckErr').textContent = 'Please upload your payment proof.'; return; }
      if (!await saveProfileFromFields('#ckErr')) return;
      loading(true, 'Creating your booking…');
      try {
        const r = await api('createBooking', { token: session.token, kind: 'booking', lines: cart.booking, notes: $('#ckN').value.trim(), agree: true, rentalTerms: rentals ? RENTAL_OK : null, payMethod: pm(), idPhoto: UP.ckId || '', proofPhoto: pm() === 'transfer' ? UP.ckProof || '' : '', ...promoPayload() });
        cart.booking = []; saveCart(); loading(false); afterCreate(r);
      } catch (x) {
        loading(false);
        if (/^ID_(REQUIRED|PENDING)/.test(x.message)) { const m = await api('me', { token: session.token }); session.profile = m.profile; store('tr4_session', session); return verifyGate(checkoutBooking); }
        $('#ckErr').textContent = x.message; refreshAvailability();
      }
    };
  })));
}

/* Free address suggestions (OpenStreetMap / Photon), used when Google's address search is unavailable (no key, or over its daily limit) */
function osmSearch(F, setPin) {
  const box = $('#mapSearch'); if (!box) return;
  box.innerHTML = `<div class="osmsearch"><input id="osmQ" type="search" placeholder="Search your address or a landmark" autocomplete="off" aria-label="Search address"><div class="osmlist" id="osmList" role="listbox"></div></div>`;
  const q = $('#osmQ'), list = $('#osmList'); let t = null, seq = 0;
  const label = p => [p.name, p.street && (p.housenumber ? p.housenumber + ' ' : '') + p.street, p.district || p.locality, p.city || p.county, p.state].filter((x, i, a) => x && a.indexOf(x) === i).join(', ');
  q.oninput = () => { clearTimeout(t); const v = q.value.trim(); if (v.length < 3) { list.innerHTML = ''; return; }
    t = setTimeout(async () => { const my = ++seq;
      try { const r = await fetch('https://photon.komoot.io/api/?' + new URLSearchParams({ q: v, lat: F.lat, lon: F.lng, limit: 6, lang: 'en', bbox: '116.9,4.5,126.7,21.2' })); const j = await r.json(); if (my !== seq) return;
        const it = (j.features || []).filter(f => f.properties && f.properties.countrycode === 'PH');
        list.innerHTML = it.length ? it.map((f, i) => `<button type="button" role="option" data-osm="${i}">${ic('pin', 14)} <span><b>${esc(f.properties.name || label(f.properties))}</b><small>${esc(label(f.properties))}</small></span></button>`).join('') : '<div class="hint" style="padding:8px">No matches. Try a barangay or landmark, or tap the map.</div>';
        list.querySelectorAll('[data-osm]').forEach(b => b.onclick = () => { const f = it[+b.dataset.osm], [lng, lat] = f.geometry.coordinates, nm = f.properties.name || label(f.properties);
          setPin(lat, lng, true); list.innerHTML = ''; q.value = nm; const a = $('#pinAddr'); if (a) a.textContent = '📍 ' + label(f.properties); const lm = $('#lmk'); if (lm && !lm.value.trim()) lm.value = nm; });
      } catch (e) { if (my === seq) list.innerHTML = '<div class="hint" style="padding:8px">Address search is unavailable right now. Tap the map or use your current location.</div>'; } }, 350); };
}
/* Google Maps location picker for delivery: address search (Places), tap or drag the pin, store marker, address of the pin */
async function googlePicker(elId, F, setPin, fallback) {
  window.gm_authFailure = () => { console.warn('Google Maps key rejected'); const m = $('#' + elId); if (m && fallback) { window._pinMove = null; const n = m.cloneNode(false); m.replaceWith(n); fallback(); } };
  await loadGoogle();
  const [{ Map, Circle }, { AdvancedMarkerElement }] = await Promise.all([google.maps.importLibrary('maps'), google.maps.importLibrary('marker')]);
  const el = $('#' + elId); if (!el) return;
  const store = { lat: +F.lat, lng: +F.lng };
  const map = new Map(el, { center: store, zoom: 15, mapId: MAPCFG.mapId || 'DEMO_MAP_ID', disableDefaultUI: true, zoomControl: true, fullscreenControl: true, gestureHandling: 'greedy', clickableIcons: false });
  const tag = (cls, html) => { const e = document.createElement('div'); e.className = 'tpin ' + cls; e.innerHTML = html; return e; };
  new AdvancedMarkerElement({ map, position: store, content: tag('store', ic('cup', 16)), title: F.storeName });
  const R = Pricing.deliveryRule(CAT), max = +F.maxKm || R.maxKm;
  try { new Circle({ map, center: store, radius: max * 1000, strokeColor: '#13305a', strokeOpacity: .35, strokeWeight: 1, fillColor: '#13305a', fillOpacity: .04, clickable: false }); } catch (e) { }
  const pin = new AdvancedMarkerElement({ map, position: store, content: tag('dest', ic('home', 16)), title: 'Delivery location', gmpDraggable: true, zIndex: 10 }); pin.element && (pin.element.style.opacity = '.45');
  let geocoder = null; try { const { Geocoder } = await google.maps.importLibrary('geocoding'); geocoder = new Geocoder(); } catch (e) { }
  const showAddr = (lat, lng, label) => { const a = $('#pinAddr'); if (!a) return; if (label) { a.textContent = '📍 ' + label; return; } a.textContent = '📍 Pin set — drag it to adjust'; if (!geocoder) return;
    geocoder.geocode({ location: { lat, lng } }).then(r => { const L = r.results || [], x = L.find(y => !(y.types || []).includes('plus_code') && !/^[23456789CFGHJMPQRVWX]{4,}\+/.test(y.formatted_address)) || L[0]; if (x && $('#pinAddr') && st_same(lat, lng)) $('#pinAddr').textContent = '📍 ' + x.formatted_address; }).catch(() => { geocoder = null; }); };
  let last = null; const st_same = (a, b) => last && last[0] === a && last[1] === b;
  window._pinMove = (lat, lng, center) => { pin.position = { lat, lng }; if (pin.element) pin.element.style.opacity = '1'; if (center) { map.panTo({ lat, lng }); if (map.getZoom() < 16) map.setZoom(17); } last = [lat, lng]; showAddr(lat, lng); };
  pin.addListener('dragend', () => { const p = pin.position, lat = typeof p.lat === 'function' ? p.lat() : p.lat, lng = typeof p.lng === 'function' ? p.lng() : p.lng; setPin(lat, lng); });
  map.addListener('click', e => setPin(e.latLng.lat(), e.latLng.lng()));
  /* address search */
  try {
    const { PlaceAutocompleteElement } = await google.maps.importLibrary('places');
    const pac = new PlaceAutocompleteElement({ includedRegionCodes: ['ph'], locationBias: { center: store, radius: Math.max(5000, max * 1000) } });
    pac.setAttribute('placeholder', 'Search your address or a landmark'); pac.className = 'gpac';
    const box = $('#mapSearch'); if (box) { box.innerHTML = ''; box.appendChild(pac); }
    let swapped = false; const swap = () => { if (swapped) return; swapped = true; console.warn('Google address search unavailable; using OpenStreetMap suggestions'); osmSearch(F, setPin); };
    pac.addEventListener('gmp-requesterror', swap); pac.addEventListener('gmp-error', swap);
    pac.addEventListener('gmp-select', async ev => {
      try { const place = ev.placePrediction.toPlace(); await place.fetchFields({ fields: ['location', 'formattedAddress', 'displayName'] }); if (!place.location) return;
        setPin(place.location.lat(), place.location.lng(), true); showAddr(0, 0, [place.displayName, place.formattedAddress].filter(Boolean).join(' · '));
        const lm = $('#lmk'); if (lm && !lm.value.trim()) lm.value = place.displayName || place.formattedAddress || ''; } catch (e) { toast('Could not open that place. Tap the map instead.'); }
    });
  } catch (e) { console.warn('Places search not available', e); osmSearch(F, setPin); }
}

/* ================= CHECKOUT: FOOD ================= */
function checkoutFood() {
  requireSignIn(() => {
    const F = cartStore(), p = session.profile;
    const st = { ful: F.deliveryEnabled ? 'delivery' : 'pickup', lat: null, lng: null };
    openSheet(`<div class="sbody"><h2>Checkout — ${esc(F.storeName)}</h2>
      <div class="opts" style="margin-top:12px">${F.deliveryEnabled ? `<label><input type="radio" name="ful" value="delivery" ${st.ful === 'delivery' ? 'checked' : ''}> ${ic('scooter')} Delivery</label>` : ''}${F.pickupEnabled ? `<label><input type="radio" name="ful" value="pickup" ${st.ful === 'pickup' ? 'checked' : ''}> ${ic('store')} Pick-up</label>` : ''}</div>
      <div id="delBox">
        <div class="field mt"><label>Pin your delivery location</label><span class="hint">Search your address, tap the map or drag the pin. Fee is based on distance from ${esc(F.storeName)}.</span></div><div id="mapSearch"></div><div class="hint" id="pinAddr"></div>
        <div class="map" id="map"></div>
        <button class="btn ghost sm mt" id="geoBtn" type="button">${ic('nav')} Use my current location</button>
        <div class="field mt"><label>House / landmark for the rider</label><input id="lmk" value="${esc(p.address)}"></div>
      </div>
      <div id="pickBox" class="warn" style="display:none">Pick up at ${esc(F.storeName)}, ${esc(F.address)}. We'll text you when your order is ready.</div>
      <h3 style="margin:18px 0 0;font-size:18px">Your details</h3>${profileFields(p)}
      <div class="field mt"><label>Notes</label><input id="ckN"></div>
      ${promoHtml()}
      <h3 style="margin:18px 0 0;font-size:18px">Payment</h3><div class="opts one" id="payOpts"></div><div id="codWhy"></div>
      <div id="ftrBox" style="display:none"><div class="warn">${esc(SET().transferInstructions)}</div>${uploadField('fProof', 'Payment proof (receipt screenshot)', SET().proofUpload)}</div>
      <div class="sum" id="fSum"></div><div class="err" id="ckErr"></div>
      <button class="btn full mt" id="ckBtn" style="padding:15px">Place order</button></div>`);
    const payOpts = () => {
      const o = [];
      const qq = quote(), codWhy = st.ful === 'delivery' && F.codEnabled ? Rules.codBlock(SET(), window._myB ? Rules.completedCount(window._myB) : 0, qq.error ? (Pricing.food(CAT, { bizId: F.bizId, lines: cart.food, fulfillment: 'quote' }).subtotal || 0) : qq.total, session.profile && session.profile.created) : null;
      if (st.ful === 'delivery' && F.codEnabled && !codWhy) o.push(['cod', 'Cash on delivery']);
      if (st.ful === 'pickup') o.push(['pickup', 'Pay upon pick-up']);
      if (F.onlineEnabled) o.push(['online', 'Pay online via HitPay — GCash, Maya & other e-wallets, QR Ph or card']);
      if (SET().transferEnabled) o.push(['transfer', 'Bank or e-wallet transfer (upload proof)']);
      const cur = (document.querySelector('input[name=pay]:checked') || {}).value;
      $('#payOpts').innerHTML = o.map((x, i) => `<label><input type="radio" name="pay" value="${x[0]}" ${(cur ? cur === x[0] : i === 0) ? 'checked' : ''}> ${ic(x[0] === 'online' ? 'card' : x[0] === 'transfer' ? 'wallet' : x[0] === 'cod' ? 'cash' : 'store')} ${x[1]}</label>`).join('');
      if (!document.querySelector('input[name=pay]:checked') && o.length) document.querySelector('input[name=pay]').checked = true;
      $('#ftrBox').style.display = (document.querySelector('input[name=pay]:checked') || {}).value === 'transfer' ? '' : 'none';
      $('#codWhy').innerHTML = codWhy ? `<div class="hint" data-codwhy>${ic('cash', 14)} ${esc(codWhy)}</div>` : '';
    };
    const quote = () => Pricing.food(CAT, { bizId: F.bizId, lines: cart.food, fulfillment: st.ful, lat: st.lat, lng: st.lng });
    const calc = () => {
      $('#delBox').style.display = st.ful === 'delivery' ? '' : 'none'; $('#pickBox').style.display = st.ful === 'pickup' ? '' : 'none';
      payOpts();
      const q = quote();
      if (q.error) { $('#fSum').innerHTML = `<div class="l">${esc(q.error)}</div>`; $('#ckBtn').disabled = true; return q; }
      $('#ckBtn').disabled = false;
      const pay = (document.querySelector('input[name=pay]:checked') || {}).value, red = promoTotal(), tot = Pricing.round(q.total - red);
      $('#fSum').innerHTML = `${q.lines.map(l => `<div class="l"><span>${l.qty}× ${esc(l.name)}${l.addons.length ? '<br><small>' + esc(l.addons.join(', ')) + '</small>' : ''}</span><span>${peso(l.total)}</span></div>`).join('')}
        <div class="l"><span>Subtotal</span><span>${peso(q.subtotal)}</span></div>
        ${PROMO.code ? `<div class="l ok"><span>Code ${esc(PROMO.code)}</span><span>-${peso(PROMO.split[F.bizId] || 0)}</span></div>` : ''}${PROMO.redeem[F.bizId] ? `<div class="l ok"><span>${PROMO.redeem[F.bizId]} reward points</span><span>-${peso(promoFor(F.bizId) - (PROMO.split[F.bizId] || 0))}</span></div>` : ''}
        ${st.ful === 'delivery' ? `<div class="l"><span>Delivery fee${q.km != null ? ' (' + q.km + ' km)' : ''}</span><span>${q.deliveryFee ? peso(q.deliveryFee) : 'Free'}</span></div><div class="hint" style="margin:-2px 0 6px" data-delrule>${esc(Pricing.deliveryText(CAT, F))}</div>` : ''}
        <div class="l t"><span>Total</span><span>${peso(tot)}</span></div>${(e => e ? `<div class="l earn"><span>${ic('star', 14)} Points you'll earn when completed</span><span>+${e}</span></div>` : '')(earnText(F.bizId, q.subtotal - promoFor(F.bizId)))}`;
      $('#ckBtn').textContent = pay === 'online' ? 'Pay ' + peso(tot) + ' online' : pay === 'transfer' ? 'Submit order · ' + peso(tot) : 'Place order · ' + peso(tot);
      return q;
    };
    document.querySelectorAll('input[name=ful]').forEach(r => r.addEventListener('change', () => { st.ful = r.value; calc(); if (st.ful === 'delivery') setTimeout(() => window._map && window._map.invalidateSize(), 50); }));
    $('#payOpts').addEventListener('change', calc);
    const setPin = (lat, lng, center) => { st.lat = +lat.toFixed(6); st.lng = +lng.toFixed(6); if (window._pinMove) window._pinMove(st.lat, st.lng, center); calc(); };
    $('#geoBtn').onclick = () => {
      if (!navigator.geolocation) { toast('Location is not available on this device. Tap the map instead.'); return; }
      $('#geoBtn').disabled = true; $('#geoBtn').textContent = 'Finding your location…';
      navigator.geolocation.getCurrentPosition(pos => { $('#geoBtn').disabled = false; $('#geoBtn').innerHTML = ic('locate') + ' Use my current location'; setPin(pos.coords.latitude, pos.coords.longitude, true); },
        e => { $('#geoBtn').disabled = false; $('#geoBtn').innerHTML = ic('locate') + ' Use my current location'; $('#ckErr').textContent = e && e.code === 1 ? 'Location is blocked. Turn on location services and allow this site, or tap the map to pin your location.' : 'Could not detect your location. Turn on Location / GPS and try again, or tap the map.'; }, { enableHighAccuracy: true, timeout: 12000 });
    };
    window._pinMove = null;
    const osmMap = () => loadMap('map', F.lat, F.lng, (map) => {
      L.marker([F.lat, F.lng], { icon: L.divIcon({ html: ic('cup', 16), className: 'storepin', iconSize: [28, 28] }) }).addTo(map).bindTooltip(F.storeName);
      window._mk = L.marker([F.lat, F.lng], { draggable: true, opacity: .4 }).addTo(map);
      window._pinMove = (a, b, center) => { window._mk.setLatLng([a, b]).setOpacity(1); if (center) map.setView([a, b], 16); };
      window._mk.on('dragend', e => { const ll = e.target.getLatLng(); setPin(ll.lat, ll.lng); });
      map.on('click', e => setPin(e.latlng.lat, e.latlng.lng));
    });
    if (!(window.MAPCFG && MAPCFG.key)) osmSearch(F, setPin);
    if (window.MAPCFG && MAPCFG.key) googlePicker('map', F, setPin, () => { osmMap(); osmSearch(F, setPin); }).catch(e => { console.warn('Google Maps picker', e); if ($('#map')) { $('#map').innerHTML = ''; osmMap(); osmSearch(F, setPin); } }); else osmMap();
    calc(); if (F.codEnabled) api('myBookings', { token: session.token }).then(r => { window._myB = r.bookings; calc(); }).catch(() => {}); wireUpload('fProof'); wirePromo(() => ({ [F.bizId]: Pricing.food(CAT, { bizId: F.bizId, lines: cart.food, fulfillment: 'quote' }).subtotal || 0 }), calc);
    $('#ckBtn').onclick = async () => {
      const q = calc(); if (!q || q.error) return;
      if ((document.querySelector('input[name=pay]:checked') || {}).value === 'transfer' && SET().proofUpload === 'required' && !UP.fProof) { $('#ckErr').textContent = 'Please upload your payment proof.'; return; }
      if (!await saveProfileFromFields('#ckErr')) return;
      const pay = (document.querySelector('input[name=pay]:checked') || {}).value;
      if (!pay) { $('#ckErr').textContent = 'Choose a payment option.'; return; }
      loading(true, 'Placing your order…');
      try {
        const r = await api('createBooking', { token: session.token, kind: 'food', bizId: F.bizId, lines: cart.food, fulfillment: st.ful, lat: st.lat, lng: st.lng, landmark: st.ful === 'delivery' ? $('#lmk').value.trim() : '', payMethod: pay, notes: $('#ckN').value.trim(), proofPhoto: pay === 'transfer' ? UP.fProof || '' : '', ...promoPayload() });
        cart.food = []; cart.foodBiz = null; saveCart(); loading(false); afterCreate(r);
      } catch (x) { loading(false); $('#ckErr').textContent = x.message; }
    };
  });
}

/* ================= AFTER CREATE / PAYMENT ================= */
function afterCreate(r) {
  if (r.payUrl === 'demo') return demoPay(r);
  if (r.payUrl) { store('tr5_pending', r.group); loading(true, 'Opening secure payment…'); location.href = r.payUrl; return; }
  showConfirm(r);
}
function demoPay(r) {
  openSheet(`<div class="sbody confirm" style="padding-top:30px"><div class="ok">${ic('card', 34)}</div><h2>HitPay checkout (demo)</h2>
    <p class="meta" style="margin-top:6px">With HitPay connected, customers go to HitPay's secure page to pay ${peso(r.dueNow)} by GCash, Maya, other e-wallets, QR Ph or card.</p>
    <div class="ref">${esc(r.group)}</div>
    <div style="display:grid;gap:8px;margin-top:14px"><button class="btn full" id="dpOk">Simulate successful payment</button><button class="btn ghost full" onclick="closeSheet();go('orders')">Pay later</button></div></div>`);
  $('#dpOk').onclick = async () => { const v = await api('verifyPayment', { group: r.group, demoPaid: true }); showConfirm({ ...r, bookings: v.bookings }); refreshAvailability(); };
}
function showConfirm(r) {
  const bs = r.bookings || [], paid = bs.length && bs.every(b => b.payStatus === 'Paid'), transfer = r.payMethod === 'transfer', waiting = bs.some(b => b.status === 'Awaiting Payment');
  openSheet(`<div class="sbody confirm" style="padding-top:34px"><div class="ok">${ic(paid ? 'check' : transfer ? 'upload' : waiting ? 'clock' : 'receipt', 34)}</div>
    <h2>${paid ? 'Payment received!' : transfer ? 'Booking received' : waiting ? 'Waiting for payment' : 'Order placed!'}</h2><div class="ref">${esc(r.group)}</div>
    <div class="sum" style="text-align:left">${bs.map(b => `<div class="l"><span>${esc(b.ref)} · ${esc(bizName(b.bizId))}</span>${statusChip(b.status)}</div>`).join('')}</div>
    <p class="meta" style="max-width:400px;margin:10px auto 0">${paid ? `Thank you! We received ${peso(r.dueNow || 0)}. Updates will appear in Messages and your email.` : transfer ? 'We will confirm your booking once your transfer is verified. You will be notified in the app and by email.' : waiting ? 'Your booking is saved but not yet paid. You can finish payment from your account.' : 'We have received your order. Follow its progress in your account and Messages.'}</p>
    <div style="display:grid;gap:8px;margin-top:18px"><button class="btn navy full" onclick="closeSheet();go('orders')">Track my order / booking</button><button class="btn ghost full" onclick="closeSheet();go('messages')">Messages</button></div></div>`);
}
async function checkReturnFromPayment() {
  const u = new URL(location.href), group = u.searchParams.get('paid'); if (!group) return;
  history.replaceState(null, '', location.pathname + location.hash);
  loading(true, 'Confirming your payment…');
  try { const v = await api('verifyPayment', { group }); loading(false); store('tr5_pending', null); showConfirm({ group, bookings: v.bookings, dueNow: v.bookings.reduce((t, b) => t + (+b.dueNow || 0), 0) }); }
  catch (x) { loading(false); toast(x.message); }
}
async function refreshAvailability() { try { const r = await api('availability'); BUSY = r.busy || []; renderStays(); renderRides(); } catch (e) { } }

/* ================= ACCOUNT ================= */
async function renderAccount() {
  const el = $('#accountBody');
  if (!session) { el.innerHTML = `<div class="empty"><div class="big">${ic('users', 40)}</div><h2 style="color:var(--ink)">Sign in to book</h2><p style="margin:8px 0 16px">You can browse and add to cart as a guest. Create a free account${window.GOOGLE_CLIENT ? ' with Google or your email' : ' with your email'} to check out.</p><div class="acbtns"><button class="btn navy" onclick="openSignUp()">Create account</button><button class="btn ghost" onclick="openSignIn()">Sign in</button></div></div>`; return; }
  const v = (session.profile.verify || {}).status || 'unverified';
  el.innerHTML = `<div class="shead"><div><h2>My account</h2><p>${esc(session.profile.email)}</p></div><button class="link" onclick="signOut()">Sign out</button></div>
    <div class="acard vcard ${v}"><h3><span class="hl">${ic('id')} ID verification</span><span class="schip ${v === 'verified' ? 'done' : v === 'rejected' ? 'bad' : 'wait'}">${{ verified: 'Verified', pending: 'Under review', rejected: 'Not approved', unverified: 'Not yet verified' }[v]}</span></h3>
      <p class="meta">${v === 'verified' ? 'You can book stays and rentals.' : v === 'pending' ? 'We are reviewing your ID. You will be notified once it is approved.' : 'Needed before your first stay or rental booking.'}</p>${v === 'unverified' || v === 'rejected' ? `<button class="btn sm mt" onclick="verifyGate(()=>{closeSheet();renderAccount()})">Upload ID</button>` : ''}</div>
    <div class="acard"><h3><span class="hl">${ic('star')} Reward points</span></h3><div id="myRw"><p class="meta">Loading…</p></div></div>
    <div class="acard"><h3>Profile</h3>${profileFields(session.profile)}<div class="err" id="acErr"></div><button class="btn navy mt" id="acSave">Save profile</button></div>
    <div class="acard"><h3><span class="hl">${ic('bell')} Notifications</span></h3><p class="meta">Get alerts on this phone for order updates, your rider and messages, even when the app is closed.</p><div id="pushBox" class="mt"></div></div>
    <div class="acard"><h3><span class="hl">${ic('shield')} Password</span></h3>${session.profile.hasPassword ? pwField('cpOld', 'Current password', 'current-password') : `<p class="meta">${session.profile.google ? 'You sign in with Google. You can also add a password to log in with your email.' : 'Add a password so you can log in with your email.'}</p>`}${pwField('cpNew', 'New password (at least 8 characters)', 'new-password')}<div class="err" id="cpErr"></div><button class="btn ghost mt" id="cpBtn">${session.profile.hasPassword ? 'Change password' : 'Save password'}</button></div>
    <div class="acard"><h3><span class="hl">${ic('receipt')} My orders & bookings</span></h3><p class="meta" id="myBsum">Loading…</p><button class="btn sm mt" data-go="orders">View all orders & bookings</button></div>`;
  $('#acSave').onclick = async () => { if (await saveProfileFromFields('#acErr')) toast('Profile saved'); };
  wireEyes(); Push.box('#pushBox', () => session && session.token);
  $('#cpBtn').onclick = async () => { const pw = $('#cpNew').value; if (pw.length < 8) { $('#cpErr').textContent = 'Your new password must be at least 8 characters.'; return; }
    loading(true, 'Saving…'); try { await api('changePassword', { token: session.token, current: $('#cpOld') ? $('#cpOld').value : '', password: pw }); loading(false); session.profile.hasPassword = true; store('tr4_session', session); toast('Password saved'); renderAccount(); } catch (x) { loading(false); $('#cpErr').textContent = x.message; } };
  try { const m = await api('me', { token: session.token }); session.profile = m.profile; store('tr4_session', session); } catch (x) { if (/sign in/i.test(x.message)) return signOut(); }
  loadRewards().then(rw => { const el2 = $('#myRw'); if (!el2) return;
    el2.innerHTML = rw.length ? rw.map(r => `<div class="rwrow"><div class="rwbal"><b>${r.balance}</b><span>points</span></div><div><b>${esc(r.name)}</b><span class="hint">Worth ${peso(r.balance * r.program.pointValue)} · earned ${r.earned} · redeemed ${r.redeemed}${r.source === 'loyverse' ? ' · includes in-store points' : ''}</span>
      <span class="hint">${r.balance >= r.program.minRedeem ? 'Ready to redeem at checkout' : 'Redeem once you reach ' + r.program.minRedeem + ' points (' + (r.program.minRedeem - r.balance) + ' to go)'}</span>
      ${r.history.length ? `<details><summary class="link">History</summary>${r.history.map(h => `<div class="hint">${new Date(h.at).toLocaleDateString('en-PH', { dateStyle: 'medium' })} · ${h.points > 0 ? '+' : ''}${h.points} · ${esc(h.note || h.type)}</div>`).join('')}</details>` : ''}</div></div>`).join('')
      : '<p class="meta">No merchants offer reward points yet.</p>';
    if (rw.length) el2.insertAdjacentHTML('beforeend', `<details class="mt"><summary class="link">How reward points work</summary><ul class="rwhow">
      <li>Your points are linked to your registered mobile number${PROMO.mobile ? ' (' + esc(PROMO.mobile) + ')' : ''}${rw.some(r => r.source === 'loyverse') ? ', the same number used at the store counter, so in-store and app points are one balance' : ''}.</li>
      ${rw.map(r => `<li><b>${esc(r.name)}:</b> ${rwRule(r.program)}.${r.program.signupBonus ? ' ' + r.program.signupBonus + ' bonus points on your first completed order.' : ''}${r.program.birthdayBonus ? ' ' + r.program.birthdayBonus + ' bonus points on your birthday (add it to your profile).' : ''}</li>`).join('')}
      <li>Points are added when your order or booking is marked Completed, based on what you paid for the items after discounts (delivery fees don't earn points).</li>
      <li>Redeem at checkout. If an order is cancelled, redeemed points are returned.</li></ul></details>`); });
  try { const r = await api('myBookings', { token: session.token }); window._myB = r.bookings; const a = r.bookings.filter(isActiveB).length; if ($('#myBsum')) $('#myBsum').textContent = r.bookings.length ? r.bookings.length + ' total · ' + (a ? a + ' in progress' : 'none in progress') : 'No orders or bookings yet.'; activeBadges(); }
  catch (x) { if ($('#myBsum')) $('#myBsum').textContent = x.message; if (/sign in/i.test(x.message)) signOut(); }
}
function bookingCard(b) {
  const lines = b.lines.map(l => `<li>${l.type ? esc(l.label) + ' · ' + esc(bookingDates(l)) : l.qty + ' x ' + esc(l.name) + (l.addons && l.addons.length ? ' (' + esc(l.addons.join(', ')) + ')' : '')}</li>`).join('')
    + (b.kind === 'food' ? `<li>${b.fulfillment === 'delivery' ? 'Delivery' : 'Pick-up'} · ${esc(Rules.PAY_LABEL[b.payMethod] || b.payMethod)}</li>` : '');
  return `<div class="trip"><div class="th"><span><span class="ref">${esc(b.ref)}</span><br><span class="hint">${kindIcon(b.kind)} ${esc(bizName(b.bizId))}</span></span>${statusChip(b.status)}</div>
    ${timeline(b)}${riderBlock(b)}<div class="meta">${new Date(b.created).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })} · Payment: <b>${esc(b.payStatus)}</b></div><ul style="margin-top:6px">${lines}</ul>
    ${Rules.reductions(b).total ? `<div class="hint">${b.code ? 'Code ' + esc(b.code.code) + ' -' + peso(b.code.amount) : ''}${b.code && b.points ? ' · ' : ''}${b.points ? b.points.points + ' points -' + peso(b.points.amount) : ''}</div>` : ''}${b.pointsAwarded ? `<div class="hint">${ic('star', 14)} You earned ${b.pointsAwarded} points</div>` : ''}
    <div class="rowbtns" style="margin:10px 0 0"><b style="margin-right:auto">Total ${peso(Rules.payable(b))}</b>
      ${b.status === 'Awaiting Payment' && b.payUrl && b.payUrl !== 'demo' ? `<a class="btn sm" href="${esc(b.payUrl)}">Pay ${peso(b.dueNow)}</a>` : ''}
      ${b.status === 'Awaiting Payment' && b.payUrl === 'demo' ? `<button class="btn sm" data-demopay="${esc(b.group)}">Pay ${peso(b.dueNow)}</button>` : ''}
      ${b.status === 'Awaiting Payment' && b.payMethod === 'transfer' ? `<button class="btn ghost sm" data-proof="${esc(b.group)}">${ic('upload')} ${b.proofFile ? 'Replace' : 'Upload'} payment proof</button>` : ''}
      ${canTrack(b) ? `<button class="btn sm track" onclick="Track.open('${esc(b.ref)}',session.token)">${ic('locate')} ${Rules.trackable(b) ? 'Track rider live' : 'Rider & map'}</button>` : ''}
      <button class="btn ghost sm" onclick="Chat.open({ref:'${esc(b.ref)}'})">${ic('chat')} Message ${esc(bizName(b.bizId))}</button>${b.rider && !Rules.CLOSED.includes(b.status) ? `<button class="btn ghost sm" onclick="Chat.open({ref:'${esc(b.ref)}',chan:'rider'})">${ic('bike')} Message rider</button>` : ''}</div>
    ${activityLog(b)}</div>`;
}
/* ===== MY ORDERS & BOOKINGS: every order and booking, its status, activity log, rider and live map ===== */
const isActiveB = b => !Rules.CLOSED.includes(b.status);
const canTrack = b => b.kind === 'food' && b.fulfillment === 'delivery' && !!b.rider && !Rules.CLOSED.includes(b.status) && !Rules.DELIVERED.includes(b.status);
function riderBlock(b) {
  if (b.kind !== 'food' || b.fulfillment !== 'delivery' || Rules.CLOSED.includes(b.status) && b.status !== 'Completed') return '';
  const r = b.riderInfo;
  if (!b.rider) return Rules.DELIVERED.includes(b.status) ? '' : b.status === 'Finding Rider' ? `<div class="rcard wait finding"><span class="spin"></span><div><b>Finding a nearby rider…</b><span class="hint">Your order goes to ${esc(bizName(b.bizId))} as soon as a rider accepts.</span></div><button class="btn ghost sm" onclick="custCancel('${esc(b.ref)}')">Cancel order</button></div>` : b.status === 'Awaiting Payment' ? '' : `<div class="rcard wait">${ic('bike', 18)}<div><b>Rider</b><span class="hint">Finding a rider…</span></div></div>`;
  const veh = [r && r.vehicle, r && r.plate].filter(Boolean).join(' · ');
  const st = Rules.DELIVERED.includes(b.status) ? 'Delivered your order' : !b.riderAccepted ? 'Waiting for the rider to accept' : b.status === 'Out for Delivery' ? 'On the way to you' : b.status === 'Ready for Pick-up' ? 'Picking up your order' : 'Heading to the store';
  return `<div class="rcard">${ic('bike', 18)}<div><b>${esc(r ? r.name : 'Your rider')}</b><span class="hint">${esc(st)}${veh ? ' · ' + esc(veh) : ''}</span></div>${r && r.phone && canTrack(b) ? `<a class="btn ghost sm" href="tel:${esc(String(r.phone).replace(/\s/g, ''))}">${ic('phone', 14)} Call</a>` : ''}</div>`;
}
async function custCancel(ref) { if (!confirm('Cancel order ' + ref + '?')) return; loading(true, 'Cancelling…'); try { await api('custCancel', { token: session.token, ref }); loading(false); toast('Order cancelled'); currentView === 'orders' ? renderOrders(true) : refreshActive(); } catch (x) { loading(false); toast(x.message); } }
function activityLog(b) {
  const h = (b.history || []).slice().reverse(); if (!h.length) return '';
  const who = x => x.role === 'customer' || !x.role ? '' : x.role === 'rider' ? 'Rider' : x.role === 'system' ? '' : x.role === 'super' ? 'Tara Romblon' : bizName(b.bizId);
  return `<details class="alog"><summary class="link">Activity (${h.length})</summary><ol>${h.map(x => `<li><b>${esc(x.status)}</b><span class="hint">${new Date(x.at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}${who(x) ? ' · ' + esc(who(x)) : ''}</span>${x.note ? `<span class="hint">${esc(x.note)}</span>` : ''}</li>`).join('')}<li><b>Placed</b><span class="hint">${new Date(b.created).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</span></li></ol></details>`;
}
function activeBadges() {
  const n = (window._myB || []).filter(isActiveB).length, el = $('#bnOrd'); if (el) { el.textContent = n; el.style.display = n ? '' : 'none'; }
  const h = $('#homeActive'); if (!h) return;
  const act = (window._myB || []).filter(isActiveB).slice(0, 3);
  h.innerHTML = act.map(b => `<div class="actbar"><span class="aic">${kindIcon(b.kind)}</span><div><b>${esc(bizName(b.bizId))} · ${esc(b.status)}</b><span class="hint">${esc(b.ref)}${b.riderInfo && canTrack(b) ? ' · rider ' + esc(b.riderInfo.name) : ''}</span></div>${canTrack(b) ? `<button class="btn sm" onclick="Track.open('${esc(b.ref)}',session.token)">${ic('locate', 14)} Track</button>` : `<button class="btn ghost sm" data-go="orders">View</button>`}</div>`).join('');
}
const ORD = { f: 'active', timer: null };
async function renderOrders(quiet) {
  const el = $('#ordBody'); if (!el) return;
  if (!session) { el.innerHTML = `<div class="empty"><div class="big">${ic('receipt', 40)}</div><h2 style="color:var(--ink)">Your orders & bookings</h2><p style="margin:8px 0 16px">Log in to see the status of your orders and bookings and track your rider.</p><button class="btn navy" onclick="openSignIn()">Log in</button></div>`; return; }
  if (!quiet) el.innerHTML = `<div class="shead"><div><h2>My orders & bookings</h2><p>Status updates automatically</p></div></div><div class="empty">Loading…</div>`;
  let list; try { list = (await api('myBookings', { token: session.token })).bookings; window._myB = list; activeBadges(); }
  catch (x) { if (!quiet) el.innerHTML = `<div class="err">${esc(x.message)}</div>`; if (/sign in/i.test(x.message)) signOut(); return; }
  if (currentView !== 'orders') return;
  const open = [...document.querySelectorAll('#ordBody details.alog[open]')].map(d => d.dataset.ref);
  const F = [['active', 'In progress'], ['all', 'All'], ['food', 'Food'], ['rental', 'Rentals'], ['stay', 'Stays'], ['tour', 'Things to do'], ['past', 'Past']];
  const pick = list.filter(b => ORD.f === 'all' ? true : ORD.f === 'active' ? isActiveB(b) : ORD.f === 'past' ? !isActiveB(b) : b.kind === ORD.f);
  const cnt = k => list.filter(b => k === 'all' ? true : k === 'active' ? isActiveB(b) : k === 'past' ? !isActiveB(b) : b.kind === k).length;
  el.innerHTML = `<div class="shead"><div><h2>My orders & bookings</h2><p>${list.length} total · status updates automatically</p></div></div>
    <div class="chips ordf">${F.filter(f => f[0] === 'active' || f[0] === 'all' || cnt(f[0])).map(f => `<button class="${ORD.f === f[0] ? 'on' : ''}" data-ordf="${f[0]}">${f[1]} <span>${cnt(f[0])}</span></button>`).join('')}</div>
    <div id="myB">${pick.length ? pick.map(bookingCard).join('') : `<div class="empty">${ORD.f === 'active' ? 'Nothing in progress right now.' : 'Nothing here yet.'}${list.length ? '' : `<p class="mt"><button class="btn" data-go="food">Order food</button> <button class="btn ghost" data-go="rentals">Rent a scooter</button></p>`}</div>`}</div>`;
  document.querySelectorAll('#ordBody details.alog').forEach((d, i) => { d.dataset.ref = pick[i] && pick[i].ref; if (open.includes(d.dataset.ref)) d.open = true; });
  document.querySelectorAll('[data-ordf]').forEach(x => x.onclick = () => { ORD.f = x.dataset.ordf; renderOrders(true); });
  wireMyBookings();
  clearTimeout(ORD.timer); ORD.timer = setTimeout(() => { if (currentView === 'orders' && !$('#ov').classList.contains('show')) renderOrders(true); else if (currentView === 'orders') ORD.timer = setTimeout(() => renderOrders(true), 15000); }, 15000);
}
async function refreshActive() { if (!session) return; try { window._myB = (await api('myBookings', { token: session.token })).bookings; activeBadges(); } catch (x) { } }
function wireMyBookings() {
  document.querySelectorAll('[data-demopay]').forEach(x => x.onclick = () => { const bs = window._myB.filter(b => b.group === x.dataset.demopay); demoPay({ group: x.dataset.demopay, dueNow: bs.reduce((t, b) => t + b.dueNow, 0), bookings: bs }); });
  document.querySelectorAll('[data-proof]').forEach(x => x.onclick = () => {
    openSheet(`<div class="sbody"><h2>Upload payment proof</h2><div class="warn">${esc(SET().transferInstructions)}</div>${uploadField('lateProof', 'Receipt screenshot', 'required')}<div class="err" id="lpErr"></div><button class="btn full mt" id="lpGo">Upload</button></div>`);
    wireUpload('lateProof');
    $('#lpGo').onclick = async () => { if (!UP.lateProof) { $('#lpErr').textContent = 'Choose a photo.'; return; } loading(true); try { await api('uploadProof', { token: session.token, group: x.dataset.proof, dataUrl: UP.lateProof }); loading(false); closeSheet(); toast('Payment proof sent'); currentView === 'orders' ? renderOrders(true) : renderAccount(); } catch (e) { loading(false); $('#lpErr').textContent = e.message; } };
  });
}

/* ================= HOME CARDS / EXPLORE / MESSAGES ================= */
function sceneArt(kind) {
  const sky = { beach: ['#f7c59f', '#e98a5f'], house: ['#f2d6bd', '#b98c9a'], ride: ['#f9d29d', '#7d88b8'], cafe: ['#e9cdb0', '#6b4a2f'], boat: ['#fbd3a6', '#3b4f86'], sunset: ['#f7b38a', '#5b5f8f'], group: ['#f4c7b8', '#ee7a35'] }[kind] || ['#f7c59f', '#13305a'];
  const id = 'sa' + kind + Math.random().toString(36).slice(2, 6);
  const palm = (x, s) => `<g transform="translate(${x} ${300 - 160 * s}) scale(${s})" fill="none" stroke="#0a1c36" stroke-linecap="round"><path d="M20 160c4-50 10-90 2-130" stroke-width="7"/><path d="M22 30c-28-14-52-6-60 12M22 30c18-24 46-24 60-12M22 30c-8-24-28-34-48-30M22 30c24-10 48 0 52 20M22 30c-20 2-36 18-38 34" stroke-width="8"/></g>`;
  const fg = {
    beach: `<path d="M0 230 Q75 214 150 226 T300 222 V400 H0Z" fill="#13305a" opacity=".85"/><path d="M0 268 Q150 250 300 270 V400 H0Z" fill="#f1dcb8"/>${palm(30, 1.1)}${palm(230, .8)}`,
    house: `<path d="M0 262 Q150 246 300 262 V400 H0Z" fill="#f1dcb8"/><rect x="70" y="172" width="160" height="96" rx="4" fill="#f6f4f1"/><path d="M58 178h184l-92-58z" fill="#1b1f2a"/><rect x="92" y="196" width="34" height="30" fill="#b9c6e4"/><rect x="174" y="196" width="34" height="30" fill="#b9c6e4"/><rect x="134" y="214" width="32" height="54" fill="#6b4a2f"/>${palm(240, .75)}`,
    ride: `<rect y="260" width="300" height="140" fill="#1b3f73"/><path d="M0 300h300" stroke="#f6f4f1" stroke-width="4" stroke-dasharray="26 18"/><g transform="translate(60 168)"><circle cx="38" cy="96" r="26" fill="#0a1c36"/><circle cx="168" cy="96" r="26" fill="#0a1c36"/><path d="M24 84 Q36 46 86 54 L138 54 Q156 54 162 72 L180 88 Q174 94 162 92 L50 92 Q30 94 24 84Z" fill="#ee7a35"/><path d="M86 54 Q98 34 124 36 L138 36" stroke="#0a1c36" stroke-width="7" fill="none"/><path d="M146 22 L158 70" stroke="#0a1c36" stroke-width="7"/><path d="M138 20h26" stroke="#0a1c36" stroke-width="7" stroke-linecap="round"/></g>`,
    cafe: `<rect y="270" width="300" height="130" fill="#4a321f"/><g transform="translate(84 130)"><path d="M10 40h110v70a40 40 0 0 1-40 40H50a40 40 0 0 1-40-40z" fill="#f6f4f1"/><path d="M120 60h14a20 20 0 0 1 0 40h-14" stroke="#f6f4f1" stroke-width="10" fill="none"/><path d="M40 0c-8 12 8 18 0 30M70 0c-8 12 8 18 0 30M100 0c-8 12 8 18 0 30" stroke="#fff" stroke-width="5" fill="none" opacity=".7" stroke-linecap="round"/></g>`,
    boat: `<path d="M0 240 Q75 228 150 236 T300 234 V400 H0Z" fill="#13305a"/><g transform="translate(70 196)"><path d="M0 40h160l-24 26H22z" fill="#f6f4f1"/><path d="M-20 52 Q80 70 180 52" stroke="#f6f4f1" stroke-width="4" fill="none"/><rect x="60" y="14" width="44" height="26" fill="#ee7a35"/></g><path d="M0 300 Q150 286 300 300" stroke="#b9c6e4" stroke-width="3" fill="none" opacity=".6"/>`,
    sunset: `<circle cx="150" cy="220" r="60" fill="#fff3dc" opacity=".9"/><path d="M0 230 Q150 216 300 230 V400 H0Z" fill="#13305a"/>${palm(20, .9)}`,
    group: `<path d="M0 262 Q150 246 300 262 V400 H0Z" fill="#f1dcb8"/>${[60, 120, 180, 240].map((x, i) => `<g transform="translate(${x} ${200 + (i % 2) * 10})"><circle cx="0" cy="0" r="16" fill="#0a1c36"/><path d="M-22 70 Q-22 22 0 22 Q22 22 22 70z" fill="#0a1c36"/></g>`).join('')}`
  }[kind] || '';
  return `<svg class="art" viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient></defs><rect width="300" height="400" fill="url(#${id})"/><circle cx="235" cy="80" r="26" fill="#fff3dc" opacity=".85"/>${fg}</svg>`;
}
function kcard(c) { return `<button class="kcard" onclick="${c.go}">${c.photo ? `<img src="${esc(c.photo)}" alt="" loading="lazy">` : sceneArt(c.art)}${c.soon ? '<span class="soonb">Coming soon</span>' : ''}<div class="kt"><b>${esc(c.title)}</b><span>${esc(c.sub)}</span></div></button>`; }
function renderHomeCards() { }
function searchAll(q) {
  q = q.trim().toLowerCase(); const hit = (...f) => !q || f.join(' ').toLowerCase().includes(q);
  const isl = t => (ISLANDS.find(i => i.towns.includes(t)) || {}).name || '';
  const food = [];
  Pricing.stores(CAT).forEach(F => { const catName = id => (F.categories.find(c => c.id === id) || {}).name || ''; if (inTown(townOf(F))) F.items.forEach(i => { if (hit(i.name, i.desc, catName(i.catId), F.storeName, townOf(F), isl(townOf(F)), 'food drink eat restaurant')) food.push(Object.assign({ store: F }, i)); }); });
  return {
    stays: !isLive('stays') ? [] : CAT.stays.filter(s => s.active && inTown(townOf(s)) && hit(s.name, s.location, s.amenities, townOf(s), isl(townOf(s)), 'stay accommodation room beach house')),
    rides: CAT.rentals.units.filter(u => u.active && inTown(townOf(u)) && hit(u.name, u.desc, townOf(u), isl(townOf(u)), 'scooter motor rental rent ride')),
    tours: !isLive('tours') ? [] : CAT.tours.filter(t => t.active && inTown(townOf(t)) && hit(t.name, t.desc, t.location, townOf(t), isl(townOf(t)), bizName(t.bizId), t.category === 'service' ? 'service' : 'tour activity trip island')),
    food
  };
}
function xrow(img, icon, title, sub, price, onclick) { return `<button class="xrow" onclick="${onclick}"><div class="xi">${img ? `<img src="${esc(img)}" alt="">` : ic(icon, 24)}</div><div><b>${esc(title)}</b><span>${esc(sub)}</span></div><span class="xp">${price}</span></button>`; }
function renderExplore() {
  const q = $('#exQ').value, r = searchAll(q);
  const n = r.stays.length + r.rides.length + r.food.length + r.tours.length;
  let h = '';
  if (!q) h += `<div class="kpills" style="margin:0 0 6px"><button data-go="food">${ic('cup')} Food</button><button data-go="rentals">${ic('scooter')} Rentals</button><button data-go="stays">${ic('home')} Stays${isLive('stays') ? '' : '<span class="soonb on">Soon</span>'}</button><button data-go="tours">${ic('palm')} Things to do${isLive('tours') ? '' : '<span class="soonb on">Soon</span>'}</button></div>`;
  if (q) h += `<p class="meta" style="margin-top:14px">${n} result${n === 1 ? '' : 's'} for “${esc(q)}”</p>`;
  if (r.stays.length) h += `<div class="xsec">Stays</div>` + r.stays.map(s => xrow(s.photo, 'bed', s.name, s.location + ' · up to ' + s.maxGuests + ' guests', peso(s.rate) + '/night', `openStay('${s.id}')`)).join('');
  if (r.rides.length) h += `<div class="xsec">Scooter rentals</div>` + r.rides.map(u => xrow(u.photo, 'scooter', u.name, u.desc, peso(u.dailyRate) + '/day', `openRide('${u.id}')`)).join('');
  if (r.tours.length) h += `<div class="xsec">Tours & services</div>` + r.tours.map(t => xrow(t.photo, 'boat', t.name, bizName(t.bizId) + ' · ' + townOf(t), peso(Pricing.off(t.rate, Pricing.promo(t))) + '/' + (t.rateUnit === 'group' ? 'group' : 'pax'), `openTour('${t.id}')`)).join('');
  if (r.food.length) h += `<div class="xsec">Food</div>` + r.food.map(i => xrow(i.photo, 'cup', i.name, i.store.storeName + ' · ' + i.desc, peso(Pricing.off(i.price, Pricing.promo(i))), `S.store='${esc(i.store.bizId)}';openItem('${i.id}','${esc(i.store.bizId)}')`)).join('');
  const tq = q.trim().toLowerCase(), townHit = tq && TOWNS.find(t => t.toLowerCase() === tq || t.toLowerCase().startsWith(tq));
  if (!n && townHit) h += emptyTown('listings').replace(esc(locLabel()), esc(townHit));
  else if (!n) h += `<div class="empty"><div class="big">${ic('search', 40)}</div>Nothing found in ${esc(locLabel())}. Try “NMAX”, “ramen”, “pizza” or “latte”.</div>`;
  if (!q) { const c = townCounts(); h += `<div class="xsec">Browse by town</div>` + ISLANDS.map(i => `<div class="tisl"><div class="tislh2">${esc(i.name)}</div><div class="tgrid">${i.towns.map(t => `<button class="tbtn ${S.town === t ? 'on' : ''}" onclick="setTown('${t}')">${t}${c[t] ? '<i>' + c[t] + '</i>' : ''}</button>`).join('')}</div></div>`).join(''); }
  $('#exResults').innerHTML = h;
}
function cartBizIds() { const ids = cart.booking.map(c => { const it = c.type === 'stay' ? CAT.stays.find(x => x.id === c.itemId) : c.type === 'tour' ? CAT.tours.find(x => x.id === c.itemId) : CAT.rentals.units.find(x => x.id === c.itemId); return it && (it.bizId || (c.type === 'stay' ? 'hiraya' : 'baybayin')); }); if (cart.food.length && cart.foodBiz) ids.push(cart.foodBiz); return [...new Set(ids.filter(Boolean))]; }
async function renderMessages() {
  const el = $('#msgBody');
  if (!session) { el.innerHTML = `<h2 class="kh" style="margin-top:0">Messages</h2><div class="empty"><div class="big">${ic('chat', 40)}</div><p>Sign in to chat with businesses about items in your cart and your bookings.</p><button class="btn navy mt" onclick="openSignIn()">Sign in</button></div>`; return; }
  const inCart = cartBizIds();
  el.innerHTML = `<h2 class="kh" style="margin-top:0">Messages</h2>
    ${inCart.length ? `<div class="acard"><h3>Ask a business in your cart</h3><p class="meta">Questions before you book go straight to the business.</p><div class="rowbtns" style="margin:10px 0 0">${inCart.map(id => `<button class="btn ghost sm" onclick="Chat.open({inquiryBizId:'${id}',cartBizIds:cartBizIds()})">${ic('chat')} ${esc(bizName(id))}</button>`).join('')}</div></div>` : `<p class="meta" style="margin-bottom:12px">To ask a business a question, add one of its listings to your cart. You can message about any of your bookings below.</p>`}
    <div id="thrList"><div class="empty">Loading…</div></div>
    <div class="xsec">Start a chat about a booking</div><div id="bkChat"></div>`;
  try {
    const [t, r] = await Promise.all([api('threads', { token: session.token }), api('myBookings', { token: session.token })]);
    $('#thrList').innerHTML = Chat.list(t.threads, { who: 'customer', empty: 'No conversations yet.' });
    const open = r.bookings.filter(b => !t.threads.some(x => x.ref === b.ref)).slice(0, 10);
    $('#bkChat').innerHTML = open.length ? open.map(b => `<button class="xrow" onclick="Chat.open({ref:'${esc(b.ref)}'})"><div class="xi">${kindIcon(b.kind)}</div><div><b>${esc(b.ref)} · ${esc(bizName(b.bizId))}</b><span>${esc(b.lines.map(l => l.label || l.name).join(', '))}</span></div>${statusChip(b.status)}</button>`).join('') : '<p class="meta">No other bookings.</p>';
  } catch (x) { $('#thrList').innerHTML = `<div class="err">${esc(x.message)}</div>`; if (/sign in/i.test(x.message)) signOut(); }
}

/* ================= LIST YOUR BUSINESS ================= */
function renderListBusiness() {
  const el = $('#listBody'); if (el.dataset.ready) return; el.dataset.ready = 1;
  const townOpts = ISLANDS.map(i => `<optgroup label="${i.name}">${i.towns.map(t => `<option>${t}</option>`).join('')}</optgroup>`).join('');
  el.innerHTML = `<div class="lbhero"><span class="eyebrow2">For businesses in Romblon</span><h2>List your business on ${esc(CAT.business.name)}</h2>
      <p>Reach travellers planning their Romblon trip. Get bookings and orders with online payment, from any of the 17 towns.</p></div>
    <div class="perks"><div class="perk"><b>${ic('users')} More guests</b><span>Show up when travellers search stays, rentals, food and tours.</span></div>
      <div class="perk"><b>${ic('card')} Online payments</b><span>Downpayments and orders paid by e-wallet or card through HitPay.</span></div>
      <div class="perk"><b>${ic('store')} Merchant app</b><span>See confirmed bookings and customer details for your business.</span></div></div>
    <button class="lbstrip" data-go="rider" style="margin:0 0 14px"><span>${ic('bike', 28)}</span><span><b>Want to deliver instead?</b><br>Apply as a delivery rider</span><span>${ic('arrow')}</span></button>
    <form id="lbForm" class="acard" novalidate><h3>Application form</h3><p class="meta">Fields with * are required. We'll contact you within 3 working days.</p>
      <div class="field mt"><label>What do you offer? *</label></div>
      <div class="opts lbtype">${[['Stay', 'Stay'], ['Rental', 'Rental'], ['Food', 'Food'], ['Tour', 'Tour / activity'], ['Other services', 'Other services']].map((t, i) => `<label><input type="radio" name="lbType" value="${t[0]}" ${i ? '' : 'checked'}> ${ic(['home', 'scooter', 'cup', 'boat', 'star'][i])} ${t[1]}</label>`).join('')}</div>
      <div class="field mt"><label>Business name *</label><input id="lbName" maxlength="120"></div>
      <div class="row2"><div class="field"><label>Town *</label><select id="lbTown">${townOpts}</select></div><div class="field"><label>Barangay / street</label><input id="lbAddr" maxlength="200"></div></div>
      <div class="row2"><div class="field"><label>Contact person *</label><input id="lbContact" autocomplete="name" maxlength="120"></div><div class="field"><label>Position</label><input id="lbPos" placeholder="Owner, manager…" maxlength="60"></div></div>
      <div class="row2"><div class="field"><label>Mobile number *</label><input id="lbPhone" inputmode="tel" placeholder="09XX XXX XXXX"></div><div class="field"><label>Email *</label><input id="lbEmail" type="email" autocomplete="email"></div></div>
      <div class="field mt"><label>Facebook page or website</label><input id="lbWeb" maxlength="200"></div>
      <div class="row2"><div class="field"><label>DTI / SEC / CDA registration no. *</label><input id="lbReg" maxlength="60" placeholder="e.g. DTI 1234567"></div><div class="field"><label>Mayor's / Business permit no. *</label><input id="lbPermit" maxlength="60" placeholder="e.g. BP-2026-00123"></div></div>
      <div class="row2"><div class="field"><label>Rooms / units / capacity</label><input id="lbCap" placeholder="e.g. 3 rooms, 10 guests" maxlength="120"></div><div class="field"><label>Price range</label><input id="lbPrice" placeholder="e.g. ₱1,500–₱3,000/night" maxlength="80"></div></div>
      <div class="field mt"><label>Tell us about your business *</label><textarea id="lbDesc" rows="4" maxlength="1500" placeholder="What you offer, location highlights, amenities, menu, operating hours…"></textarea></div>
      <div class="field mt"><label>Photos (up to 3)</label><input type="file" id="lbPhotos" accept="image/*" multiple><div class="lbpv" id="lbPv"></div></div>
      <div class="bankbox"><span class="lbl">Bank or e-wallet account for payouts *</span><p class="hint" style="margin:0 0 8px">Where we send your earnings from online payments.</p><div class="row2"><div class="field"><label>Account name *</label><input id="lbBn" maxlength="120"></div><div class="field"><label>Bank / e-wallet *</label><input id="lbBb" maxlength="80" placeholder="e.g. BPI, BDO, GCash" list="lbBanks"></div></div><div class="field"><label>Account number *</label><input id="lbBa" maxlength="40" inputmode="numeric"></div>
        <datalist id="lbBanks">${['BDO', 'BPI', 'Landbank', 'Metrobank', 'PNB', 'Security Bank', 'UnionBank', 'RCBC', 'China Bank', 'GCash', 'Maya'].map(x => `<option>${x}</option>`).join('')}</datalist></div>
      <div class="row2"><div class="field"><label>Preferred start date</label><input type="date" id="lbStart" min="${today}"></div><div class="field"><label>How did you hear about us?</label><select id="lbHeard"><option></option><option>Facebook</option><option>Friend or another business</option><option>Tourism office</option><option>Saw the app</option><option>Other</option></select></div></div>
      <label class="check"><input type="checkbox" id="lbConsent"><span>I confirm the details are true, and I agree that ${esc(CAT.business.name)} / Beyond Tech Solutions may contact me and process this information to review my application (Data Privacy Act, RA 10173).</span></label>
      <div class="err" id="lbErr"></div><button class="btn full mt" style="padding:15px">Submit application</button></form>`;
  const photos = [];
  $('#lbPhotos').onchange = async e => {
    for (const f of [...e.target.files].slice(0, 3 - photos.length)) { try { photos.push(await resizeImage(f, 900)); } catch (x) { } }
    $('#lbPv').innerHTML = photos.map((p, i) => `<span><img src="${p}"><button type="button" onclick="this.parentNode.remove();window._lbPhotos.splice(${i},1)">×</button></span>`).join(''); e.target.value = '';
  };
  window._lbPhotos = photos;
  $('#lbForm').onsubmit = async e => {
    e.preventDefault(); const v = id => $('#' + id).value.trim(), err = $('#lbErr');
    const f = { type: document.querySelector('input[name=lbType]:checked').value, businessName: v('lbName'), town: v('lbTown'), address: v('lbAddr'), contactName: v('lbContact'), position: v('lbPos'), phone: v('lbPhone'), email: v('lbEmail').toLowerCase(),
      website: v('lbWeb'), registration: v('lbReg'), permits: v('lbPermit'), capacity: v('lbCap'), priceRange: v('lbPrice'), description: v('lbDesc'), startDate: v('lbStart'), heardFrom: v('lbHeard'), photos: window._lbPhotos.slice(0, 3),
      bank: { accountName: v('lbBn'), bank: v('lbBb'), accountNo: v('lbBa') } };
    if (!f.businessName || !f.contactName || !f.description) { err.textContent = 'Please fill in all required fields.'; return; }
    if (!f.registration) { err.textContent = 'DTI / SEC / CDA registration number is required.'; return; }
    if (!f.permits) { err.textContent = "Mayor's / Business permit number is required."; return; }
    if (!f.bank.accountName || !f.bank.bank || !f.bank.accountNo) { err.textContent = 'Add your bank or e-wallet account for payouts.'; return; }
    if (!validPhone(f.phone)) { err.textContent = 'Enter a valid PH mobile number.'; return; }
    if (!validEmail(f.email)) { err.textContent = 'Enter a valid email address.'; return; }
    if (!$('#lbConsent').checked) { err.textContent = 'Please tick the confirmation box.'; return; }
    loading(true, 'Submitting…');
    try {
      await api('submitApplication', { application: f }); loading(false);
      $('#listBody').innerHTML = `<div class="empty"><div class="big">${ic('check', 40)}</div><h2 style="color:var(--navy)">Salamat, ${esc(f.contactName.split(' ')[0])}!</h2><p style="max-width:420px;margin:8px auto 0">We received your application for <b>${esc(f.businessName)}</b> in ${esc(f.town)}. We'll reach out at ${esc(f.phone)} or ${esc(f.email)} within 3 working days.</p><button class="btn navy mt" data-go="home">Back to home</button></div>`;
      delete $('#listBody').dataset.ready;
    } catch (x) { loading(false); err.textContent = x.message; }
  };
}

/* ================= RIDER APPLICATION ================= */
function renderRiderApply() {
  const el = $('#riderBody'); if (el.dataset.ready) return; el.dataset.ready = 1;
  const townOpts = ISLANDS.map(i => `<optgroup label="${i.name}">${i.towns.map(t => `<option ${t === 'San Agustin' ? 'selected' : ''}>${t}</option>`).join('')}</optgroup>`).join('');
  el.innerHTML = `<div class="lbhero"><span class="eyebrow2">Deliver with ${esc(CAT.business.name)}</span><h2>Become a delivery rider</h2>
      <p>Deliver food orders from local restaurants in your town. Choose when you're available and earn from every delivery.</p></div>
    <div class="perks"><div class="perk"><b>${ic('wallet')} Earn per delivery</b><span>Your share of each delivery fee, paid out to your bank or e-wallet.</span></div>
      <div class="perk"><b>${ic('clock')} Your schedule</b><span>Switch yourself on or off in the Rider app any time.</span></div>
      <div class="perk"><b>${ic('nav')} Simple app</b><span>Pick-up and drop-off directions, customer contact and in-app chat.</span></div></div>
    <form id="raForm" class="acard" novalidate><h3>Rider application</h3><p class="meta">Fields with * are required. Beyond Tech Solutions reviews every application and your driver's license before you can start.</p>
      <div class="row2"><div class="field"><label>Full name *</label><input id="raName" autocomplete="name" maxlength="120"></div><div class="field"><label>Mobile number *</label><input id="raPhone" inputmode="tel" placeholder="09XX XXX XXXX"></div></div>
      <div class="row2"><div class="field"><label>Email *</label><input id="raEmail" type="email" autocomplete="email"></div><div class="field"><label>Town *</label><select id="raTown">${townOpts}</select></div></div>
      <div class="row2">${pwField('raPw', 'Create a password for the Rider app *', 'new-password')}${pwField('raPw2', 'Confirm password *', 'new-password')}</div><p class="hint">You'll sign in to the Rider app with your email and this password once you're approved.</p>
      <div class="field mt"><label>Home address *</label><input id="raAddr" maxlength="200" placeholder="Barangay, street"></div>
      <div class="row2"><div class="field"><label>Motorcycle (make / model) *</label><input id="raVeh" maxlength="80" placeholder="e.g. Honda Click 125"></div><div class="field"><label>Plate number *</label><input id="raPlate" maxlength="20"></div></div>
      <div class="row2"><div class="field"><label>Driver's license number *</label><input id="raLic" maxlength="40"></div><div class="field"><label>License expiry</label><input type="date" id="raExp" min="${today}"></div></div>
      ${uploadField('raLicPhoto', "Photo of your driver's license", 'required', 'Front side, clear and readable. Only Beyond Tech Solutions Super Admins can see it.')}
      <div class="row2"><div class="field"><label>When can you deliver?</label><input id="raAvail" maxlength="120" placeholder="e.g. Weekdays 10 AM - 8 PM"></div><div class="field"><label>How did you hear about us?</label><select id="raHeard"><option></option><option>Facebook</option><option>Friend</option><option>Saw the app</option><option>Other</option></select></div></div>
      <div class="field mt"><label>Delivery or riding experience</label><textarea id="raExp2" rows="3" maxlength="800"></textarea></div>
      <div class="bankbox"><span class="lbl">Bank or e-wallet account for payouts *</span><div class="row2"><div class="field"><label>Account name *</label><input id="raBn" maxlength="120"></div><div class="field"><label>Bank / e-wallet *</label><input id="raBb" maxlength="80" placeholder="e.g. GCash, BPI" list="raBanks"></div></div><div class="field"><label>Account number *</label><input id="raBa" maxlength="40" inputmode="numeric"></div>
        <datalist id="raBanks">${['GCash', 'Maya', 'BDO', 'BPI', 'Landbank', 'Metrobank', 'UnionBank'].map(x => `<option>${x}</option>`).join('')}</datalist></div>
      <label class="check"><input type="checkbox" id="raConsent"><span>I confirm the details are true, and I agree that ${esc(CAT.business.name)} / Beyond Tech Solutions may verify my driver's license and process this information to review my application (Data Privacy Act, RA 10173).</span></label>
      <div class="err" id="raErr"></div><button class="btn full mt" style="padding:15px">Submit rider application</button></form>`;
  wireUpload('raLicPhoto'); wireEyes();
  $('#raForm').onsubmit = async e => {
    e.preventDefault(); const v = id => $('#' + id).value.trim(), err = $('#raErr');
    const f = { appType: 'rider', name: v('raName'), phone: v('raPhone'), email: v('raEmail').toLowerCase(), town: v('raTown'), address: v('raAddr'), vehicle: v('raVeh'), plate: v('raPlate'), licenseNo: v('raLic'), licenseExpiry: v('raExp'),
      availability: v('raAvail'), heardFrom: v('raHeard'), experience: v('raExp2'), licensePhoto: UP.raLicPhoto || '', bank: { accountName: v('raBn'), bank: v('raBb'), accountNo: v('raBa') } };
    if (!f.name || !f.address || !f.vehicle || !f.plate || !f.licenseNo) { err.textContent = 'Please fill in all required fields.'; return; }
    if (!validPhone(f.phone)) { err.textContent = 'Enter a valid PH mobile number.'; return; }
    if (!validEmail(f.email)) { err.textContent = 'Enter a valid email address.'; return; }
    f.password = $('#raPw').value; if (f.password.length < 8) { err.textContent = 'Create a password of at least 8 characters.'; return; } if (f.password !== $('#raPw2').value) { err.textContent = 'The passwords do not match.'; return; }
    if (!f.licensePhoto) { err.textContent = "Upload a photo of your driver's license."; return; }
    if (!f.bank.accountName || !f.bank.bank || !f.bank.accountNo) { err.textContent = 'Add your bank or e-wallet account for payouts.'; return; }
    if (!$('#raConsent').checked) { err.textContent = 'Please tick the confirmation box.'; return; }
    loading(true, 'Submitting…');
    try {
      await api('submitApplication', { application: f }); loading(false);
      $('#riderBody').innerHTML = `<div class="empty"><div class="big">${ic('check', 40)}</div><h2 style="color:var(--navy)">Salamat, ${esc(f.name.split(' ')[0])}!</h2><p style="max-width:420px;margin:8px auto 0">We received your rider application. We'll check your driver's license and reach out at ${esc(f.phone)} or ${esc(f.email)} within 3 working days.</p><button class="btn navy mt" data-go="home">Back to home</button></div>`;
      delete $('#riderBody').dataset.ready;
    } catch (x) { loading(false); err.textContent = x.message; }
  };
}

/* ================= SEARCH BARS ================= */
function setupSearch() {
  $('#homeSearch').addEventListener('submit', e => { e.preventDefault(); $('#exQ').value = $('#homeQ').value; go('explore'); });
  $('#exSearch').addEventListener('submit', e => { e.preventDefault(); $('#exQ').blur(); renderExplore(); });
  $('#exQ').addEventListener('input', () => renderExplore());
  const sIn = $('#sIn'), sOut = $('#sOut'), sG = $('#sGuests');
  sIn.min = today; sIn.value = S.sIn; sOut.min = addDays(S.sIn, 1); sOut.value = S.sOut;
  sG.innerHTML = Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${i + 1 == S.guests ? 'selected' : ''}>${i + 1} guest${i ? 's' : ''}</option>`).join('');
  sIn.onchange = () => { S.sIn = sIn.value; sOut.min = addDays(S.sIn, 1); if (sOut.value <= S.sIn) sOut.value = addDays(S.sIn, 1); S.sOut = sOut.value; renderStays(); };
  sOut.onchange = () => { S.sOut = sOut.value; renderStays(); };
  sG.onchange = () => { S.guests = +sG.value; renderStays(); };
  const rD = $('#rD'), rT = $('#rT'), rRD = $('#rRD'), rRT = $('#rRT');
  rD.min = today; rD.value = S.rD; rRD.min = S.rD; rRD.value = S.rRD; rT.innerHTML = timeOpts(S.rT); rRT.innerHTML = timeOpts(S.rRT);
  const upd = () => { S.rD = rD.value; S.rT = rT.value; rRD.min = S.rD; if (rRD.value < S.rD) rRD.value = S.rD; S.rRD = rRD.value; S.rRT = rRT.value; renderRides(); };
  [rD, rT, rRD, rRT].forEach(x => x.onchange = upd);
}

/* ================= ROUTER ================= */
const VIEWS = ['home', 'explore', 'stays', 'rentals', 'food', 'tours', 'cart', 'orders', 'messages', 'account', 'list', 'rider'];
function renderAll() { renderTours(); renderLocSlots(); renderStays(); renderRides(); renderFood(); renderBadges(); if (currentView === 'explore') renderExplore(); }
function go(v, push = true) {
  /* /#signup opens the Create account screen (shareable link) */
  if (v === 'signup') { v = 'account'; (window.catalogReady || Promise.resolve()).then(() => { if (!session) openSignUp(); }); }
  if (!VIEWS.includes(v)) v = 'home';
  currentView = v;
  document.body.classList.toggle('subview', v !== 'home');
  document.querySelectorAll('.view').forEach(el => el.classList.toggle('on', el.id === 'v-' + v));
  document.querySelectorAll('.nav [data-go],.bnav [data-go]').forEach(b => b.classList.toggle('on', b.dataset.go === v));
  if (v === 'cart') renderCart(); if (v === 'orders') renderOrders(); if (v === 'account') renderAccount(); if (v === 'list') renderListBusiness(); if (v === 'rider') renderRiderApply(); if (v === 'tours') renderTours(); if (v === 'food') renderFood(); if (v === 'explore') renderExplore(); if (v === 'messages') renderMessages();
  renderBadges(); window.scrollTo(0, 0);
  if (push) { try { history.replaceState(null, '', '#' + v); } catch (e) { } }
}
/* Back button (top left): from any merchant page or tab straight back to the home screen */
function goHome() { closeSheet(); S.store = null; S.cat = 'all'; go('home'); renderFood(); }
document.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) { e.preventDefault(); closeSheet(); if (b.dataset.go === 'food' || b.dataset.go === 'home') { S.store = null; S.cat = 'all'; } go(b.dataset.go); } });
window.addEventListener('hashchange', () => { const v = location.hash.slice(1); if (v === 'food' || v === 'home') S.store = null; go(v, false); });

/* ===== Install the app: pop-up on every visit to the home page (not when already opened as the installed app) ===== */
let INSTALL_EVT = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); INSTALL_EVT = e; const b = $('#instGo'); if (b) installButtons(); });
window.addEventListener('appinstalled', () => { INSTALL_EVT = null; closeInstall(); toast('Tara Romblon app installed. Find it on your home screen.'); });
const isStandalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true || /[?&]source=app\b/.test(location.search);
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const inAppBrowser = () => /FBAN|FBAV|FB_IAB|Instagram|Messenger|Line\/|TikTok/i.test(navigator.userAgent);
function installIcon() { const s = (CAT.settings || {}).siteIcon; return s || (DEMO ? '' : '/img/icon-192.png'); }
function installButtons() {
  const how = $('#instHow'), go = $('#instGo'); if (!how || !go) return;
  if (INSTALL_EVT) { how.style.display = 'none'; go.textContent = 'Install app'; go.onclick = async () => { const e = INSTALL_EVT; INSTALL_EVT = null; e.prompt(); try { const r = await e.userChoice; if (r && r.outcome === 'accepted') closeInstall(); } catch (x) { } }; return; }
  how.style.display = '';
  how.innerHTML = inAppBrowser() ? `Open this page in <b>Chrome</b> or <b>Safari</b> first (tap ⋯ then <b>Open in browser</b>), then add it to your home screen.`
    : isIOS() ? `Tap the <b>Share</b> button ${ic('upload', 14)} at the bottom of Safari, then choose <b>Add to Home Screen</b>.`
    : `Open your browser menu <b>⋮</b> and tap <b>Install app</b> or <b>Add to Home screen</b>.`;
  go.textContent = 'Got it'; go.onclick = closeInstall;
}
function closeInstall() { const o = $('#instOv'); if (o) o.remove(); }
function showInstall() {
  if (isStandalone() || $('#instOv') || currentView !== 'home') return;
  if ($('#ov') && $('#ov').classList.contains('show')) { setTimeout(showInstall, 2000); return; } /* wait until other pop-ups are closed */
  const icon = installIcon(), d = document.createElement('div'); d.id = 'instOv'; d.className = 'instov'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-labelledby', 'instT');
  d.innerHTML = `<div class="instbox"><div class="ihead">${icon ? `<img src="${esc(icon)}" alt="">` : ''}<div><h3 id="instT">Install the Tara Romblon app</h3><span class="hint">Free · no app store needed</span></div></div>
    <ul><li>Order food, rent scooters and book in one tap from your home screen</li><li>Faster to open, works like a regular app</li><li>Get updates on your orders and bookings</li></ul>
    <div class="ihow" id="instHow"></div><div class="row2"><button class="btn ghost" id="instNo">Not now</button><button class="btn" id="instGo">Install app</button></div></div>`;
  document.body.appendChild(d); installButtons();
  $('#instNo').onclick = closeInstall; d.addEventListener('click', e => { if (e.target === d) closeInstall(); });
}

(async function init() {
  if (DEMO) document.body.classList.add('demo');
  if (!DEMO && 'serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  setupSearch(); renderAll();
  window.catalogReady = loadCatalog(); /* settings from the server (incl. Google sign-in) */
  go(location.hash.slice(1) || 'home', false);
  await window.catalogReady; renderAll(); if (currentView === 'cart') renderCart();
  startCustomerNotif();
  checkReturnFromPayment();
  setTimeout(showInstall, 1500);
  refreshActive(); setInterval(() => { if (currentView === 'home' && document.visibilityState === 'visible') refreshActive(); }, 30000);
})();
