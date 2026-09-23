# BVO — Open Items

> Outstanding work, numbered. Check here before starting anything — it may already be logged.

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
- ~~**`/pages/about` 404**~~ — **done 2026-09-13**, Sam corrected the CTA URLs in
  the Theme Editor. The short-vs-long slug trap is still live for any new URL:
  migration 012 seeded the LONG forms (`about-us`, `contact-us`,
  `privacy-policy`, `shipping-policy`, `returns-policy`,
  `terms-and-conditions`).
- ~~**No `<h1>`**~~ — **the finding was wrong**, closed 2026-09-13. The audit
  grepped templates for the literal `<h1`, which `index.ejs` never contains
  because the tag is interpolated via `_safeTag(hero.heading_level,'h1')`. The
  homepage had **two**, not zero: `hero` and `hero_mobile` were separate
  `<section>`s each carrying the heading, with CSS hiding one. `cms-page.ejs`
  had exactly one all along, and `page.ejs` — which the audit named — does not
  exist. Fixed to a single hero, commit `7fdbfe8`.
- ~~**Sitemap `lastmod`**~~ — **done 2026-09-13**, commit `3333a56`. The stated
  cause was wrong: only 4 hardcoded lines used `today`, which cannot produce
  5,139. The real cause was `importJamesMartinFeed.js` setting
  `updated_at = CURRENT_TIMESTAMP` explicitly, overriding the column's own
  `ON UPDATE` and bumping every product daily.
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

### 6. ⚠️ CUTOVER BLOCKER — hotlinked images
*Logged 2026-09-13 · **re-measured 2026-09-23** · full detail in `docs/briefs/HOTLINKED_IMAGES_HANDOFF.md`*

> **STATUS 2026-09-23 — the original 14 are largely closed, and the problem
> has recurred.** Category cards, hero and supporting imagery are now on the
> Bunny pull zone `images.bathroomvanitiesoutlet.com`. All eight gstatic cache
> keys are gone, as are lampsplus and bathvanityexperts.
>
> Measured on the live homepage DOM — four hosts still not ours:
>
> | host | what | on the original list? |
> |---|---|---|
> | `jamesmartinvanities.com` | Brittany model tile | yes, never closed |
> | `ak1.ostkcdn.com` | Overstock product shot | **no — new** |
> | `bathgems.com` | Allamari vanity | **no — new** |
> | `usbathstore.com` | Breckenridge vanity | **no — new** |
>
> Three appeared *while the list was being worked through*. That is the
> argument for the control raised at the bottom of this item and never
> approved — an admin warning when an image URL points outside our own hosts,
> at the point of entry. Four fixed, three new, one never closed, in ten days.
>
> Separately and larger: every Huntington Brass faucet hotlinks
> `huntingtonbrass.com` by design (`importHuntingtonBrass.js:32`, marked
> "temporary"). Not counted above — HB products do not appear on the homepage.
>
> **The detail below is the 2026-09-13 snapshot, kept for reference.**


Fourteen images on the site are served from hosts we do not control. **All of
them are hand-entered curation. The product catalogue itself is clean** — 56,811
`product_images` rows come from `images.salsify.com`, which ships with the JM
feed, and 341 from your own Cloudinary account. Nothing below is feed data, so
nothing below gets repaired by a re-import.

**Replace all fourteen before the domain moves.** Every one is editable through
the admin UI. No code, no migration.

**Category cards — 10** · `/admin/categories` → edit → image field

| Category | Slug | Host |
|---|---|---|
| Bathroom Vanities- All Products | `bathroom-vanities` | gstatic |
| Bathroom Vanities With Tops | `bathroom-vanities-with-tops` | gstatic |
| Bathroom Vanity Cabinets - Cabinet Only | `bathroom-vanity-cabinets` | gstatic |
| Bathroom Vanity Tops - Top Only | `bathroom-vanity-tops` | gstatic |
| Bathroom Mirrors | `bathroom-mirrors` | gstatic |
| Faucets | `faucets` | gstatic |
| Storage | `storage` | gstatic |
| Vanity Models | `vanity-models` | gstatic |
| Lighting | `lighting` | image.lampsplus.com |
| Samples | `samples` | www.bathvanityexperts.com |

**Model tile — 1** · `/admin/models` · Brittany / James Martin Vanities ·
`jamesmartinvanities.com/cdn/shop/...`

