# Water Creation Inventory Feed — Market Demand Analysis

> WC national demand arc, seasonality and the RFL store-level comparison, plus the two data-integrity findings that void all pre-2024 RFL revenue and any quote-conversion metric. Read the ⚠️ section before quoting any RFL number earlier than Jan 2024.

**Logged:** 2026-11-24
**Status:** Findings record. Nothing here is a build task. The follow-on project
is specced separately in `WC_REPORTS_SPEC.md` and parked in `OPEN_ITEMS.md`.
**Scope note:** this document covers **market and RFL showroom** analysis. It is
not BVO messaging or BVO strategy. RFL and BVO are deliberately segregated
entities (differing pricing tiers, storytelling, strategy, accounting). Do not
let findings here migrate into BVO positioning work without a decision to do so.

---

## ⚠️ READ FIRST — Two data sources that look usable and are not

These cost most of a session to discover. Both are recorded here so nobody
rebuilds a trend on them.

### 1. Shopify POS data before 2024 CANNOT be used as a revenue series

The GVS Shopify store (`bathroom-vanities-outlet.myshopify.com`) holds POS
orders from 2021 through 2023 — 2,000 orders, $1,935,076. It looks like the
pre-RFLPOS showroom history. **It is not.**

| | Total revenue | Stores open | Per store-year |
|---|---|---|---|
| Shopify POS 2023 | $766,760 | ~2.75 | **$279K** |
| RFLPOS 2024 | $2,110,194 | 3 | **$703K** |

Revenue per store 2.5x'd across a pure system change, in a year the market was
falling. Demand did not triple. **The Shopify till captured roughly a third of
actual store sales** — it was not the system of record for the showrooms.

Three independent confirmations of the same conclusion:

- **85% of POS revenue carries no product record.** $1.65M of $1.94M has blank
  `product_title`, blank `product_vendor`, blank `product_type` — rung as custom
  line items where the clerk typed a description and a price. Consistent with a
  partial till, not a primary sales system.
