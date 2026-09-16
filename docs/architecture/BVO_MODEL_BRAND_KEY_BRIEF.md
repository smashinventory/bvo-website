# BRIEF — Model-group / model-card architecture on BVO

> Model-group and model-card architecture; why a model card is keyed on (model, brand) and never model alone.

**Context for the BathroomVanitiesOutlet.com website chat**

- **Date:** 2026-09-05
- **Repo:** `smashinventory/bvo-website`
- **Live HEAD at time of writing:** `ec2d4af`
- **Scope:** why the ER Vanities Bristol card served James Martin photography, what was fixed, what was not, and which surrounding decisions are deliberate and must not be "tidied up"

---

## 1. Why this brief exists

On 2026-09-05 we loaded 78 ER Vanities SKUs into BVO. That load did not create any bug. What it did was **remove an assumption the front end had been quietly relying on since it was written: that a model name is globally unique.**

It no longer is. **ER Vanities and James Martin Vanities both sell a model called "Bristol."**

Every place in the codebase that keys a per-model lookup on the model name alone is now wrong. One instance is fixed and live. Several are not. This brief documents all of them, plus the design decisions around them that look like omissions but are deliberate — so that fixing the real bugs does not knock out something that is standing a certain way on purpose.

---

## 2. The bug class, precisely

The model-group queries correctly do `GROUP BY p.model, p.brand`. Two brands sharing a model name therefore produce **two separate cards**, which is right.

But the maps that feed those cards were built as `map[row.model]`. With two brands in the result set, one of two things happens depending on whether the map assigns or pushes:

- **Assign** (`map[m] = x`) → last writer wins. Rows sort `ORDER BY p.brand`, so `James Martin Vanities` overwrote `ER Vanities`.
- **Push** (`map[m].push(x)`) → the two brands **concatenate**. This is worse and less obvious: the card shows a merged list of both brands' finishes, and clicking one loads the wrong brand's photography.

**The symptom that surfaced it:** the ER Vanities Bristol card on `/collections/vanity-models` served `images.salsify.com` — James Martin's CDN — along with James Martin's swatches and prices.

**The rule to carry forward:** on this site, the identity of a model card is `(model, brand)`, never `model`. In the fixed code that key is:

```js
const mk = r => `${r.model}||${r.brand}`;
```

---

## 3. What is already fixed and live — do not redo it

**Commit `ec2d4af`** — `src/controllers/collectionsController.js`, model-group block only.

Three parts, all three required (any one alone still collides):

1. `mk()` is now the only key for five maps: `mgColorSizeMap`, `mgSizeImageMap`, `mgSwatchMap`, `mgColorSizePriceMap`, `mgSizePriceMap`.
2. The colour × size query (`mgCsRows`) now `SELECT`s and `GROUP BY`s `p.brand`. **Without the column, `mk()` reads `undefined` on every row, the key degrades to `Bristol||undefined`, and the collision returns silently.** This is the trap to watch for in every remaining fix.
3. `mgCsWhere` is brand-scoped.

### Critical detail on part 3 — read before touching it

The brand list comes from `mgModelRows` (the result set), **not** from `mgActiveBrands` (the `?brand=` query param). The param is empty on the unfiltered page, and the unfiltered page is exactly where two same-named models appear together. Scoping on the param would have fixed `?brand=ER+Vanities` and left the default view broken. If you refactor this, keep the derivation from the result set.

### Verified live after deploy

| Check | Result |
|---|---|
| `/collections/vanity-models` | ER Bristol hero now `res.cloudinary.com` |
| `?brand=ER+Vanities` | 5 cards, hero + every swatch image Cloudinary |
| `?brand=James+Martin+Vanities` | 40 models, JM Bristol intact with its own 3 swatches, zero Cloudinary leakage |

ER finishes confirmed correct per model:

