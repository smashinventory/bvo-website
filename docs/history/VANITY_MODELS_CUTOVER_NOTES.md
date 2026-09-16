# Vanity Models — Cutover Notes

> Notes from the vanity models cutover.
**Date:** July 2026  
**Action:** Replaced hard-coded `vanity-models` if-block + `vanity-models.ejs` with the  
generic `display_mode = 'model-group'` pipeline flowing through `/collections/:slug`.

---

## What was deleted and why

### 1. Old controller block — `collectionsController.js` lines 48–202
The `if (slug === 'vanity-models')` block that short-circuited the regular collection
route. It fetched model groups using a WHERE-based color filter (showed green PRODUCTS
not green MODELS), used cabinet-only color families, and rendered `pages/vanity-models`.

Key characteristics of the old block:
- Color filter in WHERE → only filtered-color products entered GROUP BY
- `FAMILIES.filter(f => f.type === 'cabinet')` — metallic families excluded
- `normalize(v, 'cabinet')` only — no metal context
- `optRows` required `width_in IS NOT NULL AND width_in > 0` → excluded gray products
  from `availFinishes` (gray swatch never appeared)
- Rendered `pages/vanity-models` (bespoke template)

### 2. Synthetic stub for `vanity-models-v2`
Temporary object injected when `findBySlug` returned null (before SQL migration ran).
Removed once the DB row existed.

### 3. `views/pages/vanity-models.ejs`
Standalone page template, ~313 lines. Functionally equivalent to the model-group
block in `collection.ejs` but maintained separately.

---

## What replaced it

### DB row in `categories` table
```sql
INSERT INTO categories
  (name, slug, display_mode, description, meta_title, meta_desc, sort_order, is_active)
VALUES
  ('Vanity Models', 'vanity-models', 'model-group',
   'Browse every bathroom vanity collection we carry — explore all models, finishes, and size options.',
   'Vanity Collections | BathroomVanitiesOutlet.com',
   'Browse every bathroom vanity collection we carry — explore all models, finishes, and size options.',
   99, 1)
ON DUPLICATE KEY UPDATE display_mode = 'model-group', is_active = 1;
```

Also required (run first):
```sql
ALTER TABLE categories
  ADD COLUMN IF NOT EXISTS display_mode VARCHAR(20) NOT NULL DEFAULT 'product'
  AFTER meta_desc;
```

### `display_mode = 'model-group'` handler in `collectionsController.js`
Triggered when `category.display_mode === 'model-group'`. Key improvements over old block:

| | Old block | New handler |
|---|---|---|
| Color filter | WHERE clause | HAVING clause — full model sizes/prices preserved |
| Color families | Cabinet only | ALL families (cabinet + metallic) |
| Color normalization | `normalize(v, 'cabinet')` | `normalize(v,'cabinet') \|\| normalize(v,'metal')` |
| `availFinishes` source | `width_in IS NOT NULL` required | No width constraint — gray/other products included |
| Color swatch visibility | Member-string match only | `color_family` key match first, string match fallback |
| Template | `pages/vanity-models` | `pages/collection` (shared) |

### `collection.ejs` — model-group conditional blocks
All model-group UI (size chips, color family filter, model card grid, pagination) lives
inside `<% if (displayMode === 'model-group') { %>` guards in the shared collection
template.

Color filter IDs match `site.js` exactly (no `mg-` prefix):
- `id="color-filter-group"`
- `id="color-family-row"`
- `id="color-sub-<%= fam.key %>"`

---

## Homepage — no changes needed
- Carousel (`homeController.js`) has its own independent query — unaffected.
- "See All Our Models" button (`index.ejs` line 287): `href="/collections/vanity-models"`
  — already pointed at the right slug, works automatically after SQL slug rename.
- Individual model card links: `/collections/bathroom-vanities?model=<model>` — unchanged.

---

## How to rebuild the old behavior (if ever needed)

The full old controller block (lines 48–202) and `vanity-models.ejs` are preserved
verbatim in git history. To recover:

