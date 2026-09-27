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

## 7. Stripe webhooks

🌐 Stripe → sandbox → Workbench → Webhooks → `energetic-jubilee` → Event
deliveries.

- [ ] `checkout.session.completed` for the step 1 order shows **2xx**
- [ ] Endpoint lists all 7 events

A 400 means the webhook secret does not match, which is the failure that leaves
orders authorised with no address and no email — and it is silent from BVO's
side.

---

## VERIFIED — move items here with the date

*(nothing yet)*

---

## KNOWN GAPS — cannot be closed by gates

| # | Gap | Why it stayed open | Closes when |
|---|---|---|---|
| 1 | Census geocode round trip | Sandbox has no outbound DNS; live service never called | Step 2 shows a non-null `ship_lat` |
| 2 | WWEX booking payload | No shipment booked with the new phone/residential fields | A test booking is accepted |
| 3 | EFW and dispute banners | Fire only on real issuer activity | Stripe test event, or a real warning |
| 4 | `order_confirmed` email body | Deferred by Sam; live copy is a rejected draft | See `PRE_LAUNCH_CHECKLIST.md` |
