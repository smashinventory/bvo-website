# Clean-path filters — how to unwind this

> Written before the feature shipped, at Sam's instruction 2026-10-03:
> *"Make all the notes to make this unwindable if we find that it breaks our
> stable situation."*
>
> Read the **Panic button** section first. Everything after it is detail.

---

## PANIC BUTTON

```
src/routes/collections.js
```

Comment out this one line:

```js
router.use(require('../middleware/pathToFilter'));
```

Restart the app. That is the entire rollback for stage 1.

**What then happens:** clean paths stop resolving and fall through to
`/collections/:slug`, which 404s them as it would any unknown slug. Every
`?style=`, `?color_family=`, `?size_in=`, `?model=` URL keeps working exactly
as it does today, because **none of them were ever changed** — the parameter
handling was never removed, only given a second front door.

**What does NOT need undoing:** filtering, product data, taxonomy,
`product_type`, colour families, the bundle builder, the importer. None were
touched. See *The boundary* below for how that is enforced rather than
promised.

---

## Why the risk is low, stated honestly

This feature is **additive**. The existing request path is:

```
GET /collections/bathroom-vanities?style=Traditional
    → router '/:slug'  →  collectionsController.show  →  filter SQL
```

After this change that path is **byte-for-byte unchanged**. What was added is
a second entrance:

```
GET /collections/bathroom-vanities/style/traditional
    → pathToFilter rewrites req.url + req.query
    → router '/:slug'  →  collectionsController.show  →  filter SQL
                           ^^^^^^^^^^^^^^^^^^^^^^^^^ identical, unmodified
```

The middleware's only effect is to mutate `req.url` and `req.query`. By the
time the controller runs, a clean path and a parameter URL are
indistinguishable.

A path that does not resolve is **left alone** — the middleware calls
`next()` without touching the request. So the worst case for an unrecognised
clean path is the 404 the site already gives unknown slugs, not an error.

---

## The boundary, and how it is enforced

The instruction was: remove the dynamic parameters, change nothing to do with
filtering or product data. Those sound contradictory, since a clean URL has to
end up applying a filter. They are reconciled by putting the translation
entirely *in front of* the existing code.

**Not touched, and asserted by `gates/gate_path_filters.js`:**

| | |
|---|---|
| `src/controllers/collectionsController.js` | hashed; gate fails if it changes |
| `src/controllers/bundleController.js` | hashed |
| `src/config/colorFamilies.js` | hashed |
| `src/jobs/importJamesMartinFeed.js` | hashed |
| `src/middleware/megaMenuData.js` | hashed |
| `src/config/filterLandingPages.js` | hashed |

The gate stores a hash of each and fails if any changes, **whatever the
reason**. If a later edit to one of those is legitimate, the gate has to be
updated deliberately, with the hash change visible in the diff. That is the
point: it makes "I didn't touch filtering" checkable rather than a claim.

`src/config/pathFilters.js` is a lookup table and contains no logic. Every
value in it is copied from the files above and cross-checked by the gate, so
the two cannot drift apart silently.

---

## Rollback by stage

Stages ship separately so each can be reverted alone.

### Stage 1 — the translator (this commit)

| | |
|---|---|
| New files | `src/config/pathFilters.js`, `src/middleware/pathToFilter.js`, the gate, the mutation harness |
| Existing files changed | `src/routes/collections.js` — **one line** |
| Visitor-visible change | none. No link points at a clean path yet. |
| Rollback | comment out the one line, **or** `git revert <sha>` |
| Data changes | none |
| Risk | Very low. Dead code until a link uses it. |

Clean paths resolve from the moment this ships, but nothing links to them, so
no visitor and no crawler reaches one.

### Stage 2 — repointing the links

| | |
|---|---|
| Files | `views/pages/index.ejs`, `views/pages/collection.ejs`, `views/pages/lookbook.ejs`, `views/partials/header.ejs` |
| Change | `href` strings only. No filter logic, no template structure. |
| Rollback | `git revert <sha>`. Links return to `?param=` form, which never stopped working. |
| Risk | Low, and **visible**: a broken link is obvious on the page. |

**The specific thing to check after stage 2:** click a mega-menu size chip, a
mega-menu finish link, a homepage model card and a lookbook card. Each must
land on a page showing *filtered* products. A page that loads with the
**unfiltered** grid is the failure mode to watch for — it looks like a working
page, which is why it is called out here. That is `req.query` not being set,
and it means `pathToFilter` resolved the path but the rewrite did not take.

### Stage 3 — the 301s

| | |
|---|---|
| Change | old `?param=` URLs 301 to the clean path |
| Rollback | `git revert <sha>`. Both forms serve 200 again. |
| Risk | **The highest of the three, and the least reversible in practice.** |

