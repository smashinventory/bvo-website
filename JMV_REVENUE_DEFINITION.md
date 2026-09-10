# JMV MAP Revenue — Definition of Record

**Status:** approved 2026-09-10, amended twice before build · **Supersedes:**
the "conservative floor" methodology block in `jmvReportsController.js`

Amendments, both pre-ship: (1) combo rule moved from a `product_type` list to
`top_finish`, catching 76 assembled Countertop / Storage / Drawer SKUs;
(2) `top_finish` alone was too broad — it deleted 245 units of backsplash
demand — so the rule now requires *both* a `top_finish` and membership of the
assembled-type list. The second was caught by gate G14, not by review.

This document defines *what the number means*. It is the artifact of record for
the revenue figure. If code and this document ever disagree, this document is
right and the code is a bug.

---

## 1. The definition

> **MAP Revenue** = for each individual (non-combo) SKU, on each day it was
> observed to deplete, that SKU's depletion × that SKU's MAP price on that day,
> summed across all SKUs and all days in the window.

No grouping. No cross-SKU subtraction. No inference about what was "really"
sold. One SKU, one quantity, one price, multiplied and summed.

**Units Depleted** uses the same population and quantity, without the price —
so it counts *physical items that left the warehouse*.

---

## 2. Population — which SKUs count

### Included
Every SKU in `jmv_dimensions` that is an **individual product**.

### Excluded

| Exclusion | Rule | Count |
|---|---|---|
| **Combos** | `top_finish` present **AND** `product_type` in the assembled list | ~4,292 |
| **Samples** | `product_type LIKE 'Sample - %'` | 69 |

### The combo rule — two conditions, both load-bearing

> A SKU **includes a top**, and is therefore a combo, when it carries a
> `top_finish` **and** its `product_type` is one that ships in assembled form:
> **Vanity, Console, Countertop Unit, Storage Cabinet, Drawer Unit**.

**Corrected 2026-09-10, caught by gate G14 before shipping.** The rule as first
written was `top_finish IS NOT NULL AND product_type <> 'Top'` — top_finish
alone, with Tops carved out. That silently deleted **245 units of backsplash
demand**: a backsplash carries a `top_finish` because it is *cut from* that
stone, not because it contains a top. Same for Floating Console. Nothing on the
page would have shown it; the number would simply have been smaller.

Both conditions are needed:

- **Without the type list**, solid stone pieces vanish — 203 Tops, 15
  Backsplashes, 15 Floating Consoles.
- **Without `top_finish`**, the type list is useless — Countertop Unit, Storage
  Cabinet and Drawer Unit each ship *both* ways (`825-CU30-BW` plain,
  `825-CU30-BW-3CAR` with a Carrara top), and only `top_finish` separates them.

The test for membership in the assembled list is whether the type has SKUs that
are *another catalogue SKU plus a suffix*. Vanity, Countertop Unit, Storage
Cabinet, Drawer Unit and Console all do. Backsplash, Top and Floating Console
have **zero** — they merely share a stone name.

**First amendment, 2026-09-10, before build.** The rule originally signed off
was `product_type IN ('Vanity','Console')`. Cross-tabulating every type by "is
this SKU another catalogue SKU plus a suffix" against "does it carry a
top_finish" showed that rule misses 76 combos:

| type | assembled (has top_finish) | plain (no top_finish) |
|---|---|---|
| Vanity | 4,199 | 13 |
| Console | 17 | 0 |
| Countertop Unit | **28** | 4 |
| Storage Cabinet | **28** | 11 |
| Drawer Unit | **20** | 7 |
| Cabinet | 0 | 332 |
| Top | 203 — *solid stone, counts* | 0 |
| Backsplash | 15 — *solid stone, counts* | 40 |
| Floating Console | 15 — *not derived, counts* | 6 |
| Mirror · Metal Base | 0 | 149 |

Countertop Unit, Storage Cabinet and Drawer Unit each ship in both forms —
`825-CU30-BW` plain, `825-CU30-BW-3CAR` with a Carrara top. Under the
type-only rule those 76 assembled SKUs would inflate revenue exactly the way
Vanity does today.

Floating Console looked like a fourth such type and is not: its 15 top_finish
SKUs are not derived from any base SKU. They are solid pieces sharing a stone
name, and they count. That distinction is what the second amendment above is
about.

Reading `top_finish` also means reading JM's own feed column rather than
depending on our importer's type mapping — which is what mis-typed the 13 SKUs
below.

### Resolved for free: the 13 mis-typed SKUs