```
git log --oneline | grep "vanity-models"
git show <commit-hash>:src/controllers/collectionsController.js | head -210
git show <commit-hash>:views/pages/vanity-models.ejs
```

The last commit that contained both files intact:
- Check commits before: `fix: model-group color filter — move to HAVING...` (9ae5663)

---

## Future model-group collections
To create another model-group collection (e.g. mirror models, cabinet door styles):
1. Insert a row in `categories` with `display_mode = 'model-group'`
2. No code change needed — the handler and template are generic

---

## Bug fixes applied post-cutover

### Swatch color/label mismatch (commit f55eb22)
Products with `color_family = NULL` fell back to `#ccc` (gray) for the swatch hex even
when `p.color` mapped to a known family (e.g. `'Pistachio'` → green). Fix: all three
swatch-building loops now compute `swatchFamilyKey = r.color_family || normalize(r.color,'all') || ''`
and derive hex/border from that key. Affects:
- `collectionsController.js` mgSwatchMap (model-group handler)
- `collectionsController.js` modelColorMap (regular collection handler)
- `homeController.js` swatchMap (homepage carousel)

### Size chip image swap (added after f55eb22)
Clicking a size chip on a model card now previews the vanity at that width.

**Data added:**
- `collectionsController.js` mgSizeImageMap — SQL groups `products` by `model + width_in`,
  picks the best representative image URL per size, builds `{ size_in: image_url }` map.
- Model rows now carry `sizeImages: mgSizeImageMap[r.model] || {}`.

**Template:**
- `collection.ejs` — sizes row now renders `<button class="model-card-size-btn">` chips
  with `data-target-img` and `data-image` attributes instead of plain pipe-separated text.
- First chip has `is-active` class by default.

**JS (`site.js`):**
- New document-level `click` listener for `.model-card-size-btn`.
- Same pattern as existing swatch handler: reads `data-target-img` + `data-image`,
  swaps `img.src`, toggles `is-active` (deselects if already active).

**CSS (`site2.css`):**
- `.model-card-size-chips` — flex row, wraps, small gap.
- `.model-card-size-btn` — compact bordered button, gold on hover/active.
- `site2.css?v=3` in `main.ejs`.

### Color × size sync — nearest-size fallback + no-toggle-off (commit f6d4faf)
Two remaining issues after the intersection fix:

**Problem 1 — swatch click showed wrong size:** When clicking a new color whose
intersection image for the active size didn't exist (e.g. Wood has no 30" image),
the handler fell back to the color's default image (arbitrary size) but LEFT the
size chip still showing 30". Swatch, chip, and image were out of sync.

**Fix:** Swatch handler now parses all available sizes for the clicked color
(`siKeys`). If the exact intersection is missing, it finds the *nearest* available
size, shows that image, and calls `activateSizeChip(card, nearest)` to update the
active chip. All three signals (swatch, chip, image) are always in agreement.

**Problem 2 — size click after color click showed wrong color:** Clicking the
already-active size chip would toggle it OFF (remove `is-active` from all chips,
add none). On the next swatch click, `card.querySelector('.model-card-size-btn.is-active')`
returned null → intersection failed → fell back to the size-btn's `data-image`
(any color for that width, often the wrong one).

**Fix:** Size chip handler no longer toggles off. Clicking any chip always makes
it `is-active` (one chip always remains selected). Removed `wasActive` guard —
`btn.classList.add('is-active')` is now unconditional.

**New shared helper `activateSizeChip(card, targetSz)`:** Deduplicates the
"set exactly one chip active" logic; used by the swatch handler when snapping to
the nearest available size.

---

## Key rules (do not break)
- Rule 10: `products.width_in` is canonical size source — never EAV `size_in`
- Rule 11: CSS in `site2.css`; bump `?v=` on all CSS links in `main.ejs` on every change
- `--color-navy: #182840` — INK/TEXT ONLY, never as background
- RFLPOS DB is READ-ONLY — never write, modify, or delete
