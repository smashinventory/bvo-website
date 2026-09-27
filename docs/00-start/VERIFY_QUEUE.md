# BVO — Verification Queue

> Built, gated and pushed, but NOT yet seen working by Sam. One list, run in one pass. Append here as work ships; tick and move to Verified when it passes.

**Why this file exists.** Decided 2026-09-26: Sam does one full review at the
end rather than testing each feature as it lands. That means nothing is caught
between shipping and that review, so two things follow.

1. **Gates carry the full weight.** Every push script gate is negative-tested —
   deliberately broken to prove it fails — because there is no human check
   behind it.
2. **Nothing built may be assumed working.** Anything below has passed gates in
   a sandbox with no database and no outbound network. Gates prove the code
   does what it was written to do. They cannot prove the *world* behaves as
   expected.

**Order matters.** Items are listed in the order they should be run. Later ones
depend on earlier ones having produced data.

---

## HOW TO RUN THIS

Deploy the latest commit first, and confirm hPanel → Deployments shows it as
**Current** before starting. A stale deployment makes every result below
meaningless, and that has already happened twice.

Everything runs against the **sandbox** Stripe account. Env vars are
deliberately still sandbox — see `docs/reference/PRE_LAUNCH_CHECKLIST.md`.

---

## 1. One order, end to end

This single order produces the data most of the rest of the list reads. Use a
**residential** address and a **real-looking Georgia address**, because the
geocode and the residential flag both key off it.

🌐 `/cart` → Checkout

**Page 1 — Your information**
- [ ] Email, full name, address, city, state, ZIP accepted
- [ ] Phone accepted with punctuation, e.g. `404-555-1234 ext 22`
- [ ] Extension lands in its own field, not appended to the number
- [ ] "Residential" selected
- [ ] Continue to delivery

**Page 2 — Delivery**
- [ ] Curbside terms render
- [ ] Continue is refused until the acknowledgement is ticked
- [ ] Tick, add a delivery note, Continue to payment

**Page 3 — Payment**
- [ ] Name and address already filled in the Billing card — NOT asked again
- [ ] **No error banner above the card form** (page 1 owns that message now)
- [ ] Card accepted, Place Order succeeds

**Success page**
- [ ] Reads "Order received", not "Order Confirmed!"
- [ ] Says the card is **authorised, not yet charged**
- [ ] No promise of an email receipt

---

## 2. What the order captured

🗄️ **SQL / phpMyAdmin** — click the database in the sidebar first:

```sql
SELECT order_number, payment_status, status,
       guest_email, ship_first_name, ship_last_name,
       ship_phone, ship_phone_ext, ship_address_type,
       ship_address1, ship_address2, ship_city, ship_state, ship_zip,
       ship_bill_mismatch,
       payment_3ds_result, payment_3ds_flow, payment_3ds_eci,
       delivery_terms_ack_at, delivery_terms_ip, delivery_terms_version,
       ship_lat, ship_lng, ship_geocode_source, ship_geocoded_at,
       payment_authorized_at
  FROM orders
 ORDER BY id DESC LIMIT 1;
```

- [ ] `payment_status` = `auth_only`, `status` = `confirmed`
- [ ] Ship-to is **what you typed on page 1**, not the billing address
- [ ] `ship_phone` is E.164 (`+14045551234`), `ship_phone_ext` = `22`
- [ ] `ship_address_type` = `residential`
- [ ] `delivery_terms_ip` and `delivery_terms_version` both populated
      (version should read `2026-09-26.curbside.v1`)
- [ ] **`ship_lat` ≈ 34, `ship_lng` ≈ -84** for a Georgia address,
      `ship_geocode_source` = `census`

⚠️ **The geocode is the least proven thing in this list.** It was written in a
sandbox with **no outbound DNS**, so the live Census service was never called.
The parser is tested against the exact JSON in the Census API documentation
(revision 02/2026) and the URL against their documented example — but the round
trip is unproven. If `ship_lat` is null on a good address, the reason is in the
runtime log tagged `[geocode]`. This is a known gap, not a surprise.

`payment_3ds_*` being **null is normal and correct** — 3DS is not invoked on
most low-risk cards. Null means "not attempted", never "failed".

---

## 3. Abandoned checkout leaves a usable draft

Start a second checkout, fill page 1, then close the tab.

```sql
SELECT order_number, payment_status, guest_email, ship_phone, created_at
  FROM orders WHERE payment_status = 'draft' ORDER BY id DESC LIMIT 3;
```

- [ ] A `draft` row exists carrying a real email and phone
- [ ] `order_number` is a `DRAFT-<uuid>` placeholder, so no real number was burnt
- [ ] That draft does **not** appear in `/admin/orders`
- [ ] It is **not** counted in the revenue figure on the orders dashboard

