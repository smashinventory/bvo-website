# BVO — Payment Risk & Checkout Scope

**Status:** approved scope, nothing built unless a line says BUILT.
**Opened:** 2026-09-26
**Owner decisions:** recorded inline, dated. Do not relitigate a dated decision.
**Related:** `BVO_CHECKOUT_SPEC.md` (three-page checkout),
`BVO_COMMERCE_STACK_BRIEF.md` (payment lifecycle)

> **Read this first if you are a new session.** This file exists because
> this scope spans multiple sessions. Everything the owner has decided is
> recorded here with the reasoning. If you find yourself about to argue a
> point, check §9 first — it is probably already settled and the argument
> was probably already had and lost.

---

## 0. State of play, 2026-09-26

**Live and working:** three-page checkout (information → delivery →
payment), Stripe payments end to end, manual capture, guest only.

**Not built:** everything in §2 through §7 below.

**Uncommitted / undeployed:**
- `contacts` on the Billing Address Element (§6.3) — written, gates pass
- `billing_address_collection: 'auto'` (§6.1) — approved 2026-09-26, built

**Done by owner, 2026-09-26:**
- Link disabled in the Stripe dashboard (§6.2)
- Stripe confirmed cancellation after six months is possible (§4.4)

---

## 1. Why this scope exists

BVO sells $1,200–$4,000 freight-delivered goods to first-time buyers, as
a new storefront with thin cash reserves. Two consequences drive
everything here:

1. **A single fraud loss is a cash-flow event, not a line item.** The
   business cannot absorb a $10k hit at month three even if it is
   statistically unlikely. This is a variance problem, not an
   expected-value problem — which is why Chargeback Protection is being
   bought despite being poor value on average (§9.4).
2. **Freight buys time.** The goods do not move for days. Authorise now,
   capture later, and a fraudulent order can be cancelled before anything
   is lost. This is BVO's single biggest structural advantage over a
   retailer who ships same-day, and most of §2 exists to exploit it.

---

## 2. Payment risk — build

### 2.1 Early Fraud Warning webhook  `radar.early_fraud_warning.created`

Stripe emits this when an issuer reports a charge as fraudulent **before**
any chargeback exists. Because BVO does not capture at checkout, an EFW
arriving pre-capture means: cancel the authorisation, lose nothing — no
goods, no chargeback, no dispute fee.

Highest value per hour of work in this document. Currently the warning
goes to an email address nobody watches.

- Subscribe the webhook (same raw-body mount as the existing one)
- Flag on `orders`
- Loud banner on the order detail page
- Email alert to staff

### 2.2 Dispute webhooks  `charge.dispute.created` / `.updated` / `.closed`

Chargebacks have hard deadlines and currently arrive only as Stripe email.
Store the dispute id, reason code, amount and evidence-due date on the
order and surface them. Evidence assembly stays manual at current volume.

### 2.3 Capture the 3DS outcome

`paymentDetailsFrom()` in `src/services/stripeService.js` reads the card
checks and the Radar outcome but never touches `three_d_secure`. Capture:

- `three_d_secure.result`
- `three_d_secure.authentication_flow`
- `three_d_secure.electronic_commerce_indicator`

Display on the existing Order Risk card. Without it the person clicking
Capture cannot tell whether authentication ran, and the evidence that most
helps in a dispute is not recorded.

**Do not confuse this with Standalone 3DS** (§9.3) — that is a different
product BVO does not need.

### 2.4 Capture checklist

The riskiest moment in the business is a human clicking Capture on a
$2,295 order. Today that button sits beside a risk panel they may not
read. Make the signals block the click.

Require a confirmation, naming the reason, when any of:
- Radar risk level elevated
- CVC check failed
- AVS (zip or line1) failed
- ship-to ≠ bill-to

Log the override to `order_events` with the acting user.

Interacts with Chargeback Protection: manually approving a Stripe-flagged
transaction **voids coverage on that transaction** (§4.2). The checklist
is where that must be said.

### 2.5 Ship-to vs bill-to comparison

Both addresses are now stored separately. Nothing compares them. Oldest
card-not-present signal there is; one function.

### 2.6 Velocity checks in BVO's own database

Radar sees Stripe's view of the world. BVO sees its own. Flag:
- same email, multiple cards, short window
- multiple orders to one address under different names
- several failed authorisations followed by a success

