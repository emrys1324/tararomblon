# Project Proposal: Tara Romblon

**An all-in-one tourist booking app for Romblon**
Prepared: 14 November 2026 · Status: clickable prototype delivered (Phase 1)

---

## 1. Summary

Tourists arriving in Romblon have to arrange food, transport and lodging separately, usually through Facebook Messenger and cash. Tara Romblon puts these into one app that works well on a phone, similar to koobo.ph. Tourists get one account, one cart and one checkout. Three local partners launch with it:

| Partner | Vertical | Booking model |
|---|---|---|
| Pahuway Cafe | Food delivery | On-demand order, delivered in 20–60 minutes |
| Baybayin Scooter Rental | Mobility | Booked for a date range, with a limited number of units |
| Hiraya Beach House | Accommodation | Booked by night, with a limited number of rooms |

## 2. Goals and success metrics

| Goal | KPI (first 6 months after launch) |
|---|---|
| Move partner bookings from chat and walk-ins to the app | 40% of partner transactions go through the app |
| Increase spend per tourist | 25% of checkouts include 2 or more partners |
| Reduce no-shows | Less than 5% no-shows on prepaid bookings |
| Partners trust the app | Partners confirm 90% of orders within 10 minutes |

## 3. Scope

### In scope

**Customer app (responsive web, installable PWA)**
- Home and search across all three services, plus a guide to Romblon
- Pahuway Cafe: menu, item options, cart, delivery zones and fees, minimum order, order tracking
- Baybayin Scooter Rental: fleet, availability for each unit by date, add-ons, pick-up and delivery points, license capture, deposit terms
- Hiraya Beach House: rooms, availability calendar, guest rules, extra-guest fee, whole-house rule
- Unified cart and checkout that splits into one order per partner
- Payments: GCash, Maya and cards through a payment gateway (PayMongo or Xendit), plus cash on delivery or arrival
- Account: login with a one-time code (OTP) by mobile number, My Trips, cancellations, reviews
- Notifications: SMS and email confirmations, and status updates

**Partner console**
- Order and booking queue, accept, decline, status updates
- Catalog management (menu items and availability, scooter fleet, room rates, blackout dates)
- Sales, commission and payout reports

**Admin (platform operator)**
- Onboarding partners, commission settings, refunds and disputes, promo codes

### Out of scope (candidates for later phases)
- Native iOS and Android apps (the PWA covers launch)
- Rider app with live GPS (Phase 1 uses status updates from the partner)
- Sync with Agoda, Booking.com or Airbnb calendars (iCal sync is in the backlog)
- Ferry and flight ticketing, island-hopping tours, and partners beyond the first three
- Multiple languages (English and Filipino copy only at launch)

### Assumptions
- Each partner provides its menu, rates, photos and one staff member to use the partner console.
- The client registers the payment gateway account under a DTI or SEC-registered business entity.
- Partners have reliable mobile data. The partner console works on a phone.

## 4. Delivery plan and estimate

| Phase | Deliverables | Duration | Effort |
|---|---|---|---|
| **1. Prototype** ✅ *(done: this repo)* | Clickable front end for all flows, unified cart, partner console, demo data | 1 week | ~40 h |
| **2. Backend and accounts** | API and database (e.g. Supabase or Postgres), OTP login, saved orders, availability rules on the server, data model for each partner, role-based access | 3 weeks | 100–120 h |
| **3. Payments and notifications** | PayMongo or Xendit (GCash, Maya, card), webhooks, refunds, deposits, SMS (Semaphore) and email receipts | 2 weeks | 60–80 h |
| **4. Partner and admin tools** | Catalog CMS, blackout dates, reports and payouts, admin panel, promo codes | 2–3 weeks | 80–100 h |
| **5. QA, content and launch** | Real photos and copy, cross-device QA, load test, PWA install, analytics, training for partner staff, go-live | 1–2 weeks | 40–60 h |
| **Total** | | **9–11 weeks** | **≈ 320–400 h** |

**Rough budget:** 320–400 h × ₱1,000–₱1,500/h (Philippine freelance or agency mid-level rate) = **₱320,000 – ₱600,000**, plus about 15% contingency.

**Running costs (monthly, estimated):** hosting and database ₱1,500–₱3,000; SMS ₱0.50–₱1.00 per message; gateway fees of about 2.5% for GCash and Maya and about 3.5% for cards (charged per transaction); domain about ₱1,000 per year.

## 5. Business model

- **Commission:** 10% on stays and scooters, 12–15% on food (or a flat monthly fee per partner during the pilot)
- **Convenience fee:** ₱10 service fee on food orders (already shown in the prototype)
- **Cross-sell:** free food delivery for Hiraya guests; scooter drop-off at Hiraya

## 6. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Partner double-books (walk-ins or other OTAs) | Blackout dates in the partner console; iCal sync in a later phase |
| Weak signal in remote barangays | Light PWA, SMS fallback for status updates |
| Cash-heavy market | Keep cash on delivery or arrival; require prepayment only for whole-house and peak dates |
| Low partner adoption | Console built for phones, one-time training, WhatsApp/SMS alert for new orders |

## 7. Next steps
1. Partners review the prototype and give feedback (1 session per partner)
2. Confirm the scope and phase budget
3. Collect real menus, rates, photos and policies from each partner
4. Start Phase 2
