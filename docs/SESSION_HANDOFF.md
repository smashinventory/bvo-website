# SESSION HANDOFF — written 2026-10-21, late

**If you are a new session picking this up mid-scope, read this file first
and completely before touching anything or answering anything.** The owner
has lost several days to context being rebuilt badly between sessions. Do
not re-derive what is written here; do not re-litigate decisions recorded
here; do not start by asking him what was happening.

---

## 1. The 30-second version

A declined-then-retried card produced a **paid order that no screen on the
site could see**. Two real orders were affected. The root cause is fixed,
the architecture that allowed it is fixed, and the whole payment lifecycle
is now documented in `docs/CHECKOUT_PAYMENT_LIFECYCLE.md`.

**What is NOT done: the two affected orders are still stranded.** They need
two manual actions, described in §4 below and in
`docs/RECOVER_STRANDED_ORDERS.md`. That is the first thing to ask about.

---

## 2. Where the code is

| Commit | What |
|---|---|
| `37270a4` | Phase 2 tiers (Platinum Member / Trade / Elite). **LIVE and verified** — cart, checkout and a real Stripe authorisation all matched to the cent. |
| `8e0b74e` | The webhook guard fix + the reconciler + the lifecycle doc |
| `1eca067` | `reconcile_stripe.sh` — cron wrapper fixed (it could never have started node) |
| **uncommitted at time of writing** | **Trigger 1: `/checkout/return` now settles the order.** This is the real fix; see §3. |

Owner pushes. Never push for him. Give him a single copyable line starting
with `cd`. Never paste script contents for him to run — zsh history-expands
`!` and the push scripts contain it.

---

## 3. What the fix actually is

Three separate problems, one root cause: **`'failed'` was treated as a state
outside the checkout rather than a stop along it.**

1. **The guard.** `handleSessionCompleted` accepted only
   `payment_status='pending'`. A buyer declined once arrives on `'failed'`.
   The UPDATE matched nothing, `affectedRows` was 0, and the handler took
   its replay path — 200 OK to Stripe, no order, no email. Now
   `IN ('pending','failed')`, and still refusing the four decided states.

2. **Terminal events weren't scoped to their PaymentIntent.** One order owns
   several PIs once a buyer retries. A cancel for a dead attempt would move
   an order a later attempt had authorised. Now `markPaymentStatus` takes
   the event's PI id. Structural; not yet observed; the comment says so, so
   nobody later mistakes the guard for a fix to a specific event.

3. **`revenue.js` counted a decline as money in flight.** `'failed'` was
   missing from `PLACEHOLDER_PAYMENT`, so `IS_REAL` and `IS_AUTHORIZED`
   both counted it. `IS_COUNTED` was never wrong because it also demands
   `payment_captured_at` — which is exactly why it hid.

### And then the architectural fix, which matters more

The first pass added only `reconcileStripeOrders` — a 15-minute cron. **The
owner called that a half fix and he was right.** A cron sweeping up after a
single point of failure leaves the single point of failure in place.

The real repair: `/checkout/return` now settles the order itself. It was
read-only on a comment claiming a write there "would double-send the
confirmation email" — reasoning that had been obsolete for as long as the
handler had been idempotent, and that nobody re-checked.

**There are now three independent triggers into one idempotent handler:**
the buyer's own return (normal case, instant, no Stripe infra needed), the
webhook (tab closed early), and the reconciler (both failed). See
`CHECKOUT_PAYMENT_LIFECYCLE.md` §3.

---

## 4. ⚠️ OUTSTANDING — ask about these first

### 4a. The two stranded orders are still stranded

They do **not** fix themselves. Today's deploy prevents the next one; it
cannot retroactively settle these, because their webhooks already returned
200 on Oct 21 and Stripe will not resend.

| Order | Amount | State | Action |
|---|---|---|---|
| `BVO-2026-10-21-00125` | $2,694.60 | live uncaptured auth, `pending`/`failed` | replay the webhook, OR run the reconciler for real |
| `BVO-2026-10-19-00122` | $657.00 | PI **cancelled by the owner at the customer's request** | the guarded UPDATE only — **NEVER replay** |
| `BVO-2026-10-19-00121` | $657.00 | no `stripe_session_id` | genuine abandon — leave alone |

Replaying 00122 would confirm an order against money nobody holds. Full
procedure in `docs/RECOVER_STRANDED_ORDERS.md`.

**Why they are invisible in the admin list:** they are `status='pending'`,
and the list hides `draft`/`pending` deliberately (abandoned checkouts).
`/admin/orders?status=pending` shows them.

### 4b. Deploy steps not yet confirmed done

1. Restart Node in hPanel.
2. Copy `reconcile_stripe.sh` to the server root
   (`/home/u222311468/domains/bathroomvanitiesoutlet.com/`), `chmod +x`.