On-write or nightly; flag the order, do not block.

### 2.7 Record the Chargeback Protection premium per order

Write 0.4% of the order total at time of sale. In six months the exit
decision (§4.3) becomes "we paid $X, we recovered $Y" instead of a
reconstruction from Stripe exports.

### 2.8 Show coverage status on the order detail page

Whether this order is covered by Chargeback Protection, visible at the
moment of the capture decision — because overriding a flag removes it.

---

## 3. Payment risk — operational (no code)

### 3.1 Phone first-time orders above a threshold before capture
Unglamorous, effective, standard in furniture retail. The consignee phone
is already collected for the carrier. A fraudster rarely answers.

### 3.2 Order confirmation email that does work
It goes to the cardholder's address. A real buyer ignores it; a
compromised cardholder replies immediately — and **before capture**. State
plainly what was ordered, where it is going, and that they can stop it.

### 3.3 Documented capture window
Card authorisations expire around seven days. Capturing at day six
maximises the EFW window; capturing at hour one throws it away. Make it a
written rule, and show the authorisation expiry on the order so no hold
lapses by accident.

### 3.4 Preserve terms-acceptance evidence
Timestamp, IP, and the version of the copy agreed to. Pieces exist
(`delivery_terms_ack_at`); nothing assembles them.

---

## 4. Stripe Chargeback Protection

### 4.1 Terms, verified 2026-09-26
- **0.40% of every successful transaction**, on top of normal rates.
  Standard pricing 2.9% + 30¢ becomes 3.3% + 30¢.
- Reimbursement capped **$25,000 per calendar year** (≈ eleven BVO
  orders). Cap counts disputed amounts *and* waived dispute fees.
- Covers **fraud reason codes only** on one-time, customer-entered card
  transactions: Visa 10.4; Mastercard 4837, 4804; Discover UA02; Amex
  FR2/FR4/F29/4534/4540.
- **Not** covered: item-not-received, not-as-described, any
  dissatisfaction dispute, recurring payments.

### 4.2 The exclusion that matters
**Manually approving a Stripe-flagged transaction voids coverage on it.**
BVO's model is a human reviewing before capture, so this will happen. See
§2.4 and §2.8.

### 4.3 Owner decision, 2026-09-26 — ENABLE, for roughly six months
Reasoning, in the owner's words: *"We are more vulnerable now than we will
be in 6 months financially."* Bought as tail-risk cover during the period
of thinnest reserves, not on expected value.

**Exit is two conditions, not a date:**
1. Enough matured data — six months of sales *plus* dispute lag
   (fraud codes commonly surface 75–120 days after the sale), so do not
   switch off on the calendar date while recent months are unresolved
2. Cash reserve sufficient to self-insure

### 4.4 Confirmed with Stripe, 2026-09-26
Cancellation after six months is possible — owner confirmed with Stripe.

Still worth holding the written reply on the narrower question: whether
coverage persists on transactions **placed while active** but disputed
after cancellation. Fraud codes commonly surface 75-120 days after the
sale, so a meaningful share of the protected period's disputes will land
post-cancellation. If that answer is not already in writing, get it before
the exit rather than at it.

---

## 5. Address & delivery data

**Owner decision, 2026-09-26: Google Places. Decided. Do not re-open.**

### 5.1 Google Places Autocomplete on page 1
Paid, per session. Stops typos by making the buyer pick from a list.

**Does NOT validate deliverability** — no ZIP+4, no DPV, will not catch a
missing apartment number. Google sells that separately (Address Validation
API, paid). USPS Addresses 3.0 does deliverability free but has no
type-ahead. Three different products; do not conflate them.

### 5.2 API key hygiene
Google Cloud account, key restricted by HTTP referrer, billing alert set.

### 5.3 Store the Place ID and Google's formatted address
Alongside the typed fields, not instead of them.

### 5.4 US Census geocoder — free, no key
`geocoding.geo.census.gov`, US addresses → lat/lng. Needed because Street
View wants coordinates and Google's Geocoding API is paid.

### 5.5 Store lat/lng on the order

### 5.6 Street View embed on the admin delivery page
**Maps Embed API is free with unlimited usage** — verified on Google's
docs 2026-09-26. Street View panorama via plain iframe, no JavaScript.

