#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────
# mutate_erv_inventory_sync.sh — negative test for gate_erv_inventory_sync.js
#
# A gate that passes proves nothing on its own. Each mutation below breaks the
# code in a way that WOULD SHIP SILENTLY, then asserts the gate catches it.
# Every mutation must be CAUGHT; any MISSED line means the gate has a hole.
#
# BACKS UP EVERY FILE IT TOUCHES, and asserts the restore worked before
# exiting. A harness that corrupts the tree is worse than no harness — an
# earlier version of this pattern left site2.css and site-bundle.css out of
# the backup list and only the restore assertion caught it.
# ─────────────────────────────────────────────────────────────────────────
set -uo pipefail
cd "$(dirname "$0")"

GATE=gates/gate_erv_inventory_sync.js
JOB=src/jobs/ervInventorySync.js
UTIL=src/utils/inventory.js
IMP=src/jobs/importJamesMartinFeed.js
SH=erv_inventory_sync.sh
PHP=../bvo_sync.php

FILES=("$JOB" "$UTIL" "$IMP" "$SH" "$PHP")

# ── back everything up ───────────────────────────────────────────────
TMP=$(mktemp -d)
for f in "${FILES[@]}"; do
  cp "$f" "$TMP/$(echo "$f" | tr '/' '_')" || { echo "BACKUP FAILED: $f"; exit 1; }
done

restore() {
  for f in "${FILES[@]}"; do
    cp "$TMP/$(echo "$f" | tr '/' '_')" "$f" || { echo "RESTORE FAILED: $f"; exit 1; }
  done
}

# Baseline must be green, or every result below is meaningless.
if ! node "$GATE" >/dev/null 2>&1; then
  echo "BASELINE IS RED — the gate fails on unmodified code. Fix that first."
  node "$GATE" | tail -20
  restore; rm -rf "$TMP"; exit 1
fi
echo "baseline: gate passes on unmodified code"
echo

PASS=0; MISS=0

# mutate <label> <file> <python-expression-applying-the-edit>
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
" 2>/tmp/mut.err
  if [ $? -ne 0 ]; then
    echo "  SETUP-FAIL  $label  (the mutation did not apply — the needle has drifted)"
    cat /tmp/mut.err | sed 's/^/              /'
    MISS=$((MISS+1)); restore; return
  fi
  if node "$GATE" >/dev/null 2>&1; then
    echo "  MISSED      $label"
    MISS=$((MISS+1))
  else
    echo "  caught      $label"
    PASS=$((PASS+1))
  fi
  restore
}

echo "──── the catastrophic ones: writing product content ────"
mutate "job gains UPDATE products SET name" "$JOB" \
  "s=s.replace(\"await db().query(\\n    \`INSERT INTO rflpos_sync_log\", \"await db().query('UPDATE products SET name=? WHERE id=?',[1,2]);\\n  await db().query(\`INSERT INTO rflpos_sync_log\")"

mutate "job gains INSERT INTO products" "$JOB" \
  "s=s.replace('const writes = [];', 'await db().query(\"INSERT INTO products (sku) VALUES (?)\",[1]);\\n    const writes = [];')"

mutate "helper starts writing allow_backorder" "$UTIL" \
  "s=s.replace('INSERT INTO inventory (product_id, qty_on_hand, last_synced_at)', 'INSERT INTO inventory (product_id, qty_on_hand, last_synced_at, allow_backorder)')"

echo
echo "──── the key: the half-inch trap and the PR regex ────"
mutate "match falls back to products.sku" "$JOB" \
  "s=s.replace('AND p.rflpos_item_id IS NOT NULL', 'AND p.sku = ?').replace('[String(r.rflpos_item_id).trim(), r]', '[String(r.sku).trim(), r]')"

mutate "key validated with a PR-shaped regex" "$JOB" \
  "s=s.replace(\"if (!sku) { bad.push('row with empty sku'); return null; }\", \"if (!sku) { bad.push('row with empty sku'); return null; }\\n  if (!/^PR\\\\d+\$/.test(sku)) { bad.push(sku + ': not a PR sku'); return null; }\")"

mutate "key gets case-folded" "$JOB" \
  "s=s.replace('const sku = row && row.sku != null ? String(row.sku).trim()', 'const sku = row && row.sku != null ? String(row.sku).trim().toLowerCase()')"

mutate "brand scoping dropped from the lookup" "$JOB" \
  "s=s.replace('WHERE p.brand = ?', 'WHERE 1=1 -- p.brand')"

