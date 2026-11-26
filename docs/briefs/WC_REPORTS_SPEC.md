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
7. ~~Cron wrapper, matching `jmv_rollup.sh`~~ — **NOT BUILT, BY DECISION
   (Sam, 2026-11-25). Do not build it.** See §9.
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

---

## 8. Operational notes from the live build (2026-11-25)

Two things cost real time on the first deploy. Both are recorded here because
neither is discoverable from the code alone.

### 8.1 Hostinger runs the app from a versioned build directory

The Node app does **not** run from the path File Manager shows
(`domains/<site>/nodejs/`). It runs from a per-deploy copy:

```
/home/u222311468/hbuilds/versions/<uuid>/nodejs/
```

The UUID **changes on every deploy**. So any `__dirname`-relative path to a
sibling data folder outside the app resolves to a directory that does not
exist, and is broken again the moment it is fixed.

Symptom: the rollup reported `0 snapshots processed, backlog clear` with 1,628
files sitting in the folder. A missing path, an unreadable directory, and
unmatched filenames all look identical from outside the process, and each wrong
guess costs a deploy.

Rules that follow:

- **Absolute paths via environment variables** for anything outside the app
  directory. Currently set: `WC_SNAPSHOTS_PATH`. Still needed:
  `WC_CATALOGUE_PATH`, which the dimension loader reads by relative path and
  which will hit the same wall.
- **Any job that reads from disk gets a diagnostic** that reports the resolved
  path, whether it exists, and what is in it — see `describeSnapshotsDir()`,
  surfaced on the admin page. Do not debug this class of problem by guessing.
- **This does not affect the JMV rollup**, which has run correctly for months:
  `jmv_rollup.sh` is invoked by system cron from the real directory, where
  `__dirname` resolves. The web-trigger path is the one that breaks. Do not
  assume a shared failure.

### 8.2 The validity gate was a one-way door — 400 of 1,628 days discarded

A row-count validity gate marks a snapshot invalid when it deviates more than
10% from the trailing 7-day median. The baseline was originally computed over
**days already marked valid**. That is a latch, not a gate:

> WC stepped its catalogue down on **2025-10-09**, 1,553 SKUs → 1,344, in a
> single day. Every day after that deviated 13.5% from a median frozen at
> 1,553, so every day was marked invalid — and being invalid, not one of them
> could move the median.

Replayed over the real row counts of all 1,628 snapshots: **400 days
discarded, 24.6% of the history, last valid day 2025-10-08.** Thirteen months
of the most commercially relevant data. The only visible symptom was one card
reading "No movement in this window".

The original comment on the threshold asserted the opposite and was the root
cause of the misjudgement: *"WC's SKU count drifts slowly, so a genuine
catalogue change never trips this."* WC does not drift. It holds flat for
months and then steps.

Three changes, all gated:

1. `getTrailingMedian` ignores `is_valid` — the baseline follows the actual
   counts, so a sustained step is absorbed within ~4 days while a single
   truncated file is still an outlier against six normal days. Replay after
   the fix: **4 days flagged instead of 400**, and those four are the step
   edge itself, which is honest — at the moment it happens, a real shrink and
   a truncated file are indistinguishable.
2. `recomputeValidity()` re-judges the whole series on every run from the row
   counts already stored, so a rule change lands on all of history without
   re-reading 1,628 CSVs.
3. `findUnbuiltValidDays()` rebuilds the deltas. This is the part that is easy
   to miss: `processSnapshot` returns **before** computing any delta on an
   invalid day, so flipping `is_valid` back on alone produces days that are
   marked valid and contain nothing — worse than invalid, because nothing on
   the dashboard says so.

Verified both directions: a half-length, 15%-short, empty, and doubled file
are all still rejected, a 5% trim is not, and one bad day does not
contaminate its neighbours. Section 10 of `gate_wc_inventory.js` pins all of
it against a stubbed connection, and `mutate_wc_inventory.sh` 11a–11d
reintroduce the bug by each route it could return by.

**The mutation harness earned its keep here.** The first version of section 10
tested `recomputeValidity` only — which carries its own window and never calls
`getTrailingMedian` — so restoring `AND is_valid = 1`, the actual original
bug, left the gate completely green. Two code paths decide validity; a test
that exercises one of them proves nothing about the other.

---

## 9. Ingestion: manual, by decision (2026-11-25)

**There is no cron, and that is deliberate. Do not build one.**

