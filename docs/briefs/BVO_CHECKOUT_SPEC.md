# BVO Checkout — Multi-Page Specification

**Status:** specification. Nothing here is approved for implementation.
**Written:** 2026-09-26
**Supersedes:** the single-page checkout at `views/pages/checkout.ejs`

---

## 0. Why this exists

BVO sells freight-delivered furniture. A single-page checkout that treats
the buyer as one address and one phone number does not fit that, and the
attempt to make it fit failed concretely:

- `shipping_address_collection` made `canConfirm` depend on a mounted,
  complete Stripe Shipping Address Element. With no second address typed,
  the Place Order button could never be clicked.
- `actions.updateShippingAddress()` sets the session but leaves the
  element empty (`complete: false`).
- `createShippingAddressElement({ defaultValues })` is rejected outright:
  *"options.defaultValues is not an accepted parameter."*

There is no way to satisfy Stripe's shipping element without the buyer
typing into it. So BVO must own the shipping address rather than delegate
it, and that means collecting it on its own page before Stripe is
involved.

The owner proposed this structure on 2026-09-25 and twice more on
2026-09-26. It was argued against twice. Both objections were wrong: the
UX cost is smaller than claimed, and the technical workaround did not
exist. This document exists so the next session does not relitigate it.

---

## 1. Reference flow

Observed on Wayfair, 2026-09-26, buying a 60" double vanity. Wayfair is
the closest comparable: freight-delivered furniture, residential
addresses, appointment-based delivery.

| # | Step | What happens |
|---|------|--------------|
| 1 | Identify | Email address. Sign in or create an account. |
| 2 | Verify | Six-digit code emailed, ten-minute expiry. |
| 3 | Confirm code | Standard verification screen. |
| 4 | Checkout | Shipping address (prefilled from account), loyalty offer, payment method, delivery options. |

Three details worth copying, and one worth skipping.

**Shipping phone is its own field.** Wayfair's shipping block carries its
own phone with the note *"This number may be used to contact you to
schedule or facilitate your delivery or service appointments."* The
payment block carries a **different** phone tied to the cardholder. They
are different facts: one is the person who will be home for the truck,
the other is the person whose card it is. BVO currently conflates them.

**Billing address hangs off the card, not the order.** In the payment
block the billing address is a dropdown attached to the saved card
(*"Sam Nazer, 1230 W Peachtree St NE, Atlanta, 30309, US"*). That keeps
AVS checking the cardholder's own address no matter where the goods go.

**Delivery options state outcomes, not names.** See §4.

**Skip for now:** the rewards programme gate. Wayfair blocks progress
until the buyer answers it. Worth building later as its own scope — a
rewards or trade programme is a real idea for BVO — but a mandatory
upsell in the middle of a first checkout costs orders.

---

## 2. The BVO flow

### Page 1 — Your information

Purpose: learn who the buyer is and where the goods are going, before
any payment machinery exists.

- Email address
- Account: sign in, create, or continue as guest (see §7.1)
- **Shipping address:** full name, address line 1, apt/suite, company,
  city, state, ZIP
- **Delivery phone**, with Wayfair's framing: this is the number the
  carrier calls to schedule
- Extension, optional
- Residential or commercial

On submit: write the order row, `status = 'draft'`. **No Stripe session,
no order number yet** (§3).

### Page 2 — Delivery

- Delivery service options (§4)
- Delivery timing options (§4)
- Special instructions, free text (gate code, driveway, "call ahead")

Kept separate from page 1 because these are choices about the *shipment*,
not facts about the *buyer*, and because §4's copy needs room to breathe.
Merge into page 1 if testing shows the extra step costs more than the
clarity gains.

### Page 3 — Payment

- Order summary: items, delivery choice, tax, total
- Stripe Checkout Session created **here**, with the ship-to already known
- Billing address: "same as shipping" ticked by default, Stripe's Billing
  Address Element when unticked
- Payment Element
- Place Order → authorise

---

## 3. Order numbers and abandoned checkouts

Today the order row and its number are created when the checkout page
*loads*. Nine consecutive order numbers were burned on 2026-09-25 by a
single buyer retrying, and every one of those rows has a NULL email —
unrecoverable.

Under this flow:

- Page 1 submit creates the row as `draft` with a real email, name, phone
  and address
