# Canonical and index decisions — every parameterised URL on the site

> **This document changes nothing.** It is a decision record: for each of the
> 71 parameterised internal URLs, whether it should be self-canonical,
> canonical to a parent, or nofollowed — and the evidence behind the call.
>
> No database table is created or altered. No filtering, taxonomy, category
> or collection logic is proposed for change. Scope agreed with Sam
> 2026-10-03: *"we will add a table, but not remove or alter other tables or
> code."*
>
> Counts measured against the live catalogue: filters 2026-10-02 (4,604
> vanities), models 2026-10-02/03 via
> `migrations/2026-10-02_model_slug_inventory.sql`.

---

## The rule being applied

Three outcomes, and the choice between them is not a style preference:

| Outcome | When | Effect |
|---|---|---|
| **Self-canonical** | the URL answers a distinct search intent AND has enough behind it to satisfy someone who lands there | can rank for its own intent |
| **Canonical → parent** | it's a real slice but too thin to deserve its own page | stays usable and crawlable, doesn't compete with the parent |
| **Nofollow** | the URL should not be crawled at all | no equity flows, not indexed |

**Nofollow is used sparingly and never on a page we want to rank.** It
silences the seobility "dynamic parameters" warning by that rule's own
terms, which is precisely why it's tempting and mostly wrong — it also stops
link equity reaching the page. Applied to a page that *could* rank, it
destroys the asset to fix a report line.

**The threshold is 25 products**, already live as
`settings.seo.filter_landing_min_products`. The reasoning is in
`src/config/filterLandingPages.js`: the grid serves 24 per page, so 25
guarantees a promoted page has at least one full grid plus a second page.
That makes the line defensible rather than arbitrary, and it self-corrects
as the feed adds products — a value at 7 today can clear it next quarter
with no code edit.

---

## Part 1 — The 27 filtered collection URLs

These are **already implemented and live** (`087c28f`). Listed here as the
record of what was decided and why, not as work to do. The controller
evaluates the threshold at request time; the table below is the state as
measured on 2026-10-02.

### Self-canonical — 18 URLs

| Filter | Products | URL |
|---|---|---|
| Transitional | 2,808 | `?style=Transitional` |
| Med Wood | 1,501 | `?color_family=wood_m` |
| Modern | 1,331 | `?style=Modern` |
| 60" | 1,277 | `?size_in=60` |
| 48" | 1,031 | `?size_in=48` |
| 72" | 964 | `?size_in=72` |
| White | 956 | `?color_family=white` |
| Farmhouse | 951 | `?style=Farmhouse` |
| Light Wood | 810 | `?color_family=wood_l` |
| 36" | 742 | `?size_in=36` |
| Traditional | 686 | `?style=Traditional` |
| 30" | 449 | `?size_in=30` |
| Dark Wood | 415 | `?color_family=wood_d` |
| Green | 313 | `?color_family=green` |
| Black | 270 | `?color_family=black` |
| Blue | 202 | `?color_family=blue` |
| Mid-Century Modern | 153 | `?style=Mid-Century+Modern` |
| Gray | 121 | `?color_family=gray` |

### Canonical → `/collections/bathroom-vanities` — 9 URLs

| Filter | Products | Note |
|---|---|---|
| 84+" | 90 | closest to the line; will likely cross it |
| Cream | 46 | |
| European / Old World | 40 | |
| 25" | 27 | **just over 25** — may already be promoted; the threshold is evaluated live, not from this table |
| Scandinavian | 19 | |
| Industrial | 12 | |
| 20-" | 10 | |
| 42" | 8 | |
| Coastal | 7 | |

Content is written for all 27. Nothing needs editing when one crosses the
threshold — the promotion is automatic.

### Nofollow — none

Deliberately. Every one of these 27 is either ranking for its own intent or
a candidate to, and all 27 pass equity to products. Nofollowing the 9 thin
ones would clear 9 lines from the seobility report and gain nothing, while
cutting the crawl path to products that only appear in those slices.

---

## Part 2 — The 44 model URLs

Currently `?model=X&brand=Y`, canonical to `/collections/bathroom-vanities`,
so **none of them can rank today**. 30 internal links point at 10 of them
from the homepage alone.

### Boston gets no page at all

| | |
|---|---|
| Products | 42 |
| With a `product_type` | **0 of 42** |
| Width range | 1.10" – 63" |
| Price range | $172 – $1,922 |
| Material | Stainless Steel |
| Finishes | Brushed Nickel, Matte Black, Radiant Gold |

