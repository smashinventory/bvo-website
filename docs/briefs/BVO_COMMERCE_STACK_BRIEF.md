# BVO Commerce Stack — payments, order lifecycle, roles and money actions

> The canonical record of how BVO takes money, what happens to an order between
> checkout and delivery, who is allowed to do what, and what is deliberately not
> built yet. Read this before touching checkout, orders, returns, or anything
> that moves money.

*Written 2026-09-25. Supersedes the payment sections of
`docs/audits/BVO_SECURITY_AUDIT.md` (Clover-era) and item 5 of
`docs/00-start/OPEN_ITEMS.md` (Authorize.net-era).*

---

## 0. Read this first — why this brief exists

This document exists because the payment stack has been designed three times
and built twice, and **none of it ever went live.** Every session that picks
this up re-derives the same context from dead code and reaches the wrong
conclusion, because the code on disk describes intentions that were never
tested and in one case never even had an account behind them.

On 2026-09-25 a session spent several rounds inferring the business process
from `authOnly()` and a capture endpoint, produced a confident impact analysis
built on stranded-order and chargeback-window risks that **could not exist**,
and had to be corrected four times. The corrections are recorded in §11 so the
same holes are not fallen into again.

**The single most important fact in this document:**

> BVO has never processed a payment. There are no live orders, no settled
> transactions, no chargebacks, and no merchant account history. Any analysis
> that begins "existing orders will be affected" is wrong.

---

## 1. Payment provider history — and why the code lies

| Phase | Provider | Status | Evidence left in the repo |
|---|---|---|---|
| 1 | **Clover** Hosted Checkout | Abandoned | Stale comments in `routes/checkout.js`; the whole of `BVO_SECURITY_AUDIT.md` |
| 2 | **Authorize.net** AcceptUI | Built, never activated — **the merchant account was never approved and never existed** | `authorizeNetService.js`, `checkoutController.js`, CSP hosts in `server.js` |
| 3 | **Stripe** | **Committed 2026-09-25.** Current direction | — |

Consequences that matter:

- **No Authorize.net code has ever executed.** Not in production, not in
  sandbox. There were never credentials. Do not treat any of it as a
  known-good reference implementation.
- **FraudLabs Pro was real** — a Micro plan (500 queries/month) with a live
  API key. **Cancelled 2026-09-25.** Its code is now calling a dead endpoint.
- Every Clover and Authorize.net reference is to be removed or amended to
  Stripe. Nothing is to be kept for compatibility.

---

## 2. The order lifecycle — canonical

**This is the process. It is not inferred from code; it was stated by the owner
on 2026-09-25. Where code disagrees with this section, the code is wrong.**

```
  STEP 1   Customer places order
           → card is AUTHORIZED, not charged
           → order enters admin for validation

  STEP 2   Staff validate before capture — three separate checks
           → FRAUD        call the customer, confirm they placed the order
                          (standard practice, every order, above and beyond
                          any automated screening)
           → DELIVERY     ask about access restrictions — steep driveway,
                          mountain roads, narrow access, anything the freight
                          carrier needs to know
           → AVAILABILITY confirm stock. If vendor stock is 2 or below, call
                          the vendor for verbal confirmation — inventory is
                          first-come-first-served across all their resellers
                          and we cannot see other resellers' incoming orders

  STEP 3   Once validated — typically within 48 hours
           → CAPTURE payment
           → THEN send the order to the vendor

  STEP 4   Vendor confirms goods ready for pickup
           → order/schedule freight
```

### Why the order of Step 3 matters

Payment is captured **before** the vendor order is placed, not after. The
vendor commitment is made against money already collected.

### The authorisation clock

Card authorisations are valid **7 days** for online payments (Visa,
Mastercard, Amex, Discover — all 7). The 48-hour working window sits
comfortably inside it, so expiry is not a routine concern — **but it is a real
failure mode when an order stalls**, and nothing currently tracks it.

