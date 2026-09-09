# Pre-launch checklist — BVO

Things that must be done by a human before launch, with why they matter.
Add to this as items come up rather than letting them scatter.

---

## Email addresses — set up before the policy pages go live

These addresses are referenced in the Terms, Privacy, Shipping and Returns
pages. **If a page names an address that doesn't exist, a customer's legal
notice or privacy request bounces — and "we never received it" is not a
defence.** So these must exist before those pages publish.

| Address | Used on | Purpose |
|---|---|---|
| `support@bathroomvanitiesoutlet.com` | Shipping, Returns, Terms | Orders, shipping questions, RA requests, general contact |
| `legal@bathroomvanitiesoutlet.com` | Terms, Privacy | Legal notice, disputes, arbitration opt-out, privacy requests (access / deletion / opt-out) |

Two is enough at launch. A separate `returns@` and `privacy@` can be added
later; while volume is low, splitting further just means more inboxes to
forget to check.

**Setup notes**
- Both can be aliases forwarding to the existing Gmail — they do not need
  separate mailboxes. What matters is that mail sent to them arrives.
- `legal@` is the one with deadlines attached. Privacy requests under CCPA
  carry a statutory response window, and arbitration opt-outs are
  time-limited. It should not sit unread.
- Hostinger includes email hosting on most plans; these can be created in
  hPanel under Emails.
- Once live, confirm by sending a test to each from an outside account.

**Status:** 🔴 **LAUNCH BLOCKER — not created yet.** Owner: Sam.

**Decision 9 Sept 2026:** migration 014 runs *before* the mailboxes exist.
The four policy pages replace migration-012 placeholders, which is a clear
improvement, and the site is not taking real orders yet — so a few days of
an address that goes nowhere is an acceptable trade. That makes this a
**blocker on launch, not on the migration**, and it is the reason this item
was promoted from a to-do to a blocker.

The exposure it leaves open until then: `legal@` carries statutory
deadlines. A CCPA response window starts when the request is *sent*, not
when it is read. A bounced privacy request is worse than an absent page.

Also add **`orders@bathroomvanitiesoutlet.com`** — it is the `BREVO_FROM_EMAIL`
on every transactional email, so customer replies land there. Brevo will not
send from an address it has not authorised, so either this mailbox must
exist to receive the single-sender verification link, or the whole domain
must be authenticated by DNS (which is required before launch anyway for
Gmail/Yahoo/Microsoft deliverability).

**Verify when done:** send a test to each from an outside account, and
confirm a reply to an order confirmation reaches a human.

---

## Microsoft Clarity — configure before it goes live

Clarity records session replays and heatmaps, so it sees more than a normal
analytics tag. Two settings decide what the Privacy Policy has to say.

**1. Masking mode — set to Strict.**
Clarity defaults to *Balanced*, which masks passwords, card numbers and
similar sensitive inputs; masked content is never uploaded. On a site with a
live checkout, *Strict* is the safer setting — the cost is slightly less
readable replays, and the benefit is that customer names, addresses and
emails typed into checkout are not sitting in a Microsoft account.
Clarity dashboard → Settings → Masking.

**2. Data sharing with Microsoft Advertising — decide, then set.**
By default Clarity shares collected data with Microsoft Advertising (Bing)
for ad targeting. It can be switched off in Settings → Data sharing.
This is not a cosmetic choice:

- **Left ON**, that is cross-context behavioural advertising. Under CCPA it
  is "sharing," which means the Privacy Policy must declare it and the site
  needs a "Do Not Sell or Share My Personal Information" link with a working
  opt-out.
- **Switched OFF**, the disclosure is simply that Clarity is used for
  analytics and session replay, and no opt-out link is required on that
  basis.

**DECIDED 8 Sept — switch data sharing OFF.** BVO does not run Bing Ads and
does not sell data. With sharing off, the Privacy Policy states plainly that
BVO neither sells personal information nor shares it for cross-context
behavioural advertising, and no "Do Not Sell or Share" link is required.

**Two actions, both in the Clarity dashboard, both before it goes live:**
1. Settings → Data sharing → **OFF**
2. Settings → Masking → **Strict**

**This is a standing constraint, not a one-time task.** The "we do not sell
or share" statement stops being true the moment anyone enables Google Ads
remarketing, a Meta Pixel, or Clarity's Microsoft Advertising toggle. Any of
those means the Privacy Policy must be updated and an opt-out link added. It
is a switch, not a rewrite — but it is not optional.

**Status:** not configured. Blocks: final wording of the Privacy Policy.

---

## Advertising launch — must happen BEFORE the first ad tag fires

Sam confirmed 8 Sept: Google Ads remarketing and Meta/Facebook ads are
planned within six months.

