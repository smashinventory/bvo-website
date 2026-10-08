'use strict';

/* inventory.js — the one quantity-only upsert for the inventory table.
 *
 * MOVED VERBATIM from src/jobs/importJamesMartinFeed.js, where it lived as a
 * private function. Not a rewrite: the SQL, the column list, the null guard
 * and the argument order are byte-identical to what the JMV importer has been
 * running in production. The extraction exists so the ER Vanities inventory
 * sync can call the same function instead of a second copy of it.
 *
 * WHAT IT DELIBERATELY DOES NOT TOUCH: allow_backorder and reorder_point.
 * Those are manager settings, configured in the admin product panel. A feed
 * updating quantity has no business resetting them, so they are absent from
 * both the INSERT column list and the ON DUPLICATE clause. On an existing row
 * this writes qty_on_hand and last_synced_at and leaves everything else as the
 * manager left it.
 *
 * THERE IS A SECOND UPSERT, AND IT IS NOT A DUPLICATE OF THIS ONE.
 * adminController._upsertInventory writes qty_on_hand, allow_backorder and
 * reorder_point, and leaves last_synced_at alone. That is the mirror image of
 * this function and it is correct: a human setting all three values should not
 * stamp the sync clock, and a sync should not overwrite the human's settings.
 * The two are complementary by design. Do not merge them.
 *
 * `conn` is anything with .query() — a pooled connection inside a transaction
 * (how the JMV importer calls it) or the pool itself (how the ERV sync calls
 * it). Keeping conn as the first argument is what let this move without
 * touching the existing call site.
 */

async function upsertInventory(conn, productId, qtyOnHand) {
  if (qtyOnHand === null) return;
  await conn.query(`
    INSERT INTO inventory (product_id, qty_on_hand, last_synced_at)
    VALUES (?, ?, NOW())
    ON DUPLICATE KEY UPDATE
      qty_on_hand    = VALUES(qty_on_hand),
      last_synced_at = NOW()
  `, [productId, qtyOnHand]);
}

module.exports = { upsertInventory };