Required: a warning at **day 5**, escalating to **day 7**, that an
authorisation is about to lapse. See §8.

**Authorisation and order creation are simultaneous and treated as one event.**
Re-authorising a lapsed hold is out of scope; if an auth expires the order is
handled manually.

---

## 3. What exists today (2026-09-25)

### Payment path

| File | Role |
|---|---|
| `src/services/authorizeNetService.js` | `authOnly()` + `captureTransaction()`. Nothing else — **no refund, no void, no cancel** |
| `src/services/fraudLabsService.js` | Pre-authorisation screening. Account cancelled |
| `src/controllers/checkoutController.js` | Cart → FraudLabs → authOnly → INSERT order → confirmation email |
| `views/pages/checkout.ejs` | AcceptUI hosted iframe; `dataDescriptor` / `dataValue` hidden inputs |
| `src/controllers/ordersController.js` | `capturePayment` at ~line 537; route `POST /admin/orders/:id/capture` |
| `views/pages/admin/orders/detail.ejs` | Capture button ×2 (header + payment card). Risk panel reads Authorize.net AVS/CVV/AFDS codes |

### The capture UI, as built

`doCapture()` prompts for a verification note, **blocks if blank**, saves it as
`[Pre-capture review] …`, then captures. Owner has confirmed the note should
stay **mandatory** — initials or a "Y" are acceptable content.

Capture is always the **full `order.total`**. There is no partial capture
anywhere in the UI.

### Two independent status fields

- `orders.status` — 8 values, driven by the vendor and freight lifecycle.
  Defined in `src/config/orderStatuses.js`.
- `orders.payment_status` — `auth_only` → `captured`.

**They do not interact.** Capture does not advance `status`; shipping does not
touch `payment_status`.

### Notifications — 5 Brevo templates

| Template | Fires when |
|---|---|
| `order_confirmed` | Checkout, after commit, fire-and-forget. On **authorisation**, not capture |
| `vanity_in_preparation` | Vendor PO sent |
| `order_shipped` | Freight booking succeeds |
| `return_approved` / `return_resolved` | Returns flow |

**No email fires on capture today.**

### What does not exist at all

- Refund, void, or cancel — of any kind, anywhere
- Sales tax (`calcTotal()` is line items × qty minus bundle discount)
- Shipping charges
- Authorisation-expiry tracking
- Any webhook endpoint
- **Any staff/user concept** — admin auth is a single shared credential pair
  in env vars (`ADMIN_USER` + `ADMIN_PW_B64`). `req.session.adminUser`
  resolves to the literal string `'admin'`, so every `order_events` row is
  attributed to nobody
- SMS of any kind — `brevoService` calls exactly one endpoint,
  `/v3/smtp/email`

---

## 4. Stripe — target design

### Integration shape: Elements backed by the Checkout Sessions API

**Embedded form on our own page.** Not the Stripe-hosted full-page redirect.

The reasoning, because it is not obvious: Stripe Tax on a bare PaymentIntent
means driving the Tax API by hand — create a Calculation, collect the address,
recalculate on change, update the amount, record a Transaction after payment.
Each step is a place to drift, and the failure mode is undercharged sales tax
nobody notices until a filing.

A **Checkout Session with `ui_mode: 'elements'`** backs the same embedded
Payment Element, on our page, with our styling — while Stripe owns the tax
calculation via `automatic_tax`. Embedded form *and* automatic tax.

Confirmed to support manual capture:

```
mode=payment
ui_mode=elements
payment_intent_data[capture_method]=manual
```

Docs: `docs.stripe.com/tax/checkout/elements`,
`docs.stripe.com/payments/place-a-hold-on-a-payment-method`

### Non-negotiable: preserve PCI SAQ A

The existing comment at `checkoutController.js:43-53` records why AcceptUI was
chosen — a hosted iframe means card data never touches a DOM node this site
controls, which is what puts BVO at **SAQ A** rather than SAQ A-EP.

