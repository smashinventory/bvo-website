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

### 3. Site audit — outstanding items
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

### 4. Rate limiter — retune AT CUTOVER, not before
*Logged 2026-09-12 · deliberate pre-launch posture, do not "fix" early*

Currently `windowMs 15 min, max 1000`, with `/css`, `/js`, `/images`,
`/docs/uploads`, `favicon.ico` and `/robots.txt` exempt (commit `2ea972c`).
The tight setting was chosen deliberately out of caution while the site is
not live. **Leave it alone until www.BathroomVanitiesOutlet.com moves off
Shopify to the Hostinger instance.**

At cutover, the reasoning to apply:

**This is a scraping control, not DDoS protection.** A request reaching
`express-rate-limit` has already cost a TCP connection, a TLS handshake and
event-loop time. Volumetric defence belongs at the edge. Against scraping the
number buys little either way — 5,311 URLs takes 6.6 hours at 200/15min and
80 minutes at 1,000, and anyone serious rotates IPs past both.

**The lockout shape matters more than the ceiling.** The penalty is the
remainder of the window, measured at `Retry-After: 641` — eleven minutes on
every route including the homepage. Sustained 429s are read by Google as a
failing server and crawl rate drops, which is the real risk to a site whose
rankings are being migrated.

Suggested at cutover:

```
windowMs  5 min,  max 150     same order of protection, 5-min worst case
```

Plus **exempt `/sitemap.xml`** — currently counted, and a 429 there breaks
URL discovery for the whole site. One cheap file.

Optional, only if Search Console shows crawl errors after launch: bypass
*verified* Googlebot via reverse DNS, which cannot be spoofed the way a
user-agent can. Real work; not worth it speculatively.

**Do not touch the auth limiters** — customer 10/15min, admin login 5/15min.
Those guard credentials and are the ones doing real security work.

---

### 5. Checkout and payment have never been audited
*Logged 2026-09-12*

Card handling, the Clover integration, FraudLabs and order creation were
deliberately left untouched — probing a live payment flow isn't something to do
without an explicit decision. It is the highest-risk area of the application and
it currently has no coverage. Needs its own scoped piece of work.

---

## Resolved

### Footer rendered every link twice
*Found and fixed 2026-09-13 · migration 027*

All three footer columns showed each link doubled — Bathroom Vanities,
Bathroom Vanities, Mirrors, Mirrors. Spotted by Sam looking at a live
collections page.

**Cause.** Migration 015 seeds the footer items with `INSERT IGNORE`, which
only suppresses a UNIQUE KEY violation. `nav_menu_items` had no unique key —
`PRIMARY KEY (id)` and a non-unique `idx_menu_items_sort` — so there was
nothing to violate and the insert ran unconditionally. 015 ran twice, ids
15-24 then 25-34. `nav_menus` escaped because it has `UNIQUE KEY handle`;
the difference between the two tables is the entire bug.

**Fix.** Deleted the copies keeping the lowest id per (menu_id, label, url),
then added `UNIQUE KEY uniq_menu_item`. The order is the verification: with
the constraint added second, a failed dedupe errors with #1062 rather than
succeeding on bad data. 015 is now genuinely idempotent.

`main-menu` was checked in the same pass and is clean.

**Why the audit missed it.** `AUDIT_2026-09-11.md` collected links into a
`Set` before status-checking them, so two identical links collapsed to one
entry and the report said "one broken link in 192" — true, and blind to
duplication by construction. The 375px pass measured tap targets, font sizes
and overflow, all numeric properties, and never compared content for
repetition.

**The gap to close in any future audit:** check the page for sense, not only
for validity. Duplicate links, repeated blocks and wrong-but-working content
are invisible to a crawler that deduplicates and to a DOM pass that only
measures. Look at the rendered page.

**Fourth instance of the same anti-pattern** — a guard that cannot fail is
not a guard. Migration 021, the information_schema verify in 023, a gate
written on 2026-09-12, and now `INSERT IGNORE` without a unique key.