These are typed `Vanity` by the importer but are **cabinets** — every name says
"Single Cabinet", and the trailing token is a *hardware* finish (BNK = brushed
nickel, CB = champagne bronze, MBK = matte black), not a stone top code:

```
533-V20-GW-BNK   533-V20-GW-CB   533-V20-GW-MBK
533-V20-WLW-BNK  533-V20-WLW-CB  533-V20-WLW-MBK
533-V24-GW-BNK   533-V24-GW-CB   533-V24-GW-MBK
533-V24-WLW-BNK  533-V24-WLW-CB  533-V24-WLW-MBK
805-V31.5-WLT-CB
```

They are exactly the 13 Vanity-typed SKUs with **no** `top_finish`, so the rule
includes them as individual products for the right reason. **No allow-list is
needed** — do not add one. The importer misclassification is still worth fixing
at source (§7), since these are also mis-typed on the storefront.

### Rejected discriminators — do not reintroduce

- **`component_role`** — a BVO-side variant-grouping field, not a JM combo flag.
  It tags plain tops (`040-S72-CAR-SNK`) and hardware-finish cabinets
  (`883-V31.5-AG-BN`) as `Group`. Misclassifies ~260 SKUs.
- **`vanity_type`** — Vanity and Cabinet both carry `Freestanding` / `Floating`.
  Carries no combo information at all.
- **`product_type` alone** — misses the 76 assembled Countertop / Storage /
  Drawer SKUs, which ship in both forms.
- **`top_finish` alone** — deletes Backsplashes, Tops and Floating Consoles,
  which carry a stone finish without containing a top. This shipped as far as
  the gate suite and was caught by G14.
- **SKU string structure** — `983-V36-GW-BN` is a base plus a suffix but the
  suffix is hardware, not a top. Structure alone cannot tell the two apart;
  `top_finish` can.

### Scope toggle

- **"Vanities & Tops"** — `product_type IN ('Cabinet','Top')`
- **"All types"** — every type except samples

Both apply the combo rule, so under "All types" a Storage Cabinet counts but a
Storage Cabinet *with a top* does not. The current label "Vanity / Cabinet /
Top" is wrong under this definition — Vanity is no longer in it.

---

## 3. Quantity

`jmv_daily_movement.demand_min`, rows where `is_valid = 1`.

Unchanged, and deliberately so: the ingest is sound. Every defect being
corrected here lives in the reporting layer above it.

---

## 4. Price — resolved per SKU, per day

Precedence, first match wins:

1. **MAP** from that day's snapshot — `jmv_snapshots.map_price` where
   `snapshot_date = movement_date`
2. **MSRP × 0.66** from that day's snapshot — *requires the new `msrp` column,
   §6. Populated from the date that ships forward.*
3. **MSRP × 0.66** from `products.compare_price` — current value, applied
   retroactively. Covers existing history.
4. **Excluded from both revenue and units** — the SKU is unpriceable, and
   counting it in one but not the other makes the two disagree silently.

The 0.66 factor is JM's own, derived at import from 4,761 products carrying both
values (range 65.85–67.85%). Defined once in `importJamesMartinFeed.js` — this
report must reference that constant, not restate it.

### Two changes from current behaviour

**Per-day pricing.** Today every row is priced from the *latest* snapshot, so a
MAP change is applied retroactively across the entire window. `jmv_snapshots` is
keyed `(snapshot_date, sku)` and already holds a full daily price history, so
this needs no new data.

**No more silent $0.** Today a SKU with no MAP contributes units at $0 via
`COALESCE(...,0)` — it inflates Units Depleted while adding nothing to revenue,
with nothing on screen saying so. Rule 4 replaces that, and the count of
excluded SKUs is surfaced on the page rather than swallowed.

---

## 5. What this replaces, and why

The current figure is built from `combo_u` — the Vanity SKU's own drawdown —
priced at combo MAP, with cabinet and top counted only for their excess above it,
pivoted to `MAX` per `(group_number, movement_date)`.

Three independent defects:

**The input is not a sale.** A combo SKU's quantity is `min(base, top)` — a
computed availability figure. `E444-V72-GW-3WZ` recorded 72 units of "demand"
across six observations while its base `E444-V72-GW` sat at **158, unmoved, every
single day**. From 08-29 its quantity is *identical* to the top's (20, 65, 124).
On 08-29 the Zeus White top fell 82→20 and every 72" combo with base stock above
20 was clamped to 20 — one top drawdown of 62 units manufactured **482 units** of
phantom combo demand across 51 SKUs. It cannot be argued the other way: if
combos held their own stock their quantity would not track the top; if combos
consumed bases the base would not sit flat.