How the data arrives: Water Creation emails a CSV nightly. Everything in the
snapshots folder was put there by hand. Nothing fetches it.

Asked directly whether to automate — Apps Script push to an authenticated
endpoint, server-side IMAP pull, or Gmail→Drive→pull — Sam's answer was:

> "I dont need this automated. I will do an upload every so often as needed."

So the operating model is: upload a batch of CSVs when it matters, press
**Run rollup**, done. The rollup is built for exactly this — it is resumable,
idempotent, re-decides validity across the whole series each run, and rebuilds
any deltas it finds missing. A six-month gap followed by one bulk upload lands
correctly; nothing needs to run nightly for the numbers to be right.

**Staleness is already visible and needs no alert.** The page header reads
"Data through YYYY-MM-DD", so the age of the data is the first thing on the
report. That is what a staleness banner would have told you, without the code.

### If this is ever revisited

Three routes were costed. The deciding factor is where the credentials live:

| Route | Credentials | Cost |
|---|---|---|
| Apps Script → authenticated BVO endpoint | none on the server | new endpoint, must be locked to CSV + one directory + shared secret |
| Server-side IMAP pull | Gmail app password in server env | new npm dependency, matches `jmv_rollup.sh` pattern |
| Gmail filter → Drive → server pulls | Drive API | two hops to keep working |

⚠️ Nothing in this codebase reads email today — no IMAP client, no mail
parser, no Gmail dependency. Any of these is net-new work, not wiring.

⚠️ And whatever runs it, an inbound upload endpoint is a file-write primitive
pointed at the server. It must be constrained to CSV, to one fixed directory,
and to an authenticated caller — never a general write.

---

## §10 — RFL overlay on the trend chart (2026-11-26)

**What it is.** An optional second line on the trend chart: RFL showroom
sales, monthly, next to the WC national drawdown line. Off by default,
toggled by "Map against".

**Scaling.** Both series are plotted as **units per day on one shared
y-axis**. No second axis — two scales would let either line be stretched
until the pair appeared to move together, which invents a correlation. The WC
denominator is *observed* days (span_days); RFL's is *calendar* days in the
month. Different quantities, so they carry different names in the code
(`days` vs `cal`) — when both were called `days` the gate could be satisfied
by the wrong accumulator, and the mutation harness proved it.

**Units are a proxy, by decision.** RFL reports dollars. Units =
`net_sales / RFL_UNIT_PRICE`, one constant in wcReportsController.

`RFL_UNIT_PRICE = 1000` — **RFL's own average ticket across the 4.5 years of
sales data in scope** (Sam, 2026-11-26). Observed, not inferred: it is what
RFL actually transacts at, measured over the whole span the chart covers.

It replaced a derived $1,430, and the reason is worth keeping. That figure
came from Home Depot retail on base configurations of the three best-selling
collections (Palace ~$1,948 across 60"/72" double-sink only, Madison ~$1,144,
Queen ~$1,200). HD list is a *retail reference* and RFL discounts off it, so
dividing RFL dollars by HD list understated units by roughly 30%. Do not
re-derive this divisor from published retail prices.

It is not preferred over real data: `rfl_monthly_sales.units` wins wherever a
row carries it (`COALESCE(units, net_sales / ?)`), so supplying a true unit
count retires the divisor entirely for that month.

One divisor covers both eras, because one number is what the evidence
supports. If the ticket is ever found to differ materially between the GVS
Shopify years and the RFLPOS years, this becomes a per-source lookup and the
division moves inside the SUM.

Non-vanity categories (tile, flooring, faucets) stay in the dollar figure.
Sam, 2026-11-26: they have always run under 10% of revenue — they move the
level slightly, not the shape, and the shape is what the chart is read for.

**The GVS seam is drawn, not smoothed.** Pre-2024 GVS Shopify and post-2024
RFLPOS are separate datasets with separate legend entries, the earlier one
labelled low-confidence, because WC_MARKET_ANALYSIS §1 records a 2.5× level
shift across that system change with no business event behind it. One
continuous line across the boundary would present a migration as growth.

**Monthly grain only.** RFL is held monthly, so the overlay is available at
Monthly / Quarterly / Annual and the control says "monthly grain only" at
Daily and Weekly. An empty line is the honest answer at those grains;
interpolation is not.

