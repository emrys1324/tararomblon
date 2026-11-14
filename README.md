# Tara Romblon

An all-in-one booking web app for tourists in Romblon, Philippines, in the style of koobo.ph. It covers three launch partners:

| Partner | Service | Route |
|---|---|---|
| **Pahuway Cafe** | Food delivery (menu, options, delivery zones, rider tracking) | `/food` |
| **Baybayin Scooter Rental** | Scooter booking (dates, live unit availability, add-ons, pick-up point) | `/scooters` |
| **Hiraya Beach House** | Accommodation (date and guest search, availability calendar, room booking) | `/stays` |

Food, a scooter and a stay all go into **one trip cart and one checkout**. The app then splits the checkout into one order per partner, and each partner confirms and fulfils its own order.

## Features

- **Home**: search across stays, scooters and food; partner cards; bestsellers; an Explore Romblon guide.
- **Pahuway Cafe**: category tabs, search, item options (size), minimum order, delivery fee by barangay, and free delivery for Hiraya guests.
- **Baybayin Scooter Rental**: fleet with availability per unit, a 15% weekly discount, add-ons (helmet, insurance, full tank), pick-up and delivery points, and a driver's license field.
- **Hiraya Beach House**: rooms filtered by guests and dates, a month calendar where you tap to pick dates and booked nights are blocked, and an extra-guest fee. Booking the whole house blocks every room, and the reverse.
- **Checkout**: contact details, a details section for each partner, GCash, Maya, card or cash, a simulated payment hand-off, and an availability re-check just before booking.
- **My Trips**: upcoming and past bookings, a status timeline, cancellation rules, call and message buttons, and ratings and reviews.
- **Partner console** (`/partner`): order queue for each brand, accept/advance/decline actions, and KPIs (open orders, today's orders, gross sales, payout after commission). It stays in sync with customer tabs in real time.
- Mobile-first layout with a bottom tab bar.

> **Demo build:** data is stored in the browser's `localStorage` and no real payments or SMS are sent. `PROPOSAL.md` describes the production backend.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle in dist/
```

Stack: React 19, TypeScript, Vite, Tailwind CSS v4, React Router, lucide-react.

## Project layout

```
src/
  data/catalog.ts      menu, fleet, rooms, delivery zones, prices (edit here)
  lib/pricing.ts       totals, discounts, availability rules
  store/               cart + orders state (swap for API in Phase 2)
  components/          layout, shared UI
  pages/               Home, Food, Scooters, Stays, Cart, Trips, Partner, Account
```
