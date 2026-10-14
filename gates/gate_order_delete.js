'use strict';
/* ─────────────────────────────────────────────────────────────────────────
 * gate_order_delete.js — the admin order delete, and the test-data cleanup.
 *
 * WHAT THIS GUARDS, in order of how much it would cost to get wrong:
 *
 *   1. THE KEEP LIST. BVO-2026-09-30-00118 is a real $1.99 payment. The
 *      cleanup script exists to delete everything else, so a bug that drops
 *      the keep clause takes the one row that mattered. Checked by executing
 *      the script's own constant, not by trusting a comment.
 *
 *   2. CAPTURED PAYMENTS ARE REFUSED. Money taken is the line past which a
 *      mis-click stops being recoverable. The refusal must be the default and
 *      must take a deliberate flag to override.
 *
 *   3. CHILDREN GO WITH THE PARENT. Only order_items has ON DELETE CASCADE.
 *      order_events, shipments, returns and sample_redemptions carry a
 *      nullable order_id with no constraint, so if the handler forgets one it
 *      leaves rows pointing at an id that no longer exists — and nothing
 *      fails loudly when that happens.
 *
 *   4. THE SNAPSHOT IS WRITTEN FIRST. order_deletions is the only record of
 *      what was removed. Written after the DELETE it would capture nothing.
 *
 *   5. ROUTE ORDER. '/orders/bulk-delete' declared after '/orders/:id' is
 *      swallowed by the :id route — a silent 400 on every bulk delete.
 * ───────────────────────────────────────────────────────────────────────── */

const path = require('path');
const fs   = require('fs');
const ROOT = path.join(__dirname, '..');

let pass = 0, fail = 0;
function check(cond, label, why) {
  if (cond) { console.log('  ok   ' + label); pass++; }
  else { console.log('  FAIL ' + label + (why ? '\n         ' + why : '')); fail++; }
}

const CTRL   = fs.readFileSync(path.join(ROOT, 'src/controllers/ordersController.js'), 'utf8');
const ROUTES = fs.readFileSync(path.join(ROOT, 'src/routes/admin.js'), 'utf8');
const CLEAN  = fs.readFileSync(path.join(ROOT, 'scripts/cleanupTestOrders.js'), 'utf8');
const LIST   = fs.readFileSync(path.join(ROOT, 'views/pages/admin/orders/index.ejs'), 'utf8');
const DETAIL = fs.readFileSync(path.join(ROOT, 'views/pages/admin/orders/detail.ejs'), 'utf8');
const MIG    = fs.readFileSync(path.join(ROOT, 'migrations/2026-10-12_order_deletions_RUNME.sql'), 'utf8');