**Loading.** Manual, by decision — no cron, no watcher:
`node scripts/loadRflMonthlySales.js <file.csv> --source=rflpos|gvs_shopify`
(`--dry` to validate first). `--source` is required and never inferred from
the date, so a backfill crossing 2024-01 cannot be silently mislabelled.
Rejected rows are listed, never dropped quietly. Re-running a file overwrites
by (month, store, source).

Gate: `gate_wc_inventory.js` §13 (8 checks). Mutations: `mutate_wc_inventory.sh`
14a–14h, all caught.

### §10.1 — What was actually loaded (2026-11-26)

**RFLPOS, 2024-01 → 2026-11. Real units, no divisor.** 91 month×store rows,
$4,620,197 net of returns, **3,250 vanity units** counted from
`transaction_sell_lines` joined to products in the vanity categories
(49 Bathroom Vanities, 151 Vanities, 158 Special Order Vanities, 159 24"
Vanities). Only `sell`/`final`; `sell_return`/`final` netted off;
`Factory INV` and `In-Ocean INV` excluded as warehouses, not showrooms.
Stores: Roswell, Norcross, Kennesaw.

Because these rows carry a true `units` value, `COALESCE(units, net_sales/?)`
takes the count and **RFL_UNIT_PRICE is never applied to the 2024+ line.**

Reconciliation: these net figures land 3–5% under the gross store figures on
record (Roswell $603,056 vs $622,788; Kennesaw $724,944 vs $761,054). The gap
is the returns, which is the expected direction and size.

**GVS Shopify, 2021-08 → 2023-12. Dollars only.** 29 rows, $1,852,120, units
NULL. `net_items_sold` was re-checked and is still unusable — 2,278 items on
6 orders (Feb-21), 2,505 on 70 (May-23), 1,568 on 47 (Oct-23): the tile and
flooring contamination recorded in WC_MARKET_ANALYSIS §1. Jan–Jul 2021 was
left out as pre-launch (3.6 orders/month average). 2024-01 Shopify ($5,855,
3 orders) was left out too: RFLPOS already covers that month, and loading
both would double-count it, since rflSeries groups by month across sources.

**⚠️ THE SEAM AT 2024-01 IS PARTLY ARITHMETIC.** The RFLPOS data implies
**$1,422 per vanity unit** net of returns. The GVS line divides by
RFL_UNIT_PRICE = $1,000, the average *ticket* — a different denominator,
because a ticket often carries a top, mirror or delivery alongside the
vanity. So the pre-2024 line converts ~42% more units per dollar than the
post-2024 line does, and the step down at the seam overstates any real
decline. Sam chose $1,000 knowingly (2026-11-26) — recorded here so nobody
later reads that step as a business event. Changing it is one constant.

**Norcross opens and closes inside the window** ($682K in 2024, last month
2025-09). The combined line steps down when it closes. That one is real.

### §10.2 — Pre-2024 GVS rows REMOVED (2026-11-26)

The 29 `gvs_shopify` rows loaded earlier that day were deleted the same day.
They were not wrong about the store they came from; they were wrong about
what they represented.

**What they actually were.** `bathroom-vanities-outlet.myshopify.com`
("Bathroom Vanities Outlet" — not today's BVO), 2021-08 → 2023-12,
$1,878,637. Channel split: Point of Sale $1,820,103 / 1,998 orders, Online
Store $58,135 / 99, Google Shopping $399 / 1. So 97% genuine showroom POS,
and it reconciles with WC_MARKET_ANALYSIS §1's GVS figure (2,000 orders /
$1,935,076). A `pos_location_name` breakdown returns a single undifferentiated
location literally named "Renovate for Less Outlet" — no per-showroom split
exists in that store, exactly as §1 recorded.

**Why they were removed.** Sam, 2026-11-26: each showroom ran its OWN Shopify
POS — ShopifyBVO, ShopifyGVS, ShopifyBVP. The connector reaches only one of
the three, so these rows are ONE store's business, while the post-2024
RFLPOS rows cover all three showrooms. Loaded together:

    pre-2024   ~$64.8K/month   partial coverage (1 of 3 stores)
    post-2024  ~$132K/month    full coverage   (3 showrooms)

— roughly a 2x step at the 2024-01 seam created purely by stores appearing in
the data, on top of the divisor step already recorded in §10.1. A reader
would see the business doubling at exactly the system change. Same failure
class as the 2025-08-25 liquidation: plausible-looking, measuring the wrong
thing.

