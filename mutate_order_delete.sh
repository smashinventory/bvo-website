#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────
# mutate_order_delete.sh — negative test for gate_order_delete.js
#
# Each mutation below breaks the delete in a way that WOULD SHIP SILENTLY,
# then asserts the gate catches it. Any MISSED line is a hole in the gate.
#
# Backs up every file it touches and asserts the restore worked. This harness
# mutates a DELETE path, so a run that corrupts the tree and leaves it that
# way is the worst possible outcome.
# ─────────────────────────────────────────────────────────────────────────
set -uo pipefail
cd "$(dirname "$0")"

GATE=gates/gate_order_delete.js
CTRL=src/controllers/ordersController.js
ROUTES=src/routes/admin.js
CLEAN=scripts/cleanupTestOrders.js
LIST=views/pages/admin/orders/index.ejs
DETAIL=views/pages/admin/orders/detail.ejs
MIG=migrations/2026-10-12_order_deletions_RUNME.sql

FILES=("$CTRL" "$ROUTES" "$CLEAN" "$LIST" "$DETAIL" "$MIG")

TMP=$(mktemp -d)
for f in "${FILES[@]}"; do
  cp "$f" "$TMP/$(echo "$f" | tr '/' '_')" || { echo "BACKUP FAILED: $f"; exit 1; }
done
restore() {
  for f in "${FILES[@]}"; do
    cp "$TMP/$(echo "$f" | tr '/' '_')" "$f" || { echo "RESTORE FAILED: $f"; exit 1; }
  done
}

if ! node "$GATE" >/dev/null 2>&1; then
  echo "BASELINE IS RED — the gate fails on unmodified code. Fix that first."
  node "$GATE" | tail -20
  restore; rm -rf "$TMP"; exit 1
fi
echo "baseline: gate passes on unmodified code"
echo

PASS=0; MISS=0
mutate() {
  local label="$1" file="$2" py="$3"
  python3 -I -c "
import io,sys
p=r'''$file'''
s=io.open(p,encoding='utf-8').read()
before=s
$py
if s==before:
    sys.stderr.write('MUTATION DID NOT APPLY\n'); sys.exit(2)
io.open(p,'w',encoding='utf-8').write(s)
" 2>/tmp/mut_del.err
  if [ $? -ne 0 ]; then
    echo "  SETUP-FAIL  $label  (the mutation did not apply — the needle has drifted)"
    sed 's/^/              /' /tmp/mut_del.err
    MISS=$((MISS+1)); restore; return
  fi
  if node "$GATE" >/dev/null 2>&1; then
    echo "  MISSED      $label"; MISS=$((MISS+1))
  else
    echo "  caught      $label"; PASS=$((PASS+1))
  fi
  restore
}

echo "──── the money: captured payments ────"
mutate "captured-payment refusal removed" "$CTRL" \
  "s=s.replace('if (order.payment_captured_at && !confirmCaptured) {', 'if (false) {')"

mutate "refusal inverted — only captured orders are refused" "$CTRL" \
  "s=s.replace('if (order.payment_captured_at && !confirmCaptured) {', 'if (!order.payment_captured_at && !confirmCaptured) {')"

mutate "confirmCaptured defaults to true" "$CTRL" \
  "s=s.replace('confirmCaptured: !!(req.body && req.body.confirm_captured),', 'confirmCaptured: true,', 1)"

echo
echo "──── the keep list ────"
mutate "cleanup keep list emptied" "$CLEAN" \
  "s=s.replace(\"const KEEP_ORDER_NUMBERS = ['BVO-2026-09-30-00118'];\", 'const KEEP_ORDER_NUMBERS = [];')"

mutate "cleanup keeps a different order" "$CLEAN" \
  "s=s.replace('BVO-2026-09-30-00118', 'BVO-2026-09-30-00117')"

mutate "cleanup loses its dry-run default" "$CLEAN" \
  "s=s.replace(\"const EXECUTE = process.argv.includes('--execute');\", 'const EXECUTE = true;')"

mutate "cleanup drops the missing-keep-order guard" "$CLEAN" \
  "s=s.replace('REFUSING: these keep-list orders are not in the table: ', 'note: missing keep-list orders: ')"

# Disables the guard itself. An earlier version of this mutation only reworded
# the log message, which the gate correctly ignored - the guard is the filter
# and the early return, not the sentence printed next to it.
mutate "cleanup drops the captured-payment guard" "$CLEAN" \
  "s=s.replace('if (captured.length) {', 'if (false) {')"

mutate "cleanup grows its own DELETE instead of calling the shared one" "$CLEAN" \
  "s=s.replace('const r = await deleteOneOrder(conn, t.id, {', 'await conn.query(\\'DELETE FROM orders WHERE id = ?\\', [t.id]);\n      const r = await deleteOneOrder(conn, t.id, {')"

