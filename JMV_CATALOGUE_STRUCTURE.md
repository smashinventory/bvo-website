# JMV Catalogue Structure — How James Martin's Data Actually Works

**Status:** findings of record · **Scrub run:** 2026-09-10 · window 2026-08-01 → 2026-09-09
**Reproduce:** `python3 scripts/jmv_scrub.py <sqlite-db>` (build the db with `scripts/jmv_load_dump.py`)

> **Read this before touching combo demand, popularity sorting, the warranty
> adjustment, or the bundle builder.** Every claim below is a measurement, not
> a recollection. Several of them contradict what earlier work assumed, and
> the contradictions are recorded on purpose — the wrong turns are as valuable
> as the right answers, because each one looked plausible.

---

## 0. The one thing to know

**`product_components` already holds the exact combo → top edge for 4,198 of
the 4,199 JM combos.** It arrived with the vendor feed. Nothing in the
application reads it.

Every inference mechanism built before this was discovered — the
`(top_finish, top_material, size_nominal, sinks)` join, the top-family fold,
the RC-collection rule, the Linear-composite rule — exists solely to guess a
fact the database already stores. They can all go.

```
SELECT parent_sku, component_sku FROM product_components WHERE component_role='top';
-- 4,465 rows · 4,519 parents · 194 distinct components
-- roles present: top 4465, sink 4141, component 297, bridge 30, linen 7
--   (no 'cabinet' role — the base is still resolved by attribute, see §4)
```

---

## 1. SKU grammar

### 1.1 Combo SKUs — `<group>-<size/type>-<basefinish>-<topcode>`

```
157   - V30   - BW          - 3WZ
│       │       │             └── top code: leading digit + finish
│       │       └── base finish (Bright White)
│       └── V = vanity, 30 = nominal width
└── group_number = JM's SERIES code (leading token in 4,945 of 4,967 non-null rows)
```

### 1.2 The leading digit of the top code is FAUCET HOLES — not thickness

This was got wrong once and it matters.

| code | meaning | `faucet_spread_in` |
|---|---|---|
| `-3xx` | three-hole | **8"** on 2,813 of 2,849 |
| `-1xx` | single-hole | **null on all 253** |

The trap: product names say *"w/ 3 CM White Zeus Silestone Top"*. The `3 CM` is
slab thickness and it collides visually with the `3` in `3WZ`. Reading the
marketing copy gives you the wrong answer with total confidence. The
`faucet_spread_in` attribute settles it — a single-hole top has no spread to
record, which is why the 253 are null rather than zero.

Confirmed on the individual tops too:

```
050-S30-WZ-SNK    "30" Single Top, 3 CM White Zeus Silestone w/ Sink"           spread 8"
051-S30-BS-WZ     "30" Single Top, Single-Hole, ... w/ Backsplash"              spread null
```

**36 `-3xx` combos have no spread value**, and they are not random: 12 each
from `D125` (Gracyn), `D640` (Allamari), `D704` (Lucian). A clean split by
collection reads as an import gap on three collections, not as a real
single-hole product. Worth chasing with JM.

### 1.3 Single-hole and backsplash are the SAME choice

All 253 `-1xx` combos are single-hole **and** carry a backsplash. There is no
single-hole-without-backsplash and no three-hole-with-backsplash anywhere in
the catalogue. The `051` top family is literally *"Single Top, Single-Hole,
3 CM White Zeus Silestone w/ Backsplash"* — six SKUs, all White Zeus, which is
why this only ever surfaces on White Zeus pairs.

Price consequence, measured across all 253 pairs: the single-hole/backsplash
version costs **+$104 mean, +$101 median, range −$5 to +$300**. That is the
backsplash, not a drilling premium — standalone 30" backsplashes run $109–149.

> ⚠ **32 pairs are priced backwards** — the backsplash version is $4–5
> *cheaper*. All 60" (`157-V60S`, `330-V60S`, …). Looks like a feed or pricing
> error; not yet investigated.

**These are not duplicate listings.** A proposal to collapse them on collection
pages was withdrawn for exactly this reason: they differ in two attributes and
a three-figure price. Whatever we do on the storefront must keep both buyable.

### 1.4 Component SKUs are abbreviated in `product_components`

The feed drops tokens. Three transforms resolve all 194, and each is a shape
difference rather than a guess:

| rule | count | example |
|---|---|---|
| exact | 41 | `050-S48-FP-TJR` |
| `+ -SNK` | 146 | `050-S30-EJP` → `050-S30-EJP-SNK` |
| `+ BS` token | 6 | `051-S36-WZ` → `051-S36-BS-WZ` |
| `S46` → `S46R` | 1 | `090-S46-CAR` → `090-S46R-CAR-SNK` |

`scripts/jmv_scrub.py` asserts the unresolved count is zero. **Anything needing
a fourth transform must be reported, never guessed.**

---

## 2. Depth — the physical fit constraint

`depth_in` lives in `product_attribute_values`, **not** on `products`
(`products.depth_in` is NULL for all 5,218 JM rows). That is why it went
unnoticed for so long. `product_attribute_values` carries **47 distinct
attr_keys**, most of them unused by the app — it is the richest unexploited
source in the database.

### 2.1 There are exactly two stone-top depth classes

| bracket | cabinets | tops | top : cabinet |
|---|---|---|---|
| < 21" (excluded — mostly composite) | 43 SKUs / 65 u | 39 SKUs / 66 u | 1.0× |
| **A — 21.00–22.00"** | 19 SKUs / 38 u | 23 SKUs / 269 u | **7.1×** |
| **B — 22.01"+** | 270 SKUs / 762 u | 173 SKUs / 2,431 u | 3.2× |

Bracket A holds **22 `060` RC tops plus one `410`** and nothing else.
Bracket B holds everything else. The excluded pool is 24 Composite Top,
8 Stone Top, 7 Countertop Unit and balances at 1.0×, so dropping it costs
nothing.

### 2.2 Only three collections are shallow

| collection | prefix | cabinet depth |
|---|---|---|
| Gracyn | D125 | 21.38" |
| Lucian | D704 | 21.38" |
| Allamari | D640 | 21.50" |

Next shallower is 19.63", next deeper 22.5". **Kinnsden (D680) is 23.13"** — a
deep cabinet that cannot physically take a 21.5" top.

### 2.3 RC is ALWAYS 21.5" — the five exceptions are a catalogue defect

**Invariant: if a SKU is RC (`060` prefix), its depth is 21.5". Any other
value is wrong.** *(Established 2026-09-11.)*

RC is a closed set: 27 SKUs, all `060`, all named "Radius Cut". No RC token
appears outside `060` and no `060` lacks one. 22 read 21.5"; **five read 23.5"
and all five are Siberian Serena (SFR)**:

```
060-S36RCWS-SFR-SNK   060-S48RCWS-SFR-SNK   060-S48RCWS-FP-SFR-SNK
060-S72RCWS-SFR-SNK   060-S72RCWS-FP-SFR-SNK
```

Three independent proofs that 21.5" is correct:

1. **The spec sheet.** The 36" `060` widespread drawing reads **21 1/2"
   [546mm]**, and it is the SFR sheet — verified by fetching the PDF from the
   URL in `product_documents`.
2. **Shared drawings.** JM publishes one spec sheet per size + configuration,
   shared across finishes. Each SFR SKU shares its drawing with a VSL or WZ
   SKU already recorded at 21.5". One drawing cannot document two depths.
3. **Physical fit.** RC tops are only ever paired with Gracyn, Allamari and
   Lucian — cabinets at 21.38–21.5". A 23.5" RC top would overhang by more
   than two inches and has nothing to sit on.

> **An earlier version of this document said the opposite** — that the five
> SFR RC tops "pair with deep cabinets — Bristol at 22.9", Myrrin at 23.5"".
> That was wrong. Those `-3SFR` combos resolve via `product_components` to
> **`050-S36-SFR-SNK`, a plain top**, not an RC one. The inferred join matched
> them to `060` only because its key could not separate `050-SFR` from
> `060-SFR`.

The defect propagates to combos. **51 SKUs carry a wrong 23.5":**

| | count | cause |
|---|---|---|
| RC tops | 5 | source error |
| Gracyn/Allamari/Lucian `*SFR` combos | 30 | inherited from the tops above |
| **Gracyn `WPHT`/`WTJR`/`FTJR` combos** | **16** | **independent** — their tops are correctly 21.5" |

The 16 are a second, separate defect confined to D125. The matching Allamari
and Lucian combos on the *same tops* are correct. Fixing the tops will not fix
these.

**Depth is unreliable generally.** It appears to be inherited per finish
rather than measured per part: within `060`, depth varies only by finish token
(PHT/TJR/VSL/WZ = 21.5, SFR = 23.5), and SFR reads 23.5 everywhere it appears
across the `040`, `050` and `060` families. So the 21.5" on the other 22 RC
tops may be equally inherited — it just happens to be right. **Do not gate
pairing on `depth_in`; use the `product_components` edge list.** Depth is a
cross-check, not a source of truth.