**Stripe's Payment Element preserves SAQ A. Hand-rolled card inputs against
Stripe.js tokenisation do not.** This constraint is invisible in a diff and
must be stated to anyone writing the new checkout page.

### Order is written BEFORE the payment

The Authorize.net flow authorised, then inserted the order, and on DB failure
left the customer holding a transaction ID and a phone number
(`checkoutController.js:310-319`). Reverse it: write the order as `pending`
first, pass its id to Stripe in `metadata.order_id`, let the webhook flip it.
If the DB is down we never reach Stripe and no card is ever touched.

This also means the cart does not have to survive the round trip — a webhook
has no `req.session`.

### Amounts come from Stripe, not from us

Once `automatic_tax` is on, the total is whatever Stripe computes for the
customer's address. `calcTotal()` becomes the **pre-tax subtotal only**.
`orders.total` must be set from `session.amount_total`.

### Payment method availability narrows

ACH, iDEAL and SEPA cannot authorise and capture separately, so Stripe filters
them out of a manual-capture session. 18 methods are enabled in the Dashboard;
expect fewer to render. Offering them would require a separate
immediate-capture path — not in scope.

### Dashboard settings to check before go-live

- **Adaptive Pricing is On** — multi-currency conversion. BVO ships domestic
  LTL freight; switch it off.
- **Sandbox is named "Smash Inventory Solutions"** — the business name and
  statement descriptor must read as BathroomVanitiesOutlet or customers will
  not recognise the charge. Mismatch here is a leading cause of disputes.

### Radar — fraud screening

Stripe restructured Radar in 2026 into **four tiers: Lite, Standard, Plus,
Pro.** The name "Radar for Fraud Teams" still appears in their docs and is
legacy. Pricing moved to a subscription with included screens — any
per-transaction figures found in older sources are the previous model.

| Tier | Adds |
|---|---|
| Lite | Card fraud + card testing. Free on standard pricing |
| Standard | All payment methods. Stripe claims ~42% more fraud blocked than Lite |
| Plus | Custom rules + backtesting, risk tolerance, **0–99 risk score**, review queue |
| Pro | Multi-account and free-trial abuse |

**BVO's manual Step 2 changes the calculus.** Staff call every customer, so
100% of orders are already reviewed by a human — Radar's review queue is
largely redundant. What Radar is worth here is blocking the obvious before it
reaches a person, and giving staff a score to know which calls need harder
verification.

**Standard is the sensible floor. Plus earns its cost only if the 0–99 score is
surfaced on the order screen to triage calls.** Confirm actual tiers and prices
in the Dashboard — they are account-specific.

Radar replaces FraudLabs entirely. The six `fraudlabs_*` columns are replaced
by Radar equivalents (`risk_score`, `risk_level`, `seller_message`,
outcome-based AVS/CVC checks). Note the Stripe value domains differ from
Authorize.net's: card checks are `pass` / `fail` / `unavailable` / `unchecked`,
not letter codes.

---

## 5. Money actions — the full set

| Action | When valid | Effect |
|---|---|---|
| **Capture** | `payment_status = auth_only` | Takes the held funds |
| **Cancel order** | Before capture | Releases the authorisation. **No charge ever existed** — this is a cancel, not a refund |
| **Refund** | After capture | Returns the full captured amount |
| **Partial refund** | After capture | Returns part |
| **Write-off** | After capture | Records an uncollectible loss — see §6 |

### Cancelling an order whose payment is already captured

Must raise a confirmation prompt offering four outcomes, because they are
materially different:

1. Refund payment
2. Partially refund payment
3. Write off
4. Cancel without refund

Never silently pick one.

---

## 6. Write-offs

Purpose: tracking fraudulent and chargeback losses, and any other
uncollectible amount.

### Design principles

**A write-off is an event, never a mutation of the order.** Do not reduce
`orders.total` — that breaks reconciliation against Stripe and silently
rewrites historical revenue.

A separate table holds: order FK, amount, category, actor, timestamp, note.

**Partial write-offs must be supported.** Freight damage to one item while the
customer keeps the rest is the common case.

