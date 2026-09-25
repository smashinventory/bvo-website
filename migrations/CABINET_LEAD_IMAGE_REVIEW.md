# Cabinet-only lead images — scan results

Scanned 2026-09-24. Scope: all 289 James Martin cabinet-only SKUs
(`product_type IN ('Single Sink Cabinet Only','Double Sink Cabinet Only')`)
plus the ER Vanities rows appearing on `/collections/bathroom-vanity-cabinets`.

## Headline

**The product_type filter is holding.** Every card on the cabinets page is a
genuine cabinet-only product — confirmed down to the spec table (ER Bristol
29.5" reads `Sink Included: No`). `mgWhere` applies the type filter at
collectionsController.js:319-321 and it works, including under `?type=`.
Nothing is bleeding in. `8ba183c` did not regress.

The problem is **presentation**: vendor photography shows a countertop and
faucet fitted on products sold without one.

Confined to two JM model families. The other 261 JM cabinet SKUs are clean.

---

## 1. Myrrin (485) — SQL WRITTEN 2026-09-25, awaiting run

**Status:** `migrations/2026-09-25_myrrin_lead_images.sql` — run in phpMyAdmin,
then the next JM import (04:30) applies it. All 7 target images verified live
at 3000×3000, and each `match_suffix` verified to match exactly one image.


Lead image (`-1.webp`) shows a stone top + faucet. **Image `-2.webp` is a
clean bare-cabinet front shot on 7 of 8.** Apply via the existing
`product_image_overrides` mechanism (same path used for `503-V30-SC` /
`655-V36-PCN`; survives the nightly JM feed).

| SKU | Override to | Notes |
|---|---|---|
| `485-V36-CBO`   | `-2` | bare carbon oak |
| `485-V36-WLT`   | `-2` | bare walnut |
| `485-V48-M-CBO` | `-2` | bare |
| `485-V48-M-WLT` | `-2` | bare |
| `485-V60D-CBO`  | `-2` | bare |
| `485-V60D-M-WLT`| `-2` | bare |
| `485-V72-M-CBO` | `-2` | bare |
| `485-V72-M-WLT` | — | **no clean alternate** — `-2` is an interior cutaway. Ask JM. |

`485-V30-BW`, `485-V30-CBO`, `485-V30-WLT`, `485-V36-BW`, `485-V48-BW`,
`485-V60D-M-BW`, `485-V72-BW` are already correct — leave alone.

---

## 2. Lorelai (424) — NEEDS JAMES MARTIN

All 20 SKUs lead with the cabinet shot wearing a tan stone top + backsplash.
**Every `-2` is a rear/interior cutaway**, so there is no usable substitute in
the existing image set. Add to the JM request alongside the two missing front
shots already raised.

```
424-V36-BKO    424-V48-M-BKO   424-V60D-M-BKO  424-V72-M-BKO
424-V36-BW     424-V48-M-BW    424-V60D-M-BW   424-V72-M-BW
424-V36-LNO    424-V48-M-LNO   424-V60D-M-LNO  424-V72-M-LNO
424-V36-WLT    424-V48-M-WLT   424-V60D-WLT    424-V72-M-WLT
424-V36-WWO    424-V48-M-WWO   424-V60D-WWO    424-V72-M-WWO
```

---

## 3. ER Vanities — SEPARATE DECISION, higher commercial risk

Five models on the cabinets page. Correctly typed cabinet-only, but **titled
"Bathroom Vanity"** and photographed with a top and faucet fitted. `Sink
Included: No` is buried in the spec table.

| SKU | Title on site | Price | Image issue |
|---|---|---|---|
| `Bristol-29.5-NWA-BG`    | Bristol 29.5" Bathroom Vanity in Natural White Ash | $1,049.99 | top + faucet |
| `KENSINGTON-29.5L-WH-BN` | Kensington 30" | — | top fitted |
| `LONDON-29-WH-BN`        | London 30"     | — | **full room scene** |
| `OXFORD-29.5-BLK-BG`     | Oxford 30"     | — | styled |
| `WINDSOR-29.5-WH-BN`     | Windsor 30"    | — | **full room scene** |

A product titled "Bathroom Vanity", pictured with a countertop and faucet,
that ships as a bare cabinet is a chargeback/dispute risk independent of the
image question. Decide whether these get **renamed** (→ "Cabinet"), **re-shot**,
or both.

Also seen on the cabinets page and not yet confirmed either way:
**De Soto**, **Palisades**, **Brittany** — their card leads showed a top, but
they did not fall out of the filename diff. Worth a second look.

---

## Method

- Cabinet SKU list pulled from the bundle-builder payload, which is
  hard-filtered to the two cabinet-only types.
- Rendered all 289 lead images as contact sheets and reviewed visually.
- For every flagged SKU, rendered `-1` beside `-2` to test whether a clean
  alternate exists.
- ER rows identified by image filename (`bathroom-vanity-…-pr####` vs the
  JM importer's `bathroom-cabinet-…`), then confirmed against the live
  product page spec table.

## Verified 2026-09-25

The 2026-09-24 overrides fired correctly through the overnight import —
`503-V30-SC` and `655-V36-PCN` now lead with `-2.webp` live. The mechanism
works end to end: DB row → nightly import → catalogue rebuild → card.

Both of those `-2` shots have the doors open. That is best-available, not a
mistake: neither SKU has a closed-front photo anywhere in its set (image 1 is
overhead, 3 is the back panel, 4–6 are detail crops). They remain the two
already raised with James Martin.

Also corrected: `655-V36-PCN` is **Brittany**, not Palisades — the note in
the 2026-09-24 migration was wrong and is fixed by the 2026-09-25 file.

## Corrections to earlier calls in-session

- Myrrin was first reported as a filter failure. It is not — the SKUs are
  correctly typed and correctly priced. Photography only.
- `485-V36-CBO` was briefly described as having no clean alternate. It does:
  image `-2`.
- Allamari and Marcello are **not** defects — those ship with a separate
  wall-mounted shelf. Do not re-flag.
