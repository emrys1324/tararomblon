/* ===== Listings & rates editor (Super Admin) ===== */
const getP = (o, p) => p.split('.').reduce((a, k) => a == null ? a : a[k], o);
const setP = (o, p, v) => { const k = p.split('.'); let a = o; for (let i = 0; i < k.length - 1; i++) a = a[k[i]]; a[k[k.length - 1]] = v; };
function aIn(path, label, type, extra) {
  const v = getP(ADM.draft, path);
  if (type === 'textarea') return `<div class="field mt"><label>${label}</label><textarea data-b="${path}" rows="${extra || 5}">${esc(v)}</textarea></div>`;
  if (type === 'bool') return `<label class="tog"><input type="checkbox" data-b="${path}" data-t="bool" ${v ? 'checked' : ''}> ${label}</label>`;
  return `<div class="field"><label>${label}</label><input data-b="${path}" ${type === 'num' ? 'type="number" step="any" min="0" data-t="num"' : ''} value="${esc(v)}"></div>`;
}
function aTown(path) { const v = getP(ADM.draft, path) || 'San Agustin'; return `<div class="field"><label>Town</label><select data-b="${path}">${ISLANDS.map(i => `<optgroup label="${i.name}">${i.towns.map(t => `<option ${t === v ? 'selected' : ''}>${t}</option>`).join('')}</optgroup>`).join('')}</select></div>`; }
function aPhoto(path) {
  const v = getP(ADM.draft, path);
  return `<div class="photoin"><div class="pv">${v ? `<img src="${esc(v)}">` : 'No photo'}</div><div><input type="file" accept="image/*" data-photo="${path}"><br>${v ? `<button class="link" data-clearphoto="${path}">Remove photo</button>` : '<span class="hint">JPG or PNG, resized automatically</span>'}</div></div>`;
}
function aBiz(path, type) { const v = getP(ADM.draft, path) || ''; const list = ADM.draft.businesses.filter(b => !type || b.type === type || b.id === v); return `<div class="field"><label>Business</label><select data-b="${path}">${list.map(b => `<option value="${b.id}" ${b.id === v ? 'selected' : ''}>${esc(b.name)}</option>`).join('')}</select></div>`; }
function admTabHtml() {
  const D = ADM.draft;
  if (ADM.tab === 'stays') return D.stays.map((s, i) => `<div class="acard"><h3>${esc(s.name || 'New accommodation')}<button class="xbtn" title="Remove" onclick="admDel('stays',${i})">${ic('x')}</button></h3>
    ${aIn(`stays.${i}.active`, 'Show on website', 'bool')}
    <div class="agrid">${aIn(`stays.${i}.name`, 'Name')}${aBiz(`stays.${i}.bizId`, 'Stay')}${aTown(`stays.${i}.town`)}${aIn(`stays.${i}.location`, 'Address / location')}${aIn(`stays.${i}.rate`, 'Rate per night (₱)', 'num')}${aIn(`stays.${i}.promoPct`, 'Discount (%)', 'num')}${aIn(`stays.${i}.deposit`, 'Security deposit (₱)', 'num')}${aIn(`stays.${i}.maxGuests`, 'Max guests', 'num')}${aIn(`stays.${i}.checkInTime`, 'Check-in time')}${aIn(`stays.${i}.checkOutTime`, 'Check-out time')}</div>
    ${aIn(`stays.${i}.amenities`, 'Amenities (one per line)', 'textarea', 7)}<div class="field mt"><label>Photo</label></div>${aPhoto(`stays.${i}.photo`)}</div>`).join('')
    + `<button class="btn ghost" onclick="admAdd('stays',{id:uid(),bizId:(ADM.draft.businesses.find(b=>b.type==='Stay')||{}).id||'',name:'New accommodation',town:'San Agustin',location:'San Agustin, Romblon',rate:0,maxGuests:2,checkInTime:'2:00 PM',checkOutTime:'12:00 NN',amenities:'',photo:'',active:false})">+ Add accommodation</button>`;
  if (ADM.tab === 'rentals') {
    const R = D.rentals;
    return `<div class="acard"><h3>Rental rules</h3><div class="agrid">${aIn('rentals.graceMinutes', 'Grace period before extra hour (minutes)', 'num')}${aIn('rentals.includedHelmets', 'Helmets included free', 'num')}${aIn('rentals.maxHelmets', 'Max helmets per scooter', 'num')}${aIn('rentals.extraHelmetFee', 'Fee per extra helmet (₱)', 'num')}</div>
      ${aIn('rentals.capExtraHoursAtDailyRate', 'Cap extra-hour charges at one daily rate', 'bool')}</div>
      <div class="acard"><h3>Pick-up & return locations</h3><p class="hint">The first location is the default.</p>${R.locations.map((l, i) => `<div class="arow">${aIn(`rentals.locations.${i}.name`, 'Location')}${aIn(`rentals.locations.${i}.fee`, 'Fee (₱)', 'num')}<button class="xbtn" onclick="admDel('rentals.locations',${i})">${ic('x')}</button></div>`).join('')}
      <button class="btn ghost sm mt" onclick="admAdd('rentals.locations',{id:uid(),name:'',fee:0})">+ Add location</button></div>`
      + R.units.map((u, i) => `<div class="acard"><h3>${esc(u.name || 'New scooter')}<button class="xbtn" onclick="admDel('rentals.units',${i})">${ic('x')}</button></h3>${aIn(`rentals.units.${i}.active`, 'Available for booking', 'bool')}
      <div class="agrid">${aIn(`rentals.units.${i}.name`, 'Name / unit')}${aBiz(`rentals.units.${i}.bizId`, 'Rental')}${aTown(`rentals.units.${i}.town`)}${aIn(`rentals.units.${i}.dailyRate`, 'Daily rate / 24 hrs (₱)', 'num')}${aIn(`rentals.units.${i}.hourlyRate`, 'Additional hour rate (₱)', 'num')}${aIn(`rentals.units.${i}.deposit`, 'Security deposit (₱)', 'num')}${aIn(`rentals.units.${i}.promoPct`, 'Discount (%)', 'num')}</div>
      <div class="mt">${aIn(`rentals.units.${i}.desc`, 'Short description')}</div><div class="field mt"><label>Photo</label></div>${aPhoto(`rentals.units.${i}.photo`)}</div>`).join('')
      + `<button class="btn ghost" onclick="admAdd('rentals.units',{id:uid(),bizId:'baybayin',name:'New scooter',town:'San Agustin',desc:'',dailyRate:0,hourlyRate:0,deposit:0,photo:'',active:false})">+ Add scooter</button>`;
  }
  if (ADM.tab === 'food' || ADM.tab === 'delivery') {
    if (!D.foods.length) return `<div class="empty">No restaurants yet. Approve a Food business application, or add one.</div>${addStoreBtn()}`;
    const si = ADM.si = Math.min(Math.max(ADM.si || 0, 0), D.foods.length - 1), F = D.foods[si], P0 = `foods.${si}`;
    const pick = `<div class="acard"><div class="field"><label>Restaurant</label><select onchange="ADM.si=+this.value;admRerender()">${D.foods.map((f, k) => `<option value="${k}" ${k === si ? 'selected' : ''}>${esc(f.storeName)} · ${esc(bizName(f.bizId))}</option>`).join('')}</select></div>${addStoreBtn()}</div>`;
    if (ADM.tab === 'delivery') return pick + `<div class="acard"><h3>Delivery fee matrix · ${esc(F.storeName)}</h3><p class="hint">Distance is measured in a straight line from the restaurant pin to the customer's pin. Orders beyond the last band can't be delivered.</p>
      ${F.matrix.map((m, i) => `<div class="arow three">${aIn(`${P0}.matrix.${i}.upToKm`, 'Up to (km)', 'num')}${aIn(`${P0}.matrix.${i}.fee`, 'Fee (₱)', 'num')}<button class="xbtn" onclick="admDel('${P0}.matrix',${i})">${ic('x')}</button></div>`).join('')}
      <button class="btn ghost sm mt" onclick="admAdd('${P0}.matrix',{upToKm:0,fee:0})">+ Add distance band</button></div>
      <div class="acard"><h3>Restaurant location</h3><p class="hint">Tap the map to move the pin to the exact location.</p><div class="agrid">${aIn(`${P0}.lat`, 'Latitude', 'num')}${aIn(`${P0}.lng`, 'Longitude', 'num')}</div><div class="map" id="admMap"></div></div>`;
    return pick + `<div class="acard"><h3>${esc(F.storeName)} <button class="xbtn" title="Remove restaurant" onclick="admDelStore(${si})">${ic('x')}</button></h3><div class="agrid">${aIn(`${P0}.storeName`, 'Restaurant name')}${aBiz(`${P0}.bizId`, 'Food')}${aTown(`${P0}.town`)}${aIn(`${P0}.hours`, 'Opening hours')}</div><div class="mt">${aIn(`${P0}.address`, 'Address')}</div>
      <div class="field mt"><label>Logo / photo (shown on the home screen)</label></div>${aPhoto(`${P0}.photo`)}
      ${aIn(`${P0}.open`, 'Accepting orders now', 'bool')}${aIn(`${P0}.deliveryEnabled`, 'Offer delivery', 'bool')}${aIn(`${P0}.pickupEnabled`, 'Offer pick-up', 'bool')}${aIn(`${P0}.codEnabled`, 'Accept cash on delivery', 'bool')}${aIn(`${P0}.onlineEnabled`, 'Accept online payment (HitPay)', 'bool')}</div>
      <div class="acard"><h3>Categories</h3>${F.categories.map((c, i) => `<div class="arow three">${aIn(`${P0}.categories.${i}.name`, 'Category name')}<span class="hint">${F.items.filter(x => x.catId === c.id).length} items</span><button class="xbtn" onclick="admDelCat(${i})">${ic('x')}</button></div>`).join('')}
      <button class="btn ghost sm mt" onclick="admAdd('${P0}.categories',{id:uid(),name:'New category'})">+ Add category</button></div>`
      + F.items.map((it, i) => `<div class="acard"><h3>${esc(it.name || 'New item')}<button class="xbtn" onclick="admDel('${P0}.items',${i})">${ic('x')}</button></h3>${aIn(`${P0}.items.${i}.available`, 'Available', 'bool')}
      <div class="agrid">${aIn(`${P0}.items.${i}.name`, 'Item name')}${aIn(`${P0}.items.${i}.price`, 'Price (₱)', 'num')}${aIn(`${P0}.items.${i}.promoPct`, 'Discount (%)', 'num')}<div class="field"><label>Category</label><select data-b="${P0}.items.${i}.catId">${F.categories.map(c => `<option value="${c.id}" ${c.id === it.catId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></div></div>
      ${aIn(`${P0}.items.${i}.desc`, 'Description', 'textarea', 2)}<div class="field mt"><label>Photo</label></div>${aPhoto(`${P0}.items.${i}.photo`)}
      <div class="field mt"><label>Add-on groups <span class="hint">required or optional · customers pick up to 1-3 per group</span></label></div>
      ${(it.addonGroups = Pricing.addonGroups(it), delete it.addons, it.addonGroups).map((g, k) => { const G0 = `${P0}.items.${i}.addonGroups.${k}`; return `<div class="gedit ${g.active === false ? 'off' : ''}"><div class="agrid">${aIn(`${G0}.name`, 'Group name')}<div class="field"><label>Customer can pick up to</label><select data-b="${G0}.max" data-t="num">${[1, 2, 3].map(n => `<option value="${n}" ${+g.max === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div></div>
        ${aIn(`${G0}.active`, 'On', 'bool')} ${aIn(`${G0}.required`, 'Required', 'bool')}
        ${g.options.map((o, j) => `<div class="arow">${aIn(`${G0}.options.${j}.name`, 'Choice')}${aIn(`${G0}.options.${j}.price`, 'Price (₱)', 'num')}<button class="xbtn" onclick="admDel('${G0}.options',${j})">${ic('x')}</button></div>`).join('')}
        <div class="rowbtns"><button class="btn ghost sm" onclick="admAdd('${G0}.options',{id:uid(),name:'',price:0,active:true})">+ Choice</button><button class="btn ghost sm danger" onclick="admDel('${P0}.items.${i}.addonGroups',${k})">Delete group</button></div></div>`; }).join('')}
      <button class="btn ghost sm mt" onclick="admAdd('${P0}.items.${i}.addonGroups',{id:uid(),name:'',active:true,required:false,max:1,options:[{id:uid(),name:'',price:0,active:true}]})">+ Add-on group</button>
      </div>`).join('')
      + `<button class="btn ghost" onclick="admAdd('${P0}.items',{id:uid(),catId:(ADM.draft.foods[${si}].categories[0]||{}).id,name:'New item',desc:'',price:0,promoPct:0,photo:'',available:false,addonGroups:[]})">+ Add menu item</button>`;
  }
  if (ADM.tab === 'tours' || ADM.tab === 'services') {
    const cat = ADM.tab === 'tours' ? 'tour' : 'service', type = cat === 'tour' ? 'Tour' : 'Service', word = cat === 'tour' ? 'tour' : 'service';
    const list = D.tours.map((t, i) => [t, i]).filter(([t]) => (t.category || 'tour') === cat);
    return `<p class="meta" style="margin-bottom:10px">${cat === 'tour' ? 'Island hopping, guided trips, dives and other activities.' : 'Transfers, laundry, massage, photography and other services.'} Customers book a date, start time and number of ${cat === 'tour' ? 'guests' : 'persons'}; the ${D.business.downpaymentPct || 50}% downpayment applies.</p>`
      + list.map(([t, i]) => `<div class="acard"><h3>${esc(t.name || 'New ' + word)}<button class="xbtn" onclick="admDel('tours',${i})">${ic('x')}</button></h3>${aIn(`tours.${i}.active`, 'Show on website', 'bool')}
      <div class="agrid">${aIn(`tours.${i}.name`, 'Name')}${aBiz(`tours.${i}.bizId`, type)}${aTown(`tours.${i}.town`)}${aIn(`tours.${i}.location`, 'Meeting point / location')}
        ${aIn(`tours.${i}.rate`, 'Rate (₱)', 'num')}<div class="field"><label>Rate is per</label><select data-b="tours.${i}.rateUnit"><option value="person" ${t.rateUnit !== 'group' ? 'selected' : ''}>Person</option><option value="group" ${t.rateUnit === 'group' ? 'selected' : ''}>Group / booking</option></select></div>
        ${aIn(`tours.${i}.promoPct`, 'Discount (%)', 'num')}${aIn(`tours.${i}.deposit`, 'Security deposit (₱)', 'num')}${aIn(`tours.${i}.maxPax`, 'Max ' + (cat === 'tour' ? 'guests' : 'persons') + ' per booking', 'num')}${aIn(`tours.${i}.durationHours`, 'Duration (hours)', 'num')}${aIn(`tours.${i}.times`, 'Start times (e.g. 08:00, 13:00)')}</div>
      ${aIn(`tours.${i}.desc`, 'Description / inclusions', 'textarea', 4)}<div class="field mt"><label>Photo</label></div>${aPhoto(`tours.${i}.photo`)}</div>`).join('')
      + (list.length ? '' : `<div class="empty">No ${word}s yet. Approved ${cat === 'tour' ? 'Tours' : 'Other Services'} businesses appear here automatically.</div>`)
      + `<button class="btn ghost" onclick="admAdd('tours',{id:uid(),category:'${cat}',bizId:(ADM.draft.businesses.find(b=>b.type==='${type}')||{}).id||'',name:'New ${word}',town:'San Agustin',location:'',desc:'',rate:0,rateUnit:'person',promoPct:0,deposit:0,maxPax:10,durationHours:${cat === 'tour' ? 4 : 1},times:'08:00',photo:'',active:false})">+ Add ${word}</button>`;
  }
  if (ADM.tab === 'business') return `<div class="acard"><h3>Business</h3><div class="agrid">${aIn('business.name', 'App / business name')}${aIn('business.phone', 'Contact number')}${aIn('business.email', 'Email')}${aIn('business.facebook', 'Facebook page link')}${aIn('business.downpaymentPct', 'Downpayment for stays & rentals (%)', 'num')}</div></div>
    <div class="acard">${aIn('business.refundPolicy', 'Cancellation & refund policy (shown at checkout)', 'textarea', 9)}</div><div class="acard">${aIn('business.rentalTerms', 'Rental terms (shown at checkout)', 'textarea', 7)}</div>`;
  return '';
}
function admMap() {
  if (!document.getElementById('admMap')) return;
  const F = ADM.draft.foods[ADM.si || 0], P0 = 'foods.' + (ADM.si || 0);
  loadMap('admMap', +F.lat, +F.lng, map => {
    const mk = L.marker([F.lat, F.lng]).addTo(map);
    map.on('click', e => { mk.setLatLng(e.latlng); F.lat = +e.latlng.lat.toFixed(6); F.lng = +e.latlng.lng.toFixed(6);
      document.querySelector(`[data-b="${P0}.lat"]`).value = F.lat; document.querySelector(`[data-b="${P0}.lng"]`).value = F.lng; admDirty(); });
  });
}
function admDirty() { ADM.dirty = true; ADM.edited = true; const b = $('#saveBar'); if (b) b.classList.add('show'); }
function admRerender() { const y = scrollY; $('#admTab').innerHTML = admTabHtml(); scrollTo(0, y); if (ADM.tab === 'delivery') setTimeout(admMap, 30); }
function admAdd(path, obj) { getP(ADM.draft, path).push(obj); admDirty(); admRerender(); }
function admDel(path, i) { getP(ADM.draft, path).splice(i, 1); admDirty(); admRerender(); }
function admDelCat(i) { const F = ADM.draft.foods[ADM.si || 0], c = F.categories[i]; if (F.items.some(x => x.catId === c.id)) { toast('Move or remove the items in this category first.'); return; } admDel('foods.' + (ADM.si || 0) + '.categories', i); }
function addStoreBtn() { const free = ADM.draft.businesses.filter(b => b.type === 'Food' && !ADM.draft.foods.some(f => f.bizId === b.id)); return free.length ? `<button class="btn ghost sm mt" onclick="admAddStore()">+ Add restaurant for ${esc(free.map(b => b.name).join(' / '))}</button>` : ''; }
function admAddStore() {
  const b = ADM.draft.businesses.find(z => z.type === 'Food' && !ADM.draft.foods.some(f => f.bizId === z.id)); if (!b) return;
  ADM.draft.foods.push({ bizId: b.id, storeName: b.name, town: b.town || 'San Agustin', address: '', hours: '', photo: '', lat: 12.57, lng: 122.13, open: false, deliveryEnabled: true, pickupEnabled: true, codEnabled: true, onlineEnabled: true, matrix: clone((ADM.draft.foods[0] || {}).matrix || [{ upToKm: 3, fee: 50 }]), categories: [{ id: 'menu', name: 'Menu' }], items: [] });
  ADM.si = ADM.draft.foods.length - 1; admDirty(); admRerender();
}
function admDelStore(i) { if (ADM.draft.foods[i].items.length) { toast('Remove its menu items first.'); return; } ADM.draft.foods.splice(i, 1); ADM.si = 0; admDirty(); admRerender(); }
function admDiscard() { ADM.draft = clone(CAT); ADM.dirty = false; ADM.edited = false; renderPortal(); }
async function admSave() {
  const D = ADM.draft;
  if (!D.rentals.locations.length) { toast('Add at least one pick-up location.'); return; }
  loading(true, 'Saving…');
  try { await api('saveCatalog', { token: ADM.token, catalog: D }); CAT = clone(D); window.CAT_SAVED = true; ADM.dirty = false; ADM.edited = false; loading(false); toast('Saved — live for all customers'); renderPortal(); }
  catch (x) { loading(false); toast(x.message); }
}
$('#root').addEventListener('input', e => {
  const p = e.target.dataset.b; if (!p) return;
  const t = e.target.dataset.t; setP(ADM.draft, p, t === 'num' ? (e.target.value === '' ? 0 : +e.target.value) : t === 'bool' ? e.target.checked : e.target.value); admDirty();
});
$('#root').addEventListener('change', async e => {
  const p = e.target.dataset.b;
  if (p && (e.target.dataset.t === 'bool' || e.target.tagName === 'SELECT')) { setP(ADM.draft, p, e.target.dataset.t === 'bool' ? e.target.checked : e.target.value); admDirty(); }
  const ph = e.target.dataset.photo;
  if (ph && e.target.files[0]) {
    loading(true, 'Uploading photo…');
    try { const dataUrl = await resizeImage(e.target.files[0], 1000); const r = await api('uploadPhoto', { token: ADM.token, dataUrl, name: ph }); setP(ADM.draft, ph, r.url); admDirty(); loading(false); admRerender(); }
    catch (x) { loading(false); toast('Upload failed: ' + x.message); }
  }
});
$('#root').addEventListener('click', e => { const c = e.target.dataset.clearphoto; if (c) { setP(ADM.draft, c, ''); admDirty(); admRerender(); } });
