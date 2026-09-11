# JMV Estimated Combo Demand — Definition of Record

**Status:** **approved 2026-09-10** · **Drafted:** 2026-09-10
**Companion to:** `JMV_REVENUE_DEFINITION.md`

This document defines *what the number means*. It is the artifact of record. If
code and this document ever disagree, this document is right and the code is a
bug.

---

## 0. Why this exists

Storefront popularity sorting currently ranks on **Top Combo SKUs by Demand**,
which reads combo-SKU drawdown directly. `JMV_REVENUE_DEFINITION.md` §5
established that a combo SKU's quantity is `min(base, top)` — a computed
availability figure, not a stock pool. It moves when its base or top moves, and
it collapses when a shared top runs short.

The consequence, measured: **39 of the top 50 SKUs by drawdown are combos**, and
Vanity accounts for 28,215 units against Cabinet's 865 — a 33:1 ratio that no
sales mix produces. Popularity ordering for 4,212 vanity products is currently
driven by clamp artifacts.

Combos cannot be observed. But they can be **estimated** from the two pools that
are real.

---

## 1. The definition

> **Estimated Combo Demand** for a combo = its base cabinet's observed drawdown,
> allocated across the tops that base is actually offered with, in proportion to
> each top's own observed drawdown.

Formally, for base *b* and combo *c* using top-group *t*:

```
estimate(c) = demand(b) × demand(t) / Σ demand(t′)   for t′ ∈ tops offered with b
```

Σ over all combos of a base equals that base's demand, so the total conserves:
**822 estimated against 822 cabinet units available — exact.**

This is the standard marginal-allocation estimator under independence. It
assumes top choice is independent of base choice given the offer set — see §6.

**It is an allocation, not an observation.** Label it
**"Estimated Combo Demand (modelled)"** everywhere it appears. Never "combos
sold."

---

## 2. Resolving a combo to its base and its top

Neither join is obvious and both were got wrong first.

| link | key |
|---|---|
| combo → base cabinet | `collection` + `base_finish` + `size_nominal` |
| combo → top | `top_finish` + `top_material` + `size_nominal` + `sinks` |

**`sinks` must be excluded from the base key.** A cabinet carries `sinks = 0`
(it is a base, no basin); its combo carries `sinks = 1`. Including it matches
zero of 4,199 combos. Including it in the *top* key is required.

Coverage: **4,085 of 4,199 combos (97%) resolve to both.**

---

## 3. Top families — rule 1

A top finish is not one SKU. White Zeus 36" is four physical tops. Grouped by
SKU prefix:

| family | prefixes | meaning |
|---|---|---|
| **PLAIN** | `050`, `051` | plain top + plain-with-backsplash |
| **RC** | `060` (both `RC` and `RCWS`) | radius corner + radius-corner-with-splash |

Demand is summed within a family before computing share. Without this, White
Zeus 36" reads 17 units instead of **564**, and the dominant finish in the range
looks like a minor one.

> **Correction, 2026-09-10 (build).** In the shipped query the top join sums
> across whatever families match the key, so the *share* is unchanged whether or
> not `050` and `051` are folded — verified by mutation: splitting them moves no
> score. The fold that is load-bearing is **`060` → `RC`**, because that label is
> what rule 2 tests. Remove that arm and every family reads `<> 'RC'`, rule 2
> stops binding, and 49 RC-only combos reappear. The `050`/`051` pair stays in
> the mapping because it is the distinction the catalogue draws and rule 2 could
> come to depend on it, but it is inert today and the gate says so.

**All other prefixes stay as they are** — `040`/`090` Marble, `080`/`410` Solid
Surface, `CS`/`CSP`/`SWB` Mineral Composite. 54 SKUs. No grouping applied.
*(Confirmed 2026-09-10: no action needed on these.)*

---

## 4. Pairing constraints — rules 2 and 4

The `(finish, material, size, sinks)` top key is **not unique** — 41 of 127 keys
match more than one family. These rules disambiguate it.

**Rule 2 — RC tops belong to three collections only:**
**Gracyn**, **Kinnsden**, **Allamari**.

For every other collection the RC family is removed from the offer set. Without
this, 28 collections appear able to use an RC top purely because the key can't
tell them apart.

> ⚠ The catalogue spells it **`Kinnsden`** — double *n*. "Kinsden" matches
> nothing and would make the rule a silent no-op for that collection.

**Rule 4 — Linear combines only with composite tops.**

