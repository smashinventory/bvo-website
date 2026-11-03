# BVO — Operational Gap Analysis
**Date:** 2026-10-27
**Scope:** whole operation — discovery → browse → cart → checkout → payment → fulfilment → delivery → post-delivery → support → returns → retention → operator tooling
**Method:** every claim below was checked against the code or the database. Nothing here is inferred from the absence of a keyword.

---

## 0. Why this document exists

Three gaps surfaced on 2026-10-27, and the way each was found is the real finding:

| Gap | How it was found |
|---|---|
| `/account/orders/:id` returned 404 since launch | a Microsoft Clarity session recording |
| No abandoned-cart recovery | a real $2,195 cart was abandoned |
| No contact/call log | the owner asked whether two reps might call the same person |

None was found by testing, by a gate, or by review. All three were found by a customer being failed, or by chance.

**The cause is a process failure, not a code failure.** Every previous session answered the question in front of it and built that thing well — gates, mutation tests, migrations, documented reasoning. "Best practices" was applied to *the quality of what was being built* and never to *the completeness of what existed*. There have been audits — security, SEO, 404 crawl, checkout/payment lifecycle — but each was scoped to a subsystem. A security audit never asks "can the customer see where their order is."

This document is organised by **customer journey and operator job**, not by subsystem, because that is the axis along which the misses happened.

### A caution about this document's own method

While compiling it, an early keyword probe suggested the site had no sales-tax handling. That was wrong — `src/services/stripeService.js:210` sets `automatic_tax: { enabled: true }`. A keyword probe is not evidence. Every ABSENT below cites the file checked or the query run. Where something is uncertain it is marked **UNVERIFIED** rather than asserted.

---

## 1. Severity definitions

| Severity | Meaning |
|---|---|
| **S1** | Losing money or breaking trust *right now*, silently. No one is being told. |
| **S2** | A customer or operator hits a dead end and has to phone, or abandons. |
| **S3** | Measurable revenue left on the table; competitors all have it. |
| **S4** | Quality, hygiene, or future risk. Not bleeding today. |

Ranked by **cost when missing**, not by effort to fix.

---

## 2. The register

### 2.1 — Post-delivery: the silence after the sale

#### **S1 · GAP-01 — Four active email templates have no sender**
> **PARTIALLY CLOSED 2026-11-02.** `order_delivered` and `out_for_delivery`
> are wired in `shipmentStatusPoll.js`, guarded by send-once markers
> (`migrations/2026-11-02_email_send_markers.sql`), with
> `gates/gate_email_templates_have_senders.js` + its mutation harness.
> `review_request` and `cross_sell` are **still orphans** — see "What is
> still blocked" below. Re-verified before building: the register's
> finding was exactly right, 6 of 10 active templates had senders.

**Evidence.** `email_templates` contains 10 rows, all `is_active = 1`. Every `sendTemplate(...)` call site in `src/` was enumerated. Four templates are never sent by any code path:

| Template | Subject | Status |
|---|---|---|
| `out_for_delivery` | "Today is the day — your dream vanity or related item arrives today 🎉" | **orphan** |
| `order_delivered` | "Your new bathroom chapter starts now" | **orphan** |
| `review_request` | "How is the new vanity looking?" | **orphan** |
| `cross_sell` | "The mirror that was made for your vanity" | **orphan** |

Verified: `grep -rn "'out_for_delivery'" src/` returns 3 hits, **all three are explanatory comments** about the `shipments.status` ENUM (`shipmentStatusPoll.js:112`, `shippingController.js:1209`, `:1249`). None is a sender. `order_delivered`, `review_request` and `cross_sell` return zero references.

**The mechanism.** `src/jobs/shipmentStatusPoll.js` never requires Brevo at all. It polls the carrier, flips `orders.status` to `delivered` (line 263), increments a counter, and emails nobody.

**What it costs.** A customer spends $2,195, hears from you at purchase and at shipment, then nothing. No delivery confirmation on the day a freight truck arrives at their kerb. No review request — which means no Google Seller Ratings, no on-site social proof, and no UGC. No cross-sell, so no second order from a customer who just proved they buy.