**The grouping key groups the wrong thing.** `group_number` is JM's *series*
code — the leading SKU token, in 4,945 of 4,967 non-null rows. Group `157` holds
309 SKUs spanning 7 sizes, 4 base finishes and 13 top finishes, collapsed by
`MAX` to one number per day. Meanwhile **zero of 71 groups contain both a Cabinet
and a Top** — so `GREATEST(0, top_u - combo_u)` never fires, and the dedup's
whole premise is unreachable. 251 SKUs (including 142 of 203 tops) have a null
`group_number` and fold into a single bucket.

**Corroboration is absent.** Every real combo sale consumes a cabinet. On
08-29 Vanity showed 17,061 units against Cabinet's 120 — a 142:1 ratio.

Measured over the six real observation days at 9/8 MAP prices, the current
method reports **$8,957,392** against **$5,495,606** on the corrected basis —
**39% inflation**. Less than the unit ratios imply, because the series-wide `MAX`
was accidentally suppressing genuine cabinet and top movement in the other
direction.

---

## 6. Accepted consequences

**A combo order is valued at the sum of its parts.** It ships one cabinet and one
top, so it lands in both sums at cabinet MAP + top MAP. Bundle MAP is typically
5–10% lower. This is a known, bounded overstatement in a known direction —
unlike the 39% it replaces. Correcting it would require inferring which
cabinet + top pairs were a combo, which is the exact guesswork being removed.

**Units count physical items, not orders.** That combo order is 2 units. The
card must say so.

**This page is James Martin only.** All 78 ER Vanities products (plus 1
Huntington Brass faucet) are absent from `jmv_dimensions` and can never appear
here. Not a defect — the JM feed covers JM products. The page title should say
it.

### Combo-only models are unmeasurable, and read as zero

Five combo SKUs sit in a `group_number` containing no plain base of any type —
no cabinet, no console base, nothing. They are sold only as an assembled unit:

```
388-V72S-GW-BN-DGG   388-V72S-GW-RG-DGG    Columbia       (Dusk Grey Glossy)
389-V72S-GW-A-DGG    389-V72S-GW-G-DGG     Mercer Island  (Dusk Grey Glossy)
D300-V36-RSO-CAR                            Bellamy        (Carrara White)
```

Excluding combos means these five models contribute **nothing** to revenue.

**Counting them would be worse, not better.** Each one's top exists as a
separate SKU in the feed — Dusk Grey Glossy has 1 Top SKU, Carrara White has 12
— so these combos are still `min(base, top)` and still get clamped when their
top depletes. Including them would recover phantom demand by the E444 mechanism
on the one kind of model where there is no cabinet to cross-check against.

So this is not a choice to omit them. **There is no un-derived signal for these
five**, and reading them as zero is more accurate than reading a clamp as a
sale.

Current exposure is nil: all five have movement rows on every observation day
and **total demand of 0** across the whole window. Stock sits at 2, 2, 2, 2 and
7. Gate **G14** fails the build if any of them ever registers demand, so the day
one actually sells this gets revisited instead of silently reading $0. It
earned its place immediately: its first run failed on five *backsplashes*,
which is how the top_finish-only rule above was caught.

---

## 7. Work this defines — but does not authorise

Nothing here is built. Listed so the boundary is explicit.

**In scope for step 1** — `/admin/marketing/jmv/financials` revenue basis:
replace the pivot; per-day pricing; price-fallback chain; population rules;
retire "Combo (Vanity) Revenue" and "Individual SKU Revenue" (both read
`combo_u`, which ceases to exist); relabel the scope toggle.

**Prerequisite migration:** add `msrp DECIMAL(10,2) NULL` to `jmv_snapshots`,
and populate it in `jmvMovementRollup.js` from the feed's MSRP column. Without
it, rule 4.2 can never engage and history never improves.

**Deferred, explicitly not step 1**
- Step 2 — the Demand Reports page and its leaderboards
- Step 3 — `demand_score` and storefront popularity sorting, which today ranks
  4,212 vanity products on phantom combo movement
- Importer fix for the 13 mis-typed SKUs (they are also mis-typed on the
  storefront)
- The 251 null-`group_number` SKUs — only affects grouped tables
- Top 10 Group table: `MAX` → `SUM` per series, or switch to per-SKU. Undecided.

---

## Sign-off

| | |
|---|---|
| Definition approved | ☐ |
| Approved by | |
| Date | |

Once signed, this file is the reference for the step 1 build and for the gates
that verify it.
