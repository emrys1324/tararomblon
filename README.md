# Tara Romblon v12.5: Vercel + Supabase

Four web apps share one backend:

| App | File | Who uses it |
|---|---|---|
| Customer | `index.html` | Tourists: stays, scooter rentals, food, messages |
| Super Admin | `admin.html` | Beyond Tech Solutions (2 users) |
| Merchant | `merchant.html` | Merchant Admin and Merchant Staff of each business |
| Rider | `rider.html` | Delivery riders |

- **Hosting and API:** Vercel. The pages are static files, and `/api` runs as serverless functions.
- **Database and file storage:** Supabase (Postgres + Storage).
- **Email:** Resend.
- **Payments:** HitPay.

There is no Google Sheets, Apps Script or Drive connection anywhere.

## What's in the package

```
(repo root)              <- what Vercel deploys (Root Directory: leave empty)
  index.html  admin.html  merchant.html  rider.html
  api/index.js           POST /api: every app action
  api/hitpay-webhook.js  POST /api/hitpay-webhook: HitPay payment confirmations
  api/cron.js            daily safety net (unpaid links, cleanup)
  api/_lib/env.js        Supabase, Resend and HitPay connections
  api/_lib/shared.js     pricing + rules + core (generated; same code as the apps)
  vercel.json  package.json  .env.example
  .vercelignore          keeps supabase/, preview/, source/ off the website
supabase/schema.sql      run once in Supabase
preview/                 the same 4 apps in demo mode (sample data, no backend)
source/                  editable source + build.py + tests
```

There are no npm packages to install. The functions use Node's built-in `fetch` and `crypto`.

## New: COD — the rider pays the store at pick-up

