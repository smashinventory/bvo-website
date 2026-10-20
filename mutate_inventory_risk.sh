#!/usr/bin/env bash
# mutate_inventory_risk.sh — proves gate_inventory_risk can fail.
#
# THE DEFECT THIS FEATURE IS MOST LIKELY TO DEVELOP is not a crash. It is a
# number that looks reasonable and is not. Two of them happened while it was
# being written, in an hour, by someone who had just written the comment
# warning about them:
#
#   - Number(null) is 0, so a SKU with no inventory row classified as
#     OVERSOLD rather than unknown.
#   - A backtick inside a SQL comment ended the template literal.
#
# Both read as correct. Only running them caught either.

set -uo pipefail
cd "$(dirname "$0")"

GATE="gates/gate_inventory_risk.js"
MOD="src/config/inventoryRisk.js"
CTRL="src/controllers/ordersController.js"
VIEW="views/pages/admin/orders/index.ejs"
REV="src/config/revenue.js"
FILES=("$MOD" "$CTRL" "$VIEW" "$REV")

TMP=$(mktemp -d)
for f in "${FILES[@]}"; do
  cp "$f" "$TMP/$(echo "$f" | tr '/' '_')" || { echo "BACKUP FAILED: $f"; exit 1; }
done
restore() { for f in "${FILES[@]}"; do cp "$TMP/$(echo "$f" | tr '/' '_')" "$f"; done; }
trap 'echo; echo "  !! INTERRUPTED — restoring"; restore; rm -rf "$TMP"; exit 130' INT TERM

export DB_PASS="${DB_PASS:-gate-placeholder}"
PASS=0; MISS=0; STALE=0

if ! node "$GATE" >/dev/null 2>&1; then
  echo "BASELINE IS RED — fix the gate first."; node "$GATE" 2>&1 | grep FAIL | head
  restore; rm -rf "$TMP"; exit 1
fi
echo; echo "mutate_inventory_risk — can the gate fail?"; echo; echo "  baseline: green"; echo

mutate() {
  local label="$1" file="$2" py="$3"
  python3 -I -c "
import io,sys
p=r'''$file'''
s=io.open(p,encoding='utf-8').read()
before=s
$py
if s==before:
    sys.stderr.write('ANCHOR NOT FOUND\n'); sys.exit(3)
io.open(p,'w',encoding='utf-8').write(s)
" 2>/tmp/mut_inv.err
  local rc=$?
  if [ $rc -eq 3 ]; then
    echo "  ANCHOR-STALE  $label — the test is broken, not the gate"
    STALE=$((STALE+1)); restore; return
  fi
  if [ $rc -ne 0 ]; then
    echo "  SETUP-FAIL    $label"; sed 's/^/                /' /tmp/mut_inv.err
    MISS=$((MISS+1)); restore; return
  fi
  if node "$GATE" >/dev/null 2>&1; then
    echo "  MISSED        $label"; MISS=$((MISS+1))
  else
    echo "  caught        $label"; PASS=$((PASS+1))
  fi
  restore
}

