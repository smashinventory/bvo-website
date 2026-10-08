# BVO ⇄ RFLpos inventory sync — design brief

> Design brief for the BVO to RFLpos inventory sync.

**Date:** 2026-09-04
**Status:** **Phase 1 BUILT 2026-10-08.** Phase 2 (orders, BVO → RFLpos) still
not started. The original status line read "agreed in principle, not started.
Resume after the ER Vanities catalogue exists in BVO" — that prerequisite was
met on 2026-09-05 when the 78-SKU catalogue loaded, and the work resumed from
there. See §8.

---

## 1. The decision

Product content and inventory have **one owner each**, and neither writes the
other's data.

| Domain | Owner |
|---|---|
| Product content — descriptions, specs, images, documents, SEO | **BVO** |
| Inventory quantity | **RFLpos** |

This replaces an earlier idea of copying BVO's product fields into RFLpos. That
would have meant ~13 new columns plus **eight one-to-many child tables**
(images, attribute values, bullets, shipping boxes, certifications, documents,
components, accessories) and their UI, on top of core UltimatePOS files that
every upgrade overwrites. Splitting ownership removes all of it.

The only thing the two systems share is a **SKU**.

## 2. Scope

ER Vanities — our own brand. Approximately **45–75 vanity cabinet SKUs**,
cabinets only. James Martin is not involved in this pipeline at any point.

The SKUs do not exist in BVO yet. Creating them is a separate task and is the
prerequisite for everything below.

---

## 3. Phase 1 — inventory feed, RFLpos → BVO

### The key

**`variations.sub_sku`**, not `products.sku`.

In UltimatePOS the sellable unit is the variation, not the product. A single
product has one variation; a variable product has many. Stock is held per
variation per location. Matching on `products.sku` would break the moment a
product has more than one variation.

### The quantity

**Local Inventory**, which already exists and is already in production.

`business_locations.is_local` flags which locations count. The dashboard stock
alert and the Simple Stock Report both sum `variation_location_details
.qty_available` across those locations, grouped by variation. This was built
2026-08-12.

It matters because the five locations on business_id 1 are not equivalent:

`BL0001` Roswell · `BL0002` Norcross · `BL0003` Kennesaw ·
`BL0004` Factory INV · `BL0005` In-Ocean INV

Factory and In-Ocean stock is real but not sellable today. The `is_local` flag
is the existing answer to that, so the feed uses it rather than inventing a
second location policy.

**The phase 1 feed is the existing Local Inventory query with a SKU filter on
it.** Not a new mechanism.

### What phase 1 does not need

No reservation logic. Sales orders only begin to exist in RFLpos at phase 2, so
there is nothing to reserve against yet.

---

## 4. Phase 2 — orders, BVO → RFLpos

A BVO order becomes a **Sales Order** in RFLpos, which a rep reviews and
accepts.

### Why sales order and not draft

Draft is never used by RFL staff, so it was a candidate for repurposing. Sales
orders are the better host anyway:

- Already a first-class object with its own screens and permissions
- Line-level tracking via `so_quantity_invoiced` — three ordered, two shipped
  now is expressible; a draft cannot say that
- Converting to an invoice is a built-in flow. The rep "accepting" the order
  *is* that conversion
- `transactions.sales_order_ids` links the resulting sale back to the order

### Mechanics, confirmed in the code

- `transactions.type = 'sales_order'`
- `status` is `ordered` → `partial` → `completed`, maintained by
  `TransactionUtil::updateSalesOrderStatus()`
- **Stock is not deducted.** `TransactionUtil` line 4422 skips deduction for
  both draft and sales_order. Deduction happens when the rep converts it to an
  invoice.

That last point is what makes the whole design work: a commitment is recorded
without touching quantity, so nothing can drift.

---

## 5. Reservations — each system computes its own

The expensive version of this problem is a reserved count synchronised across
two systems. Avoided: **each side calculates from data it already owns.**

**BVO** knows its own open orders. It subtracts them from the on-hand figure
RFLpos publishes and shows the result on the site. RFLpos never needs to know
web orders exist.

**RFLpos** covers the counter with a pop-up when an in-person sale would break
a commitment.

### The pop-up rule

```
on_hand   = SUM(qty_available) across is_local = 1 locations, per variation
reserved  = SUM(quantity - so_quantity_invoiced)
            where type = 'sales_order' AND status IN ('ordered','partial')
available = on_hand - reserved

fire when  available < quantity being added
```

Worked through:

| On hand | Reserved | Rep selling | Available | Pop-up |
|---|---|---|---|---|
| 4 | 1 | 1 | 3 | no |
| 1 | 1 | 1 | 0 | **yes** |
| 3 | 2 | 2 | 1 | **yes** |

