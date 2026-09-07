# Search & ordering — change journal, 6 Sept 2026

Companion to `CARD_CHANGES_2026-09-05.md`, which covers the model and
product **cards**. This one covers **search and result ordering**.
Read the Unwind guide at the bottom first if you are reverting.

All four commits are on `main` and live on
`slategrey-falcon-350174.hostingersite.com`.

---

## The one-paragraph version

The admin search bar could not find "Brittany white". Chasing that turned
up the same defect in the orders search, a different one on the
storefront, and the fact that MySQL FULLTEXT is structurally incapable of
seeing vanity widths. Fixing the ranking then exposed two ordering
controls that had never worked: `product.sort_order`, which was wiped on
every save, and the Theme Editor's Columns dropdown, which nothing read.

---

## Commit-by-commit

| # | commit | time | what it did |
|---|---|---|---|
| 1 | `455191f` | 22:22 | Word-by-word matching on all three search bars; FULLTEXT dropped |
| 2 | `50d08ba` | 22:42 | Colour weighted above name; admin "Best match" made reachable |
| 3 | `fee2c90` | 23:01 | Pin to Position — `product.sort_order` settable, and it leads |
| 4 | `90768da` | 23:07 | Theme Editor Columns control actually applies |

---

## New file

| file | introduced | owns |
|---|---|---|
| `src/utils/searchQuery.js` | `455191f`, extended `50d08ba` | Word splitting, LIKE escaping, relevance scoring, and `PRODUCT_SEARCH` — the single columns/weights config for all three bars |

No schema changes. No new dependencies. No external services.

---

## 1. Search matched the whole string, not words

`admin products` and `admin orders` both built a single
`LIKE '%<entire query>%'`. The typed text had to appear as one contiguous
run of characters.

- `Brittany white` found nothing — the product is
  `Brittany 36" Single Vanity in Bright White` and the words sit 20
  characters apart.
- `Smith John` could never match a `CONCAT(first," ",last)` that produces
  `John Smith`.

Any second word, or any word out of order, returned an empty page.

Now every word must appear somewhere across the searched columns, in any
order. Words are AND-ed so each one you add narrows; columns are OR-ed
within a word so `Brittany 655` can match a name and a SKU at once.

### The storefront had the opposite bug

`MATCH(...) AGAINST('term*' IN BOOLEAN MODE)` makes every term **optional**
without a leading `+`, so adding a word *widened* the results. The `*` was
appended to the whole string, so only the last word got prefix matching.

### Why FULLTEXT was dropped rather than repaired

**InnoDB's `innodb_ft_min_token_size` defaults to 3.** Tokens shorter than
three characters are never written to the index. Every vanity width —
24, 30, 36, 42, 48, 54, 60, 66, 72 — is two characters. **None of them
were ever in `idx_fulltext_search`.**

`Brittany 36` returned every Brittany because the `36` did not exist to
match, not because the query was badly written. Changing this needs
`innodb_ft_min_token_size=2` in `my.cnf`, a MySQL restart and an index
rebuild — none available on managed hosting.

`LIKE` has no minimum token length. That is the entire reason for the
rewrite. It also gives partial-word matching for free: `wh` finds `White`.

The `idx_fulltext_search` index still exists on the table. Nothing reads
it. Dropping it would reclaim space; leaving it costs only write time.

### Trade-off, stated plainly

**No typo tolerance.** `britany` returns nothing and always will. That
needs a real search engine. The reported complaint was word order and
gaps, not typos.

A leading `%` cannot use an index, so this is a table scan — a few
milliseconds at ~7,000 products. Revisit around 100k, or if typo
tolerance becomes a requirement.

---

## 2. Relevance is computed *and used*

The storefront calculated a match score and then discarded it by ordering
on `p.is_featured DESC, p.sort_order` — and `sort_order` was 0 on every
row (see §3), so results were ordered by a near-constant column and the
best match could land on page three.

Ranking is now an explicit, readable sum in `searchQuery.js`:

```
exact SKU / vendor SKU     100
name starts with the query  50
whole phrase inside name    20
per-word hit                colour 8, colour family 6, name 5,
                            brand/SKU 3, short_desc 1
in stock / featured         +1 / +2  (tiebreakers, never filters)
```

**Colour outranks name on purpose.** Product names embed the *countertop's*
name — `Brittany 36" Single Vanity, Burnished Mahogany w/ 3 CM White Zeus
Silestone Top` contains "white". A mahogany vanity was ranking third on a
"white" search, above a real Bright White unit. Scoring `p.color` highest
breaks the tie correctly. It does **not** stop White Zeus rows matching;
substring search cannot tell which noun a word modifies.