echo
echo "──── the write: upsert becomes a plain update ────"
mutate "helper downgraded to a plain UPDATE" "$UTIL" \
  "s=s.replace('''INSERT INTO inventory (product_id, qty_on_hand, last_synced_at)
    VALUES (?, ?, NOW())
    ON DUPLICATE KEY UPDATE
      qty_on_hand    = VALUES(qty_on_hand),
      last_synced_at = NOW()''', '''UPDATE inventory SET qty_on_hand = ?, last_synced_at = NOW()
    WHERE product_id = ?''')"

mutate "job hand-rolls its own inventory SQL" "$JOB" \
  "s=s.replace('await upsertInventory(db(), w.product.id, w.qtyLocal);', 'await db().query(\"INSERT INTO inventory (product_id, qty_on_hand) VALUES (?,?)\",[w.product.id,w.qtyLocal]);')"

mutate "importer forks its own copy back" "$IMP" \
  "s=s.replace(\"const { upsertInventory }                = require('../utils/inventory');\", 'async function upsertInventory(conn, productId, qtyOnHand) {\\n  if (qtyOnHand === null) return;\\n  await conn.query(\\'INSERT INTO inventory (product_id, qty_on_hand) VALUES (?,?)\\', [productId, qtyOnHand]);\\n}')"

echo
echo "──── row validation ────"
mutate "negative quantities accepted" "$JOB" \
  "s=s.replace('if (qtyLocal < 0)', 'if (false && qtyLocal < 0)')"

mutate "quantity ceiling removed" "$JOB" \
  "s=s.replace('if (qtyLocal > QTY_CEILING)', 'if (false && qtyLocal > QTY_CEILING)')"

mutate "fractional quantities round up instead of floor" "$JOB" \
  "s=s.replace('qtyLocal: Math.floor(qtyLocal),', 'qtyLocal: Math.ceil(qtyLocal),')"

mutate "empty sku accepted" "$JOB" \
  "s=s.replace(\"if (!sku) { bad.push('row with empty sku'); return null; }\", 'if (!sku) { return { sku: \\'\\', qtyLocal: 0, qtyAll: 0 }; }')"

echo
echo "──── the three guards ────"
mutate "GUARD 1 removed — empty feed writes" "$JOB" \
  "s=s.replace(\"if (!items.length) {\", 'if (false) {')"

mutate "GUARD 2 removed — key drift reports success" "$JOB" \
  "s=s.replace('if (!writes.length) {', 'if (false) {')"

mutate "GUARD 3 removed — mass zeroing writes" "$JOB" \
  "s=s.replace('if (zeroShare > ZERO_FLOOR) {', 'if (false) {')"

mutate "GUARD 3 loosened to 100%" "$JOB" \
  "s=s.replace('const ZERO_FLOOR = 0.5;', 'const ZERO_FLOOR = 1.01;')"

mutate "multi-variation rows silently summed" "$JOB" \
  "s=s.replace('if (bySku.has(r.sku)) { dupes.add(r.sku); continue; }', 'if (bySku.has(r.sku)) { bySku.get(r.sku).qtyLocal += r.qtyLocal; continue; }')"

mutate "dry run writes anyway" "$JOB" \
  "s=s.replace('if (!dryRun) {', 'if (true) {')"

echo
echo "──── the cron wrapper ────"
mutate "token hardcoded in the shell script" "$SH" \
  "s=s.replace('BASE=/home/u222311468', 'BVO_SYNC_TOKEN=hunter2-leaked\nBASE=/home/u222311468')"

mutate "node located by bare PATH only" "$SH" \
  "s=s.replace('find_node() {', 'find_node_disabled() {').replace('NODE=\"\$(find_node || true)\"', 'NODE=node')"

mutate "set -e left on around the node call" "$SH" \
  "s=s.replace('set +e\n', '')"

mutate "guard refusal exits like a crash" "$SH" \
  "s=s.replace(\"if (/^GUARD/.test(err.message)) {\", 'if (false) {')"

echo
echo "──── the proxy ────"
mutate "inventory feed starts returning price" "$PHP" \
  "s=s.replace('            v.sub_sku  AS sub_sku,', '            v.sub_sku  AS sub_sku,\n            p.name     AS product_name,')"

mutate "is_local filter dropped from the feed" "$PHP" \
  "s=s.replace('COALESCE(SUM(CASE WHEN l.is_local = 1\n                              THEN vld.qty_available ELSE 0 END), 0) AS qty_local', 'COALESCE(SUM(vld.qty_available), 0) AS qty_local')"

mutate "enable_stock filter dropped" "$PHP" \
  "s=s.replace('WHERE p.enable_stock    = 1', 'WHERE 1=1')"

mutate "deleted variations included" "$PHP" \
  "s=s.replace('AND v.deleted_at IS NULL', '')"

mutate "brand filter interpolated instead of bound" "$PHP" \
  "s=s.replace('\$stmt->execute(\$params);\n        \$items', '\$stmt->execute();\n        \$items')"

mutate "a write verb appears in the proxy" "$PHP" \
  "s=s.replace(\"if (\$action === 'inventory') {\", \"if (\$action === 'inventory') { \$pdo->query('UPDATE products SET sku=sku');\")"

mutate "action allow-list opened up" "$PHP" \
  "s=s.replace(\"['brands', 'products', 'inventory']\", '[\$action]')"

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
  echo "  GATE RED AFTER RESTORE — the tree is dirty, check the files above"
  BAD=1
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