echo
echo "──── the children ────"
mutate "shipments left orphaned" "$CTRL" \
  "s=s.replace(\"const ORDER_CHILD_TABLES = ['order_events', 'shipments', 'returns', 'sample_redemptions'];\", \"const ORDER_CHILD_TABLES = ['order_events', 'returns', 'sample_redemptions'];\")"

mutate "sample_redemptions left orphaned" "$CTRL" \
  "s=s.replace(\"const ORDER_CHILD_TABLES = ['order_events', 'shipments', 'returns', 'sample_redemptions'];\", \"const ORDER_CHILD_TABLES = ['order_events', 'shipments', 'returns'];\")"

mutate "child delete loop skipped entirely" "$CTRL" \
  "s=s.replace('for (const t of ORDER_CHILD_TABLES) {\n    if (counts[t] === null) continue;', 'for (const t of []) {\n    if (counts[t] === null) continue;')"

echo
echo "──── the audit trail ────"
mutate "snapshot written AFTER the delete" "$CTRL" \
  "import re
i=s.index('  /* Snapshot BEFORE anything is removed. */')
j=s.index('  for (const t of ORDER_CHILD_TABLES) {', i)
block=s[i:j]
s=s[:i]+s[j:]
k=s.index(\"  await conn.query('DELETE FROM orders WHERE id = ?', [id]);\")
k=s.index('\n', k)+1
s=s[:k]+block+s[k:]"

mutate "snapshot insert removed" "$CTRL" \
  "s=s.replace('INSERT INTO order_deletions', 'SELECT 1 -- order_deletions')"

mutate "audit table gains an FK to orders" "$MIG" \
  "s=s.replace('  PRIMARY KEY (\`id\`),', '  CONSTRAINT fk_od_order FOREIGN KEY (\`order_id\`) REFERENCES orders(id),\n  PRIMARY KEY (\`id\`),')"

mutate "snapshot column narrowed from JSON to a varchar" "$MIG" \
  "s=s.replace('\`order_snapshot\`  JSON', '\`order_snapshot\`  VARCHAR(255)')"

echo
echo "──── routes ────"
# Must select the ROUTE line, not the comment above it that explains the
# ordering - an earlier version matched the comment and moved that instead,
# leaving the routes untouched and the gate rightly green.
mutate "bulk-delete declared after /orders/:id" "$ROUTES" \
  "line=[l for l in s.split('\n') if l.lstrip().startswith(\"router.post('/orders/bulk-delete'\")][0]
s=s.replace(line+'\n','')
s=s.replace(\"router.post('/orders/:id/delete',\", line+'\n'+\"router.post('/orders/:id/delete',\")"

mutate "delete routes moved above requireAdmin" "$ROUTES" \
  "s=s.replace('router.use(requireAdmin);', '// router.use(requireAdmin);')"

echo
echo "──── the UI confirmations ────"
mutate "bulk delete downgraded to a plain confirm" "$LIST" \
  "s=s.replace('const typed = window.prompt(', \"const typed = 'DELETE'; window.confirm(\")"

mutate "bulk confirmation accepts anything" "$LIST" \
  "s=s.replace(\"if (typed.trim().toUpperCase() !== 'DELETE') {\", 'if (false) {')"

mutate "single delete stops checking the typed order number" "$DETAIL" \
  "s=s.replace('if (typed.trim() !== orderNumber)', 'if (false)')"

mutate "empty-state colspan left at 9" "$LIST" \
  "s=s.replace('colspan=\"10\"', 'colspan=\"9\"')"

mutate "row checkboxes removed" "$LIST" \
  "s=s.replace('class=\"ord-select\"', 'class=\"ord-select-disabled\"')"

echo
echo "──── soft-delete creep ────"
mutate "delete quietly becomes a deleted_at flag" "$CTRL" \
  "s=s.replace(\"  await conn.query('DELETE FROM orders WHERE id = ?', [id]);\", \"  await conn.query('UPDATE orders SET deleted_at = NOW() WHERE id = ?', [id]);\")"

echo
echo "──── restore verification ────"
BAD=0
for f in "${FILES[@]}"; do
  if ! cmp -s "$f" "$TMP/$(echo "$f" | tr '/' '_')"; then
    echo "  NOT RESTORED: $f"; BAD=1
  fi
done
[ "$BAD" = "0" ] && echo "  all ${#FILES[@]} files byte-identical to their backups"
if ! node "$GATE" >/dev/null 2>&1; then
  echo "  GATE RED AFTER RESTORE — the tree is dirty, check the files above"; BAD=1
fi
[ "$BAD" = "0" ] && echo "  gate green again after restore"
rm -rf "$TMP"

echo
TOTAL=$((PASS+MISS))
echo "mutations: $PASS/$TOTAL caught"
if [ "$MISS" != "0" ] || [ "$BAD" != "0" ]; then
  echo "RESULT: the gate has holes (or the tree is dirty) — do not ship."
  exit 1
fi
echo "RESULT: every mutation caught, tree clean."
