# Model & product cards — change journal, 5 Sept 2026

Written so any of this can be unwound without re-deriving the reasoning.
Read the **Unwind guide** at the bottom first if you are reverting.

Everything here is pushed to `main` and live on
`slategrey-falcon-350174.hostingersite.com`.

---

## The one-paragraph version

Two brands now sell the same model names, which broke every per-model
lookup on the site. Fixing that opened up a chain: model identity →
brand/category filters on the featured sections → which product a card
leads with → how cards are ordered → what the corner badge says → what
happens when you click a size chip. Fifteen commits, four of which are
re-runs of the same script picking up incremental fixes.

---

## Commit-by-commit

Times are local. Duplicate titles are the same push script run again after
I fixed something between runs — each one carries different content, so
none can be skipped when reverting.

| # | commit | time | what it did |
|---|---|---|---|
| 1 | `ec2d4af` | 14:20 | Collections model-group: key image / swatch / price maps by **(model, brand)** |
| 2 | `8f0cd02` | 14:58 | Same fix everywhere else — completes `ec2d4af` |
| 3 | `c4f8c62` | 15:32 | `model_groups` identity becomes `(model_name, brand)` — **schema** |
| 4 | `d507bea` | 16:27 | Brand/category/type filters + duplication on the three featured sections |
| 5 | `3cf746d` | 16:35 | Theme-editor category dropdown only offers categories that hold products |
| 6 | `bea8ebe` | 17:30 | `model_groups.default_sku` — pick the product a card leads with — **schema** |
| 7 | `00c853d` | 10:43 | Featured sections ordered by national demand; BEST badge earned |
| 8 | `0ec7e05` | 10:52 | `/collections/vanity-models` ranked by demand, not A–Z |
| 9 | `9ffdcf9` | 11:07 | `modelHero.js` — cards lead with the best-selling variant |
| 10 | `d03fe60` | 11:19 | …+ homepage size chips sorted by width |
| 11 | `a1567c1` | 12:00 | `cardBadge.js` — rotating corner badge replaces duplicate "Save $X" |
| 12 | `1626bda` | 12:04 | …+ Sale stops short-circuiting the rotation |
| 13 | `32f9686` | 12:10 | …+ collection grid uses the rotation; Sale removed from the pool |
| 14 | `77f32b3` | 13:32 | Product-card chips navigate to the variant; accessories out of the vanity grid |

---

## New files (deleting these reverts a whole feature)

| file | introduced | owns |
|---|---|---|
| `src/utils/modelKey.js` | earlier | The `(model, brand)` identity format |
| `src/utils/modelHero.js` | `9ffdcf9` | Which product a card leads with; `toBucket` |
| `src/utils/cardBadge.js` | `a1567c1` | Corner badge eligibility + selection |
| `public/js/carousels.js` | `9ffdcf9`, extended `77f32b3` | Carousel binding; variant-link navigation |

---

## Schema changes — apply/revert order matters

Both were applied by hand to production **before** the code that reads
them, and `_ensureModelGroupsTable()` in `adminController.js` will re-add
them on a fresh environment.

```sql
-- c4f8c62
ALTER TABLE model_groups ADD COLUMN brand VARCHAR(255) NOT NULL DEFAULT '' AFTER model_name;
UPDATE model_groups mg JOIN (…) b ON …  SET mg.brand = b.brand WHERE mg.brand = '';
ALTER TABLE model_groups DROP INDEX model_name;
ALTER TABLE model_groups ADD UNIQUE KEY uniq_model_brand (model_name, brand);

-- bea8ebe
ALTER TABLE model_groups ADD COLUMN default_sku VARCHAR(64) DEFAULT NULL AFTER og_image;
```

**Why order matters, in both directions.** `getFeaturedModels()` wraps its
curated query in a `try/catch` that falls back to auto-ranking. Selecting
a column that does not exist therefore does **not** error the homepage —
it silently stops honouring your curated featured models. So:

- deploying code **before** the column = silent loss of curation
- dropping the column **before** reverting the code = same

Reverting `brand` also needs `UNIQUE(model_name)` restored, which **fails**
while two rows share a model name. Delete or rename one first.

---

## Behaviour changes, and what each one replaced

### Model identity
Every per-model map keys on `(model, brand)`. Previously model name alone,
which meant ER Vanities' Bristol and James Martin's Bristol overwrote or
concatenated each other — the ER card rendered James Martin's photography,
swatches and prices.

