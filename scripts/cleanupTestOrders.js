'use strict';

/**
 * cleanupTestOrders.js — one-off removal of the build's test orders.
 *
 *   node scripts/cleanupTestOrders.js            # DRY RUN, lists and exits
 *   node scripts/cleanupTestOrders.js --execute  # actually deletes
 *
 * KEEP LIST. Everything not named here is removed. BVO-2026-09-30-00118 is a
 * real $1.99 payment and stays in the records; every other order in the table
 * was generated while building checkout.
 *
 * It calls the SAME deleteOneOrder() the admin delete button calls, rather
 * than issuing its own SQL. A cleanup script with a private copy of the
 * delete logic is how the two drift: the button learns to clear a new child
 * table, the script does not, and the orphans only show up months later.
 *
 * Dry run is the default and --execute is the only way past it, because the
 * difference between listing and deleting should never be a typo.
 */

const { bvoPool } = require('../src/config/database');
const { __deleteInternals } = require('../src/controllers/ordersController');
const { deleteOneOrder, countOrderChildren } = __deleteInternals;

const KEEP_ORDER_NUMBERS = ['BVO-2026-09-30-00118'];

const EXECUTE = process.argv.includes('--execute');

(async () => {
  const conn = await bvoPool.getConnection();
  let exitCode = 0;
  try {
    const placeholders = KEEP_ORDER_NUMBERS.map(() => '?').join(', ');

    /* GUARD 1 — every order number on the keep list must actually exist. A
       typo in the constant would otherwise read as "nothing to keep" and take
       the real payment with everything else. */
    const [keepRows] = await conn.query(
      `SELECT id, order_number, total, payment_captured_at
         FROM orders WHERE order_number IN (${placeholders})`,
      KEEP_ORDER_NUMBERS
    );
    const found = new Set(keepRows.map(r => r.order_number));
    const missing = KEEP_ORDER_NUMBERS.filter(n => !found.has(n));
    if (missing.length) {
      console.error('REFUSING: these keep-list orders are not in the table: ' + missing.join(', '));
      console.error('Either the number is wrong or the order is already gone. Nothing deleted.');
      process.exitCode = 2;
      return;
    }
    console.log('Keeping:');
    keepRows.forEach(r => console.log(
      `   ${r.order_number}  $${r.total}  ` +
      (r.payment_captured_at ? `captured ${r.payment_captured_at}` : 'not captured')
    ));
    console.log('');

    const [targets] = await conn.query(
      `SELECT id, order_number, total, status, created_at, payment_captured_at
         FROM orders
        WHERE order_number NOT IN (${placeholders})
        ORDER BY created_at`,
      KEEP_ORDER_NUMBERS
    );

    if (!targets.length) {
      console.log('Nothing to delete — the table already holds only the keep list.');
      return;
    }

    console.log(`${targets.length} order(s) to delete${EXECUTE ? '' : '  (DRY RUN)'}:`);
    for (const t of targets) {
      const c = await countOrderChildren(conn, t.id);
      const kids = Object.entries(c)
        .filter(([, n]) => n)                       // skip 0 and null
        .map(([k, n]) => `${k}:${n}`).join(' ') || 'no children';
      console.log(
        `   ${String(t.order_number).padEnd(24)} $${String(t.total).padStart(9)}  ` +
        `${String(t.status).padEnd(12)} ${new Date(t.created_at).toISOString().slice(0, 10)}  ` +
        `${kids}` + (t.payment_captured_at ? '  ** PAYMENT CAPTURED **' : '')
      );
    }

    /* GUARD 2 — a captured payment outside the keep list is not something a
       cleanup script should quietly destroy. Stop and let a human look. */
    const captured = targets.filter(t => t.payment_captured_at);
    if (captured.length) {
      console.error('');
      console.error(`REFUSING: ${captured.length} order(s) marked for deletion have captured payments:`);
      captured.forEach(c => console.error(`   ${c.order_number}  captured ${c.payment_captured_at}`));
      console.error('Add them to KEEP_ORDER_NUMBERS, or delete them individually from the admin');
      console.error('with confirm_captured if they really are test charges. Nothing deleted.');
      process.exitCode = 3;
      return;
    }

    if (!EXECUTE) {
      console.log('');
      console.log('DRY RUN — nothing was deleted. Re-run with --execute to proceed.');
      return;
    }

    await conn.beginTransaction();
    let done = 0;
    const skipped = [];
    for (const t of targets) {
      const r = await deleteOneOrder(conn, t.id, {
        actor:  'cleanupTestOrders.js',
        reason: 'build test data, cleared 2026-10-12',
        confirmCaptured: false,     // GUARD 2 already proved there are none
      });
      if (r.ok) done++; else skipped.push(r);
    }
    await conn.commit();

    console.log('');
    console.log(`Deleted ${done} order(s).`);
    if (skipped.length) {
      console.log(`Skipped ${skipped.length}:`);
      skipped.forEach(s => console.log(`   id ${s.id}  ${s.skipped}`));
    }

    const [[left]] = await conn.query('SELECT COUNT(*) AS n FROM orders');
    console.log(`orders table now holds ${left.n} row(s).`);
  } catch (err) {
    try { await conn.rollback(); } catch (_) {}
    console.error('cleanupTestOrders FAILED: ' + err.message);
    exitCode = 1;
  } finally {
    conn.release();
    await bvoPool.end().catch(() => {});
    if (exitCode) process.exitCode = exitCode;
  }
})();
