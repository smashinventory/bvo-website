# Trade Account program — outline spec

> Trade program: eligibility, pricing visibility rules and the gating requirement.

Scoped 8 Sept 2026. **Build after the policy pages ship, not before.**

Nothing for trade accounts exists yet: `customers` has no group, tier or
trade flag. The multer upload plumbing already used for product images and
documents can be reused for business-document uploads.

---

## The MAP constraint is the reason this design works

James Martin's MAP policy restricts the **advertised** price, not the
selling price. A 15% discount on a public page is advertising below MAP. The
same discount visible only to an approved, logged-in trade account is not
advertised at all.

**So the login gate is not a perk mechanism — it is the compliance
mechanism.** One hard rule follows:

> Trade pricing must never render to a logged-out visitor. Not in a cached
> page, not in a meta tag, not in structured data, not in the product feed,
> not in the Merchant Center export.

That deserves an executing gate in the push script, not a code comment.
Enforcement under the MAP policy is a written warning, 24 hours to comply,
and James Martin may withhold shipment of new orders.

---

## Application and approval

- Application form behind account creation: business name, type, address,
  tax ID, and how they intend to use the account.
- **Upload of a business licence and/or business card** for verification.
- Approval is manual and at BVO's discretion. Pending accounts see retail
  pricing until approved.
- Notices displayed at signup, before submission — see Terms below.

**Privacy consequence:** business licences can carry personal data, and sole
proprietors sometimes use an SSN as the tax ID. These documents need a
retention period, restricted access, and a line in the Privacy Policy. Do
not store them in a publicly reachable uploads directory.

**Tax consequence:** a trade buyer purchasing for resale needs a resale
certificate on file, otherwise BVO must charge sales tax. Worth collecting
at application rather than chasing at checkout.

---

## Tiers

Market reference: Wayfair Professional runs three tiers — Professional, Pro+
and Enterprise — assigned on **rolling 12-month verified spend**, free to
join, with no minimum to join or remain.

**Recommendation for BVO: two tiers, not three.**

| Tier | Qualifier | Discount |
|---|---|---|
| Trade | Approved application | 15% |
| Trade+ | Rolling 12-month spend threshold | TBD, +5% suggested |

Reasoning:

- **Rolling 12 months, never calendar year.** A calendar reset drops a good
  customer to zero every January, which is exactly the wrong signal.
- **Do not copy Wayfair's thresholds.** Their numbers reflect their margin,
  not BVO's. Set tiers against what a James Martin vanity actually earns
  after absorbed outbound freight and 25% restocking exposure. A 15% base
  plus a 5% tier on a thin-margin SKU can go underwater without showing up
  until the quarter closes.
- **Start with two and add a third once real spend distribution exists.**
  Inventing three thresholds before there is any data is guessing.

---

## Dashboard — ranked by value, not by ease

1. **Spend toward next tier.** A progress bar — "$18,400 of $25,000 toward
   20%." This is what turns a purchase into progress, and it is the feature
   that changes behaviour rather than just reporting on it.
2. **Projects.** Contractors and designers think in jobs, not orders.
   Grouping orders under a job name with spend per job is consistently the
   highest-rated trade feature. Needs a `projects` table and an optional
   `order.project_id`.
3. **Quote builder.** Build a list, export a branded PDF the customer hands
   their own client at their markup. For designers this is the reason to buy
   from BVO rather than a big box. Highest effort of the set; consider it a
   phase two.
4. **Reorder / saved specs.** An apartment build needs the same vanity forty
   times across six months.
5. **Invoices and tax documents** in one place for their bookkeeping.
6. **Multiple users on one account** — a design firm with three people and
   one combined spend total. Needs a parent/child account relationship;
   defer unless asked for.

Order of build: 1 and 2 first. They are the ones with commercial effect and
they are both straightforward given `orders.total` and a new grouping table.

---

## Terms clauses this requires

- Trade accounts governed by separate trade terms, accepted at application.
- Approval at BVO's sole discretion; accounts may be revoked.
- **Trade pricing is confidential and may not be republished.** This
  protects BVO's MAP position — a contractor posting trade pricing publicly
  is a violation that points back at BVO.
- **Commercial installations void the manufacturer's warranty**, which is
  residential only. A contractor buying forty units for an apartment
  building has no warranty and must be told before, not after.
- Resale certificate required if purchasing for resale.
- Business documentation is verified and retained.

---

## ✅ ANSWERED BY THE OWNER — 2026-10-21

Six decisions, given directly. These close most of the open questions below
and supersede the recommendations above where they differ.

### 1. Tiers, names and thresholds — DECIDED

**The naming convention is canonical.** Owner, 2026-10-21. These are the
names in customer-facing copy, in the admin, and in the stored value. Use
them verbatim; do not invent "Trade+", "Gold", "Pro" or any other label.

| Name | Who | Qualifier | Discount |
|---|---|---|---|
| **Platinum Member** | Retail | Claimed the offer (see §6) | **10% first order** |
| **Platinum Trade** | Trade | Approved application | **15%** |
| **Elite Trade** | Trade | **$20,000** in a rolling 12 months | **20%** |