- **Only one POS location exists** (`pos_location_name` = "Renovate for Less
  Outlet"), but Norcross opened May 2022 and Marietta Q2 2023. All stores rang
  through one undifferentiated location, so nothing in this era is attributable
  to a store.
- **`net_items_sold` is contaminated** by material sold by the box or square
  foot. Normal months run 1.5–3 items/order. Feb 2021 = 380/order; May 2023 =
  35.8; Jun 2023 = 41.9; Oct 2023 = 33.4. Tile and laminate flooring were sold
  through the same till and cannot be separated from vanities, because the line
  items are untyped.

**Consequence:** there is no recoverable RFL history before January 2024. The
usable baseline starts at the RFLPOS cutover. 2024 is the only pre-decline year
that can be measured against. Do not build a target off a longer trend.

**Withdrawn on this basis:** a "Roswell 2022 peak of $969,047", a 2022→2023
decline of −20.9%, a four-year ~20%/yr decline arc, and an indexed chart showing
Roswell peaking a year before the national market. All void.

### 2. RFLPOS `sell`/`draft` records cannot measure conversion

Drafts are quotes. Volume: $178K (2024) → $927K (2025) → $792K (2026 partial),
rising from 8% to roughly 50% of final revenue — which looks like a collapsing
close rate. It is not measurable as one, for two reasons:

- **A converted quote is indistinguishable from a lost one.** A quote written
  for a walk-in is finalised later as a *new* transaction under the customer's
  name. The original draft sits unresolved forever. Every closed deal that
  started anonymous leaves a draft that looks like a failure.
- **Multiple drafts can represent one buyer.** Customers routinely ask for
  separate quotes to compare vanity/top combinations. One opportunity, several
  drafts, at most one sale.

Both biases inflate the denominator. Worse, they need not operate equally across
stores: if one store's customers comparison-shop more, its apparent close rate
falls for reasons with no commercial meaning. A store-vs-store close-rate
comparison is therefore **not** safe either.

**Withdrawn on this basis:** a "demand is intact, conversion is broken"
conclusion, Roswell dollar-close of 45.4% vs Kennesaw 60.2%, and a $112K
"recoverable revenue" figure derived from the gap. All void.

**Note for RFLPOS reporting:** any close-rate or quote-conversion report in
RFLPOS itself is subject to the same two biases. Before trusting one, settle
whether a quote is reconciled, marked or deleted once it converts.

---

## 1. The WC dataset — provenance and method

### What it is

Water Creation emails a daily inventory feed to `global.value.supply@gmail.com`.
**1,628 daily snapshots** were extracted, spanning **2021-05-17 → 2026-11-23**.

Output files (local, `OnlineSmartPOS/WC_analysis/`):

| File | Contents |
|---|---|
| `WC_daily_panel.csv` | 1,628 rows. `date, skus, units, zero, zero_eta, zero_noeta, gap, out_units, out_skus, in_units, in_skus` |
| `WC_monthly_outflow.csv` | `year, month, days_observed, avg_daily_outflow_units` |
| `WC_vs_RFL_monthly.csv` | Monthly WC outflow against RFL POS units |

### Extraction — and the one thing that mattered

Every attachment is named `searchresults.csv` and **the file carries no date
anywhere inside it**. The only record of which day a snapshot belongs to is the
email's own timestamp. Saved as-is they become 1,628 identical files and the time
series is destroyed.

A Google Apps Script (`wc_feed_export.gs`, and a live project under
`global.value.supply@gmail.com`) reads `msg.getDate()` and writes
`wc_YYYY-MM-DD.csv` to a Drive folder. Gmail read + Drive write only; nothing
sent, nothing modified.

Query: `from:water-creation.com has:attachment subject:"Daily Inventory Feed"`

Operational notes for any re-run:

- Apps Script hard-kills a run at 6 minutes. Budget **3 minutes** and page at
  **50**, not 5 minutes / 100 — a page takes ~2 min, so a 5-minute budget can
  start one at 4m50s and lose the bookmark.
- The duplicate guard must **skip** an existing date, not rename to `_2`. An
  earlier version renamed-and-created, which turned every resume into a
  duplicate factory (137 created before it was caught). `cleanupDuplicates()`
  trashes `wc_DATE_N.csv` stragglers.
- Catalogue attachments (`.xlsx`, `.pdf`) from the 2021 dealer-setup thread are
  skipped by extension; they are not time-series data.

### Schema drift — two formats

The feed changed format between 2024 and 2025. Any parser needs both:

```python
if h and h[0] == 'SKU':   iS,iQ,iD = 0,1,2   # 2025+: SKU, Available Qty, Available Date
elif len(h) >= 4:         iS,iQ,iD = 1,2,3   # pre-2025: Original Sku, New Sku,
                                             #           Maximum of Stock,
                                             #           Maximum of Available Date
```

### Demand inference

The feed is a **stock snapshot**, not a sales report. Demand is inferred by
differencing consecutive snapshots:

- **Decrease in a SKU's available qty = shipments** → demand proxy (`out_units`)
- **Increase = receipts** → replenishment (`in_units`)
- Valid **only on consecutive-day pairs** (`gap == 1`). Differencing across a
  gap mixes an unknown number of days of movement with replenishment and is
  discarded.

This is a national wholesale shipment proxy. It is **not** retail sell-through
and it is **not** dollars.

### Coverage caveats

`days_observed` per month is the honest denominator:

- **2021-05 → 2024-04:** ~16–19 observed days/month. Partial coverage.
- **2024-05 → 2024-06:** major gap — 1 observed day in May, June absent entirely.
  Treat 2024 as an 11-month year.
- **2024-07 onward:** near-complete daily coverage (28–31 days).

**Partial months bias sums, not daily averages.** All figures below are
`avg_daily_outflow_units`, so a short month is not a low month. (This was got
wrong once and corrected: Nov 2026 at 256 u/day is genuinely the lowest rate in
the dataset, not a partial-month artifact.)

### SKU structure — the suffix is a bill of materials

A WC SKU encodes its components in the suffix:

```
PY30CW03GG- + [mirror: 000 | A24 | P24] + [faucet: 000000 | TL1203]
```

Verified against the price ladder: $836 (no mirror, no faucet) → $974 → $1,171.
So a single "model" appears as many SKUs, and **model-level rollups must strip
the suffix** or the same cabinet is counted repeatedly across its option
permutations. This matters directly for the report in `WC_REPORTS_SPEC.md`.

---

## 2. Findings — national WC demand

### The arc

| Year | Months | Obs. days | Avg daily outflow (units) | Index (2021 = 100) |
|---|---|---|---|---|
| 2021 | 8 | 132 | 616.1 | 100.0 |
| 2022 | 12 | 205 | 587.9 | 95.4 |
| 2023 | 12 | 208 | **762.9** | **123.8** ← peak |
| 2024 | 11 | 245 | 502.0 | 81.5 |
| 2025 | 12 | 365 | 487.0 | 79.0 |
| 2026 | 11 | 315 | 372.1 | 60.4 |

**National demand peaked in 2023 and is down 51.2% from that peak.** The shape
is a sharp correction in 2024 (−34%), a flat 2025 (−3%), then a second leg down
in 2026 (−24%). The 2024→2025 flattening is what a demand hangover resolving
looks like; the 2026 leg is not that.

### Seasonality

Year-normalised (each month indexed against its own year's mean, then averaged
across years — so trend does not contaminate season):

| Month | Index | Month | Index |
|---|---|---|---|
| Jan | 97.1 | Jul | 92.5 |
| Feb | 112.3 | Aug | 102.9 |
| Mar | **117.8** | Sep | 102.3 |
| Apr | 102.3 | Oct | **114.1** |
| May | 100.3 | Nov | 91.6 |
| Jun | 91.3 | Dec | **74.9** |

Two peaks — **March** (117.8) and **October** (114.1). One deep trough —
**December** (74.9). February is the third-strongest month. June/July and
November are soft.

Useful for: reorder timing, promotional calendar, and reading a monthly number
against the right baseline rather than against last month.

---

## 3. Findings — RFL showrooms (RFLPOS, 2024 onward)

### Provenance

Source: `u222311468_rflscom.20261017001331.sql` (28MB dump, data through
2026-10-16). Filter: `type='sell' AND status='final'`, summing `final_total`.
Column indices in `transactions` (0-based): `location_id`=2, `type`=7,
`status`=9, `transaction_date`=21, `final_total`=60.

**Cutover confirmed as January 2024.** The only 2023 rows in RFLPOS are 1,544
`opening_stock` records ($650,806) — the inventory load when the system was stood
up. First `sell`/`final` is 2024-01. Shopify POS drops to zero the same month.

Locations (`business_locations`): **1 = Roswell, 8 = Norcross, 9 = Kennesaw**.
(10 = Factory INV and 12 = In-Ocean INV are inventory, not showrooms. "Marietta"
in conversation maps to the Kennesaw record.)

### Store performance

| Store | 2024 | 2025 | 2026 (annualised) |
|---|---|---|---|
| Roswell | $622,788 | $517,267 (**−16.9%**) | ~$433K (**−16.3%**) |
| Kennesaw | $761,054 | $802,794 (**+5.5%**) | ~$728K (**−9.3%**) |
| Norcross | $726,352 | $383,754 | closed Jul 2025 |

2026 is through 2026-10-16 (~79% of the year) and annualised on that basis.
Norcross's 2025 fall is the closure, not demand.

### The share test

Roswell as a share of the two surviving stores — this cancels every shared
effect (metro economy, interest rates, brand lineup, season, company-wide
pricing and policy):

**45.0% (2024) → 39.2% (2025) → 37.3% (2026)**

**Kennesaw grew 5.5% in 2025 while the national market fell and Roswell fell
16.9%.** Same metro, same brands, same rates, same company, same POS.

### What this does and does not establish

**Established:** the store-level divergence is real and is not a market effect.
Execution is moving the number by double digits in both directions inside one
company — the retraction sets the headwind but does not determine the outcome.

**Not established:** the cause. Demand, competition, pricing, staffing and
merchandising are all still live candidates, and the quote data cannot
discriminate between them (see ⚠️ #2). Any claim about *why* Roswell lags is
currently unevidenced.

---

## 4. Theory tested and not resolved

**The hypothesis (owner's, 2026-11):** Roswell has a high proportion of
white-collar corporate workers; that affluent market did renovations
disproportionately in 2022/23, consuming its demand cycle early; and those same
workers' access to low rates in that window suppressed home transactions and
therefore new renovation locally.

**Status: untested, not refuted.** The evidence that appeared to support it —
Roswell peaking a year before the national market, and a 50-point divergence in
2023 — came entirely from the Shopify POS era and died with it (⚠️ #1). The
alternative read that appeared to refute it — intact quote volume with
collapsing conversion — came from the draft table and died with it (⚠️ #2).

What survives is compatible with the theory but does not distinguish it from
several alternatives.

**Confounders identified that any future test must handle:**

- Norcross opened **May 2022**, Marietta/Kennesaw **Q2 2023**, Norcross closed
  **July 2025**. Store count moved 1 → 2 → 3 → 2 across the window.
- Cannibalisation redistributes within the metro; it cannot reduce a metro total.
  A falling two-store total is therefore not cannibalisation.
- Tile and laminate flooring were in the mix through 2023 and are inseparable in
  the Shopify data.

**Open and unobtained:** Roswell residential alteration permit volumes
2023–2026. Web search returned only contractor marketing pages; this needs a
records request to City of Roswell Community Development. Would give an
independent read on local renovation activity, free of any POS problem.

**Also open:** whether new bathroom vanity competition entered the Roswell trade
area in mid-2025.

---

## 5. Blocked

**JMV three-way comparison (WC national vs RFL vs James Martin).** The BVO dump
(`u222311468_BVO_website.20260929174558.sql`) predates the data —
`jmv_daily_movement` holds only 9 days. The live DB would have it. Not pursued:
it needs a phpMyAdmin login, and entering database credentials is out of scope
for an assistant session.

---

## 6. Reusable assets

| Asset | Where | Reuse |
|---|---|---|
| Apps Script feed extractor | `wc_feed_export.gs` + live project | Any dated-attachment harvest from Gmail |
| SQL-dump parser | pattern recorded in §3 | Multi-line `INSERT ... VALUES (...),(...);` with quote/escape-aware field splitting; works on any UltimatePOS dump |
| Dual-schema WC CSV parser | §1 | Required for any WC feed work spanning 2024/2025 |
| Daily panel | `WC_analysis/WC_daily_panel.csv` | Input for the report in `WC_REPORTS_SPEC.md` |

---

## Changelog

- **2026-11-24** — Created. Records the WC extraction and method, the national
  demand arc and seasonality, the RFLPOS store-level findings, and the two
  data-integrity findings that invalidated the pre-2024 series and the
  conversion analysis.
