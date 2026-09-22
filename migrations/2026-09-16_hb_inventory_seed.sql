/* ============================================================================
   Huntington Brass — seed inventory quantities
   2026-09-16

   WHY THIS EXISTS
   ---------------
   importHuntingtonBrass.js never writes to `inventory` (verified: zero
   references to the table in that file). So every HB product has no inventory
   row at all, COALESCE(inv.qty_on_hand, 0) evaluates to 0, and the storefront
   treats all 905 of them as out of stock — disabled Add to Cart, an OUT OF
   STOCK badge, and schema.org/OutOfStock in the JSON-LD.

   Huntington Brass does not publish stock numbers. Their public Shopify feed
   exposes only an `available` boolean per variant, never a count. These
   quantities are therefore assigned, not sourced — a random 3 to 8 per SKU,
   at the owner's direction.

   WHAT SHOPPERS SEE
   -----------------
   Nothing numeric. The storefront uses the quantity only as a boolean:
   Product.js sets  inStock = (qty_on_hand > 0) || allow_backorder,  and
   product.ejs renders a badge and enables the button off that. No "only 4
   left" claim reaches a customer page. Whether 3 or 8 lands on a given SKU
   makes no visible difference; it matters only in admin views and the
   search index's in_stock facet.

   RUN ORDER
   ---------
   Step 1 is a read. Confirm it says 905 before running Step 2.
   ============================================================================ */


/* --- STEP 1 — read only. Run this first and check the numbers. ------------ */

SELECT
  COUNT(*)                                        AS hb_products,
  SUM(i.product_id IS NOT NULL)                   AS already_have_inventory_row,
  SUM(i.product_id IS NULL)                       AS will_be_inserted,
  SUM(COALESCE(i.qty_on_hand, 0) > 0)             AS already_in_stock
FROM products p
LEFT JOIN inventory i ON i.product_id = p.id
WHERE p.brand = 'Huntington Brass'
  AND p.source_flag = 'csv';

/*  Expected: hb_products = 905, already_have_inventory_row = 0,
    will_be_inserted = 905, already_in_stock = 0.

    If already_have_inventory_row is NOT 0, stop and re-read Step 2 — the
    ON DUPLICATE KEY branch will re-randomise those existing rows.           */


/* --- STEP 2 — the write. ------------------------------------------------- */

INSERT INTO inventory (product_id, qty_on_hand, last_synced_at)
SELECT
  p.id,
  FLOOR(3 + RAND() * 6),      /* 3,4,5,6,7,8 — inclusive, uniform */
  NOW()
FROM products p
WHERE p.brand = 'Huntington Brass'
  AND p.source_flag = 'csv'
ON DUPLICATE KEY UPDATE
  qty_on_hand    = FLOOR(3 + RAND() * 6),
  last_synced_at = NOW();

/*  Column list deliberately matches importJamesMartinFeed.js upsertInventory()
    exactly — allow_backorder and reorder_point are left to their defaults,
    the same way every James Martin row was created.                         */


/* --- STEP 3 — verify. Run after Step 2. ---------------------------------- */

SELECT
  COUNT(*)              AS rows_total,
  MIN(i.qty_on_hand)    AS min_qty,      /* expect 3 */
  MAX(i.qty_on_hand)    AS max_qty,      /* expect 8 */
  ROUND(AVG(i.qty_on_hand), 2) AS avg_qty /* expect ~5.5 */
FROM products p
JOIN inventory i ON i.product_id = p.id
WHERE p.brand = 'Huntington Brass'
  AND p.source_flag = 'csv';

SELECT i.qty_on_hand, COUNT(*) AS n
FROM products p
JOIN inventory i ON i.product_id = p.id
WHERE p.brand = 'Huntington Brass' AND p.source_flag = 'csv'
GROUP BY i.qty_on_hand
ORDER BY i.qty_on_hand;

/*  Expect six rows, 3 through 8, roughly 150 each. Anything outside 3-8 means
    the FLOOR/RAND expression did not behave as intended — say so before the
    site is checked.                                                          */


/* --- ROLLBACK, if these need to come back out --------------------------- */

/*
DELETE i FROM inventory i
JOIN products p ON p.id = i.product_id
WHERE p.brand = 'Huntington Brass' AND p.source_flag = 'csv';
*/


/* --- AFTERWARDS ---------------------------------------------------------- */

/*  The search index carries its own in_stock flag and a qty-based ranking
    boost (searchSync.js: in_stock = qty_on_hand > 0, plus
    Math.min(qty_on_hand, 9) added to the score). It will keep showing these
    905 as out of stock until the sync job runs again.                       */