**Note on how this was missed:** earlier on 2026-10-27 the `out_for_delivery` subject line was rewritten to the owner's wording and the change was gated, committed and pushed. Nobody checked whether anything sends it. Copy was polished on an email with no sender.

---

#### **S3 · GAP-02 — No product reviews anywhere**

**Evidence.** `SHOW TABLES` returns 64 tables; there is no reviews table. No controller, no route, no view. `grep -rniE "product_reviews|review_rating|customer_review"` across `src/` and `views/` returns zero.

**What it costs.** Consumer research consistently puts review-seeking at ~95% of buyers before a considered purchase, with reported conversion lift in home/furniture of roughly 10–18% where photo reviews exist. Furniture e-commerce converts at roughly 1.0–1.8% baseline; this is the lever competitors all pull. Every competitor named in this analysis (Wayfair, Build.com, Signature Hardware, Ferguson) has reviews on every product page.

**Related:** task #343 — Google Customer Reviews opt-in on the confirmation page — has been pending and is the cheapest partial path to ratings.

---

### 2.2 — Returns and problems

#### **S2 · GAP-03 — A customer cannot start a return**

**Evidence.** `order_returns` table exists. `returnsController.js` is complete — request, approve, deny, receive, resolve, with `return_approved` and `return_resolved` emails wired. Every route is under `/admin` (`src/routes/admin.js`, "Returns" group). `grep -rn "returns" src/routes/*.js` excluding admin returns only unrelated word matches. There is no customer-facing entry point.

**What it costs.** Baymard's 2026 accounts research found test participants unable to locate where to start a return from the order list or order detail, and treats those pages as the critical starting point; 52% of users report returning an online purchase in the last 12 months. For BVO the stakes are higher than average: these are freight-delivered 200–400 lb items where **transit damage is the normal failure mode**, not the exception. The customer's only route today is to telephone.

---

#### **S2 · GAP-04 — No damage/freight claim workflow**

**Evidence.** `grep -rniE "damage_claim|freight_claim"` returns 7 hits, all prose in shipping docs and policy copy; no table, no handler. `order_returns` has no damage-specific path, no photo upload, no carrier claim reference.

**What it costs.** LTL freight damage requires photographic evidence at delivery and a claim filed against the carrier within a window. With no structured capture, evidence arrives as phone calls and forwarded phone photos, and claim windows are missed. This is money, not just experience.

---

### 2.3 — Order visibility

#### **S2 · GAP-05 — Guests cannot track an order**

**Evidence.** Order tracking lives at `/account/orders/:id` and `/account/orders/:id/tracking` (`src/routes/account.js:43,47`), behind `loadCustomer`. There is no order-lookup route: `grep -rniE "order_lookup|track_order|find_my_order"` across `src/` returns nothing. `/orders/confirm` exists but is a post-order email-verification flow, not tracking.

**What it costs.** Baymard's 2026 trends report puts order status/delivery tracking as the single most important account feature (51% of respondents). A guest who checks out without an account currently has no way to see where a $2,000 freight shipment is, short of phoning. Note the account system is passwordless (email code), so the fix is cheap — an order-number + email lookup issuing the same view.

---

### 2.4 — Retention and demand capture

#### **S3 · GAP-06 — No back-in-stock capture**

**Evidence.** `inventory` table exists and `ervInventorySync.js` keeps it current. No `stock_notifications` table; `grep -rniE "back_in_stock|notify_me|stock_watch"` in `src/` and `views/` returns zero. (A `git_push_stock_watch.sh` and `rollback_stock_watch.sh` exist in the repo root — **UNVERIFIED** whether a feature was built and rolled back; worth checking git history.)