In stock and featured are **tiebreakers, not filters**. Filtering on stock
would have quietly emptied a drop-ship catalogue.

### Admin "Best match" was unreachable for one commit

Shipped in `455191f`, applied never. `products.ejs` resubmits the current
sort in a hidden field on **every** search and filter change, so
`req.query.sort` was never absent and the "no explicit sort chosen"
inference it relied on never fired. A Pecan vanity sat at the top of a
"white" search because of it.

Fixed in `50d08ba`: `relevance` is a real option in the dropdown and the
default whenever a query exists. The hidden field carries a deliberate
choice like Price forward but no longer re-pins to the browse default.

---

## 3. `product.sort_order` was wiped on every save

`_extractProductFields` has always read `body.sort_order`, but the product
form had no input for it — categories, pages and model groups all do. So
every save wrote `0`. **Manual product ordering did not work anywhere on
the site**, and failed silently.

### 0 was both "unset" and the strongest value

Simply adding the input would have made the feature do the opposite of
what you meant: set one product to `1` and the ~5,000 still at `0` would
all rank above it.

`COALESCE(NULLIF(p.sort_order, 0), 999999)` treats 0 as "not pinned" and
parks it at the back.

### A pin outranks popularity

`sort_order` previously sat **third** in the popularity ordering, behind
`demand_score` and `is_featured`, so a manual pick could never get past a
product with real warehouse movement. Backwards for the actual use case:
discounting a slow mover and wanting it seen.

Applied to the merchandised sorts only. An explicit Price or Name sort is
left alone — a pin must never override the order a shopper asked for.

Four sites: `Product.js` `featured` and `popularity` order maps,
`Product.js` `getFeatured()`, `homeController.js:123`.

---

## 4. Theme Editor Columns control

Rendered a 2/3/4 dropdown, saved without complaint, and nothing read it —
`.product-grid` was hardcoded to `repeat(4,1fr)`.

Now `repeat(var(--fs-cols,4),1fr)`, with the tablet rule reading
`var(--fs-cols-md,3)`. **Both fallbacks are exactly the old hardcoded
values**, so a site with nothing saved renders byte-identically.

- Set **inline on the section**, not via a class or `:root`. `product.ejs`
  uses `.product-grid` too; a global rule would have restyled that page.
- **Tablet is capped at the desktop count.** The 1100px breakpoint was a
  fixed 3, so choosing 2 for desktop would have shown *more* columns on a
  tablet. `--fs-cols-md` is `min(chosen,3)`.
- Phones stay at a hard 2 regardless.

---

## ⚠ The CSS rebuild command in `main.ejs` was destructive

`main.ejs` documented the rebuild as:

```
cat brand.css site.css site2.css > site-bundle.css
```

**Verified 6 Sept: that is wrong and would break public pages.**
`site-bundle.css` is those three **plus the first 8,039 bytes of
`site4.css`** — the public responsive polish for checkout, PDP chips and
nav touch targets. The remaining ~15KB of `site4.css` is admin-only and
loaded separately by `layouts/admin.ejs`.

Running the documented command silently strips 8KB from every public page.

Nothing was broken; the file on disk was correct. The comment is now
accurate, and `git_push_columns_control.sh` gate 3 fails if the bundle
ever loses those bytes.

**Prefer patching `site.css` and `site-bundle.css` with the same edit and
not concatenating at all.** That is what commit `90768da` did.

---

## Cleared, not outstanding

- **The 51 "mismatched widths"** flagged on 5 Sept were checked and are
  **all correct**. They are accessories where the number in the name is
  the vanity it fits, the projection, or a bracket size — never the item's
  own width. `REGEXP_SUBSTR` takes the first number in the string, which
  is what made them look wrong. Only `655-V36-BW` was a genuine error and
  it was fixed by hand. No action needed.
- **Featured Models brand filter** — was listed as open in
  `CARD_CHANGES_2026-09-05.md`. It is **not** open; `d507bea` shipped it.
  `featured_models.brand` is in the theme defaults and `getFeaturedModels`
  applies `sectionFilters` to both the curated and auto-ranked queries.
  That entry was stale.

---

## Known-open

- **Typo tolerance** — impossible with LIKE. Needs Typesense or similar.
  The `typesense` npm package is **not installed** and no API key is set,
  so `getTypesenseClient()` returns null and the MySQL paths are what run.
  Nothing blocks turning it on later. If you do: both Typesense paths
  hardcode `filter_by: 'in_stock:true'` while the MySQL paths have no
  stock filter, so a drop-ship catalogue could largely vanish from search
  on cutover. Resolve that first.