### §8 — `demand_score` now carries Estimated Combo Demand
*Logged and resolved 2026-09-12 · commit `a16d40b` + migration 026*

Storefront popularity ranked 4,212 vanities on `min(base, top)` clamp
artifacts. Verified on production after the rollup ran:

| | before | after |
|---|---|---|
| combos scored | 3,552 | 3,560 |
| min score | 1.00 | **0.01** |
| max score | 125.00 | **11.01** |
| vanity total | 33,288.00 | **1,156.64** |
| vanity : cabinet | 38 : 1 | **0.95 : 1** |

`min 0.01` proves the DECIMAL migration took — those are the 92% that would
have truncated to zero on the old int column. `max 11.01` is the Marcello 36
Chestnut figure the admin report shows, so the storefront and the leaderboard
are reading the same number, which is what extracting the estimator bought.
The 62-unit shortfall against Cabinet is bases whose demand never reached a
combo — expected residual, not a leak.

Three parts shipped: `src/services/comboDemandEstimator.js` (extracted
byte-identically, proven against `test/fixtures/`), the controller importing
it, and the rollup zeroing vanities before applying estimates.

**Two things learned the hard way, recorded so they are not relearned:**

- The rollup is **not** called from `server.js` startup. Restarting does
  nothing; node-cron fires it at 05:30 UTC, and `jmv_rollup.sh` is the
  duplicate belt-and-braces path.
- The app DB user has **no grant on `information_schema`** — `#1044`. Use
  `SHOW COLUMNS` / `SHOW INDEX`. phpMyAdmin reports the denial against the
  *next* statement, which makes an `ALTER` look refused when the verify
  `SELECT` above it was the failure. Second time this database has punished
  `information_schema`; migration 023 hit a different version of it.

### Two `ORDER BY` clauses lacked a unique final key — §6
*Logged and resolved 2026-09-12 · commit `10a48f7`*

`homeController:124` ended in `p.created_at DESC` and `:375` in `COUNT(*) DESC`
— neither unique, so equal-scored rows could come back in any order and
paginated pages duplicate or skip. Added `p.sku ASC` and `p.model, p.brand`
respectively. `collectionsController:400` already complied.

Exact ties are the expected output here, not an edge case: combos differing
only by faucet drilling score identically on purpose.

### Rule 2 named the wrong collection, and named one at all
*Logged and resolved 2026-09-12 · commits `36a9edd`, `88725dc`*

§4 Rule 2 read `IN ('Gracyn','Kinnsden','Allamari')`. Kinnsden's cabinets are
23.13" and it has never used a Radius Cut top; the RC collection is **Lucian**.
The error pruned Lucian's 53 RC combos out of the estimator.

Replaced the list with the rule behind it — cabinets at `21" ≤ depth < 22"` —
which returns the same three and picks up a fourth automatically. Remaining
risk is logged as open item 1.

### Warranty haircut — checked, no change needed
*Checked 2026-09-12 · no commit*

§3a's 50% per-size backout is **share-neutral by construction**: every top in a
base's offer set is the same size and takes the same factor, which cancels out
of the share calculation. Measured largest per-combo difference with vs without:
**0.0000000000**. It does its work on revenue and reported top units
(2,714 → 1,773 units, −21.6% MAP revenue), not on combo ranking. Nothing to fix.

### Brittany ranking anomaly — not a bug
*Checked 2026-09-12 · no commit*

Brittany leads Collection Demand but its best SKU sits at #11, while low-demand
De Soto places at #2. Cause is the denominator: Brittany spreads 155 units
across **53 cabinet SKUs** (3.3 each); Marcello concentrates 44 units into
**3** (14.7 each). The collection chart and the SKU table answer different
questions, and a collection with deep finish choice is structurally penalised
in the second. Both figures are correct.

*(Flagged, not actioned: the two panels sit adjacent and invite the comparison.
A variant-count or per-SKU column on the SKU table would make it
self-explanatory.)*
