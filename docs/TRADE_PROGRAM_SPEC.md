# Trade Account program — outline spec

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

## Open questions for later

- Trade+ spend threshold and discount — needs margin analysis, not a guess.
- Does trade pricing stack with site-wide promotions, or replace them?
  (Recommend: replace. Stacking a 15% trade discount on a promotional price
  is where margin disappears quietly.)
- Do trade accounts get different return terms? James Martin's 25%
  restocking applies regardless, so probably not — but bulk returns are a
  different conversation at $40,000 than at $1,500.
- Freight: is free shipping still free on a forty-unit order? Almost
  certainly needs a threshold or a quote.
