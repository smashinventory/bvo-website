# Water Creation Reports — BVO Admin Dashboard (SPEC, NOT APPROVED)

> Parked spec for a WC analogue of the JMV reports dashboard — models, velocity, colours, sizes and tops from the national inventory feed. Units only, no financials. Not approved; see OPEN_ITEMS #22.

**Logged:** 2026-11-24
**Status:** 🅿️ **Parked.** Specced so it can be picked up cold. Nothing here is
approved and nothing gets built without Sam saying so. Logged as
`OPEN_ITEMS.md` #22.
**Precedent:** mirrors the existing JMV reports dashboard
(`views/pages/admin/marketing/jmv-reports.ejs`,
`src/controllers/jmvReportsController.js`, `src/jobs/jmvMovementRollup.js`).
**Findings/method record:** `WC_MARKET_ANALYSIS.md` — read its §1 before writing
any parser, and its ⚠️ section before quoting any number.

---

## 1. What this is for

Water Creation emails a daily national inventory feed. Differencing consecutive
snapshots yields a **national wholesale shipment proxy** — what WC is actually
shipping, by SKU, every day, across all its dealers.

That is a merchandising signal we do not otherwise have: which models, colours,
sizes and top configurations are moving *nationally*, independent of our own
assortment and our own traffic. It tells us what to carry, what to promote, what
to drop, and when — and it reads the market a year or two before our own sales
data can.

### Explicitly out of scope — no financials

**Decided by Sam, 2026-11-24: no financials section. Units only.**

- No revenue, no estimated revenue, no "demand dollars"
- No MSRP or wholesale cost columns
- No price-band velocity card (the JMV analogue) — it requires a price
- No unit→dollar mapping anywhere, including tooltips and exports

This removes the entire class of problem that consumed the JMV build (pivot
dedup, warranty haircut, unpriced-SKU counts, revenue-basis definitions). Do not
reintroduce it. If a future session wants dollars, that is a new decision.

---

## 2. ⚠️ Three things that will produce a wrong dashboard if missed

### 2.1 This is NOT our sales data

It is WC's national shipments to all dealers. Every card, every export header
and the page title must say so. A reader who mistakes this for BVO or RFL sales
will draw exactly the wrong conclusion about our own performance.

Required page subtitle, or equivalent:
> *Water Creation national wholesale shipments, inferred from daily inventory
> snapshots. Not BVO sales. Not RFL sales. Units only.*

### 2.2 The SKU suffix is a bill of materials — model rollups must strip it

```
PY30CW03GG-000000000
└─ base ──┘└ suffix ┘
```

- **Base** (before the dash): collection + size + finish — the cabinet itself.
- **Suffix** (9 chars): `[mirror: 3][faucet: 6]`. `000` / `000000` = not
  included; e.g. `A24`, `P24` for mirrors, `TL1203` for faucets.

Verified against the price ladder: $836 (bare) → $974 → $1,171, and against
`Supplier SKU #` + `Mirror part#` / `Faucet part#` in the catalogue.

**Consequence:** one cabinet model appears as many SKUs. A naive
`GROUP BY sku` rollup counts the same cabinet repeatedly across its option
permutations and will rank option-heavy collections far too high.

Both views are wanted, and they answer different questions:

| View | Key | Answers |
|---|---|---|
| **Model** | base SKU (suffix stripped) | What cabinets are selling |
| **Configuration** | full SKU | Mirror and faucet attach rates |

### 2.3 Deltas are valid only on consecutive days

Movement = decrease in a SKU's available qty between **adjacent** snapshots.
`gap == 1` only. Differencing across a gap mixes an unknown number of days of
movement with replenishment, and must be discarded rather than scaled.

Coverage is uneven and the dashboard must expose it, not hide it:

- **2021-05 → 2024-04:** ~16–19 observed days/month
- **2024-05 → 2024-06:** major gap (1 day in May; June absent) — treat 2024 as
  an 11-month year
