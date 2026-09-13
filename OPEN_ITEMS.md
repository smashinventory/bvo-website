# BVO — Open Items

Things noticed but deliberately **not** acted on. Each one is parked with enough
context to pick up cold, so a later session doesn't have to rediscover it.

**Rules for this file**

- An item lands here instead of being bundled into unrelated work.
- Nothing here is approved. Nothing here gets built without Sam saying so.
- Delete an item when it ships or when it's decided against — record which.

---

## Open

### 1. Rule 2 ceiling has only 0.5" of headroom
*Logged 2026-09-12 · from the Kinnsden → Lucian correction*

`PAIRING_OK` now derives the RC collections from cabinet depth `21" ≤ d < 22"`
instead of a hardcoded list. The floor has 1.37" of clearance (nearest non-RC
cabinet 19.63"); the **ceiling has 0.5"** — the nearest standard cabinet is
22.5".

If JM ships a cabinet around 21.75" it lands in the band and is offered Radius
Cut tops it cannot take. Nothing would fail loudly.

**Possible responses, none chosen:** widen the gap by keying on the `060` token
from `product_components` instead of depth; add a boot-time assertion that the
band returns exactly the collections that have `060` combos, and warn when it
doesn't; or leave it and re-check whenever JM adds a collection.

---

### 2. §2 of the combo demand definition could use the exact combo→top edge
*Logged 2026-09-12 · raised and parked during the Lucian correction*

§2 resolves combo → top on `top_finish + top_material + size_nominal + sinks`,
which covers **4,085 of 4,199 (97%)** and collides on 41 of 127 keys — which is
why Rules 2 and 4 exist at all. `product_components` carries the exact edge and
resolves **4,198 of 4,198**.

If it replaced §2, Rules 2 and 4 and the RC family fold in §3 would all become
unnecessary — they exist only to disambiguate a key the real edge doesn't have.

**Why it's parked:** it amends an artifact of record that is signed off, and
buys 3% of coverage on a figure the document itself insists is labelled
"modelled". Reopening it costs re-verification and re-approval.

---

### 3. `demand_score` still ranks combos on clamped drawdown
*Logged 2026-09-12 · this is §8 of the combo demand definition, already approved*

`products.demand_score` is raw `SUM(demand_min)` per SKU with no product-type
distinction, so storefront popularity sorts combos on `min(base, top)` —
**28,215 units against Cabinet's 865**. §8 authorises repointing it at the
estimator for the 4,212 vanity products.

Not parked on merit — it's simply the next task. **Open question before it can
start:** the estimator is a large CTE inside `jmvReportsController.js` and the
rollup needs identical numbers. Extract to a shared module, or duplicate?

Note the ordering risk: repointing `demand_score` is what puts `PAIRING_OK`
into the customer-facing sort for the first time. Settle the pairing rules
before, not during.

---

### 4. Two `ORDER BY` clauses lack a unique final key
*Logged 2026-09-12 · §6 of the combo demand definition requires one*

```
homeController:124   … p.demand_score DESC, p.created_at DESC     ← not unique
homeController:375   … SUM(p.demand_score) DESC, COUNT(*) DESC    ← not unique
collectionsController:400 … SUM(p.demand_score) DESC, p.brand, p.model   ← OK
```

§6: *"every sort on this score carries a deterministic secondary key —
`ORDER BY score DESC, sku ASC`."* Without it, equal-scored listings can swap
between queries, and paginated collection pages can duplicate or skip a row.

Small fix, currently cosmetic — becomes customer-visible the moment item 3
lands and the scores start tying meaningfully.

---

### 5. Site audit — outstanding items
*Logged 2026-09-12 · full detail in `AUDIT_2026-09-11.md`*

Ranked by what they're worth:

- **Image weight.** Collection pages ship 3.41 MB of imagery for twelve cards;
  one image is 3,455 KB into a 152×210 card. Fix is tested: inserting
  `w_400,f_auto,q_auto` **after** the Salsify signature gives 29 KB. Before the
  signature returns 404.
- **`/pages/about` 404** — linked from the homepage. Fix in the Theme Editor,
  two places. **Not** via SQL: `initFromDb()` pushes the JSON file to the DB on
  every boot, so a direct `UPDATE` reverts at the next restart.
- **No `<h1>`** on the homepage or any CMS page.
- **Sitemap `lastmod`** is `today` for all 5,311 URLs.
- **Tap targets** — size chips 20×22px, swatches 18×18px, badges at 9px.
- **CSP stripped at Hostinger's edge** — the app builds a nonce policy, the
  browser receives `upgrade-insecure-requests` only. Support ticket, not code.
- **`SITE_URL`** must be set explicitly (with `www`) before cutover.

---

### 6. Checkout and payment have never been audited
*Logged 2026-09-12*

Card handling, the Clover integration, FraudLabs and order creation were
deliberately left untouched — probing a live payment flow isn't something to do
without an explicit decision. It is the highest-risk area of the application and
it currently has no coverage. Needs its own scoped piece of work.

---

## Resolved

*(none yet — move items here with the date and the outcome)*
