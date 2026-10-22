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

### The three things that path hides

1. **`/checkout/return` is read-only on purpose** — so it cannot race the
   webhook and double-send the confirmation email. The consequence is that
   the webhook was, until 2026-10-21, the *only* thing that could create an
   order from a payment.

2. **The webhook ACKs before it works.** `exports.webhook` calls
   `res.json({received:true})` and *then* runs the handler, so a slow Brevo
   call cannot cause a Stripe timeout and a duplicate delivery. The price
   is that **any exception after that line is permanent** — Stripe has been
   told "handled" and will never retry. The `catch` logs and swallows.

3. **The success page lies convincingly.** It reads the PaymentIntent from
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