- **`/collections/vanity-models` ignores model pins.** It reads
  `model_groups` only for `default_sku`. Only James Martin carries demand
  data, so every other brand ties at 0 and sorts alphabetically
  underneath, with no lever to lift it.
- **Homepage curated models order by `sort_order` ascending**, so a model
  left at 0 outranks one set to 1 — the same trap fixed for products in
  `fee2c90`, still present here.
- Both of the above were built and **deliberately not shipped** on 6 Sept:
  a working site was preferred to another change. See "Deliberately not
  shipped" below.
- ~28 console vanities remain hidden from `/collections/bathroom-vanities`
  by the untyped-product filter. **Accepted** — they are findable by
  search, present in the sitemap, and their product pages render. Verified
  6 Sept.
- `package.json` has a **duplicate `axios` key** — both in `dependencies`,
  same version, so JSON silently keeps the last. Harmless, worth deleting.
- Untracked strays: `homeController-1.js`, `collectionsController-1.js`,
  `collection-1.ejs`, `index-1.ejs`, six `CLAUDE.md.bak*`,
  `git_push_bvo_cloudinary.sh.bak`.

---

## Deliberately not shipped

A fifth change — model pins on `/collections/vanity-models` plus the
0-means-unset fix for the homepage curated path — was written, gated and
then **reverted unshipped**. The site was working and the owner chose not
to risk it. The reasoning is recorded above under Known-open; the
implementation notes are in this file's history if it is ever revisited.

Worth knowing if you do revisit: the first draft joined `model_groups`
into the model query. That query is what the whole page depends on, and
the `default_sku` read three lines away is wrapped in try/catch precisely
because an absent table should degrade rather than 500. Do it as a
separate guarded read applied in JS — and note that only works while that
query has no `LIMIT`.

---

## Unwind guide

Commits are independent and revert cleanly in any order.

| to undo | revert | then |
|---|---|---|
| Columns control | `90768da` | CSS fallbacks equal the old values, so reverting the template alone is also safe. Bump `site-bundle.css?v=` |
| Pin to Position | `fee2c90` | leaves `sort_order` data intact but nothing reads it; the form field disappears |
| Colour weighting + admin Best match | `50d08ba` | search still works word-by-word; ranking returns to name-only |
| Word-by-word search | `455191f` | **restores the FULLTEXT bugs** — two-character sizes become invisible again. Delete `src/utils/searchQuery.js`; `50d08ba` must be reverted first |

**After any revert:**

1. If you revert `90768da`, bump the `site-bundle.css?v=` in `main.ejs` —
   `.htaccess` sets long cache headers on `/css`.
2. Do **not** rebuild the CSS bundle with a plain `cat`. See the warning
   above.
3. Every push script holds executing gates. If a revert trips one, read
   it — the gate is describing the bug being reintroduced.

Push scripts (local only; `.gitignore` line 16 is `git_push_*.sh`, so none
are tracked): `git_push_search_rewrite.sh`,
`git_push_color_weighted_search.sh`, `git_push_pin_position.sh`,
`git_push_columns_control.sh`.

---

## Mistakes made and corrected today

- **A gate that held its own copy of the weights.** It passed happily
  while the app's weights were wrong. Fixed by exporting `PRODUCT_SEARCH`
  and scoring against the real object. A gate that restates the answer
  tests nothing.
- **A test harness with the same param-ordering bug it was guarding
  against.** It ran one `.replace` per SQL operator, so every `LIKE`
  consumed its parameter before any `= ?` did, and exact matches scored 3
  instead of 103. The first ranking table produced was wrong.
- **Admin relevance shipped unreachable** — see §2. The fix relied on
  `req.query.sort` being absent; the form always sends it.
- **A gate too broad by one rule** — matched any
  `repeat(4,1fr);gap:24px`, tripping on `.value-bar`, which is unrelated
  and legitimately 4-up. Tightened to `.product-grid`, not loosened.
- **A push script that tried to `git add` itself.** `.gitignore` line 16
  ignores `git_push_*.sh`, so `git add` failed and `set -e` aborted before
  the commit. No other push script lists itself.
- **A stale open item repeated without checking** — the Featured Models
  brand filter, which had shipped a day earlier. Same failure as the 51
  widths: carrying a previous conclusion forward instead of re-verifying.
