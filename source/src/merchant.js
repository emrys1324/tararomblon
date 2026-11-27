/* ================= MERCHANT APP — Merchant Admin & Merchant Staff ================= */
const MP = { token: null, me: null, tab: 'orders', view: 'active', q: '', bookings: [], threads: [], team: [], riders: [], r: { from: '', to: '' }, cal: { m: today.slice(0, 7), day: today, unit: '' } };
const hasCal = () => { const id = MP.me.bizId; return CAT.stays.some(x => x.bizId === id) || CAT.rentals.units.some(x => x.bizId === id) || CAT.tours.some(x => x.bizId === id) || MP.bookings.some(b => b.kind !== 'food'); };
const isAdm = () => MP.me && MP.me.role === 'manager';
const dt = s => new Date(s).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
const tm = s => new Date(s).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
const dayOf = s => { const d = new Date(s); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const startOf = b => b.kind === 'food' ? b.created : (b.lines[0] || {}).start || b.created;
const actor = () => ({ role: MP.me.role, bizId: MP.me.bizId, email: MP.me.email });

async function initPortal() {
  if (DEMO) document.body.classList.add('demo');
  try { const r = await api('getCatalog'); if (r.catalog) CAT = r.catalog; } catch (e) { }
  CAT = Pricing.norm(CAT);
  const s = await restoreStaff('tr5_staff_merchant', me => ['manager', 'staff'].includes(me.role));
  if (s) return start(s.token, s.me);
  staffLogin('merchant', v => start(v.token, v.me));
}
async function start(token, me) {
  /* one email can work for several businesses: pick the last one used on this device, else the first */
  const access = (me.access && me.access.length) ? me.access : [{ bizId: me.bizId, role: me.role }];
  const saved = store('tr5_merchant_biz'), cur = access.find(a => a.bizId === saved) || access[0];
  me = Object.assign({}, me, { bizId: cur.bizId, role: cur.role, access });
  window.API_BIZ = cur.bizId;
  MP.token = token; MP.me = me; MP.tab = me.role === 'manager' ? 'orders' : 'today';
  Chat.token = () => MP.token; Chat.me = { email: me.email, name: me.name, role: me.role };
  $('#who').innerHTML = `<span>${esc(me.name || me.email)} · ${Rules.ROLE_LABEL[me.role]}</span><button class="link" onclick="signOutStaff()">Sign out</button>`;
  if (access.length > 1) { $('#bizbar').innerHTML = `<div class="wrap"><label for="bizPick">Business</label><select id="bizPick" class="bizpick">${access.map(a => `<option value="${esc(a.bizId)}" ${a.bizId === cur.bizId ? 'selected' : ''}>${esc(bizName(a.bizId))} · ${Rules.ROLE_LABEL[a.role]}</option>`).join('')}</select></div>`; $('#bizbar').classList.add('on'); }
  if ($('#bizPick')) $('#bizPick').onchange = e => switchBiz(e.target.value);
  $('#ptitle').textContent = bizName(me.bizId); $('#bellSlot').innerHTML = bellBtn();
  await reload(); render();
  Notif.start(token, 'm_' + me.email + (access.length > 1 ? '_' + cur.bizId : ''), async () => { await reload(true); render(); });
}
/* switch to another business this user has access to */
function switchBiz(id) { if (ldDirty() && !confirm('You have unsaved menu changes. Switch business and discard them?')) { const sel = document.querySelector('#bizbar select'); if (sel) sel.value = MP.me.bizId; return; } MP.ld = null; store('tr5_merchant_biz', id); Notif.stop(); location.reload(); }
function signOutStaff() { store('tr5_staff_merchant', null); Notif.stop(); location.reload(); }
async function reload(quiet) {
  if (!quiet) loading(true, 'Loading…');
  try {
    const [b, t, team, rd, c] = await Promise.all([api('mBookings', { token: MP.token }), api('threads', { token: MP.token }), api('mTeam', { token: MP.token }), api('riders', { token: MP.token }), api('getCatalog')]);
    MP.bookings = b.bookings.sort((x, y) => y.created.localeCompare(x.created)); MP.threads = t.threads; MP.team = team.team; MP.riders = rd.riders; if (c.catalog) CAT = Pricing.norm(c.catalog);
  } catch (x) { toast(x.message); if (/sign in/i.test(x.message)) signOutStaff(); }
  loading(false);
}
function render() {
  const unread = MP.threads.filter(t => Chat.unread(t)).length;
  const cal = hasCal() ? [['calendar', 'cal', 'Calendar']] : [];
  const tabs = isAdm() ? [['orders', 'receipt', 'Orders & bookings'], ['today', 'sun', 'Today'], ...cal, ['messages', 'chat', 'Messages'], ['reports', 'chart', 'Reports'], ['listings', 'box', 'Listings & prices'], ['store', 'store', 'Store settings'], ['team', 'users', 'Team']]
    : [['today', 'sun', 'Today'], ['orders', 'receipt', 'Orders'], ...cal, ['messages', 'chat', 'Messages'], ['listings', 'box', 'Availability']];
  if (!tabs.some(t => t[0] === MP.tab)) MP.tab = tabs[0][0];
  $('#root').innerHTML = `<div class="ptabs">${tabs.map(t => `<button class="${MP.tab === t[0] ? 'on' : ''}" onclick="MP.tab='${t[0]}';render()">${ic(t[1])} ${t[2]}${t[0] === 'messages' && unread ? ` <i>${unread}</i>` : ''}</button>`).join('')}</div><div id="pbody"></div>`;
  ({ orders: vOrders, today: vToday, calendar: vCalendar, messages: vMessages, reports: vReports, listings: vListings, store: vStore, team: vTeam })[MP.tab]();
}

/* ---- Orders ---- */
function vOrders() {
  const q = MP.q.toLowerCase(), td = today;
  const views = isAdm() ? [['active', 'Active'], ['today', 'Today'], ['closed', 'Closed'], ['all', 'All']] : [['active', 'Active'], ['today', 'Today']];
  const list = MP.bookings.filter(b => (MP.view === 'all' || (MP.view === 'active' ? !Rules.CLOSED.includes(b.status) : MP.view === 'today' ? dayOf(b.created) === td || dayOf(startOf(b)) === td : Rules.CLOSED.includes(b.status)))
    && (!q || [b.ref, b.customer.name, b.customer.phone, b.email, b.lines.map(l => l.label || l.name).join(' ')].join(' ').toLowerCase().includes(q)));
  $('#pbody').innerHTML = `<div class="filters2"><input id="mq" placeholder="Search name, phone, ref, item…" value="${esc(MP.q)}">
      <div class="seg">${views.map(v => `<button class="${MP.view === v[0] ? 'on' : ''}" onclick="MP.view='${v[0]}';vOrders()">${v[1]}</button>`).join('')}</div>
      <button class="btn ghost sm" onclick="reload().then(render)">Refresh</button></div>
    ${isAdm() ? '' : '<p class="meta" style="margin:-2px 0 12px">Merchant Staff see active orders and today\'s orders. Use the main button to move each order to its next step.</p>'}
    ${list.map(card).join('') || `<div class="empty"><div class="big">${ic('receipt', 40)}</div>Nothing here.</div>`}`;
  $('#mq').oninput = e => { MP.q = e.target.value; const p = e.target.selectionStart; vOrders(); $('#mq').focus(); $('#mq').setSelectionRange(p, p); };
  wireCards($('#pbody'));
}
function card(b) {
  const c = b.customer, m = Rules.money(b), subj = encodeURIComponent(`${bizName(b.bizId)} - your ${b.kind === 'food' ? 'order' : 'booking'} ${b.ref}`);
  const rider = b.rider ? MP.riders.find(r => r.email === b.rider) : null;
  return `<div class="ordcard"><div class="th"><div><span class="ref">${esc(b.ref)}</span> <span class="mini">${kindIcon(b.kind)} ${b.kind === 'food' ? (b.fulfillment === 'delivery' ? 'Delivery' : 'Pick-up') : b.kind === 'stay' ? 'Stay' : b.kind === 'tour' ? 'Tour / service' : 'Rental'}</span><br><span class="mini">Placed ${dt(b.created)}</span></div>${statusChip(b.status)}</div>
    ${timeline(b)}
    <div class="cgrid">
      <div><span class="lbl">Customer</span><b>${esc(c.name)}</b><br><a href="tel:${esc(String(c.phone).replace(/\s/g, ''))}">${esc(c.phone)}</a><br><a href="mailto:${esc(b.email)}?subject=${subj}">${esc(b.email)}</a><br><span class="hint">${esc(c.address)}</span></div>
      <div><span class="lbl">${b.kind === 'food' ? 'Order' : 'Booking'}</span>${b.lines.map(l => `<div>${esc(l.type ? l.label : l.qty + ' x ' + l.name)}${l.addons && l.addons.length ? ` <span class="hint">(${esc(l.addons.join(', '))})</span>` : ''}${l.note ? ` <span class="hint">"${esc(l.note)}"</span>` : ''}${l.type ? `<br><span class="hint">${esc(bookingDates(l))}${l.type === 'stay' ? ' · ' + l.guests + ' guest(s)' : l.type === 'tour' ? ' · ' + l.pax + ' pax' : ' · ' + l.helmets + ' helmet(s) · ' + esc(l.pickup) + ' to ' + esc(l.ret)}</span>` : ''}</div>`).join('')}
        ${b.kind === 'food' && b.fulfillment === 'delivery' ? `<div class="hint" style="margin-top:4px">${ic('pin', 14)} ${esc(b.landmark || c.address)}${b.lat ? ` · <a href="https://maps.google.com/?q=${b.lat},${b.lng}" target="_blank" rel="noopener">map pin</a>` : ''}</div>` : ''}</div>
      <div><span class="lbl">Payment</span><b>${peso(Rules.payable(b))}</b> <span class="hint">${esc(Rules.PAY_LABEL[b.payMethod] || b.payMethod)} · ${esc(b.payStatus)}</span>
        ${b.kind === 'food' && b.fulfillment === 'delivery' && b.quote.riderFee != null ? `<br><span class="hint" data-delsplit>${ic('bike', 14)} Delivery${b.quote.km != null ? ' ' + b.quote.km + ' km' : ''}: customer pays ${peso(b.quote.deliveryFee)} · store pays ${peso(b.quote.storeDeliveryShare || 0)}</span>` : ''}
        ${b.kind !== 'food' && b.payStatus === 'Paid' && b.quote.balance ? `<br><span class="hint">Downpayment ${peso(b.dueNow)} paid · collect ${peso(b.quote.balance)} on arrival</span>` : ''}
        ${Rules.reductions(b).total ? `<br><span class="hint">${b.code ? 'Code ' + esc(b.code.code) + ' -' + peso(b.code.amount) + (b.code.fundedBy === 'tara' ? ' (paid back by Tara Romblon)' : '') : ''}${b.code && b.points ? ' · ' : ''}${b.points ? b.points.points + ' points -' + peso(b.points.amount) : ''}</span>` : ''}
        ${b.kind === 'food' && Rules.CASH.includes(b.payMethod) ? `<br><span class="hint">${b.payMethod === 'cod' && b.codToRider ? 'Rider collects ' + peso(Rules.payable(b)) + ' (paid to the rider; your share comes in your payout)' : ''}${b.payMethod === 'cod' && b.codToRider ? '' : b.payMethod === 'cod' ? 'Rider collects ' + peso(Rules.payable(b)) + ', hands you ' + peso(Rules.cashExpected(b)) : 'Collect ' + peso(Rules.payable(b)) + ' at pick-up'}</span>` : ''}
        ${b.cashCollected ? `<br><span class="hint">${ic('cash', 14)} Cash received ${peso(b.cashCollected.amount)}${b.cashCollected.amount !== b.cashCollected.expected ? ' (expected ' + peso(b.cashCollected.expected) + ')' : ''} · ${esc(b.cashCollected.by)}</span>` : ''}
        ${b.quote.deposit ? `<br><span class="hint">Security deposit ${peso(b.quote.deposit)}</span>` : ''}
        ${isAdm() ? `<br><span class="hint">Gross ${peso(Rules.gross(b))} · discount ${peso(b.discount || 0)} · platform fee ${peso(m.fee || b.fee || 0)} · net ${peso(Rules.gross(b) - (b.discount || 0) - (b.fee || 0))}</span>` : ''}
        ${isAdm() && b.proofFile ? `<br><button class="link" onclick="viewUpload('${esc(b.proofFile)}','Payment proof - ${esc(b.ref)}')">View payment proof</button>` : ''}
        ${isAdm() && b.idFile ? `<br><button class="link" onclick="viewUpload('${esc(b.idFile)}','Guest ID - ${esc(b.ref)}')">View guest ID</button>` : ''}</div></div>
    ${b.notes ? `<div class="warn">Customer note: ${esc(b.notes)}</div>` : ''}
    ${b.kind === 'food' && b.fulfillment === 'delivery' && !Rules.CLOSED.includes(b.status) ? `<div class="riderrow">${ic('bike')} <span>${rider ? `<b>${esc(rider.name)}</b> ${b.riderAccepted ? 'accepted this delivery' : 'has not accepted yet'}` : b.dispatch ? 'Finding a new rider…' : 'No rider assigned'}</span>
      ${b.dispatch ? '' : `<select data-rsel="${esc(b.ref)}"><option value="">${rider ? 'Change rider…' : 'Assign a rider…'}</option>${MP.riders.map(r => `<option value="${esc(r.email)}">${esc(r.name)} ${r.available ? '(available)' : '(offline)'}</option>`).join('')}</select>`}</div>` : ''}
    ${statusActions(b, actor())}
    <div class="rowbtns" style="margin:10px 0 0"><button class="btn ghost sm" onclick="Chat.open({ref:'${esc(b.ref)}'})">${ic('chat')} Message customer</button>${b.rider ? `<button class="btn ghost sm" onclick="Chat.open({ref:'${esc(b.ref)}',chan:'rider'})">${ic('bike')} Message rider</button>` : ''}${Rules.trackable(b) ? `<button class="btn sm track" onclick="Track.open('${esc(b.ref)}',MP.token)">${ic('locate')} Track rider</button>` : ''}
      ${isAdm() ? `<button class="btn ghost sm" onclick="editDiscount('${esc(b.ref)}')">${ic('tag')} Discount</button>` : ''}
      ${b.history && b.history.length ? `<button class="btn ghost sm" onclick="showHistory('${esc(b.ref)}')">${ic('clock')} History</button>` : ''}</div></div>`;
}
function wireCards(root) {
  wireStatus(root, () => MP.token, async () => { await reload(true); render(); }, ref => MP.bookings.find(b => b.ref === ref));
  root.querySelectorAll('[data-rsel]').forEach(s => s.onchange = async () => {
    if (!s.value) return; loading(true, 'Assigning rider…');
    try { await api('assignRider', { token: MP.token, ref: s.dataset.rsel, rider: s.value }); await reload(true); loading(false); toast('Rider assigned and notified'); render(); } catch (x) { loading(false); toast(x.message); }
  });
}
function showHistory(ref) { const b = MP.bookings.find(x => x.ref === ref); openSheet(`<div class="sbody"><h2>History · ${esc(ref)}</h2><div class="nlist">${(b.history || []).slice().reverse().map(h => `<div class="nitem">${ic('clock')}<div><b>${esc(h.status)}</b> · ${esc(h.by || '')} <span class="hint">${esc(Rules.ROLE_LABEL[h.role] || h.role || '')}</span>${h.note ? `<div class="hint">${esc(h.note)}</div>` : ''}<small>${dt(h.at)}</small></div></div>`).join('')}</div></div>`); }
function editDiscount(ref) {
  const b = MP.bookings.find(x => x.ref === ref);
  openSheet(`<div class="sbody"><h2>Discount · ${esc(ref)}</h2><p class="meta">Recorded against your business. Net = gross ${peso(Rules.gross(b))} − discount − platform fee.</p>
    <div class="field mt"><label>Discount amount (P)</label><input id="dsc" type="number" min="0" step="any" value="${b.discount || 0}"></div><div class="field mt"><label>Internal note</label><input id="dscN" value="${esc(b.merchantNotes || '')}"></div>
    <div class="err" id="dscE"></div><button class="btn full mt" id="dscGo">Save discount</button></div>`);
  $('#dscGo').onclick = async () => { try { await api('mUpdate', { token: MP.token, ref, discount: +$('#dsc').value, merchantNotes: $('#dscN').value }); closeSheet(); await reload(true); render(); toast('Discount saved'); } catch (x) { $('#dscE').textContent = x.message; } };
}

/* ---- Today (sales for the day, per payment type) ---- */
function vToday() {
  const td = today, todays = MP.bookings.filter(b => dayOf(b.created) === td), conf = todays.filter(Rules.confirmed);
  const types = Object.keys(Rules.PAY_LABEL), row = pm => { const l = conf.filter(b => b.payMethod === pm); return { pm, n: l.length, sales: l.reduce((t, b) => t + Rules.gross(b), 0), del: l.reduce((t, b) => t + (b.kind === 'food' ? +b.quote.deliveryFee || 0 : 0), 0), total: l.reduce((t, b) => t + (+b.quote.total || 0), 0) }; };
  const rows = types.map(row).filter(r => r.n), T = k => rows.reduce((t, r) => t + r[k], 0);
  const upcoming = MP.bookings.filter(b => b.kind !== 'food' && !Rules.CLOSED.includes(b.status) && dayOf(startOf(b)) === td);
  $('#pbody').innerHTML = `<div class="kpis"><div class="kpi"><span>Orders & bookings today</span><b>${todays.length}</b><small>${conf.length} confirmed</small></div>
      <div class="kpi"><span>Sales today</span><b>${peso(T('sales'))}</b><small>confirmed, before fees</small></div>
      <div class="kpi"><span>Delivery fees today</span><b>${peso(T('del'))}</b><small>for riders</small></div></div>
    <div class="acard"><h3>Today's summary by payment type <span class="hint">${fmtD(td)}</span></h3><div class="tscroll"><table class="btable"><tr><th>Payment type</th><th>Count</th><th>Sales</th><th>Delivery fees</th><th>Total</th></tr>
      ${rows.map(r => `<tr><td>${esc(Rules.PAY_LABEL[r.pm])}</td><td>${r.n}</td><td>${peso(r.sales)}</td><td>${peso(r.del)}</td><td>${peso(r.total)}</td></tr>`).join('') || '<tr><td colspan="5">No confirmed sales yet today.</td></tr>'}
      ${rows.length ? `<tr class="tot"><td>Total</td><td>${T('n')}</td><td>${peso(T('sales'))}</td><td>${peso(T('del'))}</td><td>${peso(T('total'))}</td></tr>` : ''}</table></div>
      ${isAdm() ? '' : '<p class="hint mt">Merchant Staff can see today\'s sales only.</p>'}</div>
    ${upcoming.length ? `<div class="acard"><h3>Arrivals & pick-ups today</h3>${upcoming.map(b => `<div class="xrow"><div class="xi">${kindIcon(b.kind)}</div><div><b>${esc(b.customer.name)} · ${esc(b.ref)}</b><span>${esc(b.lines.map(l => l.label + ' ' + bookingDates(l)).join('; '))}</span></div>${statusChip(b.status)}</div>`).join('')}</div>` : ''}
    <h3 style="margin:16px 0 10px;color:var(--navy)">Needs action</h3>
    ${MP.bookings.filter(b => !Rules.CLOSED.includes(b.status) && Rules.allowed(b, actor()).length).slice(0, 12).map(card).join('') || '<div class="empty">All caught up.</div>'}`;
  wireCards($('#pbody'));
}

/* ---- Calendar: current and upcoming stays, rentals and tours ---- */
const calDay = s => String(s).slice(0, 10);
function calBookings() { return MP.bookings.filter(b => b.kind !== 'food' && !Rules.FREE.includes(b.status)); }
function calLines() { const out = []; calBookings().forEach(b => b.lines.forEach(l => { if (l.type && (!MP.cal.unit || l.itemId === MP.cal.unit)) out.push({ b, l, s: calDay(l.start), e: calDay(l.end) }); })); return out; }
const onDay = (x, d) => x.l.type === 'stay' ? x.s <= d && d < x.e : x.s <= d && d <= x.e;
const unitText = l => l.type === 'stay' ? l.label : l.type === 'rental' ? l.label : l.label + ' · ' + l.pax + ' pax';
function vCalendar() {
  const C = MP.cal, [y, m] = C.m.split('-').map(Number), first = new Date(y, m - 1, 1), start = new Date(y, m - 1, 1 - first.getDay()), L = calLines();
  const units = []; calBookings().forEach(b => b.lines.forEach(l => { if (l.type && !units.some(u => u.id === l.itemId)) units.push({ id: l.itemId, name: l.label }); }));
  CAT.stays.filter(x => x.bizId === MP.me.bizId).concat(CAT.rentals.units.filter(x => x.bizId === MP.me.bizId), CAT.tours.filter(x => x.bizId === MP.me.bizId)).forEach(x => { if (!units.some(u => u.id === x.id)) units.push({ id: x.id, name: x.name }); });
  let cells = '';
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i); const ds = iso(d), ev = L.filter(x => onDay(x, ds));
    cells += `<button class="dc ${d.getMonth() !== m - 1 ? 'out' : ''} ${ds === today ? 'td' : ''} ${ds === C.day ? 'sel' : ''}" onclick="MP.cal.day='${ds}';vCalendar()"><span class="dn">${d.getDate()}</span>${ev.slice(0, 3).map(x => `<span class="ev k-${x.l.type}">${esc(x.b.customer.name.split(' ')[0])} · ${esc(x.l.type === 'stay' ? (x.s === ds ? 'in ' : '') + x.l.label : x.l.label)}</span>`).join('')}${ev.length > 3 ? `<span class="more">+${ev.length - 3} more</span>` : ''}</button>`;
    if (i === 34 && d.getMonth() !== m - 1) break;
  }
  const dayList = L.filter(x => onDay(x, C.day) || x.s === C.day || x.e === C.day).sort((a, b) => a.l.start.localeCompare(b.l.start));
  const upcoming = L.filter(x => x.e >= today).sort((a, b) => a.l.start.localeCompare(b.l.start));
  const row = x => { const tag = x.l.type === 'stay' ? (x.s === C.day ? 'Check-in' : x.e === C.day ? 'Check-out' : 'Staying') : x.l.type === 'rental' ? (x.s === C.day ? 'Pick-up' : x.e === C.day ? 'Return' : 'Out') : 'Booked';
    return `<div class="xrow"><div class="xi">${kindIcon(x.b.kind)}</div><div><b>${esc(x.b.customer.name)} · ${esc(unitText(x.l))}</b><span>${esc(bookingDates(x.l))}${x.l.type === 'stay' ? ' · ' + x.l.guests + ' guest(s)' : ''} · ${esc(x.b.ref)} · <a href="tel:${esc(String(x.b.customer.phone).replace(/\s/g, ''))}">${esc(x.b.customer.phone)}</a></span></div><div style="text-align:right">${statusChip(x.b.status)}<br><span class="hint">${tag}</span></div></div>`; };
  const prev = new Date(y, m - 2, 1), next = new Date(y, m, 1), mk = d => d.getFullYear() + '-' + pad(d.getMonth() + 1);
  $('#pbody').innerHTML = `<div class="acard"><div class="calhead"><button class="btn ghost sm" onclick="MP.cal.m='${mk(prev)}';vCalendar()">‹</button><h3>${first.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}</h3><button class="btn ghost sm" onclick="MP.cal.m='${mk(next)}';vCalendar()">›</button><button class="btn ghost sm" onclick="MP.cal.m='${today.slice(0, 7)}';MP.cal.day='${today}';vCalendar()">Today</button>
      ${units.length > 1 ? `<select onchange="MP.cal.unit=this.value;vCalendar()" style="border:1.5px solid var(--line);border-radius:10px;padding:7px 10px;font-size:13px"><option value="">All units</option>${units.map(u => `<option value="${esc(u.id)}" ${MP.cal.unit === u.id ? 'selected' : ''}>${esc(u.name)}</option>`).join('')}</select>` : ''}</div>
      <div class="cal">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => `<div class="dh">${d}</div>`).join('')}${cells}</div></div>
    <div class="acard callist"><h3>${fmtD(C.day)} <span class="hint">${dayList.length} booking${dayList.length === 1 ? '' : 's'}</span></h3>${dayList.map(row).join('') || '<p class="meta">No bookings on this day.</p>'}</div>
    <div class="acard callist"><h3>Current & upcoming <span class="hint">${upcoming.length}</span></h3>${upcoming.map(row).join('') || '<p class="meta">No current or upcoming bookings.</p>'}</div>`;
}