- **2024-07 onward:** near-complete daily coverage

**Always report rates (units/day), never period sums**, so a short month is not
mistaken for a weak month. Surface `days_observed` next to every period figure.

---

## 3. Data model

Mirrors the `jmv_*` tables.

| Table | Contents |
|---|---|
| `wc_snapshots` | One row per (snapshot_date, sku): available_qty, available_date/ETA. **No price columns.** |
| `wc_dimensions` | One row per SKU: the attribute set from §4. Includes `base_sku` (suffix stripped), `mirror_code`, `faucet_code`. |
| `wc_daily_movement` | Computed deltas: (date, sku, out_units, in_units). Written only where `gap == 1`. |
| `wc_snapshot_validity` | Per-date: `gap`, `skus`, `total_units`, `zero`, `zero_eta`, `zero_noeta`. Drives the coverage warnings. |

### Ingestion

Raw snapshots live in **Google Drive → `WC Inventory Feed`** (1,628 files,
`wc_YYYY-MM-DD.csv`, 2021-05-17 → 2026-11-23), produced by the Apps Script
described in `WC_MARKET_ANALYSIS.md` §1. They are **not** in the repo and not on
the server. The job needs either a Drive read or a re-download to a drop zone.

**The parser must handle both feed schemas** — the format changed between 2024
and 2025:

```python
if h and h[0] == 'SKU':   iS,iQ,iD = 0,1,2   # 2025+
elif len(h) >= 4:         iS,iQ,iD = 1,2,3   # pre-2025
```

A ready-built aggregate already exists at
`OnlineSmartPOS/WC_analysis/WC_daily_panel.csv` (1,628 rows) and can seed the
validity table and the trend cards without re-parsing, though it holds no
per-SKU detail.

### Dimension source

**`Water Creation product catalog 2021 NEW collections.xlsx`**, sheet
`Product Data - Vanity` — **header on row 2**, 984 data rows, 145 attribute
columns. Keyed on `Supplier SKU #`, which is the full feed SKU.

Secondary: `Water Creation Catalog -2020.xlsx` (1,410 rows, Old SKU / New SKU)
for older SKUs.

**Coverage will be partial.** The feed carries 1,834 SKUs in 2021 falling to
1,301 by 2026; the catalogues predate later collections. Unmatched SKUs must be
**surfaced as an explicit unmapped count**, visible on the page — never silently
dropped, and never folded into an "Other" bucket that hides the gap. This is the
same discipline as the JMV dashboard's unpriced count.

---

## 4. Dimensions available

All from `Product Data - Vanity`. Column indices are 0-based on the row-2 header.

| Dimension | Col | Notes |
|---|---|---|
| Collection Name | 6 | Primary model grouping |
| Vanity part# | 1 | Decodes to collection-size-finish, e.g. `PAISLEY-30GG-CW` |
| Product Name | 11 | Human-readable size + sink config |
| Overall Width (side to side) | 41 | **Size** — bucket to nominal inches |
| Overall Height / Depth | 40, 42 | |
| Cabinet Color | 66 | **Colour** — primary trend dimension |
| Cabinet Finish | 67 | |
| Cabinet Material | 68 | |
| Top Material | 53 | **Tops** |
| Top Finish / Color | 56, 57 | |
| Top Edge Type | 58 | |
| Top Thickness / Depth / Width | 59, 60, 61 | |
| Faucet Hole Spacing | 65 | |
| Number of Sinks | 71 | Single vs double |
| Sink Type / Shape / Material | 75, 73, 76 | Note: we do not sell vessel sinks — see the BVO refuse-to-carry decision |
| Mirror Included / SKU / count | 98, 97, 100 | Attach rate |
| Faucet Included / SKU / Finish | 84, 85, 87 | Attach rate |
| Vanity Mounting Type | 104 | Freestanding vs floating |
| Doors / drawers | 107–110 | |
| Backsplash Included | 131 | |
| ADA Compliant | 30 | |

---