| Model | Swatches | Finishes |
|---|---|---|
| Bristol | 1 | Natural White Ash |
| Kensington | 4 | Bright White, Desert Oak, Metal Gray, Navy Blue |
| London | 2 | Bright White, Desert Oak |
| Oxford | 3 | Black, Sage Green, Whitewashed Ash |
| Windsor | 2 | Bright White, Navy Blue |

---

## 4. Still broken — full inventory with line numbers

Line numbers are against HEAD `ec2d4af`. All of these predate ER Vanities and were harmless until "Bristol" stopped being unique.

### 4.1 `src/controllers/collectionsController.js` — `mgModelSinkMap`

**Lines 175, 187–189; consumed at line 502.**

Drives the S/D size chips (`60S` / `60D`) on model-group pages. Keyed on model alone. James Martin's Bristol has Double Sink widths that ER Vanities' Bristol does not, so a `60D` chip can match the ER card on the strength of JM inventory that does not exist under that name.

Source rows (`mgOptRows`, line 163) **already select `p.brand`** — no query change needed, only the key.

> ⚠️ `mk` is currently declared at line 355, well below line 187. Using it at 187 requires moving the declaration to the top of the `display_mode === 'model-group'` block (just after `mgProductCatId`). A `const` used above its declaration throws a TDZ ReferenceError at runtime, and `node --check` will **not** catch it.

### 4.2 `src/controllers/collectionsController.js` — product-card maps

**Lines 841–928.** `modelColorMap`, `modelSizeMap`, `modelColorSizeMap`, `modelSizeImageMap`. This is the **standard collection page**, not the model-group page.

This is the worst instance. `modelColorMap` **pushes** (line 863), so the ER Bristol product card lists its own Natural White Ash swatch followed by James Martin's three; clicking one of those loads a James Martin image onto an ER card.

These three queries (lines 844, 878, 902) match on `p.model IN (...)` with **no brand scope and no category scope at all**. They are the loosest queries in the file.

> **Do not add category scope silently.** Brand scope is a bug fix. Category scope is a behaviour change — a model spanning categories would lose swatches. Decide it deliberately, separately.

### 4.3 `src/controllers/homeController.js` — `getFeaturedModels()`

**Lines 211–323.** The homepage model carousel. Same five maps as `ec2d4af`, same collision, keyed on model alone at lines 231, 233, 270–291, 321–323. The sub-queries at 212 and 243 have no brand scope.

> ⚠️ Line 211 is `modelRows.map(r => r.model)` with **no `new Set()`** — with two brands sharing a model name it emits a duplicate in the `IN` list. Harmless to SQL, but de-duplicate it while you are there.

### 4.4 `src/controllers/homeController.js` — `getFeaturedProducts()`

**Lines 48–119.** The homepage Featured Products grid. Same concatenation defect as 4.2, at lines 86–90, 95–101, 111–119. `p.brand` **is** already selected on the outer product query (line 23), so `rows` carry brand.

### 4.5 `_mId` — duplicate DOM ids

**`views/pages/collection.ejs` line 747 · `views/pages/index.ejs` line 554.**

```js
var _mId = m.model ? m.model.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'model';
```

Two Bristol cards emit `id="model-img-bristol"` and `id="model-price-bristol"` **twice**. `public/js/site.js` resolves a swatch click with `document.getElementById(dataset.targetImg)`, which returns the **first match in the document**. Cards sort by brand, ER first — so clicking a swatch on the James Martin Bristol card swaps the image and price on the **ER Vanities** card. Duplicate ids are also invalid HTML.

Not currently visible: page 1 of the unfiltered grid holds 12 cards and JM's Bristol falls to page 2. Any filter that thins the earlier JM models puts them on one page and it fires.

Fix is to append a slugged brand. These ids are referenced **only** where they are generated (verified by grep across `public/css/`, `views/`, `src/`) — no CSS or JS depends on the current string.

### 4.6 `_mHref` — card link drops brand