### 2.3a Carry-forward — what this obliges the rebuild to do

*Two requirements recorded 2026-09-11, to be honoured when the Top Combo SKUs
— Estimated Demand mapping is rebuilt and when the write-down is recomputed.*

**(a) RC tops must attach to the correct models.** The RC pool belongs
exclusively to **Gracyn (D125), Allamari (D640), Lucian (D704)** and to no
other collection — established from the edge list, not from depth. Any rebuild
that lands an RC top on a fourth collection, or fails to offer RC to one of
these three, is wrong. Gate it.

**(b) The RC batch must be written down proportionally and defensibly.**
Bracket A — the 23 RC tops against the 19 shallow cabinets — ran **269 top
units against 38 cabinet units, 7.1:1**, against 1.0:1 for the small sizes and
3.2:1 overall. That overage is **231 units**, and under the current per-*width*
haircut it is diluted across ~2,650 units of unrelated 36" demand instead of
being charged to the pool it came from. The RC pool is closed — these tops fit
19 cabinets and nothing else — so it can and should be reduced on its own
terms, pro-rata within the pool, the same share-neutral method used elsewhere.
**Open first:** §8.1 — whether bracket A is warranty breakage or combo-only
selling. The answer changes whether a write-down is appropriate at all.

### 2.4 73 cabinet SKUs at 22.5–22.9" have no top at their depth at all

216 units of cabinet demand whose tops must come from the 23.0"+ pool. This
inflates bracket B's ratio and means a warranty haircut computed per *width*
spreads overage across depth classes that never trade with each other.

---

## 3. The clamp — why combo drawdown is not sales

A combo SKU's quantity is **`min(base_qty, top_qty)`** — computed
availability, not a stock pool. It moves when *either* half moves, and it
collapses when a shared top runs short.

Measured over the window:

```
combo drawdown total : 28,160
top   drawdown total :  2,700
inflation            :     10.4x
```

The original proof case: `E444-V72-GW-3WZ` showed 72 units while its base sat
at 158 unmoved, and its quantity was identical to the top's from 08-29.

### 3.1 The clamp signature is visible

Five combos across four collections all read exactly **55**:

```
485-V36-BW-1WZ   485-V36-CBO-1WZ   547-V36-HNO-1WZ
825-V36-BW-1WZ   D100-V36-PBO-1WZ
```

`051-S36-BS-WZ`, the 36" single-hole backsplash top they all share, drew down
**exactly 55**. That is one top's availability reflected five times, not five
sales figures.

Detection (implemented in the scrub): `combo_u > 0` **and** `combo_u == top_u`
**and** at least one other combo on the same top shows the identical figure.
The sibling test is what separates a real clamp from a coincidental match.

**539 of 3,456 movers (16%) are clamped by that test.**

---

## 4. Combo → base is still inferred

`product_components` has no `cabinet` role, so the base is resolved on
**`collection` + `base_finish` + `size_nominal`**.

> **`sinks` must be EXCLUDED from the base key.** A cabinet carries `sinks = 0`
> (it is a base, no basin); its combo carries `sinks = 1`. Including it matches
> **zero** of 4,199.

**40 of 275 base keys hold two cabinets** — the double- and single-sink
variants at one width, e.g. `157-V60D-M-BW` and `157-V60S-M-BW`. Both carry
`sinks = 0`, so nothing in the data separates them and a combo joins to both.
Keying on the cabinet SKU double-counts. Pool their demand. The single/double
split still comes through the top edge, which *is* sink-aware.

**88 combos have no resolvable base** (76 of them Bellshire). Exclude and
report; never silently drop.

---

## 5. Can sibling combo drawdown weight the mix? — mostly no

**The idea:** rather than splitting a base's demand across its tops in
proportion to each top's *total* drawdown, use the siblings' own combo
drawdown, which is specific to that base. It directly addresses the
independence assumption the first model had to assume away.

**It is right in principle and right on the headline case.** Marcello 36"
Chestnut, observed: `3WZ` 67 vs `1WZ` 48 — a real 58/42 split where the first
model gave them exactly **8.81 / 8.81**.

**But it does not generalise.** Siblings share a base, so the base component
cancels — *only if neither sibling's top is itself binding*. Testing every base
group (a top counts as non-binding when it drew ≥1.5× the combo):