Today BVO shares nothing for advertising, so the Privacy Policy says exactly
that. The day the first remarketing or Pixel tag goes live that stops being
true, and three obligations attach at once. **These are prerequisites for
turning the tags on, not follow-ups.**

1. **"Do Not Sell or Share My Personal Information" link** — footer, on every
   page, with an opt-out that actually suppresses the ad tags.
2. **Cookie consent mechanism** — advertising tags should not fire before the
   visitor has had a say. Also the natural home for the opt-out above.
3. **Global Privacy Control (GPC)** — browsers send a `Sec-GPC: 1` header.
   Businesses that sell or share are required to treat it as an opt-out
   request. This is server-side work, not a policy paragraph, and it is the
   one most often missed entirely.
4. **Switch on the pre-written sharing section** in the Privacy Policy. It
   will be drafted and left commented in the page source with a marker, so
   this is a five-minute edit rather than a rewrite.

**Why it is written this way:** a policy that claims BVO shares data for
advertising while it does not is inaccurate, and accuracy is the legal
standard — so the claim cannot simply be made early "to be safe." The
sequence matters: policy and opt-out first, tag second.

**Owner:** Sam, at advertising launch. Do not enable a tag before items 1–4.

---

## ⚠ MAP price compliance — check before launch

James Martin operates a Minimum Advertised Price policy. Resellers may not
*advertise* covered products below MAP; actual selling price is unrestricted.
Enforcement is a written warning, **24 hours to comply**, and James Martin
may **withhold shipment of new orders** — which stops the business.

The new storefront advertises a struck-through MSRP, a sale price and a
"Save $X" badge on every card, plus a "Sale" nav category. **None of it is
checked against MAP.**

By contrast, BVO's existing Shopify site qualifies its discount as "10% Off
All Vanities — **Local Pick Up Orders Only**." That qualifier appears
deliberate and is a common way to stay inside a MAP policy. The new site has
no equivalent.

**Action:** reconcile advertised prices against the current MAP list before
launch. If any covered product advertises below MAP, either raise the
advertised price or apply the discount somewhere that is not "advertising"
— in cart, at checkout, or behind a local-pickup qualifier.

The MAP document itself is **confidential** and must not be published,
quoted or paraphrased on the site. See `docs/VENDOR_POLICY_CONSTRAINTS.md`.

**Owner:** Sam. Blocks: launch, not the policy pages.

---

## Damage instructions must appear outside the policy page

James Martin will deny any freight damage claim where the delivery receipt
was not marked damaged at the time of delivery. "Subject to inspection" is
explicitly not accepted. Once the customer signs clean, the claim is dead
and the loss lands on BVO.

A policy page alone does not discharge this. The instruction needs to appear
at **checkout**, in the **order confirmation email**, and above all in the
**shipping notification email** — the one customers actually open, because
it carries the tracking number.

Short form: *inspect before signing; note any damage on the delivery receipt
before you sign and photograph it; refuse the shipment if the packaging is
obviously damaged.*

**Owner:** build task, not a policy task. Blocks: taking freight orders.

---

## Special-order items — surface the flag to the customer

**The data already exists.** `products.status` is an ENUM
`('active','discontinued','coming_soon','special_order')`, and
`importJamesMartinFeed.js` already populates it — any feed status containing
"special" maps to `special_order` automatically.

**The customer never sees it.** `status` is not selected in any storefront
query and is not displayed on the product page. So a special-order item
would sell today with no indication that it is non-cancelable and
non-returnable.

James Martin's policy makes special orders final, full stop. A blanket
sentence in the Returns policy does not hold up when the product page said
nothing — "how was I supposed to know" is a fair question and it wins.

**Build (approved 8 Sept, ahead of need — there are no special-order items
in the catalogue today, but both James Martin and ER Vanities run these
from time to time):**

1. Select `p.status` in the storefront product query.
2. Product page notice when `status = 'special_order'`:
   *"Special order item — non-cancelable and non-returnable once your order
   is placed."*
3. Checkout acknowledgement if the cart contains one, so it is accepted at
   the moment of purchase rather than discovered afterwards.

Sizing: small. The column, the importer mapping and the admin field all
exist; this is display only.

**Owner:** build task. Blocks: selling any special-order SKU, not launch
itself.

---

## 🔴 Refused deliveries are invisible — and worse, mis-marked as delivered

**Found 8 Sept while writing the returns policy. This is a live bug.**

`_mapCarrierStatus` in `shippingController.js` has no concept of a refusal,
and the check order makes the common case actively wrong:

```js
else if (s.includes('exception') || s.includes('fail')) v = 'exception';
else if (s.includes('deliver'))                         v = 'delivered';
```

