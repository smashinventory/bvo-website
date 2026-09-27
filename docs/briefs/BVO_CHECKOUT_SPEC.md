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

## 4. Delivery — copy

**Decision 2026-09-26: BVO offers one delivery level — curbside — and no
paid upgrade.** Wayfair's tiering is not copied. What *is* copied is the
discipline of saying exactly what will physically happen and what is
expected of the buyer.

This matters more for BVO than it does for Wayfair. "Inside your
entryway" is a generous outcome that rarely surprises anyone. Curbside is
the opposite: a buyer who pictures two people carrying a vanity into the
bathroom and instead watches a lift-gate lower a crate onto the driveway
will refuse the delivery, file a damage claim, or leave the review that
costs the next ten orders. Every one of those is cheaper to prevent here,
in one paragraph, than to resolve afterwards.

So this copy is not marketing text to be softened. Vagueness here is the
expensive option.

### Service level — shown on the delivery page and again at review

> **Free curbside delivery**
>
> Your vanity ships by freight truck. The driver brings it to your
> driveway or the curb and lowers it with a lift gate. **They do not
> bring it inside, up steps, into a garage, or unpack it.**
>
> Please arrange help to move it from there. A 60" vanity in its crate
> can weigh over 200 lb.
>
> **Need it brought inside?** [Contact us](/pages/contact) before you
> order and we will quote it.

Three things that copy does deliberately: it says where the driver stops
*in the negative* (buyers skim the positive), it gives a weight so
"arrange help" means something concrete, and it offers a route out rather
than a flat no.

### Timing

> **We call you to arrange a delivery appointment once your order ships.**
> Freight is not left unattended. Someone aged 18 or older must be there
> to receive it and sign.

### At the point of signing — state before payment, repeat in the email

- **Inspect the crate before you sign.** Note any damage on the delivery
  receipt, however minor.
- A signed clean receipt is the carrier's evidence that it arrived
  undamaged. **It is the buyer's only protection on a freight claim.**
- Photograph anything that looks wrong before the driver leaves.

### Not offered

Room-of-choice and white-glove are not offered at checkout. If demand
appears through the contact route, price it from real WWEX quotes rather
than guessing a flat fee.

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

## 7. Decisions — settled 2026-09-26

**7.1 Sign in, register, or guest.** All three offered side by side on
page 1. The buyer chooses.

**7.2 Email verification before checkout.** Six-digit code, ten-minute
expiry, as Wayfair does.

*Consequence to be aware of:* combined with 7.1, a guest is verified too.
That is the right call for a freight retailer — email is the only channel
for the delivery appointment, and a typo'd address means an order that
cannot be delivered or refunded cleanly — but it does narrow the
difference between guest and account to "we did not keep a password".
Flagged so nobody later removes it as redundant.

**7.3 One delivery level, curbside, free.** No surcharge, no paid
upgrade. Buyers needing more are routed to contact. See §4.

> ⛔ **CLOSED. Do not re-open, do not "note the gap", do not compare to a
> competitor's tiers.** Wayfair offers two free levels on a comparable
> vanity — front door and inside entryway. That is known, it was weighed,
> and the answer is still one level. It was raised again on 2026-09-27
> against this settled decision and the owner had to close it a second
> time. A settled decision does not need re-litigating every time new
> evidence about someone else's business appears.

**7.4 Three pages.** Information, delivery, payment.

### Still open

**7.5 Resend and rate limits on the verification code.** How many
resends, how often, and what happens after repeated failures. Needs a
decision before build, because getting it wrong either locks buyers out
or turns the endpoint into a free email cannon.

**7.6 What a returning buyer skips.** A signed-in buyer with a saved
address should not retype it, which implies saved addresses and a
default — the "Set as default delivery address" box in Wayfair's flow.
Scope this explicitly rather than letting it grow during the build.

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

---

## 8. Authentication emails — captured from Wayfair, 2026-09-27

Owner-supplied screenshots of the real emails. Captured as **structure and
intent**, to be mirrored in BVO's own voice and brand — not copied as
copy. Two separate emails, two separate jobs. Do not merge them.

### 8.1 Verification code (item 23)

Sent when an email address is entered at checkout. Carries the code.

| Element | What Wayfair does | Why it matters |
|---|---|---|
| Subject | **"Your verification code is 803935"** — the code is IN the subject | Readable on a lock screen. The buyer never opens the mail, which is the fastest possible path back to checkout. Copy this. |
| Greeting | "Hi Sam," — first name when known | |
| Lead | "Below is the secure verification code you requested. Enter the 6-digit code on Wayfair to verify it's you!" | States what to do with it before showing it. |
| The code | Large, centred, alone on its line | Nothing competes with it. No button, no link beside it. |
| Warning | "Do not share this code with anyone or forward this email to anyone. This code will expire in 10 minutes." | Anti-social-engineering. The expiry is stated in the body, not only enforced server-side. |
| Wasn't me | "If you didn't request this code:" → a **Secure My Account** link | **The part most implementations omit.** Someone can be mailed a code because a stranger typed their address. This gives them somewhere to go. |
| Link expiry | "This link will expire 24 hours after you receive this email... click here to receive a new secure email." | The escape hatch has its own lifetime, separate from the 10-minute code. |

### 8.2 New device sign-in (item 26)

Sent when an account signs in from a device that has no "remember this
device" cookie. **Notification only — carries no code and no credential.**

| Element | What Wayfair does | Why it matters |
|---|---|---|
| Title | "Review Device Sign-In" | Neutral. Not "Security alert", which reads as a breach and causes support calls. |
| Greeting | "Hi," — no name | Notable: they personalise the code email and not this one. |
| Body | "We noticed your account, **sam.elnazer@gmail.com**, was just used to sign in on a new device." | The account address is printed in the body so the reader can tell WHICH account, and spot immediately if it is not theirs. |
| Facts | "**Time:** September 27, 2026, 2:06 PM -0400  **Device:** Mac (Web)" | Timezone offset included. Device is deliberately coarse — no IP, no city. Enough to recognise yourself, not enough to alarm or to dox. |
| All clear | "If this was you, no action is required!" | Reassurance BEFORE the warning. Most recipients are the legitimate user. |
| Wasn't me | "If this wasn't you: **Please secure your account** immediately." | |
| Anti-phishing box | "How do you know this email is secure? Links sent from us will always start with `https://www.wayfair.com`." | The strongest element in either email. It teaches the reader to verify every future mail from you. Worth copying outright, with the BVO domain. |

### 8.3 What BVO must decide when building these

- **Do we have a "secure my account" destination at all?** BVO is
  passwordless — there is no password to change. The equivalent is
  probably: invalidate all outstanding codes for that email, drop every
  remembered-device cookie, and tell the owner. That endpoint does not
  exist and must be designed, not assumed.
- **Device string.** "Mac (Web)" comes from a user-agent parse. Decide the
  vocabulary before writing the template; a raw user-agent in an email is
  both unreadable and a privacy smell.
- **Where these live.** These are NEW templates for the auth flow, not
  among the nine transactional templates deferred to cutover in
  `docs/reference/PRE_LAUNCH_CHECKLIST.md`. Building them is part of items
  23 and 26. That boundary is deliberate — confirm it with the owner
  before writing either, rather than assuming which bucket applies.