Business value, not decoration: before dispatch, whoever books the freight
can see whether there is a driveway, whether a 53-foot trailer can turn,
whether the approach is steep, whether there are steps from the curb.
Those are the conditions that become refused deliveries and surcharges.

### 5.7 Fallback when imagery does not exist
Rural and new-build addresses often have none. **Street View Metadata API
is free with unlimited usage** — call it first and render the aerial alone
with an explanatory line rather than an empty grey box.

---

## 5A. SETTLED 2026-09-27 — Google vs Mapbox, costed. Do not re-open.

Mapbox was evaluated seriously and rejected on the numbers below. The
earlier note that Mapbox offers "100,000 free requests/month" is WRONG —
Address Autofill is **1,000 free sessions/month**, then $12.50/1,000.

### 5A.1 How each one bills — this is the whole argument

**Mapbox** bills per SESSION, and a session is billable **even when nobody
selects anything**: `/suggest` followed by `/retrieve`, OR `/suggest` with
no `/retrieve` within 180 seconds. Keystroke count is irrelevant. Every
shopper who touches the field costs one session.

**Google** bills per REQUEST, but the session terminator decides whether
those requests are free:

| Session outcome | Autocomplete requests |
|---|---|
| Terminated by **Address Validation** | **FREE** (SKU: Autocomplete Session Usage) |
| Terminated by Place Details Essentials | first 12 billed, rest free |
| Terminated by Place Details **IDs Only** | ALL billed — the free terminator poisons the session |
| **Abandoned** (no terminator) | ALL billed per-request |

So under the "Autocomplete for checkout and delivery" pattern, **buyers who
complete cost nothing for autocomplete**. Only abandoners do. That inverts
the usual intuition: abandonment is the cost driver, not orders.

### 5A.2 The prices that matter (Google global list, 2026-09-27)

| SKU | Free cap/month | Then |
|---|---|---|
| Autocomplete Requests | 10,000 | $2.83/1,000 |
| Autocomplete Session Usage | **Unlimited** | — |
| Address Validation **Enterprise** | **1,000** | $25.00/1,000 |
| Address Validation **Pro** | 5,000 | $17.00/1,000 |
| Place Details Essentials | 10,000 | $5.00/1,000 |
| **Maps Embed** | **Unlimited** | — |
| **Street View Metadata** | **Unlimited** | — |

### 5A.3 Modelled: 100 shoppers/month, 25 complete, 75 abandon after 10 keystrokes

| Line | Volume | Cost |
|---|---|---|
| 25 completers, autocomplete | ~250 req | $0 (Session Usage) |
| 25 completers, Address Validation | 25 | $0 (cap 1,000) |
| 75 abandoners, autocomplete | 750 req | $0 (cap 10,000) |
| **TOTAL** | | **$0** |

At list price with no free caps at all: **$2.75/month.** Mapbox on the same
scenario is $1.25 at list. A one-dollar difference decided nothing.

### 5A.4 Can it exceed $50 under 200 shoppers/month? Only via a fault.

$50 on Autocomplete Requests needs 27,668 requests — the 10,000 free cap
plus 17,668 billable. That is **138 requests per shopper at 200/month**, or
277 at 100/month. A long US address is 35–45 keystrokes, so even with zero
debouncing and no session tokens, 200 shoppers cannot reach the free cap.

Every other per-order SKU is inside its cap at 200 shoppers, including the
most expensive ones.

**The two real risks are a request loop and a scraped key** — neither
related to traffic volume. See 5A.6.

### 5A.5 Where it genuinely starts to cost

Not autocomplete. **Address Validation Enterprise, whose free cap is 1,000/
month** — the smallest cap in the Places stack, and the one tied directly to
order count. Crossed at 1,000 orders/month, then $25/1,000.

**Arbitrage for later:** Address Validation **Pro** is $17/1,000 with a
5,000 free cap, but Pro rates only apply when it is called OUTSIDE a
session — terminating a session with Address Validation always bills at
Enterprise. Past ~1,000 orders/month it becomes cheaper to break the session
and call Pro separately, losing free autocomplete on completers but gaining
a 5× larger validation cap. Do not build this now; revisit at 1,000
orders/month.