/* ── 1. route order ──────────────────────────────────────────────────── */
console.log('--- routes ---');
{
  /* Comments are stripped FIRST. The route file explains in a comment why
     bulk-delete must come first, and that comment mentions the path — so a
     raw indexOf finds the explanation, not the route, and the ordering check
     silently passes however the routes are actually ordered. */
  const RC = ROUTES.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  const bulk = RC.indexOf("router.post('/orders/bulk-delete'");
  const byId = RC.indexOf("router.get ('/orders/:id'");
  check(bulk !== -1, 'the bulk-delete route exists');
  check(byId !== -1, 'the detail route exists');
  check(bulk !== -1 && byId !== -1 && bulk < byId,
        'bulk-delete is declared BEFORE /orders/:id',
        'Express matches in order; declared after, every bulk delete 400s on parseInt("bulk-delete")');
  check(/router\.post\('\/orders\/:id\/delete'/.test(RC), 'the single-delete route exists');
  /* Anchored at line start on the stripped source: commenting the line out
     must not read as "still there". */
  check(/^\s*router\.use\(requireAdmin\);/m.test(RC),
        'admin routes are behind requireAdmin — delete is not reachable unauthenticated',
        'commented out, every delete endpoint is open to the internet');
}

/* ── 2. executed: the delete itself, against a stub ──────────────────── */
console.log('--- executed: deleteOneOrder ---');
{
  const dbPath = require.resolve(path.join(ROOT, 'src/config/database'));
  require.cache[dbPath] = {
    id: dbPath, filename: dbPath, loaded: true,
    exports: { bvoPool: { getConnection: async () => ({ release() {} }) } },
  };
  delete require.cache[require.resolve(path.join(ROOT, 'src/controllers/ordersController'))];
  const { __deleteInternals } = require(path.join(ROOT, 'src/controllers/ordersController'));
  const { deleteOneOrder, ORDER_CHILD_TABLES } = __deleteInternals;

  /* A connection that records every statement, so the ORDER of operations is
     assertable rather than assumed. */
  const makeConn = (order) => {
    const sql = [];
    return {
      sql,
      query: async (q, params) => {
        sql.push(q.replace(/\s+/g, ' ').trim());
        if (/SELECT \* FROM orders/.test(q))   return [order ? [order] : []];
        if (/SELECT COUNT\(\*\)/.test(q))      return [[{ n: 2 }]];
        return [{ affectedRows: 1 }];
      },
    };
  };
  const ORDER = {
    id: 7, order_number: 'BVO-TEST-0007', total: 1.99,
    status: 'pending', payment_captured_at: null,
  };

  (async () => {
    /* -- the happy path ------------------------------------------------ */
    let c = makeConn(ORDER);
    let r = await deleteOneOrder(c, 7, { actor: 'gate', reason: 'test' });
    check(r.ok === true, 'an uncaptured order deletes');

    const iIns = c.sql.findIndex(s => /INSERT INTO order_deletions/.test(s));
    const iDel = c.sql.findIndex(s => /DELETE FROM orders/.test(s));
    check(iIns !== -1, 'a snapshot row is written to order_deletions');
    check(iIns !== -1 && iDel !== -1 && iIns < iDel,
          'the snapshot is written BEFORE the order is deleted',
          'written after, it would capture a row that no longer exists');

    /* The expected list is HARDCODED here on purpose. Looping over the
       module's own ORDER_CHILD_TABLES would mean deleting a table from that
       constant also deletes the assertion that covers it — the check would
       keep passing while shipments quietly stopped being cleaned up. */
    const MUST_CLEAN = ['order_events', 'shipments', 'returns', 'sample_redemptions'];
    for (const t of MUST_CLEAN) {
      check(ORDER_CHILD_TABLES.includes(t),
            `${t} is still listed in ORDER_CHILD_TABLES`,
            'dropped from the constant, its rows outlive the order they belong to');
      check(c.sql.some(s => new RegExp(`DELETE FROM \`?${t}\`? WHERE order_id`).test(s)),
            `${t} rows are deleted with the order`,
            'only order_items cascades; this one would be orphaned');
    }
    check(!c.sql.some(s => /DELETE FROM `?order_items`?/.test(s)),
          'order_items is NOT deleted by hand — fk_item_order ON DELETE CASCADE owns it');

    /* -- the captured-payment refusal ---------------------------------- */
    const CAPTURED = { ...ORDER, payment_captured_at: '2026-09-30 11:04:00' };
    c = makeConn(CAPTURED);
    r = await deleteOneOrder(c, 7, { actor: 'gate' });
    check(r.ok === false && r.skipped === 'payment_captured',
          'an order with a captured payment is REFUSED by default');
    check(!c.sql.some(s => /DELETE FROM/.test(s)),
          'and nothing at all is deleted on that refusal',
          'a refusal that still removed the children would be worse than no refusal');

    c = makeConn(CAPTURED);
    r = await deleteOneOrder(c, 7, { actor: 'gate', confirmCaptured: true });
    check(r.ok === true, 'confirmCaptured:true is the ONLY way past that refusal');

    /* -- a missing order is not an error, and deletes nothing ---------- */
    c = makeConn(null);
    r = await deleteOneOrder(c, 999, { actor: 'gate' });
    check(r.ok === false && r.skipped === 'not_found', 'a missing order reports not_found');
    check(!c.sql.some(s => /DELETE FROM/.test(s)), 'and issues no DELETE at all');

    /* -- it never touches products or customers ------------------------ */
    c = makeConn(ORDER);
    await deleteOneOrder(c, 7, { actor: 'gate' });
    check(!c.sql.some(s => /DELETE FROM `?(products|customers)`?/i.test(s)),
          'deleting an order never deletes a product or a customer',
          'orders.customer_id is ON DELETE SET NULL in the other direction; this must not reach back');

    /* The refusal is only as good as what the HTTP handlers pass in.
       deleteOneOrder is exercised above; this covers the wiring around it,
       which is where a hardcoded true would neutralise the whole guard. */
    const CTRL_NC = CTRL.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    check(!/confirmCaptured:\s*true/.test(CTRL_NC),
          'no handler hardcodes confirmCaptured: true',
          'that one word turns the captured-payment refusal into decoration');
    check((CTRL_NC.match(/confirmCaptured:\s*!!\(req\.body/g) || []).length === 2,
          'both the single and bulk handlers derive confirmCaptured from the request body');

    /* ── 3. the cleanup script's keep list ───────────────────────────── */
    console.log('--- the one-off cleanup ---');
    /* Matched against the CONSTANT, not the file. The script's header
       comment also names the order, so a bare substring search passes even
       when KEEP_ORDER_NUMBERS has been emptied — which is the one mistake
       that deletes the real payment. */
    const keepDecl = (CLEAN.match(/const KEEP_ORDER_NUMBERS\s*=\s*\[([^\]]*)\]/) || [])[1] || '';
    check(/BVO-2026-09-30-00118/.test(keepDecl),
          'KEEP_ORDER_NUMBERS itself contains BVO-2026-09-30-00118 — the real $1.99 payment',
          'this is the row the whole cleanup exists to preserve');
    check(keepDecl.trim().length > 0,
          'and the keep list is not empty');
    check(/NOT IN \(\$\{placeholders\}\)/.test(CLEAN) || /NOT IN \(/.test(CLEAN),
          'targets are selected with NOT IN against the keep list, not by a hardcoded id range');
    check(/const EXECUTE = process\.argv\.includes\('--execute'\)/.test(CLEAN) &&
          /if \(!EXECUTE\)/.test(CLEAN),
          'dry run is the DEFAULT and --execute is the only way past it');
    check(/REFUSING: these keep-list orders are not in the table/.test(CLEAN),
          'GUARD: it refuses to run if a keep-list order number is not found',
          'a typo in the constant would otherwise read as "keep nothing"');
    /* The guard is the filter and the early return, not the wording of the
       message — a mutation that only softens the text must still fail. */
    const CLEAN_NC = CLEAN.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    check(/const captured = targets\.filter\(t => t\.payment_captured_at\)/.test(CLEAN_NC) &&
          /if \(captured\.length\)/.test(CLEAN_NC) &&
          /process\.exitCode = 3/.test(CLEAN_NC),
          'GUARD: it detects captured payments among the targets and exits 3 without deleting',
          'checked as logic, not as a log message');
    check(/require\('\.\.\/src\/controllers\/ordersController'\)/.test(CLEAN) &&
          /deleteOneOrder/.test(CLEAN),
          'it calls the SAME deleteOneOrder the button calls, not its own SQL',
          'a private copy is how the two drift when a new child table appears');
    check(!/DELETE FROM/i.test(CLEAN),
          'and issues no DELETE statement of its own');

    /* ── 4. the UI ───────────────────────────────────────────────────── */
    console.log('--- the admin UI ---');
    check(/id="ord-bulk-delete"/.test(LIST), 'the list has a bulk delete control');
    check(/class="ord-select"/.test(LIST),   'and a per-row checkbox carrying the order id');
    check(/colspan="10"/.test(LIST),
          'the empty-state colspan was bumped to 10 for the new column',
          'left at 9 the "No orders found" cell under-spans and the table breaks');
    check(/window\.prompt\(/.test(LIST) && /Type {2}DELETE {2}to confirm/.test(LIST),
          'bulk delete requires typing DELETE, not just an OK',
          'a plain confirm on an irreversible multi-row delete is muscle-memory within a week');
    check(/toUpperCase\(\) !== 'DELETE'/.test(LIST),
          'and the check is case-insensitive on the word, not on a changing count',
          'the count version failed in real use: the instruction sat under a 12-line list');
    check(/function deleteOrder\(/.test(DETAIL), 'the detail page has a delete handler');
    check(/typed\.trim\(\)\.toUpperCase\(\) !== 'DELETE'/.test(DETAIL) ||
          /typed\.trim\(\) !== orderNumber/.test(DETAIL),
          'the detail-page delete requires a typed confirmation');
    /* Both list paths use the same word, so there is one thing to learn and it
       does not change with the selection. Asking for the order number read as
       a broken button twice before this changed. */
    check((LIST.match(/toUpperCase\(\) !== 'DELETE'/g) || []).length === 2,
          'BOTH list paths (row and bulk) confirm with the word DELETE',
          'a 20-character order number is not a confirmation, it is a transcription test');
    check(/confirm_captured/.test(DETAIL) && /confirm_captured/.test(LIST),
          'both paths can pass confirm_captured, so the refusal is overridable from the UI');

    /* ── 5. the migration ────────────────────────────────────────────── */
    console.log('--- the audit table ---');
    check(/CREATE TABLE IF NOT EXISTS `order_deletions`/.test(MIG), 'order_deletions is created');
    check(/order_snapshot`?\s+JSON/.test(MIG), 'it stores the whole row as JSON, not selected columns');
    check(/payment_captured_at`?\s+DATETIME/.test(MIG),
          'it records whether money had been captured');
    check(!/FOREIGN KEY/.test(MIG),
          'it carries NO foreign key to orders — the parent is gone by design');

    /* ── 6. no soft-delete creep ─────────────────────────────────────── */
    console.log('--- it stayed a hard delete ---');
    /* Comments are stripped first: this file EXPLAINS why there is no
       deleted_at, so a bare substring search matches its own rationale. The
       check is about executable code, so it has to look at executable code. */
    const CTRL_CODE = CTRL
      .replace(/\/\*[\s\S]*?\*\//g, '')     // block comments
      .replace(/^\s*\/\/.*$/gm, '');        // line comments
    check(!/deleted_at/.test(CTRL_CODE),
          'the controller has no deleted_at column — this is a hard delete',
          'a flag would need filtering in ~30 read sites; one miss corrupts a revenue KPI silently');
    check(!/UPDATE orders SET[^;]*deleted/i.test(CTRL_CODE),
          'and no UPDATE pretends to delete by setting a flag');

    console.log('');
    console.log(fail === 0
      ? `gate_order_delete: all ${pass} checks pass`
      : `gate_order_delete: ${fail} FAILED, ${pass} passed`);
    process.exit(fail === 0 ? 0 : 1);
  })().catch(e => { console.error('gate crashed: ' + e.stack); process.exit(1); });
}
