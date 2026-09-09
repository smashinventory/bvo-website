# Policy decisions — answers of record

Working answers from the intake session, 8 Sept 2026. This is the input the
four policy pages get drafted from. Constraints that shaped these answers are
in `VENDOR_POLICY_CONSTRAINTS.md`; human tasks are in
`PRE_LAUNCH_CHECKLIST.md`.

---

## Company

| Field | Value |
|---|---|
| Legal entity | Smash Inventory Solutions, LLC ("Smash") |
| DBA | BathroomVanitiesOutlet.com ("BVO") |
| Address | 5120 Old Ellis Pt, Suite C, Roswell, GA 30076 — **HQ office only** |
| Phone | (877) 777-1948 |
| Customer email | support@bathroomvanitiesoutlet.com *(to be created)* |
| Legal / privacy email | legal@bathroomvanitiesoutlet.com *(to be created)* |
| Governing law | Georgia |

**No shipping to or from the HQ address.** All product ships from vendor
warehouses. Returns are handled case by case, destination issued with the
RMA — never published. Unauthorised returns sent to the HQ office are
refused.

---

## Tracking and data (feeds the Privacy Policy)

- **Google Tag Manager** is the container. Disclosure covers, on an "in use
  / may be used" basis: GA4, Google Ads conversion + remarketing, Meta
  Pixel, Microsoft Advertising UET, Search Console / Merchant Center,
  heatmap and session-replay tools, A/B testing tags.
- **Microsoft Clarity** — session replay and heatmaps. Masking to be set to
  **Strict**; Microsoft Advertising data sharing to be switched **OFF**.
- **Tidio** — live chat, not yet active but intended. Disclosed now, worded
  to hold whether on or off.
- **No sale of personal information. No sharing for cross-context
  behavioural advertising** — true as of today.
- **Google Ads remarketing and Meta ads are planned within six months.**
  When either goes live the policy needs its sharing section switched on,
  plus a "Do Not Sell or Share" link, consent mechanism and GPC handling.
  Drafted now, left commented in the page with a marker. Gated in the
  checklist.
- Other processors disclosed: Authorize.Net, Brevo, FraudLabs Pro,
  Hostinger, WWEX/SpeedShip, and **James Martin — who receives the
  customer's name, address and phone on every drop-ship order.**

---

## Shipping Policy

| # | Decision |
|---|---|
| S1 | **Continental US only.** Free shipping on every order, no minimum. No Alaska, Hawaii or Puerto Rico — those orders are declined, not quoted. |
| — | BVO reserves the right to **decline any order for any lawful reason**, including prohibitive freight cost, suspected fraud, resale, or unusual quantity. Paired with the order-acceptance clause in the Terms: an order is an offer, confirmation is acknowledgement only, acceptance occurs on shipment. |
| S2 | **Curbside delivery with liftgate**, residential included, on every order. White glove is **not** a checkout option — a note invites the customer to call for a quote. |
| S3 | **Customer must be present to inspect and sign.** Missed-appointment redelivery and storage fees are the customer's responsibility. |
| S4 | **2–5 business days** to process and ship. |
| S5 | **Most orders arrive within 5–12 business days from order.** States plainly that once the freight is with the carrier, timing is outside BVO's control. |
| S6 | **Backorders: notify and let the customer choose** — hold, swap finish, or cancel for a full refund. |
| S7 | **Customer pays carrier reconsignment fees** caused by a wrong address. Address changes only before the order ships. |
| S8 | **No PO boxes.** **No freight forwarders or storage units** — a forwarder signs clean and kills the damage claim. **Job sites accepted**, with the account holder responsible for whoever signs on their behalf. |

### Payment timing — verified in code, not assumed

`checkoutController` calls `authorizeNet.authOnly`. BVO places an
**authorisation hold at order and captures when the item ships.**

Consequences to state in the policy:

- Card authorisations expire in roughly **7 days**. A backorder running
  longer will drop the hold and need re-authorising before shipment — worth
  saying, to pre-empt "my bank showed a charge that disappeared."
- **Cancellation before shipment costs BVO nothing** — voiding an
  authorisation is not a refund and carries no processing fee. The free
  cancellation clause can be generous.
- Declining an order is clean, since no money was ever captured.

---

## Returns & Refunds

*In progress.*

Settled so far:

- **Customer pays return shipping.** BVO does **not** claw back the outbound
  freight it absorbed. Cost is recovered through the restocking fee instead,
  which carries no advertising claim and so is simpler to disclose.
  (FTC 16 CFR 251 requires conditions on a "free" offer to be disclosed
  clearly and conspicuously *at the point of the offer* — a freight
  deduction would have to appear on the promo banner and product page, not
  just the returns page.)
- **RMA required.** No returns without authorisation; destination issued
  with the RMA.

### R1 — Return window

**30 days from the order date**, with a safety valve: if delivery runs past
the published timeframe, the customer gets **at least 10 days from the date
they receive it**.

The valve exists because a flat 30-from-order transfers shipping-delay risk
onto the customer. Deliver on day 28 and they have two days; deliver on day
31 and they never had a window at all. That is the scenario that produces a
chargeback, since from the customer's side nothing they did caused it. The
exception fires only on late deliveries, which are rare and already handled
case by case.

Keeps BVO inside James Martin's 30-days-from-PO in every normal case.

### R2 — Restocking fee: 25%

Matches what James Martin charges BVO exactly, so BVO stays whole on the
product. Anything lower is funded out of margin. Going higher to recover
freight was considered and rejected — comparables run 0–25%, and a 35% fee
on a $2,500 vanity is an $875 line item that reads punitive and invites
chargebacks.

BVO still absorbs the outbound freight it advertised as free. That is the
cost of the free-shipping offer and it was accepted deliberately.

