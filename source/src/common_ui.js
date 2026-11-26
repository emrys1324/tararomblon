
/* ================= ICONS (SVG, no emojis) ================= */
const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  locate: '<circle cx="12" cy="12" r="3.5"/><circle cx="12" cy="12" r="8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  chev: '<path d="m6 9 6 6 6-6"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  home: '<path d="M4 10.5 12 4l8 6.5V20H4z"/><path d="M10 20v-5h4v5"/>',
  bed: '<path d="M3 18V7M3 13h18v5M21 18v-3a3 3 0 0 0-3-3h-7v1"/><circle cx="7" cy="10.5" r="1.5"/>',
  scooter: '<circle cx="6" cy="17" r="3"/><circle cx="18" cy="17" r="3"/><path d="M9 17h6l-2-8h3M13 9l-2-3H8"/>',
  cup: '<path d="M4 8h13v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6z"/><path d="M17 9h2a2 2 0 0 1 0 4h-2M8 3v2M12 3v2"/>',
  boat: '<path d="M3 17h18l-2 3H5zM12 3v14M12 4l7 9h-7"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>', mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  bell: '<path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>', check: '<path d="m5 12 5 5L20 7"/>', x: '<path d="M6 6l12 12M18 6 6 18"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>', users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.5c2.5 0 4.5 1.3 5.5 4"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>', store: '<path d="M4 9 5.5 4h13L20 9M4 9h16v11H4zM4 9a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0"/><path d="M10 20v-5h4v5"/>',
  doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>', search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>', map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>', card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  bike: '<circle cx="5.5" cy="17" r="3.5"/><circle cx="18.5" cy="17" r="3.5"/><path d="M5.5 17 9 9h5l4.5 8M9 9 7.5 5.5H5M14 9l1.5-3H18"/>', star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  id: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2.5"/><path d="M5.5 16.5c.7-1.6 2-2.5 3.5-2.5s2.8.9 3.5 2.5M14 10h4M14 13h4"/>',
  wallet: '<path d="M3 7h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 7l12-4v4M17 13.5h.01"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6 19 19M5 19l1.4-1.4M17.6 6.4 19 5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>', arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', power: '<path d="M12 3v9M6.3 7a8 8 0 1 0 11.4 0"/>', nav: '<path d="m3 11 18-8-8 18-2-8z"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8" r="1.5"/>', box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="m3 7 9 4 9-4M12 11v10"/>', palm: '<path d="M12 21V10M12 10C10 6 6 5 3 7M12 10c2-4 6-5 9-3M12 10c-3-1-6 1-7 4M12 10c3-1 6 1 7 4"/>'
};
const ic = (n, s) => `<svg class="ic" width="${s || 18}" height="${s || 18}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;
const kindIcon = k => ic(k === 'stay' ? 'bed' : k === 'rental' ? 'scooter' : k === 'tour' ? 'boat' : 'cup');

/* ================= STATUS (single, consequential action buttons) ================= */
const STATUS_TONE = s => Rules.EXCEPTIONS.indexOf(s) >= 0 ? 'bad' : s === 'Completed' ? 'done' : ['Awaiting Payment', 'New'].indexOf(s) >= 0 ? 'wait' : 'go';
const statusChip = s => `<span class="schip ${STATUS_TONE(s)}">${esc(s)}</span>`;
function actionLabel(b, s) {
  return ({ 'Accepted': 'Accept', 'Payment Confirmed': 'Confirm payment', 'Preparing': 'Start preparing', 'Ready for Pick-up': b.fulfillment === 'delivery' ? 'Ready for rider pick-up' : 'Ready for pick-up', 'Out for Delivery': 'Out for delivery',
    'Delivered': 'Mark delivered', 'Payment Collected': b.kind === 'food' ? 'Payment collected' : 'Balance collected', 'Completed': 'Complete', 'Checked In': 'Check in guest', 'Checked Out': 'Check out guest',
    'Order Picked Up': b.kind === 'rental' ? 'Scooter picked up' : 'Customer picked up', 'Returned': 'Scooter returned', 'Rejected': 'Reject', 'Cancelled': 'Cancel', 'Refunded': 'Refund', 'Expired': 'Expire',
    'New': 'Set as New', 'Awaiting Payment': 'Set Awaiting Payment' })[s] || s;
}
/* actor = {role, bizId, email}. Renders the next step as one primary button; admins also get an Override panel with every other status. */
function statusActions(b, actor) {
  const allowed = Rules.allowed(b, actor), nx = Rules.next(b), main = nx && allowed.indexOf(nx) >= 0 ? nx : null;
  const isAdmin = actor.role === 'super' || actor.role === 'manager';
  const side = allowed.filter(s => s !== main && (!isAdmin ? true : s === 'Rejected' && ['New', 'Payment Confirmed'].indexOf(b.status) >= 0));
  const flow = Rules.flow(b), others = isAdmin ? allowed.filter(s => s !== main && side.indexOf(s) < 0) : [];
  let h = `<div class="sact">`;
  if (main) h += `<button class="btn sbtn" data-ss="${esc(b.ref)}" data-st="${esc(main)}">${ic('arrow')} ${esc(actionLabel(b, main))}</button>`;
  side.forEach(s => h += `<button class="btn ghost sbtn ${Rules.EXCEPTIONS.indexOf(s) >= 0 ? 'danger' : ''}" data-ss="${esc(b.ref)}" data-st="${esc(s)}">${esc(actionLabel(b, s))}</button>`);
  if (!main && !side.length && !others.length) h += `<span class="hint">${Rules.CLOSED.indexOf(b.status) >= 0 ? 'This transaction is closed.' : actor.role === 'staff' && Rules.next(b) === 'Payment Confirmed' ? 'Waiting for HitPay to confirm payment.' : actor.role === 'rider' ? 'Waiting for the store to prepare the order. You will be notified when it is ready.' : 'No action needed from you right now.'}</span>`;
  h += `</div>`;
  if (others.length) h += `<details class="ovr"><summary>Override status</summary><div class="ovrb">${flow.concat(Rules.EXCEPTIONS).filter((s, i, a) => a.indexOf(s) === i && others.indexOf(s) >= 0).map(s => `<button class="btn ghost sm ${Rules.EXCEPTIONS.indexOf(s) >= 0 ? 'danger' : ''}" data-ss="${esc(b.ref)}" data-st="${esc(s)}" data-ovr="1">${esc(s)}</button>`).join('')}</div></details>`;
  return h;
}
function timeline(b) {
  const f = Rules.flow(b), i = f.indexOf(b.status), bad = Rules.EXCEPTIONS.indexOf(b.status) >= 0;
  return `<div class="tl">${f.map((s, j) => `<span class="${bad ? '' : j < i ? 'past' : j === i ? 'now' : ''}">${esc(s)}</span>`).join('')}${bad ? `<span class="now bad">${esc(b.status)}</span>` : ''}</div>`;
}
/* Wires every [data-ss] button inside root: confirm, then call setStatus. onDone(booking) refreshes the view. */
function wireStatus(root, getToken, onDone, lookup) {
  root.querySelectorAll('[data-ss]').forEach(btn => btn.onclick = () => {
    const ref = btn.dataset.ss, st = btn.dataset.st, b = lookup ? lookup(ref) : null, ovr = btn.dataset.ovr;
    openSheet(`<div class="sbody"><h2>${esc(b ? actionLabel(b, st) : st)}?</h2><p class="meta" style="margin-top:6px">${esc(ref)} will change from <b>${esc(b ? b.status : '')}</b> to <b>${esc(st)}</b>. The customer${b && b.rider ? ', rider' : ''} and business will be notified.</p>
      ${ovr ? '<div class="warn">This is an override. It skips the normal order flow and is recorded in the history.</div>' : ''}
      ${st === 'Payment Collected' && b ? `<div class="field mt"><label>Amount collected (P) * — required</label><input id="ssAmt" type="number" min="0" step="any" inputmode="decimal" required placeholder="Type the amount you received" value=""><span class="hint">Expected ${peso(Rules.cashExpected(b))}${b.payMethod === 'cod' ? ' from the rider (food amount; the rider keeps the delivery fee)' : b.payMethod === 'pickup' ? ' at pick-up' : ' balance at the venue'}. This goes to the Super Admin cash report.</span></div>` : ''}
      <div class="field mt"><label>Note (optional, shared in the history)</label><input id="ssNote" maxlength="200"></div><div class="err" id="ssErr"></div>
      <div class="row2"><button class="btn ghost" onclick="closeSheet()">Back</button><button class="btn ${Rules.EXCEPTIONS.indexOf(st) >= 0 ? 'dangerbtn' : ''}" id="ssGo">Yes, ${esc(st)}</button></div></div>`);
    $('#ssGo').onclick = async () => {
      loading(true, 'Updating…');
      const amt = $('#ssAmt') ? $('#ssAmt').value : undefined;
      if ($('#ssAmt') && (amt === '' || !(+amt >= 0) || (b && b.payMethod === 'cod' && !(+amt > 0)))) { loading(false); $('#ssErr').textContent = 'Enter the amount collected. This is required.'; $('#ssAmt').focus(); return; }
      try { const r = await api('setStatus', { token: getToken(), ref, status: st, note: $('#ssNote').value.trim(), amount: amt }); loading(false); closeSheet(); toast(ref + ': ' + st); onDone && onDone(r.booking); }
      catch (x) { loading(false); $('#ssErr').textContent = x.message; }
    };
  });
}

/* ================= NOTIFICATIONS (in-app bell + browser notifications + polling) ================= */
const Notif = {
  token: null, key: '', since: '', items: [], unread: 0, timer: null, onEvents: null,
  start(token, key, onEvents) {
    Push.start(() => this.token);
    this.token = token; this.key = 'tr5_notif_' + key; this.onEvents = onEvents;
    const s = store(this.key) || {}; this.items = s.items || []; this.unread = s.unread || 0; this.since = s.since || new Date(Date.now() - 3 * 864e5).toISOString();
    this.badge(); clearInterval(this.timer); this.poll(); this.timer = setInterval(() => this.poll(), DEMO ? 8000 : 20000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) this.poll(); });
  },
  stop() { clearInterval(this.timer); this.token = null; },
  async poll() {
    if (!this.token) return;
    try {
      const r = await api('feed', { token: this.token, since: this.since });
      const fresh = (r.events || []).filter(e => !this.items.some(x => x.id === e.id));
      this.since = r.now || this.since;
      if (fresh.length) {
        this.items = fresh.concat(this.items).slice(0, 80); this.unread += fresh.length; this.badge();
        const last = fresh[fresh.length - 1]; toast(last.text.slice(0, 90));
        if (document.hidden && 'Notification' in window && Notification.permission === 'granted') try { new Notification(CAT.business.name || 'Tara Romblon', { body: last.text.slice(0, 160) }); } catch (e) { }
        this.onEvents && this.onEvents(fresh);
      }
      store(this.key, { items: this.items, unread: this.unread, since: this.since });
    } catch (e) { if (/sign in/i.test(e.message)) this.stop(); }
  },
  badge() { document.querySelectorAll('.bellbadge').forEach(b => { b.textContent = this.unread || ''; b.dataset.n = this.unread; }); },
  open() {
    this.unread = 0; this.badge(); store(this.key, { items: this.items, unread: 0, since: this.since });
    openSheet(`<div class="sbody"><h2>Notifications</h2><div id="pushBox2" class="mt"></div>
      <div class="nlist">${this.items.map(e => `<div class="nitem ${e.type}">${ic({ message: 'chat', status: 'arrow', new: 'receipt', assigned: 'bike', verification: 'id', application: 'doc', proof: 'upload', payout: 'wallet', rider: 'bike' }[e.type] || 'bell')}<div><div>${esc(e.text)}</div><small>${new Date(e.at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</small></div></div>`).join('') || '<div class="empty">No notifications yet.</div>'}</div></div>`);
    Push.box('#pushBox2');
  }
};
/* Phone notifications (Web Push): arrive even when the app is closed. iPhone: only after "Add to Home Screen" (iOS 16.4+). */
const Push = {
  tokenFn: null,
  supported() { return !DEMO && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window; },
  iosNeedsInstall() { const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1); return ios && !(navigator.standalone || matchMedia('(display-mode: standalone)').matches); },
  async reg() { return navigator.serviceWorker.getRegistration('/') .then(r => r || navigator.serviceWorker.register('/sw.js', { scope: '/' })); },
  async state() {
    if (!this.supported()) return this.iosNeedsInstall() ? 'install' : 'unsupported';
    if (Notification.permission === 'denied') return 'denied';
    try { const r = await this.reg(), sub = r && await r.pushManager.getSubscription(); return sub && Notification.permission === 'granted' ? 'on' : 'off'; } catch (e) { return 'off'; }
  },
  b64(s) { const p = '='.repeat((4 - s.length % 4) % 4), b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, c => c.charCodeAt(0)); },
  async subscribe(token, quiet) {
    const r = await this.reg(); await navigator.serviceWorker.ready;
    let sub = await r.pushManager.getSubscription();
    if (!sub) { const k = (await api('pushKey')).key; if (!k) throw new Error('Notifications are not set up on the server yet.'); sub = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: this.b64(k) }); }
    await api('pushSubscribe', { token, sub: sub.toJSON() }); if (!quiet) toast('Notifications are on for this phone');
  },
  async enable() {
    const t = this.tokenFn && this.tokenFn(); if (!t) return;
    try { const p = await Notification.requestPermission(); if (p !== 'granted') { toast(p === 'denied' ? 'Notifications are blocked. Allow them in your browser or phone settings.' : 'Notifications were not turned on.'); return this.refresh(); }
      loading(true, 'Turning on notifications…'); await this.subscribe(t); loading(false); }
    catch (e) { loading(false); toast(e.message || 'Could not turn on notifications.'); }
    this.refresh();
  },
  async disable() { try { const r = await this.reg(), sub = r && await r.pushManager.getSubscription(); if (sub) { const t = this.tokenFn && this.tokenFn(); if (t) await api('pushUnsubscribe', { token: t, endpoint: sub.endpoint }).catch(() => {}); await sub.unsubscribe(); } toast('Notifications are off for this phone'); } catch (e) { } this.refresh(); },
  async test() { try { const r = await this.reg(); await r.showNotification(CAT.business.name || 'Tara Romblon', { body: 'Notifications are working on this phone.', icon: (CAT.settings && CAT.settings.siteIcon) || '/img/icon-192.png', badge: '/img/icon-192.png' }); } catch (e) { toast(e.message); } },
  async html() {
    const s = await this.state();
    return s === 'on' ? `<div class="pushst on">${ic('bell', 16)} <b>Phone notifications are on</b> for this device.</div><div class="rowbtns mt"><button class="btn ghost sm" onclick="Push.test()">Send a test</button><button class="btn ghost sm" onclick="Push.disable()">Turn off</button></div>`
      : s === 'off' ? `<button class="btn sm" onclick="Push.enable()">${ic('bell', 14)} Turn on phone notifications</button><p class="hint" style="margin-top:6px">New orders, status updates and messages will pop up on this phone, even when the app is closed.</p>`
      : s === 'denied' ? `<p class="hint">Notifications are blocked for this site. Open your browser or phone settings → Notifications, allow this site, then reopen the app.</p>`
      : s === 'install' ? `<p class="hint">On iPhone, first add this app to your Home Screen (Share → <b>Add to Home Screen</b>), open it from there, then turn on notifications here.</p>`
      : `<p class="hint">${DEMO ? 'Phone notifications work on the live site.' : 'This browser does not support phone notifications. Try Chrome on Android or the home-screen app on iPhone.'} You still get updates here in the app and by email.</p>`;
  },
  async refresh() { for (const id of ['#pushBox', '#pushBox2']) { const el = $(id); if (el) el.innerHTML = await this.html(); } const n = $('#pushNudge'); if (n && (await this.state()) !== 'off') n.remove(); },
  box(sel, tokenFn) { if (tokenFn) this.tokenFn = tokenFn; const el = $(sel); if (el) this.html().then(h => { el.innerHTML = h; }); },
  /* after sign-in: keep this device's subscription linked to the account; otherwise show a small "Turn on" bar */
  async start(tokenFn) {
    this.tokenFn = tokenFn; const st = await this.state(), t = tokenFn();
    if (st === 'on' && t) { this.subscribe(t, true).catch(() => {}); return; }
    let dis = false; try { dis = sessionStorage.getItem('tr_push_nudge') === '1'; } catch (e) { }
    if ((st === 'off' || st === 'install') && !dis && !$('#pushNudge')) {
      const d = document.createElement('div'); d.id = 'pushNudge'; d.className = 'pushnudge';
      d.innerHTML = `${ic('bell', 18)}<span>${st === 'install' ? 'Add this app to your Home Screen to get notifications on your iPhone.' : 'Turn on notifications so you don\'t miss orders and updates.'}</span>${st === 'off' ? '<button class="btn sm" id="pnGo">Turn on</button>' : ''}<button class="xbtn" id="pnX" aria-label="Dismiss">${ic('x', 14)}</button>`;
      document.body.appendChild(d);
      if ($('#pnGo')) $('#pnGo').onclick = () => this.enable();
      $('#pnX').onclick = () => { d.remove(); try { sessionStorage.setItem('tr_push_nudge', '1'); } catch (e) { } };
    }
  }
};
const bellBtn = () => `<button class="iconbtn bell" onclick="Notif.open()" aria-label="Notifications">${ic('bell', 22)}<span class="badge bellbadge" data-n="0"></span></button>`;

/* ================= IN-APP MESSAGING ================= */
const Chat = {
  token: null, me: null, cur: null, timer: null, seenKey: 'tr5_seen',
  seen() { return store(this.seenKey) || {}; },
  markSeen(t) { const s = this.seen(); s[t.id] = t.updated; store(this.seenKey, s); },
  unread(t) { return t.last && t.updated > (this.seen()[t.id] || '') && t.last.name !== (this.me && this.me.name); },
  title(t) { return t.type === 'inquiry' ? 'Inquiry · ' + bizName(t.bizId) : t.type === 'rider' ? 'Rider chat · ' + t.ref + ' (' + (t.with === 'customer' ? 'customer' : bizName(t.bizId)) + ')' : t.ref + ' · ' + bizName(t.bizId); },
  list(threads, opts) {
    opts = opts || {};
    if (!threads.length) return `<div class="empty">${opts.empty || 'No conversations yet.'}</div>`;
    return `<div class="tlist">${threads.map(t => `<button class="titem ${this.unread(t) ? 'unread' : ''}" onclick="Chat.open({threadId:'${esc(t.id)}'})">
      <span class="tav">${ic(t.type === 'inquiry' ? 'info' : t.type === 'rider' ? 'bike' : 'receipt')}</span><span class="tbody"><b>${esc(opts.who === 'customer' || opts.who === 'rider' || t.type === 'rider' ? (opts.who === 'rider' ? (t.with === 'customer' ? 'Customer ' + t.name : bizName(t.bizId)) + ' · ' + t.ref : this.title(t)) : esc(t.name) + ' · ' + (t.type === 'inquiry' ? 'Inquiry' : t.ref) + (opts.showBiz ? ' · ' + bizName(t.bizId) : ''))}</b>
      <span>${t.last ? esc(t.last.name) + ': ' + esc(t.last.text) : 'No messages yet'}</span></span><small>${t.updated ? new Date(t.updated).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}</small></button>`).join('')}</div>`;
  },
  async open(q) {
    loading(true, 'Opening chat…');
    try {
      this.q = q; const r = await api('thread', { token: this.token(), ...q }); loading(false);
      this.cur = r.thread; this.render(r.messages, true); this.markSeen(r.thread);
      clearInterval(this.timer); this.timer = setInterval(() => this.refresh(), DEMO ? 4000 : 8000);
    } catch (x) { loading(false); toast(x.message); }
  },
  async refresh() {
    if (!this.cur || !$('#ov').classList.contains('show') || !$('#chatLog')) { clearInterval(this.timer); return; }
    try { const r = await api('thread', { token: this.token(), threadId: this.cur.id }); if (r.messages.length !== $('#chatLog').children.length) { this.cur = r.thread; this.render(r.messages); this.markSeen(r.thread); } } catch (e) { }
  },
  render(msgs, first) {
    const t = this.cur, meEmail = this.me && this.me.email;
    const rider = t.type === 'rider', role = this.me && this.me.role;
    const head = rider ? (role === 'rider' ? (t.with === 'customer' ? 'Customer · ' + t.name : bizName(t.bizId)) : 'Your rider') : bizName(t.bizId);
    const html = `<div class="sbody chat"><span class="brandl">${t.type === 'inquiry' ? 'Inquiry' : (rider ? 'Rider chat · ' : 'Order ') + esc(t.ref)}</span><h2>${esc(head)}</h2>
      <p class="hint">${rider ? 'Between the rider and ' + (t.with === 'customer' ? esc(t.name) : esc(bizName(t.bizId))) + ' only (Beyond Tech Solutions Super Admins can read it)' : esc(t.name) + ' · visible to the customer, ' + esc(bizName(t.bizId)) + ' and Beyond Tech Solutions Super Admins'}</p>
      <div class="clog" id="chatLog">${msgs.map(m => `<div class="cm ${m.email && m.email === meEmail ? 'me' : ''}"><b>${esc(m.name)} <i>${esc(Rules.ROLE_LABEL[m.role] || (m.role === 'customer' ? 'Customer' : m.role))}</i></b>${esc(m.text)}<small>${new Date(m.at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</small></div>`).join('') || '<div class="empty" style="padding:20px">Say hello. Messages are saved with this ' + (t.type === 'inquiry' ? 'inquiry' : 'order') + '.</div>'}</div>
      <form class="cform" id="chatForm"><textarea id="chatT" rows="1" maxlength="1500" placeholder="Write a message…"></textarea><button class="btn" aria-label="Send">${ic('arrow')}</button></form></div>`;
    if (first || !$('#chatLog')) openSheet(html); else { const keep = $('#chatT').value; $('#sheet').innerHTML = `<button class="sx" onclick="closeSheet()" aria-label="Close">${ic('x')}</button>` + html; $('#chatT').value = keep; }
    const log = $('#chatLog'); log.scrollTop = log.scrollHeight;
    $('#chatForm').onsubmit = async e => {
      e.preventDefault(); const text = $('#chatT').value.trim(); if (!text) return;
      $('#chatT').value = '';
      try { const r = await api('send', { token: this.token(), threadId: t.id, text, ref: t.ref || undefined, chan: rider ? (role === 'rider' ? t.with : role === 'super' ? t.with : 'rider') : undefined, inquiryBizId: t.type === 'inquiry' ? t.bizId : undefined, cartBizIds: window.cartBizIds ? cartBizIds() : [] }); this.cur = r.thread; this.refresh(); setTimeout(() => this.refresh(), 300); }
      catch (x) { toast(x.message); $('#chatT').value = text; }
    };
    $('#chatT').onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#chatForm').requestSubmit(); } };
  }
};
async function viewUpload(fileId, title) {
  loading(true, 'Loading…');
  try { const r = await api('viewUpload', { token: Chat.token(), fileId }); loading(false); openSheet(`<div class="sbody"><h2>${esc(title || 'Upload')}</h2><img src="${r.dataUrl}" alt="" style="width:100%;border-radius:12px;margin-top:10px;border:1px solid var(--line)"><p class="hint mt">Private file. Only Super Admins${title && /proof/i.test(title) ? ' and the Merchant Admin' : ''} can view it.</p></div>`); }
  catch (x) { loading(false); toast(x.message); }
}

/* ================= LIVE RIDER TRACKING (Google Maps when a key is set, otherwise OpenStreetMap) ================= */
function loadGoogle() {
  if (window.google && google.maps && google.maps.importLibrary) return Promise.resolve();
  return window._gmP || (window._gmP = new Promise((res, rej) => {
    window.__gmReady = res; const s = document.createElement('script');
    s.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(MAPCFG.key) + '&v=weekly&loading=async&callback=__gmReady';
    s.async = true; s.onerror = () => rej(new Error('Google Maps did not load')); document.head.appendChild(s); setTimeout(() => rej(new Error('Google Maps timed out')), 15000);
  }));
}
const Track = {
  ref: null, token: null, timer: null, map: null, mk: {}, prov: null, fitted: false,
  async open(ref, token) {
    Object.assign(this, { ref, token, map: null, mk: {}, prov: null, fitted: false });
    openSheet(`<div class="sbody"><span class="brandl">Live tracking · ${esc(ref)}</span><h2 id="trT">Finding your rider…</h2><p class="meta" id="trS"></p><div class="trmap" id="trMap"></div><div id="trInfo"></div></div>`);
    const d = await this.fetch(); if (!d) return;
    this.update(d);                       // details first; the map fills in when it has loaded
    this.initMap(d).then(() => { this.fitted = false; this.update(this.lastD || d); });
    clearInterval(this.timer);
    this.timer = setInterval(async () => { if (!$('#trMap') || !$('#ov').classList.contains('show')) { clearInterval(this.timer); return; } const x = await this.fetch(); if (x) this.update(x); }, DEMO ? 5000 : 10000);
  },
  async fetch() { try { return await api('track', { token: this.token, ref: this.ref }); } catch (x) { toast(x.message); return null; } },
  pts(d) { return { store: [d.store.lat, d.store.lng], dest: d.dest && d.dest.lat != null ? [d.dest.lat, d.dest.lng] : null, rider: d.loc ? [d.loc.lat, d.loc.lng] : null }; },
  async initMap(d) {
    const P = this.pts(d), c = P.rider || P.store;
    if (window.MAPCFG && MAPCFG.key) {
      try {
        await loadGoogle();
        const [{ Map }, { AdvancedMarkerElement }] = await Promise.all([google.maps.importLibrary('maps'), google.maps.importLibrary('marker')]);
        this.prov = 'g'; this.map = new Map($('#trMap'), { center: { lat: c[0], lng: c[1] }, zoom: 14, mapId: MAPCFG.mapId || 'DEMO_MAP_ID', disableDefaultUI: true, zoomControl: true, gestureHandling: 'greedy' });
        const pin = (cls, html) => { const e = document.createElement('div'); e.className = 'tpin ' + cls; e.innerHTML = html; return e; };
        const at = p => ({ lat: p[0], lng: p[1] });
        this.mk.store = new AdvancedMarkerElement({ map: this.map, position: at(P.store), content: pin('store', ic('store', 16)), title: d.store.name });
        if (P.dest) this.mk.dest = new AdvancedMarkerElement({ map: this.map, position: at(P.dest), content: pin('dest', ic('home', 16)), title: 'Delivery location' });
        this.mk.rider = new AdvancedMarkerElement({ map: this.map, position: at(c), content: pin('rider', ic('bike', 18)), title: 'Rider', zIndex: 10 });
        return;
      } catch (e) { console.warn(e); $('#trMap') && ($('#trMap').innerHTML = ''); }
    }
    await new Promise(res => { loadMap('trMap', c[0], c[1], m => {
      this.prov = 'l'; this.map = m; const di = (cls, html) => L.divIcon({ html, className: 'tpin ' + cls, iconSize: [34, 34], iconAnchor: [17, 17] });
      this.mk.store = L.marker(P.store, { icon: di('store', ic('store', 16)) }).addTo(m).bindTooltip(d.store.name);
      if (P.dest) this.mk.dest = L.marker(P.dest, { icon: di('dest', ic('home', 16)) }).addTo(m).bindTooltip('Delivery location');
      this.mk.rider = L.marker(c, { icon: di('rider', ic('bike', 18)), zIndexOffset: 1000 }).addTo(m);
      res(); }, 'The map could not load here. The rider\'s status and arrival time below still update live.'); setTimeout(res, 8000); });
  },
  move(k, p) { const m = this.mk[k]; if (!m || !p) return; if (this.prov === 'g') m.position = { lat: p[0], lng: p[1] }; else m.setLatLng(p); },
  fit(P) {
    const pts = [P.rider, P.store, P.dest].filter(Boolean); if (!this.map || this.fitted || pts.length < 2) return; this.fitted = true;
    if (this.prov === 'g') { const b = new google.maps.LatLngBounds(); pts.forEach(p => b.extend({ lat: p[0], lng: p[1] })); this.map.fitBounds(b, 60); }
    else this.map.fitBounds(pts, { padding: [40, 40] });
  },
  update(d) {
    this.lastD = d; if (!$('#trT')) return;
    const P = this.pts(d); this.move('rider', P.rider); this.fit(P);
    const ago = d.loc ? Math.max(0, Math.round((Date.now() - Date.parse(d.loc.at)) / 1000)) : null, r = d.rider;
    $('#trT').textContent = d.done ? 'Delivered' : !r ? 'No rider assigned yet' : d.status === 'Out for Delivery' ? (r.name + ' is on the way') : (r.name + ' is heading to ' + d.store.name);
    $('#trS').innerHTML = d.done ? 'This order has been delivered. Live tracking has ended.' : d.live ? `<b class="eta">${d.eta ? 'About ' + d.eta + ' min' : ''}</b>${d.km != null ? ' · ' + d.km + ' km away' : ''} · updated ${ago < 60 ? ago + 's' : Math.round(ago / 60) + ' min'} ago${d.loc.simulated ? ' (demo)' : ''}` : r ? (r.accepted ? 'Waiting for the rider\'s live location. It appears once the rider\'s app is open with location on.' : 'Waiting for the rider to accept the delivery.') : 'The store will assign a rider soon.';
    $('#trInfo').innerHTML = `<div class="trbar">${r ? `<div class="tav">${ic('bike', 22)}</div><div><b>${esc(r.name)}</b><span class="hint">${esc([r.vehicle, r.plate].filter(Boolean).join(' · ') || 'Delivery rider')}</span></div>${r.phone ? `<a class="btn ghost sm" href="tel:${esc(String(r.phone).replace(/\s/g, ''))}">${ic('phone', 14)} Call</a>` : ''}` : ''}</div>
      ${d.dest && d.dest.label ? `<p class="hint" style="margin-top:8px">${ic('pin', 14)} Deliver to: ${esc(d.dest.label)}</p>` : ''}
      <div class="tlegend"><span><i class="tpin rider sm"></i> Rider</span><span><i class="tpin store sm"></i> ${esc(d.store.name)}</span>${P.dest ? '<span><i class="tpin dest sm"></i> Delivery location</span>' : ''}</div>
      ${P.rider ? `<a class="link" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${P.rider[0]},${P.rider[1]}">${ic('nav', 14)} Open rider location in Google Maps</a>` : ''}`;
    if (d.done) clearInterval(this.timer);
  }
};