- Settings → Riders → "Cash collected by riders on COD orders goes to" → **Rider pays the store at pick-up** (now the default).
- The Rider app shows a Cash on delivery box on each COD order: **1. At pick-up, pay the store ₱X** (the food amount), **2. At drop-off, collect ₱Y from the customer**, and what the rider keeps (the customer's delivery fee, which counts toward their earning). Delivery requests show the same amounts before accepting.
- The merchant's order card says "The rider pays you ₱X in cash at pick-up"; the store records it with Payment Collected. The store's payout then only deducts the platform fee (and its delivery share); the rider's settlement is their earning minus the delivery fee they kept.

## New: simple delivery fees set by each merchant; delivery address from the map

- **Merchant app → Store settings → Delivery fees**: each food merchant sets what customers pay per distance (Up to km → ₱ fee, ₱0 = free). Customers farther than the last distance can't order delivery. Riders always earn at least the minimum (Settings → Delivery fee, ₱20); if the fee is lower or free, the store covers the difference. Super Admin sees the same simple table (Listings & rates → restaurant → Delivery), with an "Advanced" view for a custom store / rider split.
- **Checkout**: the "House / landmark" field is gone. The delivery address is the one from the map: the place picked in the search box, or the address of the pinned spot (current location, tap or drag). Extra directions go in "Notes for the store and rider".

## New: photo galleries for stays (like Airbnb)

- **Merchant app → Listings & prices → stay → Photos**: add many photos at once (up to 30, resized automatically), reorder them (← →), make one the cover (★) or delete them. Super Admin can do the same under Listings & rates → Stays → Manage photos.
- **Customers**: the stay page shows a photo grid on computers (cover + 4) and a swipeable strip with a counter on phones; "Show all photos" opens a full-screen viewer with arrows, swipe, thumbnails and keyboard keys. Stay cards show the number of photos.

## New: merchant payouts due the next day (Super Admin → Payouts)

- Every morning the app lists each merchant's earnings for transactions **Completed before today** (net of platform fee, discounts and the store's delivery share) that haven't been paid out yet: "Merchant payouts due today".
- **Download payout CSV**: business, amount, bank / e-wallet, account name and number, transactions and references, ready for HitPay bulk payout or your bank's batch transfer. After paying, record each payout (choose the business → Record payout) so it isn't counted again.
- A daily email / in-app reminder lists who is due and flags merchants with no payout account saved. Merchants who owe (cash they kept is more than what they're owed) are listed under "To collect from".

## New: platform pays riders every 3 days

- Customers only see the delivery fee they pay. Rider earnings show only in the Rider app (merchants see what the store pays).
- Cash on delivery: the **rider keeps the cash** and records it (Payment Collected). It is not counted as rider earnings; every 3 days the rider is settled: earnings minus COD cash held (if negative, the rider remits the difference). The platform pays the store its sales minus the platform fee and its delivery share.
- Riders are paid every 3 days (Settings → Riders → "Pay riders their earnings every (days)"). The Rider app shows "Due to you" and the next payout date. Super Admin → Payouts shows "Rider payouts due", and a daily reminder is sent when riders are due.
- Orders placed before this change keep the old split (rider kept the customer's fee in cash).

## New: Airbnb calendar sync for stays (Super Admin → Listings & rates → Stays → Calendar sync)

- **Import** (Airbnb → Tara Romblon): in Airbnb open the listing → Availability → Connect calendars → **Export calendar**, copy the link and paste it in the stay's Calendar sync box, then **Save and sync now**. Nights booked on Airbnb are blocked here (customer calendar and checkout). It refreshes about every 15 minutes. Booking.com, Vrbo and Google Calendar links work too (up to 5 per stay).
- **Export** (Tara Romblon → Airbnb): copy the stay's export link into Airbnb → Availability → Connect calendars → **Import calendar**. Airbnb checks it every few hours, so nights booked here get blocked there. Keep the link private.

## New: riders accept delivery orders first (rider dispatch)

1. A customer places a delivery order (online payments: once paid). Status **Finding Rider**. The merchant does not see or hear about it yet.
2. Online riders near the store (within 5 km by their live location; riders without a recent location get requests from stores in their town) get a **New delivery request** (phone notification + pop-up in the Rider app with what they earn, distance, pick-up, drop-off and cash to collect). They tap **Accept** or **Decline**. The first to accept gets it; the others are told it was taken.
3. When a rider accepts, the order is confirmed (New / Payment Confirmed) and **pushed to the merchant**, with the rider already assigned. The customer is told which rider accepted and can track them.
4. If nobody accepts within 3 minutes, the request goes to all online riders. After 15 minutes the Super Admin and the customer are alerted. Customers can cancel while it says Finding Rider. Super Admin can send a waiting order to a specific rider (Transactions → rider), who still accepts it.
- Merchants no longer assign riders. Riders share their location while online (for nearby requests); it stops when they go offline.
- Settings → Rider dispatch: on/off, distance (km), minutes before widening, minutes before the alert. Off = merchants assign riders like before.

## New: delivery fee matrix with customer / store / rider amounts (Super Admin → Listings & rates → restaurant → Delivery)

- Turn on **Charge delivery by this matrix** for a restaurant. Each distance band then has **Customer pays**, **Store pays** and **Rider gets** (₱). Example: 0–3 km: customer ₱0, store pays ₱20, rider gets ₱20.
- "From" is the previous band's "Up to". Orders beyond the last band can't be delivered. If "Rider gets" differs from customer + store, the screen shows what Tara keeps or adds.
- Turned off, the restaurant follows Settings → Delivery fee (the formula) as before. Customers see the bands at checkout; riders, merchants and payouts use the band's amounts.

## New: passwords, phone notifications, riders stay signed in, COD amount required

- **Customers** create an account with email + password (or Continue with Google) and log in with it. No more sign-in codes. "Forgot password?" emails a one-time code to set a new password; customers from before this change use it once to set their password. Account → Password lets them change it.
- **Riders** create their account on the rider application form (with a password) and sign in to the Rider app with email + password once approved. Riders added before this change tap "Forgot password? / Set my password" once.
- **Riders stay signed in** when they leave or reopen the app. Only "Sign out", a password reset or removal by an admin signs them out; a weak connection no longer sends them back to the sign-in screen.
- **Phone notifications (Web Push)**: after signing in, every app shows "Turn on notifications". New orders, status changes, rider assignments and messages then pop up on the phone even when the app is closed. Android: Chrome. iPhone: add the app to the Home Screen first (iOS 16.4+). In-app notifications (bell + pop-up) still work as before. No setup needed: the server creates its push keys automatically.
- **Cash on delivery**: when marking "Payment Collected", the merchant must type the amount collected (no longer pre-filled; must be more than ₱0).

## New: My orders & bookings for customers (Orders tab)

- New **Orders** tab (bottom bar on phones, "My orders" in the top menu) lists every order and booking: food, rentals, stays and things to do. Filters: In progress, All, by type, Past. A badge shows how many are in progress.
- Each card shows the status steps, payment, items, totals, points and an **Activity** log (every status change with date, time and who made it).
- Deliveries show the **rider** (name, vehicle, plate, Call button) as soon as one is assigned, and **Track rider live** / **Rider & map** opens the live map with the rider's position and ETA until the order is delivered.
- Orders in progress also appear at the top of the home page with a **Track** button. The list refreshes by itself every 15 seconds and when a notification arrives.

## New: website icon + "Install the app" pop-up

- **Super Admin → Settings → Website icon & app**: upload a square logo (PNG/JPG, 512×512 or bigger). It's used on the browser tab, bookmarks and the phone home screen. Non-square pictures are fitted on the background colour you pick. "Use default icon" goes back to the built-in icon. Tap Save to apply.
- The site can now be installed as an app (`/manifest.webmanifest`, `/sw.js`, icon at `/api/icon`).
- Every time a customer opens the home page, a pop-up invites them to install the app: an **Install app** button on Android/desktop Chrome and Edge, and step-by-step instructions on iPhone (Share → Add to Home Screen) and in Facebook/Messenger browsers. It isn't shown inside the installed app or while another pop-up is open.

## New: edit the whole menu, then Save once (Merchant app → Listings & prices)

- **Add menu item** adds a row: name, short description, category, price, discount and Available.
- The **✕** button marks an item for removal (with Undo). You're asked to confirm before it's removed.
- All edits (menu, stays, rental units, tours) stay as a draft until you tap **Save all changes** in the bar at the bottom. **Discard** throws the draft away. The app warns you before you leave or switch business with unsaved changes.
- **Categories**: tap **Add category** (top or bottom of Menu items, or "+ New category…" in an item's category list), or open the Categories panel to add, rename, move up/down or remove (only when no items use it). They're saved with the same Save button and show as tabs in the customer menu in that order.
- Photos and add-ons are still saved as soon as you change them. New items get these after their first save.
- "Accepting orders" (open/close the store) still takes effect right away. Merchant Staff still only turn items on/off, which also takes effect right away.

## New: delivery fee rule (Super Admin → Settings → Delivery fee, the first card: Base delivery fee + Fee per succeeding km, with a live example)

| Distance from the store | Customer pays | Store pays | Rider earns |
|---|---|---|---|
| Up to 1.5 km | Free | ₱20 | ₱20 |
| Each started km after 1.5 km | 70% of ₱10/km | 30% | The whole fee |

Example: 3.2 km → 2 started km → ₱20 fee: customer ₱14, store ₱6, rider ₱20.
- Minimum rider earning ₱20: if the fee is less (1.6–2.5 km = ₱10), the customer still pays 70% (₱7) and the store pays the rest up to ₱20 (₱13).
- COD: the rider keeps the customer's part in cash; the store's part is taken from the store's payout and paid to the rider.
- All five numbers (free km, ₱ per km, customer %, base fee, longest delivery) can be changed in Settings.
- Orders placed before this change still use the old "Rider share of delivery fee (%)".

## New: Cash on delivery limits (Super Admin → Settings → Riders)

- Cash on delivery appears only after the customer has **3 completed** orders or bookings (any kind). Until then checkout explains why and offers online payment.
- Cash on delivery is only for orders up to **₱500** (total including the delivery fee). Bigger orders must pay online.
- Customers who signed up before 21 Nov 2026 (Philippine time) skip the 3-completed rule; the ₱500 ceiling still applies to them. Change or clear the date in Settings.
- The server enforces both rules too, so they can't be bypassed. Both numbers can be changed (0 = no ceiling).

## New: Food and Rentals first; Stays and Things to do "coming soon"
- **Customer home:** the order is now **Food, Rentals, Stays, Things to do**. Stays and Things to do carry a **Soon** badge. The home page lists *Where to eat* first, then *Ride around Romblon*; *Where to stay* is hidden.
- **Stays and Things to do pages** show a *Coming soon* message with **Order food** / **Rent a scooter** buttons. They're left out of search, and the server refuses stay or tour bookings while closed.
- **To open them later:** go to **Super Admin → Settings → Open to customers**, switch on *Stays* and/or *Things to do*, then **Save**. The badges disappear and the listings come back. Nothing else to change.

## New: one email, several businesses
- **Super Admin → Businesses & users:** you can add the same email under several businesses, with a different role in each. For example, Merchant Admin of Pahuway Café and Merchant Staff of Hiraya Beach House. Each business still has up to 4 users.
- **Merchant app:** people with more than one business see a **Business** picker under the header. Orders, calendar, team, listings, store settings and reports all follow the chosen business, and so does the person's role there. The app remembers the last business used on that device.
- **Merchant Admins** can add someone who already works for another business; that other access stays. Removing them from one business doesn't touch the others. Super Admin and rider emails still can't also be merchant users.
- New and order emails for a business go to everyone with access to it.
- Approving a business application with an email that already manages another business adds the new business to that same login.

## New: Create account page + Continue with Google
- **Customer app:** a **Create account** screen (Account tab, or the link `/#signup`) with **Sign up with Google**, or full name + mobile + email followed by a 6-digit code. After that, only the address is asked. The **Sign in** screen also has **Continue with Google**, and both screens link to each other.
- Google accounts are matched by email, so someone who signed up with an email code and later taps Google gets the same account. Each mobile number still belongs to one account only.
- **Security:** the server checks every Google sign-in with Google (`oauth2.googleapis.com/tokeninfo`): it must be made for your site (your Client ID), with a verified email, not expired, and issued by Google.
- Without `GOOGLE_CLIENT_ID`, the Google button is hidden and email codes work as before.

### Google sign-in setup (about 10 minutes)
1. Go to **console.cloud.google.com**. Create a project or pick one.
2. Under **APIs & Services > OAuth consent screen** (Google Auth Platform > Branding), set:
   - App name: *Tara Romblon*
   - Support email
   - Logo (optional)
   - Authorized domain: your domain, plus `vercel.app` if you use that address.
3. Under **Audience**, choose **External** and **Publish app** (In production). While it's still in *Testing*, only test users you add can sign in.
4. Go to **APIs & Services > Credentials > Create credentials > OAuth client ID**. Choose **Web application**, name it *Tara Romblon web*, and add **Authorized JavaScript origins** such as `https://tararomblon.vercel.app` and your own domain. No redirect URI is needed.
5. Copy the **Client ID**, which ends in `.apps.googleusercontent.com`. In Vercel, add it as `GOOGLE_CLIENT_ID`, then redeploy. You don't need the client secret.

## What's new in v12.5: live rider tracking
- **Rider app:** during an accepted delivery, the app shares the rider's GPS position about every 10 seconds, showing the banner "Sharing your live location…". It stops automatically when the delivery is done, and riders are warned if location is turned off.
- **Customer, Merchant and Super Admin apps:** a **Track rider** button on active deliveries opens a live map with:
  - the rider, the store and the drop-off point;
  - arrival time and distance;
  - the rider's name, vehicle and plate, with a Call button.
  The map refreshes every 10 seconds and tracking ends when the order is Delivered.
- **Privacy:** only the customer, that store's users and Super Admins can see the location. It is only shared while the delivery is in progress, and it's cleared afterwards.
- **Maps:** Google Maps is used when a key is set. Without one, the apps use OpenStreetMap, the same map as the delivery pin.

### Google Maps setup (optional, recommended)

With a key, food checkout uses a live Google map to pick the delivery location: search an address or landmark, tap the map or drag the pin, see the store and the delivery area, and the pinned address is shown. Riders' live tracking also uses Google Maps. Without a key, the free OpenStreetMap map is used.

1. Google Cloud Console → create a project → APIs & Services → enable **Maps JavaScript API**, **Places API (New)** and **Geocoding API** (billing must be on; there is a monthly free allowance).
2. Credentials → Create credentials → API key → Restrict it: Application restriction **Websites** = `https://tararomblon.vercel.app/*`; API restriction = the three APIs above.
3. Vercel → Project → Settings → Environment Variables: `GOOGLE_MAPS_API_KEY` = the key (optional `GOOGLE_MAPS_MAP_ID` = a Map ID from Google Maps Platform → Map management). Redeploy.

### Google Maps setup (older notes)
1. In Google Cloud Console, create a project and add a billing account. The Maps JavaScript API needs billing enabled, but has a monthly free usage allowance.
2. Go to **APIs & Services > Library**, then enable **Maps JavaScript API**.
3. Go to **APIs & Services > Credentials > Create credentials > API key**. Restrict it:
   - Application restriction: **Websites**, e.g. `https://yourdomain.ph/*` and `https://*.vercel.app/*`.
   - API restriction: **Maps JavaScript API** only.
4. Optional: create a **Map ID** under Google Maps Platform > Map management. Without one, the app uses Google's `DEMO_MAP_ID`.
5. In Vercel, set `GOOGLE_MAPS_API_KEY` (and `GOOGLE_MAPS_MAP_ID`), then redeploy.

The browser key is visible in the page, which is normal for Google Maps. The website restriction is what protects it.

## What's new in v12.4
- Rider app: large availability card that stays at the top while scrolling. Tap anywhere on it to go online or offline. It has a big ON/OFF switch and a pulsing dot when online, asks to confirm before going offline with active deliveries, and shows an Online/Offline tag in the header.

## What's new in v12.3
- **Fonts (all 4 apps):**
  - Libre Baskerville for headings.
  - Source Sans Pro Semibold for labels, buttons and bold text.
  - Source Sans Pro Regular for body text.
  - Loaded from Google Fonts, where Source Sans Pro is now published as "Source Sans 3".
- **Merchant app, Listings & prices:**
  - The Merchant Admin can add, change or remove a photo for every listing (menu items, stays, rental units, tours) and the store logo.
  - Merchant Staff see the photos but can't change them.
- **Food merchants, add-on groups:**
  - Each group (e.g. Size, Sugar level, Extras) has an on/off switch, Required or Optional, and "customer can pick up to 1, 2 or 3".
  - Each choice in a group has a price and an on/off switch.
  - Customers must answer required groups before adding an item. The Super Admin's Listings & rates editor uses the same groups.
  - Older menus with plain add-ons become one optional group automatically.

## What's new in v12.2
- Customer app: back button (top left) on every screen except home, returning to the home screen.

## What's new in v12.1
- Reward points are linked to the customer's **registered mobile number**. Each mobile number can belong to only one account, and Loyverse customers are matched by mobile number first, then email.
- Checkout and cart show the points the customer will earn. Checkout always shows the Pahuway points box: redeeming unlocks at 50 points, in steps of 10.
- Account > Reward points explains how points work.

## What's new in v12
- **Super Admin:**
  - Business and rider applications are collapsible.
  - **Discounts** tab: code, name, description, businesses included, percent or fixed amount, plus optional cap, minimum order, total uses, one-per-customer, dates, and who pays (merchant or Tara Romblon).
  - The cash report links each business to Payouts. Payouts list transactions by code, each code opens its details, unticked transactions are left out, and settled ones are tagged *Paid out PO-…*.
- **Merchant:**
  - Team: the Merchant Admin adds, edits and removes up to 4 users.
  - **Store settings**:
    - Business details and opening/closing times for each day.
    - Payment methods.
    - Delivery and pick-up options.
    - Reward points on/off with the earning and redemption rules.
    - Accepting discount codes on/off.
    - Loyverse connection.
  - Reward points and discounts report per customer.
  - **Payment Collected** asks for the cash amount received, which feeds the Super Admin cash report.
- **Customer:**
  - The search box blends with the bar.
  - Discount code and reward points at checkout, computed automatically.
  - Reward points in Account.
  - Optional birthday, for the birthday bonus.
  - Message the rider.
- **Rider:** separate chats with the customer and with the store. Riders no longer tag Payment Collected; they hand the cash to the store, which records it.
- **Loyverse (Pahuway Café):** points earned or redeemed in the app are added to or subtracted from the customer's Loyverse balance. The match is by email, then mobile, and new customers are created in Loyverse. The app shows the Loyverse balance, so in-store and app points are one balance. Paste a Loyverse access token in Merchant app > Store settings, or set `LOYVERSE_TOKEN` in Vercel.

**Upgrading from v11:** run `supabase/schema.sql` again. It adds the `points` table.

## What was new in v11
- **Super Admin:**
  - Light form fields.
  - **Riders** tab: profiles, driver's license photo and verification, payout accounts, Add rider.
  - **Rider applications** tab, fed from the customer app.
  - Approving a business auto-creates a hidden draft listing under Stays, Rentals, Food, Tours or Other Services.
  - Bank or e-wallet details collected on business and rider applications.
  - **Payouts** tab: per business or rider, the net payout is non-cash collected − platform fees − cash they kept. A negative result is cash for them to remit. Payouts are recorded and emailed as statements.
  - Report: cash collected by each merchant and the amount to remit.
  - Setting for where COD cash collected by riders goes.
- **Merchant:**
  - Calendar of current and upcoming stays, rentals and tours, with guest name and unit (Merchant Admin and Staff).
  - Merchant Admins edit prices, discount % and security deposits.
  - Up to 4 users per business, any mix of Admin and Staff.
- **Customer:**
  - Highlighted town dropdown and "Where to?" search.
  - "Use current location" (asks the customer to turn on location services if needed).
  - "Where to eat" lists restaurants (Pahuway Café, Kusina sa Hiraya). Menus show only after choosing one, and one food order is from one restaurant.
  - Tours and Other Services are bookable once live.
  - Registration no. and Mayor's/Business permit are required on the business form.
  - New **Deliver with us** rider application.

**Upgrading from v10:** run `supabase/schema.sql` again. It is safe to re-run and only adds the `payouts` table. Older saved catalogs, with a single café, are converted automatically.

## Setup (about 30 minutes)

### 1. Supabase
1. Create a project at supabase.com. Pick the **Southeast Asia (Singapore)** region.
2. Go to **SQL Editor > New query**. Paste all of `supabase/schema.sql` and click **Run**. This creates:
   - 9 data tables (including `payouts` and `points`), plus `kv` (listings, settings, payout accounts, discount codes) and `cache` (sign-in codes).
   - 2 storage buckets: `photos` (public) and `uploads` (private: IDs and payment proofs).
3. Go to **Project Settings > API** and copy:
   - the **Project URL** (`SUPABASE_URL`)
   - the **service_role** key (`SUPABASE_SERVICE_ROLE_KEY`). Keep it secret. It is used only by the server.

Row Level Security is on for every table, with no policies. The public "anon" key can't read anything. Only the Vercel API, which holds the service key, can.

### 2. Resend (email)
1. Sign up at resend.com and add your domain under **Domains**. Add the DNS records it shows and wait for "Verified".
2. Go to **API Keys > Create**. Copy the key into `RESEND_API_KEY`.
3. Set `MAIL_FROM` to an address on that domain, e.g. `bookings@yourdomain.ph`.

The free plan sends up to 100 emails a day and 3,000 a month. You can turn off email groups in **Super Admin > Settings** if you get close. In-app notifications are unaffected.

### 3. HitPay
1. Go to **Settings > Payment Gateway > API Keys** and copy the key into `HITPAY_API_KEY`.
2. Go to **Developers > Webhook Endpoints > Add**:
   - URL: `https://YOUR-SITE/api/hitpay-webhook`
   - Event: `payment_request.completed`
   - Copy the endpoint's **salt** into `HITPAY_SALT`.
3. Keep `HITPAY_SANDBOX=true` while testing with the sandbox account. Set it to `false` with live keys.

### 4. Vercel
1. Import this repo at vercel.com/new. Framework preset: **Other**. No build command. **Root Directory: leave empty** (the app is at the top of the repo).
2. In **Settings > Environment Variables**, add every variable from `.env.example`:
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPER_ADMINS` (the 2 MJV emails, comma separated)
   - `SITE_URL`, `NOTIFY_EMAIL`
   - `RESEND_API_KEY`, `MAIL_FROM`
   - `HITPAY_API_KEY`, `HITPAY_SALT`, `HITPAY_SANDBOX`
   - `LOYVERSE_TOKEN` (optional, Pahuway Café points)
   - `GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_MAP_ID` (optional, live rider tracking)
   - `GOOGLE_CLIENT_ID` (optional, Continue with Google on sign-in / sign-up)
   - `CRON_SECRET` (any long random text)
3. **Redeploy** so the variables take effect.

### 5. First run
1. Open `https://YOUR-SITE/admin` and sign in with one of the `SUPER_ADMINS` emails. A 6-digit code arrives by email.
2. Go to **Listings & rates** and tap **Save** once. This publishes the catalog, and bookings open.
3. In **Businesses & users**, add a Merchant Admin and a Merchant Staff for each business, plus your riders.
4. Share the links:
   - customers: `/`
   - merchants: `/merchant`
   - riders: `/rider`

## How payments are confirmed
1. The customer pays on HitPay and is sent back to `/?paid=<ref>`. The app asks the API to check the payment with HitPay.
2. Separately, HitPay calls `/api/hitpay-webhook`. The function checks the `Hitpay-Signature` (HMAC-SHA256 of the raw body with your salt). It then asks HitPay's API for the payment status before marking anything paid, so a forged or replayed call can't confirm a booking.
3. While staff have an app open, the API also checks unpaid links at most every 5 minutes. Links still unpaid after 60 minutes are expired, which frees the dates.
4. `api/cron.js` runs once a day (02:00 Philippine time) as a final sweep. Vercel's free Hobby plan allows cron jobs only once per day, which is why steps 2 and 3 do the real-time work.

## Plans and limits to know
- **Supabase free plan:** 500 MB database, 1 GB file storage, 2 projects.
  - Free projects pause after 1 week with no database activity. The daily cron keeps it active.
  - For a live business, the Pro plan ($25/month) removes pausing and adds daily backups.
- **Vercel Hobby:** fine to start. Each request body is limited to about 4.5 MB, and photos are resized in the browser before upload.
- **Bank details** are stored only on the server (`kv` key `payees`) and shown only to Super Admins.
- **Uploads:** IDs, payment proofs and driver's licenses live in the private `uploads` bucket. They open through links that expire after 10 minutes, and only for Super Admins (and the Merchant Admin, for their own bookings).

## Editing the apps
1. Edit files in `source/src/`.
2. Run `python3 build.py`. This rebuilds `out/vercel` (live, `apiUrl: '/api'`) and `out/preview` (demo).
3. Run the tests:
   - `node tests/api_test.js` runs the full flow against a simulated Supabase, HitPay and Resend.
   - `python3 tests/ui_test.py` and `python3 tests/demo_test.py` check the demo pages in a headless browser.
4. Copy the files from `source/out/vercel/` to the top of this repo (replacing the old ones) and commit; Vercel redeploys automatically.

`pricing.js`, `rules.js` and `core.js` run both in the browser (demo mode) and on the server, so prices and statuses always match.

## Moving data from the old Google Sheet version
The v9 sheet stored each record as JSON in a `data` column. If you have live data there:
1. Export each tab as CSV.
2. In Supabase **Table Editor**, import it into the table with the same name, mapping `id` and `data`.
3. For listings and settings, open Super Admin > Listings & rates and tap Save.

If you were still testing, skip this. Start fresh.