**Categories** — these are different business problems with different fixes,
and the split is what makes the KPI useful:

| Category | Signal |
|---|---|
| `chargeback` | Disputed and lost — screening or delivery-proof problem |
| `fraud_confirmed` | Verification gap |
| `goodwill` | Deliberate concession — a cost of service, not a failure |
| `damage_unrecovered` | Freight or vendor damage not claimed back |
| `uncollectible_other` | Everything else |

**Not reversible by deletion.** Accounting convention treats a write-off as
final and a later recovery as a separate event. Use
`type ENUM('writeoff','recovery')` in the same table so history is preserved
and the KPI nets out.

**KPI:** write-off value as a percentage of gross sales, split by category,
trended. That is the number that says whether Step 2 verification is working.

> Tax treatment of write-offs depends on accounting method. Confirm the
> category set with the accountant before it hardens.

---

## 7. Replacement orders

For goods lost or damaged in transit. This will happen; it is not an edge case.

### Design

A replacement **is a real order** — it needs a vendor PO, a shipment, tracking
and inventory movement, all of which hang off an order row. But it must never
count as revenue.

- `orders.order_type ENUM('sale','replacement','warranty') DEFAULT 'sale'`
- `orders.parent_order_id` — links to the original
- Typically its own vendor PO, though not necessarily
- Customer is typically **not** charged

**The discipline that matters: every revenue and AOV query must filter
`order_type = 'sale'`.** `ordersController.reportsView` currently does
`SUM(total)` with no filter at all. One missed filter and revenue inflates.
This is the most likely way this feature goes wrong later.

**Amounts:** set `total = 0`, and store the would-be value in a separate
column. Keeping the real price in `total` is tempting for cost measurement but
one unfiltered `SUM(total)` anywhere inflates revenue. Zero is the safe
default; the shadow column still measures what replacements cost.

### Write-offs and replacements are one ledger

A replacement is only free if the cost is recovered — a WWEX freight claim or a
JM warranty claim. Recovered, no loss. Not recovered, that cost **becomes a
write-off** under `damage_unrecovered`.

`order_returns` already carries `vendor_claim_filed` and
`vendor_claim_number`. The same concept must be reachable from a replacement,
so "what is damaged freight actually costing us" is answerable.

---

## 8. Authorisation-expiry alerting

Warn at **day 5**, escalate at **day 7**, that an authorisation will lapse if
not captured.

Delivery channels, all to be built:

- **Dashboard** — in-admin visible flag
- **Email**
- **SMS** — *deferred. Note kept for follow-up.* No SMS capability exists;
  `brevoService` is email-only. Brevo sells SMS on a separate endpoint (one
  vendor, one more key) or Twilio. Decision not yet made.

Recipients are staff assigned via admin preferences — which requires §9.

---

## 9. Roles and access control

Modelled on RFLPOS, which runs Laravel/UltimatePOS with Spatie
`roles` / `permissions` / `model_has_roles` / `model_has_permissions`.

**Simplify two things for BVO:**

- RFLPOS is multi-tenant (`business_id`, role names suffixed `Admin#7`).
  BVO is single-tenant — drop both.
- Spatie's polymorphic `model_type` / `model_id` exists to attach roles to
  several model classes. BVO has one user type — a plain FK is clearer.

**Keep:** granular permission naming (`orders.capture`, `orders.refund`,
`orders.writeoff`), and per-user permission grants layered on top of a role for
the one-off exception.

### Roles

| Role | Access |
|---|---|
| **Admin** | See all, do all |
| **Manager** | See and do, limited by what Admin grants |
| **Training / Customer Service** | Limited view; actions limited to **notes only** |

A **view-only mode for training** is required.

### What access control is actually protecting

Stated priorities — these are the sensitive surfaces:

1. **Revenue data**
2. **Financial reports**
3. **Copying / downloading data** (exports are a distinct permission, not
   implied by read access)

