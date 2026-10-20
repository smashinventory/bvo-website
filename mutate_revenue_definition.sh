#!/usr/bin/env bash
# mutate_revenue_definition.sh — proves gate_revenue_definition can fail.
#
# The bug it guards was invisible for weeks because every dashboard agreed
# with itself. A gate that has only been seen passing would be the same
# kind of comfort.

set -uo pipefail
cd "$(dirname "$0")"

GATE="gates/gate_revenue_definition.js"

REV="src/config/revenue.js"
CUST="src/controllers/customerAnalyticsController.js"
SITE="src/controllers/siteAnalyticsController.js"
ORD="src/controllers/ordersController.js"
ADM="src/controllers/adminController.js"
FILES=("$REV" "$CUST" "$SITE" "$ORD" "$ADM")

TMP=$(mktemp -d)
for f in "${FILES[@]}"; do
  cp "$f" "$TMP/$(echo "$f" | tr '/' '_')" || { echo "BACKUP FAILED: $f"; exit 1; }
done
restore() { for f in "${FILES[@]}"; do cp "$TMP/$(echo "$f" | tr '/' '_')" "$f"; done; }

# Restore on interruption — mutate_order_delete.sh lacked this and a timeout
# left a broken file in the tree twice on 2026-10-19.
trap 'echo; echo "  !! INTERRUPTED — restoring"; restore; rm -rf "$TMP"; exit 130' INT TERM

PASS=0; MISS=0

if ! node "$GATE" >/dev/null 2>&1; then
  echo "BASELINE IS RED — fix the gate first."; node "$GATE" 2>&1 | grep FAIL | head
  restore; rm -rf "$TMP"; exit 1
fi
echo; echo "mutate_revenue_definition — can the gate fail?"; echo; echo "  baseline: green"; echo

mutate() {
  local label="$1" file="$2" py="$3"
  python3 -I -c "
import io,sys
p=r'''$file'''
s=io.open(p,encoding='utf-8').read()
before=s
$py
if s==before:
    sys.stderr.write('ANCHOR NOT FOUND\n'); sys.exit(2)
io.open(p,'w',encoding='utf-8').write(s)
" 2>/tmp/mut_rev.err
  if [ $? -ne 0 ]; then
    echo "  SETUP-FAIL  $label (anchor drifted — fix this test)"
    MISS=$((MISS+1)); restore; return
  fi
  if node "$GATE" >/dev/null 2>&1; then
    echo "  MISSED      $label"; MISS=$((MISS+1))
  else
    echo "  caught      $label"; PASS=$((PASS+1))
  fi
  restore
}

echo "──── the rule itself ────"
# THE BUG, restored exactly: an authorization counts as a sale.
mutate "IS_COUNTED stops requiring a capture" "$REV" \
  "s=s.replace(\"IS_COUNTED: \`\${BASE} AND \${p}\${CAPTURED}\`,\", \"IS_COUNTED: \`\${BASE}\`,\")"

mutate "the placeholder payment states are let through" "$REV" \
  "s=s.replace(\"const PLACEHOLDER_PAYMENT = \\\"('draft', 'pending')\\\";\", \"const PLACEHOLDER_PAYMENT = \\\"('draft')\\\";\")"

mutate "test rows stop being excluded" "$REV" \
  "s=s.replace(\"const NOT_TEST = 'is_test = 0';\", \"const NOT_TEST = '1 = 1';\")"

mutate "cancelled orders count as revenue" "$REV" \
  "s=s.replace(\"AND \${p}status <> 'cancelled' \", '')"

echo
echo "──── the SQL and the JS drift apart ────"
# The reason both implementations are run over the same fixtures.
mutate "the JS predicate drops the capture check" "$REV" \
  "s=s.replace('      && !!row.payment_captured_at;', '      ;')"

mutate "the JS predicate stops excluding test rows" "$REV" \
  "s=s.replace(\"return String(row.is_test) !== '1'\n      && row.status !== 'cancelled'\n      && !['draft', 'pending'].includes(row.payment_status)\n      && !!row.payment_captured_at;\", \"return row.status !== 'cancelled'\n      && !['draft', 'pending'].includes(row.payment_status)\n      && !!row.payment_captured_at;\")"

mutate "isAuthorized starts overlapping isCounted" "$REV" \
  "s=s.replace('      && !row.payment_captured_at;', '      && true;')"

echo
echo "──── the alias is not sanitised ────"
mutate "a caller-supplied alias is interpolated unchecked" "$REV" \
  "s=s.replace(\"  if (!/^[A-Za-z_][A-Za-z0-9_]*\$|^\$/.test(a)) {\", '  if (false) {')"

echo
echo "──── a controller hand-rolls it again ────"
mutate "customerAnalytics stops using the shared module" "$CUST" \
  "s=s.replace(\"const O_OK = REV.IS_COUNTED;\", \"const O_OK = \\\"o.is_test = 0 AND o.status <> 'cancelled'\\\";\")"

mutate "siteAnalytics reverts to the old ungated filter" "$SITE" \
  "s=s.replace(\"const O_OK = require('../config/revenue').O.IS_COUNTED;\", \"const O_OK = \\\"o.is_test = 0 AND o.status <> 'cancelled'\\\";\")"

echo
echo "──── a money sum loses its gate ────"
mutate "the admin month-revenue tile drops its WHERE" "$ADM" \
  "s=s.replace('WHERE \${REV_COUNTED}\n                       AND MONTH', 'WHERE MONTH')"

mutate "revenue-by-day drops its gate" "$ORD" \
  "s=s.replace('       WHERE \${COUNTED}\n         AND created_at >=', '       WHERE created_at >=')"

mutate "the KPI strip sums every order again" "$ORD" \
  "s=s.replace('COALESCE(SUM(CASE WHEN \${COUNTED} THEN total END),0)        AS total_revenue', 'COALESCE(SUM(total),0)                                      AS total_revenue')"

echo
echo "──── the JS predicate loses sight of its columns ────"
# The undefined-column trap: the filter silently matches nothing.
mutate "the detail query stops selecting payment_captured_at" "$CUST" \
  "s=s.replace('             o.payment_status, o.payment_captured_at', '             o.payment_status')"

mutate "the detail query stops selecting payment_status" "$CUST" \
  "s=s.replace('             o.payment_status, o.payment_captured_at', '             o.payment_captured_at')"

mutate "the detail page reverts to filtering on is_test alone" "$CUST" \
  "s=s.replace('      spent:  orders.filter(revenue.isCounted)', \"      spent:  orders.filter(o => String(o.is_test) !== '1')\")"

echo
echo "──── restore verification ────"
restore
trap - INT TERM
BAD=0
for f in "${FILES[@]}"; do
  cmp -s "$f" "$TMP/$(echo "$f" | tr '/' '_')" || { echo "  NOT RESTORED: $f"; BAD=1; }
done
[ "$BAD" = "0" ] && echo "  all ${#FILES[@]} files byte-identical to their backups"
node "$GATE" >/dev/null 2>&1 && echo "  gate green again after restore" \
  || { echo "  GATE RED AFTER RESTORE — the tree is dirty"; BAD=1; }
rm -rf "$TMP"

echo
TOTAL=$((PASS+MISS))
echo "  mutations: $PASS/$TOTAL caught"
echo
[ "$MISS" != "0" ] || [ "$BAD" != "0" ] && exit 1
exit 0