A 301 is cached by browsers and treated as permanent by search engines.
Reverting the code restores the old URL to 200, but browsers that cached the
redirect keep following it until the cache expires, and Google takes time to
re-crawl.

**Therefore: do not ship stage 3 until stage 2 has been live and verified.**
If stages 2 and 3 ship together and the links are wrong, the 301s point at
broken paths and the parameter URLs no longer answer.

### Stage 4 — the sitemap

Task #309. Must come after stage 3, or the sitemap advertises URLs that
redirect. Rollback is regenerating and resubmitting the previous sitemap.

---

## Failure modes, and what each one looks like

| Symptom | Cause | Fix |
|---|---|---|
| Clean path 404s | slug not in `pathFilters.js`, or the facet is not allowed on that collection | add the pair, or correct the `collections` list |
| Clean path loads the **unfiltered** grid | `req.query` was not set by the rewrite | the real bug; revert stage 1's one line |
| Clean path shows wrong products | the `value` in `pathFilters.js` does not match what the controller expects | correct the value; the gate should have caught it |
| Model path 404s | `src/config/modelSlugs.json` missing or stale | run `node scripts/dumpModelSlugs.js` |
| Both Bristols show the same products | the brand segment is being dropped | revert stage 1's one line |
| A collection page broke that has nothing to do with filters | middleware threw | it cannot — it is wrapped in try/catch and falls through — but revert the one line to confirm |
| 500 on any collection page | not this feature's shape, but revert the one line first to rule it out | |

The second row is the one worth memorising. **A silently unfiltered page is
the dangerous failure here**, because nothing errors and nothing logs. It is
why `pathToFilter` sets `req.query` explicitly, why that is commented at
length in the file, and why the gate asserts it.

---

## What is deliberately NOT converted

**Brand stays a parameter.** `themeSettings.js` stores brand links as
`?brand=james-martin`, while the live crawl shows
`?brand=James%20Martin%20Vanities`. `products.brand` holds the second form, so
some stored brand links may already be serving unfiltered pages — a
pre-existing bug, independently on the open-items list.

Converting a broken URL to a clean path would hide the bug behind a redirect
and make it harder to find. Brand is left alone until the mismatch is checked
against the live database. **Sam agreed this as an explicit follow-up
validation**, 2026-10-03.

**Model URL shape — brand first, two segments.**
`/collections/vanity-models/james-martin-vanities/bristol`. Sam, 2026-10-03:
*"we currently segregate them by having Brand/model."* An earlier draft
joined them into one segment (`bristol-james-martin-vanities`); separate
segments also removed a real ambiguity, since a hyphen-join is not injective
— `('A B','C')` and `('A','B C')` both produced `a-b-c`.

**Multi-facet combinations stay parameters.** One facet in the path, the rest
as query string. `/style/coastal/finish/white/size/36-inch` is combinatorial
and crawlers would try every permutation. This is a deliberate limit, not an
omission.

**Theme Editor links cannot be fixed in code.** The 9 style links, 2 sink-type
links and the faucets `product_type` link live in `themeSettings.js` as
*defaults*, and the live values are in the settings file, which wins over
defaults. Editing the code there changes nothing on the live site. Those have
to be re-entered in the Theme Editor or updated by a one-time settings write,
and that is tracked separately.

---

## Verifying it works, before trusting it

With the app running, no database needed for the first two:

```bash
# the map is internally consistent and matches the filter configs
node gates/gate_path_filters.js

# every mutation of the rule is caught
bash tools/mutate_path_filters_gate.sh
```

Then live, on each of these, confirm the grid is **filtered**:

```
/collections/bathroom-vanities/style/traditional
/collections/bathroom-vanities/finish/dark-wood
/collections/bathroom-vanities/size/60-inch
/collections/bathroom-vanities-with-tops/sink/double
/collections/bathroom-vanities/on-sale
/collections/faucets/product-type/bathroom-faucets
/collections/vanity-models/james-martin-vanities/brittany
/collections/vanity-models/er-vanities/bristol
/collections/vanity-models/james-martin-vanities/bristol
```

The last two are the test that matters: **Bristol exists under both brands**,
so those two URLs must show different products. If they show the same grid,
the brand segment is not reaching the filter.

And confirm these still work, unchanged:

```
/collections/bathroom-vanities?style=Traditional
/collections/bathroom-vanities?color_family=wood_d
/collections/bathroom-vanities
/collections/bathroom-vanities-with-tops
/bundle-builder
```

The last two matter most. If `/collections/bathroom-vanities` or the bundle
builder is affected by any of this, something is wrong that the design says
is impossible, and stage 1's one line comes out immediately.