All 9 Linear combos are Glossy White / Mineral Composite. But Glossy White
exists across 10 top SKUs in the `CS`, `CSP` and `SWB` prefixes, so without the
rule the ambiguous key can hand Linear a top from the wrong series. With it,
Linear has exactly one option and 100% of base demand flows to that combo.

---

## 5. Captive models — rule 3

**Bellamy (`D300-V36-RSO-CAR`) is the only SKU in its group.** No cabinet, no
top — it sells solely as a combo with a one-off oval Carrara marble top that is
**not sold separately** *(confirmed 2026-09-10)*.

With no separately-stocked component, nothing can clamp it. Its quantity is a
real pool, so **its own drawdown counts directly** rather than being modelled.

**This applies to Bellamy alone.** A first implementation treated every combo
whose base failed to resolve as "captive" and counted its raw drawdown — 59
SKUs, which promptly took over the leaderboard with exactly the phantom numbers
this document exists to remove. Unresolved is not captive:

- **Captive** → group contains no base of any type, component not sold
  separately → count own drawdown
- **Unresolved** → base exists but the join failed → **exclude, and report it**

---

## 6. Known limitations — state these, do not hide them

**Independence.** The model assumes finish choice doesn't depend on base choice.
In reality a walnut base may skew warm. Unmeasurable from this data; the
estimate will be smooth where reality is clustered.

**1WZ and 3WZ tie exactly — and that is correct.** *(Resolved 2026-09-10.)*
They are the same top; the suffix is the number of faucet holes. So bucketing
them for the share calculation is right, and the resulting tie is a true
statement: both combos are equally popular, and the choice between them is a
faucet preference this data cannot observe.

The tie is fine. **Non-deterministic ordering is not.** An unbroken tie in
`ORDER BY` lets MySQL return equal-scored rows in any order, so a customer can
see two listings swap on refresh, and paginated collection pages can duplicate
or skip a row across page boundaries.

> **Requirement: every sort on this score carries a deterministic secondary
> key — `ORDER BY score DESC, sku ASC`.** Not cosmetic; without it the ordering
> is unstable between queries.

**113 combos excluded** as unresolved, 76 of them **Bellshire**. They contribute
nothing and are not counted anywhere. Worth chasing separately.

**Sparsity.** 16 days of history, 206 bases with movement. Many estimates are
fractions and rank order in the tail is noise. Consider a longer window for the
marginals than for display.

**Base-anchored by design.** Total equals cabinet demand; a base selling 1 unit
distributes 1 unit, and White Zeus's 564 units cannot lift a cold base. A
symmetric alternative (base share × top share) was considered and rejected: the
base is what constrains a set sale and is the more distinctive customer choice.

---

## 7. Verified output

Window 2026-08-01 → 2026-09-09, all four rules applied.

**Marcello 36" Chestnut — base demand 21 units:**

| combo | top | share | est. |
|---|---|---|---|
| D200-V36-CSN-1WZ | White Zeus | 41.1% | 8.81 |
| D200-V36-CSN-3WZ | White Zeus | 41.1% | 8.81 |
| D200-V36-CSN-3VSL | Victorian Silver | — | 0.82 |
| D200-V36-CSN-3ENC | Ethereal Noctis | — | 0.62 |

**Leaderboard:** Marcello 36 Chestnut, Emmeline 36 Pebble Oak, Myrrin 36 Carbon
Oak, Linear 36 Walnut, Chicago 36, De Soto 36 — all White Zeus except Linear.

**Totals:** 4,085 resolved to a base · rules 2 and 4 prune the offer set to
**3,448 scored** · 1 captive (Bellamy) · 113 excluded as unresolved ·
**822 estimated against 822 cabinet units available — exact.**

*(The 762/763 figures in the pre-build draft predated the base-pooling fix in
§6; 40 of 275 base keys hold both sink variants and were double-counted.)*

---

## 8. Scope — what this defines, and what it does not

**In scope:** the estimator, and repointing storefront popularity sorting
(`products.demand_score`) at it for the 4,212 vanity products.

**Not authorised here:**
- Changes to the Demand Reports page — separate decision
- The Combo Demand report's fate (retire / repurpose as Set Availability)
- Revenue — settled in `JMV_REVENUE_DEFINITION.md`, unaffected
- The 1WZ/3WZ tiebreak — open

---

## Sign-off

| | |
|---|---|
| Definition approved | ☑ |
| Approved by | Renovate for Less |
| Date | 2026-09-10 |