This replaces the "Trade / Trade+" rows in the Tiers table above, and the
"TBD, +5% suggested" placeholder. The owner set 20% at $20,000.

⚠️ **Platinum Member is a RETAIL tier and is not part of the trade
programme.** It shares the discount engine and is documented here so the
ladder is in one place, but a Platinum Member has uploaded nothing, been
approved by nobody, and gets one discount on one order. Do not let the
shared word "Platinum" collapse the two in code: the trade tiers are
ongoing and MAP-gated, the member tier is a single-use first-order offer.

**Store the tier as a value, not as a set of booleans.** One column with
these four states — none / platinum_member / platinum_trade / elite_trade —
beats `is_trade` + `is_elite` + `is_member` flags, which permit nonsense
combinations and need reconciling every time one is read.

⚠️ **Elite Trade is computed, not stored.** The $20,000 is a rolling
12-month figure, so the tier is derived at price time from captured
revenue. Writing "elite" onto the account would freeze a customer at 20%
after their spend fell away — and the rolling window exists precisely so it
can fall away. The stored value distinguishes *approved trade* from
*retail*; which trade tier they are on today is a calculation.

**Window: ROLLING 12 MONTHS.** Confirmed by the owner 2026-10-21 — *"20,000
in a rolling 12 months."* This matches the recommendation in the Tiers
section above and settles the question that section raised.

Consequences, stated so nobody re-derives them:

- Qualification is `SUM(captured revenue) over the last 365 days >= 20000`,
  evaluated at price time — not a stored tier the account keeps forever.
- **A customer CAN fall back to 15%** if they go quiet. The meter therefore
  has to show a figure that can go DOWN, and the trade terms must say so
  plainly, or the first person who drops a tier will reasonably feel cheated.
- Never a calendar year. The spec's reasoning holds: a January reset drops a
  good customer to zero on 1 January, which is the wrong signal to send the
  best accounts.

⚠️ **The clock runs on CAPTURE, not on order date.** `src/config/revenue.js`
is the single source: nothing counts until `payment_captured_at` is set. An
authorised-but-uncaptured order must not move the meter, and a cancelled
order must not leave someone promoted.

### 2. The spend meter — REQUIRED, not optional

Owner: *"need a meter built with some kind of dashboard showing the trade
customer a bar/graph how much they need to arrive at the 20% savings."*

This is dashboard item 1 in the list above, which already called it the
highest-value feature. It is now in scope, not a phase two.

**Basis: captured revenue only.** Per `src/config/revenue.js`, nothing counts
until `payment_captured_at` is set — the owner's own rule from 2026-10-19.
An authorised-but-uncaptured order must not move the meter, or a cancelled
order would promote someone to 20% permanently.

### 3. Qualification — business card only

Owner: *"Biz card to qualify — sales tax id if they want sales tax
exemption."*

So the two documents are **decoupled**, and this narrows the privacy
exposure considerably:

- **Business card** → qualifies for trade. Low friction, as originally asked.
- **Sales tax ID / resale certificate** → optional, and ONLY collected from
  applicants who want sales-tax exemption.

The "Tax consequence" note above is therefore answered: the certificate is
not collected from everyone at application, only from those claiming
exemption. Anyone without one is charged sales tax normally.

### 4. Terms — gated acknowledgement, before the account exists

Owner: *"Make this part of a terms and agreements they must scroll
through/read then click an acknowledgement after biz card upload but before
account is set up."*

Sequence is therefore fixed:

```
business card upload → scroll the trade terms → acknowledge → account created
```

The acknowledgement must be **scroll-gated** — the button stays disabled
until the terms have actually been scrolled to the end.

⚠️ **Do not build new evidence machinery.** Terms-acceptance evidence —
timestamp, IP and the VERSION of the copy agreed to — already exists from
45-point scope item 12 and the consent columns added in #263–#266. Reuse it.
A second way of recording consent is a second thing to drift.

The six clauses listed under "Terms clauses this requires" are the content.
That is owner-voice copy and still needs writing — same category as open
item 33.

#### ⚠️ MARKETING CONSENT ON THE TRADE PATH — added 2026-10-21

Spotted by the owner: the Platinum Member banner carries a consent checkbox
and the Platinum Trade banner does not.

Correct as far as the BANNER goes — the trade banner's job is to earn the
click through to the application, and asking for marketing permission
before asking for a business name is the wrong order.

**But nothing in this spec previously collected marketing consent on the
trade path at all.** A trade applicant could have gone through card upload,
terms and approval and never been asked. Trade buyers are the highest-value
contacts BVO has — repeat purchasers, large baskets, professionally
interested in exactly the deals BVO sends. Losing consent on that segment
is the expensive version of this omission.

**So: a marketing checkbox on the trade APPLICATION form**, sitting with the
terms acknowledgement, writing to the same `customers.accepts_marketing`
field and the same evidence columns as everything else.

⚠️ **OPTIONAL FOR TRADE, REQUIRED FOR MEMBER — the difference is
deliberate.** For Platinum Member the tick IS the claim: no consent, no
discount, because the 10% is the consideration. For Platinum Trade the
consideration is a legitimate business, not an email permission.
Conditioning a trade account on accepting marketing is a more aggressive
proposition and would put off exactly the professionals worth having.
**Approval must never depend on it.**

