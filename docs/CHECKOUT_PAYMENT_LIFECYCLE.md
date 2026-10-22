# The checkout and payment lifecycle — the artifact of record

**Written 2026-10-21 after three days lost to the same class of bug.**

Read this before touching anything in `checkoutController.js`,
`ordersController.js` capture/cancel, `revenue.js`, or the Stripe webhook.
It exists because every session so far has had to rediscover this by
reading 2,500 lines of controller, and rediscovery is where the mistakes
come from.

---

## 0. The one-paragraph version

An order row is created the moment someone opens checkout and is mutated
through a sequence of states by **five different actors** — the buyer's
browser, the Stripe webhook, a background reconciler, the admin screens,
and the shipping system. There are **two independent state columns**,
`status` and `payment_status`, and *nothing in the codebase keeps them in
sync*. Almost every defect found so far has been one of: a guard that
names the wrong state, an actor writing a column it should not, or a
transition with no backstop when its single trigger fails.

---

## 1. The two state machines

### `orders.payment_status` — where the MONEY is

This is the one that matters. It is the column every money decision reads.

| value | meaning | money |
|---|---|---|
| `draft` | cart being filled in, no Stripe session yet | none |
| `pending` | Stripe session created, payment not completed | none |
| `failed` | the card was **declined** | none |
| `no_payment_due` | $0.00 order (free samples) | none, by design |
| `auth_only` | **authorised — Stripe is holding the money** | held, not taken |
| `captured` | charged | taken |
| `canceled` | authorisation released | released |
| `refunded` | charged then returned | returned |

**`draft`, `pending` and `failed` are the OPEN states** — the checkout is
still in progress and the row may still move forward.
**`auth_only`, `captured`, `canceled`, `refunded` are DECIDED** — nothing
may re-open them. Every guard in the system is some expression of that
split, and every bug so far has been getting the split wrong.

> ⚠️ **`failed` is an OPEN state, not a terminal one.** A declined card is
> the middle of a checkout, not the end of one. Treating it as terminal is
> what stranded orders 00122 and 00125. See §5.

### `orders.status` — where the ORDER is operationally

`pending → confirmed → processing → shipped → in_transit → delivered`,
plus `cancelled` and `refunded`. Defined in `src/config/orderStatuses.js`.

> ⚠️ **`orderStatuses.js` currently says of `pending`: "nothing sets this
> today — checkout goes straight to Confirmed". That comment is WRONG.**
> `checkoutController` sets `status='pending'` at session creation
> (~line 1588). The config has been stale since the three-page checkout
> landed. Do not trust `autoSet` flags without grepping.

### The relationship between them

