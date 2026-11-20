/* ================= SUPER ADMIN APP (MJV Services OPC) ================= */
let ADM = { token: null, me: null, draft: null, dirty: false, edited: false, tab: 'stays' };
const AD = { tab: 'dash', data: null, staff: null, extra: {}, rq: '', po: { party: '', sel: {}, adj: '', adjNote: '', method: 'Bank transfer', reference: '', note: '' }, f: { biz: '', kind: '', status: '', q: '', from: '', to: '' }, r: { from: '', to: '', biz: '' }, cq: '', cv: '' };
const TABS = [['dash', 'chart', 'Dashboard'], ['bookings', 'receipt', 'Transactions'], ['messages', 'chat', 'Messages'], ['customers', 'users', 'Customers'], ['apps', 'doc', 'Business applications'], ['riderapps', 'id', 'Rider applications'], ['riders', 'bike', 'Riders'], ['biz', 'store', 'Businesses & users'], ['listings', 'box', 'Listings & rates'], ['payouts', 'wallet', 'Payouts'], ['discounts', 'tag', 'Discounts'], ['settings', 'gear', 'Settings'], ['reports', 'chart', 'Reports']];
const ST = () => Object.assign({}, DEFAULT_SETTINGS, CAT.settings || {});
const riderList = () => AD.data.staff.filter(s => s.role === 'rider');
const typeLabel = t => (Rules.BIZ_TYPES.find(x => x[0] === t) || [t, t])[1];
const bankText = b => b && b.accountNo ? `${esc(b.bank)} · ${esc(b.accountNo)} · ${esc(b.accountName)}` : '<span class="hint">No payout account yet</span>';
const dt = s => new Date(s).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
const dOnly = s => new Date(s).toLocaleDateString('en-PH', { dateStyle: 'medium' });
const dayOf = s => { const d = new Date(s); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const SUPER = () => ({ role: 'super', email: ADM.me.email });
const feeText = f => !f ? '0%' : f.type === 'fixed' ? peso(f.value) + ' per transaction' : (+f.value || 0) + '% of order / booking amount';

async function initPortal() {
  if (DEMO) document.body.classList.add('demo');
  try { const r = await api('getCatalog'); window.CAT_SAVED = !!r.catalog; if (r.catalog) CAT = r.catalog; } catch (e) { }
  CAT = Pricing.norm(CAT);
  CAT.businesses = CAT.businesses || clone(DEFAULT_CATALOG.businesses); CAT.settings = Object.assign({}, DEFAULT_SETTINGS, CAT.settings || {});
  const s = store('tr5_staff_admin');
  if (s && s.token) { try { const r = await api('staffMe', { token: s.token }); if (r.me.role === 'super') return start(s.token, r.me); } catch (e) { } }
  staffLogin('admin', v => start(v.token, v.me));
}
async function start(token, me) {
  ADM.token = token; ADM.me = me; ADM.draft = clone(CAT); if (!window.CAT_SAVED) ADM.dirty = true;
  Chat.token = () => ADM.token; Chat.me = { email: me.email, name: me.name || me.email, role: 'super' };
  $('#who').innerHTML = `<span>${esc(me.name || me.email)}</span><button class="link" onclick="signOutStaff()">Sign out</button>`; $('#bellSlot').innerHTML = bellBtn();
  await reload(); renderPortal();
  Notif.start(token, 'a_' + me.email, async () => { if (!ADM.edited) { await reload(true); renderPortal(); } });
}
function signOutStaff() { store('tr5_staff_admin', null); Notif.stop(); location.reload(); }
async function reload(quiet) { if (!quiet) loading(true, 'Loading data…'); try { const r = await api('adminData', { token: ADM.token }); AD.data = r; AD.staff = clone(r.staff); } catch (x) { toast(x.message); if (/sign in|Super Admin/i.test(x.message)) signOutStaff(); } loading(false); }
function setTab(t) { if (ADM.edited && ['listings', 'biz', 'settings', 'discounts'].includes(AD.tab) && t !== AD.tab && !(['listings', 'settings'].includes(AD.tab) && ['listings', 'settings'].includes(t))) { toast('Save or discard your changes first.'); return; } AD.tab = t; renderPortal(); scrollTo(0, 0); }
const bizApps = () => AD.data.applications.filter(a => a.appType !== 'rider'), riderApps = () => AD.data.applications.filter(a => a.appType === 'rider');
const newApps = () => (AD.data && bizApps().filter(a => a.status === 'New').length) || 0;
const newRiderApps = () => (AD.data && riderApps().filter(a => a.status === 'New').length) || 0;
const pendingLic = () => (AD.data && riderList().filter(r => r.licenseStatus === 'pending').length) || 0;
const pendingIds = () => (AD.data && AD.data.customers.filter(c => c.verify && c.verify.status === 'pending').length) || 0;
function renderPortal() {
  const badge = { apps: newApps(), riderapps: newRiderApps(), riders: pendingLic(), customers: pendingIds(), messages: AD.data.threads.filter(t => Chat.unread(t)).length };
  $('#root').innerHTML = `<div class="ptabs">${TABS.map(t => `<button class="${AD.tab === t[0] ? 'on' : ''}" onclick="setTab('${t[0]}')">${ic(t[1])} ${t[2]}${badge[t[0]] ? ` <i>${badge[t[0]]}</i>` : ''}</button>`).join('')}</div><div id="pbody"></div>`;
  ({ dash: vDash, bookings: vBookings, messages: vMessages, customers: vCustomers, apps: vApps, riderapps: vRiderApps, riders: vRiders, biz: vBiz, listings: vListings, payouts: vPayouts, discounts: vDiscounts, settings: vSettings, reports: vReports })[AD.tab]();
}
const P = h => $('#pbody').innerHTML = h;
function inRange(b, from, to) { const d = dayOf(b.created); return (!from || d >= from) && (!to || d <= to); }

/* ---- Dashboard ---- */
function vDash() {
  const B = AD.data.bookings, conf = B.filter(Rules.confirmed), M = conf.map(Rules.money), S = k => M.reduce((t, m) => t + m[k], 0);
  const per = CAT.businesses.map(z => { const l = conf.filter(b => b.bizId === z.id).map(Rules.money); return { z, g: l.reduce((t, m) => t + m.gross, 0), f: l.reduce((t, m) => t + m.fee, 0), n: l.length }; });
  const max = Math.max(1, ...per.map(p => p.g)), active = B.filter(b => !Rules.CLOSED.includes(b.status));
  P(`<div class="kpis">
    <div class="kpi"><span>Confirmed transactions</span><b>${conf.length}</b><small>${active.length} active · ${B.length} total</small></div>
    <div class="kpi"><span>Gross value</span><b>${peso(S('gross'))}</b><small>stays, rentals & food</small></div>
    <div class="kpi warnk"><span>Platform fees earned</span><b>${peso(S('fee'))}</b><small>from confirmed transactions</small></div>
    <div class="kpi"><span>Received online</span><b>${peso(S('collectedOnline'))}</b><small>HitPay & transfers</small></div>
    <div class="kpi"><span>Remittance due to merchants</span><b>${peso(S('remit'))}</b><small>after fees & discounts</small></div>
    <div class="kpi"><span>To review</span><b>${pendingIds() + newApps() + newRiderApps() + pendingLic() + B.filter(b => b.status === 'Awaiting Payment' && b.proofFile).length}</b><small>IDs, applications, licenses, transfer proofs</small></div></div>
    <div class="acard"><h3>Gross value and platform fees by business</h3>${per.map(p => `<div class="bar"><span>${esc(p.z.name)}</span><div><i style="width:${Math.round(p.g / max * 100)}%"></i></div><b>${peso(p.g)}</b><small>fee ${peso(p.f)}</small></div>`).join('')}</div>
    <div class="acard"><h3>Latest activity</h3><div class="nlist">${AD.data.events.slice().reverse().slice(0, 10).map(e => `<div class="nitem">${ic('bell')}<div>${esc(e.text)}<small>${dt(e.at)}</small></div></div>`).join('') || '<div class="empty">No activity yet.</div>'}</div></div>`);
}

/* ---- Transactions ---- */
function filtered() {
  const f = AD.f, q = f.q.toLowerCase();
  return AD.data.bookings.filter(b => (!f.biz || b.bizId === f.biz) && (!f.kind || b.kind === f.kind) && (!f.status || b.status === f.status || b.payStatus === f.status) && inRange(b, f.from, f.to)
    && (!q || [b.ref, b.group, b.email, b.customer.name, b.customer.phone, b.lines.map(l => l.label || l.name).join(' ')].join(' ').toLowerCase().includes(q))).sort((a, b) => b.created.localeCompare(a.created));
}
function vBookings() {
  const f = AD.f, list = filtered();
  P(`<div class="filters2"><input placeholder="Search ref, name, phone, email, item…" value="${esc(f.q)}" id="fq">
    <select id="fbiz"><option value="">All businesses</option>${CAT.businesses.map(z => `<option value="${z.id}" ${f.biz === z.id ? 'selected' : ''}>${esc(z.name)}</option>`).join('')}</select>
    <select id="fkind"><option value="">All types</option>${[['stay', 'Stays'], ['rental', 'Rentals'], ['tour', 'Tours & services'], ['food', 'Food']].map(k => `<option value="${k[0]}" ${f.kind === k[0] ? 'selected' : ''}>${k[1]}</option>`).join('')}</select>
    <select id="fst"><option value="">Any status</option>${Rules.STATUSES.concat(['Pending', 'Paid', 'Unpaid']).map(k => `<option ${f.status === k ? 'selected' : ''}>${k}</option>`).join('')}</select>
    <label>From <input type="date" id="ffrom" value="${f.from}"></label><label>To <input type="date" id="fto" value="${f.to}"></label></div>
    <div class="rowbtns"><span class="meta">${list.length} result${list.length === 1 ? '' : 's'} · ${peso(list.reduce((t, b) => t + b.quote.total, 0))}</span><button class="btn ghost sm" onclick="exportBookings(filtered())">Download CSV</button><button class="btn ghost sm" onclick="reload().then(renderPortal)">Refresh</button></div>
    ${list.map(adminCard).join('') || '<div class="empty">No transactions match.</div>'}`);
  const upd = () => { Object.assign(AD.f, { q: $('#fq').value, biz: $('#fbiz').value, kind: $('#fkind').value, status: $('#fst').value, from: $('#ffrom').value, to: $('#fto').value }); const p = $('#fq').selectionStart; vBookings(); const i = $('#fq'); i.focus(); i.setSelectionRange(p, p); };
  $('#fq').oninput = upd; ['fbiz', 'fkind', 'fst', 'ffrom', 'fto'].forEach(id => $('#' + id).onchange = upd);
  wireAdmin($('#pbody'));
}
function adminCard(b) {
  const m = Rules.money(b), c = b.customer, rider = b.rider ? AD.data.staff.find(s => s.email === b.rider) : null;
  return `<div class="ordcard"><div class="th"><div><span class="ref">${esc(b.ref)}</span> <span class="bz">${esc(bizName(b.bizId))}</span> <span class="mini">${kindIcon(b.kind)} ${b.kind}${b.kind === 'food' ? ' · ' + b.fulfillment : ''} · group ${esc(b.group)}</span><br><span class="mini">${dt(b.created)}</span></div>${statusChip(b.status)}</div>
    ${timeline(b)}
    <div class="cgrid"><div><span class="lbl">Customer</span><b>${esc(c.name)}</b><br>${esc(c.phone)}<br><a href="mailto:${esc(b.email)}">${esc(b.email)}</a><br><span class="hint">${esc(c.address)}</span></div>
      <div><span class="lbl">Items</span>${b.lines.map(l => `<div>${esc(lineText(l))}</div>`).join('')}${b.kind === 'food' && b.fulfillment === 'delivery' ? `<div class="hint">${ic('bike', 14)} ${rider ? esc(rider.name) + (b.riderAccepted ? ' (accepted)' : ' (not accepted)') : 'No rider'}</div>` : ''}</div>
      <div><span class="lbl">Money</span>Total ${peso(Rules.payable(b))}${Rules.reductions(b).total ? ` <span class="hint">(${b.code ? 'code ' + esc(b.code.code) + ' -' + peso(b.code.amount) + (b.code.fundedBy === 'tara' ? ' Tara-funded' : '') : ''}${b.code && b.points ? ', ' : ''}${b.points ? b.points.points + ' pts -' + peso(b.points.amount) : ''})</span>` : ''} · ${esc(Rules.PAY_LABEL[b.payMethod])} · <b>${esc(b.payStatus)}</b>${paidTags(b)}
        ${b.cashCollected ? `<br><span class="hint">${ic('cash', 14)} Cash received by merchant ${peso(b.cashCollected.amount)}${b.cashCollected.amount !== b.cashCollected.expected ? ' (expected ' + peso(b.cashCollected.expected) + ')' : ''} · ${esc(b.cashCollected.by)}</span>` : ''}<br><span class="hint">Gross ${peso(Rules.gross(b))} · discount ${peso(b.discount || 0)} · fee ${peso(b.fee || 0)} · net ${peso(Rules.gross(b) - (b.discount || 0) - (b.fee || 0))}${m.collectedOnline ? '<br>Received online ' + peso(m.collectedOnline) + ' · remit ' + peso(m.remit) : ''}</span>
        ${b.proofFile ? `<br><button class="link" onclick="viewUpload('${esc(b.proofFile)}','Payment proof - ${esc(b.ref)}')">View payment proof</button>` : ''}${b.idFile ? `<br><button class="link" onclick="viewUpload('${esc(b.idFile)}','Guest ID - ${esc(b.ref)}')">View guest ID</button>` : ''}</div></div>
    ${b.notes ? `<div class="warn">Customer note: ${esc(b.notes)}</div>` : ''}${b.adminNotes ? `<div class="hint">Internal: ${esc(b.adminNotes)}</div>` : ''}
    ${statusActions(b, SUPER())}
    <div class="rowbtns" style="margin:10px 0 0">${Rules.trackable(b) ? `<button class="btn sm track" onclick="Track.open('${esc(b.ref)}',ADM.token)">${ic('locate')} Track rider</button>` : ''}<button class="btn ghost sm" onclick="Chat.open({ref:'${esc(b.ref)}'})">${ic('chat')} Messages</button><button class="btn ghost sm" data-open="${esc(b.ref)}">${ic('gear')} Edit / override</button>
      ${b.kind === 'food' && b.fulfillment === 'delivery' && !Rules.CLOSED.includes(b.status) ? `<select data-rsel="${esc(b.ref)}"><option value="">${rider ? 'Change rider…' : 'Assign rider…'}</option>${AD.data.staff.filter(s => s.role === 'rider').map(r => `<option value="${esc(r.email)}">${esc(r.name)} ${r.available ? '(available)' : '(offline)'}</option>`).join('')}</select>` : ''}</div></div>`;
}
const paidTags = b => (b.bizPayout ? `<span class="paidtag">Paid out ${esc(b.bizPayout)}</span>` : '') + (b.riderPayout ? `<span class="paidtag">Rider paid ${esc(b.riderPayout)}</span>` : '');
const refLink = ref => `<button class="reflink" onclick="viewTxn('${esc(ref)}')">${esc(ref)}</button>`;
function viewTxn(ref) { const b = AD.data.bookings.find(x => x.ref === ref); if (!b) { toast('Transaction not found'); return; } openSheet(`<div class="sbody">${adminCard(b)}</div>`); wireAdmin($('#sheet')); }
function wireAdmin(root) {
  wireStatus(root, () => ADM.token, async () => { await reload(true); renderPortal(); }, ref => AD.data.bookings.find(b => b.ref === ref));
  root.querySelectorAll('[data-open]').forEach(b => b.onclick = () => openBooking(b.dataset.open));
  root.querySelectorAll('[data-rsel]').forEach(s => s.onchange = async () => { if (!s.value) return; try { await api('assignRider', { token: ADM.token, ref: s.dataset.rsel, rider: s.value }); toast('Rider assigned and notified'); await reload(true); renderPortal(); } catch (x) { toast(x.message); } });
}
function openBooking(ref) {
  const b = AD.data.bookings.find(x => x.ref === ref); if (!b) return;
  openSheet(`<div class="sbody"><span class="ref">${esc(b.ref)}</span><h2 style="margin-top:4px">Edit / override</h2><p class="meta">${esc(bizName(b.bizId))} · ${esc(b.customer.name)}. Status changes use the buttons on the transaction (Override status).</p>
    <div class="row2"><div class="field"><label>Discount (P)</label><input id="obD" type="number" min="0" step="any" value="${b.discount || 0}"></div><div class="field"><label>Platform fee for this transaction (P)</label><input id="obF" type="number" min="0" step="any" value="${b.fee || 0}"></div></div>
    <div class="field mt"><label>Payment status (accounting)</label><div class="seg wrap">${Rules.PAY_STATUSES.map(s => `<button type="button" class="${s === b.payStatus ? 'on' : ''}" data-ps="${s}">${s}</button>`).join('')}</div></div>
    <div class="row2"><div class="field"><label>Customer name</label><input id="obN" value="${esc(b.customer.name)}"></div><div class="field"><label>Phone</label><input id="obPh" value="${esc(b.customer.phone)}"></div></div>
    <div class="field mt"><label>Address</label><input id="obA" value="${esc(b.customer.address)}"></div>
    <div class="field mt"><label>Internal notes (Super Admins only)</label><textarea id="obNotes" rows="3">${esc(b.adminNotes || '')}</textarea></div>
    <div class="nlist">${(b.history || []).slice().reverse().map(h => `<div class="nitem">${ic('clock')}<div><b>${esc(h.status)}</b> · ${esc(h.by || '')} <span class="hint">${esc(Rules.ROLE_LABEL[h.role] || h.role || '')}</span>${h.note ? `<div class="hint">${esc(h.note)}</div>` : ''}<small>${dt(h.at)}</small></div></div>`).join('')}</div>
    <div class="err" id="obErr"></div><button class="btn full mt" id="obSave">Save changes</button></div>`);
  let ps = b.payStatus; document.querySelectorAll('[data-ps]').forEach(x => x.onclick = () => { ps = x.dataset.ps; document.querySelectorAll('[data-ps]').forEach(y => y.classList.toggle('on', y === x)); });
  $('#obSave').onclick = async () => {
    const fields = { discount: +$('#obD').value, fee: +$('#obF').value, payStatus: ps, adminNotes: $('#obNotes').value, customer: { name: $('#obN').value.trim(), phone: $('#obPh').value.trim(), address: $('#obA').value.trim() } };
    loading(true, 'Saving…');
    try { await api('adminUpdate', { token: ADM.token, ref, fields }); await reload(true); loading(false); closeSheet(); toast('Saved ' + ref); renderPortal(); } catch (x) { loading(false); $('#obErr').textContent = x.message; }
  };
}
function exportBookings(list) {
  const rows = [['Ref', 'Group', 'Created', 'Business', 'Type', 'Items', 'Start', 'End', 'Status', 'Payment method', 'Payment status', 'Total', 'Gross', 'Discount', 'Platform fee', 'Net', 'Delivery fee', 'Received online', 'Remit to merchant', 'Customer', 'Phone', 'Email', 'Address', 'Rider', 'Customer notes', 'Internal notes']];
  list.forEach(b => { const m = Rules.money(b); rows.push([b.ref, b.group, b.created, bizName(b.bizId), b.kind, b.lines.map(lineText).join(' | '), (b.lines[0] || {}).start || '', (b.lines[0] || {}).end || '', b.status, Rules.PAY_LABEL[b.payMethod], b.payStatus, b.quote.total, Rules.gross(b), b.discount || 0, b.fee || 0, Rules.gross(b) - (b.discount || 0) - (b.fee || 0), b.kind === 'food' ? b.quote.deliveryFee || 0 : 0, m.collectedOnline, m.remit, b.customer.name, b.customer.phone, b.email, b.customer.address, b.rider || '', b.notes || '', b.adminNotes || '']); });
  downloadCSV('transactions-' + today + '.csv', rows);
}

/* ---- Messages (all conversations) ---- */
function vMessages() {
  P(`<p class="meta" style="margin-bottom:12px">Every conversation between customers, merchants and riders. You can read and reply to any of them.</p>${Chat.list(AD.data.threads.slice().sort((a, b) => String(b.updated).localeCompare(String(a.updated))), { showBiz: true, empty: 'No messages yet.' })}
    <div class="rowbtns mt"><button class="btn ghost sm" onclick="dlMessages()">Download conversations list (CSV)</button></div>`);
}
function dlMessages() { downloadCSV('conversations-' + today + '.csv', [['Updated', 'Type', 'Booking ref', 'Business', 'Customer', 'Email', 'Last message'], ...AD.data.threads.map(t => [t.updated, t.type, t.ref, bizName(t.bizId), t.name, t.email, t.last ? t.last.name + ': ' + t.last.text : ''])]); }

/* ---- Customers + ID verification ---- */
function vCustomers() {
  const q = AD.cq.toLowerCase(), B = AD.data.bookings;
  const list = AD.data.customers.map(c => { const mine = B.filter(b => b.email === c.email), conf = mine.filter(Rules.confirmed); return { ...c, n: mine.length, spent: conf.reduce((t, b) => t + b.quote.total, 0), last: mine.map(b => b.created).sort().pop() }; })
    .filter(c => (!q || [c.email, c.name, c.phone, c.address].join(' ').toLowerCase().includes(q)) && (!AD.cv || (c.verify || {}).status === AD.cv)).sort((a, b) => ((b.verify || {}).status === 'pending') - ((a.verify || {}).status === 'pending') || (b.last || '').localeCompare(a.last || ''));
  const pend = AD.data.customers.filter(c => (c.verify || {}).status === 'pending');
  P(`${pend.length ? `<div class="acard"><h3><span class="hl">${ic('id')} ID verification queue</span><span class="schip wait">${pend.length} pending</span></h3>${pend.map(c => `<div class="vq"><div><b>${esc(c.name || c.email)}</b><span class="hint">${esc(c.email)} · ${esc(c.phone)} · ${esc(c.verify.idType || '')} · submitted ${dt(c.verify.submitted)}</span></div>
      <div class="rowbtns"><button class="btn ghost sm" onclick="viewUpload('${esc(c.verify.file)}','ID - ${esc(c.name)}')">View ID</button><button class="btn sm" onclick="verifyCust('${esc(c.email)}','verified')">Approve</button><button class="btn ghost sm danger" onclick="verifyCust('${esc(c.email)}','rejected')">Reject</button></div></div>`).join('')}</div>` : ''}
    <div class="filters2"><input id="cq" placeholder="Search name, email, phone, address…" value="${esc(AD.cq)}"><div class="seg">${[['', 'All'], ['verified', 'Verified'], ['pending', 'Pending'], ['unverified', 'Not verified'], ['rejected', 'Rejected']].map(v => `<button class="${AD.cv === v[0] ? 'on' : ''}" onclick="AD.cv='${v[0]}';vCustomers()">${v[1]}</button>`).join('')}</div></div>
    <div class="rowbtns"><span class="meta">${list.length} customer${list.length === 1 ? '' : 's'}</span><button class="btn ghost sm" id="cDl">Download CSV</button></div>
    <div class="acard"><div class="tscroll"><table class="btable"><tr><th>Customer</th><th>Contact</th><th>Address</th><th>ID</th><th>Bookings</th><th>Confirmed value</th><th>Last activity</th></tr>
    ${list.map(c => `<tr><td><b>${esc(c.name || '-')}</b></td><td>${esc(c.email)}<br><span class="hint">${esc(c.phone)}</span></td><td>${esc(c.address)}</td><td>${statusChip({ verified: 'Verified', pending: 'Pending', rejected: 'Rejected' }[(c.verify || {}).status] || 'Not verified').replace('schip go', 'schip ' + ({ verified: 'done', pending: 'wait', rejected: 'bad' }[(c.verify || {}).status] || ''))}${(c.verify || {}).file ? `<br><button class="link" onclick="viewUpload('${esc(c.verify.file)}','ID - ${esc(c.name)}')">View</button>` : ''}</td><td>${c.n}</td><td>${peso(c.spent)}</td><td>${c.last ? dOnly(c.last) : '-'}</td></tr>`).join('')}</table></div></div>`);
  $('#cq').oninput = e => { AD.cq = e.target.value; const p = e.target.selectionStart; vCustomers(); $('#cq').focus(); $('#cq').setSelectionRange(p, p); };
  $('#cDl').onclick = () => downloadCSV('customers-' + today + '.csv', [['Name', 'Email', 'Phone', 'Address', 'ID status', 'ID type', 'Bookings', 'Confirmed value', 'Last activity', 'Signed up'], ...list.map(c => [c.name, c.email, c.phone, c.address, (c.verify || {}).status || 'unverified', (c.verify || {}).idType || '', c.n, c.spent, c.last || '', c.created || ''])]);
}
function verifyCust(email, decision) {
  openSheet(`<div class="sbody"><h2>${decision === 'verified' ? 'Approve' : 'Reject'} ID?</h2><p class="meta">${esc(email)} will be notified in the app and by email.</p>${decision === 'rejected' ? '<div class="field mt"><label>Reason (shown to the customer)</label><input id="vN" placeholder="e.g. Photo is blurry"></div>' : ''}
    <div class="row2 mt"><button class="btn ghost" onclick="closeSheet()">Back</button><button class="btn ${decision === 'rejected' ? 'dangerbtn' : ''}" id="vGo">Yes, ${decision === 'verified' ? 'approve' : 'reject'}</button></div></div>`);
  $('#vGo').onclick = async () => { try { await api('adminVerify', { token: ADM.token, email, decision, note: $('#vN') ? $('#vN').value : '' }); closeSheet(); toast('Customer ' + (decision === 'verified' ? 'verified' : 'rejected')); await reload(true); renderPortal(); } catch (x) { toast(x.message); } };
}

/* ---- Business applications (with platform fee and payout account) ---- */
function vApps() {
  const A = bizApps().sort((a, b) => b.created.localeCompare(a.created));
  const F = [['type', 'Offers'], ['town', 'Town'], ['address', 'Address'], ['contactName', 'Contact'], ['position', 'Position'], ['phone', 'Mobile'], ['email', 'Email'], ['website', 'Facebook / website'], ['registration', 'DTI / SEC / CDA reg. no.'], ['permits', "Mayor's / Business permit"], ['capacity', 'Capacity'], ['priceRange', 'Price range'], ['startDate', 'Preferred start'], ['heardFrom', 'Heard from']];
  P(`<div class="rowbtns"><span class="meta">${A.length} application${A.length === 1 ? '' : 's'} from the List Business page</span><button class="btn ghost sm" id="aDl">Download CSV</button></div>
    <div class="rowbtns"><button class="btn ghost sm" onclick="document.querySelectorAll('details.appd').forEach(d=>d.open=true)">Expand all</button><button class="btn ghost sm" onclick="document.querySelectorAll('details.appd').forEach(d=>d.open=false)">Collapse all</button></div>
    ${A.map(a => { const pf = a.platformFee || { type: 'percent', value: 10 }; return `<details class="appd" ${AD.openApp === a.id ? 'open' : ''}><summary><b>${esc(a.businessName)}</b><span class="schip ${a.status === 'Approved' ? 'done' : a.status === 'Rejected' ? 'bad' : 'wait'}">${esc(a.status)}</span><span class="hint">${esc(a.type || '')} · ${esc(a.town || '')} · ${esc(a.contactName || '')} · ${dOnly(a.created)}</span></summary><div class="acard app" data-id="${a.id}"><p class="meta">Received ${dt(a.created)}${a.bizId ? ' · business ID ' + esc(a.bizId) : ''}</p>
      <div class="kv">${F.filter(f => a[f[0]]).map(f => `<div><span>${f[1]}</span><b>${esc(a[f[0]])}</b></div>`).join('')}</div>
      <p style="margin-top:10px;white-space:pre-line">${esc(a.description)}</p>${(a.photos || []).length ? `<div class="lbpv">${a.photos.map(p => `<span><img src="${esc(p)}"></span>`).join('')}</div>` : ''}
      <div class="bankbox"><span class="lbl">Payout account</span>${bankText(a.bank)}</div>
      <div class="feebox"><span class="lbl">Platform fee for this business</span><div class="row2"><div class="field"><label>Type</label><select data-pft><option value="percent" ${pf.type !== 'fixed' ? 'selected' : ''}>Percentage of each order / booking</option><option value="fixed" ${pf.type === 'fixed' ? 'selected' : ''}>Fixed amount per transaction</option></select></div><div class="field"><label>Value (${pf.type === 'fixed' ? 'P' : '%'})</label><input data-pfv type="number" min="0" step="any" value="${pf.value}"></div></div>
        <p class="hint">Auto-computed on every confirmed transaction for this business.</p></div>
      <div class="field mt"><label>Internal notes</label><input data-anote value="${esc(a.adminNotes || '')}"></div>
      <div class="sact"><button class="btn navy sm" data-asave>Save</button>${a.status === 'New' ? '<button class="btn ghost sm" data-ast="Contacted">Mark contacted</button>' : ''}${a.status !== 'Approved' ? '<button class="btn sm" data-approve>Approve & create business</button><button class="btn ghost sm danger" data-ast="Rejected">Reject</button>' : ''}<a class="btn ghost sm" href="mailto:${esc(a.email)}?subject=${encodeURIComponent('Your application to list ' + a.businessName)}">${ic('mail')} Email applicant</a></div></div></details>`; }).join('') || '<div class="empty">No applications yet.</div>'}`);
  $('#aDl').onclick = () => downloadCSV('business-applications-' + today + '.csv', [['Received', 'Status', 'Business', ...F.map(f => f[1]), 'Platform fee', 'Account name', 'Bank', 'Account no.', 'Description', 'Internal notes'], ...A.map(a => [a.created, a.status, a.businessName, ...F.map(f => a[f[0]] || ''), feeText(a.platformFee), (a.bank || {}).accountName || '', (a.bank || {}).bank || '', (a.bank || {}).accountNo || '', a.description, a.adminNotes || ''])]);
  wireApps();
}
function wireApps() {
  document.querySelectorAll('.app').forEach(c => {
    const a = AD.data.applications.find(x => x.id === c.dataset.id), pft = c.querySelector('[data-pft]'), pf = () => pft ? { type: pft.value, value: +c.querySelector('[data-pfv]').value } : undefined;
    c.closest('details') && c.closest('details').addEventListener('toggle', e => { if (e.target.open) AD.openApp = a.id; });
    const save = async (status) => { try { AD.openApp = a.id; await api('adminUpdateApplication', { token: ADM.token, id: a.id, status, adminNotes: c.querySelector('[data-anote]').value, platformFee: pf() }); toast('Application saved'); await reload(true); renderPortal(); } catch (x) { toast(x.message); } };
    c.querySelector('[data-asave]').onclick = () => save();
    c.querySelectorAll('[data-ast]').forEach(b => b.onclick = () => save(b.dataset.ast));
    const ap = c.querySelector('[data-approve]'); if (ap) ap.onclick = () => a.appType === 'rider' ? approveRider(a) : approveApp(a, pf());
  });
}
function guessType(t) { t = String(t || ''); return /stay|resort|homestay|hotel|inn/i.test(t) ? 'Stay' : /rental|scooter|vehicle|car/i.test(t) ? 'Rental' : /food|restaurant|caf|eat|bake|bar/i.test(t) ? 'Food' : /tour|boat|island|dive|kayak|trip/i.test(t) ? 'Tour' : 'Service'; }
function approveApp(a, pf) {
  const id = a.businessName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30) || uid();
  const type = guessType(a.type);
  openSheet(`<div class="sbody"><h2>Approve ${esc(a.businessName)}</h2><p class="meta">Creates the business with its platform fee and payout account, adds a draft listing under its type in Listings & rates, and gives the applicant Merchant Admin access.</p>
    <div class="row2"><div class="field"><label>Business ID</label><input id="apId" value="${esc(id)}"></div><div class="field"><label>Listing type</label><select id="apType">${Rules.BIZ_TYPES.map(t => `<option value="${t[0]}" ${t[0] === type ? 'selected' : ''}>${t[1]}</option>`).join('')}</select></div></div>
    <div class="row2"><div class="field"><label>Merchant Admin email</label><input id="apE" value="${esc(a.email)}"></div><div class="field"><label>Name</label><input id="apN" value="${esc(a.contactName)}"></div></div>
    <div class="warn">Platform fee: <b>${esc(feeText(pf))}</b><br>Payout account: ${bankText(a.bank)}</div><p class="hint">The new listing starts hidden with a rate of P0. Set its rates and photos, then turn on "Show on website".</p><div class="err" id="apErr"></div><button class="btn full mt" id="apGo">Approve & create</button></div>`);
  $('#apGo').onclick = async () => {
    loading(true, 'Creating business…');
    try {
      const r = await api('adminApproveApplication', { token: ADM.token, id: a.id, bizId: $('#apId').value.trim(), type: $('#apType').value, platformFee: pf, managerEmail: $('#apE').value.trim(), managerName: $('#apN').value.trim() });
      CAT = Pricing.norm(r.catalog); ADM.draft = clone(CAT); ADM.dirty = false; ADM.edited = false; window.CAT_SAVED = true; await reload(true); loading(false); closeSheet(); toast(a.businessName + ' created · draft listing added');
      ADM.tab = ({ Stay: 'stays', Rental: 'rentals', Food: 'food', Tour: 'tours', Service: 'services' })[r.catalog.businesses.find(b => b.id === r.bizId).type] || 'stays';
      if (ADM.tab === 'food') ADM.si = CAT.foods.findIndex(f => f.bizId === r.bizId); AD.tab = 'listings'; renderPortal();
    } catch (x) { loading(false); $('#apErr').textContent = x.message; }
  };
}

