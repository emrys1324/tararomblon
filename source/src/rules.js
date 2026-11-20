/* ===== RULES (shared by every app and the backend — keep identical) ===== */
var Rules = {
  /* Every status used anywhere. Flows below pick the ones that apply to each kind of transaction. */
  STATUSES: ['New', 'Accepted', 'Awaiting Payment', 'Payment Confirmed', 'Preparing', 'Ready for Pick-up', 'Out for Delivery', 'Order Picked Up', 'Delivered',
    'Checked In', 'Checked Out', 'Returned', 'Payment Collected', 'Completed', 'Cancelled', 'Rejected', 'Refunded', 'Expired'],
  EXCEPTIONS: ['Cancelled', 'Rejected', 'Refunded', 'Expired'],
  FREE: ['Cancelled', 'Rejected', 'Refunded', 'Expired'],          // these release dates/units and earn no platform fee
  CLOSED: ['Completed', 'Cancelled', 'Rejected', 'Refunded', 'Expired'],
  PAY_STATUSES: ['Unpaid', 'Pending', 'Paid', 'Refunded', 'Expired'],
  APP_STATUSES: ['New', 'Contacted', 'Approved', 'Rejected'],
  CASH: ['cod', 'pickup'],                                            // paid in cash to the merchant / rider
  NONCASH: ['online', 'transfer'],                                     // paid through HitPay or bank / e-wallet transfer
  PAY_LABEL: { cod: 'Cash on delivery', pickup: 'Pay on pick-up', online: 'HitPay (e-wallet / card)', transfer: 'Bank / e-wallet transfer' },
  MAX_SUPER: 2, MAX_PER_BUSINESS: 4,
  BIZ_TYPES: [['Stay', 'Stays'], ['Rental', 'Rentals'], ['Food', 'Food'], ['Tour', 'Tours'], ['Service', 'Other Services']],
  DELIVERED: ['Delivered', 'Payment Collected', 'Completed'],
  ROLE_LABEL: { super: 'Super Admin', manager: 'Merchant Admin', staff: 'Merchant Staff', rider: 'Delivery Rider' },

  /* The step-by-step flow for a transaction, based on what it is and how it's paid */
  flow: function (b) {
    var pre = b.payMethod === 'online' || b.payMethod === 'transfer' ? ['Awaiting Payment', 'Payment Confirmed', 'Accepted'] : ['New', 'Accepted'];
    if (b.kind === 'stay') return pre.concat(['Checked In', 'Checked Out', 'Payment Collected', 'Completed']);
    if (b.kind === 'rental') return pre.concat(['Order Picked Up', 'Returned', 'Payment Collected', 'Completed']);
    if (b.kind === 'tour') return pre.concat(['Checked In', 'Payment Collected', 'Completed']);
    if (b.fulfillment === 'delivery') return pre.concat(['Preparing', 'Ready for Pick-up', 'Out for Delivery', 'Delivered'], b.payMethod === 'cod' ? ['Payment Collected', 'Completed'] : ['Completed']);
    return pre.concat(['Preparing', 'Ready for Pick-up', 'Order Picked Up'], b.payMethod === 'pickup' ? ['Payment Collected', 'Completed'] : ['Completed']);
  },
  next: function (b) { var f = Rules.flow(b), i = f.indexOf(b.status); return i >= 0 && i < f.length - 1 ? f[i + 1] : null; },
  /* Which status changes each role may make */
  allowed: function (b, actor) {
    if (!actor) return [];
    if (actor.role === 'super') return Rules.STATUSES.filter(function (s) { return s !== b.status; });
    if (actor.role === 'manager') return actor.bizId === b.bizId ? Rules.STATUSES.filter(function (s) { return s !== b.status; }) : [];
    var nx = Rules.next(b), out = [];
    if (actor.role === 'staff' && actor.bizId === b.bizId) {
      if (nx && !(nx === 'Payment Confirmed' && b.payMethod === 'online')) out.push(nx);   // HitPay confirms itself
      if (['New', 'Payment Confirmed'].indexOf(b.status) >= 0) out.push('Rejected');
      return out;
    }
    if (actor.role === 'rider' && b.rider === actor.email && b.riderAccepted) {
      if (['Ready for Pick-up', 'Preparing'].indexOf(b.status) >= 0) out.push('Out for Delivery');
      if (b.status === 'Out for Delivery') out.push('Delivered');
      return out;   // COD cash is recorded by the merchant (amount received) when they tag Payment Collected
    }
    return [];
  },
  payStatusFor: function (b, status) {
    if (status === 'Payment Confirmed' || status === 'Payment Collected') return 'Paid';
    if (status === 'Refunded') return 'Refunded';
    if (status === 'Expired') return 'Expired';
    if (status === 'Awaiting Payment') return 'Pending';
    return b.payStatus;
  },
  /* Confirmed = paid, or a cash order the merchant has received */
  confirmed: function (b) {
    if (Rules.FREE.indexOf(b.status) >= 0 || b.status === 'Awaiting Payment') return false;
    return b.payStatus === 'Paid' || Rules.CASH.indexOf(b.payMethod) >= 0;
  },
  /* Money: gross = order/booking amount (food excludes delivery fee), fee = platform fee, net = gross − discount − fee */
  gross: function (b) { return b.kind === 'food' ? +b.quote.subtotal || 0 : +b.quote.total || 0; },
  feeFor: function (biz, gross) {
    var f = (biz && biz.platformFee) || { type: 'percent', value: 0 };
    var v = f.type === 'fixed' ? +f.value || 0 : Math.round(gross * (+f.value || 0)) / 100;
    return Math.min(Math.max(v, 0), gross);
  },
  /* Discounts applied at checkout: a discount code (funded by the merchant or by Tara Romblon) and reward points (always the merchant's) */
  reductions: function (b) {
    var c = b.code || null, code = c ? +c.amount || 0 : 0, merch = c && c.fundedBy !== 'tara' ? code : 0, pts = b.points ? +b.points.amount || 0 : 0;
    return { code: code, codeMerch: merch, codeTara: code - merch, points: pts, total: Rules.r2(code + pts) };
  },
  /* What the customer pays in total (order / booking total less code and points) */
  payable: function (b) { return Rules.r2((+b.quote.total || 0) - Rules.reductions(b).total); },
  /* Cash the merchant should receive when tagging Payment Collected */
  cashExpected: function (b) {
    if (b.payMethod === 'cod') return Rules.r2(Rules.payable(b) - (+b.quote.deliveryFee || 0));
    if (b.payMethod === 'pickup') return Rules.payable(b);
    return Rules.r2(Math.max(0, Rules.payable(b) - (+b.dueNow || 0) - (+b.discount || 0)));
  },
  money: function (b) {
    var ok = Rules.confirmed(b), gross = Rules.gross(b), R = Rules.reductions(b), manual = +b.discount || 0;
    var disc = Math.min(manual + R.codeMerch + R.points, gross), fee = ok ? Math.min(+b.fee || 0, gross) : 0;
    var delivery = b.kind === 'food' ? +b.quote.deliveryFee || 0 : 0;
    var online = Rules.NONCASH.indexOf(b.payMethod) >= 0 && b.payStatus === 'Paid' ? +b.dueNow || 0 : 0;
    return { counted: ok, gross: ok ? gross : 0, discount: ok ? disc : 0, fee: fee, net: ok ? gross - disc - fee : 0, delivery: ok ? delivery : 0, codeTara: ok ? R.codeTara : 0,
      collectedOnline: online, remit: online ? Rules.r2(online - (b.kind === 'food' ? delivery : 0) + R.codeTara - Math.min(manual, gross) - fee) : 0 };
  },
  /* Who holds what money for one transaction, for payouts.
     Business: Tara Romblon pays out what it collected for the business (HitPay / transfers, and COD cash when riders remit it to Tara)
       minus the platform fee; cash the business collected itself is deducted, so cash-only businesses owe the fee.
     Rider: earns riderSharePct % of the delivery fee; cash the rider kept from COD orders is deducted. */
  ledger: function (b, st) {
    st = st || {};
    var m = Rules.money(b), o = { counted: m.counted, gross: m.gross, discount: m.discount, fee: m.fee, delivery: m.delivery, taraBiz: 0, cashBiz: 0, bizNet: 0, riderShare: 0, riderCash: 0, riderNet: 0 };
    if (!m.counted) return o;
    var codTara = st.codCashTo === 'tara', cod = b.payMethod === 'cod', due = m.gross - m.discount;
    var taraBiz = (cod && codTara ? Rules.payable(b) - m.delivery : Math.max(0, m.collectedOnline - m.delivery)) + m.codeTara;
    o.taraBiz = Rules.r2(Math.min(taraBiz, Math.max(due, 0)));
    /* cash the merchant actually recorded at Payment Collected, else what they should have received */
    var recorded = b.cashCollected && !(cod && codTara) ? +b.cashCollected.amount : null;
    o.cashBiz = Rules.r2(recorded != null && recorded >= 0 ? recorded : Math.max(0, due - taraBiz));
    o.cashRecorded = recorded != null; o.cashExpected = Rules.r2(Math.max(0, due - taraBiz));
    o.bizNet = Rules.r2(due - m.fee - o.cashBiz);
    if (b.rider && b.kind === 'food' && Rules.DELIVERED.indexOf(b.status) >= 0) {
      var pct = st.riderSharePct == null ? 100 : +st.riderSharePct;
      o.riderShare = Rules.r2(m.delivery * pct / 100);
      o.riderCash = cod ? (codTara ? Rules.payable(b) : m.delivery) : 0;
      o.riderNet = Rules.r2(o.riderShare - o.riderCash);
    }
    return o;
  },
  /* Philippine mobile number in one format (09XXXXXXXXX); reward points are tied to it */
  mobile: function (p) { var d = String(p || '').replace(/\D/g, ''); if (d.length === 12 && d.indexOf('63') === 0) d = '0' + d.slice(2); if (d.length === 10 && d.charAt(0) === '9') d = '0' + d; return /^09\d{9}$/.test(d) ? d : ''; },
  /* points a customer earns on an amount paid for items (after discounts and points used, delivery fee excluded) */
  pointsEstimate: function (biz, amount) { var p = Rules.rewardsOf(biz); return p.enabled ? Rules.pointsFor(p, amount) : 0; },
  /* live rider tracking: shared only while an accepted delivery is on its way */
  TRACK: ['Payment Confirmed', 'Accepted', 'Preparing', 'Ready for Pick-up', 'Out for Delivery'],
  trackable: function (b) { return b.kind === 'food' && b.fulfillment === 'delivery' && !!b.rider && !!b.riderAccepted && Rules.TRACK.indexOf(b.status) >= 0; },
  r2: function (n) { return Math.round(n * 100) / 100; },
  /* Transactions ready for payout: businesses once Completed, riders once delivered */
  bizPayable: function (b) { return b.status === 'Completed' && !b.bizPaidAt && Rules.confirmed(b); },
  riderPayable: function (b) { return !!b.rider && b.kind === 'food' && Rules.DELIVERED.indexOf(b.status) >= 0 && !b.riderPaidAt; },
  /* Discount code amount for an eligible amount (percent of order total or fixed, capped) */
  codeAmount: function (d, amount) {
    if (!d || !(amount > 0)) return 0;
    var v = d.type === 'fixed' ? +d.value || 0 : amount * (+d.value || 0) / 100;
    if (d.maxDiscount > 0) v = Math.min(v, +d.maxDiscount);
    return Rules.r2(Math.min(Math.max(v, 0), amount));
  },
  /* Reward points: Pahuway defaults are 1 point per P20 spent, 1 point = P1, redeem from 50 in blocks of 10 */
  REWARDS: { enabled: false, pesoPerPoint: 20, pointValue: 1, signupBonus: 20, birthdayBonus: 50, minRedeem: 50, redeemStep: 10 },
  rewardsOf: function (biz) { var r = (biz && biz.rewards) || {}, o = {}; for (var k in Rules.REWARDS) o[k] = r[k] == null ? Rules.REWARDS[k] : r[k]; o.loyverse = !!r.loyverse; return o; },
  pointsFor: function (prog, amount) { return prog.pesoPerPoint > 0 ? Math.floor(Math.max(0, amount) / prog.pesoPerPoint) : 0; },
  redeemOptions: function (prog, balance, maxAmount) {
    var out = [], step = Math.max(1, +prog.redeemStep || 1), v = +prog.pointValue || 1;
    for (var p = +prog.minRedeem || step; p <= balance && p * v <= maxAmount; p += step) out.push(p);
    return out;
  },
  canInquire: function (customerEmail, bizId, cartBizIds) { return (cartBizIds || []).indexOf(bizId) >= 0; },
  staffCheck: function (list) {
    var supers = list.filter(function (s) { return s.role === 'super'; });
    if (supers.length > Rules.MAX_SUPER) return 'Only ' + Rules.MAX_SUPER + ' Super Admin users are allowed.';
    var per = {}, kinds = {}, seen = {};
    for (var i = 0; i < list.length; i++) {
      var s = list[i], e = String(s.email || '').trim().toLowerCase(), merchant = s.role === 'manager' || s.role === 'staff';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return 'Invalid email: ' + (s.email || '(blank)');
      if (!merchant && ['super', 'rider'].indexOf(s.role) < 0) return 'Unknown role for ' + e;
      /* one email can be Merchant Admin / Staff of several businesses, but a Super Admin or rider email can't also be a merchant user */
      var kind = merchant ? 'merchant' : s.role;
      if (kinds[e] && (kinds[e] !== kind || !merchant)) return e + ' is listed twice. A Super Admin or rider email can only have that one role.';
      kinds[e] = kind;
      if (merchant) {
        if (!s.bizId) return e + ' needs a business.';
        if (seen[e + '|' + s.bizId]) return e + ' is listed twice for the same business.'; seen[e + '|' + s.bizId] = 1;
        per[s.bizId] = (per[s.bizId] || 0) + 1;
        if (per[s.bizId] > Rules.MAX_PER_BUSINESS) return 'Each business can have up to ' + Rules.MAX_PER_BUSINESS + ' users (any mix of Merchant Admin and Merchant Staff).';
      }
    }
    return '';
  }
};
/* ===== END RULES ===== */