**There isn't one.** No code enforces any correspondence. It is entirely
possible today to have `status='shipped'` with `payment_status='pending'`,
or `status='cancelled'` with `payment_status='auth_only'` (money still held
on a customer's card with the order marked dead). The admin status dropdown
(`ordersController.updateStatus`, and a second one in `adminController`)
accepts any valid status from any other, with no transition rules and no
look at `payment_status` at all.

This is a known, accepted gap — not an oversight to "fix" casually. Writing
transition rules would break legitimate manual recovery. If it is ever
addressed, it needs its own scope and its own gate.

---

## 2. Every actor that writes these columns

Grep-verified 2026-10-21. **If you add a sixth writer, add it here.**

| # | Where | Writes | Guard |
|---|---|---|---|
| 1 | `checkoutController` free-order (~1395) | `status='confirmed'`, `payment_status='no_payment_due'` | `WHERE payment_status='draft'` |
| 2 | `checkoutController` createSession (~1588) | `status='pending'`, `payment_status='pending'` | none (creation) |
| 3 | `checkoutController` outage revert (~1663) | `payment_status='draft'` | `IN ('pending','failed')` |
| 4 | `checkoutController` `markPaymentStatus` | `canceled` / `failed` | allowed-from list **+ PaymentIntent id** |
| 5 | `checkoutController` `handleSessionCompleted` | `status='confirmed'`, `payment_status='auth_only'` | `IN ('pending','failed')` |
| 6 | `jobs/reconcileStripeOrders` | — drives #5, writes nothing itself | `shouldSettle()` |
| 7 | `ordersController.capturePayment` | `payment_status='captured'` | **JS check only — see below** |
| 8 | `ordersController.cancelAuthorization` | `payment_status='canceled'`, `status='cancelled'` | **JS check only** |
| 9 | `ordersController.updateStatus` + `adminController` | `status=<any>` | valid-value only, no transitions |
| 10 | `shippingController` book / void | `status='shipped'` / `'processing'` | — |
| 11 | `jobs/shipmentStatusPoll` | `status` from carrier | — |

### ⚠️ Known weakness in #7 and #8

Both read the row, check `payment_status !== 'auth_only'` **in JavaScript**,
then issue an **unguarded** `UPDATE ... WHERE id = ?`. The guard is not in
the SQL. Between the SELECT and the UPDATE a webhook can land and be
overwritten.

Not yet observed, low probability, and **deliberately not changed on
2026-10-21** to keep that day's blast radius small. The correct fix is to
move the condition into the UPDATE's WHERE clause and check `affectedRows`.
Do it as its own change, with its own gate.

---

## 3. The happy path, end to end

```
/cart
  └─> POST /checkout/identify        email captured, customer resolved
  └─> GET  /checkout                 page 1: contact, address, delivery type
                                     ORDER ROW CREATED  payment_status='draft'
  └─> GET  /checkout/delivery        page 2: delivery acknowledgement
  └─> GET  /checkout/payment         page 3
        └─> POST (createSession)     Stripe Checkout Session, ui_mode:'elements'
                                     status='pending'  payment_status='pending'
                                     stripe_session_id stored
        └─> buyer submits card to Stripe directly
              ├─ declined ──────────> webhook payment_intent.payment_failed
              │                       payment_status='failed'   ← STILL OPEN
              │                       buyer retries on the same order row
              └─ authorised ────────> webhook checkout.session.completed
                                      status='confirmed' payment_status='auth_only'
                                      ship-to written, confirmation email sent
  └─> GET /checkout/return           READ-ONLY. Reads the PaymentIntent from
                                     Stripe, sets the success page, clears the
                                     cart. Writes NOTHING to the order.
  └─> GET /checkout/success

  [human] admin captures            payment_status='captured'
  [human] admin books freight       status='shipped'
```

### THE SETTLEMENT ARCHITECTURE — three triggers, one handler

**This is the single most important thing on this page.**

`handleSessionCompleted` is the only code that turns an authorisation into
an order. It is called from **three independent places**:

| # | Trigger | Covers |
|---|---|---|
| 1 | `GET /checkout/return` — the buyer's own browser | the normal case. Fires in the same second as the payment, needs no Stripe webhook infrastructure at all |
| 2 | the `checkout.session.completed` webhook | a buyer who closes the tab before Stripe returns them |
| 3 | `jobs/reconcileStripeOrders` every 15 min | both of the above failing |

**What makes three triggers safe is one line.** The handler's UPDATE is
guarded on the open payment states, and

```js
if (upd.affectedRows === 0) return;   // replay — already handled
```

is the FIRST statement after it — 130 lines before `sendConfirmation`. The
UPDATE is atomic and InnoDB row-locks it, so of two concurrent callers
exactly one matches a row and the other returns before the email.

> ⚠️ **If that early return is ever moved below the email, every order
> settled twice emails the customer twice.** `gate_stripe_reconcile` asserts
> the ordering and `mutate_reconcile_gate` R22 re-breaks it.

### What this replaced, and why it is worth knowing

Until 2026-10-21 trigger 1 did not exist. `/checkout/return` was
deliberately read-only, on a comment reading *"the webhook owns that, and
racing it here would double-send the confirmation email."*

**That reasoning was obsolete and nobody re-checked it.** The handler had
been idempotent for as long as the guard had existed; the double-send it
warned about could not happen. But the comment was believed, so the webhook
was the *only* path from "Stripe is holding the money" to "an order exists" —
a single point of failure, with no second trigger, on the money path.

The first attempt at fixing this scope added only the reconciler. That was a
compensating control, not a fix: a cron sweeping up after a single point of
failure still leaves the single point of failure. The owner called it a half
fix and was right. Trigger 1 is the actual repair; the reconciler is now
genuine belt-and-braces rather than the primary safety net.

### The two things that path still hides

1. **The webhook ACKs before it works.** `exports.webhook` calls
   `res.json({received:true})` and *then* runs the handler, so a slow Brevo
   call cannot cause a Stripe timeout and a duplicate delivery. The price
   is that **any exception after that line is permanent** — Stripe has been
   told "handled" and will never retry. The `catch` logs and swallows.

2. **The success page lies convincingly.** It reads the PaymentIntent from
   Stripe directly, so it says "authorised" and shows the right total even
   when no order was written. During the 00125 incident every visible
   signal was green: Stripe showed the hold, the success page said
   authorised, the webhook log showed `200 OK`. Only the admin list
   disagreed, by being empty.

> **If you are ever debugging "the customer says they paid":** the success
> page and the Stripe dashboard are NOT evidence that an order exists.
> Query `orders` directly. That is the only source of truth for this site.

---

## 4. The reconciler (added 2026-10-21)

`src/jobs/reconcileStripeOrders.js` is the backstop for everything in §3.

Every 15 minutes it finds orders that reached Stripe (`stripe_session_id`
present) but are still in an open payment state, asks Stripe what actually
happened, and — only when Stripe says the money is committed — drives
`checkoutController._handleSessionCompleted`, the webhook's own handler.

- It never captures, never cancels, never writes its own UPDATE.
- It cannot create money movement of any kind.
- It is idempotent: the handler's guard makes a second run a no-op.
- When it settles anything it says so loudly, because **a reconciler that
  settles an order means the webhook failed** and that is worth
  investigating rather than treating as routine.

Run it by hand any time:

```
node src/jobs/reconcileStripeOrders.js --dry-run
```

Cron wrapper: `reconcile_stripe.sh`. Gate: `gates/gate_stripe_reconcile.js`.

---

## 5. The defect history — read this before "fixing" a guard

Every one of these was the same shape. They are listed so the next one is
recognised in minutes rather than days.

| Date | Defect | Shape |
|---|---|---|
| 2026-09-25 | `handleSessionCompleted` guarded on `payment_status='pending'` only | guard names a subset of the valid states |
| 2026-10-04 | **`fd472b6` free samples — THE ORIGIN.** See §10. | a new guard read a column the SELECT never fetched |
| 2026-10-05→19 | checkout 409'd on every order (stale subtotal + unselected columns) | an unselected column is `undefined`, never an error |
| 2026-10-14 | `order.stripe_payment_intent_id` — a column that does not exist | same |
| 2026-10-19 | revenue predicates counted abandoned checkouts as sales | guard names a subset of the states |
| 2026-10-20 | `$0.00` order: Place Order button permanently `disabled` | the enabling line lived only on the Stripe branch |
| 2026-10-21 | the decline-then-retry stranding (00122, 00125) | guard names a subset of the states |
| 2026-10-21 | `revenue.js` counted `failed` as money in flight | same, in a second file |

### Why 2026-10-21 "started last week" and was NOT a recent regression

The guard dated from 2026-09-25 and was never touched again. Firing it
needs a decline **and** a successful retry. From ~2026-10-05 to 2026-10-19
checkout 409'd on every attempt, so nobody ever completed a retry and the
defect was unreachable. `cbafe9f` fixed the 409 at 11:48 on 2026-10-19;
order 00122 stranded at 14:55 — **three hours later**.

> **The lesson, which is the most valuable line in this document:
> fixing an upstream blocker exposes every latent defect downstream of it
> at once.** When you unblock a path that has been dead for a fortnight,
> re-test the WHOLE path, not the thing you fixed.

---

## 6. Rules this area has earned

- **Rule 14** — no gate opens a database connection. Consequence: any guard
  that lives only inside an async DB call can be tested only by matching
  its text, and matching text agrees with whatever the text says. That is
  why `buildPaymentStatusUpdate` and `shouldSettle` are pure functions
  returning their decision — so a gate can *execute* them.
- **Rule 18** — a test that re-implements its subject agrees with the bug.
  The reconciler drives the webhook's handler rather than copying it.
- **A gate that fails on a *more correct* rule gets edited away.** Three
  gates asserted `NOT IN ('draft', 'pending')` as a literal string and went
  red when `'failed'` was added. Assert state by state.
- **An unselected column is `undefined`, not `null`, and never an error.**
  This project's single most common defect. `Number(undefined)` is `NaN`,
  but `Number(null)` and `Number('')` are both `0`.

---

## 7. Open items in this area, with their reasoning

| Item | Status |
|---|---|
| `#7`/`#8` capture & cancel guards are JS-side, not in the SQL | deliberate deferral, 2026-10-21 — needs its own scope |
| `status` and `payment_status` have no enforced correspondence | accepted; transition rules would break manual recovery |
| `orderStatuses.js` `autoSet` comments are stale | low risk, but do not trust them |
| `handleSessionCompleted` stamps `payment_authorized_at` even when `authorized` is false | cosmetic on card payments; only reachable via async methods |
| `member_offer_redemptions` has unique keys for one-per-household but **nothing writes to it** | the 10% offer is limited only by `hasCapturedOrder` on `customer_id` — a second account with a new email earns another 10% |
| No retention policy for uploaded trade documents | spec asks for one |

---

## 8. If you are a new session starting here

1. Read §1 and §2. Do not infer the state machine from one controller.
2. Before changing any guard, ask **"which states does this accept, and is
   `failed` one of them?"**
3. Run `node gates/gate_payment_retry.js` and
   `node gates/gate_stripe_reconcile.js` — they encode everything above.
4. Run `bash mutate_payment_gate.sh`. M1 restores the 2026-10-21 defect
   verbatim; if it ever stops turning the gate red, the gate is worthless.
5. The source of truth for whether an order exists is the `orders` table.
   Not Stripe, not the success page, not the webhook log.

---

## 9. Cron wrapper note — RESOLVED, do not chase this

`reconcile_stripe.sh` resolves its own location:

```bash
BASE="$(cd "$(dirname "$0")" && pwd)"
```

It does not hardcode a domain directory. That is still the right form — the
repo copy and the server copy stay byte identical and a file drop needs no
follow-up edit — but the reason it was written that way was partly wrong.

**The concern, and why it was unfounded.** `shipment_status_poll.sh` and
`jmv_rollup.sh` both hardcode
`BASE=/home/u222311468/domains/slategrey-falcon-350174.hostingersite.com`
while the live cron entries invoke them from
`/home/u222311468/domains/bathroomvanitiesoutlet.com/`. On 2026-10-21 this
file said those two jobs might have been silently dead for weeks.

**They are not.** Checked 2026-10-22:

```sql
SELECT MAX(snapshot_date), COUNT(DISTINCT snapshot_date) FROM jmv_snapshots;
-- 2026-10-22, 59 days
```

`jmv_rollup.sh` ran that morning. The two domain directories resolve to the
same place on this account, so the hardcoded path is a cosmetic
inconsistency, not a fault. Leave both scripts alone.

`MAX(shipments.last_tracking_scan)` is NULL, which is uninformative rather
than alarming: no freight has been booked live yet, so the poller has
nothing to scan.

> **The method is worth keeping even though the answer was "no problem".**
> hPanel's "View Output" was blank for both jobs, and blank is NOT evidence
> of health — both scripts redirect all output to their own log files, so
> that dialog looks identical whether a job is working or failing on line
> 40. The decisive check was the DATA the job is supposed to produce. When
> asking "is this scheduled thing actually running", always ask what it
> should have written, never what the scheduler says.


---

## 10. The free-samples scope — where this all started

Added 2026-10-22, after the owner said "the problems started when we
started working on the 2 free samples scope." He was right, and the trail
is worth keeping because the same shape has now bitten five times.

### `fd472b6` (2026-10-04) killed checkout for EVERY customer

Not just sample orders. Vanities too. Two independent defects, either of
which alone is fatal:

**A — a new guard read a column nobody fetched.** The commit added the
drift check

```js
if (pricing.toCents(expected) !== pricing.toCents(order.subtotal)) → 409
```

and never widened the SELECT that produces `order`. An unselected column
is `undefined`, so `toCents(undefined)` → `Number(undefined)` = NaN → not
finite → **0**. Every real cart total was compared against zero, never
matched, and returned *"Your order total changed"*. Both Stripe iframes
stayed empty, and because each reload recomputed the same two numbers the
error could never clear.

**B — the sample-aware subtotal went into only one of two branches.** The
pre-existing code had `const subtotal = calcTotal(cart.items)` inside the
`else` (INSERT) branch. `fd472b6` edited that line in place to pass
`PRICE_OPTS` and never touched the UPDATE branch — which is every repeat
pass through page 1: editing an address, pressing Back, retrying after a
validation error. Line items were rewritten; money columns were not.

> ⚠️ **The guard did not merely fail to help. It converted a pre-existing
> harmless omission into a hard failure on the happy path.** The UPDATE
> branch had always skipped the money columns; nothing had ever compared
> against them. Adding the comparison is what made it fatal. A guard that
> fails closed on correct behaviour is worse than no guard.

**The first casualty, order id 13 / `BVO-2026-10-05-00119`**, 2026-10-05
00:28 — hours after deploy. One line item, a $1,803 De Soto vanity,
correctly written to `order_items`; `subtotal` and `total` both `0.00`.
It still sits at `pending` with a NULL `stripe_session_id`, which is the
exact signature of dying at the drift guard (the `status='pending'` write
happens before it; the session id is written after). The admin Order Risk
panel compounded it — *"Order amount within normal range ($0.00)"*. Every
downstream consumer inherited the unwritten number.

### `1d0f749` (same day) — the $0.00 button

The free branch loads no Stripe, so the line that clears
`payBtn.disabled` never ran. The markup ships the button `disabled` and
the button sits OUTSIDE the `if (!locals.isFreeOrder)` guard, so it
renders disabled on the free path too. The only `payBtn.disabled = false`
in that block is inside `function fail(msg)` — unreachable without a
click, and a disabled button emits no clicks. Free-sample orders were
impossible from the day the offer shipped until `5fab2dc` on 2026-10-20.

No order-history evidence exists either way for this one, because while
checkout was dead nobody could reach a genuine free order. It is
established from the source alone. Do not re-litigate it from the orders
table — the pre-20th `$0.00` rows are defect B, not failed free samples.

### The chain to the webhook incident

The 409 made the September webhook defect **unreachable** — nobody could
complete a decline-then-retry because nobody could complete anything.
`cbafe9f` lifted the 409 on 2026-10-19 at 11:48; order 00122 stranded at
14:55, three hours later. See §5.

### What the whole trail has in common

Five defects, one shape: **a value that is `undefined`, or never written,
rather than an error.**

- the drift guard reading an unfetched `subtotal`
- the UPDATE branch never writing the money columns
- `tier_pct` missing from the payment SELECT
- the ghost `order.stripe_payment_intent_id` column
- `Number(null) === 0` matching the `20-` size bucket

JavaScript and mysql2 will not tell you. Nothing throws. The only defence
is to execute the path and read the result.

### The process tell

Task **#321 — "Gate, mutation-test and push"** sits directly after the
five free-samples tasks and was never completed. **That scope shipped
without its harness.** `gate_sample_offer.js` and
`mutate_sample_offer_gate.sh` exist today only because they were
retrofitted by the commits that cleaned up the damage.

Every other scope on this project that shipped with a green gate AND a
clean mutation harness has held. The two that shipped without one — free
samples, and the `'pending'`-only webhook guard — are the two that cost
weeks. That is the entire argument for the harness, stated as evidence
rather than as principle.