3. `bash reconcile_stripe.sh --dry-run` — should offer 00125 and refuse
   00122. **If it offers to settle 00122, stop and escalate.**
4. Cron: `*/15 * * * * /bin/bash …/reconcile_stripe.sh`

### 4c. ~~Two OTHER cron jobs may be dead~~ — CHECKED, THEY ARE FINE

`shipment_status_poll.sh` and `jmv_rollup.sh` hardcode a different domain
directory than cron invokes them from. Flagged as a possible silent failure
on 2026-10-21; **disproved on 2026-10-22** — `jmv_snapshots` has 59 days
with the newest being that same morning, so the rollup is running and the
two directories resolve to the same place. Do not chase this. Do not
"fix" those scripts.

Method worth keeping: hPanel's "View Output" was BLANK for both, and blank
is not evidence of health — both redirect their output to their own log
files, so the dialog looks the same whether the job works or dies on line
40. The decisive test was querying the data the job is supposed to produce.

## 5. How this owner works — read this before replying to him

- **He is technical and he checks.** He caught that the webhook guard "must
  have been a recent change", which was right in effect and wrong in cause,
  and the investigation that followed produced the most useful finding of
  the day. Take his pushback seriously; he is usually onto something.
- **He hates commentary, excuses and narration of your own process.** Give
  him the finding and the next action. Do not explain how clever the
  catching was.
- **He asks one question at a time and wants one answer.** Do not reply to
  a direct question with a laundry list.
- **He will not deploy code he does not understand the consequences of.** He
  has said so explicitly. Explain the blast radius before asking for a push.