- The order number is assigned when the Stripe session is created on
  page 3
- A `draft` that never reaches page 3 is an **abandoned checkout with
  contact details attached**, which is the entire prerequisite for the
  recovery automation the owner asked for

---

## 4. Delivery options — copy

The point is that the buyer knows what will physically happen and what is
expected of them. Wayfair's wording is the model; these are BVO's, subject
to what WWEX actually offers.

### Service level

> **Free — Inside your entryway**
> We bring your item to the first secure area inside your front door.
> It stays in its packaging. One person, no stairs, no assembly.

> **$XX — Room of choice**
> We carry your item to whichever room you choose, including upstairs.
> It stays in its packaging.

Each says what happens, where it stops, and what it does not include.
"Threshold" and "white glove" are carrier words — they mean nothing to a
buyer and hide the parts that cause complaints.

### Timing

> **First available**
> Estimated arrival Mon Oct 5 – Sun Oct 11.
> **We call you after it ships to arrange the delivery appointment.**

> **Scheduled delivery**
> Choose a date from Sun Oct 11.
> You can reschedule up to 24 hours before.

The bolded sentence is the one that prevents support tickets: freight is
not a doorstep drop, someone must be home, and the buyer needs to know a
call is coming.

### Also state before payment

- Someone aged 18+ must be present to sign
- Inspect for damage before signing; note any damage on the delivery
  receipt (this is the buyer's only protection on a freight claim)
- Doorway and stairwell clearances are the buyer's responsibility

---

## 5. Stripe integration points

| Concern | Decision |
|---------|----------|
| Session creation | Page 3 only |
| `shipping_address_collection` | **Off.** BVO owns ship-to. See §0. |
| `billing_address_collection` | `required` — AVS needs the cardholder address |
| `phone_number_collection` | On (permits a phone on the session); renders no field in elements mode, so BVO renders its own |
| Billing address | Stripe's element, defaulted to the shipping address |
| Capture | Manual, unchanged — authorise now, capture on confirmation |
| PCI | Card fields stay Stripe-hosted iframes. SAQ A. Unchanged by page count. |

---

## 6. Tax

With `shipping_address_collection` off, `automatic_tax` sources from the
billing address. For tangible goods, tax is owed where the goods are
**delivered**. When the two differ, the amount is wrong.

Dormant today: Georgia is not registered, so tax returns $0.00 on every
order. It becomes a real liability at go-live.

Untested candidate: `permissions.update_shipping_details` on the session,
plus `actions.updateShippingAddress()`, with no collection flag. If Stripe
accepts the address for tax without demanding a mounted element, tax
sources correctly and nothing else changes. **This must be tested against
a live session before it is designed around** — assuming Stripe's
behaviour from its documentation is what produced the bug in §0.

---

## 7. Open decisions

**7.1 Guest checkout.** Wayfair requires an account. Requiring one costs
first-time orders; BVO has no existing customer base to sign in. Proposed:
guest by default, with an opt-in "create an account to track this order"
after the order is placed. Owner's call.

**7.2 Email verification.** A six-digit code before checkout adds
friction that only pays off if accounts are mandatory. If guest checkout
stays, verification belongs at account creation, not in the buy flow.

**7.3 Delivery pricing.** Room-of-choice implies a surcharge. Shipping is
currently free and address-independent, and the owner has asked for
policy language covering the right to pass a shipping upcharge before an
order is consummated. Those two need to agree.

**7.4 Two pages or three.** Delivery options could fold into page 1.

---

## 8. Out of scope

Rewards / trade programme. Worth doing — trade pricing for contractors
and designers is a real channel for a vanity retailer — but it is its own
scope and must not gate a first-time checkout.

---

## 9. Record of what was tried

| Date | Attempt | Result |
|------|---------|--------|
| 2026-09-26 | `shipping_address_collection` + billing→shipping mirror | Place Order permanently disabled; `canConfirm` needs a mounted element |
| 2026-09-26 | `updateShippingAddress()` to satisfy the element | Sets session, element stays empty and incomplete |
| 2026-09-26 | `createShippingAddressElement({defaultValues})` | Rejected: not an accepted parameter |
| 2026-09-26 | Remove `shipping_address_collection` | Checkout unblocked; tax reverts to billing source |
