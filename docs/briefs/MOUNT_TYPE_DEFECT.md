# mount_type is wrong in the catalog — logged, not fixed

**2026-10-05.** Found while deciding the format of
`/inspiration/floating-bathroom-vanity-ideas`. Parked at the owner's
instruction ("not a core issue, use best effort and move on"). Nothing in
`src/` was changed. This file exists so the finding is not lost.

## The correction that started it

Owner, 2026-10-05:

> Some vanities have both a wall hung and floor standing option. So they can
> be in both. Whereas some like the marecello and the allamari are only wall
> mounted/floating.

And: **floating = wall hung = wall mounted.** One product, three names. I had
been treating these as distinct and treating mount_type as single-valued.

## Proven, not inferred

| Model | mount_type tagged | SKUs | Truth |
|---|---|---|---|
| Allamari | `Floor Standing` | 60 | wall-mount only |
| Marcello | `Floor Standing` | 52 | wall-mount only |

112 SKUs carry a value that is not merely incomplete — it is the opposite of
correct.

Structural check: `mount_type` has **4,784 rows across 4,784 active products —
exactly one each.** No product carries two. For comparison, `style`, which *is*
multi-value, has 6,312 rows across 4,854 products.

Blast radius: **588 SKUs across 11 distinct models** mention floating,
wall-hung or wall-mounted in `long_desc`/`short_desc`, and **every one of them
is tagged `Floor Standing`**. Zero products in the entire catalog hold
`'Wall Mounted'`.

## Three stacked defects

`src/jobs/importJamesMartinFeed.js:1216-1228`:

```js
if (/wall/i.test(vtLower) || /wall/i.test(ptLower))  mountType = 'Wall Mounted';
else if (/pedestal|console/i.test(...))              mountType = 'Pedestal';
else                                                 mountType = 'Floor Standing';
await replaceAttr(conn, productId, 'mount_type', mountType, null);
```

1. **Single value, multi-value reality.** `replaceAttr` writes one row, and an
   if/else can only pick one branch. A vanity offered both ways keeps whichever
   fires first and silently loses the other option.

   The correct pattern already exists *in this same file*: `insertStyleAttrs()`
   inserts one EAV row per bucket. `mount_type` doesn't use it.

2. **The regex only tests `/wall/`.** "Floating" is the same product and
   matches nothing, so a wall-only model described that way fails every branch
   and lands in the `else` as `Floor Standing`.

3. **`'Wall Mounted'` is in the canonical set with zero rows.** A symptom of 1
   and 2, not a separate fault — and the reason this went unnoticed: the value
   exists in the code, so grepping for it suggests the feature works.

## Why it matters beyond the article

`mount_type` is in `adminController.js:832`'s attribute list and is read by the
collection sidebar filters, not only the guide showcase. A customer filtering
for a floating vanity currently gets none of the 112 that exist; a customer
filtering for floor-standing gets 112 that aren't.

## What was done instead

The floating guide does **not** need this fixed to ship. Allamari and Marcello
are the floating inventory, and the article body hard-codes its own `<img>`
tags and product links, so those two models are hand-picked by name in the
content. No code path depends on the attribute being right.

## If this is ever picked up

The fix is not a wider regex. It is `mount_type` becoming multi-value via the
`insertStyleAttrs()` pattern, with the derivation testing for floating/hung/
suspended as well as wall, and emitting a row per option the model offers. That
is importer + product-data work, which is why it is logged here rather than
attempted.