The third row is why the rule is written as a comparison rather than "last one
and it's spoken for" — a rule phrased that way misses multi-unit sales.

### Two properties it must have

**Fires on conflict, never on existence.** A warning that appears whenever a
SKU has any open order gets clicked through within a week and then protects
nothing. With thin stock on 45–75 cabinets, a genuine conflict will be rare,
which is exactly what keeps it credible.

**Fires early** — at the point the item is added to the sale, not at payment.
By the payment stage the rep has already told the customer they have it.

---

## 6. Open items

Deferred deliberately. None blocks the catalogue work.

1. **Confirm the `is_local` flags.** The column defaults to 0 and was set on
   2026-08-12. Verify Factory INV and In-Ocean INV are 0 before BVO quotes
   availability from it.
2. **Is `reserved` scoped to local locations too?** Consistency with `on_hand`
   says yes. Decide when building.
3. **Override handling — the real open question.** The pop-up is advisory; a
   rep can sell the unit anyway, and sometimes should. But a web order is then
   unfulfillable. Who is told, and how? If the answer is "nobody until the
   customer calls," the pop-up has moved the problem rather than solved it.
4. **Feed delivery.** Push or pull, and at what cadence. Cadence is the
   overselling window.
5. **Sales orders enabled?** Confirm the feature is switched on for the
   business. Staff may not use them today.

---

## 7. Prerequisite

Create the ER Vanities SKUs in BVO. Nothing above starts until that upload
sheet exists and the catalogue is loaded.

**Met 2026-09-05** — `database/migrations/applied-by-hand/2026-09-05_erv_load.sql`
loaded 78 SKUs, each carrying `rflpos_item_id`.

---

## 8. Phase 1 as built — 2026-10-08

### Two jobs, and why they are not one

| | owns | state |
|---|---|---|
| `services/rflposSync.js` | **Catalogue import.** Name, brand, price, description, image. Creates products pending approval. | Parked — the seven routes in `routes/admin.js` are commented out, `/sync*` returns 503. Kept for future full inventory file imports. |
| `jobs/ervInventorySync.js` | **Quantity updates, post-import.** Writes `inventory.qty_on_hand` and nothing else. | Live, daily cron. |

Sam's framing, 2026-10-08: *"The current set up can be leveraged for full
inventory file imports whereas path b is a separate but similar function that
does inventory updates only post import."*

The product sync **cannot** simply be re-enabled for ER Vanities. Four reasons,
each verified against the RFLPOS export on 2026-10-08:

1. Its upsert runs `UPDATE products SET name=?, brand=?, price=?, short_desc=?`.
   On these 78 rows that replaces written product names with POS SKU strings
   (`Bristol 29.5" Bathroom Vanity in Natural White Ash` → `Bristol-29.5-NWA-BG`).
2. It would rebrand all 78 to `Ethan Roth`, which is what RFLPOS still calls
   the brand. That breaks the brand-keyed featured sections, the
   `er-vanities` collection filter, and `modelKey`'s (model, brand) pairing.
3. Price would move on **71 of 71** comparable SKUs, consistently ~33% down
   (PR1269: BVO 1049.99 → RFLPOS 699.99). Its price source is a subquery for
   the most recent `transaction_sell_lines.unit_price_inc_tax` — the last
   counter sale, discounts included — and `NULL` for anything never sold,
   which `parseFloat(null) || 0` turns into **0**.
4. It matches on `rflpos_item_id = RFLPOS products.id`. These rows hold
   RFLPOS `products.sku`. Zero would match, so all 78 would be **INSERTED as
   duplicates** with `is_active=0`.

### `rflpos_item_id` IS AN OPAQUE KEY. DO NOT NORMALIZE IT.

The column holds **two different kinds of value** depending on which tool
wrote the row:

- rows created by `rflposSync.js` → RFLPOS `products.id`, an integer (`1269`)
- rows created by the 2026-09-05 hand-written load → RFLPOS `products.sku`
  (`PR1269`)

`ervInventorySync` matches the SKU form and is scoped to `brand = 'ER Vanities'`
so it cannot stray onto the other kind.

**RFLPOS SKUs are not all PR-shaped.** Of the 78 mapped products, 71 are
`PR####` and **7 are descriptive strings** — the five Kensington DOAK-MB
variants and the two Bridge Cabinets carry SKUs like
`Kensington-41.5-DOAK-MB` in RFLPOS itself. Across the wider 160-SKU export
there is a third convention, bare numerics like `100377`. A `/^PR\d+$/`
validator silently drops the seven. Gated.

**Do not tidy RFLPOS SKUs on the 78 mapped items.** Changing the SKU field
changes the match key, and those seven would stop receiving stock with no
error on either side. The RFLPOS **product name** field is free to edit — the
feed does not read it. (Sam edited four names on 2026-10-08 to add the
half-inch; harmless by design.)