**`views/pages/collection.ejs` line 748 · `views/pages/index.ejs` line 555.**

```js
var _mHref = '/collections/bathroom-vanities?model=' + encodeURIComponent(m.model || '');
```

No brand. The ER Vanities Bristol card links to a grid holding **both** brands' Bristol products. `getCollection` already parses `req.query.brand` into `brands` (line 594) and passes it to `Product.findByCategory`, so appending `&brand=` works with no controller change.

`_mHref` is used **three times per template** — image link, title link, and the "Shop Model" CTA:

- `collection.ejs` lines 766 / 777 / 846
- `index.ejs` lines 564 / 595 / 646

One assignment, three consumers.

### 4.7 Not fixable by a key change — `model_groups` has no brand column

`homeController.js` line ~205 builds `mgOverlay` from `model_groups.model_name`. A curated featured-model row for "Bristol" applies to **every** brand's Bristol — custom image, video, tagline. This needs a schema change (add `brand`, backfill, re-key the overlay), not a key change. **Logged, not guessed.** Do not paper over it by keying the overlay on `model||brand` — the column does not exist.

---

## 5. Standing decisions that look like omissions but are NOT

This is the section that matters most for not breaking things.

### 5.1 `bundleController.js` is brand-locked to James Martin on purpose

`const JM_BRAND = 'James Martin Vanities'` (line 7) filters cabinets, tops, mirrors and colour chips. **This is a safety mechanism, not an oversight.** James Martin tops are not compatible with ER Vanities bases. A mixed ER/JM bundle would ship parts that do not fit.

Two independent barriers currently prevent it:

1. The brand filter (lines 87, 116, 136, 183).
2. The stone-top depth rule requiring `depth_in >= 22.5` (line 81) — ER cabinets are 21.625" and cannot qualify.

**Do not remove or generalise the brand filter.** The open task here is to add a **visible label** telling the shopper the builder is James Martin only. That is a copy change, not a logic change.

**Faucets are deliberately unfiltered** — see the explicit `NOTE:` comment at line 144. Faucets are brand-agnostic. Leave them.

### 5.2 The `product_type` filter on `mgCsWhere` exists for a reason

A comment above the block documents it: without it, Cabinet Only model cards still showed Single/Double Sink swatches when browsing `bathroom-vanity-cabinets`. Brand was added alongside it in `ec2d4af` because it is the same leak class. Keep both.

### 5.3 `SLUG_DEFAULT_TYPES` auto-injection

`bathroom-vanities-with-tops` and `bathroom-vanity-cabinets` are **routing/display slugs only**. Products physically live in `bathroom-vanities`. The map auto-injects `product_type` filters so these SEO categories show the right sub-type without a `?type=` param. Removing it empties those pages.

### 5.4 Source category is looked up by slug, never hardcoded

`Category.findBySlug('bathroom-vanities')` → `mgProductCatId` (line 120). This is **Rule 12, canonical slugs**. Do not replace it with an integer id.

### 5.5 Size chips use `SIZE_BUCKETS`, never raw widths

