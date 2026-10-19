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
 *
 *   6. EVERY COLUMN READ OFF THE ORDER ROW MUST EXIST. Added 2026-10-19,
 *      after this gate passed 61 checks over a snapshot line that read
 *      `order.stripe_payment_intent_id ?? order.stripe_payment_intent` —
 *      two column names the orders table has never had. Every one of the
 *      eleven real deletions recorded NULL for the payment intent.
 *
 *      The gate validated the audit table's SCHEMA and the delete's
 *      SEMANTICS, and never checked the MAPPING between the source row and
 *      the destination columns. That gap is this project's recurring bug
 *      shape — an unselected or misspelled column is `undefined` in mysql2,
 *      never an error — and it has now produced the checkout 409 (cbafe9f),
 *      the NULL payment intent, and the dead captured-payment banner on the
 *      orders list. This check is the generalisable form of all three.
 *
 *   7. AN UNCAPTURED AUTHORIZATION IS RELEASED BEFORE THE ROW IS REMOVED,
 *      and the delete is REFUSED if Stripe declines. Deleting first and
 *      releasing after is unrecoverable: the hold is live and the record
 *      that named it is gone.
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

    /* ── the delete reason, as a dropdown ───────────────────────────── */
    const REASONS = require(path.join(ROOT, 'src/config/orderDeleteReasons'));

    check(Array.isArray(REASONS.ORDER_DELETE_REASONS) && REASONS.ORDER_DELETE_REASONS.length >= 4,
          'there is a shared list of delete reasons');
    check(REASONS.ORDER_DELETE_REASONS.some(r => r.requiresNote),
          'at least one reason requires a note — "Other" alone says nothing');
    check(REASONS.composeDeleteReason('other', '') === null,
          'Other with no note is rejected');
    check(REASONS.composeDeleteReason('not_a_real_code', 'a real note') === null,
          'an unknown reason code is rejected rather than written through',
          'the audit column is the point; it must not accept arbitrary input');
    check(typeof REASONS.composeDeleteReason('test_order', '') === 'string',
          'a plain reason with no note composes fine');
    check(REASONS.composeDeleteReason('fraud', 'abc') === null,
          'a note that IS given must still say something');

    /* One list, three consumers. The codebase already carries orderStatuses.js
       because an inline copy of a list drifted from its source; this follows
       that precedent rather than repeating the lesson. */
    check(/require\('\.\.\/config\/orderDeleteReasons'\)/.test(CTRL),
          'the controller reads the reasons from the shared config');
    check(/ORDER_DELETE_REASONS\.forEach/.test(LIST),
          'the dropdown is RENDERED from that config, not hand-typed into the view',
          'a hardcoded <option> list is how the UI and the validation drift apart');
    check(/composeDeleteReason\(b\.reason_code, b\.reason_note\)/.test(CTRL_NC),
          'the server composes the stored reason from code + note');
    check((CTRL_NC.match(/if \(!reason\) \{/g) || []).length === 2,
          'BOTH handlers reject a missing or invalid reason before deleting',
          'a rule enforced only in the UI is a suggestion');
    check(!/\|\| 'bulk delete'/.test(CTRL_NC),
          'and no handler substitutes a placeholder reason of its own');

    /* ── 4. the UI ───────────────────────────────────────────────────── */
    console.log('--- the admin UI ---');
    check(/id="ord-bulk-delete"/.test(LIST), 'the list has a bulk delete control');
    check(/class="ord-select"/.test(LIST),   'and a per-row checkbox carrying the order id');
    check(/class="btn btn-sm ord-del-one"/.test(LIST),
          'and a per-row Delete button',
          'opening an order and scrolling to the bottom is the wrong shape for this job');
    check(/colspan="10"/.test(LIST),
          'the empty-state colspan was bumped to 10 for the new column');

    /* THE PROMPT CHAIN IS GONE. Three separate confirmations failed in real
       use: the selection count typed back, a twenty-character order number,
       and a box that read as free text so a note was typed into it. A prompt
       is the wrong control for a choice; the dropdown is the fix and the old
       approach must not creep back. */
    /* EJS stripped first. The comment above the modal EXPLAINS that it replaced
       a window.prompt chain, so a raw search finds the explanation and fails on
       the history rather than the code - the same mistake the nonce audit made,
       caught here by its own rule. */
    const LIST_CODE = LIST.replace(/<%[-=#_]?[\s\S]*?[-_]?%>/g, '');
    check(!/window\.prompt\(/.test(LIST_CODE),
          'the list uses NO window.prompt — the reason modal replaced that chain',
          'each prompt variant failed on first contact with a real user');
    check(/id="ord-del-modal"/.test(LIST) && /id="ord-del-reason"/.test(LIST),
          'there is a delete modal with a reason select');
    check(/ord-del-cancel/.test(LIST) && /e\.key === 'Escape'/.test(LIST),
          'the modal can be dismissed by button and by Escape');
    check(/requiresNote/.test(LIST) && /MIN_NOTE/.test(LIST),
          'the modal enforces the note requirement client-side too');
    check(/reason_code: elSel\.value/.test(LIST) && /reason_note: note/.test(LIST),
          'and posts the code and note the server expects');
    /* The DETAIL page keeps a typed order-number confirmation. It is reached by
       a deliberate navigation and shows the whole order, so the stronger prompt
       is proportionate there - and unlike the list it is a single known target,
       not a selection. */
    check(/function deleteOrder\(/.test(DETAIL), 'the detail page still has its delete handler');
    check(/typed\.trim\(\) !== orderNumber/.test(DETAIL),
          'and still requires the order number typed back',
          'that page has no dropdown; the typed number is its only guard');

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

    /* ── 7. THE COLUMN MAPPING ───────────────────────────────────────────
       Every `order.<something>` inside deleteOneOrder is read off a row
       produced by `SELECT * FROM orders`. If the name is not a column, it
       is undefined — silently, with no error — and whatever it was meant
       to record is NULL forever.

       Checked against the newest schema dump, because that is the only
       artefact that says what the table actually has. The migrations
       directory describes intent, not state (BVO_AUDIT_BRIEF.md:338). */
    console.log('');
    console.log('--- every column read off the order row exists ---');

    /* ⚠️ SCOPED TO deleteOneOrder, and section 8 below uses the SAME slice.
       ordersController is 1,200 lines and contains a STANDALONE
       exports.cancelAuthorization handler that legitimately mentions
       'cancelAuthorization' and 'auth_only'. Scanning the whole file for
       either makes the release checks pass on text from a different
       function — which is exactly what happened: two mutations that broke
       the delete path were missed because the unrelated handler satisfied
       the grep. Compute the body once, here, and use it everywhere. */
    const fnStart0 = CTRL_CODE.indexOf('async function deleteOneOrder');
    const fnEnd0   = CTRL_CODE.indexOf('\n}', CTRL_CODE.indexOf('DELETE FROM orders WHERE id = ?', fnStart0));
    const FN_BODY  = CTRL_CODE.slice(fnStart0, fnEnd0 > fnStart0 ? fnEnd0 : undefined);

    const dumps = fs.readdirSync(path.join(ROOT, '..'))
      .filter(f => /^u\d+_BVO_website.*\.sql$/.test(f)).sort().reverse();

    if (!dumps.length) {
      check(false, 'a BVO schema dump is available to check column names against',
            'No u*_BVO_website*.sql beside the project. Without it this check ' +
            'cannot run, and a misspelled column goes back to being invisible.');
    } else {
      /* ⚠️ READ IN CHUNKS AND STOP AT THE BLOCK WE NEED.
         These dumps are ~80 MB. readFileSync'ing the whole thing costs ~2s,
         which is nothing for one gate run and 80 seconds across the 39 runs
         the mutation harness makes — enough to push the harness past the
         tool timeout, which in turn kills it mid-mutation and leaves a
         deliberately-broken file in the working tree. That happened twice
         on 2026-10-19 before this was fixed.

         The CREATE TABLE block is a few hundred bytes somewhere in those
         80 MB, so the scan stops the moment it has it. A sliding overlap
         keeps the marker from being split across a chunk boundary. */
      const cols = new Set();
      {
        const fd  = fs.openSync(path.join(ROOT, '..', dumps[0]), 'r');
        const BUF = Buffer.alloc(1 << 20);          // 1 MB
        let carry = '', pos = 0, block = null;
        try {
          for (;;) {
            const n = fs.readSync(fd, BUF, 0, BUF.length, pos);
            if (n <= 0) break;
            pos += n;
            const text = carry + BUF.toString('utf8', 0, n);
            const m = text.match(/CREATE TABLE `orders` \(([\s\S]*?)\n\) ENGINE/);
            if (m) { block = m[1]; break; }
            /* Keep the tail in case the block straddles the boundary. A
               CREATE TABLE for a 96-column table is well under 64 KB. */
            carry = text.slice(-65536);
          }
        } finally { fs.closeSync(fd); }
        if (block) [...block.matchAll(/^\s+`(\w+)`\s+\w/gm)].forEach(x => cols.add(x[1]));
      }

      check(cols.size > 30,
            `the orders table parsed from ${dumps[0]} (${cols.size} columns)`,
            'Too few columns — the CREATE TABLE regex stopped matching and the ' +
            'check below would pass vacuously.');

      /* Scope to deleteOneOrder: `order` elsewhere in this 1,200-line file
         may be a different shape entirely. */
      const BODY = FN_BODY;

      check(fnStart0 !== -1 && BODY.length > 200,
            'deleteOneOrder was located for scanning');

      /* Properties that are NOT columns and must not be flagged. Each one
         is a deliberate exception, not a convenience. */
      const NOT_COLUMNS = new Set([
        'order_number',   // is a column; listed for clarity, harmless either way
      ]);

      const read = [...new Set([...BODY.matchAll(/\border\.(\w+)/g)].map(x => x[1]))];
      const ghosts = read.filter(c => !cols.has(c) && !NOT_COLUMNS.has(c));

      check(read.length >= 5,
            `deleteOneOrder reads ${read.length} properties off the order row`,
            'Suspiciously few — the scan regex may have stopped matching.');

      check(ghosts.length === 0,
            'every one of them is a real column on `orders`',
            ghosts.length
              ? 'NOT COLUMNS: ' + ghosts.map(g => 'order.' + g).join(', ') +
                '\n         These are undefined at runtime and write NULL. This is ' +
                'exactly how order_deletions.stripe_payment_intent was NULL on all ' +
                'eleven rows while the JSON snapshot held the real ids.'
              : '');

      /* And the specific one that was wrong, named, so a future refactor
         that reintroduces the old name fails loudly rather than quietly. */
      check(/order\.payment_transaction_id/.test(BODY),
            'the payment intent is read from payment_transaction_id',
            'That is the column that exists. stripe_payment_intent_id and ' +
            'stripe_payment_intent do not and never did.');
      check(!/order\.stripe_payment_intent/.test(BODY),
            'and neither ghost column name has come back');
    }

    /* ── 8. the authorization release ────────────────────────────────── */
    console.log('');
    console.log('--- an uncaptured hold is released, not stranded ---');

    /* ⚠️ INDEXES INTO THE FUNCTION BODY, not the file. Measured against the
       whole file, relIdx found exports.cancelAuthorization — a different,
       legitimate handler several hundred lines earlier — so the ordering
       assertion below was comparing positions in unrelated code and passed
       no matter what the delete path did. Two mutations slipped through on
       exactly that before this was scoped. */
    const relIdx = FN_BODY.indexOf('cancelAuthorization');
    const insIdx = FN_BODY.indexOf('INSERT INTO order_deletions');
    const delIdx = FN_BODY.indexOf('DELETE FROM orders WHERE id = ?');

    check(relIdx !== -1, 'deleteOneOrder can release an authorization');
    check(/auth_only/.test(FN_BODY),
          'it tests payment_status for auth_only',
          'Any other test would release holds that do not exist or miss ones that do. ' +
          'Checked inside deleteOneOrder — exports.cancelAuthorization also mentions ' +
          "'auth_only' and would satisfy a file-wide search on its own.");
    check(relIdx !== -1 && delIdx !== -1 && relIdx < delIdx,
          'the release happens BEFORE the row is deleted',
          'Delete-then-release is unrecoverable on failure: the hold is live and ' +
          'the record naming it is gone.');
    check(relIdx !== -1 && insIdx !== -1 && relIdx < insIdx,
          'and before the snapshot, so a failed release writes no audit row at all');
    check(/skipped: 'release_failed'/.test(FN_BODY),
          'a failed release refuses the delete',
          'Proceeding past a failed release is the exact outcome the guard exists ' +
          'to prevent.');
    check(/skipped: 'authorization_pending'/.test(FN_BODY),
          'and a hold without the release flag is refused, not silently stranded');

    /* The flag must come from the REQUEST, like confirm_captured. Hardcoded
       true would turn the acknowledgement into decoration. */
    const relFlags = [...CTRL_CODE.matchAll(/releaseAuth:\s*([^,\n]+)/g)].map(x => x[1].trim());
    check(relFlags.length >= 2,
          `both HTTP handlers pass releaseAuth (${relFlags.length} call sites)`);
    check(relFlags.every(f => /req\.body/.test(f)),
          'and both derive it from the request body, never a literal',
          'found: ' + relFlags.join(' | '));

    /* ── 9. the detail page sends a reason ───────────────────────────── */
    console.log('');
    console.log('--- the detail page delete actually works ---');
    check(/reason_code:/.test(DETAIL),
          'the detail page sends reason_code',
          'It did not from 2026-10-14 to 2026-10-19: composeDeleteReason() returns ' +
          'null for an unknown code, so every delete from that page 400\'d with ' +
          '"Pick a deletion reason". All eleven recorded deletions came through ' +
          'the bulk endpoint instead.');
    check(/DELETE_REASONS\s*=\s*<%-/.test(DETAIL),
          'and renders the reasons from the shared config, not a retyped list',
          'orderDeleteReasons.js is the one source; a hardcoded copy here is how ' +
          'the two drift.');
    check(/ORDER_DELETE_REASONS,/.test(CTRL) && /MIN_DELETE_NOTE,/.test(CTRL),
          'the detail render passes the config through');

    console.log('');
    console.log(fail === 0
      ? `gate_order_delete: all ${pass} checks pass`
      : `gate_order_delete: ${fail} FAILED, ${pass} passed`);
    process.exit(fail === 0 ? 0 : 1);
  })().catch(e => { console.error('gate crashed: ' + e.stack); process.exit(1); });
}