---

## 4. Order detail page

🌐 `/admin/orders` → open the order from step 1.

- [ ] Customer name is a **name**, not the email address
- [ ] Phone shown
- [ ] Ship-to block shows the page 1 address
- [ ] Payment card shows "Auth Hold — pending capture" and a **7-day expiry
      countdown** from `payment_authorized_at`
- [ ] Risk panel lists the AVS/CVC checks and the Radar level
- [ ] **No 3DS row** if `payment_3ds_result` is null — silence is correct here
- [ ] **No** Early Fraud Warning banner, **no** chargeback banner

Then open any **older** order (one from before today):

- [ ] It looks **exactly as it did before** — no new banners, no 3DS row, no
      mismatch row. Every new column is null on those, and silence is correct.

---

## 5. Ship-to vs bill-to flag

Place a third order using a **different** billing address from the delivery
address (untick "same as billing" in the Stripe billing card).

- [ ] `ship_bill_mismatch` = 1 on that order
- [ ] Order detail shows a row noting delivery to a different address
- [ ] That row alone does **not** turn the risk pill red — gifts and job sites
      are ordinary, and a panel that reddens on them stops being read

---

## 6. Shipping form carries the delivery facts

🌐 `/admin/shipping/create?orderId=<id of the step 1 order>`

- [ ] **Phone is pre-filled** with the number typed on checkout page 1
      (this was empty on every guest order until 2026-09-26)
- [ ] Address 2 carried over
- [ ] **"Residential address" is pre-ticked**
- [ ] Location Type reads **RESIDENTIAL**
- [ ] **Liftgate Delivery is ON** — it follows the residential tick

⚠️ **Unproven:** no booking has been made with this payload. The form now
carries the phone and the residential flag, but WWEX has not been asked to
accept them. Booking a real test shipment is the only way to close this.

---

## 7. Does the Stripe session still carry an email?

**Open question, do not assume either way.** Answer it with the order from
step 1 — it must be a session created AFTER the three-page rewrite.

🌐 Stripe → sandbox → Developers → Workbench → **Events** → the newest
`checkout.session.completed` → JSON panel → `customer_details`.

- [ ] `customer_details.email` — populated, or null?
- [ ] `customer_details.phone` — should be populated via
      `actions.updatePhoneNumber()`. Null here means the delivery phone is
      not reaching Stripe either.

**Why it is open.** Page 3 mounts only the Billing Address Element and the
Payment Element. The Contact Details Element — which used to collect the
email — was removed in the rewrite. Nothing obviously populates
`customer_details.email` now, but that was not confirmed against a live
session.

`stripeService.js:254` still explains why `customer_email` is not set by
saying *"The Contact Details Element collects the address and the email on
the page."* **That comment is stale** — it describes a UI that no longer
exists. Whatever the answer, the comment needs correcting.

**Checked 2026-09-26 and found inconclusive:** the newest event available
was order 43 (`BVO-2026-09-26-00149`), created with the OLD single-page
checkout — identifiable by `billing_address_collection: "required"` and a
present `shipping_address_collection`, both since changed. It showed email,
phone and name populated, but by the element that has since been removed.

**If email is null:** set `customer_email` from the draft order at session
creation. There is no email field on page 3 for it to lock any more, so the
original objection no longer applies, and without it Stripe has no email for
receipts or dashboard search. The ORDER is unaffected either way — the
webhook's `COALESCE` keeps the page 1 email, which is why this cannot be
answered from the database.

---

## 8. Stripe webhooks

🌐 Stripe → sandbox → Workbench → Webhooks → `energetic-jubilee` → Event
deliveries.

- [ ] `checkout.session.completed` for the step 1 order shows **2xx**
- [ ] Endpoint lists all 7 events

A 400 means the webhook secret does not match, which is the failure that leaves
orders authorised with no address and no email — and it is silent from BVO's
side.

---

## VERIFIED

### 2026-09-27 — order `BVO-2026-09-27-00164`, one run, everything below passed

First order EVER to complete through the three-page checkout. Until
commit `2fb6a76` the flow could not take a payment at all — see
`OPEN_ITEMS` and that commit message.

| Checked | Result |
|---|---|
| Pages 1 → 2 → 3, card, success page | Completed |
| `payment_status` / `status` | `auth_only` / `confirmed` |
| Ship-to written as typed on page 1 | `554 Pine Grove Rd, Roswell, GA 30075` |
| `ship_phone` E.164 | `+14046555079` |
| `ship_address_type` | `residential` |
| `delivery_terms_ip` | populated — **IPv6**, `2600:1702:…`, so the 45-char column was the right call |
| `delivery_terms_version` | `2026-09-26.curbside.v1` |
| **Census geocode, LIVE** | **`34.027618, -84.377445`** — Roswell GA, `source=census` |
| `ship_geocoded_at` | `2026-09-27 03:17:19` |
| Success page copy | "Order received", "authorised, not yet charged", no receipt promise |
| Webhook fired | Yes — `auth_only` is only written by `handleSessionCompleted` |