/* ---- Messages ---- */
function vMessages() {
  const without = MP.bookings.filter(b => !MP.threads.some(t => t.ref === b.ref) && !Rules.CLOSED.includes(b.status)).slice(0, 15);
  $('#pbody').innerHTML = `<p class="meta" style="margin-bottom:12px">In-app messages from customers about your listings and orders. Replies are shared with the customer, the assigned rider and Beyond Tech Solutions Super Admins.</p>
    ${Chat.list(MP.threads, { empty: 'No messages yet.' })}
    <div class="xsec">Start a chat about an order</div>${without.map(b => `<button class="xrow" onclick="Chat.open({ref:'${esc(b.ref)}'})"><div class="xi">${kindIcon(b.kind)}</div><div><b>${esc(b.customer.name)} · ${esc(b.ref)}</b><span>${esc(b.lines.map(l => l.label || l.name).join(', '))}</span></div>${statusChip(b.status)}</button>`).join('') || '<p class="meta">No other active orders.</p>'}`;
}

/* ---- Reports (Merchant Admin) ---- */
function vReports() {
  if (!isAdm()) { $('#pbody').innerHTML = '<div class="empty">Reports are for the Merchant Admin.</div>'; return; }
  const r = MP.r, inR = b => { const d = dayOf(b.created); return (!r.from || d >= r.from) && (!r.to || d <= r.to); };
  const L = MP.bookings.filter(inR), conf = L.filter(Rules.confirmed), M = conf.map(b => ({ b, m: Rules.money(b) })), S = k => M.reduce((t, x) => t + x.m[k], 0);
  const byPay = Object.keys(Rules.PAY_LABEL).map(pm => { const l = M.filter(x => x.b.payMethod === pm); return { pm, n: l.length, gross: l.reduce((t, x) => t + x.m.gross, 0), fee: l.reduce((t, x) => t + x.m.fee, 0), net: l.reduce((t, x) => t + x.m.net, 0), del: l.reduce((t, x) => t + x.m.delivery, 0) }; }).filter(x => x.n);
  const items = {}; conf.forEach(b => b.lines.forEach(l => { const k = l.label || l.name; items[k] = items[k] || { q: 0, g: 0 }; items[k].q += l.qty || l.nights || l.days || 1; items[k].g += l.total; }));
  const top = Object.entries(items).sort((a, b) => b[1].g - a[1].g).slice(0, 10);
  const days = {}; M.forEach(x => { const d = dayOf(x.b.created); days[d] = days[d] || { n: 0, g: 0, f: 0, net: 0 }; days[d].n++; days[d].g += x.m.gross; days[d].f += x.m.fee; days[d].net += x.m.net; });
  const rem = M.filter(x => Rules.NONCASH.includes(x.b.payMethod) && x.m.collectedOnline);
  window._mrep = { M, byPay, top, days, rem };
  const fee = (CAT.businesses.find(z => z.id === MP.me.bizId) || {}).platformFee || {};
  $('#pbody').innerHTML = `<div class="filters2 noprint"><label>From <input type="date" id="rf" value="${r.from}"></label><label>To <input type="date" id="rt" value="${r.to}"></label><button class="btn sm" onclick="dlMerchant()">Download CSV</button><button class="btn ghost sm" onclick="window.print()">Print / PDF</button></div>
    <div class="kpis"><div class="kpi"><span>Gross sales</span><b>${peso(S('gross'))}</b><small>${conf.length} confirmed</small></div><div class="kpi warnk"><span>Platform fees</span><b>${peso(S('fee'))}</b><small>${fee.type === 'fixed' ? peso(fee.value) + ' per transaction' : (fee.value || 0) + '% of order amount'}</small></div>
      <div class="kpi"><span>Net sales</span><b>${peso(S('net'))}</b><small>after discounts ${peso(S('discount'))} & fees</small></div><div class="kpi"><span>Delivery fees</span><b>${peso(S('delivery'))}</b><small>paid to riders</small></div>
      <div class="kpi"><span>Received via HitPay / transfer</span><b>${peso(rem.reduce((t, x) => t + x.m.collectedOnline, 0))}</b><small>held by Beyond Tech Solutions for remittance</small></div><div class="kpi"><span>Remittance due to you</span><b>${peso(rem.reduce((t, x) => t + x.m.remit, 0))}</b><small>after fees & discounts</small></div></div>
    <div class="acard"><h3>By payment type</h3><div class="tscroll"><table class="btable"><tr><th>Payment</th><th>Count</th><th>Gross</th><th>Platform fees</th><th>Net</th><th>Delivery fees</th></tr>${byPay.map(x => `<tr><td>${esc(Rules.PAY_LABEL[x.pm])}</td><td>${x.n}</td><td>${peso(x.gross)}</td><td>${peso(x.fee)}</td><td>${peso(x.net)}</td><td>${peso(x.del)}</td></tr>`).join('') || '<tr><td colspan="6">No data</td></tr>'}</table></div></div>
    <div class="acard"><h3>Top-selling items & listings</h3><table class="btable"><tr><th>Item</th><th>Qty / nights / days</th><th>Gross</th></tr>${top.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v.q}</td><td>${peso(v.g)}</td></tr>`).join('') || '<tr><td colspan="3">No data</td></tr>'}</table></div>
    <div class="acard"><h3>Daily sales</h3><table class="btable"><tr><th>Date</th><th>Count</th><th>Gross</th><th>Platform fees</th><th>Net</th></tr>${Object.keys(days).sort().reverse().map(d => `<tr><td>${fmtD(d)}</td><td>${days[d].n}</td><td>${peso(days[d].g)}</td><td>${peso(days[d].f)}</td><td>${peso(days[d].net)}</td></tr>`).join('') || '<tr><td colspan="5">No data</td></tr>'}</table></div>
    <div class="acard"><h3>Remittance (HitPay & other non-cash payments)</h3><div class="tscroll"><table class="btable"><tr><th>Ref</th><th>Date</th><th>Payment</th><th>Gross</th><th>Discount</th><th>Platform fee</th><th>Net</th><th>Received online</th><th>Remit to you</th></tr>
      ${rem.map(x => `<tr><td>${esc(x.b.ref)}</td><td>${fmtD(dayOf(x.b.created))}</td><td>${esc(Rules.PAY_LABEL[x.b.payMethod])}</td><td>${peso(x.m.gross)}</td><td>${peso(x.m.discount)}</td><td>${peso(x.m.fee)}</td><td>${peso(x.m.net)}</td><td>${peso(x.m.collectedOnline)}</td><td>${peso(x.m.remit)}</td></tr>`).join('') || '<tr><td colspan="9">No non-cash payments in this period.</td></tr>'}</table></div>
      <p class="hint mt">For stays and rentals, only the downpayment is received online; you collect the balance on arrival. Remit = received online − delivery fee (food) − discount − platform fee.</p></div>`;
  $('#pbody').insertAdjacentHTML('beforeend', '<div class="acard" id="rwRep"><h3>Reward points & discounts by customer</h3><p class="meta">Loading…</p></div>');
  api('mRewardsReport', { token: MP.token }).then(r => { const el = $('#rwRep'); if (!el) return; window._rw = r; const P = r.program, C = r.customers.sort((a, b) => b.balance - a.balance || b.codeAmount - a.codeAmount), T = k => C.reduce((t, c) => t + (+c[k] || 0), 0);
    el.innerHTML = `<h3>Reward points & discounts by customer</h3><p class="meta">${P.enabled ? `Rewards on · 1 point per ${peso(P.pesoPerPoint)} · 1 point = ${peso(P.pointValue)}${P.loyverse ? ' · synced with Loyverse' : ''}` : 'Rewards are off. Turn them on in Store settings.'} · Discount codes ${r.acceptCodes ? 'accepted' : 'not accepted'}</p>
      <div class="kpis"><div class="kpi"><span>Points earned</span><b>${T('earned') + T('bonus')}</b><small>incl. ${T('bonus')} bonus</small></div><div class="kpi"><span>Points redeemed</span><b>${T('redeemed')}</b><small>${peso(T('pointsAmount'))} in discounts</small></div><div class="kpi"><span>Points balance</span><b>${T('balance')}</b><small>owed to customers (app)</small></div><div class="kpi"><span>Discount codes used</span><b>${T('codeUses')}</b><small>${peso(T('codeAmount'))} off</small></div></div>
      <div class="tscroll"><table class="btable"><tr><th>Customer</th><th>Earned</th><th>Bonus</th><th>Redeemed</th><th>Balance</th>${C.some(c => c.loyverseBalance != null) ? '<th>Loyverse balance</th>' : ''}<th>Points discount</th><th>Codes used</th><th>Code discounts</th><th>Other discounts</th></tr>
      ${C.map(c => `<tr><td>${esc(c.name || '-')}<br><span class="hint">${esc(c.email)}</span></td><td>${c.earned}</td><td>${c.bonus}</td><td>${c.redeemed}</td><td><b>${c.balance}</b></td>${C.some(x => x.loyverseBalance != null) ? `<td>${c.loyverseBalance != null ? c.loyverseBalance : '-'}</td>` : ''}<td>${peso(c.pointsAmount)}</td><td>${c.codeUses}${c.codes.length ? '<br><span class="hint">' + esc(c.codes.join(', ')) + '</span>' : ''}</td><td>${peso(c.codeAmount)}</td><td>${peso(c.manual)}</td></tr>`).join('') || '<tr><td colspan="10">No points or discounts yet.</td></tr>'}</table></div>
      <button class="btn ghost sm mt" onclick="dlRewards()">Download CSV</button>`; }).catch(x => { const el = $('#rwRep'); if (el) el.innerHTML = '<div class="err">' + esc(x.message) + '</div>'; });
  $('#rf').onchange = $('#rt').onchange = () => { MP.r = { from: $('#rf').value, to: $('#rt').value }; vReports(); };
}
function dlRewards() { const r = window._rw; downloadCSV(MP.me.bizId + '-rewards-' + today + '.csv', [['Customer', 'Email', 'Points earned', 'Bonus points', 'Points redeemed', 'Balance', 'Loyverse balance', 'Points discount', 'Codes used', 'Codes', 'Code discounts', 'Other discounts'], ...r.customers.map(c => [c.name, c.email, c.earned, c.bonus, c.redeemed, c.balance, c.loyverseBalance == null ? '' : c.loyverseBalance, c.pointsAmount, c.codeUses, c.codes.join(' '), c.codeAmount, c.manual])]); }
function dlMerchant() {
  const R = window._mrep;
  downloadCSV(MP.me.bizId + '-report-' + today + '.csv', [['Ref', 'Date', 'Type', 'Customer', 'Payment', 'Status', 'Gross', 'Discount', 'Platform fee', 'Net', 'Delivery fee', 'Received online', 'Remit to merchant'],
    ...R.M.map(x => [x.b.ref, x.b.created, x.b.kind, x.b.customer.name, Rules.PAY_LABEL[x.b.payMethod], x.b.status, x.m.gross, x.m.discount, x.m.fee, x.m.net, x.m.delivery, x.m.collectedOnline, x.m.remit])]);
}

/* ---- Listings: availability (all users) and prices, discounts, deposits (Merchant Admin) ---- */
const LFIELDS = { stay: [['rate', 'Rate / night (P)'], ['promoPct', 'Discount (%)'], ['deposit', 'Security deposit (P)']], unit: [['dailyRate', 'Daily rate (P)'], ['hourlyRate', 'Extra hour (P)'], ['deposit', 'Security deposit (P)'], ['promoPct', 'Discount (%)']], tour: [['rate', 'Rate (P)'], ['promoPct', 'Discount (%)'], ['deposit', 'Security deposit (P)']] };
/* Merchant Admin edits go into one draft (MP.ld) and are saved together with one Save button */
function listingDraft() {
  const id = MP.me.bizId, F = Pricing.store(CAT, id), o = {};
  CAT.stays.filter(x => x.bizId === id).forEach(x => o['stay|' + x.id] = x);
  CAT.rentals.units.filter(x => x.bizId === id).forEach(x => o['unit|' + x.id] = x);
  CAT.tours.filter(x => x.bizId === id).forEach(x => o['tour|' + x.id] = x);
  const other = {}; for (const k in o) { const kind = k.split('|')[0], r = { active: o[k].active !== false }; LFIELDS[kind].forEach(f => r[f[0]] = o[k][f[0]] == null ? '' : o[k][f[0]]); other[k] = r; }
  return { cats: F ? F.categories.map(c => ({ id: c.id, name: c.name })) : [], items: F ? F.items.map(i => ({ id: i.id, name: i.name, desc: i.desc || '', catId: i.catId || '', price: i.price, promoPct: i.promoPct || '', available: i.available !== false })) : [], other };
}
const ldDirty = () => MP.ld && JSON.stringify(MP.ld) !== JSON.stringify(listingDraft());
window.addEventListener('beforeunload', e => { if (ldDirty()) { e.preventDefault(); e.returnValue = ''; } });
function vListings() {
  const id = MP.me.bizId, F = Pricing.store(CAT, id), adm = isAdm();
  const stays = CAT.stays.filter(s => s.bizId === id), units = CAT.rentals.units.filter(u => u.bizId === id), tours = CAT.tours.filter(t => t.bizId === id);
  if (adm && !MP.ld) MP.ld = listingDraft();
  const D = MP.ld;
  const tog = (kind, x, on, draft) => `<label class="toggle"><input type="checkbox" ${draft ? `data-dav="${draft}"` : `data-av="${kind}|${esc(x)}"`} ${on ? 'checked' : ''}><span>${on ? 'Available' : 'Off'}</span></label>`;
  const pr = it => Pricing.promo(it) ? `<span class="promo">-${Pricing.promo(it)}%</span>` : '';
  const icon = { item: 'cup', stay: 'bed', unit: 'scooter', tour: 'boat' };
  const thumb = (kind, it) => `<span class="lthumb">${it && it.photo ? `<img src="${esc(it.photo)}" alt="">` : ic(icon[kind], 24)}</span>`;
  const photoActs = (kind, it) => kind === 'stay' ? `<div class="acts"><button class="btn sm" onclick="galleryEditor('${esc(it.id)}', MP.token)">${ic('upload', 14)} Photos (${Pricing.stayPhotos(it).length})</button></div>` : `<div class="acts"><label class="btn ghost sm">${ic('upload', 14)} ${it.photo ? 'Change photo' : 'Add photo'}<input type="file" accept="image/*" hidden data-ph="${kind}|${esc(it.id)}"></label>${it.photo ? `<button class="btn ghost sm" data-phx="${kind}|${esc(it.id)}">Remove photo</button>` : ''}${kind === 'item' ? `<button class="btn ghost sm" data-addons="${esc(it.id)}">${ic('box', 14)} Add-ons (${Pricing.addonGroups(it).length})</button>` : ''}</div>`;
  const staffRow = (kind, it, label, sub) => `<div class="avrow"><div class="lphoto">${thumb(kind, it)}<div><b>${esc(label)}</b>${pr(it)}<span class="hint">${esc(sub)}</span></div></div>${tog(kind, it.id, kind === 'item' ? it.available : it.active)}</div>`;
  const otherRow = (kind, it, label, sub) => { const k = kind + '|' + it.id, r = D.other[k], fs = LFIELDS[kind];
    return `<div class="lstedit"><div><div class="lphoto">${thumb(kind, it)}<div><b>${esc(label)}</b>${pr(it)}<span class="hint" style="display:block">${esc(sub)}</span></div></div>${photoActs(kind, it)}${tog(kind, it.id, r.active, k)}</div>${fs.map(f => `<div class="field"><label>${f[1]}</label><input type="number" min="0" step="any" data-dlp="${esc(k)}|${f[0]}" value="${esc(r[f[0]])}" placeholder="0"></div>`).join('')}${'<div></div>'.repeat(4 - fs.length)}<div></div></div>`; };
  const cats = D ? D.cats : (F ? F.categories : []);
  const itemRow = (d, i) => { const live = F.items.find(x => x.id === d.id);
    if (d.removed) return `<div class="mrow removed"><span class="lthumb">${ic('cup', 20)}</span><div><b>${esc(d.name || 'New item')}</b><span class="hint" style="display:block">Will be removed when you save</span></div><button class="btn ghost sm" data-mundo="${i}">Undo</button></div>`;
    return `<div class="mrow ${d.available ? '' : 'off'}" data-mi="${i}">${thumb('item', live)}
      <div class="mmain"><input data-m="${i}|name" value="${esc(d.name)}" placeholder="Item name" aria-label="Item name"><input data-m="${i}|desc" value="${esc(d.desc)}" placeholder="Short description (optional)" aria-label="Description">
        <select data-m="${i}|catId" aria-label="Category">${cats.map(c => `<option value="${esc(c.id)}" ${c.id === d.catId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}<option value="__new">+ New category…</option></select>
        ${live ? photoActs('item', live) : '<span class="hint">New · save first to add a photo and add-ons</span>'}</div>
      <div class="field fprice"><label>Price (P)</label><input type="number" min="0" step="any" data-m="${i}|price" value="${esc(d.price)}" placeholder="0"></div>
      <div class="field fdisc"><label>Discount (%)</label><input type="number" min="0" max="90" step="any" data-m="${i}|promoPct" value="${esc(d.promoPct)}" placeholder="0"></div>
      ${tog('item', d.id, d.available, 'item|' + i)}
      <button class="xbtn" title="Remove item" aria-label="Remove ${esc(d.name)}" data-mdel="${i}">${ic('x')}</button></div>`; };
  const catEditor = () => { const use = id => D.items.filter(x => !x.removed && x.catId === id).length;
    return `<details class="catbox" ${MP.catOpen ? 'open' : ''}><summary>${ic('box', 16)} Categories <span class="hint">${D.cats.length} · tap to add, rename, reorder or remove</span></summary>
      ${D.cats.map((c, i) => `<div class="catrow"><input data-c="${i}" value="${esc(c.name)}" placeholder="Category name" aria-label="Category name"><span class="hint">${use(c.id)} item${use(c.id) === 1 ? '' : 's'}</span>
        <button class="btn ghost sm" data-cmv="${i}|-1" ${i ? '' : 'disabled'} aria-label="Move up">↑</button><button class="btn ghost sm" data-cmv="${i}|1" ${i < D.cats.length - 1 ? '' : 'disabled'} aria-label="Move down">↓</button>
        <button class="xbtn" data-cdel="${i}" title="${use(c.id) ? 'Move its items to another category first' : 'Remove category'}" ${use(c.id) ? 'disabled' : ''}>${ic('x')}</button></div>`).join('') || '<p class="meta">No categories yet.</p>'}
      <div class="catrow"><input id="cNew" placeholder="New category, e.g. Rice meals" maxlength="40"><button class="btn ghost sm" id="cAdd">${ic('plus', 14)} Add category</button></div>
      <p class="hint">Categories show as tabs in the customer menu, in this order. A category can be removed once no items use it.</p></details>`; };
  const dirty = adm && ldDirty(), nItems = D ? D.items.filter(x => !x.removed).length : 0;
  $('#pbody').innerHTML = `<p class="meta" style="margin-bottom:12px">${adm ? 'Add, edit or remove menu items and update prices, discounts and availability, then tap <b>Save all changes</b> at the bottom. Changes show in the customer app after saving and apply to new orders only.' : 'Turn listings and menu items on or off. Changes show in the customer app right away. Prices are managed by your Merchant Admin.'}</p>
    ${F ? `<div class="acard"><h3>${esc(F.storeName)}</h3><div class="avrow"><div class="lphoto">${thumb('item', F)}<div><b>Accepting orders</b><span class="hint">Turn off to close the store (takes effect right away)</span></div></div>${tog('store', 'store', F.open)}</div>${adm ? `<div class="acts" style="margin-top:6px"><label class="btn ghost sm">${ic('upload', 14)} ${F.photo ? 'Change' : 'Add'} store logo / photo<input type="file" accept="image/*" hidden data-ph="store|store"></label></div>` : ''}</div>
      <div class="acard" id="menuCard"><h3>Menu items <span class="hint">${adm ? nItems + ' items · ' + D.cats.length + ' categories' : F.items.length + ' items'}</span>${adm ? `<button class="btn ghost sm" data-newcat style="margin-left:auto">${ic('plus', 14)} Add category</button>` : ''}</h3>
      ${adm ? catEditor() : ''}
      ${adm ? (D.items.map(itemRow).join('') || '<p class="meta">No menu items yet. Add your first item below.</p>') + `<div class="rowbtns mt"><button class="btn ghost" id="mAdd">${ic('plus')} Add menu item</button><button class="btn ghost" data-newcat>${ic('plus')} Add category</button></div>`
        : F.items.map(i => staffRow('item', i, i.name, peso(Pricing.off(i.price, Pricing.promo(i))) + (Pricing.promo(i) ? ' (was ' + peso(i.price) + ')' : ''))).join('') || '<p class="meta">No menu items yet.</p>'}</div>` : ''}
    ${stays.length ? `<div class="acard"><h3>Stays</h3>${stays.map(x => adm ? otherRow('stay', x, x.name, peso(x.rate) + ' / night') : staffRow('stay', x, x.name, peso(x.rate) + ' / night')).join('')}</div>` : ''}
    ${units.length ? `<div class="acard"><h3>Rental units</h3>${units.map(x => adm ? otherRow('unit', x, x.name, peso(x.dailyRate) + ' / day · ' + peso(x.hourlyRate) + ' / extra hour') : staffRow('unit', x, x.name, peso(x.dailyRate) + ' / day')).join('')}</div>` : ''}
    ${tours.length ? `<div class="acard"><h3>Tours & services</h3>${tours.map(x => adm ? otherRow('tour', x, x.name, peso(x.rate) + ' / ' + (x.rateUnit === 'group' ? 'group' : 'person')) : staffRow('tour', x, x.name, peso(x.rate))).join('')}</div>` : ''}
    ${!F && !stays.length && !units.length && !tours.length ? '<div class="empty">No listings yet. Ask Beyond Tech Solutions to add your listings.</div>' : ''}
    ${adm && (F || stays.length || units.length || tours.length) ? `<div class="savebar ${dirty ? 'dirty' : ''}" id="ldBar"><span id="ldMsg">${dirty ? 'You have unsaved changes' : 'All changes saved'}</span><div class="err" id="ldErr"></div><button class="btn ghost" id="ldDiscard" ${dirty ? '' : 'disabled'}>Discard</button><button class="btn" id="ldSave" ${dirty ? '' : 'disabled'}>Save all changes</button></div>` : ''}`;
  const fresh = async () => { const c = await api('getCatalog'); if (c.catalog) CAT = Pricing.norm(c.catalog); };
  const mark = () => { const d = ldDirty(), bar = $('#ldBar'); if (!bar) return; bar.classList.toggle('dirty', !!d); $('#ldMsg').textContent = d ? 'You have unsaved changes' : 'All changes saved'; $('#ldSave').disabled = $('#ldDiscard').disabled = !d; };
  document.querySelectorAll('[data-av]').forEach(cb => cb.onchange = async () => {
    const [kind, x] = cb.dataset.av.split('|');
    try { await api('mAvailability', { token: MP.token, kind, id: x, value: cb.checked }); cb.nextElementSibling.textContent = cb.checked ? 'Available' : 'Off'; toast('Updated'); await fresh(); }
    catch (e) { cb.checked = !cb.checked; toast(e.message); }
  });
  if (adm) {
    document.querySelectorAll('[data-dav]').forEach(cb => cb.onchange = () => { const v = cb.dataset.dav, on = cb.checked; if (v.startsWith('item|')) { D.items[+v.split('|')[1]].available = on; cb.closest('.mrow').classList.toggle('off', !on); } else D.other[v].active = on; cb.nextElementSibling.textContent = on ? 'Available' : 'Off'; mark(); });
    document.querySelectorAll('[data-m]').forEach(x => x.oninput = x.onchange = () => { const [i, k] = x.dataset.m.split('|'); if (k === 'catId' && x.value === '__new') { x.value = D.items[+i].catId; newCategory(id => { D.items[+i].catId = id; }); return; } D.items[+i][k] = (k === 'price' || k === 'promoPct') && x.value !== '' ? +x.value : x.value; mark(); });
    document.querySelectorAll('[data-dlp]').forEach(x => x.oninput = () => { const v = x.dataset.dlp.split('|'); D.other[v[0] + '|' + v[1]][v[2]] = x.value === '' ? '' : +x.value; mark(); });
    document.querySelectorAll('[data-mdel]').forEach(x => x.onclick = () => { const i = +x.dataset.mdel; if (!D.items[i].id) D.items.splice(i, 1); else D.items[i].removed = true; vListings(); });
    document.querySelectorAll('[data-mundo]').forEach(x => x.onclick = () => { delete D.items[+x.dataset.mundo].removed; vListings(); });
    const cb = document.querySelector('.catbox'); if (cb) cb.ontoggle = () => { MP.catOpen = cb.open; };
    document.querySelectorAll('[data-c]').forEach(x => { x.oninput = () => { D.cats[+x.dataset.c].name = x.value; mark(); }; x.onchange = () => vListings(); });
    document.querySelectorAll('[data-cmv]').forEach(x => x.onclick = () => { const [i, d] = x.dataset.cmv.split('|').map(Number), c = D.cats.splice(i, 1)[0]; D.cats.splice(i + d, 0, c); vListings(); });
    document.querySelectorAll('[data-cdel]').forEach(x => x.onclick = () => { D.cats.splice(+x.dataset.cdel, 1); vListings(); });
    const addCat = () => { const nm = $('#cNew').value.trim(); if (!nm) { $('#cNew').focus(); return; } if (D.cats.some(c => c.name.trim().toLowerCase() === nm.toLowerCase())) { toast('There is already a category named ' + nm); return; } D.cats.push({ id: 'new:' + Date.now().toString(36), name: nm }); MP.catOpen = true; vListings(); toast('Category added. Choose it on an item, then Save all changes.'); };
    document.querySelectorAll('[data-newcat]').forEach(x => x.onclick = () => newCategory());
    function newCategory(then) {
      openSheet(`<div class="sbody"><h2>Add a menu category</h2><p class="meta" style="margin-top:4px">Categories show as tabs in the customer menu, e.g. Rice meals, Desserts, Drinks.</p>
        <div class="field mt"><label>Category name</label><input id="ncName" maxlength="40" placeholder="e.g. Rice meals"></div><div class="err" id="ncErr"></div>
        <div class="row2 mt"><button class="btn ghost" onclick="closeSheet()">Cancel</button><button class="btn" id="ncOk">Add category</button></div></div>`);
      const go = () => { const nm = $('#ncName').value.trim(); if (!nm) { $('#ncErr').textContent = 'Enter a category name.'; return; }
        if (D.cats.some(c => c.name.trim().toLowerCase() === nm.toLowerCase())) { $('#ncErr').textContent = 'There is already a category named ' + nm + '.'; return; }
        const id = 'new:' + Date.now().toString(36); D.cats.push({ id, name: nm }); if (then) then(id); closeSheet(); vListings(); toast(then ? 'Category added and chosen. Tap Save all changes to keep it.' : 'Category added. Choose it on an item, then tap Save all changes.'); };
      $('#ncOk').onclick = go; $('#ncName').onkeydown = e => { if (e.key === 'Enter') go(); }; setTimeout(() => $('#ncName').focus(), 50);
    }
    if ($('#cAdd')) { $('#cAdd').onclick = addCat; $('#cNew').onkeydown = e => { if (e.key === 'Enter') addCat(); }; }
    if ($('#mAdd')) $('#mAdd').onclick = () => { D.items.push({ id: '', name: '', desc: '', catId: (cats[0] || {}).id || '', price: '', promoPct: '', available: true }); vListings(); const r = document.querySelectorAll('.mrow'), last = r[r.length - 1]; if (last) { last.scrollIntoView({ block: 'center' }); last.querySelector('input').focus(); } };
    if ($('#ldDiscard')) $('#ldDiscard').onclick = () => { MP.ld = null; vListings(); toast('Changes discarded'); };
    if ($('#ldSave')) $('#ldSave').onclick = async () => {
      const base = listingDraft(), items = D.items.filter(x => !x.removed);
      if (D.cats.some(c => !c.name.trim())) { $('#ldErr').textContent = 'Give each category a name.'; return; }
      const bad = items.findIndex(x => !String(x.name).trim() || !(+x.price > 0));
      if (bad >= 0) { $('#ldErr').textContent = (items[bad].name ? items[bad].name + ': enter a price.' : 'Enter a name and price for every item.'); const row = document.querySelector(`[data-mi="${D.items.indexOf(items[bad])}"]`); if (row) row.scrollIntoView({ block: 'center' }); return; }
      const removed = D.items.filter(x => x.removed && x.id).length;
      if (removed && !confirm('Remove ' + removed + ' menu item' + (removed > 1 ? 's' : '') + '? Customers will no longer see ' + (removed > 1 ? 'them' : 'it') + '.')) return;
      loading(true, 'Saving…');
      try {
        if (F && (JSON.stringify(D.items) !== JSON.stringify(base.items) || JSON.stringify(D.cats) !== JSON.stringify(base.cats))) await api('mMenu', { token: MP.token, categories: D.cats, items: items.map(x => ({ id: x.id, name: x.name, desc: x.desc, catId: x.catId, price: x.price, promoPct: x.promoPct, available: x.available })) });
        for (const k in D.other) {
          const [kind, x] = k.split('|'), now = D.other[k], was = base.other[k]; if (!was) continue;
          const fields = {}; LFIELDS[kind].forEach(f => { if (now[f[0]] !== was[f[0]]) fields[f[0]] = now[f[0]]; });
          if (Object.keys(fields).length) await api('mListing', { token: MP.token, kind, id: x, fields });
          if (now.active !== was.active) await api('mAvailability', { token: MP.token, kind, id: x, value: now.active });
        }
        await fresh(); MP.ld = null; loading(false); toast('All changes saved'); vListings();
      } catch (e) { loading(false); await fresh().catch(() => {}); $('#ldErr').textContent = e.message; }
    };
  }
  document.querySelectorAll('[data-ph]').forEach(inp => inp.onchange = async () => {
    const [kind, x] = inp.dataset.ph.split('|'), f = inp.files[0]; if (!f) return;
    loading(true, 'Uploading photo…');
    try { const dataUrl = await resizeImage(f, 1200); await api('mPhoto', { token: MP.token, kind, id: x, dataUrl }); await fresh(); loading(false); toast('Photo updated'); vListings(); }
    catch (e) { loading(false); toast(e.message); }
  });
  document.querySelectorAll('[data-phx]').forEach(bt => bt.onclick = async () => {
    const [kind, x] = bt.dataset.phx.split('|');
    try { await api('mPhoto', { token: MP.token, kind, id: x, remove: true }); await fresh(); toast('Photo removed'); vListings(); } catch (e) { toast(e.message); }
  });
  document.querySelectorAll('[data-addons]').forEach(bt => bt.onclick = () => addonEditor(bt.dataset.addons));
}
/* ---- Add-on groups editor (food merchants): name, on/off, required or optional, customers pick up to 1-3, choices with prices ---- */
function addonEditor(itemId) {
  const F = Pricing.store(CAT, MP.me.bizId), it = F.items.find(i => i.id === itemId); if (!it) return;
  const G = clone(Pricing.addonGroups(it));
  const draw = () => {
    openSheet(`<div class="sbody"><span class="brandl">${esc(F.storeName)}</span><h2>Add-ons · ${esc(it.name)}</h2><p class="meta" style="margin-top:4px">Group choices like Size, Sugar level or Extras. Required groups must be answered before the item can be added to the cart.</p>
      ${G.map((g, i) => `<div class="gedit ${g.active === false ? 'off' : ''}"><div class="ghead"><div class="field"><label>Add-on group name</label><input data-g="${i}|name" value="${esc(g.name)}" placeholder="e.g. Size"></div><button class="xbtn" title="Delete group" data-gdel="${i}">${ic('x')}</button></div>
        <div class="grow"><label class="toggle"><input type="checkbox" data-g="${i}|active" ${g.active !== false ? 'checked' : ''}><span>${g.active !== false ? 'On' : 'Off'}</span></label>
          <div class="seg"><button type="button" class="${g.required ? '' : 'on'}" data-greq="${i}|0">Optional</button><button type="button" class="${g.required ? 'on' : ''}" data-greq="${i}|1">Required</button></div>
          <label class="hint">Customer can pick up to <select data-g="${i}|max">${[1, 2, 3].map(n => `<option ${+g.max === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div>
        <div class="ohead"><span>Choice</span><span>Extra price (₱)</span><span>Available</span><span></span></div>
        ${g.options.map((o, j) => `<div class="orow"><input data-o="${i}|${j}|name" value="${esc(o.name)}" placeholder="Choice, e.g. Large"><input data-o="${i}|${j}|price" type="number" min="0" step="any" value="${+o.price || 0}" placeholder="+P"><label class="toggle" title="Available"><input type="checkbox" data-o="${i}|${j}|active" ${o.active !== false ? 'checked' : ''}></label><button class="xbtn" data-odel="${i}|${j}">${ic('x')}</button></div>`).join('')}
        <button class="btn ghost sm mt" data-oadd="${i}">${ic('plus', 14)} Add choice</button></div>`).join('') || '<p class="meta mt">No add-ons yet.</p>'}
      <button class="btn ghost mt" id="gAdd">${ic('plus')} Add add-on group</button>
      <div class="err" id="gErr"></div><div class="row2 mt"><button class="btn ghost" onclick="closeSheet()">Cancel</button><button class="btn" id="gSave">Save add-ons</button></div></div>`);
    const sh = $('#sheet');
    sh.querySelectorAll('[data-g]').forEach(x => x.onchange = x.oninput = () => { const [i, k] = x.dataset.g.split('|'); G[+i][k] = x.type === 'checkbox' ? x.checked : k === 'max' ? +x.value : x.value; if (k === 'active') draw(); });
    sh.querySelectorAll('[data-o]').forEach(x => x.onchange = x.oninput = () => { const [i, j, k] = x.dataset.o.split('|'); G[+i].options[+j][k] = x.type === 'checkbox' ? x.checked : k === 'price' ? +x.value : x.value; });
    sh.querySelectorAll('[data-greq]').forEach(x => x.onclick = () => { const [i, v] = x.dataset.greq.split('|'); G[+i].required = v === '1'; draw(); });
    sh.querySelectorAll('[data-gdel]').forEach(x => x.onclick = () => { G.splice(+x.dataset.gdel, 1); draw(); });
    sh.querySelectorAll('[data-odel]').forEach(x => x.onclick = () => { const [i, j] = x.dataset.odel.split('|'); G[+i].options.splice(+j, 1); draw(); });
    sh.querySelectorAll('[data-oadd]').forEach(x => x.onclick = () => { G[+x.dataset.oadd].options.push({ id: '', name: '', price: 0, active: true }); draw(); });
    $('#gAdd').onclick = () => { G.push({ id: '', name: '', active: true, required: false, max: 1, options: [{ id: '', name: '', price: 0, active: true }] }); draw(); };
    $('#gSave').onclick = async () => {
      loading(true, 'Saving add-ons…');
      try { await api('mAddons', { token: MP.token, id: itemId, groups: G }); const c = await api('getCatalog'); if (c.catalog) CAT = Pricing.norm(c.catalog); loading(false); closeSheet(); toast('Add-ons saved'); vListings(); }
      catch (e) { loading(false); $('#gErr').textContent = e.message; }
    };
  };
  draw();
}

/* ---- Team: Merchant Admin adds and edits up to 4 users ---- */
function vTeam() {
  const adm = isAdm(), rows = MP.teamDraft || (MP.teamDraft = MP.team.map(t => ({ email: t.email, name: t.name || '', role: t.role })));
  if (!adm) { $('#pbody').innerHTML = `<div class="acard"><h3>${esc(bizName(MP.me.bizId))} users</h3>${MP.team.map(t => `<div class="uslot ro"><span class="urole">${Rules.ROLE_LABEL[t.role]}</span><b>${esc(t.name || '-')}</b><span class="hint">${esc(t.email)}</span></div>`).join('')}</div>`; return; }
  $('#pbody').innerHTML = `<div class="acard"><h3>${esc(bizName(MP.me.bizId))} users <span class="hint">${rows.length} of ${Rules.MAX_PER_BUSINESS}</span></h3>
    ${rows.map((u, i) => `<div class="uslot u4"><select data-tm="${i}|role" ${u.email === MP.me.email ? 'disabled' : ''}><option value="manager" ${u.role === 'manager' ? 'selected' : ''}>Merchant Admin</option><option value="staff" ${u.role !== 'manager' ? 'selected' : ''}>Merchant Staff</option></select>
      <input data-tm="${i}|name" placeholder="Name" value="${esc(u.name)}"><input data-tm="${i}|email" type="email" placeholder="email@example.com" value="${esc(u.email)}" ${u.email === MP.me.email ? 'disabled' : ''}>
      ${u.email === MP.me.email ? '<span class="hint">You</span>' : `<button class="xbtn" title="Remove" onclick="MP.teamDraft.splice(${i},1);vTeam()">${ic('x')}</button>`}</div>`).join('')}
    ${rows.length < Rules.MAX_PER_BUSINESS ? `<button class="btn ghost sm mt" onclick="MP.teamDraft.push({email:'',name:'',role:'staff'});vTeam()">${ic('plus')} Add user</button>` : ''}
    <div class="err" id="tmErr"></div><div class="rowbtns mt"><button class="btn" id="tmSave">Save team</button><button class="btn ghost" onclick="MP.teamDraft=null;vTeam()">Discard</button></div></div>`;
  document.querySelectorAll('[data-tm]').forEach(i => i.oninput = i.onchange = () => { const [k, f] = i.dataset.tm.split('|'); rows[+k][f] = i.value.trim(); });
  $('#tmSave').onclick = async () => {
    if (rows.some(u => !validEmail(u.email))) { $('#tmErr').textContent = 'Enter a valid email for each user.'; return; }
    loading(true, 'Saving…');
    try { const r = await api('mSaveTeam', { token: MP.token, team: rows }); MP.team = r.team; MP.teamDraft = null; loading(false); toast('Team saved. New users can sign in with their email.'); vTeam(); }
    catch (x) { loading(false); $('#tmErr').textContent = x.message; }
  };
}

/* ---- Store settings (Merchant Admin) ---- */
const DAYS = [['mon', 'Mon'], ['tue', 'Tue'], ['wed', 'Wed'], ['thu', 'Thu'], ['fri', 'Fri'], ['sat', 'Sat'], ['sun', 'Sun']];
const PAYS = ['Cash', 'GCash', 'Maya', 'Credit / debit card', 'Bank transfer', 'HitPay online'];
const HALF = (() => { const a = []; for (let h = 0; h < 24; h++) { a.push(pad(h) + ':00'); a.push(pad(h) + ':30'); } return a; })();
async function vStore() {
  if (!isAdm()) { $('#pbody').innerHTML = '<div class="empty">Store settings are for the Merchant Admin.</div>'; return; }
  $('#pbody').innerHTML = '<div class="empty">Loading…</div>';
  let info; try { info = await api('mStore', { token: MP.token }); } catch (x) { $('#pbody').innerHTML = `<div class="err">${esc(x.message)}</div>`; return; }
  const z = info.business, F = Pricing.store(CAT, z.id), stays = CAT.stays.filter(x => x.bizId === z.id), R = Rules.rewardsOf(z), H = z.hours || {};
  const fld = (id, label, v, type, ph) => `<div class="field"><label>${label}</label><input id="${id}" ${type ? 'type="' + type + '"' : ''} value="${esc(v || '')}" placeholder="${esc(ph || '')}"></div>`;
  const tsel = (id, v) => `<select id="${id}">${HALF.map(t => `<option value="${t}" ${t === v ? 'selected' : ''}>${fmtT(t)}</option>`).join('')}</select>`;
  const tog = (id, label, on) => `<label class="tog"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}> ${label}</label>`;
  $('#pbody').innerHTML = `<div class="acard"><h3><span class="hl">${ic('store')} Business information</span></h3>
      <div class="agrid">${fld('sfN', 'Name of business *', z.name)}${fld('sfT', 'Tagline', z.tagline, '', 'e.g. Specialty coffee by the sea')}${fld('sfP', 'Contact number', z.phone, 'tel')}${fld('sfE', 'Email for notifications', z.email, 'email')}${fld('sfF', 'Facebook page / website', z.facebook)}
        <div class="field"><label>Town</label><select id="sfTown">${TOWNS.map(t => `<option ${t === (z.town || 'San Agustin') ? 'selected' : ''}>${t}</option>`).join('')}</select></div></div>
      <div class="mt">${fld('sfA', 'Address', z.address || (F && F.address))}</div><div class="mt">${fld('sfL', 'Landmark / directions', z.landmark)}</div>
      <div class="field mt"><label>About your business</label><textarea id="sfD" rows="3">${esc(z.description || '')}</textarea></div></div>
    <div class="acard"><h3><span class="hl">${ic('clock')} Daily operating hours</span></h3><div class="hours">${DAYS.map(([d, l]) => { const h = H[d] || { open: '08:00', close: '20:00' }; return `<div class="hr"><b>${l}</b>${tsel('ho_' + d, h.open)}${tsel('hc_' + d, h.close)}<label class="tog"><input type="checkbox" id="hx_${d}" ${h.closed ? 'checked' : ''}> Closed</label></div>`; }).join('')}</div>
      <button class="link mt" type="button" id="hCopy">Copy Monday to all days</button></div>
    <div class="acard"><h3><span class="hl">${ic('wallet')} Payment methods accepted</span></h3><div class="chips">${PAYS.map(m => `<label><input type="checkbox" data-pm="${esc(m)}" ${(z.paymentMethods || []).includes(m) ? 'checked' : ''}> ${esc(m)}</label>`).join('')}</div>
      ${F ? `<div class="mt">${tog('sfDel', 'Offer delivery', F.deliveryEnabled)}${tog('sfPick', 'Offer pick-up', F.pickupEnabled)}${tog('sfCod', 'Accept cash on delivery', F.codEnabled)}${tog('sfOn', 'Accept online payment (HitPay)', F.onlineEnabled)}</div>` : ''}
      ${stays.length ? `<div class="row2 mt">${fld('sfIn', 'Check-in time', stays[0].checkInTime, '', '2:00 PM')}${fld('sfOut', 'Check-out time', stays[0].checkOutTime, '', '12:00 NN')}</div>` : ''}</div>
    <div class="acard"><h3><span class="hl">${ic('star')} Reward points</span></h3>${tog('rwOn', 'Offer reward points to customers', R.enabled)}
      <div class="agrid mt">${fld('rwP', 'Spend (P) for 1 point', R.pesoPerPoint, 'number')}${fld('rwV', 'Value of 1 point (P)', R.pointValue, 'number')}${fld('rwS', 'Sign-up bonus (points)', R.signupBonus, 'number')}${fld('rwB', 'Birthday bonus (points)', R.birthdayBonus, 'number')}${fld('rwM', 'Minimum points to redeem', R.minRedeem, 'number')}${fld('rwX', 'Redeem in blocks of', R.redeemStep, 'number')}</div>
      <p class="hint mt">Points are earned when an order or booking is Completed, and can be used as a discount at checkout. The discount comes from your sales.</p>
      ${info.loyverseAllowed ? `<div class="bankbox"><span class="lbl">Loyverse POS ${info.loyverseConnected ? '<span class="paidtag">Connected</span>' : ''}</span>${tog('rwLv', 'Sync points with Loyverse (in-store and app points share one balance)', R.loyverse)}
        <div class="row2 mt"><div class="field"><label>Loyverse access token</label><input id="lvTok" type="password" placeholder="${info.loyverseConnected ? 'Saved. Paste a new token to replace' : 'Back Office > Access tokens'}" autocomplete="off"></div><div class="field" style="align-self:end"><button class="btn ghost" id="lvSave" type="button">${info.loyverseConnected ? 'Replace token' : 'Connect'}</button>${info.loyverseConnected ? ' <button class="link danger" id="lvOff" type="button">Disconnect</button>' : ''}</div></div>
        <p class="hint">Customers are matched by email, then mobile number. New customers are added to Loyverse.</p></div>` : ''}</div>
    <div class="acard"><h3><span class="hl">${ic('tag')} Discount codes</span></h3>${tog('dcOn', 'Accept Tara Romblon discount codes for my business', z.acceptCodes !== false)}<p class="hint">Codes are created by Beyond Tech Solutions. When off, customers can't use codes on your listings.</p></div>
    <div class="err" id="sfErr"></div><div class="savebar show"><span>Store settings</span><button class="btn sm" id="sfSave">Save settings</button></div>`;
  $('#hCopy').onclick = () => DAYS.slice(1).forEach(([d]) => { $('#ho_' + d).value = $('#ho_mon').value; $('#hc_' + d).value = $('#hc_mon').value; $('#hx_' + d).checked = $('#hx_mon').checked; });
  const saveTok = async tok => { loading(true, 'Connecting to Loyverse…'); try { const r = await api('mSaveLoyverse', { token: MP.token, loyverseToken: tok }); loading(false); toast(r.loyverseConnected ? 'Loyverse connected' : 'Loyverse disconnected'); vStore(); } catch (x) { loading(false); toast(x.message); } };
  if ($('#lvSave')) $('#lvSave').onclick = () => { const t = $('#lvTok').value.trim(); if (!t) { toast('Paste your Loyverse access token.'); return; } saveTok(t); };
  if ($('#lvOff')) $('#lvOff').onclick = () => saveTok('');
  $('#sfSave').onclick = async () => {
    const v = id => $('#' + id) ? $('#' + id).value.trim() : undefined, c = id => $('#' + id) ? $('#' + id).checked : undefined, hours = {};
    DAYS.forEach(([d]) => hours[d] = { open: $('#ho_' + d).value, close: $('#hc_' + d).value, closed: $('#hx_' + d).checked });
    const fields = { name: v('sfN'), tagline: v('sfT'), phone: v('sfP'), email: v('sfE'), facebook: v('sfF'), town: v('sfTown'), address: v('sfA'), landmark: v('sfL'), description: $('#sfD').value.trim(), hours,
      paymentMethods: [...document.querySelectorAll('[data-pm]')].filter(x => x.checked).map(x => x.dataset.pm), deliveryEnabled: c('sfDel'), pickupEnabled: c('sfPick'), codEnabled: c('sfCod'), onlineEnabled: c('sfOn'),
      checkInTime: v('sfIn'), checkOutTime: v('sfOut'), acceptCodes: c('dcOn'),
      rewards: { enabled: c('rwOn'), loyverse: !!c('rwLv'), pesoPerPoint: v('rwP'), pointValue: v('rwV'), signupBonus: v('rwS'), birthdayBonus: v('rwB'), minRedeem: v('rwM'), redeemStep: v('rwX') } };
    if (!fields.name) { $('#sfErr').textContent = 'Name of business is required.'; return; }
    loading(true, 'Saving…');
    try { await api('mSaveStore', { token: MP.token, fields }); const cc = await api('getCatalog'); if (cc.catalog) CAT = Pricing.norm(cc.catalog); loading(false); toast('Store settings saved'); $('#ptitle').textContent = bizName(MP.me.bizId); vStore(); }
    catch (x) { loading(false); $('#sfErr').textContent = x.message; }
  };
}
initPortal();