### R4 — Condition, tiered

| Condition | Fee |
|---|---|
| Unopened, **or** opened but not removed from the box — fully packaged | **25%** |
| Removed from the box and not repacked in original factory manner | **40%** |
| Installed or modified | **Not returnable** |

**The 40% tier does not go back to James Martin.** Their requirement is
"clean and resalable condition, including original packaging," so a
de-packaged unit is one they refuse. BVO refunds 60%, recovers nothing from
JMV, and keeps the vanity.

That is a deliberate choice, not an oversight: BVO routes those units to one
of its local outlets and sells them as open-box. The reasoning is partly
commercial and partly reputational — a customer who recovers 60% writes a
very different review than one told "no."

**Operational consequence:** the RMA destination for a 40% return is an
outlet, not James Martin. The existing case-by-case RMA process already
supports this, since the destination is issued per return rather than
published.

**Customer warning to carry on the Returns page and in the shipping email:**

> Keep the crate and all packaging until you're certain you're keeping the
> vanity. Returns must be in their original packaging.

Without it, a customer breaks down the crate, then discovers the finish is
wrong, and lands in the 40% tier having had no idea it existed.

### R5 — Non-returnable

- **Special order / non-stock** — James Martin makes these non-cancelable and
  non-returnable outright. Requires the product-page notice now on the build
  list; a policy sentence alone does not hold up when the product page was
  silent.
- **Clearance / final sale** — including open-box units routed to the outlets
  under the R4 40% tier, so they do not cycle back.
- **Opened faucets and plumbing fixtures** — cannot be resold as new once
  seals are broken.
- **Custom-cut or modified countertops.**

Also disclosed, though a warranty rather than a return exclusion: **quartz
and stone tops carry a separate manufacturer warranty**, not James Martin's.

### R6 — Damage and shortage windows

| | JMV gives BVO | BVO gives customer |
|---|---|---|
| Visible damage | 72 hours | **48 hours** |
| Shortage (missing boxes) | 72 hours | **48 hours** |
| Concealed damage | 30 days | **21 days** |

Customer windows are deliberately shorter so BVO has time to file with James
Martin inside theirs.

**The clause this all hangs on**, and it is absolute:

> If the delivery receipt is not marked as damaged at the time of delivery,
> the claim WILL BE DENIED. "Subject to inspection" is not accepted.

Once the customer signs clean, the claim is dead with both James Martin and
the carrier. Two further points customers will not guess:

- **Refuse the shipment outright if the packaging is obviously damaged** —
  James Martin prefers this and will then replace or credit.
- **Photograph the pallet on the truck before unloading** if possible; James
  Martin's own document says this limits the customer's liability.
- **Any outer packaging damage automatically voids a later concealed-damage
  claim.** Visible damage must be caught at delivery or nothing after it
  counts.

### R7 — Damage resolution: mirror James Martin's discretion

James Martin reserves the right to send a part or attempt repair, and offers
touch-up kits, parts and Furniture Medics in-home repair. On refusals they
choose replacement or credit at their sole discretion.

BVO therefore does **not** promise replacement-or-refund. Wording:

> Depending on the damage, that may be a replacement part, a touch-up or
> repair kit, professional in-home repair, a replacement item, or a refund.

Promising replacement outright would mean funding it whenever James Martin
offers a part instead — the whole margin on a $2,000 vanity.

### R8 — Refused deliveries (no damage reason)

Treated as a standard change-of-mind return: **25% restocking plus return
freight**. Charging more than a normal return invites the argument that it is
punitive, and the economics are the same.

**Must be reported to BVO the same day.** An unreported refusal sits at a
terminal accruing storage while BVO has no idea it is coming back; those
charges are the customer's responsibility.

*This raised a live bug — refusals are currently mis-mapped as `delivered`.
See the checklist.*

### R9 — Cancellation

**Free any time before the order ships.** Costs BVO nothing: checkout uses
`authOnly`, so voiding a hold is not a refund and carries no processing fee.

Once shipped, no cancellation — refuse delivery or request a return.
**Special orders are non-cancelable from the moment the order is placed.**

Wording notes that shipment happens in 2–5 business days, so "contact us as
soon as possible" rather than implying a leisurely window.

### R10 — Refund timing

**5–7 business days from when BVO receives and inspects the return**, to the
original payment method. The clock starts on BVO's inspection, **not** on
James Martin settling their credit — the customer should not wait on that.

Notes that the customer's bank may take a few days beyond that to post,
which is the most common "where is my refund" call and is not BVO's doing.

Damaged-item refunds are quicker: no return shipment to wait for, only the
photos and the claim.

### R11 — Warranty: pass-through only

Products carry the **manufacturer's** warranty. BVO provides none of its own
and will facilitate claims.

James Martin's terms: one year limited, defects in material or workmanship,
**residential use only**, repair or replacement at their discretion,
**excludes installation, labour and removal**, voided by modification,
commercial use, improper installation or abrasive cleaners. **Quartz and
stone tops excluded** — separate manufacturer warranty.

**Link** to James Martin's warranty rather than restating it, since they can
change it without notice. BVO's existing Shopify page already does this.

Discipline on wording matters: filler like "we stand behind everything we
sell" can be read as an independent warranty BVO would then fund alone. The
labour exclusion in particular should be explicit — if a defective vanity has
to come out after installation, that plumber's bill is covered by nobody, and
the customer should learn that from the page rather than the invoice.

---

## Terms & Conditions

*Not started.* Carried in from the shipping answers:

- Order acceptance: offer / acknowledgement / acceptance on shipment.
- Right to decline any order for any lawful reason.

---

## Privacy Policy

*Not started beyond the tracking answers above.*