**Correctly null / zero, not faults:**

- `payment_3ds_result` — 3DS is not invoked on a test card. Null means
  "not attempted", never "failed".
- `ship_bill_mismatch = 0` — billing matched the delivery address.
- `ship_phone_ext` — no extension was entered on this run.

**KNOWN GAP 1 IS CLOSED.** The geocoder was written in a sandbox with no
outbound DNS and had never once reached the live Census service. It
resolved a real Georgia address to the right point on the first live
call.

### 2026-09-27 — order detail page, order 00164

| Checked | Result |
|---|---|
| Customer name | "Mish Mish" — a name, not the email address |
| Phone and email shown | Yes |
| Ship-to block | Page 1 address, "Residential delivery" |
| Authorisation countdown (item 11) | "Auth Hold — pending capture · Expires in 7 days" |
| Risk panel | AVS/CVC checks, IP, **Radar: normal risk (score 1/99)** |
| 3DS row | **Absent** — correct, 3DS not invoked |
| Ship-to vs bill-to row | **Absent** — correct, addresses matched |
| EFW / chargeback banners | **Absent** — correct, no issuer activity |
| Timeline | `Payment Authorized · pending → auth_only` |

`payment_risk_score` DOES populate in sandbox (1/99), so the "null on
Lite/Standard" note in `detail.ejs` is about plan tier, not a bug.

### 2026-09-27 — WWEX shipping form, order 00164 (item 37)

`/admin/shipping/create?orderId=58`

| Checked | Result |
|---|---|
| Destination phone | **`+14046555079` pre-filled** — empty on every guest order before this |
| Contact name | `Mish Mish` |
| Address / city / state / ZIP | Carried from page 1 |
| "Residential address" checkbox | **Pre-ticked** from `ship_address_type` |
| Delivery Location Type | **`Residential`** |
| **Liftgate Delivery** | **Ticked** — the load-time sync fired |
| Residential Delivery accessorial | Ticked |
| Reference 1 | `Order BVO-2026-09-27-00164` |
| Rate returned | XPO Logistics, $186.29, 1 business day |

**Not booked.** Confirm & Book sends a real pickup request to the carrier
and was deliberately not pressed on a test order.

**Appointment handling — settled.** "Appointment Delivery" and "Notify Me
Before Delivery" are left OFF by choice. The appointment is arranged
through the delivery instruction *"Call receiver 24 hours in advance with
delivery window"* rather than by paying the carrier accessorial. That is
consistent with the page 2 curbside copy. Do not "fix" this.

⚠️ **Destination EMAIL was blank on this run.** Same defect the phone had:
`prefill.email` read `c.email`, which is NULL on every guest order. Fixed
in `8956fed` — `order.guest_email` first — but **not yet proven**: that
form was rendered before the fix deployed, and it only affects NEW
orders. `SHIPPING_WWEX_BRIEF.md` is explicit that `emailList` is required
and does not fall back to the contact email, so without it the customer
gets no carrier delivery alerts at all.

---

## KNOWN GAPS — cannot be closed by gates

| # | Gap | Why it stayed open | Closes when |
|---|---|---|---|
| ~~1~~ | ~~Census geocode round trip~~ | **CLOSED 2026-09-27** — resolved `34.027618, -84.377445` live on order 00164 | — |
| 2 | WWEX booking payload | Form verified 2026-09-27 (phone, residential, liftgate, rate returned) but **no booking placed** — Confirm & Book sends a real carrier pickup request | A real shipment is booked |
| 2b | Destination email on the shipping form | Fixed in `8956fed`, not yet deployed or seen. Without it WWEX sends NO delivery alerts | A NEW order's shipping form shows the email pre-filled |
| 3 | EFW and dispute banners | Fire only on real issuer activity | Stripe test event, or a real warning |
| 4 | `order_confirmed` email body | Deferred by Sam; live copy is a rejected draft | See `PRE_LAUNCH_CHECKLIST.md` |

---

## 2026-09-27 — Places autocomplete + address provenance (items 15, 17)

### Proven
- Ten address-intel columns exist on `orders` with the right types — confirmed
  by `SHOW COLUMNS` against the live database.
- 28 negative tests: every gate fails when the thing it claims to protect is
  broken, and the baseline is silent. Includes the two gate defects found by
  negative-testing rather than by reading (below).