The trap: **the row must actually carry `brand`.** A query that doesn't
`SELECT p.brand` degrades the key to `"Bristol||undefined"`, every row
collides again, and it looks exactly like the fix was applied.

### Featured sections
- `brand`, `category`, `ptype` filters on Featured Products and Featured Models; `brand` alone on Category Grid (scopes the card *links*, not which cards show).
- All three became duplicatable. This required converting them from `sectionKey === 'x'` + a single module alias to `_baseKey` + per-slot data — without that, a `_2` copy renders **nothing**, silently.
- `featured_section.limit` now actually applies. It was read by nobody; the query was hardcoded `LIMIT 12`. **This is why your product row went from 12 cards to 3** — your saved slider value took effect for the first time.
- `featured_models.category` defaults to `'bathroom-vanities'` and `featured_section.category` to `''`. The difference is deliberate: it reproduces each section's prior behaviour, since `get()` deep-merges saved settings over defaults.

### Ordering
`demand_score` (James Martin national dealer movement, from the JMV
rollup — **not** this site's orders) orders both featured sections and the
model collections page. Manual selection still picks the pool; demand
ranks it; curated `sort_order` is the tiebreaker.

The model auto-ranking fallback was `ORDER BY COUNT(*) DESC` — how many
SKUs a model has, not how it sells. A model with eight colours beat a
genuinely popular one.

### Which product a card leads with
`model_groups.default_sku` if set, otherwise the highest-demand variant.
Image, price, strike-through, save badge, finish swatch and size chip all
come from that one product. Previously each was chosen independently —
cheapest price, smallest size, first swatch, and whichever image `MIN()`
landed on — so a card could show one product's photo above another's price.

Hero candidates must carry **both** `width_in` and `color`, and must
bucket to a real size chip. A hero that can't do all three is declined
entirely rather than applied halfway.

### Corner badge
Was `Save $1,211` directly above a price row that also read `Save $1,211`.
Now one of eleven labels, and each card only rotates among ones it
qualifies for:

- **All Wood / Furniture Grade / Solid Quality** — require solid-wood material. James Martin is `Wood, MDF`; ER is `Solid Wood, Plywood`. The MDF veto is checked *before* the wood match, so `Solid Wood, MDF` does not qualify on the words "solid wood".
- **Hot Seller / Popular / Trending** — require `demand_score > 0`.
- **Low Stock** — qty 1–3. Zero is out of stock, a different message.
- **Multiple Colors** — 4+ finishes.
- **Great Value / Designer Class** — subjective, always eligible, so no card is bare.
- **Sale — deliberately NOT in the pool.** Nearly the whole catalogue is discounted, so it dominated; and the price row already prints the amount.

Stable per card (hashed from the card's key), not random per page load.

### Product-card chips
They now **navigate** to the sibling that differs in one dimension — size
chip keeps your colour, colour swatch keeps your size. Previously they
swapped only the photo, leaving the price and the "View Details" link on
the original SKU.

Model-card chips are **unchanged** and still switch in place. That is
correct for them: they link to a filtered collection, not one SKU.

The click handler is on the **capture phase** in `carousels.js`, because
`site.js` binds the same elements on bubble and calls `preventDefault()`.
`site.js` has no unminified source in the repo, which is why it is worked
around rather than edited.

### Accessories
`/collections/bathroom-vanities` now requires a `product_type`. At 25"
wide, ten of the first twelve cards were Bellshire Drawer Units.

**Accepted cost:** console vanities (Auburn, Boston 20", Brooklyn) are
untyped *by design* — see the `product_type` block in
`importJamesMartinFeed.js` — so roughly 28 real vanities are hidden too.
Typing the accessories is what removes this cost.

---

## Known-open items

> **Updated 6 Sept.** Two entries below were wrong or have since been
> resolved — corrections are inline. Search and result ordering changed
> substantially on 6 Sept; see `SEARCH_AND_ORDERING_2026-09-06.md`.
> Notably `product.sort_order` is now settable and leads the merchandised
> sorts, which changes the "manual ordering does not work" entry below.

- ~28 console vanities hidden by the accessory filter (accepted).
  **6 Sept:** re-confirmed acceptable. They are findable by search (which
  does not filter on `product_type`), present in the sitemap, and their
  product pages render. Only the browse grid omits them.
- 106 products in bathroom-vanities carry `product_type = NULL`: 27 genuine accessories, ~28 consoles (intentional), the rest bases and cabinets. The importer's `categoryId === 1` branch never consults `CATEGORY_TYPE_MAP`, which is why accessories landing in that category come out untyped.
- ~~Homepage featured-models ranking has no brand filter, so James Martin's ~5,218 products dominate when nothing is curated.~~
  **WRONG — this entry was never true.** `d507bea` (4 Sept) shipped the
  brand filter on Featured Models. `featured_models.brand` is in the theme
  defaults and `getFeaturedModels` applies `sectionFilters` to both the
  curated and auto-ranked queries. Verified 6 Sept.
  *What is genuinely open:* `/collections/vanity-models` ignores model
  pins, and the homepage curated model order treats `sort_order` 0 as a
  real position. See `SEARCH_AND_ORDERING_2026-09-06.md`.
- ~~`product.sort_order` has no field on the product form and `productUpdate` writes `0` on every save — manual product ordering does not work.~~
  **FIXED 6 Sept, commit `fee2c90`.** The product form now has a "Pin to
  Position" field, blank means unpinned, and a pin leads the merchandised
  sorts — ahead of popularity.
- ~~`featured_section.columns` in the Theme Editor does nothing; the grid is hardcoded to 4 columns in CSS.~~
  **FIXED 6 Sept, commit `90768da`.** `.product-grid` is now var-driven
  with fallbacks equal to the old hardcoded values.
- Lookbook is still alphabetical.
- Untracked strays in the repo: `homeController-1.js`, `collectionsController-1.js`, `collection-1.ejs`, `index-1.ejs`, six `CLAUDE.md.bak*`.

---

## Unwind guide

**Revert one behaviour, not the lot.** The commits are mostly independent.

| to undo | revert | then |
|---|---|---|
| Product-card chips navigating | `77f32b3` | also restores accessories to the grid — split the commit if you want only one half |
| Corner badge (back to Save $X) | `32f9686` `1626bda` `a1567c1` | in that order; delete `src/utils/cardBadge.js` |
| Cards leading with best-seller | `d03fe60` `9ffdcf9` | delete `src/utils/modelHero.js`; **breaks `77f32b3`**, which imports `toBucket` from it |
| Demand ordering | `0ec7e05` `00c853d` | returns to curated sort / alphabetical |
| `default_sku` | `bea8ebe` | leave the column; harmless unused |
| Section filters + duplication | `d507bea` `3cf746d` | **check `homepage_section_order` first** — delete any `_2` slots or they render nothing |
| Model/brand identity | `c4f8c62` `8f0cd02` `ec2d4af` | schema revert needed; see the SQL warning above |

**Three things to check after any revert:**

1. Bump the `carousels.js` cache-buster in `views/layouts/main.ejs` (currently `?v=2`), or returning visitors keep the old file. `.htaccess` sets long cache headers on `/js`.
2. If you revert to code that emits `id="fmCarouselTrack"` / `id="catCarouselTrack"`, the old `site.js` blocks bind again — make sure `carousels.js` is removed at the same time or both will attach and the carousels will double-scroll.
3. Every push script has executing gates. If a revert trips one, read it: the gate is describing the bug being reintroduced, not blocking arbitrarily.

**Push scripts still in the repo** — each holds its own gates and a full
commit message explaining its change:
`git_push_model_brand_key.sh`, `git_push_model_groups_brand.sh`,
`git_push_section_filters.sh`, `git_push_filter_vocab_fix.sh`,
`git_push_card_badges.sh`, `git_push_collection_demand_order.sh`,
`git_push_variant_links.sh`.

---

## Mistakes made and corrected today

Recorded because each one is a trap that could be walked into again.

- **`MAX()` without `GROUP BY`** in `getFeaturedProducts` — would have collapsed Featured Products to a single card. Caught by a gate; `Product.js` uses a scalar subquery for the same reason.
- **`replace_all` hit a product-card block** where `m` is not in scope — a runtime `ReferenceError` that `ejs-lint` passes, because it is scope, not syntax.
- **Sale badge, twice.** Short-circuiting on `'sale'` gave four identical pills; making it merely eligible still let it take a third of the corners. Removed from the pool entirely.
- **`vanity-models` offered in the category filter** — it is a display category holding no products, so choosing it emptied the section. The dropdown now only lists categories that contain products.
- **A gate that counted "Save $" occurrences** failed on correct code, because `index.ejs` legitimately has two card types.
- **`demand_score` is `NOT NULL DEFAULT 0`**, not nullable. A `!= null` guard passes on every unscored product.
- **`SIZE_BUCKETS` is not continuous** — 33, 39, 45, 51, 57, 63, 69 and 75–81 fall between buckets.