/* ---- Rider applications (from the customer app) ---- */
function vRiderApps() {
  const A = riderApps().sort((a, b) => b.created.localeCompare(a.created));
  const F = [['phone', 'Mobile'], ['email', 'Email'], ['address', 'Address'], ['town', 'Town'], ['vehicle', 'Vehicle'], ['plate', 'Plate no.'], ['licenseNo', "Driver's license no."], ['licenseExpiry', 'License expiry'], ['availability', 'Availability'], ['heardFrom', 'Heard from']];
  P(`<div class="rowbtns"><span class="meta">${A.length} rider application${A.length === 1 ? '' : 's'} from the customer app</span><button class="btn ghost sm" id="raDl">Download CSV</button></div>
    <div class="rowbtns"><button class="btn ghost sm" onclick="document.querySelectorAll('details.appd').forEach(d=>d.open=true)">Expand all</button><button class="btn ghost sm" onclick="document.querySelectorAll('details.appd').forEach(d=>d.open=false)">Collapse all</button></div>
    ${A.map(a => `<details class="appd" ${AD.openApp === a.id ? 'open' : ''}><summary><b>${esc(a.name)}</b><span class="schip ${a.status === 'Approved' ? 'done' : a.status === 'Rejected' ? 'bad' : 'wait'}">${esc(a.status)}</span><span class="hint">${esc(a.vehicle || '')} · ${esc(a.town || '')} · ${esc(a.phone || '')} · ${dOnly(a.created)}</span></summary><div class="acard app" data-id="${a.id}"><p class="meta">Received ${dt(a.created)}</p>
      <div class="kv">${F.filter(f => a[f[0]]).map(f => `<div><span>${f[1]}</span><b>${esc(a[f[0]])}</b></div>`).join('')}</div>
      ${a.experience ? `<p style="margin-top:10px;white-space:pre-line">${esc(a.experience)}</p>` : ''}
      <div class="licbox">${ic('id')} <b>Driver's license</b>${a.licenseFile ? `<button class="btn ghost sm" onclick="viewUpload('${esc(a.licenseFile)}','Driver\\'s license - ${esc(a.name)}')">View photo</button>` : '<span class="hint">No photo</span>'}</div>
      <div class="bankbox"><span class="lbl">Payout account</span>${bankText(a.bank)}</div>
      <div class="field mt"><label>Internal notes</label><input data-anote value="${esc(a.adminNotes || '')}"></div>
      <div class="sact"><button class="btn navy sm" data-asave>Save</button>${a.status === 'New' ? '<button class="btn ghost sm" data-ast="Contacted">Mark contacted</button>' : ''}${a.status !== 'Approved' ? '<button class="btn sm" data-approve>Approve as rider</button><button class="btn ghost sm danger" data-ast="Rejected">Reject</button>' : ''}<a class="btn ghost sm" href="mailto:${esc(a.email)}?subject=${encodeURIComponent('Your rider application')}">${ic('mail')} Email applicant</a></div></div></details>`).join('') || '<div class="empty">No rider applications yet. Riders apply from the customer app (Deliver with us).</div>'}`);
  $('#raDl').onclick = () => downloadCSV('rider-applications-' + today + '.csv', [['Received', 'Status', 'Name', ...F.map(f => f[1]), 'Account name', 'Bank', 'Account no.', 'Experience', 'Internal notes'], ...A.map(a => [a.created, a.status, a.name, ...F.map(f => a[f[0]] || ''), (a.bank || {}).accountName || '', (a.bank || {}).bank || '', (a.bank || {}).accountNo || '', a.experience || '', a.adminNotes || ''])]);
  wireApps();
}
function approveRider(a) {
  openSheet(`<div class="sbody"><h2>Approve ${esc(a.name)}?</h2><p class="meta">Creates a rider account for ${esc(a.email)}, saves the payout account and emails them a link to the Rider app.</p>
    ${a.licenseFile ? `<button class="btn ghost sm" onclick="viewUpload('${esc(a.licenseFile)}','Driver\\'s license - ${esc(a.name)}')">${ic('id')} Check driver's license first</button>` : ''}
    <label class="check mt"><input type="checkbox" id="arLic" checked><span>I checked the driver's license photo and it is valid (marks it Verified)</span></label>
    <div class="err" id="arErr"></div><div class="row2 mt"><button class="btn ghost" onclick="closeSheet()">Back</button><button class="btn" id="arGo">Approve rider</button></div></div>`);
  $('#arGo').onclick = async () => { loading(true, 'Approving…'); try { await api('adminApproveApplication', { token: ADM.token, id: a.id, licenseVerified: $('#arLic').checked }); await reload(true); loading(false); closeSheet(); toast(a.name + ' is now a rider'); AD.tab = 'riders'; renderPortal(); } catch (x) { loading(false); $('#arErr').textContent = x.message; } };
}

/* ---- Riders: profiles, driver's license verification, payout accounts ---- */
function vRiders() {
  const q = AD.rq.toLowerCase(), st = ST(), B = AD.data.bookings, pay = AD.data.payees || {};
  const list = riderList().filter(r => !q || [r.name, r.email, r.phone, r.town, r.plate, r.licenseNo].join(' ').toLowerCase().includes(q)).sort((a, b) => (b.licenseStatus === 'pending') - (a.licenseStatus === 'pending') || (b.available - a.available) || String(a.name).localeCompare(String(b.name)));
  const lic = r => `<span class="schip ${r.licenseStatus === 'verified' ? 'done' : r.licenseStatus === 'rejected' ? 'bad' : 'wait'}">License ${esc(r.licenseStatus || 'not uploaded')}</span>`;
  P(`<div class="filters2"><input id="rq" placeholder="Search name, email, phone, plate, license…" value="${esc(AD.rq)}"><button class="btn sm" onclick="riderSheet()">${ic('plus')} Add rider</button></div>
    <div class="rowbtns"><span class="meta">${list.length} rider${list.length === 1 ? '' : 's'} · ${riderList().filter(r => r.available).length} available now · ${pendingLic()} license${pendingLic() === 1 ? '' : 's'} to verify</span><button class="btn ghost sm" id="rDl">Download CSV</button></div>
    ${list.map(r => { const mine = B.filter(b => b.rider === r.email), done = mine.filter(b => Rules.DELIVERED.includes(b.status)), owe = mine.filter(Rules.riderPayable).reduce((t, b) => t + Rules.ledger(b, st).riderNet, 0);
      return `<div class="acard"><div class="rcard"><div><h3 style="margin:0">${esc(r.name || r.email)}</h3><div class="rowbtns" style="margin:6px 0 0"><span class="schip ${r.available ? 'go' : ''}">${r.available ? 'Available' : 'Offline'}</span>${lic(r)}${r.active === false ? '<span class="schip bad">Inactive</span>' : ''}</div></div>
        <div class="rowbtns" style="margin:0"><button class="btn ghost sm" onclick="riderSheet('${esc(r.email)}')">${ic('gear')} Edit</button></div></div>
        <div class="kv">${[['Email', r.email], ['Mobile', r.phone], ['Town', r.town], ['Address', r.address], ['Vehicle', r.vehicle], ['Plate no.', r.plate], ["Driver's license", r.licenseNo], ['License expiry', r.licenseExpiry ? fmtD(r.licenseExpiry) : ''], ['Joined', r.joined ? dOnly(r.joined) : ''], ['Last seen', r.lastSeen ? dt(r.lastSeen) : '']].filter(x => x[1]).map(x => `<div><span>${x[0]}</span><b>${esc(x[1])}</b></div>`).join('')}
          <div><span>Deliveries</span><b>${done.length} completed · ${mine.length - done.length} other</b></div><div><span>Unsettled</span><b>${owe >= 0 ? peso(owe) + ' to pay' : peso(-owe) + ' to collect'}</b></div></div>
        <div class="licbox">${ic('id')} <b>Driver's license photo</b>${r.licenseFile ? `<button class="btn ghost sm" onclick="viewUpload('${esc(r.licenseFile)}','Driver\\'s license - ${esc(r.name)}')">View</button>` : '<span class="hint">Not uploaded</span>'}
          ${r.licenseFile && r.licenseStatus !== 'verified' ? `<button class="btn sm" onclick="setLicense('${esc(r.email)}','verified')">Verify</button>` : ''}${r.licenseFile && r.licenseStatus !== 'rejected' ? `<button class="btn ghost sm danger" onclick="setLicense('${esc(r.email)}','rejected')">Reject</button>` : ''}${r.licenseNote ? `<span class="hint">${esc(r.licenseNote)}</span>` : ''}</div>
        <div class="bankbox"><span class="lbl">Payout account</span>${bankText(pay['rider:' + r.email])}</div>
        <div class="rowbtns mt"><button class="btn ghost sm" onclick="AD.po.party='rider:${esc(r.email)}';AD.po.sel={};setTab('payouts')">${ic('wallet')} Payout</button></div></div>`; }).join('') || `<div class="empty">No riders yet. Add one, or approve a rider application.</div>`}`);
  $('#rq').oninput = e => { AD.rq = e.target.value; const p = e.target.selectionStart; vRiders(); $('#rq').focus(); $('#rq').setSelectionRange(p, p); };
  $('#rDl').onclick = () => downloadCSV('riders-' + today + '.csv', [['Name', 'Email', 'Mobile', 'Town', 'Address', 'Vehicle', 'Plate', 'License no.', 'License expiry', 'License status', 'Available', 'Account name', 'Bank', 'Account no.'], ...riderList().map(r => { const b = pay['rider:' + r.email] || {}; return [r.name, r.email, r.phone, r.town || '', r.address || '', r.vehicle || '', r.plate || '', r.licenseNo || '', r.licenseExpiry || '', r.licenseStatus || '', r.available ? 'yes' : 'no', b.accountName || '', b.bank || '', b.accountNo || '']; })]);
}
function riderSheet(email) {
  const r = email ? riderList().find(x => x.email === email) : {}, b = email ? (AD.data.payees || {})['rider:' + email] || {} : {};
  const f = (id, label, v, type) => `<div class="field"><label>${label}</label><input id="${id}" ${type ? 'type="' + type + '"' : ''} value="${esc(v || '')}"></div>`;
  openSheet(`<div class="sbody"><h2>${email ? 'Edit rider' : 'Add a rider'}</h2><p class="meta">Riders sign in to the Rider app with this email.</p>
    <div class="row2">${f('rdN', 'Full name *', r.name)}${f('rdE', 'Email *', r.email, 'email')}</div>${email ? '<p class="hint">Email cannot be changed. Add a new rider instead.</p>' : ''}
    <div class="row2">${f('rdP', 'Mobile number *', r.phone, 'tel')}<div class="field"><label>Town</label><select id="rdT">${TOWNS.map(t => `<option ${t === (r.town || 'San Agustin') ? 'selected' : ''}>${t}</option>`).join('')}</select></div></div>
    <div class="field mt"><label>Address</label><input id="rdA" value="${esc(r.address || '')}"></div>
    <div class="row2">${f('rdV', 'Vehicle (make / model)', r.vehicle)}${f('rdPl', 'Plate number', r.plate)}</div>
    <div class="row2">${f('rdL', "Driver's license number", r.licenseNo)}${f('rdX', 'License expiry', r.licenseExpiry, 'date')}</div>
    <div class="field mt"><label>Driver's license photo ${r.licenseFile ? '(upload to replace)' : ''}</label><div class="upbox"><input type="file" accept="image/*" id="rdLic"><span class="hint" id="rdLicT">${r.licenseFile ? 'Current photo on file · status: ' + esc(r.licenseStatus || 'pending') : 'Front of the license, clear and readable'}</span></div></div>
    ${email ? `<label class="check mt"><input type="checkbox" id="rdAct" ${r.active === false ? '' : 'checked'}><span>Active (can sign in and receive deliveries)</span></label>` : ''}
    <div class="bankbox"><span class="lbl">Payout account (bank or e-wallet)</span><div class="row2">${f('rdBn', 'Account name', b.accountName)}${f('rdBb', 'Bank / e-wallet', b.bank)}</div>${f('rdBa', 'Account number', b.accountNo)}</div>
    <div class="err" id="rdErr"></div><button class="btn full mt" id="rdGo">${email ? 'Save rider' : 'Add rider'}</button></div>`);
  if (email) $('#rdE').disabled = true;
  let lic = '';
  $('#rdLic').onchange = async e => { if (!e.target.files[0]) return; try { lic = await resizeImage(e.target.files[0], 1400); $('#rdLicT').textContent = 'New photo ready to upload'; } catch (x) { toast(x.message); } };
  $('#rdGo').onclick = async () => {
    const rider = { email: email || $('#rdE').value.trim(), name: $('#rdN').value.trim(), phone: $('#rdP').value.trim(), town: $('#rdT').value, address: $('#rdA').value.trim(), vehicle: $('#rdV').value.trim(), plate: $('#rdPl').value.trim(), licenseNo: $('#rdL').value.trim(), licenseExpiry: $('#rdX').value };
    if (email) rider.active = $('#rdAct').checked;
    if (!rider.name || !rider.phone) { $('#rdErr').textContent = 'Name and mobile number are required.'; return; }
    if (!email && !lic) { $('#rdErr').textContent = "Upload a photo of the driver's license."; return; }
    const bank = { accountName: $('#rdBn').value.trim(), bank: $('#rdBb').value.trim(), accountNo: $('#rdBa').value.trim() };
    loading(true, 'Saving rider…');
    try { await api('adminSaveRider', { token: ADM.token, rider, licensePhoto: lic || undefined, bank: bank.accountNo || bank.bank || bank.accountName ? bank : undefined }); await reload(true); AD.staff = clone(AD.data.staff); loading(false); closeSheet(); toast(email ? 'Rider saved' : 'Rider added'); renderPortal(); }
    catch (x) { loading(false); $('#rdErr').textContent = x.message; }
  };
}
function setLicense(email, status) {
  const r = riderList().find(x => x.email === email);
  openSheet(`<div class="sbody"><h2>${status === 'verified' ? 'Verify' : 'Reject'} driver's license?</h2><p class="meta">${esc(r.name)} will be notified.</p>${status === 'rejected' ? '<div class="field mt"><label>Reason</label><input id="lcN" placeholder="e.g. Expired license"></div>' : ''}
    <div class="row2 mt"><button class="btn ghost" onclick="closeSheet()">Back</button><button class="btn ${status === 'rejected' ? 'dangerbtn' : ''}" id="lcGo">Yes, ${status === 'verified' ? 'verify' : 'reject'}</button></div></div>`);
  $('#lcGo').onclick = async () => { try { await api('adminSaveRider', { token: ADM.token, rider: { email, name: r.name, phone: r.phone, licenseStatus: status, licenseNote: $('#lcN') ? $('#lcN').value : '' } }); closeSheet(); toast('License ' + status); await reload(true); renderPortal(); } catch (x) { toast(x.message); } };
}

/* ---- Businesses & users (platform fee, up to 4 merchant users each) ---- */
function vBiz() {
  const D = ADM.draft, S = AD.staff, pay = AD.data.payees || {};
  const sslot = (idx, label) => { const u = S.filter(s => s.role === 'super')[idx] || {}; return `<div class="uslot"><span class="urole">${label}</span><input data-u="super||${idx}|email" placeholder="email@example.com" value="${esc(u.email || '')}"><input data-u="super||${idx}|name" placeholder="Name" value="${esc(u.name || '')}"></div>`; };
  const users = id => S.filter(s => (s.role === 'manager' || s.role === 'staff') && s.bizId === id);
  const mslot = (id, idx, u) => `<div class="uslot u4"><select data-u="m|${id}|${idx}|role"><option value="manager" ${u.role !== 'staff' ? 'selected' : ''}>Merchant Admin</option><option value="staff" ${u.role === 'staff' ? 'selected' : ''}>Merchant Staff</option></select><input data-u="m|${id}|${idx}|email" placeholder="email@example.com" value="${esc(u.email || '')}"><input data-u="m|${id}|${idx}|name" placeholder="Name" value="${esc(u.name || '')}"><button class="xbtn" title="Remove user" onclick="rmUser('${id}',${idx})">${ic('x')}</button></div>`;
  P(`<div class="acard"><h3>Super Admins <span class="hint">max 2 · MJV Services OPC management</span></h3>${sslot(0, 'Super Admin 1')}${sslot(1, 'Super Admin 2')}</div>
    ${D.businesses.map((z, i) => { z.platformFee = z.platformFee || { type: 'percent', value: 0 }; const u = users(z.id), rows = u.concat(Array.from({ length: Math.min(AD.extra[z.id] || (u.length ? 0 : 1), Rules.MAX_PER_BUSINESS - u.length) }, () => ({ role: u.some(x => x.role === 'manager') ? 'staff' : 'manager' })));
      return `<div class="acard"><h3>${esc(z.name)} <button class="xbtn" onclick="admDelBiz(${i})">${ic('x')}</button></h3>${aIn(`businesses.${i}.active`, 'Active', 'bool')}
      <div class="agrid">${aIn(`businesses.${i}.name`, 'Business name')}<div class="field"><label>Type</label><select data-b="businesses.${i}.type">${Rules.BIZ_TYPES.map(t => `<option value="${t[0]}" ${t[0] === z.type ? 'selected' : ''}>${t[1]}</option>`).join('')}</select></div>${aTown(`businesses.${i}.town`)}${aIn(`businesses.${i}.email`, 'Notification email')}${aIn(`businesses.${i}.phone`, 'Phone')}</div>
      <div class="feebox"><span class="lbl">Platform fee</span><div class="agrid"><div class="field"><label>Type</label><select data-b="businesses.${i}.platformFee.type"><option value="percent" ${z.platformFee.type !== 'fixed' ? 'selected' : ''}>Percentage</option><option value="fixed" ${z.platformFee.type === 'fixed' ? 'selected' : ''}>Fixed per transaction</option></select></div>${aIn(`businesses.${i}.platformFee.value`, z.platformFee.type === 'fixed' ? 'Amount (P)' : 'Percent (%)', 'num')}</div><p class="hint">Applies to new transactions. Existing ones keep the fee they were booked with (editable per transaction).</p></div>
      <div class="mt">${aIn(`businesses.${i}.acceptCodes`, 'Accepts discount codes (the merchant can also switch this)', 'bool')}${aIn(`businesses.${i}.loyverseAllowed`, 'Allow Loyverse POS link for reward points', 'bool')}</div>
      <div class="bankbox"><span class="lbl">Payout account</span>${bankText(pay['biz:' + z.id])} <button class="link" onclick="AD.po.party='biz:${z.id}';AD.po.sel={};setTab('payouts')">Edit in Payouts</button></div>
      <div class="field mt"><label>Merchant users <span class="hint">up to ${Rules.MAX_PER_BUSINESS}, any mix of Merchant Admin and Merchant Staff · the same email can be added to other businesses too · ID: ${esc(z.id)}</span></label></div>${rows.map((x, k) => mslot(z.id, k, x)).join('')}
      ${rows.length < Rules.MAX_PER_BUSINESS ? `<button class="btn ghost sm mt" onclick="addUser('${z.id}')">${ic('plus')} Add user</button>` : ''}</div>`; }).join('')}
    <button class="btn ghost" onclick="admAddBiz()">Add business</button>
    <div class="acard mt"><h3><span class="hl">${ic('bike')} Delivery riders</span></h3><p class="meta">${riderList().length} riders. Add riders, check driver's licenses and payout accounts in the <button class="link" onclick="setTab('riders')">Riders</button> tab.</p></div>
    <div class="savebar show"><span>Save businesses, fees and user access</span><div style="display:flex;gap:8px"><button class="btn ghost sm" onclick="AD.staff=clone(AD.data.staff);AD.extra={};admDiscard()">Discard</button><button class="btn sm" onclick="saveBiz()">Save</button></div></div>`);
}
function addUser(id) { AD.staff = readStaff(); AD.extra[id] = (AD.extra[id] || 0) + 1; admDirty(); vBiz(); }
function rmUser(id, idx) {
  AD.staff = readStaff(); const u = AD.staff.filter(s => (s.role === 'manager' || s.role === 'staff') && s.bizId === id);
  if (u[idx]) AD.staff = AD.staff.filter(s => s !== u[idx]); else AD.extra[id] = Math.max(0, (AD.extra[id] || 1) - 1);
  admDirty(); vBiz();
}
function readStaff() {
  const v = {}, out = [];
  document.querySelectorAll('[data-u]').forEach(i => { const [kind, bizId, idx, k] = i.dataset.u.split('|'), key = kind + '|' + bizId + '|' + idx; (v[key] = v[key] || { role: kind === 'm' ? 'manager' : kind, bizId }); v[key][k] = i.value.trim(); });
  Object.values(v).forEach(u => { if (u.email) { const old = AD.staff.find(s => s.email === u.email.toLowerCase()) || {}; out.push({ email: u.email.toLowerCase(), name: u.name || '', role: u.role, bizId: u.role === 'super' ? '' : u.bizId, phone: old.phone || '' }); } });
  AD.staff.filter(s => s.role === 'rider' && !out.some(o => o.email === s.email)).forEach(r => out.push({ email: r.email, name: r.name, role: 'rider', bizId: '', phone: r.phone || '' }));
  return out;
}
async function saveBiz() {
  const staff = readStaff(), err = Rules.staffCheck(staff); if (err) { toast(err); return; }
  if (!staff.some(s => s.role === 'super')) { toast('Keep at least one Super Admin.'); return; }
  loading(true, 'Saving…');
  try { await api('saveCatalog', { token: ADM.token, catalog: ADM.draft }); await api('adminSaveStaff', { token: ADM.token, staff }); CAT = clone(ADM.draft); window.CAT_SAVED = true; ADM.dirty = false; ADM.edited = false; AD.extra = {}; await reload(true); loading(false); toast('Saved'); renderPortal(); }
  catch (x) { loading(false); toast(x.message); }
}
function admAddBiz() { let i = 1; while (ADM.draft.businesses.some(b => b.id === 'business-' + i)) i++; ADM.draft.businesses.push({ id: 'business-' + i, name: 'New business', type: 'Stay', town: 'San Agustin', email: '', phone: '', active: false, platformFee: { type: 'percent', value: 10 } }); admDirty(); vBiz(); }
function admDelBiz(i) {
  const z = ADM.draft.businesses[i], used = ADM.draft.stays.some(s => s.bizId === z.id) || ADM.draft.rentals.units.some(u => u.bizId === z.id) || ADM.draft.foods.some(f => f.bizId === z.id) || ADM.draft.tours.some(t => t.bizId === z.id);
  if (used) { toast('Reassign or remove its listings first.'); return; }
  ADM.draft.businesses.splice(i, 1); AD.staff = AD.staff.filter(s => s.bizId !== z.id); admDirty(); vBiz();
}

/* ---- Listings & rates ---- */
function vListings() {
  const subs = [['stays', 'Stays'], ['rentals', 'Rentals'], ['food', 'Food'], ['delivery', 'Delivery fees'], ['tours', 'Tours'], ['services', 'Other Services'], ['business', 'App details & policies']];
  P(`${window.CAT_SAVED ? '' : '<div class="warn">First time here: these are sample rates and menu items. Update them, then tap Save changes to open bookings.</div>'}
    <div class="atabs">${subs.map(t => `<button class="${ADM.tab === t[0] ? 'on' : ''}" onclick="ADM.tab='${t[0]}';vListings()">${t[1]}</button>`).join('')}</div>
    <div id="admTab">${admTabHtml()}</div>
    <div class="savebar ${ADM.dirty ? 'show' : ''}" id="saveBar"><span>Unsaved changes</span><div style="display:flex;gap:8px"><button class="btn ghost sm" onclick="admDiscard()">Discard</button><button class="btn sm" onclick="admSave()">Save changes</button></div></div>`);
  if (ADM.tab === 'delivery') setTimeout(admMap, 50);
}

/* ---- Payouts: bank details per business / rider, net of cash they already hold ---- */
function partyName(party) { const id = party.slice(party.indexOf(':') + 1); return party.startsWith('biz:') ? bizName(id) : ((riderList().find(r => r.email === id) || {}).name || id); }
function payable(party) {
  const id = party.slice(party.indexOf(':') + 1), st = ST();
  return AD.data.bookings.filter(b => party.startsWith('biz:') ? b.bizId === id && Rules.bizPayable(b) : b.rider === id && Rules.riderPayable(b))
    .sort((a, b) => a.ref.localeCompare(b.ref)).map(b => ({ b, L: Rules.ledger(b, st) }));
}
function outstanding() {
  return CAT.businesses.map(z => 'biz:' + z.id).concat(riderList().map(r => 'rider:' + r.email)).map(p => { const l = payable(p), biz = p.startsWith('biz:'); return { p, n: l.length, net: Rules.r2(l.reduce((t, x) => t + (biz ? x.L.bizNet : x.L.riderNet), 0)) }; });
}
function vPayouts() {
  const po = AD.po, pay = AD.data.payees || {}, out = outstanding(), biz = po.party.startsWith('biz:');
  const opt = p => { const o = out.find(x => x.p === p) || { n: 0, net: 0 }; return `<option value="${esc(p)}" ${po.party === p ? 'selected' : ''}>${esc(partyName(p))}${o.n ? ' · ' + o.n + ' to settle (' + (o.net >= 0 ? peso(o.net) : '-' + peso(-o.net)) + ')' : ''}</option>`; };
  let h = `<div class="acard"><div class="field"><label>Business or rider</label><select id="poP"><option value="">Choose…</option><optgroup label="Businesses">${CAT.businesses.map(z => opt('biz:' + z.id)).join('')}</optgroup><optgroup label="Riders">${riderList().map(r => opt('rider:' + r.email)).join('')}</optgroup></select></div>
    <p class="hint">Net payout = non-cash payments Tara Romblon collected for them (HitPay and transfers${ST().codCashTo === 'tara' ? ', plus COD cash riders remitted to Tara' : ''}) − platform fees − cash they collected and kept. A negative amount is cash they should remit to Tara Romblon. Businesses are settled once a transaction is Completed; riders once delivered.</p></div>`;
  if (po.party) {
    const b = pay[po.party] || {}, list = payable(po.party), sel = list.filter(x => po.sel[x.b.ref] !== false);
    const S = k => Rules.r2(sel.reduce((t, x) => t + x.L[k], 0)), adj = +po.adj || 0;
    const net = Rules.r2((biz ? S('bizNet') : S('riderNet')) + adj);
    h += `<div class="acard"><h3>${esc(partyName(po.party))} <span class="hint">${biz ? 'Business' : 'Rider'}</span></h3>
      <div class="bankbox"><span class="lbl">Payout account (editable)</span><div class="row2"><div class="field"><label>Account name</label><input id="bkN" value="${esc(b.accountName || '')}"></div><div class="field"><label>Bank / e-wallet</label><input id="bkB" value="${esc(b.bank || '')}" list="bankList"></div></div>
        <div class="row2"><div class="field"><label>Account number</label><input id="bkA" value="${esc(b.accountNo || '')}"></div><div class="field"><label>Notes</label><input id="bkX" value="${esc(b.notes || '')}" placeholder="e.g. send every Friday"></div></div>
        <datalist id="bankList">${['BDO', 'BPI', 'Landbank', 'Metrobank', 'PNB', 'Security Bank', 'UnionBank', 'RCBC', 'China Bank', 'GCash', 'Maya'].map(x => `<option>${x}</option>`).join('')}</datalist>
        <button class="btn ghost sm mt" id="bkSave">Save account details</button>${b.updated ? ` <span class="hint">updated ${dt(b.updated)}</span>` : ''}</div>
      <h3 class="mt">Transactions to settle <span class="hint">${list.length}</span></h3>
      ${list.length ? `<label class="check"><input type="checkbox" id="poAll" ${sel.length === list.length ? 'checked' : ''}><span>Select all</span></label>` : ''}
      <p class="hint">Sorted by transaction code. Untick a transaction to leave it out of this payout (it stays unsettled). Tap a code to see the transaction.</p>
      ${list.map(x => { const L = x.L, n = biz ? L.bizNet : L.riderNet; return `<div class="poline"><input type="checkbox" data-po="${esc(x.b.ref)}" ${po.sel[x.b.ref] !== false ? 'checked' : ''}><div>${refLink(x.b.ref)} <span class="hint">${dOnly(x.b.created)} · ${esc(x.b.kind)} · ${esc(Rules.PAY_LABEL[x.b.payMethod])}</span><br><span class="hint">${biz ? `Sale ${peso(L.gross - L.discount)} · non-cash ${peso(L.taraBiz)} · cash ${L.cashRecorded ? 'recorded' : 'expected'} ${peso(L.cashBiz)}${L.cashRecorded && L.cashBiz !== L.cashExpected ? ' (expected ' + peso(L.cashExpected) + ')' : ''} · fee ${peso(L.fee)}` : `Delivery fee share ${peso(L.riderShare)} · COD cash kept ${peso(L.riderCash)}`}</span></div><b class="${n < 0 ? 'neg' : ''}">${n < 0 ? '-' + peso(-n) : peso(n)}</b></div>`; }).join('') || '<div class="empty">Nothing to settle right now.</div>'}
      <div class="row2 mt"><div class="field"><label>Adjustment (P, use minus to deduct)</label><input id="poAdj" type="number" step="any" value="${esc(po.adj)}" placeholder="0"></div><div class="field"><label>Adjustment reason</label><input id="poAdjN" value="${esc(po.adjNote)}" placeholder="e.g. damaged item refund"></div></div>
      <div class="potot">${biz ? `<div><span>Non-cash collected by Tara Romblon</span><b>${peso(S('taraBiz'))}</b></div><div><span>Cash collected by the business</span><b>${peso(S('cashBiz'))}</b></div><div><span>Platform fees</span><b>-${peso(S('fee'))}</b></div>`
        : `<div><span>Delivery fee share earned</span><b>${peso(S('riderShare'))}</b></div><div><span>COD cash kept by rider</span><b>-${peso(S('riderCash'))}</b></div>`}
        ${adj ? `<div><span>Adjustment</span><b>${adj < 0 ? '-' + peso(-adj) : peso(adj)}</b></div>` : ''}
        <div class="big"><span>${net >= 0 ? 'Net payout to send' : 'Amount to collect from ' + (biz ? 'business' : 'rider')}</span><span class="${net < 0 ? 'neg' : ''}">${peso(Math.abs(net))}</span></div></div>
      <div class="row2 mt"><div class="field"><label>Method</label><select id="poM">${['Bank transfer', 'GCash', 'Maya', 'Cash', 'Offset'].map(m => `<option ${po.method === m ? 'selected' : ''}>${m}</option>`).join('')}</select></div><div class="field"><label>Reference no.</label><input id="poR" value="${esc(po.reference)}"></div></div>
      <div class="field mt"><label>Note</label><input id="poN" value="${esc(po.note)}"></div>
      <button class="btn full mt" id="poGo" ${sel.length || adj ? '' : 'disabled'}>${net >= 0 ? 'Record payout of ' + peso(net) : 'Record collection of ' + peso(-net)}</button></div>`;
    const id = po.party.slice(po.party.indexOf(':') + 1), done = AD.data.bookings.filter(b => biz ? b.bizId === id && b.bizPaidAt : b.rider === id && b.riderPaidAt).sort((a, b) => b.ref.localeCompare(a.ref)).slice(0, 40);
    h += `<div class="acard"><h3>Paid out <span class="hint">${done.length} transaction${done.length === 1 ? '' : 's'}</span></h3>${done.map(b => { const L = Rules.ledger(b, ST()), n = biz ? L.bizNet : L.riderNet; return `<div class="poline"><span>${ic('check', 16)}</span><div>${refLink(b.ref)} <span class="paidtag">Paid out ${esc(biz ? b.bizPayout || '' : b.riderPayout || '')}</span><br><span class="hint">${dOnly(b.created)} · settled ${dOnly(biz ? b.bizPaidAt : b.riderPaidAt)}</span></div><b class="${n < 0 ? 'neg' : ''}">${n < 0 ? '-' + peso(-n) : peso(n)}</b></div>`; }).join('') || '<p class="meta">Nothing paid out yet.</p>'}</div>`;
  }
  const hist = (AD.data.payouts || []).slice().sort((a, b) => b.at.localeCompare(a.at));
  h += `<div class="acard"><h3>Payout history <span class="hint">${hist.length}</span></h3><div class="tscroll"><table class="btable"><tr><th>Ref</th><th>Date</th><th>To / from</th><th>Transactions</th><th>Net</th><th>Account</th><th>Method</th></tr>
    ${hist.map(x => `<tr><td>${esc(x.id)}<br><span class="hint">${x.refs.map(refLink).join(' ')}</span></td><td>${dOnly(x.at)}</td><td>${esc(x.name)}</td><td>${x.refs.length}</td><td class="${x.net < 0 ? 'neg' : ''}"><b>${x.net < 0 ? '-' + peso(-x.net) : peso(x.net)}</b></td><td>${x.bank && x.bank.accountNo ? esc(x.bank.bank + ' ' + x.bank.accountNo) : '-'}</td><td>${esc(x.method || '')}${x.reference ? '<br><span class="hint">' + esc(x.reference) + '</span>' : ''}</td></tr>`).join('') || '<tr><td colspan="7">No payouts recorded yet.</td></tr>'}</table></div>
    <div class="rowbtns mt"><button class="btn ghost sm" id="poDl">Download payout history CSV</button><button class="btn ghost sm" id="poOut">Download outstanding balances CSV</button></div></div>`;
  P(h);
  $('#poP').onchange = e => { AD.po = { party: e.target.value, sel: {}, adj: '', adjNote: '', method: 'Bank transfer', reference: '', note: '' }; vPayouts(); };
  const keep = () => { if (!$('#poAdj')) return; Object.assign(AD.po, { adj: $('#poAdj').value, adjNote: $('#poAdjN').value, method: $('#poM').value, reference: $('#poR').value, note: $('#poN').value }); };
  document.querySelectorAll('[data-po]').forEach(c => c.onchange = () => { keep(); AD.po.sel[c.dataset.po] = c.checked; vPayouts(); });
  if ($('#poAll')) $('#poAll').onchange = e => { keep(); payable(po.party).forEach(x => AD.po.sel[x.b.ref] = e.target.checked); vPayouts(); };
  if ($('#poAdj')) $('#poAdj').onchange = () => { keep(); vPayouts(); };
  if ($('#bkSave')) $('#bkSave').onclick = async () => { try { await api('adminSavePayee', { token: ADM.token, party: po.party, bank: { accountName: $('#bkN').value, bank: $('#bkB').value, accountNo: $('#bkA').value, notes: $('#bkX').value } }); toast('Account details saved'); keep(); await reload(true); vPayouts(); } catch (x) { toast(x.message); } };
  if ($('#poGo')) $('#poGo').onclick = () => { keep(); const refs = payable(po.party).filter(x => AD.po.sel[x.b.ref] !== false).map(x => x.b.ref);
    openSheet(`<div class="sbody"><h2>Record this ${$('#poGo').textContent.includes('collection') ? 'collection' : 'payout'}?</h2><p class="meta">${esc(partyName(po.party))} · ${refs.length} transaction(s). They will be marked settled and notified.</p><div class="row2 mt"><button class="btn ghost" onclick="closeSheet()">Back</button><button class="btn" id="poYes">Yes, record it</button></div></div>`);
    $('#poYes').onclick = async () => { loading(true, 'Recording…'); try { const r = await api('adminPayout', { token: ADM.token, party: po.party, refs, adjustment: +AD.po.adj || 0, adjustmentNote: AD.po.adjNote, method: AD.po.method, reference: AD.po.reference, note: AD.po.note }); await reload(true); loading(false); closeSheet(); toast('Recorded ' + r.payout.id); AD.po = { party: po.party, sel: {}, adj: '', adjNote: '', method: 'Bank transfer', reference: '', note: '' }; vPayouts(); } catch (x) { loading(false); toast(x.message); } };
  };
  $('#poDl').onclick = () => downloadCSV('payouts-' + today + '.csv', [['Ref', 'Date', 'Party', 'Name', 'Transactions', 'Non-cash', 'Cash kept', 'Platform fees', 'Rider share', 'Adjustment', 'Net', 'Direction', 'Account name', 'Bank', 'Account no.', 'Method', 'Reference', 'Note'], ...hist.map(x => [x.id, x.at, x.party, x.name, x.refs.join(' '), x.nonCash, x.cash, x.fees, x.earned, x.adjustment, x.net, x.direction, (x.bank || {}).accountName || '', (x.bank || {}).bank || '', (x.bank || {}).accountNo || '', x.method || '', x.reference || '', x.note || ''])]);
  $('#poOut').onclick = () => downloadCSV('outstanding-' + today + '.csv', [['Party', 'Name', 'Transactions to settle', 'Net (positive = pay out, negative = collect)', 'Account name', 'Bank', 'Account no.'], ...out.map(o => { const b = pay[o.p] || {}; return [o.p, partyName(o.p), o.n, o.net, b.accountName || '', b.bank || '', b.accountNo || '']; })]);
}

/* ---- Discount codes (only Super Admins create them; merchants can switch acceptance off) ---- */
function vDiscounts() {
  if (!AD.dc) AD.dc = clone(AD.data.discounts || []);
  const L = AD.dc, uses = c => { const g = {}; AD.data.bookings.filter(b => b.code && b.code.code === c && !Rules.FREE.includes(b.status)).forEach(b => { g[b.group] = (g[b.group] || 0) + b.code.amount; }); return { n: Object.keys(g).length, amt: Rules.r2(Object.values(g).reduce((t, v) => t + v, 0)) }; };
  const f = (i, k, label, type, extra) => `<div class="field"><label>${label}</label><input data-dc="${i}|${k}" ${type ? 'type="' + type + '"' : ''} ${extra || ''} value="${esc(L[i][k] == null ? '' : L[i][k])}"></div>`;
  P(`<p class="meta" style="margin-bottom:12px">Customers enter these codes at checkout and the discount is computed automatically. Merchants can turn off code acceptance for their business in Store settings.</p>
    ${L.map((d, i) => { const u = uses(d.code), sel = d.bizIds || []; return `<div class="acard"><h3>${esc(d.code || 'NEW CODE')} ${d.active === false ? '<span class="schip bad">Off</span>' : '<span class="schip done">Active</span>'} <span class="hint">${u.n} use${u.n === 1 ? '' : 's'} · ${peso(u.amt)} off</span><button class="xbtn" title="Delete" onclick="AD.dc.splice(${i},1);admDirty();vDiscounts()">${ic('x')}</button></h3>
      <label class="tog"><input type="checkbox" data-dc="${i}|active" ${d.active === false ? '' : 'checked'}> Active</label>
      <div class="agrid mt">${f(i, 'code', 'Discount code *', '', 'style="text-transform:uppercase"')}${f(i, 'name', 'Name')}
        <div class="field"><label>Discount type</label><select data-dc="${i}|type"><option value="percent" ${d.type !== 'fixed' ? 'selected' : ''}>Percentage of order total</option><option value="fixed" ${d.type === 'fixed' ? 'selected' : ''}>Fixed amount (P)</option></select></div>
        ${f(i, 'value', d.type === 'fixed' ? 'Amount (P) *' : 'Percent (%) *', 'number', 'min="0" step="any"')}${f(i, 'maxDiscount', 'Maximum discount (P, optional)', 'number', 'min="0" step="any"')}${f(i, 'minOrder', 'Minimum order (P, optional)', 'number', 'min="0" step="any"')}
        ${f(i, 'maxUses', 'Total uses allowed (0 = no limit)', 'number', 'min="0" step="1"')}${f(i, 'validFrom', 'Valid from', 'date')}${f(i, 'validTo', 'Valid until', 'date')}
        <div class="field"><label>Discount is paid by</label><select data-dc="${i}|fundedBy"><option value="merchant" ${d.fundedBy !== 'tara' ? 'selected' : ''}>The merchant (less from their sales)</option><option value="tara" ${d.fundedBy === 'tara' ? 'selected' : ''}>Tara Romblon (merchant is paid in full)</option></select></div></div>
      <div class="field mt"><label>Short description (shown to customers)</label><input data-dc="${i}|desc" value="${esc(d.desc || '')}" maxlength="240"></div>
      <div class="field mt"><label>Businesses included</label><details class="bizpick"><summary>${sel.length ? esc(sel.map(bizName).join(', ')) : 'All businesses'}</summary><div class="chips">${CAT.businesses.map(z => `<label><input type="checkbox" data-dcb="${i}|${z.id}" ${sel.includes(z.id) ? 'checked' : ''}> ${esc(z.name)}${z.acceptCodes === false ? ' <span class="hint">(codes off)</span>' : ''}</label>`).join('')}</div></details><span class="hint">Leave all unticked to include every business.</span></div>
      <label class="tog mt"><input type="checkbox" data-dc="${i}|onePerCustomer" ${d.onePerCustomer ? 'checked' : ''}> One use per customer</label></div>`; }).join('') || '<div class="empty">No discount codes yet.</div>'}
    <button class="btn ghost" onclick="AD.dc.push({code:'',name:'',desc:'',type:'percent',value:10,bizIds:[],minOrder:0,maxDiscount:0,maxUses:0,onePerCustomer:false,fundedBy:'merchant',validFrom:'',validTo:'',active:true});admDirty();vDiscounts()">${ic('plus')} Add discount code</button>
    <div class="savebar ${ADM.dirty ? 'show' : ''}" id="saveBar"><span>Unsaved changes</span><div style="display:flex;gap:8px"><button class="btn ghost sm" onclick="AD.dc=null;ADM.dirty=false;ADM.edited=false;vDiscounts()">Discard</button><button class="btn sm" id="dcSave">Save codes</button></div></div>`);
  document.querySelectorAll('[data-dc]').forEach(x => x.oninput = x.onchange = () => { const [i, k] = x.dataset.dc.split('|'); L[+i][k] = x.type === 'checkbox' ? x.checked : x.type === 'number' ? (x.value === '' ? 0 : +x.value) : k === 'code' ? x.value.toUpperCase().replace(/\s+/g, '') : x.value; admDirty(); if (x.tagName === 'SELECT') vDiscounts(); });
  document.querySelectorAll('[data-dcb]').forEach(x => x.onchange = () => { const [i, id] = x.dataset.dcb.split('|'), d = L[+i]; d.bizIds = (d.bizIds || []).filter(b => b !== id).concat(x.checked ? [id] : []); admDirty(); x.closest('details').querySelector('summary').textContent = d.bizIds.length ? d.bizIds.map(bizName).join(', ') : 'All businesses'; });
  $('#dcSave').onclick = async () => { loading(true, 'Saving…'); try { const r = await api('adminSaveDiscounts', { token: ADM.token, discounts: L }); AD.data.discounts = r.discounts; AD.dc = null; ADM.dirty = false; ADM.edited = false; loading(false); toast('Discount codes saved'); vDiscounts(); } catch (x) { loading(false); toast(x.message); } };
}

/* ---- Settings (uploads, verification, payments, notifications) ---- */
function vSettings() {
  const st = ADM.draft.settings = Object.assign({}, DEFAULT_SETTINGS, ADM.draft.settings || {}); st.email = Object.assign({}, DEFAULT_SETTINGS.email, st.email || {});
  const three = (path, v) => `<div class="seg">${[['required', 'Required'], ['optional', 'Optional'], ['off', 'Off']].map(o => `<button type="button" class="${v === o[0] ? 'on' : ''}" data-set="${path}" data-val="${o[0]}">${o[1]}</button>`).join('')}</div>`;
  P(`<div class="acard"><h3><span class="hl">${ic('home')} Open to customers</span></h3>${aIn('settings.staysLive', 'Stays are open for booking (off = shown as Coming soon)', 'bool')}${aIn('settings.toursLive', 'Things to do (tours & services) are open for booking (off = shown as Coming soon)', 'bool')}<p class="hint">Food and Rentals are always open. Turn these on when the listings are ready, then Save.</p></div>
    <div class="acard"><h3><span class="hl">${ic('id')} Customer verification</span></h3>${aIn('settings.requireIdVerification', 'Require an approved ID before a customer\'s first stay or rental booking', 'bool')}<p class="hint">Customers upload an ID once; Super Admins approve it in Customers.</p></div>
    <div class="acard"><h3><span class="hl">${ic('upload')} Photo uploads at checkout</span></h3><div class="field mt"><label>Valid ID photo (stays & rentals)</label></div>${three('settings.idUploadAtCheckout', st.idUploadAtCheckout)}
      <div class="field mt"><label>Payment proof (bank / e-wallet transfers)</label></div>${three('settings.proofUpload', st.proofUpload)}</div>
    <div class="acard"><h3><span class="hl">${ic('wallet')} Payments</span></h3>${aIn('settings.transferEnabled', 'Offer bank / e-wallet transfer with proof (in addition to HitPay)', 'bool')}${aIn('settings.transferInstructions', 'Transfer instructions shown to customers', 'textarea', 3)}<div class="agrid mt">${aIn('business.downpaymentPct', 'Downpayment for stays & rentals (%)', 'num')}</div></div>
    <div class="acard"><h3><span class="hl">${ic('bike')} Delivery fee</span></h3><div class="agrid">${aIn('settings.delivery.freeKm', 'Free within (km of the store)', 'num')}${aIn('settings.delivery.perKm', 'Delivery fee per km after that (₱, each started km)', 'num')}${aIn('settings.delivery.customerPct', 'Customer pays (% of the fee; the store pays the rest)', 'num')}${aIn('settings.delivery.baseFee', 'Within the free distance, the store pays the rider (₱)', 'num')}${aIn('settings.delivery.maxKm', 'Longest delivery (km), unless a store sets its own', 'num')}</div>
      <p class="hint">The rider earns the whole fee. Example with the defaults: 3.2 km → 2 started km after 1.5 km → ₱20 fee: customer ₱14, store ₱6, rider ₱20. Within 1.5 km: customer ₱0, store ₱20, rider ₱20. Empty = default (1.5 km · ₱10/km · 70% · ₱20 · 10 km).</p></div>
    <div class="acard"><h3><span class="hl">${ic('bike')} Riders</span></h3><div class="agrid">${aIn('settings.riderSharePct', 'Rider share of the delivery fee for older orders only (%)', 'num')}</div>
      <div class="field mt"><label>Cash collected by riders on COD orders goes to</label></div><div class="seg">${[['merchant', 'The merchant'], ['tara', 'Tara Romblon']].map(o => `<button type="button" class="${(st.codCashTo || 'merchant') === o[0] ? 'on' : ''}" data-set="settings.codCashTo" data-val="${o[0]}">${o[1]}</button>`).join('')}</div>
      <p class="hint">The merchant: the rider hands the food amount to the merchant and keeps the delivery fee. Tara Romblon: the rider remits all COD cash to Tara Romblon, which then pays the merchant through Payouts.</p></div>
    <div class="acard"><h3><span class="hl">${ic('bell')} Email notifications</span></h3><p class="hint">In-app notifications are always on. Email copies go to:</p>${aIn('settings.email.customers', 'Customers (bookings, status updates, messages, verification)', 'bool')}${aIn('settings.email.merchants', 'Merchants (new orders, payments, messages)', 'bool')}${aIn('settings.email.admins', 'Super Admins (new transactions, applications, ID reviews)', 'bool')}${aIn('settings.email.riders', 'Riders (assignments, ready for pick-up)', 'bool')}
      <p class="hint mt">Emails are sent through Resend. The free plan allows 100 emails a day and 3,000 a month; turn off groups you don't need if you reach the limit.</p></div>
    <div class="savebar ${ADM.dirty ? 'show' : ''}" id="saveBar"><span>Unsaved changes</span><div style="display:flex;gap:8px"><button class="btn ghost sm" onclick="admDiscard()">Discard</button><button class="btn sm" onclick="admSave()">Save changes</button></div></div>`);
  document.querySelectorAll('[data-set]').forEach(b => b.onclick = () => { setP(ADM.draft, b.dataset.set, b.dataset.val); admDirty(); vSettings(); });
}

/* ---- Reports: sales, platform fees, remittance, riders ---- */
function vReports() {
  const r = AD.r, B = AD.data.bookings.filter(b => inRange(b, r.from, r.to) && (!r.biz || b.bizId === r.biz));
  const conf = B.filter(Rules.confirmed), biz = r.biz ? CAT.businesses.filter(z => z.id === r.biz) : CAT.businesses;
  const rows = biz.map(z => { const mine = B.filter(b => b.bizId === z.id), M = mine.filter(Rules.confirmed).map(Rules.money), s = k => M.reduce((t, m) => t + m[k], 0);
    return { z, n: M.length, gross: s('gross'), disc: s('discount'), fee: s('fee'), net: s('net'), del: s('delivery'), online: s('collectedOnline'), remit: s('remit'), canc: mine.filter(b => ['Cancelled', 'Rejected', 'Refunded'].includes(b.status)).length }; });
  const T = k => rows.reduce((t, x) => t + x[k], 0);
  const rem = conf.filter(b => Rules.NONCASH.includes(b.payMethod) && Rules.money(b).collectedOnline);
  const months = {}; conf.forEach(b => { const m = b.created.slice(0, 7), x = Rules.money(b); months[m] = months[m] || { n: 0, g: 0, f: 0 }; months[m].n++; months[m].g += x.gross; months[m].f += x.fee; });
  const st = ST(), riders = riderList().map(rd => { const l = B.filter(b => b.rider === rd.email && Rules.DELIVERED.includes(b.status)).map(b => ({ b, L: Rules.ledger(b, st) })), un = l.filter(x => !x.b.riderPaidAt);
    return { rd, n: l.length, earned: Rules.r2(l.reduce((t, x) => t + x.L.riderShare, 0)), cash: Rules.r2(l.reduce((t, x) => t + x.L.riderCash, 0)), due: Rules.r2(un.reduce((t, x) => t + x.L.riderNet, 0)) }; });
  const cashRows = biz.map(z => { const l = conf.filter(b => b.bizId === z.id).map(b => Rules.ledger(b, st)); let cash = 0, tara = 0, feeCash = 0, feeNon = 0, rec = 0, recN = 0;
    l.forEach(L => { const due = L.gross - L.discount, sh = due > 0 ? Math.min(1, L.cashBiz / due) : 0; cash += L.cashBiz; tara += L.taraBiz; feeCash += L.fee * sh; feeNon += L.fee * (1 - sh); if (L.cashRecorded) { rec += L.cashBiz; recN++; } });
    return { z, cash: Rules.r2(cash), rec: Rules.r2(rec), recN, open: AD.data.bookings.filter(b => b.bizId === z.id && Rules.bizPayable(b)).length, tara: Rules.r2(tara), feeCash: Rules.r2(feeCash), feeNon: Rules.r2(feeNon), net: Rules.r2(tara - feeCash - feeNon) }; });
  const CT = k => Rules.r2(cashRows.reduce((t, x) => t + x[k], 0));
  window._report = { rows, rem, months, riders, cashRows };
  P(`<div class="filters2 noprint"><label>From <input type="date" id="rfrom" value="${r.from}"></label><label>To <input type="date" id="rto" value="${r.to}"></label>
    <select id="rbiz"><option value="">All businesses</option>${CAT.businesses.map(z => `<option value="${z.id}" ${r.biz === z.id ? 'selected' : ''}>${esc(z.name)}</option>`).join('')}</select></div>
    <div class="rowbtns noprint"><button class="btn sm" onclick="downloadReport()">Download report CSV</button><button class="btn ghost sm" onclick="downloadRemit()">Remittance CSV</button><button class="btn ghost sm" onclick="window.print()">Print / save PDF</button><button class="btn ghost sm" onclick="exportBookings(AD.data.bookings)">All transactions CSV</button></div>
    <div class="report"><h2>Report ${r.from || r.to ? '· ' + (r.from ? dOnly(r.from) : 'start') + ' to ' + (r.to ? dOnly(r.to) : 'today') : '· all time'}</h2><p class="meta">MJV Services OPC · generated ${dt(new Date().toISOString())}</p>
    <div class="acard"><h3>Sales and platform fees by business</h3><div class="tscroll"><table class="btable"><tr><th>Business</th><th>Platform fee</th><th>Confirmed</th><th>Gross</th><th>Discounts</th><th>Platform fees to collect</th><th>Net to merchant</th><th>Cancelled</th></tr>
      ${rows.map(x => `<tr><td>${esc(x.z.name)}</td><td>${esc(feeText(x.z.platformFee))}</td><td>${x.n}</td><td>${peso(x.gross)}</td><td>${peso(x.disc)}</td><td><b>${peso(x.fee)}</b></td><td>${peso(x.net)}</td><td>${x.canc}</td></tr>`).join('')}
      <tr class="tot"><td>Total</td><td></td><td>${T('n')}</td><td>${peso(T('gross'))}</td><td>${peso(T('disc'))}</td><td>${peso(T('fee'))}</td><td>${peso(T('net'))}</td><td>${T('canc')}</td></tr></table></div>
      <p class="hint mt">Platform fees from cash transactions (COD, pay on pick-up, balances paid at the venue) are collected from the merchant; fees on online payments are deducted from the remittance.</p></div>
    <div class="acard"><h3>Remittance per business — HitPay and other non-cash payments</h3><div class="tscroll"><table class="btable"><tr><th>Business</th><th>Transactions</th><th>Received online (gross)</th><th>Delivery fees</th><th>Discounts</th><th>Platform fees</th><th>Net remittance</th></tr>
      ${biz.map(z => { const l = rem.filter(b => b.bizId === z.id).map(Rules.money), s = k => l.reduce((t, m) => t + m[k], 0); return `<tr><td>${esc(z.name)}</td><td>${l.length}</td><td>${peso(s('collectedOnline'))}</td><td>${peso(l.reduce((t, m, i) => t + (rem.filter(b => b.bizId === z.id)[i].kind === 'food' ? m.delivery : 0), 0))}</td><td>${peso(s('discount'))}</td><td>${peso(s('fee'))}</td><td><b>${peso(s('remit'))}</b></td></tr>`; }).join('')}</table></div>
      <details class="mt"><summary class="link">Show each transaction</summary><div class="tscroll"><table class="btable"><tr><th>Ref</th><th>Date</th><th>Business</th><th>Payment</th><th>Gross</th><th>Discount</th><th>Fee</th><th>Net</th><th>Received</th><th>Remit</th></tr>
        ${rem.map(b => { const m = Rules.money(b); return `<tr><td>${esc(b.ref)}</td><td>${dOnly(b.created)}</td><td>${esc(bizName(b.bizId))}</td><td>${esc(Rules.PAY_LABEL[b.payMethod])}</td><td>${peso(m.gross)}</td><td>${peso(m.discount)}</td><td>${peso(m.fee)}</td><td>${peso(m.net)}</td><td>${peso(m.collectedOnline)}</td><td>${peso(m.remit)}</td></tr>`; }).join('') || '<tr><td colspan="10">None</td></tr>'}</table></div></details>
      <p class="hint mt">Net remittance = received online − delivery fees (paid to riders) − discounts − platform fees. For stays and rentals only the downpayment is received online.</p></div>
    <div class="acard"><h3>Cash collected by merchants and amount to remit to Tara Romblon</h3><div class="tscroll"><table class="btable"><tr><th>Business</th><th>Platform fee</th><th>Cash collected by merchant</th><th>Recorded at Payment Collected</th><th>Platform fees on cash sales (to remit)</th><th>Non-cash held by Tara</th><th>Platform fees on non-cash</th><th>Net position</th><th class="noprint">Unsettled</th></tr>
      ${cashRows.map(x => `<tr><td>${esc(x.z.name)}</td><td>${esc(feeText(x.z.platformFee))}</td><td>${peso(x.cash)}</td><td>${peso(x.rec)}${x.recN ? '<br><span class="hint">' + x.recN + ' entr' + (x.recN === 1 ? 'y' : 'ies') + '</span>' : ''}</td><td><b>${peso(x.feeCash)}</b></td><td>${peso(x.tara)}</td><td>${peso(x.feeNon)}</td><td class="${x.net < 0 ? 'neg' : ''}"><b>${x.net < 0 ? 'Remits ' + peso(-x.net) : 'Tara pays ' + peso(x.net)}</b></td>
        <td class="noprint">${x.open ? `<button class="btn sm" onclick="AD.po.party='biz:${x.z.id}';AD.po.sel={};setTab('payouts')">Settle ${x.open} in Payouts</button>` : '<span class="hint">All settled</span>'}</td></tr>`).join('')}
      <tr class="tot"><td>Total</td><td></td><td>${peso(CT('cash'))}</td><td>${peso(CT('rec'))}</td><td>${peso(CT('feeCash'))}</td><td>${peso(CT('tara'))}</td><td>${peso(CT('feeNon'))}</td><td>${CT('net') < 0 ? 'Remits ' + peso(-CT('net')) : 'Tara pays ' + peso(CT('net'))}</td><td class="noprint"></td></tr></table></div>
      <details class="mt"><summary class="link">Show cash transactions (by transaction code)</summary><div class="tscroll"><table class="btable"><tr><th>Code</th><th>Business</th><th>Payment</th><th>Cash expected</th><th>Cash recorded</th><th>Platform fee</th><th>Status</th></tr>
        ${conf.filter(b => Rules.ledger(b, st).cashBiz > 0).sort((a, b) => a.ref.localeCompare(b.ref)).map(b => { const L = Rules.ledger(b, st); return `<tr><td>${refLink(b.ref)}</td><td>${esc(bizName(b.bizId))}</td><td>${esc(Rules.PAY_LABEL[b.payMethod])}</td><td>${peso(L.cashExpected)}</td><td>${L.cashRecorded ? peso(L.cashBiz) : '<span class="hint">not yet</span>'}</td><td>${peso(L.fee)}</td><td>${b.bizPaidAt ? `<span class="paidtag">Paid out ${esc(b.bizPayout || '')}</span>` : esc(b.status)}</td></tr>`; }).join('') || '<tr><td colspan="7">No cash transactions</td></tr>'}</table></div></details>
      <p class="hint mt">Cash = COD, pay on pick-up and balances paid at the venue${st.codCashTo === 'tara' ? ' (COD cash collected by riders goes to Tara Romblon, so it counts as non-cash here)' : ''}. Net position = non-cash held by Tara − all platform fees; a negative amount is what the merchant remits. Settle balances in <button class="link noprint" onclick="setTab('payouts')">Payouts</button>, where cash fees are deducted from non-cash payouts.</p></div>
    <div class="acard"><h3>By month (confirmed)</h3><table class="btable"><tr><th>Month</th><th>Transactions</th><th>Gross</th><th>Platform fees</th></tr>${Object.keys(months).sort().map(m => `<tr><td>${m}</td><td>${months[m].n}</td><td>${peso(months[m].g)}</td><td>${peso(months[m].f)}</td></tr>`).join('') || '<tr><td colspan="4">No data</td></tr>'}</table></div>
    <div class="acard"><h3><span class="hl">${ic('bike')} Rider delivery fees</span><span class="hint">${st.riderSharePct}% of delivery fee</span></h3><div class="tscroll"><table class="btable"><tr><th>Rider</th><th>Completed deliveries</th><th>Earned</th><th>COD cash kept</th><th>Unsettled net</th><th></th></tr>
      ${riders.map(x => `<tr><td>${esc(x.rd.name)}<br><span class="hint">${esc(x.rd.email)}</span></td><td>${x.n}</td><td>${peso(x.earned)}</td><td>${peso(x.cash)}</td><td class="${x.due < 0 ? 'neg' : ''}"><b>${x.due < 0 ? 'Collect ' + peso(-x.due) : peso(x.due)}</b></td><td>${x.due ? `<button class="btn sm noprint" onclick="AD.po.party='rider:${esc(x.rd.email)}';AD.po.sel={};setTab('payouts')">Settle</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="6">No riders</td></tr>'}</table></div></div></div>`);
  $('#rfrom').onchange = $('#rto').onchange = $('#rbiz').onchange = () => { AD.r = { from: $('#rfrom').value, to: $('#rto').value, biz: $('#rbiz').value }; vReports(); };
}
function downloadReport() {
  const R = window._report;
  downloadCSV('report-' + today + '.csv', [['Report', AD.r.from || 'start', AD.r.to || today], [], ['Business', 'Platform fee', 'Confirmed', 'Gross', 'Discounts', 'Platform fees', 'Net', 'Received online', 'Net remittance', 'Cancelled'],
    ...R.rows.map(x => [x.z.name, feeText(x.z.platformFee), x.n, x.gross, x.disc, x.fee, x.net, x.online, x.remit, x.canc]), [], ['Month', 'Transactions', 'Gross', 'Platform fees'], ...Object.keys(R.months).sort().map(m => [m, R.months[m].n, R.months[m].g, R.months[m].f]),
    [], ['Business', 'Cash collected by merchant', 'Platform fees on cash sales (to remit)', 'Non-cash held by Tara', 'Platform fees on non-cash', 'Net (positive = Tara pays, negative = merchant remits)'], ...R.cashRows.map(x => [x.z.name, x.cash, x.feeCash, x.tara, x.feeNon, x.net]),
    [], ['Rider', 'Email', 'Completed deliveries', 'Earned', 'COD cash kept', 'Unsettled net'], ...R.riders.map(x => [x.rd.name, x.rd.email, x.n, x.earned, x.cash, x.due])]);
}
function downloadRemit() {
  const R = window._report;
  downloadCSV('remittance-' + today + '.csv', [['Ref', 'Date', 'Business', 'Payment', 'Payment status', 'Gross', 'Discount', 'Platform fee', 'Net', 'Delivery fee', 'Received online', 'Net remittance'],
    ...R.rem.map(b => { const m = Rules.money(b); return [b.ref, b.created, bizName(b.bizId), Rules.PAY_LABEL[b.payMethod], b.payStatus, m.gross, m.discount, m.fee, m.net, b.kind === 'food' ? m.delivery : 0, m.collectedOnline, m.remit]; })]);
}
initPortal();