# ── NULL IS NOT ZERO. The bug that actually happened. ───────────────────
mutate "the null guard is removed, so Number(null)=0 reads as zero stock" "$MOD" "
s = s.replace(\"  if (row.qty_on_hand === null || row.qty_on_hand === undefined) return 'unknown';\", '')
"

# ⚠️ A MUTATION THAT WAS REMOVED, and why. "Move the null guard to AFTER
# Number()" was tested here and reported MISSED. It is not a gate hole: the
# move is BEHAVIOURALLY INERT. Number(null) is computed into an unused
# local, the guard still fires, and classify still returns 'unknown'. The
# gate was right not to fail. A mutation that changes nothing proves
# nothing, and leaving it in would have been a permanent false accusation
# against a sound check. The guard being REMOVED is the real defect, and
# the mutation above covers it.

mutate "unknown is collapsed into ok, hiding SKUs we know nothing about" "$MOD" "
s = s.replace(\"  if (!row || row.stock_unknown) return 'unknown';\", \"  if (!row || row.stock_unknown) return 'ok';\")
"

mutate "a real zero is treated as unknown, hiding genuine stockouts" "$MOD" "
s = s.replace('  const stock  = Number(row.qty_on_hand);', '  const stock = row.qty_on_hand === 0 ? NaN : Number(row.qty_on_hand);')
"

# ── THE LADDER ─────────────────────────────────────────────────────────
mutate "backorderable SKUs are reported as oversold" "$MOD" "
s = s.replace('  if (demand > stock && !row.allow_backorder) return \'oversold\';', '  if (demand > stock) return \'oversold\';')
"

mutate "the threshold is exclusive, so stock of exactly 2 reads as fine" "$MOD" "
s = s.replace('  if (stock <= LOW_STOCK_AT) {', '  if (stock < LOW_STOCK_AT) {')
"

mutate "the threshold stops matching SOP section 2" "$MOD" "
s = s.replace('const LOW_STOCK_AT = 2;', 'const LOW_STOCK_AT = 5;')
"

# ── DEMAND MUST BE REAL ORDERS ─────────────────────────────────────────
mutate "abandoned checkouts count as demand (IS_REAL loses the payment filter)" "$REV" "
s = s.replace('const PLACEHOLDER_PAYMENT = \"(\'draft\', \'pending\')\";', 'const PLACEHOLDER_PAYMENT = \"(\'draft\')\";')
"

mutate "shipped orders are counted as open demand" "$MOD" "
s = s.replace(\"const OPEN_DEMAND_STATUSES = ['pending', 'confirmed', 'processing'];\",
              \"const OPEN_DEMAND_STATUSES = ['pending', 'confirmed', 'processing', 'shipped'];\")
"

mutate "the controller stops using IS_REAL and hand-rolls a predicate" "$CTRL" "
s = s.replace(\"const REV_BASE   = require('../config/revenue').predicates('o').IS_REAL;\",
              \"const REV_BASE   = 'o.is_test = 0';\")
"

# ── SCOPE AND SAFETY ───────────────────────────────────────────────────
mutate "the aggregate is limited to the current page" "$CTRL" "
s = s.replace('         GROUP BY oi.sku\`,', '         GROUP BY oi.sku LIMIT 25\`,')
"

mutate "the orphan-recovering SKU join is dropped" "$CTRL" "
s = s.replace('LEFT JOIN inventory inv ON inv.product_id = COALESCE(oi.product_id, p.id)',
              'LEFT JOIN inventory inv ON inv.product_id = oi.product_id')
"

mutate "the query stops failing soft and takes the dashboard with it" "$CTRL" "
i = s.index('inventory risk query failed')
j = s.rindex('} catch (err) {', 0, i)
s = s[:j] + '} catch (err) { throw err; /*' + s[j+15:i] + 'x' + s[i+27:]
"

# ⚠️ ANCHOR MATCHED ON THE COLUMN ONLY, not on the column plus its padding.
# The first version of this test aligned AS qty_on_hand with a guessed
# number of spaces and reported ANCHOR-STALE against correct code.
mutate "qty_reserved is used, which is always 0 and always wrong" "$CTRL" "
s = s.replace('MIN(inv.qty_on_hand)', 'MIN(inv.qty_on_hand - inv.qty_reserved)', 1)
"

# ── THE VIEW MUST NOT INVENT A RULE ────────────────────────────────────
mutate "the view hard-codes a severity instead of reading LABELS" "$VIEW" "
s = s.replace('var L = INV.LABELS[r.severity];', \"var L = (r.severity === 'oversold') ? {text:'Oversold',tone:'red',hint:''} : INV.LABELS[r.severity];\")
"

mutate "unknown prints 0 instead of a dash" "$VIEW" "
s = s.replace(\"<%= r.severity === 'unknown' ? '—' : r.qty_on_hand %>\", '<%= r.qty_on_hand %>')
"

mutate "a fifth severity is added to LABELS but not to the rule" "$MOD" "
s = s.replace(\"  unknown:   {\", \"  urgent:    { text: 'Urgent', tone: 'red', hint: 'x' },\n  unknown:   {\")
"

# ── STALENESS ──────────────────────────────────────────────────────────
mutate "a never-synced feed is treated as fresh" "$MOD" "
s = s.replace('  if (!lastSyncedAt) return true;', '  if (!lastSyncedAt) return false;')
"

mutate "the stale window drops below the nightly cycle" "$MOD" "
s = s.replace('const STALE_AFTER_HOURS = 26;', 'const STALE_AFTER_HOURS = 12;')
"

mutate "the as-of time is removed from the page" "$VIEW" "
s = s.replace('stock as of ', '')
"

# ── IT MUST NEVER BLOCK ────────────────────────────────────────────────
mutate "the row flag is put on every order, so it stops being read" "$VIEW" "
s = s.replace('<% if (o.inventoryRisk) { %><span class=\"inv-flag\"', '<% if (true) { %><span class=\"inv-flag\"')
"

echo
echo "  caught $PASS, missed $MISS, anchor-stale $STALE"
restore
if ! diff -q <(cat "${FILES[@]}") <(for f in "${FILES[@]}"; do cat "$TMP/$(echo "$f" | tr '/' '_')"; done) >/dev/null; then
  echo "  ✗ RESTORE IS NOT BYTE-IDENTICAL — inspect before committing"; rm -rf "$TMP"; exit 1
fi
echo "  restored byte-identical"
rm -rf "$TMP"
node "$GATE" >/dev/null 2>&1 || { echo "  ✗ gate is red after restore"; exit 1; }
echo "  gate green after restore"
[ "$MISS" -eq 0 ] && [ "$STALE" -eq 0 ] || exit 1
echo