- `addressProvenance` executed on 30 inputs: clean selection, edited house
  number, case/whitespace-only change, hand-typed, JS-off empty strings,
  forged `ship_address_source`, four junk Place IDs, five malformed snapshots,
  over-long formatted address.
- Field-by-field comparison demonstrated necessary: a joined-string version
  reports `autocomplete` for an address whose value moved between two fields.

### NOT proven — needs a browser
1. **A suggestion has never been fetched.** No live Places request has been
   made from this code. The request shape, the response field names
   (`placePrediction.mainText`, `.toPlace()`, `fetchFields`) and the
   `addressComponents` types are from Google's reference, not from a response
   we have seen. First real keystroke is the test.
2. **The referrer restriction has never been exercised.** The key is
   restricted to the hostingersite temp domain, the apex and `*.` subdomain.
   If the deployed host is not one of those three, every request returns
   `REQUEST_DENIED` and the field silently degrades — which looks exactly
   like "the library did not load".
3. **Whether the session actually terminates.** The billing claim — that
   autocomplete requests inside a terminated session are free — is untested.
   Check Cloud metrics after a handful of real checkouts: Autocomplete
   Requests billed should be near zero while Place Details matches the
   number of selections.
4. **The dropdown has never been rendered.** Positioning, z-index over the
   City/State row, and touch target size are unverified visually.
5. **`ship_address_source` has never been written by a real submit.** Expect
   `autocomplete` on a clean pick, `edited` after changing the house number,
   `typed` with JS off.

### Gate defects found by negative-testing, not by reading
- `<script[^>]*>` stops at the `>` inside `nonce="<%= cspNonce %>"`, slicing
  two characters of HTML onto the front of every script body and failing
  working code. Fixed by stripping EJS before locating script tags.
- An unanchored `/\/\/.*$/gm` comment-stripper eats the `//` in every
  `https://` URL, deleting the exact CSP entries the gate exists to find.
  Anchored to line-leading `//`.
- `token = null` matched the `var` declaration, so the gate passed while the
  post-selection reset was missing — the state that bills every request.
  Scoped to the code after `fetchFields(`.

### 2026-09-27, later — autocomplete was dead on arrival. CSP host.

Nine gates passed and the feature had never worked once, because none of
them opened the page.

**Places API (New) uses two hosts.** `maps.googleapis.com` serves the
library; `places.googleapis.com` receives the actual requests. G3 asserted
the first and proved nothing about the second. Asserting the host a SCRIPT
comes from says nothing about the host its REQUESTS go to.

The failure is quiet by design: library loads, classes exist, then every
keystroke returns `RpcError: Rpc failed due to xhr error ... error code: 6`
— which reads like a network fault. The page's own error handling then
degrades the field to a plain input and says nothing, which is correct
behaviour and also why nothing on screen explains it.

**Address Validation will be a THIRD host:
`addressvalidation.googleapis.com`.** Not in the CSP yet, deliberately —
nothing calls it. Add it with that feature or item 16 fails identically.

**Rule going forward:** a gate on a third-party integration asserts the
host the *requests* go to, verified from a real response or a real console
error. Not the host in the script tag.

### Still unproven after this fix
The CSP block is proven. What is behind it is not — the key's referrer
restriction and whether Places API (New) is enabled on the project have
never been exercised, because the request never left the browser. If
autocomplete still returns nothing after deploying, the console error will
now be a Google error (`REQUEST_DENIED`, `PERMISSION_DENIED`,
`RefererNotAllowedMapError`) rather than a transport error, and that names
the cause directly.

### 2026-09-27 — three separate causes, one feature, all gates green

Autocomplete had never worked once. Three independent faults, each hiding
the next, none findable by reading code:

1. **CSP** — `connect-src` allowed `maps.googleapis.com` (the library) but
   not `places.googleapis.com` (the requests).
2. **Cloud project** — Places API (New) was not enabled. "Places API" and
   "Places API (New)" are separate products; the legacy one was on.
3. **Loader race** — the promise resolved on `script.onload`, which fires
   BEFORE the API installs `google.maps.importLibrary`. Measured:
   `importLibrary type at onload: undefined` → TypeError. Fixed with
   Google's documented `&callback=`.

Fault 3 is the instructive one. The library kept loading after the
rejection, so within ~300ms `google.maps` was fully present and every
outward sign said healthy. The only evidence was a rejected promise that
`giveUp()` swallowed — correctly, since a buyer can do nothing about it.
Graceful degradation and silent failure are the same mechanism seen from
two sides.

**What this cost:** three deploys. Every gate was green throughout.

**The rule that would have caught all three:** a feature that talks to a
third party is not verified until someone opens the page and reads the
actual response or the actual error. Gates prove the code says what we
meant. They cannot prove the other end agrees.