- **He runs all terminal commands and all SQL himself.** No SSH from here.
  SQL goes through the hPanel DB panel — and that user has **no
  `information_schema` access** (error #1044), so use `SHOW COLUMNS` /
  `SHOW INDEX`.
- **API keys go in the Hostinger env panel, never in local files.**
- He asked specifically for durable notes because sessions keep losing
  context. `CHECKOUT_PAYMENT_LIFECYCLE.md` and this file are that. Keep
  them current rather than writing a third one.

---

## 6. The project's own rules that this scope exercised

- **Rule 14** — no gate opens a database connection. Consequence: a guard
  living only inside an async DB call can be tested only by matching its
  text, and text agrees with whatever it says. That is why
  `buildPaymentStatusUpdate` and `shouldSettle` are pure functions
  returning their decision — so gates can *execute* them.
- **Rule 18** — a test that re-implements its subject agrees with the bug.
  The reconciler drives the webhook's handler; it does not copy it.
- **Rule 18 corollary** — quoting code in a comment makes the comment
  satisfy a grep for that code. Bit twice today. Strip comments first.
- **A gate that fails on a *more correct* rule gets edited away.** Three
  existing gates asserted `NOT IN ('draft','pending')` as a literal string
  and went red when `'failed'` was added. Assert state by state.
- **An unselected column is `undefined`, never an error.** The project's
  most common defect. `Number(undefined)` is `NaN`; `Number(null)` and
  `Number('')` are both `0`.
- **A gate assertion is worth exactly what its mutation test proves, and
  the recurring way it is worth nothing is LOOSE MATCHING.** Four separate
  holes on 2026-10-24, every one written carefully, every one passing
  review by eye, every one caught only by running the planted defect:

  | Wrote | Why it passed on the mutant |
  | --- | --- |
  | `indexOf(a) < indexOf(b)` | `a` absent gives `-1`, and `-1 < 180` is true — the check passed on code with the subject deleted |
  | slice `id="termsBox"` → `id="scrollNote"` | scrollNote is AFTER the box closes, so the gap counted as "inside"; a clause moved out of the scrollable area passed |
  | `/SET\s+tier\s*=/` | a mutation appended `, tier = 'none'` to an existing SET clause — the assignment was there, just not after the keyword |
  | `includes('c.email_blocked')` | that string is a substring of `c.email_blocked_at`, so deleting the real column passed, carried by its companions |

  The shape is always the same: the pattern matches something ADJACENT to
  the thing under test. Guard against it by anchoring on structure rather
  than on a prefix — `\b` word boundaries (note `_` is a word character,
  so `/email_blocked\b/` correctly refuses `email_blocked_at`), closing
  tags rather than the next landmark, and `-1` checks before any index
  comparison.

  **Never accept a new gate check as working because it is green.** Green
  on correct code proves nothing. Plant the defect it exists to catch and
  watch it go red, one check at a time. A check that cannot be made to
  fail is decoration.

---

## 7. Verification state at handoff

```
all non-live gates            GREEN
gate_payment_retry            31/31
gate_stripe_reconcile         53/53
mutate_payment_gate.sh        18 mutations, 0 missed
mutate_reconcile_gate.sh      23 mutations, 0 missed
mutate_tiers_gate.sh          31 mutations, 0 missed
mutate_deals_gate.sh          47 mutations, 0 missed
```

`mutate_payment_gate` **M1 is the live defect restored verbatim** and
`mutate_reconcile_gate` **R5** is "a canceled intent becomes settleable" —
the dangerous direction. If either stops turning its gate red, that gate is
worthless. The push script refuses to proceed without both.

---

## 8. Known-and-deferred, with reasoning — do NOT "fix" these casually

| Item | Why it was left |
|---|---|
| `ordersController.capturePayment` / `cancelAuthorization` check state in JS then issue an **unguarded** `UPDATE ... WHERE id = ?` | narrow TOCTOU window, never observed; deliberately left to keep a money-path day's blast radius small. Needs its own change and its own gate. |
| `status` and `payment_status` have **no enforced correspondence** | accepted. Transition rules would break legitimate manual recovery. |
| `handleSessionCompleted` stamps `payment_authorized_at` even when not authorised | cosmetic on cards; only reachable via async payment methods |
| `orderStatuses.js` `autoSet` comments are stale (`pending` IS set by code) | low risk, but do not trust that file without grepping |
| `member_offer_redemptions` has unique keys for one-per-household and **nothing writes to it** | real hole: a second account with a new email earns another 10% on JM product already at MAP. Not yet scoped. |
| No retention policy for uploaded trade documents | spec asks for one |
| Brevo does not segment on tier | not started |
| **#377 — admin and customer sessions destroy each other.** Four paths, all confirmed 2026-10-24: admin login `regenerate()` wipes `cart` + `customerId`; customer sign-in via `establishSession` wipes `isAdmin`; either logout `destroy()`s both. | **Deliberately left, and the reasoning matters.** The dangerous direction is already safe — `establishSession` carries only `cart`, `checkoutDraft`, `checkoutOld` and the pending offer claim, never `isAdmin`, and admin login never carries `customerId`, so neither side can inherit the other's privileges. What remains is mutual logout, which only affects someone who is both admin and customer in one browser: the owner and staff. **Do not "fix" this by adding `isAdmin` to a carry-across list** — that converts a nuisance into the exact shape of a privilege leak, on an auth boundary, for the benefit of two people. If it must be fixed, it is two separate cookies, and it is its own scope with its own gate. Practical note: this is why signing in as a test customer logs you out of admin mid-QA. |
| `req.session.adminUser` was read 17 times and written **never** | **FIXED 2026-10-24.** Every audit row in the system — order status changes, captures, cancels, deletes, vendor POs, shipment events, trade approvals, outreach — recorded the literal string `'admin'`. It hid because `req.session?.adminUser \|\| 'admin'` fails open to a plausible value, and because there is one admin account so `'admin'` was accidentally correct; it would have become wrong and stayed silent the day multi-admin shipped. Now set at login, **as a string** (15 reads interpolate it straight into a DB column, so an object stores `[object Object]`). `gate_admin_actor.js` EXECUTES the login handler against a fake session whose `regenerate()` wipes everything, because the two mutations that matter — write-before-regenerate and write-as-object — both leave a line a grep would happily find. |

---

## 8b. WHERE IT ALL STARTED — read §10 of the lifecycle doc

Traced 2026-10-22 at the owner's prompting. `fd472b6` (2026-10-04, free
samples) killed checkout for EVERY customer for fourteen days, two ways:
a new drift guard reading a `subtotal` column the SELECT never fetched
(`undefined` → 0 → 409 on every order), and the sample-aware subtotal
written in only the INSERT branch, leaving every repeat pass through
page 1 comparing against a stale figure.

First casualty is order id 13 / `BVO-2026-10-05-00119` — a $1,803 vanity
with `subtotal` and `total` both `0.00` on the admin screen while
`order_items` holds the real line. It is still `pending`. That is a real
lost customer order and a useful specimen; **do not delete it.**

That 409 then HID the September webhook defect until `cbafe9f` lifted it
on 10-19. Order 00122 stranded three hours later.

**The process tell: task #321 "Gate, mutation-test and push" was never
completed for that scope.** It shipped without a harness. The only two
scopes on this project that shipped without one are the two that cost
weeks. Do not let a scope ship without its mutation harness, whatever the
pressure.

## 9. Elsewhere in the project (not this scope)

- `#365` `/collections/sale` is absent from the sitemap — it is a virtual
  collection and `sitemapController` selects from `categories`.
- `#366` resubmit the sitemap in GSC after the Deals page deploy.
- `#367` `on_sale` clean paths — verify whether the filter works, then
  decide the fate of the four indexed URLs.
- `#344` verify the JM import and the Site Analytics tile.