| base groups | 285 |
|---|---|
| clean — mix usable | **51 (18%)** |
| polluted — a top binds | **200 (70%)** |
| only one sibling moved | 9 |
| no movement | 25 |

At 18% coverage this cannot carry the model. Two honest options: use it only
where clean and fall back to top-level weights elsewhere, or park it. **Not
resolved — see §8.**

---

## 6. Status of the four business rules

All four were built to disambiguate a join that the edge list makes exact.

| rule | status |
|---|---|
| **1 — fold `050`/`051`→PLAIN, `060`→RC** | Obsolete. Also *partly inert even today*: the join sums across families matching the key, so folding `050`/`051` moves no score (verified by mutation). Only `060`→`RC` was load-bearing, because rule 2 tested that label. |
| **2 — RC belongs to Gracyn, Kinnsden, Allamari** | Obsolete, and **wrong on the third name — it is Lucian (D704), not Kinnsden (D680)**. Kinnsden is 23.13" deep and uses `050`/`051`/`090` tops like any deep collection. *Correction 2026-09-11: an earlier version of this row claimed the rule "suppressed 49 valid deep-SFR combos". It did not — those combos use a plain `050` top, so rule 2 was correctly blocking a bad inferred match. The rule did real work; only its collection list was wrong.* |
| **3 — Bellamy is captive** | **Confirmed independently.** `D300-V36-RSO-CAR` is the one combo with no `top` component row — its oval Carrara top genuinely is not a separate SKU. |
| **4 — Linear takes composite tops only** | Obsolete. Was inert anyway: Linear's key already matched only composite tops that moved, so removing the predicate changed nothing. |

> Catalogue spelling is **`Kinnsden`**, double *n*. `'Kinsden'` matches nothing
> and turns any rule using it into a silent no-op.

---

## 7. Six combos legitimately have two tops

`825-V82-BW-DU-CAR`, `825-V82-BW-DU-WZ`, `825-V94-BW-DU-CAR`,
`825-V94-BW-DU-WZ`, `825-V118-BW-DU-CAR`, `825-V118-BW-DU-WZ` — very wide
double vanities with a bridging unit. Any "one top per combo" assumption must
special-case these.

---

## 8. Open questions — do not guess these

1. **Is bracket A warranty, or combo-only selling?** 19 shallow cabinets moved
   38 units while their 23 tops moved 269. In a closed pool — these tops fit
   nothing else, and JM will not ship a top without a cabinet order — 7:1 is
   either heavy RC breakage or those collections selling as pre-assembled
   combos whose cabinet half never appears as cabinet drawdown. A haircut
   assumes the former; if it is the latter, haircutting is wrong.
2. **Does a 22.9" cabinet take a 23.5" top** (⅝" overhang), or is 22.5–22.9 its
   own class? Determines two brackets vs three.
3. **Mix weighting at 18% coverage** — use where clean, or park?
4. **The 32 backwards-priced 60" pairs.**
5. **The 36 spread-less `-3xx` combos** in Gracyn / Allamari / Lucian.
6. **The `W` and `F` top-code prefixes** — decoded as `W` = RCWS (widespread)
   and `F` = RCWS + FreePower on the shallow three, but `FSFR` also appears on
   165 SKUs across 23 other collections, where it has not been checked.

## 8a. Open with JM — reported 2026-09-11

- **RC depth = 23.5" on five SFR SKUs.** Should be 21.5". §2.3.
- **16 Gracyn combos at 23.5"** whose tops are correctly 21.5". A second,
  independent defect — worth flagging separately so it is not closed out with
  the first.

Fixed on the BVO side pending JM's correction; the fix must survive re-import,
so it belongs in `importJamesMartinFeed.js` as an override keyed on the `060`
prefix, not only as a one-off `product_attribute_values` update.

---

## 9. What was shipped before this was known

Commit `0e33b31` (2026-09-10) shipped the warranty adjustment and the
estimated-combo-demand table built on the **inferred** join and rules 1–4.
Its numbers — MAP Revenue $4,594,088, 822 estimated against 822 base units —
are internally consistent and gated, but they rest on a pairing model this
document supersedes. `JMV_REVENUE_DEFINITION.md` and
`JMV_COMBO_DEMAND_DEFINITION.md` remain the definitions of record for *what
the numbers mean*; this document supersedes them on *how pairing is
determined*.

Storefront popularity sorting (`products.demand_score`) was **not** repointed
and still ranks on raw combo drawdown — i.e. on the 10.4× inflated figure.