Money actions (capture, refund, partial refund, write-off, cancel) are
restricted rather than available to anyone logged in.

### Side benefit worth stating

Every `order_events` row currently records the actor as `'admin'`. Named users
make the audit trail attribute actions to a person — which matters most on
exactly the money actions being added.

---

## 10. Notification copy — required changes

### `order_confirmed` — rewrite

Must explain that payment has been **authorized, not charged**, and that BVO
validates product availability before capture. Must say BVO may contact the
buyer if more information is needed, and that shipping follows capture.

**Do not state a timeframe.** "Typically 48 hours" becomes a promise held
against a slow one. Owner's preferred register:

> "We know how eager you are to see your dream bathroom become a reality, so we
> strive to get your order processed as fast as possible to ensure a great
> customer experience."

### `vanity_in_preparation` — merge capture messaging in

**Do not add a separate capture email.** The capture notification and the
in-preparation notification merge into one message, in the same upbeat tone:
everything is validated, payment is being captured, the order is being
processed for shipping.

---

## 11. Corrections — errors made on 2026-09-25, recorded so they are not repeated

1. **"Clover is absent from the codebase."** False. A grep filter
   (`grep -v "://"`) was silently eating every `//` comment line, because the
   `file.js:10://` prefix contains `://`. Three stale Clover comments exist in
   `routes/checkout.js`, already logged as F7. **Never filter grep output by a
   pattern that can match the line-number prefix.**

2. **"Existing auth-only orders will be stranded."** Impossible — nothing has
   ever been processed.

3. **"Keep the Authorize.net account open through the chargeback window."**
   There was never an account.

4. **"Capture happens at ship time."** Inferred from `authOnly` plus the
   `OPEN_ITEMS` F1 note, which itself says *"right for freight goods captured
   at ship time."* **That note is wrong** and should be corrected. See §2.

5. **"Payment is captured at checkout."** Also wrong — a misreading of
   "we accept payment within 48 hours."

The shape of every one of these: **treating unexercised code as evidence of
business intent.** Code that has never run describes what somebody once
planned, not what the business does.

---

## 12. Carried-forward findings (from `OPEN_ITEMS.md` §5)

| ID | Finding | Status 2026-09-25 |
|---|---|---|
| F1 | No authorisation-expiry handling | **Confirmed. Being addressed — §8** |
| F2 | Cart merge drops `bundle_discount_pct` / `bundle_id`; keys on `product_id` alone | **Confirmed STILL PRESENT** (`cartController.js` ~line 104). What *was* fixed is the price side — price re-read from DB, discount allowlisted to `[0,5,10,15]` |
| F3 | `existing.qty += qty` has no clamp; first add clamps to 99 | **Confirmed.** Owner: remove clamps — manual capture catches absurd quantities. ⚠️ The same expression also enforces the *lower* bound; without `Math.max(1, …)` a posted negative qty produces a negative line total and reduces the order value. Upper and lower bounds are not the same risk |
| F4 | FraudLabs fails open, undocumented | **Moot** — FraudLabs removed |
| F5 | No idempotency on `POST /checkout`; double-submit could double-authorize | Guard to be added if needed. Owner: a double order would be caught manually |
| F6 | `status = 'confirmed'` hardcoded while payment is only authorized | Open. Conflicts with §2 — "confirmed" reads as paid |
| F7 | Stale Clover comments in `routes/checkout.js` | Confirmed — see §11.1 |

---

## 13. Dependencies and removal notes

| Item | Action |
|---|---|
| `authorizenet@^1.0.10` | Remove — only `authorizeNetService.js` uses it |
| **`axios@^1.18.0`** | **KEEP.** Shared by `brevoService`, `wwexService`, `importHuntingtonBrass`. Removing it breaks email and freight |
| `stripe` | Add |

### CSP — replace, do not delete (`src/server.js`)