**Rule 10.** ER widths are 29.5 / 35.5 / 41.5 / 47.5 / 59.5 / 71.5; they bucket to 30 / 36 / 42 / 48 / 60 / 72. Comparisons must go through `SIZE_BUCKETS` ranges (±2" approximation), never against a raw `width_in`. The same nominal ladder is used in the ER `mpn` values.

### 5.6 `_pImgId` / `_hpImgId` use `product.id` and are already safe

`'prod-img-' + product.id` and `'feat-img-' + product.id`. These are unique. **Do not "consistency-fix" them into model-based ids** — that would create the exact bug described in 4.5.

### 5.7 Live BVO taxonomy — four values, exact strings

```
Single Sink Vanity With Top
Double Sink Vanity With Top
Single Sink Cabinet Only
Double Sink Cabinet Only
```

`mount_type` canonical value is **`Floor Standing`** (migration 011 converted `Freestanding`). Do not reintroduce the old string.

### 5.8 `attribute_definitions` gates the filter sidebar

An `attr_key` with no row in `attribute_definitions` **stores fine but is invisible** in filters. Some ER fields are deliberately definition-less:

- `height_in` and `depth_in` — a single value across all 73 vanities, so a filter would render one checkbox.
- `prop65`, `watersense_certified`, `warranty` — disclosure and terms, i.e. PDP content, not a shopping decision.

This mirrors what the James Martin importer already does with `height_in`, `depth_in` and `weight_lbs`. `drawer_side` **was** given a definition because left vs right is a plumbing constraint, not a preference — a shopper whose supply lines sit on one side cannot use the other.

### 5.9 `applyGmcDefaults()` keys on `product_type`

`src/utils/seoDefaults.js` derives Google Merchant fields server-side via `GMC_CATEGORY_MAP`, keyed on `product_type`. None of the three ER values (Vanity, Bridge Unit, Linen Tower) are in that map — which is why `google_product_category` was set **explicitly** on all 78 rows at load time. Left to the default they would have loaded NULL and Google would reject the feed. Do not strip those explicit values assuming the helper covers them.

---

## 6. Database traps that have already bitten us

- **MariaDB 10.6 collation.** Server default is `utf8mb4_uca1400_ai_ci`; BVO tables are `utf8mb4_unicode_ci`. `product_attribute_values` was recreated with `DEFAULT CHARSET=utf8mb4` and **no COLLATE clause**, so any text comparison against `products` throws `#1267 Illegal mix of collations` without an explicit `COLLATE utf8mb4_unicode_ci`.
- **`products.ships_ltl` and `products.prop65` are `TINYINT(1)`**, not VARCHAR. Writing `'Yes'` fails with `#1366` under `STRICT_ALL_TABLES`.
- **A SQL parser validates syntax, not types.** A clean parse pass does not catch `#1366`.
- **phpMyAdmin's SQL tab chokes around 975 KB.** Use the **Import** tab for large loads.
- **RFLPos database is READ-ONLY.** Never write, modify or delete anything in it.
- **`product_attribute_values`** dropped its composite PK in favour of a surrogate `id` (migration 011), which is what makes multi-value `style` legal — one row per bucket.

---

## 7. Text-matching trap that has produced false results twice

Always use word boundaries (`\b`) in any text gate. Substring matching is not safe on this catalogue:

- "B**right** White" contains "right"
- "sp**lash**es" contains "ash"
- "s**oak**" contains "oak"

The second and third produce false material claims. Which leads to the standing rule:

> **Never guess or infer material composition.** A mistaken construction claim is a legal exposure. If a material is not sourced from the manufacturer's own documentation, it does not go in copy, attributes or bullets.

---

## 8. ER Vanities data facts — use these, do not re-derive them

- **78 SKUs.** 341 images, 2,018 attributes, 624 bullets, 54 documents, 37 component pairings. Taxonomy split 59 / 14 / 4 / 1.
- **5 collections:** Bristol, Kensington, London, Oxford, Windsor.
- **Bristol is 9 SKUs, all Natural White Ash.** The single swatch on the Bristol card is correct, not a leftover of the bug.
- **Finish counts across all 78:** Bright White 25, Desert Oak 12, Navy Blue 12, Natural White Ash 9, Metal Gray 8, Black 4, Sage Green 4, Whitewashed Ash 4.
- **Brand appears in exactly one place: the `brand` column.** It is **not** in the SKU (`Bristol-29.5-NWA-BG`) and **not** in the image name.
- **Cloudinary carries the brand as a folder:**

  ```
  bathroom-vanities-outlet/er-vanities/bathroom-vanity-bristol-30-natural-white-ash-pr1269-1
  ```

  All 341 ER assets live under `er-vanities/`. Public ids use the **nominal** ladder (29.5 → 30) because they must be slug-safe — no dots.
- **Alt text is generated, not stored:** `alt="<%= m.model %> vanity"`. It contains no brand, so both Bristol cards currently emit identical alt text. Worth fixing for accessibility and SEO at the same time as `_mId`.
- **`overwrite=false` freezes Cloudinary public_ids.** Replacement is delete-then-reupload. Only rewrite the journal when zero deletes failed.
- **Dimension provenance is recorded per SKU in `dim_source`:**
  - `manual` — 54 SKUs, read off the manufacturer technical drawing.
  - `derived` — 19 SKUs (Oxford and Bristol). Height and depth are identical on all 23 drawings across 3 collections and 8 widths, so 33.75 × 21.625 is a **measured constant**, not an estimate.
  - `manufacturer` — 5 SKUs (4 bridge units, 1 linen tower), supplied directly.
- **Component dimensions are not vanity dimensions.** Bridges are 18" deep and 8–20" tall; the linen tower is 24W × 18D × 72H. Do not infer them from the vanities they sit beside. Likewise, "84" in a Bristol bridge title is the **assembled run**, not the unit width — the unit is 24".

---

## 9. How to verify any fix in this area

Server-side correctness is visible in the DOM without database access. On any listing page:

```js
[...document.querySelectorAll('article.model-card')].map(c => ({
  model: c.dataset.model,
  hero:  c.querySelector('img.model-card-img')?.src,
  swatches: [...c.querySelectorAll('[data-size-images]')].map(s => s.dataset.color)
}))
```

Then check four things:

1. **`/collections/vanity-models`** — no ER card serves a `salsify` URL; no JM card serves a `cloudinary` URL.
2. **`?brand=ER+Vanities`** — 5 cards; hero **and** every `data-size-images` entry Cloudinary.
3. **`?brand=James+Martin+Vanities`** — regression check. 40 models, all salsify, JM Bristol keeps its own 3 swatches.
4. **Both Bristol cards on one screen**, then click a swatch on each. Each card must change **its own** image and price. This is the check that catches the duplicate-id defect in 4.5, and it is the only one of the four that requires a browser rather than a DOM dump.

A useful habit from this episode: the second, third and fourth instances of this bug were found by grepping for the **shape** of the first, not by waiting for another symptom.

> Any identifier ending `Map` / `Buckets` / `Sizes` subscripted by a bare `.model` is suspect.

---

## 10. Related open items (context, not tasks for this brief)

- **Homepage ER Vanities Models section** — `getFeaturedModels()` has no brand filter and auto-ranks by product count, so James Martin's ~5,218 products dominate. Needs curation or a brand-aware ranking.
- **Vanities mega menu "Shop by Brand"** — nav links live in the **database** (Theme Editor → Navigation), which **overrides** the defaults in `themeSettings.js`. Editing the file alone will not change the menu.
- **Bundle builder** needs a visible "James Martin only" label (see 5.1).
- **`enrich_bvo_v7.py` lines 486 and 495** still branch on `brand_val == 'Ethan Roth'`. ER Vanities is the rebrand of Ethan Roth; those branches will silently stop setting RFL attributes.
- **GVS listing-title corrections outstanding:** Bristol bridges titled "84 in." for 24" units; Windsor 35.5 Navy Left titled Left but photographed Right; "SFD" in 9 titles; "copy" in 12 handles.
- **Photography gaps:** `Windsor-35.5L-NVBLU-BG` has no imagery at all; `Kensington-29.5L-WH-BN` needs a reshoot; 4 bridge-drawer images are card-only at 523–538px.
- **Pending from the manufacturer:** weights, crate dimensions, UPCs, HTS codes, UL listing, Oxford and Bristol manuals.
- **Steps 4 and 5 of the ER programme** — inventory sync and sales-order sync between BVO and RFLpos — are not started. See `BVO_RFLPOS_SYNC_BRIEF.md`.

---

*End of brief.*