**BVO `products.sku` is a different field and four disagree:**

| key | BVO `sku` | RFLPOS `SKU` → name |
|---|---|---|
| PR0989 | Kensington-59.5S-WH-BN | Kensington-59S-WH-BN |
| PR0995 | London-29.5-WH-BN | London-29-WH-BN |
| PR1029 | Oxford-47.5-CAMGRN-BG | Oxford-47-CAMGRN-BG |
| PR1016 | Windsor-59.5D-NVBLU-BG | Windsor-59D-NVBLU-BG |

Harmless while the match runs on `rflpos_item_id`; four silent misses the
moment anyone simplifies it to compare `sku`. Gated both statically and
end-to-end.

### Mapping audit, 2026-10-08

78 of 78 BVO products resolve to exactly one RFLPOS SKU. No duplicates either
direction, no case collisions, no whitespace padding. 82 RFLPOS SKUs have no
BVO product (tops, mirrors, components — expected per §2). Every mapped
product is `Single`; **none is multi-variation**, so `products.sku` and
`variations.sub_sku` agree today. The feed returns `sub_sku` anyway so the day
one becomes variable it is detected rather than summed.

### The `is_local` question from §6, resolved

Open item 1 asked for the flags to be confirmed. Sam, 2026-10-08:
*"`business_locations.is_local` is the total inventory on hand that we can sell
= available qty."* The flags themselves could not be read — the four local
backups are home-directory archives with no DB dump — but `is_local` has been
driving the dashboard stock alert since 2026-08-12, so a mis-set flag would
have been visibly wrong for two months.

Belt and braces anyway: the feed returns the `is_local` sum **and** the
all-locations sum, and the job logs every SKU where they differ. Those lines
are stock sitting at Factory INV or In-Ocean INV and deliberately not
published. A SKU appearing there that you expected to be sellable means a
location flag is wrong, not that the sync is wrong.

### Phase 1 is a port, not a new query

§3 said *"the existing Local Inventory query with a SKU filter on it. Not a new
mechanism."* Taken literally: the `action=inventory` SQL in `bvo_sync.php` is
`HomeController::getProductStockAlert()`'s join path and filters —
`enable_stock = 1`, `is_inactive = 0`, `variations.deleted_at IS NULL`, grouped
per variation. One deliberate difference: `is_local = 1` moves from the WHERE
clause into a `CASE` so one query yields both sums.

(A from-scratch draft of this query was written first and discarded. It used a
different join path and was missing `enable_stock` and `deleted_at` — the
exact failure mode OPEN_ITEMS §21 describes.)

### What it refuses to do

Three conditions abort the whole run rather than write a partial or
plausible-looking result:

1. **Empty feed.** Never a legitimate instruction to zero the catalogue.
2. **Zero matches** against a non-empty feed and a non-empty product set — the
   key convention has drifted.
3. **More than 50% of matched SKUs going to zero.** A broken join looks exactly
   like a simultaneous sell-out. 8 of 78 were at zero in the 2026-09-04 export,
   so the real figure sits near 10%.

Plus per-row rejection of negative, non-numeric and absurd quantities, and
multi-variation SKUs flagged and skipped.

### Files

```
src/utils/inventory.js              upsertInventory, moved verbatim out of
                                    importJamesMartinFeed.js so both callers
                                    share one upsert
src/jobs/ervInventorySync.js        the job
erv_inventory_sync.sh               daily cron wrapper, 06:30 UTC
gates/gate_erv_inventory_sync.js    48 checks
mutate_erv_inventory_sync.sh        31 mutations, all caught
bvo_sync.php                        action=inventory  (OUTSIDE the repo —
                                    uploaded to rflpos.com by hand)
```

`adminController._upsertInventory` was deliberately left alone. It writes
`qty_on_hand`, `allow_backorder` and `reorder_point` and leaves
`last_synced_at`; the shared helper does the mirror image. A human setting all
three should not stamp the sync clock, and a sync should not overwrite the
human's settings. Complementary, not duplicated — do not merge them.

### Zero stock drops an item from the bundle builder

`bundleController.js:190` requires `qty_on_hand > 0 OR allow_backorder = 1`.
A zero-stock ER cabinet keeps its product page and its indexing but disappears
from bundle step 2. Intended — you cannot bundle what you cannot ship — but
it is a visible consequence of the first run.

### Still open

- **The price gap is a business question, not a sync one.** 71 of 71 differ by
  roughly a third. Nothing in this job touches price, but if RFLPOS carries the
  intended retail figure then the website is overpricing ER Vanities.
- `bvo_sync.php` is **unlinted** — no PHP binary was available. Run `php -l`
  before uploading.
- Phase 2 (orders, BVO → RFLpos) unchanged and not started. Open items 2–5
  in §6 still stand.