Boston is hardware, not a vanity line. No single-sink, double-sink or
cabinet-only product exists anywhere in it. It should not have a vanity
model page, which takes the set from 45 to **44**.

**This is an observation, not a proposal.** Nothing about Boston's category
or `product_type` assignment is being changed. It simply should not receive
a model landing page.

### The decision, applied

**Self-canonical: all 44.** Sam's call 2026-10-03 — *"I want all."*

I had proposed self-canonicalising the 28 with ≥25 products and
canonicalising the other 16 to `/collections/vanity-models`, mirroring the 9
thin filters. Overruled, and the reasoning is sound: **a model is not a
filter.** A filtered collection with 3 products is an arbitrary slice of a
catalogue. A model with 3 products is a product line that exists, has a name
customers type into Google, and should have a page that answers them.
Breckenridge and Alicante' are the same kind of thing at different scales.

The threshold stays available as `seo.model_landing_min_products`, set to 1.
Every model is self-canonical today; if Search Console later reports the
single-product pages as thin or simply ignores them, raising that number is
a settings change rather than a rewrite. The decision stays reversible
without touching 44 URLs.

### Where the risk actually sits

| Band | Models | Judgement |
|---|---|---|
| ≥ 25 products | 28 | No concern. Brittany has 830 products, a real H1, a full grid. |
| 5 – 24 | 10 | Fine. A real product line with a page's worth of grid. |
| Under 5 | 6 | The only genuine risk. One has a single product. |

The six under five products are what the dial exists for.

### What every model page needs before it can be self-canonical

**0 of 45 models currently have a description.** Five have a `model_groups`
row — Brittany, Breckenridge, Hudson, Amberly, Emmeline — and all five have
an empty `description`. None have `meta_title`. One (Brittany) has a
`custom_image`.

The columns and the editing UI already exist
(`model_groups.description`, `meta_title`, `meta_description`, edited in
`views/pages/admin/model-edit.ejs`). Nothing has ever been typed into them.

So self-canonical status is a promise the pages cannot currently keep. The
content is the prerequisite, not the follow-up.

### Nofollow — none

Same reasoning as the filters, and stronger: these are the pages the model
cards and the lookbook link to. Nofollowing them would orphan 44 product
lines.

---

## Part 3 — The remaining 6 parameterised URLs

| URL | Decision | Why |
|---|---|---|
| `?brand=James%20Martin%20Vanities` | self-canonical | brand is a real search intent; the catalogue is brand-led |
| `?brand=ER%20Vanities` | self-canonical | same |
| `?type=Single+Sink+Vanity+With+Top` | self-canonical | a distinct intent with substantial inventory behind it |
| `?type=Double+Sink+Vanity+With+Top` | self-canonical | same |
| `?product_type=Bathroom+Faucets` | canonical → `/collections/faucets` | duplicates the parent collection almost exactly |
| `?on_sale=1` | **nofollow** | the only genuine nofollow case on the site: contents change daily, so it can never be a stable indexable page, and it is a view of inventory rather than a category |

`?on_sale=1` is the one URL where the seobility rule and the right answer
agree.

---

## What this does NOT fix

**The dynamic-parameter warning stays.** Seobility flags the `?` in the URL,
not the canonical tag. A canonical decision cannot remove a query string, and
the three ways to mask it — nofollow, JavaScript-built links, POST forms —
all silence the warning by cutting the page off from the equity that would
let it rank. The only real fix is converting the parameter to a path, which
is a code change and is **parked**.

So after everything in this document, 43 URLs still carry the flag. That is
an accepted trade, recorded here so it is not rediscovered as a finding.

---

## Open data gaps in this document

Honest about what is and is not measured:

1. **Product counts for 19 of the 44 models.** Query Q1b returned rows 0–24
   of 45; the back half — including every ER Vanities model — was not read.
   The band table above ("28 / 10 / 6") comes from the Q1c aggregate, which
   is reliable in total but means I cannot name which specific models sit in
   the under-5 band. One query with "Number of rows" set to 100 closes this:
   `migrations/2026-10-03_model_facts_v2.sql`, query B.
2. **Whether Boston is the only non-vanity model.** Query A of the same file
   finds every model that is entirely `product_type NULL`. Boston should
   appear; anything else appearing changes the count of 44.
3. **`?type=` and `?brand=` product counts** are not measured. Both are
   assumed substantial and should be confirmed before relying on the
   self-canonical call for them.