Sam's belief that this store was Norcross-only does not fit the dates — it is
already doing $68K in October 2021, and §1 has Norcross opening May 2022. So
it is at minimum one earlier showroom. Which one is unresolved and does not
matter for the decision: whichever it is, it is one of three.

**To restore the pre-2024 line properly**, all three Shopify POS exports are
needed, summed per month, loaded with `--source=gvs_shopify`. The generated
SQL for the partial load is still at `load_rfl.sql` in the project folder if
the single-store series is ever wanted deliberately and labelled as such.
Until then the RFL line starts 2024-01, where coverage is complete and the
units are real counts rather than a dollar proxy.

### §10.3 — Pre-2024 RELOADED from all three Shopify POS stores (2026-11-26)

§10.2's removal is reversed, properly. Sam supplied the two missing stores,
so the pre-2024 line is now complete coverage rather than one store in three.

| store (Shopify) | showroom | months | net sales |
|---|---|---|---|
| `reno4lessroswell` | 5120 Old Ellis Point, Roswell | 2021-02 → 2023-12 | $2,385,286 |
| `bathroom-vanities-outlet` | single unsplit POS location | 2021-01 → 2023-12 | $1,878,637 |
| `bathvanitiesplus` | Kennesaw Mall Showroom, Marietta | 2023-03 → 2023-12 | $490,085 |
| **combined, loaded** | | **36 months** | **$4,754,008** |

All figures are **net sales** = gross − discounts − sales reversals, the same
basis as the RFLPOS rows, so returns are netted on both sides of the seam.

Reconciliation before loading: BVP's subtotal equals its lifetime dashboard
figure exactly ($533,242.35 gross), so that store lived only Mar–Dec 2023 and
cannot overlap 2024. BVO matches the earlier ShopifyQL pull to the cent.
Roswell's Feb-21→Dec-23 subset sits inside its Jan-18→Dec-23 total of
$3,148,798, leaving $763K for 2018–Jan 2021 — consistent with its ramp.

Bounded at 2023-12. BVO shows $5,855 on 3 orders in 2024-01; dropped, because
RFLPOS already covers that month and `rflSeries` sums across sources per
month, so an overlap would double-count.

**⚠️ THE 2023→2024 COMPARISON IS DIVISOR-DEPENDENT, AND ITS SIGN FLIPS.**
Pre-2024 divides dollars by the $1,000 ticket; post-2024 uses measured units
implying ~$1,422 per vanity (§10.1). On the chart that reads
4.9 → 3.8 units/day, a 23% fall. Re-run the pre-2024 side at $1,422 and the
same data reads 3.5 → 3.8, a 10% RISE. The seam cannot settle the direction
of that one step, and nobody should read it as if it could.

**For RFL's own trend, read dollars, not the units proxy** — no divisor, no
ambiguity:

    2021 $1.12M · 2022 $1.83M · 2023 $1.80M · 2024 $2.01M
    2025 $1.62M · 2026 $0.99M (11 months, ~$1.08M annualised)

Peak 2024, then −46% to 2026 annualised. The units proxy exists only so the
RFL line can share an axis with WC; it is not the better measure of RFL.

Still unresolved: which showroom `bathroom-vanities-outlet` is. It bills
$68K in October 2021 while WC_MARKET_ANALYSIS §1 has Norcross opening May
2022, so either that date is wrong or the store served an earlier location.
It does not affect the arithmetic — all three are summed regardless.

### §10.4 — Norcross identified; pre-2024 put on a POS-only basis (2026-11-26)

**`bathroom-vanities-outlet` is Norcross.** Sam: lease signed May 2021,
selling from Sept/Oct 2021. The channel split confirms it — POS revenue is
nil through July 2021, then $14,794 (20 orders) in August, $25,576 (34) in
September, $64,619 (87) in October. WC_MARKET_ANALYSIS §1's "Norcross opened
May 2022" is wrong: May 2021 is the lease, not the opening, and the year is
off by one. §1 should be corrected.

(One oddity left alone: Feb 2021 carries $13,047 of POS on 4 orders, with
nothing either side until August. Pre-opening sales rung up on that register,
most likely. Too small to chase.)