| Line | Directive | Authorize.net | Stripe |
|---|---|---|---|
| 117 | `scriptSrc` | `js.authorize.net`, `jstest.authorize.net` | `https://js.stripe.com` |
| 121–122 | `connectSrc` | `api2.authorize.net`, `apitest.authorize.net` | `https://api.stripe.com` |
| 126–127 | `frameSrc` | `js.authorize.net`, `jstest.authorize.net` | `https://js.stripe.com`, `https://hooks.stripe.com` |

**Do not skip `frameSrc`.** The Payment Element renders in an iframe. Omitting
it produces a checkout that works locally and is dead in production with
nothing but a console error.

### Database

All 15 payment/fraud columns on `orders` are **empty** — no migration file
ever created them, so there is no recorded schema and no rollback script.
Decide the Stripe schema first and do one `ALTER` rather than drop-then-re-add.

Names that carry over cleanly: `payment_transaction_id` (holds `pi_…`),
`payment_status` (`auth_only` / `captured` map onto `requires_capture` /
`succeeded`), `payment_brand`, `payment_last4`, `payment_captured`.

Dead: `payment_afds_code` (Authorize.net Advanced Fraud Detection Suite — no
Stripe equivalent), `payment_auth_code`, `payment_avs_code`,
`payment_cvv_code`, and all six `fraudlabs_*`.

### Environment variables

Remove: `AUTHORIZE_NET_API_LOGIN_ID`, `AUTHORIZE_NET_TRANSACTION_KEY`,
`AUTHORIZE_NET_PUBLIC_CLIENT_KEY`, `AUTHORIZE_NET_ENV` — these may never have
been set, since no account existed. `FRAUDLABS_API_KEY` probably does exist.

Add: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`

**Secret keys never appear in chat.** They go straight into hPanel env vars.
The publishable key (`pk_…`) is public by design.

### Confirmed NOT impacted

- **Returns** — `returnsController` writes `refund_amount` as bookkeeping. No
  gateway call anywhere in it
- **`'voided'` status** — all 11 occurrences are *shipment* status
  (`shippingController`, `shipmentStatusPoll`), unrelated to payments
- **Email templates** — none reference transaction ID, auth code, AVS, CVV or
  last4
- **Order status machine** — `config/orderStatuses.js` has no payment coupling
  beyond one tooltip

---

## 14. Parked — separate scope, do not start

**James Martin ordering integration.** JM has moved away from email POs to a
new cart/ordering system. The current `sendVendorOrder` flow emails a PO, which
will stop working. Logged 2026-09-25 while top of mind. Needs its own
discovery — no work to begin under this brief.

---

## 15. Stale documents to correct

| Document | Problem |
|---|---|
| `docs/audits/BVO_SECURITY_AUDIT.md` | Documents the **Clover** architecture throughout, including findings that no longer apply. Supersede or mark |
| `docs/00-start/OPEN_ITEMS.md` §5 | Authorize.net-era. F1's "captured at ship time" is **wrong** — see §2 |
| `src/routes/checkout.js` | Three stale Clover comments (F7) |
| `docs/reference/URL_CUTOVER_CHECKLIST.md` | References "#238 — checkout / Clover / FraudLabs audit" |
| Task #238 | Titled "Audit checkout, Clover, FraudLabs and order creation" — superseded by this brief |

---

## 16. Build order

Scopes are separable and should be delivered separately. Stripe payments
first; the rest follows.

1. **Stripe payments** — service, checkout rewrite, webhook, capture/cancel,
   CSP, schema, removal of Authorize.net + FraudLabs
2. **Money actions** — refund, partial refund, write-off table + KPI,
   state-aware cancel prompt
3. **RBAC** — users, roles, permissions, view-only training mode
4. **Alerting** — auth-expiry warnings; dashboard + email (SMS deferred)
5. **Replacement orders** — `order_type`, `parent_order_id`, revenue filtering
6. *(separate)* JM ordering integration — §14

**Nothing in this brief is approved for implementation.** Per
`CLAUDE.md` rules 1 and 2, each scope needs its own plan presented and
explicitly approved before any code is written.
