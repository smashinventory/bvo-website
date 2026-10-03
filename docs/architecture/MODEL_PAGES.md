# Model pages — the inventory, and what it decides

> Measured against the live database 2026-10-02 via
> `migrations/2026-10-02_model_slug_inventory.sql`. Re-run that file rather
> than trusting these numbers after the catalogue moves.

## What a model page is

`DISTINCT products.model, products.brand` where `is_active = 1` and
`category_id = 1`. **Not** a row in a table — `model_groups` holds overrides
for the models someone has curated, and most have no row at all. That single
fact drives most of the decisions below.

## The numbers

| | |
|---|---|
| Model pages | **45** |
| ≥ 25 products | 28 |
| Under 25 | 17 |
| Under 5 | 6 |
| Smallest / largest | 1 / 830 products |
| Models with no brand | 0 |
| Slug collisions | 0 |
| Names needing awkward slugification | 1 (`Alicante'`) |
| **Models with a description** | **0 of 45** |

Top of the distribution: Brittany 830, Breckenridge 498, Lorelai 354,
Bristol (JMV) 300, Chicago 295, Brookfield 267, Myrrin 251, Bellshire 221,
Laurent 206, Hudson 167.

## Three findings that changed the plan

### 1. Forty-five, not ten

The seobility crawl showed ten `?model=` URLs because that is how many model
cards the homepage renders. `/lookbook` shows 41. The real figure is 45. Any
estimate of this work built on the crawl alone is low by 4.5×.

### 2. Bristol exists under both brands — the collision is real

```
James Martin Vanities / Bristol    300 products
ER Vanities           / Bristol
```

`src/utils/modelSlug.js` always suffixes the brand. That was argued for on
the grounds that "suffix only on collision" is order-dependent, and I stated
at the time that no collision existed — read from the ERV load file and the
ten models the crawl happened to surface. **That was wrong.** The collision
query returns zero rows only *because* the rule is unconditional. Under the
conditional rule this would have needed a tie-break on day one.

Consequence beyond slugs: anything joining `collections` on `name` alone
fans out. The Q6 join returned 47 rows for 45 models for exactly this
reason. Join on `(name, brand)`.

### 3. No model has any content

Of 45 models, 5 have a `model_groups` row — Brittany, Breckenridge, Hudson,
Amberly, Emmeline — and **all five have an empty `description`**. Zero have
`meta_title`. One (Brittany) has a `custom_image`.

The columns and the admin UI already exist (`model_groups.description`,
`meta_title`, `meta_description`; edited in `views/pages/admin/model-edit.ejs`).
Nothing has ever been typed into them.

## The indexing rule

A clean URL is a promise that the page is worth indexing. 45 clean URLs with
nothing on them is 45 thin pages, which is worse than 10 parameterised ones.

Same shape as the filtered collections (`087c28f`,
`src/config/filterLandingPages.js`): title, meta description, H1 and an
intro paragraph per page, held in one config file.

**ALL 45 GET CONTENT AND ARE SELF-CANONICAL.** Sam's call, 2026-10-02:
*"I want all."*

I had proposed content for the 28 with ≥ 25 products and canonicalising the
other 17 to the parent, mirroring the 9 thin filters. Overruled, and the
reasoning holds up — a model is not a filter. A filtered collection with 3
products is an arbitrary slice of a catalogue; a model with 3 products is a
*product line that exists*, with a name customers search for and a page that
should answer them. Breckenridge and Alicante' are the same kind of thing at
different scales.

These are also not thin in the way a 3-product filter is: Brittany has 830
products, a real H1 and a full grid. The grid is substantive content. The
intro exists to say what the model *is*, which no amount of grid can.

**The threshold stays in the code as a dial, set to 1.**
`settings.seo.model_landing_min_products = 1` — so every model is
self-canonical today, and if Search Console later shows the single-product
pages being ignored or flagged as thin, raising the number is a settings
change rather than a rewrite. The mechanism costs nothing to keep and the
decision stays reversible without touching 45 URLs.

Six models have under 5 products and one has a single product. That is the
only part of this with real downside risk, and the dial above is what it is
for.

## URL shape

```
/collections/vanity-models/brittany-james-martin-vanities
```

Nested under `/collections/vanity-models`, which already exists as a real
page: reserves the namespace against the category slugs served by
`/collections/:slug`, and gives a true breadcrumb.

`Alicante'` → `alicante-james-martin-vanities`. The trailing apostrophe
collapses into the brand-joining hyphen rather than doubling it, because the
character class is greedy over the whole run.

## What this does not fix

The `-/- IMG-ALT` model-card rows in the anchor-text report read
`"Brittany vanity"` as their entire anchor-text signal. A real model page
gives those alts something to say, but the alt text itself is a separate
edit — see the anchor-text section of `OPEN_ITEMS.md`.