## 5. Dashboard layout

Four rows, following the JMV dashboard so the two read alike.

### Row 1 — Alert strip

- **Stockouts now:** SKUs at zero, split **with ETA** vs **without ETA**. The
  no-ETA set is the real risk and the panel already separates it.
- **Newly out since last snapshot** — what just went to zero.
- **Back in stock since last snapshot** — replenishments landed.
- **Coverage health:** last snapshot date, `gap`, and a visible warning when the
  latest delta is not from a consecutive-day pair.

### Row 2 — Headline movers (trailing window, selectable)

- **Top Collections** by units/day
- **Top Models** (base SKU, suffix stripped) by units/day
- **Size × Cabinet Color** — observed drawdown heatmap
- **Movers and fallers** — biggest change vs the prior equivalent window

### Row 3 — Dimension breakdowns

Cabinet Colors · Sizes · Collections · Top Material · Top Finish · Top Size ·
Single vs Double Sink · Mounting Type · Mirror Attach Rate · Faucet Attach Rate
· Collection × Size · Collection × Color · Cabinet Color × Top Finish ·
Restock Cadence (days between receipts, by collection)

**No price-band card.** See §1.

### Row 4 — Detail

- **Top 50 SKUs by observed drawdown** — full SKU, model, collection, colour,
  size, top, units/day, days observed
- **Snapshot history** — the validity table, so coverage is auditable
- **Unmapped SKUs** — count and list, per §3

### Trend view (the "trends" ask)

- **Monthly units/day by year**, one line per year, plus an all-years overlay —
  the chart form already settled on in analysis
- **Seasonal index**, year-normalised so trend does not contaminate season.
  Established baseline: peaks **March 117.8** and **October 114.1**; trough
  **December 74.9**; Feb 112.3 third-strongest; Jun/Jul and Nov soft
- **Same trend cut by collection, colour and size** — this is the part that
  earns the project: not just that the market fell, but *what* the market
  rotated into while it fell

National baseline to render against (from `WC_MARKET_ANALYSIS.md` §2):

| Year | Avg daily units | Index (2021=100) |
|---|---|---|
| 2021 | 616.1 | 100.0 |
| 2022 | 587.9 | 95.4 |
| 2023 | 762.9 | 123.8 ← peak |
| 2024 | 502.0 | 81.5 |
| 2025 | 487.0 | 79.0 |
| 2026 | 372.1 | 60.4 |

---

## 6. Build order

1. Migration — the four `wc_*` tables
2. Dimension loader from the catalogue xlsx; report unmapped coverage before
   building anything on top
3. Ingestion + rollup job (dual-schema parser, `gap == 1` enforced), with the
   XLSX/CSV fallback pattern used by `jmvMovementRollup.js`
4. Controller — queries per §5
5. View — four rows, with the "not our sales" labelling of §2.1
6. Nav entry under Marketing, beside JMV Reports
7. Cron wrapper, matching `jmv_rollup.sh`
8. Gate + mutation test: assert the suffix strip actually collapses
   configurations into models, assert no `gap > 1` delta is ever written, and
   assert unmapped SKUs appear in the output rather than vanishing

---

## 7. Open questions for Sam

1. **Snapshot history depth** — load all 1,628 days, or start at 2024-07 where
   coverage goes daily? Full history gives the 2023 peak and the seasonal index;
   the sparse early years need the `days_observed` caveat carried everywhere.
2. **Ingestion route** — Drive connector read, or re-download to a server drop
   zone like the JM feed? Affects whether this can run on cron unattended.
3. **Assortment overlay** — flag which WC SKUs we actually carry, so "selling
   nationally but we don't stock it" becomes a visible gap? Adds real value;
   adds a mapping to maintain.
4. **Does the feed still arrive daily?** Last snapshot in hand is 2026-11-23. A
   guard like `jm_feed_guard.sh` would be needed, and that script's own
   liveness problem is already logged as `OPEN_ITEMS.md` #16.