**Product — 1** · `/admin/products` · Huntington Brass Sevaun Widespread
(`huntington-brass-sevaun-widespread`) · `plumbtile.com/cdn/shop/...`

**Hero — 2** · Theme Editor · `hero.mobile_image_url` and
`hero_mobile.image_url`, both gstatic. These live in `theme_settings.json`, not
a table, so the SQL below will not show them.

**Two different problems, same list.**

The eight `encrypted-tbn0.gstatic.com` URLs are Google Images *cache keys*, not
addresses. They rotate and expire on Google's schedule. When they go you get
blank images on the homepage's main category row with nothing in a log to
explain it.

The other four are someone else's product photography served from their
bandwidth — `lampsplus.com`, `bathvanityexperts.com`, `plumbtile.com`,
`jamesmartinvanities.com`. That is a different kind of exposure on a commercial
storefront, and independently they can rename a file or block hotlinking at any
time.

**Practical shortcut:** you already own 56,811 Salsify images. Eight of the ten
categories can take a product shot from inside that category — nothing to
source, no licensing question, and a better-matched image than a Google
thumbnail. Samples and Lighting have thin inventory to draw from.

**Re-run before cutover to confirm the list is empty** (excludes the two hero
images — check those in the Theme Editor by eye):

```sql
SELECT 'category' AS what, name AS label, slug AS ref, image_url AS url
  FROM categories
 WHERE image_url LIKE 'http%'
   AND image_url NOT LIKE '%salsify.com%'
   AND image_url NOT LIKE '%res.cloudinary.com%'
UNION ALL
SELECT 'model', model_name, brand, custom_image
  FROM model_groups
 WHERE custom_image LIKE 'http%'
   AND custom_image NOT LIKE '%salsify.com%'
   AND custom_image NOT LIKE '%res.cloudinary.com%'
UNION ALL
SELECT 'model-og', model_name, brand, og_image
  FROM model_groups
 WHERE og_image LIKE 'http%'
   AND og_image NOT LIKE '%salsify.com%'
   AND og_image NOT LIKE '%res.cloudinary.com%'
UNION ALL
SELECT 'product', name, slug, primary_image_url
  FROM products
 WHERE primary_image_url LIKE 'http%'
   AND primary_image_url NOT LIKE '%salsify.com%'
   AND primary_image_url NOT LIKE '%res.cloudinary.com%';
```

`model_groups.og_image` returned nothing on 2026-09-13 — kept in the query
because it is a second image column on that table and would otherwise be a
blind spot.

**Not chosen, raised once:** nothing prevents this recurring. A warning in the
admin when an image URL points outside your own hosts would stop the next one
at entry rather than at cutover. Separate task, not approved.

### 7. `Finish/Color of Product` has two homes
*Logged 2026-09-16 · Rule 8 violation, deliberately not bundled into the colour work*

`importJamesMartinFeed.js` writes that feed column to EAV `finish` via
`ATTR_MAP` (line ~623) **and**, since `3a302ab`, to `products.color` as the
fallback source for the colour family. Two homes for one fact.

Rule 10 names `products.color` as canonical and lists EAV as a prohibited
alternative. But `docs/briefs/james-martin-feed-analysis.md` §1D says that
column maps to EAV `finish` with `filter_type: color_swatch`. **Both documents
are in writing and they disagree** — which under CLAUDE.md §4 is a question for
Sam, not a judgement call.

Nothing is broken today: the colour filter reads the column, and the EAV row is
simply unread. The cost is a reader having to work out which one is live.

**Not chosen:** removing `'Finish/Color of Product'` from `ATTR_MAP`. One line,
but it needs the document conflict settled first and a check that no view reads
`attr_key = 'finish'`.

---

### 8. 57 vanity products still carry the pre-fix Ash/Shagreen families
*Logged 2026-09-16*

`Sunwashed Oak` (41) and `Sunwashed Oak with Embossed Shagreen Drawer Fronts`
(16) sit in `gray` and `green` in the database. The code that produced those
values is fixed — `Ash` moved to `wood_l` and the substring fallback now
requires a word boundary — but only the **mirrors** were backfilled by SQL.

They correct themselves on the next full JM import. If that is not soon enough,
`scripts/gen_mirror_colour_sql.js` takes a category argument's worth of change
to emit the same shape for vanities.

Visible symptom until then: a Sunwashed Oak vanity appears under the Gray
swatch and not under Light Wood.

---