Expect a high opt-in rate regardless: a contractor who sells bathrooms wants
to know when vanities are discounted. That is the argument for asking, not
for compelling.

**One flag, not two.** Do not add a separate "trade marketing" preference.
`accepts_marketing` is the permission and the TIER is already stored, so
Brevo segments on tier. A second preference field is a second thing to keep
in sync and a second thing to get wrong on an unsubscribe.

### 5. Stacking — ANSWERED: replace, never stack

Owner, 2026-10-20: best one wins across bundle discount, first-order offer
and trade. Matches the recommendation that was already in this document.

### 6. The separate first-order offer — one per HOUSEHOLD

Not part of the trade programme, but decided in the same pass and recorded
here because it shares the discount engine:

- **10% off the first order**, sitewide, **no cap**.
- Limit is **one per household/address**, not per email.

### ⚠️ THE OFFER MUST BE CLAIMED, NOT INFERRED — owner, 2026-10-21

Owner: *"we need to create some difference in the path of just verifying
email in the normal check out process and doing it from the deal section —
so that we do not have a discount on every transaction."*

**This is the defect that would have made the offer worthless.** Checkout
requires an account — 45-point scope item 22, amended 2026-09-27: *"NO
GUEST. Account required, Wayfair-style."* So every first-time buyer creates
an account whether they want the offer or not. A rule of "has an account and
has not ordered before" therefore grants 10% to **100% of new customers,
automatically and silently**. That is not an incentive; it is a blanket 10%
margin cut on every new buyer — and on James Martin products, which already
sit at MAP, it comes straight off the bone.

**So eligibility is an explicit GRANT, never a property of having an
account.** Three conditions, all required:

1. **Enrolled through the offer.** A dedicated marker on `customers` — set
   ONLY by the deals-page claim, never by the checkout signup path. Not
   `signup_source`: that is attribution metadata, and a grant inferred from
   a descriptive label changes silently the day someone re-labels a path.
   `signup_source` stays, for reporting.
2. **Marketing consent given.** The exchange is 10% for the email AND
   permission to use it. Checkout signup does not require marketing consent
   (that is a separate checkbox, #265), so this also keeps the two paths
   genuinely distinct.

   **The checkbox — owner, 2026-10-21:** *"When they sign up there should be
   a check box that agrees to receive notifications on deals and promotions.
   So two birds with one stone on consent for future outreach."*

   Rules for it:

   - **Unticked by default, and ticking it IS the claim.** Never pre-ticked.
     A pre-ticked box is weak evidence of consent and, more practically, it
     would hand the tier to people who never agreed to anything — which is
     the exact defect this whole section exists to prevent.
   - **Label it as required for the offer**, not as an optional extra. It is
     honest and it is what makes the 10% an exchange rather than a giveaway:
     "Yes — email me deals and promotions. Required to claim your 10%."
   - **Write to `customers.accepts_marketing`**, the field that already
     exists, and record evidence with the machinery already built for
     45-point scope item 12 and #263–#266: timestamp, IP, and the VERSION of
     the copy agreed to. Do not add a second consent store.
   - It is the SAME consent the checkout checkbox captures, reached by a
     different route. A customer who already consented at checkout and later
     claims the offer must not be double-counted or re-subscribed in Brevo.

   *Jurisdiction note, for the record and not a blocker:* bundling consent
   with a benefit is fine under US rules (CAN-SPAM requires no prior consent
   at all, only a working unsubscribe), and BVO ships US-only. It would be
   weak under GDPR, which requires consent to be freely given. Revisit only
   if BVO ever markets into the EU or UK.
3. **No prior captured order.** "First order" measured with
   `revenue.js` IS_COUNTED — captured, not merely authorised. Otherwise an
   existing customer could enrol today and claim a first-order discount on
   their fifth purchase.

**The gaming vector, stated rather than hidden:** a shopper mid-checkout can
abandon, go to the deals page, enrol, and come back. Recommend accepting
that — they performed the action and gave marketing consent, which is the
offer working as intended. Closing it would mean requiring enrolment to
predate the cart, which punishes people who find the offer late.

⚠️ **Key the household on the Google `place_id`, not on an address string.**
45-point scope item 27 already settled this reasoning for saved addresses:
*"three spellings of one street are ONE place_id, and string dedup would
false-flag honest customers."* The place_id is already captured and stored
(items 15/17). `sample_redemptions` is the working precedent for a
one-per-household limit.

---

## Open questions for later

- ~~Trade+ spend threshold and discount~~ — **ANSWERED above: 20% at $20,000.**
  Rolling vs lifetime still to confirm.
- ~~Does trade pricing stack with site-wide promotions, or replace them?~~
  — **ANSWERED above: replace.**
- Do trade accounts get different return terms? James Martin's 25%
  restocking applies regardless, so probably not — but bulk returns are a
  different conversation at $40,000 than at $1,500.
- Freight: is free shipping still free on a forty-unit order? Almost
  certainly needs a threshold or a quote.