### 5A.6 Cost guards — BUILT 2026-09-27 ✅

**All four are live.** Project `bathroom-vanities-outlet`, key
"BVO Storefront — Maps".

| Guard | Setting as built |
|---|---|
| Referrer restriction | 3 patterns: the hostingersite temp domain, apex, and `*.` subdomain |
| API restriction | 4 APIs — Places (New), Address Validation, Maps Embed, Street View Static |
| Budget alert | $10/month, 50/90/100% on actual spend |
| Quota cap | Places API: **2,000 requests/day, 100/minute** |

**Two billing accounts exist** — `01476C-094F74-9E406B`
("My Maps Billing Account - BVO") and `01ED66-7F8A4D-ABDA90`
("My Billing Account"). It was not obvious which one the project bills to,
so **the $10 budget was created on BOTH**. A budget on the wrong account
watches nothing and never fires; two budgets cost nothing and remove the
guesswork. Do not "tidy up" by deleting one without first confirming the
project's linked account.

**Quota maths, recorded so the numbers are not re-derived:** 2,000/day is
60,000/month against a 10,000 free cap, so a loop running at the daily
ceiling all month would cost about $141. Real usage at 100 shoppers/month
with debouncing is 10–30 requests/day, so the cap is 60–200× actual. A
tighter 500/day would bound the worst case near $14 and still leave 15–50×
headroom — worth lowering if volume stays flat. 350/day would stay entirely
inside the free cap.

⚠️ **Street View Static API is enabled for its METADATA endpoint, not for
images.** Metadata is the free, unlimited call that reports whether a
panorama exists at given coordinates — that is what powers the §5.7
fallback. Aerial View API was deliberately NOT enabled; see 5A.7.

### 5A.6b Three unrestricted keys found and deleted — 2026-09-27

The project carried four API keys dating from Nov 2021, Nov 2022 and Feb
2023. **Three had no restrictions at all.**

Until billing was enabled that was a nuisance — an unrestricted key on a
project with no card simply gets denied. Enabling billing turned them into
a live liability: an unrestricted key is usable by anyone who holds it,
from anywhere, against any API enabled on the project, billed to the card.

Verified before acting: `grep` across `src/`, `views/`, `public/`,
`server.js` and `package.json` found **zero** references to any Google API
key or `maps.googleapis` URL. The BVO codebase does not use one. Metrics
showed zero traffic on all four. All were tied to old projects.

**All four deleted, one fresh restricted key created.**

If a key ever shows traffic, do NOT delete it blind — it may belong to the
Shopify store, which stays live until cutover. Restrict it to that domain
instead.

---

### 5A.6c The original approved list, for reference

All four, not a subset:

1. **HTTP referrer restriction** on the key — `bathroomvanitiesoutlet.com/*`
   only. The key ships in client-side JavaScript and is visible to anyone
   viewing source; this is what stops a scraped key being billed to us.
2. **API restriction** — Places API, Address Validation and Maps Embed only.
3. **Budget alert** at $10/month, so a fault surfaces within a day instead
   of on the invoice.
4. **Cloud quota cap** — a hard daily ceiling on the Autocomplete Requests
   SKU. Bounds a runaway loop to one day's quota.

**Debounce from the start.** Fire on a ~300ms pause, not per keystroke. Ten
requests becomes three, which triples the headroom before the free cap and
costs the buyer nothing. This is the single most effective control and it is
free.

### 5A.7 Aerial + Street View — both free, one product

The admin delivery panel needs no paid SKU:

- **Aerial** — Maps Embed `/embed/v1/view` with `maptype=satellite`, centred
  on the `ship_lat`/`ship_lng` already stored from Census. No geocoding
  call, no Places call.
- **Street View** — Maps Embed `/embed/v1/streetview` at the same
  coordinates, offered as a toggle beside the aerial.
- **Availability** — Street View Metadata, unlimited free, called first.

⚠️ **Do not use the "Aerial View" SKU** (Pro, $16/1,000, cap 5,000) in the
price list. That is Google's cinematic 3D flyover VIDEO product, not
satellite imagery of a house. Satellite imagery is just `maptype=satellite`
on an ordinary free embed. The names are close enough to pick wrong.

### 5A.8 Two implementation traps