### 9. `loadColorMappings()` ignores the context column
*Logged 2026-09-16*

`color_mappings` has `PRIMARY KEY (vendor_color, context)`, so one colour can
legitimately hold both a `cabinet` row and a `metal` row.
`loadColorMappings()` selects only `vendor_color, family_key` and keys its Map
on the colour alone — so when both exist, whichever MySQL returns last silently
wins.

Same arbitrariness as the `MIN(color_family)` tie-break that was rejected on
2026-09-16, already sitting in the code. It only bites if a colour is mapped in
both contexts; nothing does today.

**Fix if wanted:** select `context` too and key the Map on
`vendor_color + '|' + context`, with the caller passing the context it wants.

---

### 10. A dry-run import silently skips admin colour mappings
*Logged 2026-09-16*

`importFromWorkbook(wb, { dry: true })` does
`const colorMappings = dry ? new Map() : await loadColorMappings(conn)`.

So a dry run reports colours resolved **without** any Color Report overrides —
the one thing a dry run is meant to preview. Anyone checking a mapping by
dry-running the import gets a confidently wrong answer.

Loading the map is a single read and harmless in a dry run.

---

### 11. The `site-bundle.css` rebuild recipe does not reproduce the file
*Logged 2026-09-23 · measured, not fixed*

`views/layouts/main.ejs` documents how to rebuild the public stylesheet:

```
cat brand.css site.css site2.css > site-bundle.css
head -c N site4.css >> site-bundle.css
```

**It does not produce the file that is on disk.** Measured 2026-09-23:

| | |
|---|---|
| `site-bundle.css` | 127,404 bytes |
| `site4.css` head embedded in it | 7,984 bytes, starting at offset 114,503 |
| bytes following that, unexplained | **4,917** |

Run the recipe as written and those 4,917 bytes are lost from every public
page. Nobody knows what they are — they are not accounted for by any of the
four named source files.

This predates the 2026-09-23 alignment change (it was 8,043 / 4,917 before;
that commit removed 59 bytes from inside the embedded prefix). The stale
byte count in `main.ejs` has been replaced with these measured figures and
a warning not to run the recipe.

**Consequence today:** the two sheets must be patched by hand, in lockstep,
with the identical edit — which is what `git_push_hero_align_consolidate.sh`
did, and what its G4 gate enforces. That works but it is a manual invariant
with no build step behind it.

**Needs a decision, not a guess:** identify the 4,917-byte tail, then either
correct the recipe or replace it with a real build script. Whoever last
built the bundle knows what went in after the `site4.css` slice; the file
history may not.

---

## Resolved

### Mobile hero alignment had two settings and neither worked
*Logged and resolved 2026-09-23 · commit `cb8c24c`*

Two Theme Editor controls governed one fact, and the pair produced a visible
split. Measured on the live page at 375px before the fix:

```
.hero-content   text-align:      left
.hero-ctas      justify-content: center
```

Copy left, buttons centred, on every phone. Each control was half-broken:

- **`hero.text_align_mobile`** wrote `--hero-mobile-align` onto `.hero`, read
  by `.hero{text-align:…!important}` at ≤860. `.hero-ctas` is flex, and
  `text-align` does not move flex items — so it could never move the buttons.
- **`hero_mobile.text_align`** wrote `#hero-main .hero-content{text-align:…}`
  at ≤480 with no `!important`. `.hero-content` carries an **inline**
  `style="text-align:left"` from the desktop value, and inline beats any
  stylesheet rule that is not `!important` — so its text rule never applied.
  Its sibling CTA rule *did* apply, because `.hero-ctas` has no inline style.
  That asymmetry is the whole bug.

Kept `hero_mobile.text_align`: it moves the CTA row as well as the copy, its
control is the three-button `teAlignment()` group rather than a bare select,
and it sits in the Mobile Hero panel with the other mobile settings. Carried
over the only advantages the retired one had — the band is now ≤860 rather
than ≤480, and the rule sits outside the `_hmEna` gate so it still applies
with the mobile hero disabled.

Verified live at four widths after deploy; headline, `.hero-rule` divider and
CTA row share a centre to the pixel at 375/500/800, and desktop at 1280 is
unchanged.

`.hero-rule` needed no code: already `display:inline-block` inside
`.hero-content`, already `var(--hero-eyebrow, var(--color-sage,#5a7a5a))`, so
it follows both the alignment and the colour setting for free.

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
