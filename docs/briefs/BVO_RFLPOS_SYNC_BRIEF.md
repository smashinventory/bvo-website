# BVO ⇄ RFLpos inventory sync — design brief

> Design brief for the BVO to RFLpos inventory sync.

**Date:** 2026-09-04
**Status:** agreed in principle, not started. Resume after the ER Vanities
catalogue exists in BVO.

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
