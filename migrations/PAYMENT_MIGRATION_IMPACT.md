# Impact analysis — removing Authorize.Net + FraudLabs Pro

Prepared 2026-09-25, before any code is deleted.

**Context: there was never an Authorize.Net account.** The site has not
launched. The integration was written speculatively against an account
pending bank approval that never came through (see task #238, "waiting on
Authorize.Net credentials"). No credentials ever existed, so this code has
never executed against a live or sandbox endpoint.

That makes this a **clean deletion, not a migration** — and the code being
removed is unproven, not working code being replaced.

---

## What this ISN'T

Worth stating, because a payment-processor swap normally carries all of
this and none of it applies here:

- No auth-only orders stranded without a capture path
- No settled transactions needing refunds through the old gateway
- No chargeback window, and no account to close
- No dual-run period, no legacy capture path to maintain
- No historical risk data to keep renderable in the admin

One consequence worth naming: **nothing in the removed code is
battle-tested.** The AcceptUI flow, the auth-only call, the capture path —
none has processed a transaction. Do not treat any of it as a known-good
reference when writing the Stripe equivalent. The SAQ A reasoning below is
sound design intent, but it was never exercised either.

---

## Files to change

| File | Refs | Action |
|---|---|---|
| `src/services/authorizeNetService.js` | — | **Delete** |
| `src/services/fraudLabsService.js` | — | **Delete** |
| `src/controllers/checkoutController.js` | 13 | Rewrite — FraudLabs pre-gate out, `authOnly` → Checkout Session (`ui_mode: 'elements'`, `capture_method: 'manual'`) |
| `views/pages/checkout.ejs` | 7 | Rewrite — AcceptUI + `dataDescriptor`/`dataValue` → Payment Element |
| `views/pages/admin/orders/detail.ejs` | 12 | **Delete** the risk panel, rebuild against Stripe. No historical orders to keep rendering |
| `src/server.js` | 2 | CSP host swap — see below |
| `src/controllers/ordersController.js` | 2 | `capturePayment` (lines ~537–577) repointed to `stripeService.capturePayment`. Route `admin.js:100` unchanged. Add a cancel-authorisation path for rejected orders |
| `package.json` | 1 | Drop `authorizenet`, add `stripe` |

---

## The three things that still matter

### 1. `axios` must stay

| Package | Action | Why |
|---|---|---|
| `authorizenet@^1.0.10` | **Remove** | Only `authorizeNetService.js` uses it |
| `axios@^1.18.0` | **KEEP** | Shared by `brevoService`, `wwexService`, `importHuntingtonBrass` — removing it breaks email and freight |
| `stripe` | **Add** | Not present |

`axios` also appears at package.json:45 — check whether that's a duplicate
or an overrides entry before editing.

### 2. CSP must be replaced, not deleted — `src/server.js`

| Line | Directive | Current | Stripe |
|---|---|---|---|
| 117 | `scriptSrc` | `js.authorize.net`, `jstest.authorize.net` | `https://js.stripe.com` |
| 121–122 | `connectSrc` | `api2.authorize.net`, `apitest.authorize.net` | `https://api.stripe.com` |
| 126–127 | `frameSrc` | `js.authorize.net`, `jstest.authorize.net` | `https://js.stripe.com`, `https://hooks.stripe.com` |

**Do not skip `frameSrc`.** The Payment Element renders in an iframe, just
as AcceptUI does. Omitting it produces a checkout that works locally and is
dead in production with only a console error.

### 3. PCI scope — preserve SAQ A

`checkoutController.js:43` records why AcceptUI was chosen: it's
Authorize.Net's *hosted* form, so card data never touches a DOM node this
site controls. That's what keeps the site at **SAQ A** rather than SAQ A-EP.

Stripe's **Payment Element** preserves SAQ A. Custom card inputs against
Stripe.js tokenisation do not. This matters more now, not less — the new
checkout is being written from scratch, and the constraint is invisible in
a diff.

---

## Database — drop the columns

All 15 are empty. No migration file ever created them (no DDL under
`migrations/`), so they were added ad hoc.

**`orders` — Authorize.Net columns (9):**
`payment_transaction_id`, `payment_status`, `payment_auth_code`,
`payment_avs_code`, `payment_cvv_code`, `payment_afds_code`,
`payment_brand`, `payment_last`, `payment_captured`

**`orders` — FraudLabs columns (6):**
`fraudlabs_score`, `fraudlabs_status`, `fraudlabs_ip_vpn`,
`fraudlabs_ip_tor`, `fraudlabs_ip_proxy`, `fraudlabs_email_risk`

Rather than drop-then-re-add, decide the Stripe schema first and do it as
one `ALTER`. Several names carry over cleanly and shouldn't churn:

- `payment_transaction_id` → holds a PaymentIntent ID (`pi_…`)
- `payment_status` → `auth_only` / `captured` / `pending` **stay as they
  are** and map directly onto Stripe's `requires_capture` / `succeeded` /
  `requires_payment_method`. Add `canceled` for released authorisations.
- `payment_brand`, `payment_last4` → Stripe supplies both
- `payment_captured` → unchanged

Genuinely dead, drop them: `payment_afds_code` (Authorize.Net Advanced
Fraud Detection Suite — no Stripe equivalent), `payment_avs_code`,
`payment_cvv_code` (Stripe reports these differently, inside the charge
outcome), `payment_auth_code`, and all six `fraudlabs_*`.

Confirm empty before dropping:

```sql
SELECT COUNT(*) AS total_orders,
       COUNT(payment_transaction_id) AS with_txn,
       COUNT(fraudlabs_status)       AS with_fraud_screen
  FROM orders;
```

Expect `with_txn = 0` and `with_fraud_screen = 0`. If either is non-zero,
stop — something did run and this document's premise is wrong.

---

## Environment variables (hPanel)

These four are referenced in code but, with no account ever existing, were
most likely never set in hPanel at all — check before assuming there is
anything to remove:

`AUTHORIZE_NET_API_LOGIN_ID`, `AUTHORIZE_NET_TRANSACTION_KEY`,
`AUTHORIZE_NET_PUBLIC_CLIENT_KEY`, `AUTHORIZE_NET_ENV`

`FRAUDLABS_API_KEY` is separate — FraudLabs Pro was a real signup (Micro
plan, 500 queries/month), so that key probably does exist. Cancel the plan
as well as removing the var.

Add: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`

No ordering constraint — remove whenever.

---

## Confirmed NOT impacted

- **Returns.** `returnsController` writes `refund_amount` as a bookkeeping
  field. No gateway call anywhere in it.
- **`'voided'` status.** All 11 occurrences are *shipment* status
  (`shippingController`, `shipmentStatusPoll`) — unrelated to payments.
- **Email templates.** No Brevo template references transaction ID, auth
  code, AVS, CVV or last4.
- **KPI / reporting.** No dashboard query reads `payment_*` beyond the
  capture guard in `ordersController`.
- **Order status machine.** `config/orderStatuses.js` has no payment
  coupling beyond one tooltip string.

---

## Also worth knowing

**Tax does not exist.** `calcTotal()` (checkoutController.js:35) is line
items × qty minus bundle discount. No tax, no shipping charge. Stripe Tax
is filling a hole, not replacing anything.

**Clover is absent.** Zero references in the codebase. Task #238's label
("Audit checkout, Clover, FraudLabs") is stale — correct it rather than
investigate it.

---

## Order of work

1. Confirm the two counts above are zero
2. Build Stripe — checkout, capture, webhook — in test mode
3. Delete the old files, swap CSP, drop columns, swap env vars
4. Test end to end: pay → webhook → order row → full refund → partial refund

## Payment model — as stated by the owner, 2026-09-25

**Authorise at checkout. Capture within ~48 hours**, from the admin, once
the order is accepted. Not capture-at-checkout, and not capture-on-ship.

This is what the existing `authOnly` + `capturePayment` pair was built for,
so the shape carries over unchanged:

- `capture_method: 'manual'` on the Checkout Session's `payment_intent_data`
- `payment_status` keeps `auth_only` → `captured`
- `ordersController.capturePayment` is repointed, not deleted
- A 48-hour window sits well inside the 7-day online card authorisation
  validity, so expiry is not a practical concern

Two consequences worth building for:

- **Payment method availability narrows.** ACH, iDEAL and SEPA cannot
  authorise and capture separately, so Stripe filters them out of a
  manual-capture session. 18 methods are enabled in the Dashboard; expect
  fewer to render. Offering them would need a separate immediate-capture
  path.
- **Rejecting an order is a cancel, not a refund.** Before capture there is
  no charge to refund — `paymentIntents.cancel` releases the hold.
  `stripeService.cancelAuthorization()` exists for this. Refund applies only
  after capture, which is the returns path.