| Carrier status | Maps to | Result |
|---|---|---|
| "Delivery Refused" / "Refused Delivery" | **`delivered`** | Order marked complete. Green row. Freight going back. |
| "Consignee Refused" / "Returned to Shipper" / "RTS" | `booked` | Silently normal |

`SHIPMENT_TO_ORDER_STATUS` maps `delivered` → order status `delivered`, so
the order closes as fulfilled while the vanity is on its way back to
Indiana accruing storage.

The comment above that function already warns that "several carrier strings
contain 'deliver' without meaning delivered" and handles *Out For Delivery*
and *Delivery Exception*. Refusal is the third case and it was missed.

**Why it matters commercially:** LTL storage accrues daily and the freight
eventually returns to origin at BVO's cost. A refusal noticed three days
late is three days of fees, and `computeRag` will never flag it because
`delivered` is a green state.

### Build

1. **Add `refused`** to `SHIPMENT_STATUSES` — deliberately NOT folded into
   `exception`. The two need different responses: an exception means chase
   the carrier; a refusal means call the customer today, decide replace or
   return, and stop the storage clock.
2. **Match it before the `deliver` check** — `refus`, `declined`,
   `returned to shipper`, `rts`, `consignee refused`. Order matters, which
   is the whole cause of this bug.
3. **`computeRag` returns red** on `refused`, with a distinct **REFUSED**
   pill rather than a generic red dot — the action differs from every other
   red state.
4. **Do not** map `refused` into `SHIPMENT_TO_ORDER_STATUS` as delivered.
   Leave the order open.
5. **Email alert on transition to `refused`.** A refusal discovered on the
   dashboard next morning is already a day of storage.
6. **Check the `shipments.status` column type first.** The orders ENUM in
   `001_initial_schema.sql` is a different column; the shipments table was
   created later and its type was not confirmed. If it is an ENUM, this
   needs a migration alongside the code.

**Gate for the push:** feed the mapper the real carrier strings and assert
"Delivery Refused" does **not** return `delivered`. Negative-test by
restoring the current order of checks and confirming the gate fails.

**Owner:** build task. Priority: high — it silently closes orders as
complete.

---

## Sales-by-state / nexus tracker — admin report

Requested 8 Sept. Buildable from existing data: `orders.ship_state` is a
`CHAR(2)` sitting alongside `subtotal`, `tax` and `total`.

**Build** — new page under Marketing & Analytics, beside the JMV reports.

- One row per state: **order count** and **total sales**, shown for both the
  **current calendar year** and a **rolling 12 months**. States differ on
  which period they measure, so both need to be visible.
- Progress bar against that state's own threshold. **Do not hardcode
  $100k / 200 transactions** — several states have dropped the transaction
  test and a few use different figures. Put thresholds in a small config
  table that can be edited without a deploy.
- Colour bands: green under 60%, amber 60–85%, red above 85%. The point is
  warning *before* crossing.
- Flag the six drop-ship resale-certificate states (CA, FL, HI, IL, MD, MA)
  distinctly — they matter for a different reason than nexus, see below.

**What the report is not.** It tells Sam when to call the CPA. It does not
determine when registration is required — that has details a dashboard
cannot see, and presenting it as an answer would be worse than not building
it.

---

## Sales tax — drop-ship resale certificate question for the CPA

Vendors ship from **GA, CA, TX and NJ**. BVO holds a resale certificate.

**A vendor warehouse does not generally create nexus for BVO** — in a
standard drop shipment that inventory belongs to the vendor. Physical nexus
would come from BVO's own property or people in a state.

**The resale certificate rule is the real exposure.** A drop shipment is two
transactions: vendor-to-BVO, then BVO-to-customer. The first is exempt only
if the vendor accepts BVO's resale certificate — and **California, Florida,
Hawaii, Illinois, Maryland and Massachusetts reject an out-of-state resale
certificate** in this scenario.

BVO has a vendor shipping **out of California**. If BVO's certificate is a
Georgia one and the vendor has California nexus, that vendor may be required
to charge BVO California sales tax on the **wholesale** price — a cost BVO
cannot pass to the customer and cannot recover.

**Question to put to the CPA**, phrased narrowly so it gets a usable answer:

> "We drop-ship from vendor warehouses in GA, CA, TX and NJ. Is our Georgia
> resale certificate accepted by our California vendor for California-bound
> orders, or do we need a California seller's permit?"

Not a launch blocker. Worth resolving before California volume builds.

*Not tax advice — this is a flag for a professional, not a conclusion.*

---

## OPEN DECISION — marketing opt-in and email stream split

Raised 8 Sept, **deliberately deferred** so it does not derail the policy
work. No action until Sam decides.

