# Recovering the two orders stranded by the 2026-10-21 webhook defect

Two orders took a successful Stripe authorisation that never became an
order, because `handleSessionCompleted` accepted only
`payment_status = 'pending'` and a declined-then-retried buyer arrives on
`'failed'`. See CHANGE_LOG_BRIEF, 2026-10-21.

**The two orders need OPPOSITE treatment. Do not treat them alike.**

| Order | Amount | PaymentIntent | What to do |
|---|---|---|---|
| `BVO-2026-10-21-00125` | $2,694.60 | live, uncaptured | **Replay the webhook** |
| `BVO-2026-10-19-00122` | $657.00 | **cancelled by the owner at the customer's request, 2026-10-21 19:09** | **Close it by hand. Never replay.** |

Replaying 00122 would write a confirmed order against a cancelled
payment — an order the system believes is funded when no money exists
anywhere. That is strictly worse than the bug being recovered from.

---

## Order of operations

The deploy must land **first**. Replaying the webhook against the old code
reproduces the original failure exactly, and the delivery will again
return 200 while changing nothing — which looks like success.

### 1. Deploy and restart

Push the fix, then **restart Node in hPanel**. Nothing below works until
the new code is in memory.

### 2. Confirm the fix is actually running

```sql
SELECT order_number, status, payment_status
  FROM orders WHERE order_number = 'BVO-2026-10-21-00125';
```

Expect `pending` / `failed` — unchanged. This is the before-reading, and
without it step 4 proves nothing.

### 3. Replay the webhook for 00125

Stripe Dashboard → Developers → Webhooks → `energetic-sensation` →
**Event deliveries** → the `checkout.session.completed` delivered
2026-10-21 at 7:01:49 PM → **Resend**.

The handler is idempotent and guarded on the open states, so this is safe
to run more than once: a second resend finds `auth_only` and does nothing.

### 4. Verify it took

```sql
SELECT order_number, status, payment_status, total, tier_pct,
       payment_transaction_id, payment_authorized_at,
       ship_first_name, ship_last_name, ship_address1, ship_city, ship_zip
  FROM orders WHERE order_number = 'BVO-2026-10-21-00125';
```

Expect `confirmed` / `auth_only`, `payment_authorized_at` set,
`payment_transaction_id` = `pi_3UT8QQQCPO2KkIIE1zX2LmCh`, and the ship-to
fields populated — those are written by the same handler, so if they are
still blank the UPDATE did not run.

The order should now appear in `/admin/orders` without a status filter,
and a confirmation email will have been sent to the address on the order.
**If you do not want that email to go out, do not use the resend path** —
close the order by hand as in the 00122 section below, and capture or
cancel the authorisation directly in Stripe.

### 5. Close 00122 by hand

Its payment is already cancelled in Stripe at the customer's request, so
the row needs to agree with that and nothing more.

```sql
UPDATE orders
   SET status         = 'cancelled',
       payment_status = 'canceled'
 WHERE order_number = 'BVO-2026-10-19-00122'
   AND payment_status = 'failed';
```

`AND payment_status = 'failed'` is the guard: if the row has moved since
this was written, the statement affects 0 rows and you investigate rather
than overwrite. Expect `Rows matched: 1  Changed: 1`.

Note the spelling difference — `status` uses British `cancelled`,
`payment_status` uses Stripe's American `canceled`. That is the existing
convention in this schema, not a typo.

### 6. The third order

`BVO-2026-10-19-00121` is `pending` / `pending` with **no**
`stripe_session_id`. That is a genuine abandoned checkout: the buyer
opened the payment page and left. It is correctly hidden from the admin
list and needs nothing doing. Leave it alone.

---

## What to watch afterwards

A decline is now a recoverable state rather than a dead end, so orders
that previously vanished will start appearing. If an order shows up in
`/admin/orders` whose customer reports being declined, that is the fix
working, not a double charge — check `payment_transaction_id` against
Stripe before assuming otherwise.