**CSP.** Embeds are iframes from `https://www.google.com`. BVO sends a
Content-Security-Policy, so `frame-src` needs that origin or the panel
renders blank with only a console error — no other symptom.

**Key scope.** The same key needs Maps Embed enabled alongside Places and
Address Validation. Referrer restriction still works; the admin pages are on
the same domain.

---

## 6. Checkout — reduce duplicate data entry

Owner, 2026-09-26: *"I am not liking this set up at all. It is repetitive
and clumsy."* He was right. Page 3 asks for seven fields already given on
page 1, plus Link asking again for email and phone.

**Root cause:** the billing address and card fields are **cross-origin
iframes on `js.stripe.com`**. Same-origin policy means BVO's JavaScript
cannot read or write a character inside them. That wall is what keeps card
data out of PCI scope. The only lever is to *ask for less*.

Measured on the live page, 2026-09-26 — do not retry these:
```
createBillingAddressElement({defaultValues: …})
  → "options.defaultValues is not an accepted parameter"
updateBillingAddress(…)
  → session set, element stays empty, complete: false
contacts / display / autocomplete
  → ACCEPTED
```

### 6.1 `billing_address_collection` → `'auto'`  [APPROVED 2026-09-26, BUILT]
Collects country + postcode instead of a seven-field address.
**Cost, accepted deliberately:** street-level AVS drops to postcode AVS +
CVC. Compensating controls are §2.1, §2.3, §2.4, §2.5.
**Supersedes** `BVO_CHECKOUT_SPEC.md` §5, which says `'required'`.

### 6.2 Link off  [DONE 2026-09-26 by owner, dashboard]
Removes "Save my information", the duplicate email field and the duplicate
mobile-number field from the Payment card. Reversible from the same place
if BVO later wants one-tap for returning Link users.

### 6.3 `contacts` on the Billing Address Element  [BUILT, NOT PUSHED]
Offers the delivery address as a one-click pick. The only prefill route
Stripe permits — the buyer's own click inside the iframe is what marks the
element complete and satisfies `canConfirm`.

Contacts JSON is escaped (`<`) before entering the `<script>` block;
a buyer name containing `</script>` would otherwise end it.

### 6.4 Audit every field on pages 1–3 against "asked once"

### 6.5 Read-only recaps carry data forward; no field editable on two pages
Two editable copies of one fact is a defect, not a convenience.

---

## 7. Checkout stages 2 and 3

From `BVO_CHECKOUT_SPEC.md` §7, decided 2026-09-26.

### Stage 2 — accounts
- Sign in / register / **guest**, all three offered on page 1
- **Passwordless** — six-digit email code IS the login; no passwords
  stored, no reset flow, no credential-stuffing surface, no breach
  liability. A buyer without email access cannot log in; acceptable for a
  business whose entire post-purchase relationship is email.
- Verification **before checkout**, Wayfair-style. Consequence: guests get
  verified too. That is deliberate — email is the only channel for the
  delivery appointment, and a typo'd address means an order that cannot be
  delivered. Do not remove it as redundant.
- Limits: 10-minute expiry, single use, 5 wrong attempts then dead,
  resend after 60s, max 3 resends, **5 codes per email per hour**,
  **10 per IP per hour**. Store the code hashed.
- Identical response whether or not an email has an account — otherwise
  the endpoint enumerates customers.
- "Remember this device" cookie, 90 days.

**Why the per-email cap matters, and it is not the obvious reason:**
without it anyone can type a stranger's address repeatedly and make BVO
send that stranger mail. Enough complaints and Brevo's deliverability
reputation degrades — the same channel that carries order confirmations
and delivery appointments.

### Stage 3 — returning buyers
- Saved addresses in `customer_addresses` (table already exists)
- One default per customer; "set as default delivery address"
- Prefill page 1

**Explicitly out of scope:** saved cards (§9.5), order-history portal,
address-book CRUD screen. These grow into a customer-accounts project.

---

## 8. Carried over from earlier work

- **Tax sourced from delivery address, not billing.** Currently billing.
  Wrong for tangible goods when they differ. Dormant while Georgia is
  unregistered; a real liability at go-live. Untested candidate:
  `permissions.update_shipping_details` + `updateShippingAddress()` with
  no collection flag. **Test against a live session before designing
  around it.**