### Where things stand today (verified in code, not assumed)

- `Customer.create` defaults `acceptsMarketing = false`.
- Registration only sets it if the field is present — and **no marketing
  checkbox exists in any view**.
- **Checkout does not touch marketing consent at all.**
- The only opt-in route is the newsletter form, which is genuine
  affirmative consent.

So BVO is compliant by default, but collects almost no marketing consent —
nothing at signup, nothing at checkout, which are the two highest-intent
moments.

### What Sam wants

A **pre-checked** opt-in at signup and checkout, with two separate email
streams: transactional through one provider, campaigns through Brevo.

### The constraint — it is not the law

US CAN-SPAM is an opt-out regime, so pre-checked marketing consent is
federally legal for US recipients.

**Brevo prohibits it.** Their anti-spam policy requires consent that is
*active* — "the contact must check a checkbox and the registration checkbox
can't be pre-checked" — and breach risks **immediate account suspension**.

**Why that is worse than it sounds:** Brevo currently sends BVO's
transactional email as well. A suspension would stop order confirmations and
the **shipping notification that carries the freight-inspection
instruction** — the clause that protects BVO from denied damage claims.

Brevo also requires consent to be *specific*: the opt-in cannot be bundled
into a single "I agree to the Terms" checkbox. It needs its own box.

### The split is a good idea regardless

Separating transactional from marketing protects order email from campaign
complaints, and it removes the suspension exposure above. Worth doing on its
own merits.

Note: **Twilio is SMS.** For transactional *email*, SendGrid or Postmark are
the usual choices. And if SMS is genuinely on the table, that is a different
regime — TCPA requires express **written** consent, pre-checked is
definitively insufficient, and statutory damages run $500–1,500 per message.
Decide SMS separately from email.

### Options

1. **Unchecked box at signup and checkout**, with copy that earns the tick.
   Compliant everywhere, keeps Brevo, grows the list from near zero.
2. **Split streams first, then revisit.** Removes the transactional risk;
   the marketing stream still cannot be pre-checked on Brevo.
3. **Pre-checked on a provider that permits it.** Every reputable ESP has
   the same rule, so this realistically means self-hosting or accepting a
   lower-tier sender — with deliverability consequences that reach
   transactional mail too.

**Recommendation:** option 1, plus the stream split for its own sake.

**Owner:** Sam. Not blocking anything.

---

## Menu Manager — full menu controls (requested 8 Sept)

The Menu Manager edits ITEMS inside a menu well — add, remove, drag to
reorder, all working. What it cannot do is manage the **menus themselves**.
`menusController.js` has no `INSERT INTO nav_menus`, so menus only exist if
a migration created them.

Consequence: adding a fourth footer column, or a sidebar menu, or a seasonal
promo menu, currently needs a developer and a migration.

**Wanted:** create, rename, delete and reorder menus from the admin.

**Build notes**

- `nav_menus` is `(id, name, handle, created_at)` with a UNIQUE handle.
  Creating one is trivial; the care is in the handle, since code queries by
  it. Auto-slug the name, allow an override, and block editing the handle
  of a menu the code depends on.
- **Protect the wired handles.** `main-menu`, `footer-shop`, `footer-help`
  and `footer-company` are read by `megaMenuData.js`. Deleting or renaming
  one silently empties part of the site — the exact failure this whole
  thread was about. Either mark them undeletable, or warn clearly.
- Deleting a menu cascades its items (FK `ON DELETE CASCADE`). Confirm
  before, and consider a soft delete.
- **The real trap:** a newly created menu is not rendered anywhere. Someone
  creates "Sidebar Links", adds items, saves happily, and nothing appears —
  because no template reads that handle. That is precisely the defect just
  removed from the footer. Either show which handles are actually consumed,
  or accept that new menus are inert until wired.

**Suggested scope split.** Rename and reorder first, since they are safe.
Create and delete second, with the protections above. Rename is the one
with immediate value: "Footer — Help" could become "Customer Service"
without a developer.

**Owner:** build task, not blocking launch.

---

## Also outstanding before launch

Carried from earlier sessions — unchanged, listed here so there is one place
to look.

- **Authorize.Net credentials** into hPanel environment variables, then a
  sandbox transaction end to end. Checkout is wired but unproven with live
  keys.
- **One production `?diag=1` run** for WWEX `vendorOps` to confirm the
  shipping integration against the live account.
- **Bundle builder "James Martin only" label** — the builder currently
  implies the whole catalogue.
- **Sales tax registration / nexus** — see question T6 in the policy
  questionnaire. Determines what the Terms can state about tax.
- **Cookie banner** — see P4. Not strictly required today for a US-only
  business, but expected, and it is what a CCPA opt-out link attaches to.