**What it costs.** Every out-of-stock product page view is demand that is measurable and currently discarded. In a catalogue driven by a vendor feed with discontinued SKUs (tasks #345–347), this is a recurring loss.

---

#### **S3 · GAP-07 — No promotion/coupon mechanism**

**Evidence.** No coupons or discounts table in `SHOW TABLES`. `grep -rniE "coupon|promo_code|discount_code"` returns 1 incidental hit. `orders.discount` exists as a column, and the Platinum Member 10% is implemented in `offerClaim.js` as a hardcoded member benefit — not a general promotion engine.

**What it costs.** No way to run a seasonal sale code, a recovery-specific incentive, an influencer code, or a trade discount without writing code. It also caps what cart recovery can offer: the recovery email can only ever promise the one Platinum offer.

---

#### **S4 · GAP-08 — No gift cards or store credit**

**Evidence.** No table; zero code references. **Also the cleanest way to settle a damage claim without a refund** — currently every goodwill gesture must be a card refund.

---

### 2.5 — Operator tooling

#### **S2 · GAP-09 — One shared admin login, so no real attribution**

**Evidence.** `src/controllers/adminController.js:191` — `const validUser = process.env.ADMIN_USER;`. A single credential pair in env. Line 226 states it outright: *"exactly one admin account (ADMIN_USER)"*. No roles, no permissions middleware (`grep` in `src/middleware/` returns nothing).

**What it costs.** Every audit trail — `order_events.actor`, `customer_messages.actor`, `order_deletions.actor` — records `'admin'` for everyone. The contact log built today will say "by admin" no matter who called. The moment a second person touches the system, "who did this" is unanswerable, and that includes who deleted an order or who refunded a card.

*Note: when asked earlier today whether to capture named reps, the answer was in the code. I asked instead of checking.*

---

#### **S4 · GAP-10 — No exchange workflow**

**Evidence.** `returnsController.js` resolution types are `full_refund` and partial variants (line 217). `grep -i exchange src/controllers/returnsController.js` returns nothing. A wrong-finish vanity must be refunded and re-ordered as two transactions, losing the revenue and the margin.

---

### 2.6 — Things probed and found PRESENT (so the register stays honest)

| Capability | Evidence |
|---|---|
| Sales tax | `stripeService.js:210` `automatic_tax: { enabled: true }` — handled by Stripe Checkout Sessions |
| Refunds, incl. partial | `stripeService.js:686`; `returnsController.js:217` |
| Fraud/risk screening | Stripe EFW + dispute webhooks, risk columns on `orders` |
| Address validation + geocode | `addressValidationService.js`, `geocodeService.js`, Google Places on checkout |
| Structured data (JSON-LD) | present in product views |
| GA4 + Microsoft Clarity | `views/layouts/main.ejs:394,445` |
| First-party event spine | `site_events` table + `siteEvents.js` |
| Accessibility basics | 241 aria/role hits across views (depth **UNVERIFIED** — no audit run) |
| Wishlist | `favorites` table + routes |
| Abandoned cart recovery | built 2026-10-27, live and verified |
| Contact/call log | built 2026-10-27, live and verified |
| Carrier tracking poll | `shipmentStatusPoll.js`, cron |
| Vendor POs | `vendor_purchase_orders` table |

---

## 3. Ranked — what to do, in order

| # | Gap | Sev | Why this order |
|---|---|---|---|
| 1 | GAP-01 wire the 4 orphan emails | S1 | Templates already written and approved. Highest value per hour of work in the whole list. |
| 2 | GAP-05 guest order tracking | S2 | #1 account feature per Baymard; passwordless auth makes it cheap. |
| 3 | GAP-03 customer-initiated returns | S2 | Controller already exists; needs a customer-facing route + view. |
| 4 | GAP-04 damage claim capture | S2 | Carrier claim windows are being missed today. Pairs with #3. |
| 5 | GAP-02 product reviews | S3 | Biggest conversion lever, but the largest build. Start with #343 Google Customer Reviews for ratings while the on-site system is built. |
| 6 | GAP-09 named admin users | S2 | Do before a second person is hired, not after. |
| 7 | GAP-07 promotions engine | S3 | Unlocks better recovery offers and seasonal campaigns. |
| 8 | GAP-06 back-in-stock | S3 | Check git history first — may be partially built. |
| 9 | GAP-10 exchanges | S4 | Margin recovery. |
| 10 | GAP-08 gift cards / credit | S4 | Also the clean damage-claim settlement path. |

---

## 4. How to stop finding these by accident

1. **This document is the checklist.** Re-run it quarterly, against the code, not from memory.
2. **A feature is not done when it is built; it is done when it has been used end to end by a human.** Today's cart-recovery email was gated, mutation-tested and green — and still opened with a sentence that was false ("a couple of days ago" sent to a cart minutes old). It took sending one and reading it.
3. **A template with no sender is a class of bug no gate catches.** Add a gate asserting that every `is_active` row in `email_templates` has a `sendTemplate` call in `src/` — that single check would have caught GAP-01.
4. **Never assert an absence from a keyword probe.** The sales-tax false positive in this document's own drafting is the example.

---

## 4a. GAP-01 — what is still blocked (2026-11-02)

Two of the four were wired. The other two are **not blocked on effort**:

| Template | Blocker |
|---|---|
| `review_request` | Needs `{{google_review_url}}`. The only value anywhere in the codebase is `https://g.page/r/YOUR_PLACE_ID/review` in `emailTemplatesController.js:36` — admin **preview sample data**, a literal placeholder. `substituteVars` renders an unknown variable as an empty string, so wiring it today sends either a dead link or a button to nowhere. **Needs the real URL from the Google Business Profile.** |
| `cross_sell` | Needs `{{cross_sell_url}}`. `PREVIEW_VARS` uses `/collections/mirrors`, which at least exists. The better email links each customer to *their* vanity's matching mirror — the "Complete the Look" logic already on the product page. Owner's choice. |

**Both are marketing, not transactional, and that changes how they must be
built.** `cartRecovery.js` runs every recipient through `emailEligibility()`
— `email_blocked`, `accepts_marketing`, and `marketing_consent_at` to tell
"declined" from "never asked" — and attaches an unsubscribe token.
`brevoService.sendTemplate` enforces none of that; the caller does. The
original plan for this work did not mention consent at all, and had it been
built as written, `cross_sell` would have emailed people who explicitly
ticked "no marketing". When these two are wired they must reuse
`emailEligibility`, not a second copy of the rule.

`order_delivered` and `out_for_delivery` are genuinely transactional — they
tell a buyer where the thing they paid for is — so they deliberately have
no consent gate. They do exclude `is_test = 1` rows, the same way
`cartRecovery.js:192` does.

### Two findings worth keeping

**The obvious place for the OFD send would never have fired once.**
`mapCarrierStatus` folds "Out For Delivery" into `in_transit` because the
shipments ENUM has no such value, so for a shipment already in transit
`next === s.status` and the loop's early `continue` fires. The send had to
go *above* that check, keyed on the raw carrier string. It would have
looked correct in review and sent nothing — the GAP-01 failure mode exactly.

**The gate caught its own author.** First run, it reported the two
just-wired templates as having no sender: it knew only bare
`sendTemplate('key')` calls, and these route through a `sendOnce()` wrapper.
Fixed by recognising wrappers by name *and* asserting the wrapper really
reaches `brevo.sendTemplate`, so it cannot become a no-op while the gate
stays green.

---

## 5. Open questions requiring the owner

- **GAP-06: RESOLVED 2026-11-02.** Stock-watch was never rolled back, and
  it is not back-in-stock. Commit `c270a95` (20 Oct) is an admin
  orders-dashboard strip flagging SKUs that need the SOP §2 vendor call;
  it is still an ancestor of HEAD. There is zero customer-facing notify-me
  code in `src/` or `views/`. **GAP-06 stands as a real gap.**
- **GAP-01:** the real Google review URL, and the cross-sell destination
  (see §4a).
- **Stripe Tax registrations:** code is correct; are the state registrations configured in the Stripe dashboard?
- **Accessibility:** no WCAG audit has ever been run. ADA exposure for US e-commerce is real and not covered by aria attributes alone.
- **`review_request` subject** still reads "How is the new vanity looking?" — category-wrong for faucet orders, and currently moot since nothing sends it.