**Basis corrected while confirming it.** Roswell's export ran
`WHERE is_pos_sale = true` and BVP's was grouped by POS location — both
POS-only — but the Norcross figures had been pulled across ALL channels, so
they carried ~$58K of Online Store revenue the other two excluded. Two bases
in one series. Reloaded with `is_pos_sale = true` on all three:

    was  36 months, 2021-01 .. 2023-12, $4,754,008   (mixed basis)
    now  35 months, 2021-02 .. 2023-12, $4,695,474   (POS only)

2021 $1,098,153 · 2022 $1,811,986 · 2023 $1,785,335. The 1.2% difference does
not move the chart; the point is that every month in the series now counts
the same thing, and the pre-2024 line is showroom trade only — which is what
it is being compared against.

2021-01 drops out: its only activity was two online orders.

### §10.5 — Norcross opening sequence, and the Feb-2021 anomaly resolved

Sam, 2026-11-26: lease May 2021, **soft open August 2021, grand opening
October 2021**. The Norcross POS figures track that exactly, which is a
useful independent check that the store mapping is right:

    Jul 2021   $0        — not trading
    Aug 2021   $14,794   20 orders   soft open
    Sep 2021   $25,576   34 orders   ramping
    Oct 2021   $64,619   87 orders   grand opening

**The Feb-2021 anomaly.** §10.4 left $13,047 on 4 Norcross orders sitting six
months before the soft open. Sam's reading was that these were online orders
on the old Shopify BVO site; the data disagrees in detail — they carry
`is_pos_sale = true`, so they were rung through the register, most plausibly
online orders keyed in by hand. The conclusion is the same either way: no
showroom was trading in February 2021, so the amount is not showroom trade
and does not belong in a showroom series.

Removed from the combined figure. Feb 2021 is now Roswell only:

    was  $117,585.13  (Roswell $104,537.93 + Norcross $13,047.20)
    now  $104,537.93  (Roswell only)
    series total  $4,695,474 -> $4,682,427

Roswell's own Feb-2021 trade is untouched; that showroom was open.

Worth noting what this does NOT do: it does not remove the amount from
Shopify, and anyone reconciling the chart against the Norcross dashboard will
find a $13,047 difference. That is intended and is why it is written down.

### §10.6 — Divisor $1,000 → $850, from the books (2026-11-26)

Sam checked the books: the pre-2024 average ticket is **$850** — $150 BELOW
the blended $1,000, not above it. The earlier years transacted at a lower
ticket than the span average, which is the direction you would expect.

(It was briefly set to $1,150 the same day: the $150 was added instead of
subtracted. Corrected within the hour. Recorded because the intermediate
value shipped and someone comparing screenshots will otherwise wonder.)

This is a pre-2024 number and it only ever applies pre-2024, because the
divisor is reached only where a row has no counted units
(`COALESCE(units, net_sales / ?)`). Every RFLPOS row carries a figure counted
from the sell lines, so the divisor never touches 2024 onward. Setting it to
the Shopify era's own ticket is therefore strictly better than the blended
one it replaces — the blend was averaging in years the constant never
governs.

Effect on the pre-2024 line:

| year | dollars | units @ $1,000 | units @ $850 |
|---|---|---|---|
| 2021 (Feb–Dec) | $1,085,106 | 1,085 | **1,277** |
| 2022 | $1,811,986 | 1,812 | **2,132** |
| 2023 | $1,785,335 | 1,785 | **2,100** |

**The 2024 seam, which is what the divisor was always really about:**

    $1,422   3.44 -> 3.80 units/day   +10.6%
    $1,150   4.25 -> 3.80 units/day   -10.6%
    $1,000   4.89 -> 3.80 units/day   -22.2%
      $850   5.75 -> 3.80 units/day   -33.9%   <- current

§10.3 flagged that this step's SIGN was divisor-dependent, and the table
above is why that warning was worth making: across the range of values this
constant has plausibly taken, the same data has read anywhere from +11% to
−34%. What has changed is that $850 is measured for the period it governs
rather than estimated across periods, so −33.9% is the best available read of
that step. It is not a resolved one. Treat the 2023→2024 change as the
weakest number on the chart.

Fourth value this constant has taken: $1,430 (inferred from Home Depot
retail), $1,000 (blended observed), $1,150 (slip), $850 (pre-2024 observed).

Unchanged: for RFL's own trend, read dollars. They need no divisor and carry
none of this ambiguity: 2021 $1.09M · 2022 $1.81M · 2023 $1.79M ·
2024 $2.01M · 2025 $1.62M · 2026 $0.99M (11 months).