- **Policy language** — right to decline an order unilaterally; right to
  pass a shipping upcharge to the buyer for acceptance before the order is
  consummated. Draft for an attorney, not as final wording.
- **Strip `?debug=1`** panel, `window.__ck` SDK enumeration, `dbg()` calls.
- **Success page copy** — "You'll receive an email receipt shortly" is
  inaccurate under authorise-then-capture.
- **`order_confirmed` email rewrite** — authorised, not charged.
- **WWEX booking payload** — send `ship_phone` and the residential flag.
  Data is captured; not yet sent.
- **Go-live:** Apple Pay domain registration; activate Link/Klarna/Affirm
  /Cash App if wanted (all sandbox-only today); live keys; live webhook
  endpoint; Stripe Tax + Georgia registration active.

---

## 9. Settled — do not re-open

**9.1 Multi-page checkout.** Proposed by the owner three times on
2026-09-25/26 and argued against twice before being accepted. Both
objections were wrong. Stripe's Shipping Address Element cannot be
pre-filled (`defaultValues` rejected) and cannot be satisfied via the API
(`updateShippingAddress` leaves it `complete: false`), so BVO must own the
ship-to field, which means collecting it before Stripe exists.

**9.2 `shipping_address_collection` stays OFF.** Enabling it makes
`canConfirm` depend on a mounted, complete Shipping Address Element. With
no second address typed, Place Order is permanently unclickable. Enabled
and removed the same day, 2026-09-26.

**9.3 Standalone 3DS — not needed.** It decouples authentication from
authorization so you can authenticate on Stripe and charge elsewhere. BVO
charges on Stripe. Requires an Account Executive and Interchange Plus
pricing. The automatic 3DS already configured is the right product.

**9.4 Chargeback Protection — ENABLE.** See §4.3. The expected-value
argument against it was the wrong lens; this is variance cover during the
thin-reserve period.

**9.5 No stored card credentials.** Nothing on BVO's database, nothing
saved to Stripe for reuse. `setup_future_usage` unset, no Customer
created. Link's wallet is the buyer's own relationship with Stripe and
adds no BVO liability — confirmed 2026-09-26 — so Link is a UX decision
(§6.2), not a liability one.

**9.6 Curbside only.** One delivery level, free, no paid upgrade. Buyers
needing more are routed to contact. Copy in `BVO_CHECKOUT_SPEC.md` §4.

**9.7 Liability shift is never guaranteed.** Stripe's docs are explicit.
Do not state or imply that successful 3DS guarantees it. An unanswered
dispute *inquiry* on a 3DS charge can trigger a "no-reply" chargeback that
invalidates the shift entirely — inquiries must be answered.

---

## 10. Suggested sequence

1. §2.1, §2.3, §2.5 together — same files, same webhook work, and they
   make the Order Risk card worth reading
2. §2.4 — makes it bite
3. §2.2
4. §4.4 → §4.3 — confirm the terms, then enable
5. §6.2 + §6.1 + §6.3 — the repetition fixes, cheapest first
6. §5 — Google Places, geocode, Street View
7. §7 stage 2, then stage 3

---

## 11. Process notes for future sessions

Recorded because they cost real time on 2026-09-26.

- **Read the running page, not the documentation.** Four bugs in one day —
  `confirm()`, the `tax` key, the shipping mirror, `defaultValues` — all
  came from writing against how Stripe's API ought to behave. Each was two
  minutes to disprove in a browser console.
- **A gate that has never been seen to fail has not been tested.** Three
  gates on 2026-09-26 asserted nothing: one matched `payment_status` when
  it meant `status`, one used `\b` after a quote where no word boundary
  can occur, one only neutralised `<%=` and failed on healthy code.
- **Gates read the working tree; `git add` populates the index.** A commit
  went out containing only a rename because one stale pathspec made
  `git add` abort, with the error suppressed. Every gate still passed.
- **Approving a plan approves the whole build described in it** (CLAUDE.md
  rule 1). It does **not** approve changes the plan specifies otherwise —
  `billing_address_collection` was changed against the spec without
  asking. See §6.1.
- **A fire-and-forget write that something downstream depends on is not
  fire-and-forget.** `saveDelivery`'s `.catch()` swallowed a missing-column
  error; the payment page then bounced the buyer back forever with no
  message.
