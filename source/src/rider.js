/* ================= RIDER APP ================= */
const RP = { token: null, me: null, tab: 'active', orders: [], threads: [], range: 'today', timer: null };
const tm = s => new Date(s).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
const dt = s => new Date(s).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
const dayOf = s => { const d = new Date(s); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const DONE = ['Delivered', 'Payment Collected', 'Completed'];
const ST = () => Object.assign({}, DEFAULT_SETTINGS, CAT.settings || {});
const earn = b => Rules.riderEarning(b, ST()); /* rider earns the full delivery fee (customer part + store part), or the base fee within the free distance */

async function initPortal() {
  if (DEMO) document.body.classList.add('demo');
  try { const r = await api('getCatalog'); if (r.catalog) CAT = r.catalog; } catch (e) { }
  const s = await restoreStaff('tr5_staff_rider', me => me.role === 'rider');
  if (s) { if (s.offline) toast('Weak connection. Showing your saved session; it will refresh automatically.'); return start(s.token, s.me); }
  staffLogin('rider', v => start(v.token, v.me));
}
async function start(token, me) {
  RP.token = token; RP.me = me; Chat.token = () => RP.token; Chat.me = { email: me.email, name: me.name, role: 'rider' };
  $('#who').innerHTML = `<span>${esc(me.name || me.email)}</span><button class="link" onclick="signOutStaff()">Sign out</button>`; $('#bellSlot').innerHTML = bellBtn(); $('#ptitle').textContent = 'Deliveries';
  await reload(); render();
  Notif.start(token, 'r_' + me.email, async () => { await reload(true); render(); });
  clearInterval(RP.timer); RP.timer = setInterval(async () => { if (!$('#ov').classList.contains('show')) { await reload(true); render(); } }, DEMO ? 8000 : (RP.me && RP.me.available ? 12000 : 30000));
}
function signOutStaff() { Share.stop(); store('tr5_staff_rider', null); Notif.stop(); location.reload(); }
/* Live location: shared with the customer and store only while the rider has an accepted delivery in progress */
const Share = {
  watch: null, last: null, sent: 0, state: 'off', refs: [],
  sync() { const need = RP.orders.filter(Rules.trackable); this.refs = need.map(b => b.ref); const want = need.length || (RP.me && RP.me.available); if (want && this.watch == null) this.start(); if (!want && this.watch != null) this.stop(); },
  start() {
    if (!navigator.geolocation) { this.state = 'unsupported'; return; }
    this.state = 'starting';
    this.watch = navigator.geolocation.watchPosition(p => this.send(p), e => { this.state = e && e.code === 1 ? 'denied' : 'error'; banner(); }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
  },
  async send(pos) {
    const c = pos.coords, now = Date.now(), moved = this.last ? Pricing.km(this.last.latitude, this.last.longitude, c.latitude, c.longitude) : 1;
    this.state = 'on'; if (now - this.sent < 10000 && moved < 0.03) return; this.sent = now; this.last = c;
    try { const r = await api('rLocation', { token: RP.token, lat: c.latitude, lng: c.longitude, acc: c.accuracy, heading: c.heading }); if (!r.sharing) this.stop(); } catch (e) { }
    banner();
  },
  stop() { if (this.watch != null && navigator.geolocation) navigator.geolocation.clearWatch(this.watch); this.watch = null; this.state = 'off'; }
};
function banner() {
  const el = $('#rshare'); if (!el) return; const n = Share.refs.length;
  if (!n) { el.innerHTML = RP.me && RP.me.available ? (Share.state === 'denied' || Share.state === 'error' || Share.state === 'unsupported' ? `<div class="rshare bad">${ic('locate', 18)}<span><b>Turn on location</b> so you get delivery requests near you. Allow location for this app in your phone settings.</span></div>` : `<div class="rshare"><span class="rdot"></span><span>You're online. Your location is used to send you nearby delivery requests.</span></div>`) : ''; return; }
  el.innerHTML = Share.state === 'denied' || Share.state === 'error' || Share.state === 'unsupported'
    ? `<div class="rshare bad">${ic('locate', 18)}<span><b>Turn on location.</b> The customer and store can't see where you are. Allow location for this app in your phone settings, then reopen it.</span></div>`
    : `<div class="rshare"><span class="rdot"></span><span>Sharing your live location with the customer and store for ${Share.refs.map(esc).join(', ')}. It stops when ${n === 1 ? 'the delivery is' : 'deliveries are'} done.</span></div>`;
}
async function reload(quiet) {
  if (!quiet) loading(true, 'Loading…');
  try { const [o, t] = await Promise.all([api('rOrders', { token: RP.token }), api('threads', { token: RP.token })]); RP.me = o.me; RP.orders = o.orders.sort((a, b) => b.created.localeCompare(a.created)); const had = (RP.offers || []).map(x => x.ref); RP.offers = o.offers || []; if (RP.offers.some(x => !had.includes(x.ref))) ding(); RP.threads = t.threads; }
  catch (x) { toast(x.message); if (/sign in/i.test(x.message)) signOutStaff(); }
  loading(false);
}
function render() {
  const act = RP.orders.filter(b => !Rules.CLOSED.includes(b.status) && !Rules.delivered(b));
  const unread = RP.threads.filter(t => Chat.unread(t)).length;
  const on = !!RP.me.available, n = act.length;
  $('#ptitle').innerHTML = `Deliveries <span class="rstat ${on ? 'on' : ''}">${on ? 'Online' : 'Offline'}</span>`;
  $('#root').innerHTML = `<label class="ravail big ${on ? 'on' : ''}" for="avT">
      <span class="rdot" aria-hidden="true"></span>
      <span class="rtxt"><small>${on ? 'ONLINE' : 'OFFLINE'}</small><b>${on ? 'You are available' : 'You are offline'}</b><span>${on ? (n ? n + ' active deliver' + (n === 1 ? 'y' : 'ies') + ' · tap to go offline' : 'Nearby delivery requests will pop up here · tap to go offline') : 'Tap to go online and receive deliveries'}</span></span>
      <span class="bigswitch"><input type="checkbox" id="avT" ${on ? 'checked' : ''} aria-label="Available for deliveries"><i></i><em>${on ? 'ON' : 'OFF'}</em></span></label>
    <div id="rshare"></div>${offersHtml(on)}<div class="ptabs"><button class="${RP.tab === 'active' ? 'on' : ''}" onclick="RP.tab='active';render()">${ic('bike')} Active${act.length ? ` <i>${act.length}</i>` : ''}</button>
      <button class="${RP.tab === 'earn' ? 'on' : ''}" onclick="RP.tab='earn';render()">${ic('wallet')} Earnings</button>
      <button class="${RP.tab === 'messages' ? 'on' : ''}" onclick="RP.tab='messages';render()">${ic('chat')} Messages${unread ? ` <i>${unread}</i>` : ''}</button>
      <button class="${RP.tab === 'history' ? 'on' : ''}" onclick="RP.tab='history';render()">${ic('clock')} History</button></div><div id="pbody"></div>`;
  $('#avT').onchange = async e => { if (!e.target.checked && act.length && !confirm('You still have ' + act.length + ' active deliver' + (act.length === 1 ? 'y' : 'ies') + '. Go offline anyway? You will keep them, but won\'t get new ones.')) { e.target.checked = true; return; } try { const r = await api('rAvailable', { token: RP.token, value: e.target.checked }); RP.me = r.me; toast(r.me.available ? 'You are now available' : 'You are now offline'); render(); } catch (x) { toast(x.message); e.target.checked = !e.target.checked; } };
  Share.sync(); banner(); wireOffers();
  ({ active: () => vList(act, 'No active deliveries. Stay available to receive new ones.'), history: () => vList(RP.orders.filter(b => !act.includes(b)), 'No past deliveries yet.'), earn: vEarn, messages: vMsgs })[RP.tab]();
}
/* Incoming delivery requests from nearby orders: the first rider to accept gets it, then the store is told */
function offersHtml(on) {
  const L = RP.offers || []; if (!on || !L.length) return '';
  return `<div class="offers"><h3>${ic('bell', 18)} New delivery request${L.length > 1 ? 's' : ''} <span class="hint">first to accept gets it</span></h3>${L.map(o => `<div class="offer">
    <div class="oftop"><b class="ofearn">${peso(o.riderFee)}</b><span>you earn${o.subsidy ? ' (incl. ' + peso(o.subsidy) + ' store subsidy)' : ''}${o.km != null ? ' · ' + o.km + ' km delivery' : ''}${o.kmToStore != null ? ' · ' + o.kmToStore + ' km to the store' : ''}</span></div>
    <div class="rstops"><div><span class="lbl">Pick up</span><b>${esc(o.store.name)}</b><span class="hint">${esc(o.store.address || '')}</span></div><div><span class="lbl">Deliver to</span><b>${esc(o.dropoff.label || o.dropoff.area || 'Customer')}</b>${o.dropoff.label && o.dropoff.area ? `<span class="hint">${esc(o.dropoff.area)}</span>` : ''}</div></div>
    ${o.subsidy ? `<div class="codl sub"><span>${ic('tag', 14)} Rider subsidy from ${esc(o.store.name)}</span><b>+${peso(o.subsidy)}</b></div>` : ''}<div class="hint">${o.items} item${o.items === 1 ? '' : 's'} · ${o.collect ? (o.payStore ? 'Cash on delivery: pay the store ' + peso(o.payStore) + ' at pick-up, collect ' + peso(o.collect) : 'Cash on delivery: collect ' + peso(o.collect)) : 'Already paid'}${o.incentive ? ' · incl. ' + peso(o.incentive) + ' platform incentive' : ''} · ${esc(o.ref)} · ${tm(o.offerAt)}</div>
    <div class="sact"><button class="btn" data-ofok="${esc(o.ref)}">${ic('check')} Accept</button><button class="btn ghost" data-ofno="${esc(o.ref)}">Decline</button></div></div>`).join('')}</div>`;
}
function wireOffers() {
  document.querySelectorAll('[data-ofok]').forEach(b => b.onclick = async () => { loading(true, 'Accepting…');
    try { await api('rOffer', { token: RP.token, ref: b.dataset.ofok, accept: true }); await reload(true); loading(false); toast('Delivery accepted. The store has been notified.'); RP.tab = 'active'; render(); }
    catch (x) { loading(false); toast(x.message); await reload(true); render(); } });
  document.querySelectorAll('[data-ofno]').forEach(b => b.onclick = async () => { try { await api('rOffer', { token: RP.token, ref: b.dataset.ofno, accept: false }); RP.offers = RP.offers.filter(o => o.ref !== b.dataset.ofno); render(); } catch (x) { toast(x.message); } });
}
function ding() { try { navigator.vibrate && navigator.vibrate([200, 100, 200]); const A = new (window.AudioContext || window.webkitAudioContext)(), o = A.createOscillator(), g = A.createGain(); o.frequency.value = 880; o.connect(g); g.connect(A.destination); g.gain.setValueAtTime(.2, A.currentTime); g.gain.exponentialRampToValueAtTime(.001, A.currentTime + .6); o.start(); o.stop(A.currentTime + .6); } catch (e) { } }
const payDays = () => +((CAT.settings || {}).riderPayoutDays) || 3;
/* next payout date: every N days from the last payout this rider received (or from their first unpaid delivery) */
function nextPayout() {
  const paid = RP.orders.map(b => b.riderPaidAt).filter(Boolean).sort().pop(), unpaid = RP.orders.filter(b => Rules.delivered(b) && !b.riderPaidAt).map(b => b.updated || b.created).sort()[0];
  const from = paid || unpaid; if (!from) return 'after your first delivery';
  const d = new Date(Date.parse(from) + payDays() * 864e5); return d < new Date() ? 'due now' : d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}
/* Cash on delivery: a clear box with what to pay the store at pick-up and what to collect from the customer */
function codBox(b) {
  const a = Rules.codAmounts(b), sub = +(b.quote && b.quote.riderSubsidy) || 0;
  if (!a) return sub && !Rules.CLOSED.includes(b.status) && !Rules.delivered(b) ? `<div class="codbox"><b>${ic('tag', 16)} Rider subsidy</b><div class="codl sub"><span>${esc(bizName(b.bizId))} adds to your earning</span><b>+${peso(sub)}</b></div><small>Already paid online: the platform pays your full earning in the next payout (every ${payDays()} days).</small></div>` : '';
  if (Rules.CLOSED.includes(b.status)) return '';
  const store = bizName(b.bizId), picked = ['Out for Delivery', 'Rider Arrived', 'Delivered', 'Payment Collected'].includes(b.status);
  if (a.mode === 'payStore') return `<div class="codbox"><b>${ic('wallet', 16)} Cash on delivery</b>
    <div class="codl ${picked ? 'done' : ''}"><span>1. At pick-up, pay ${esc(store)} the full order</span><b>${peso(a.payStore)}</b></div>
    <div class="codl"><span>2. At drop-off, collect from the customer</span><b>${peso(a.collect)}</b></div>
    ${a.keep ? `<div class="codl keep"><span>You keep (customer's delivery fee)</span><b>${peso(a.keep)}</b></div>` : ''}
    ${a.subsidy ? `<div class="codl sub"><span>${ic('tag', 14)} Rider subsidy from ${esc(store)} · paid to you at payout</span><b>+${peso(a.subsidy)}</b></div>` : ''}
    <small>Bring at least ${peso(a.payStore)} in cash for the store. What you keep counts toward your earning; the rest is settled every ${payDays()} days.</small></div>`;
  if (a.mode === 'keepAll') return `<div class="codbox"><b>${ic('wallet', 16)} Cash on delivery</b><div class="codl"><span>Pay the store</span><b>${peso(0)}</b></div><div class="codl"><span>Collect from the customer</span><b>${peso(a.collect)}</b></div><small>You keep the cash; it is settled against your earnings every ${payDays()} days.</small></div>`;
  return `<div class="codbox"><b>${ic('wallet', 16)} Cash on delivery</b><div class="codl"><span>Collect from the customer</span><b>${peso(a.collect)}</b></div><div class="codl"><span>Then hand to ${esc(store)}</span><b>${peso(a.payStore)}</b></div>${a.keep ? `<div class="codl keep"><span>You keep</span><b>${peso(a.keep)}</b></div>` : ''}</div>`;
}
function mapsLink(b) { return b.lat != null ? `https://www.google.com/maps/dir/?api=1&destination=${b.lat},${b.lng}` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((b.landmark || b.customer.address) + ', Romblon')}`; }
function vList(list, empty) {
  $('#pbody').innerHTML = list.map(b => {
    const F = Pricing.store(CAT, b.bizId) || { storeName: bizName(b.bizId), address: '', lat: 12.57, lng: 122.13 };
    const fee = earn(b), cash = b.payMethod === 'cod', custFee = +b.quote.deliveryFee || 0, storeFee = +b.quote.storeDeliveryShare || 0;
    return `<div class="ordcard"><div class="th"><div><span class="ref">${esc(b.ref)}</span><br><span class="mini">${esc(bizName(b.bizId))} · placed ${tm(b.created)}</span></div>${statusChip(b.status)}</div>
      ${progressBar(b, true)}
      <div class="rstops"><div><span class="lbl">Pick up</span><b>${esc(F.storeName)}</b><span class="hint">${esc(F.address)}</span><a class="link" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${F.lat},${F.lng}">${ic('nav', 14)} Directions</a></div>
        <div><span class="lbl">Deliver to</span><b>${esc(b.customer.name)}</b><span class="hint">${esc(b.landmark || b.customer.address)}</span><span class="rowbtns" style="margin:4px 0 0"><a class="link" target="_blank" rel="noopener" href="${mapsLink(b)}">${ic('nav', 14)} Directions</a><a class="link" href="tel:${esc(String(b.customer.phone).replace(/\s/g, ''))}">${ic('phone', 14)} ${esc(b.customer.phone)}</a></span></div></div>
      <div class="hint">${b.lines.map(l => esc(l.qty + ' x ' + l.name + (l.addons && l.addons.length ? ' (' + l.addons.join(', ') + ')' : ''))).join(' · ')}</div>
      ${codBox(b)}<div class="rmoney"><div><span>${cash ? 'Collect from customer' : 'Already paid'}</span><b>${cash ? peso(Rules.payable(b)) : peso(0)}</b></div><div><span>Your delivery fee</span><b>${peso(fee)}</b><small class="hint">${b.quote.km != null ? b.quote.km + ' km · ' : ''}customer ${peso(custFee)}${storeFee ? ' + store subsidy ' + peso(storeFee) : ''}${fee - custFee - storeFee > 0 ? ' + incentive ' + peso(Rules.r2(fee - custFee - storeFee)) : ''}</small></div></div>
      ${b.notes ? `<div class="warn">Customer note: ${esc(b.notes)}</div>` : ''}
      ${!b.riderAccepted && !Rules.CLOSED.includes(b.status) ? `<div class="sact"><button class="btn" onclick="respond('${esc(b.ref)}',true)">${ic('check')} Accept delivery</button><button class="btn ghost danger" onclick="respond('${esc(b.ref)}',false)">Decline</button></div>` : statusActions(b, { role: 'rider', email: RP.me.email })}
      ${cash && b.status === 'Delivered' ? `<div class="hint" style="margin-top:8px">${b.riderPaysStore ? `You paid ${esc(F.storeName)} ${peso(Rules.codAmounts(b).payStore)} at pick-up and collected ${peso(Rules.payable(b))} from the customer. You keep the ${peso(custFee)} delivery fee; it counts toward your ${peso(fee)} earning and the rest${storeFee ? ' (including the ' + peso(storeFee) + ' store subsidy)' : ''} is paid to you every ${payDays()} days.` : b.codToRider ? `Keep the ${peso(Rules.payable(b))} cash you collect and tap <b>Payment Collected</b> to record it. It is settled against your earnings every ${payDays()} days; it is not part of your earnings.` : b.platformPaysRider ? `Hand all ${peso(Rules.cashExpected(b))} to ${esc(F.storeName)}. Your ${peso(fee)} earning is paid to you by Beyond Tech Solutions every ${payDays()} days.` : `Hand ${peso(Rules.cashExpected(b))} to ${esc(F.storeName)} and keep the customer's ${peso(custFee)} delivery fee.${storeFee ? ` The store's ${peso(storeFee)} share is added to your payout.` : ''}`} The store records the cash received.</div>` : ''}
      <div class="rowbtns" style="margin:10px 0 0"><button class="btn ghost sm" onclick="Chat.open({ref:'${esc(b.ref)}',chan:'customer'})">${ic('chat')} Message customer</button><button class="btn ghost sm" onclick="Chat.open({ref:'${esc(b.ref)}',chan:'merchant'})">${ic('store')} Message ${esc(F.storeName)}</button></div></div>`;
  }).join('') || `<div class="empty"><div class="big">${ic('bike', 40)}</div>${empty}</div>`;
  wireStatus($('#pbody'), () => RP.token, async () => { await reload(true); render(); }, ref => RP.orders.find(b => b.ref === ref));
}
async function respond(ref, accept) {
  loading(true); try { await api('rRespond', { token: RP.token, ref, accept }); await reload(true); loading(false); toast(accept ? 'Delivery accepted' : 'Delivery declined'); render(); } catch (x) { loading(false); toast(x.message); }
}
function vEarn() {
  const now = new Date(), weekAgo = dayOf(new Date(now.getTime() - 6 * 864e5));
  const inR = b => RP.range === 'all' || (RP.range === 'today' ? dayOf(b.updated || b.created) === today : dayOf(b.updated || b.created) >= weekAgo);
  const done = RP.orders.filter(b => Rules.delivered(b) && inR(b)), fee = earn;
  const earned = done.reduce((t, b) => t + fee(b), 0), cashOf = b => b.cashCollected && b.cashCollected.role === 'rider' ? +b.cashCollected.amount : Rules.payable(b);
  const open = RP.orders.filter(b => Rules.delivered(b) && !b.riderPaidAt), net = Rules.r2(open.reduce((t, b) => t + Rules.ledger(b, ST()).riderNet, 0)), held = Rules.r2(open.filter(b => b.payMethod === 'cod' && b.codToRider).reduce((t, b) => t + cashOf(b), 0));
  const cash = done.filter(b => b.payMethod === 'cod').reduce((t, b) => t + cashOf(b), 0);
  $('#pbody').innerHTML = `<div class="seg" style="margin-bottom:12px">${[['today', 'Today'], ['week', 'Last 7 days'], ['all', 'All time']].map(x => `<button class="${RP.range === x[0] ? 'on' : ''}" onclick="RP.range='${x[0]}';vEarn()">${x[1]}</button>`).join('')}</div>
    <div class="kpis"><div class="kpi"><span>Completed deliveries</span><b>${done.length}</b><small>${(() => { const st = Pricing.stores(CAT); if (st.length && st.every(f => f.matrixFees)) return 'Your fee is shown on each request'; const R = Pricing.deliveryRule(CAT); return peso(R.baseFee) + ' within ' + R.freeKm + ' km · ' + peso(R.perKm) + '/km after'; })()}</small></div><div class="kpi"><span>Delivery earnings</span><b>${peso(earned)}</b><small>your delivery fees only · COD cash not included</small></div>
      <div class="kpi"><span>COD cash collected</span><b>${peso(cash)}</b><small>customers' payments, not your earnings</small></div>
      <div class="kpi warnk"><span>${net >= 0 ? 'Due to you' : 'You owe Tara Romblon'}</span><b>${peso(Math.abs(net))}</b><small>${held ? 'earnings ' + peso(Rules.r2(net + held)) + ' − COD cash you hold ' + peso(held) + ' · ' : ''}settled every ${payDays()} days · next ${nextPayout()}</small></div></div>
    <div class="acard"><h3>Breakdown</h3><div class="tscroll"><table class="btable"><tr><th>Ref</th><th>Date</th><th>Store</th><th>Delivered to</th><th>Distance</th><th>Customer paid</th><th>Incentive</th><th>You earn</th><th>COD collected</th><th>Paid out</th></tr>
      ${done.map(b => `<tr><td>${esc(b.ref)}</td><td>${dt(b.updated || b.created)}</td><td>${esc(bizName(b.bizId))}</td><td>${esc(b.landmark || b.customer.address)}</td><td>${b.quote.km != null ? b.quote.km + ' km' : '-'}</td><td>${peso(b.quote.deliveryFee)}</td><td>${peso(Math.max(0, Rules.r2(fee(b) - (+b.quote.deliveryFee || 0) - (+b.quote.storeDeliveryShare || 0))))}</td><td><b>${peso(fee(b))}</b></td><td>${b.payMethod === 'cod' ? peso(Rules.payable(b)) : '-'}</td><td>${b.riderPaidAt ? fmtD(dayOf(b.riderPaidAt)) : 'Unpaid'}</td></tr>`).join('') || '<tr><td colspan="10">No completed deliveries in this period.</td></tr>'}</table></div></div>`;
}
function vMsgs() {
  const cu = RP.threads.filter(t => t.with === 'customer'), st = RP.threads.filter(t => t.with === 'merchant');
  $('#pbody').innerHTML = `<p class="meta" style="margin-bottom:12px">Separate chats with customers and with stores. Start one from a delivery with Message customer or Message store.</p>
    <div class="xsec">Customers</div>${Chat.list(cu, { who: 'rider', empty: 'No customer chats yet.' })}<div class="xsec">Stores</div>${Chat.list(st, { who: 'rider', empty: 'No store chats yet.' })}`;
}
initPortal();
