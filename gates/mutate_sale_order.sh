#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# mutate_sale_order.sh — proves gate_sale_order.js catches a Deals page
# that has stopped leading with the biggest dollar saving.
#
# M1 IS THE PRE-CHANGE STATE RESTORED VERBATIM: is_deal/is_featured/
# created_at. That ordering put 18 faucets above every vanity and buried
# the largest discount on the site below the fold.
#
# M5 IS THE ONE THE STATIC HALF CANNOT SEE. The SQL stays perfect and
# buildSaleView re-sorts the pool by price in JS, throwing the ORDER BY
# away. Only the executed half catches it — which is the whole reason that
# half exists.
#
# Run from the repo root:  bash gates/mutate_sale_order.sh
# ═══════════════════════════════════════════════════════════════════════

set -uo pipefail
cd "$(dirname "$0")/.."

GATE=gates/gate_sale_order.js
C=src/controllers/collectionsController.js
U=src/utils/saleFacets.js

for f in "$C" "$U"; do cp "$f" "$f.mutbak"; done
restore() { for f in "$C" "$U"; do [ -f "$f.mutbak" ] && mv -f "$f.mutbak" "$f"; done; }
trap restore EXIT INT TERM
resnap() { for f in "$C" "$U"; do cp "$f" "$f.mutbak"; done; }

MISSED=0; RAN=0

expect_red() {
  RAN=$((RAN+1))
  local label="$1" want="$2" out
  out="$(node "$GATE" 2>&1)"
  if echo "$out" | grep -q "ALL GATES PASS"; then
    echo "  MISSED  $label — GATE STILL PASSED"
    MISSED=$((MISSED+1))
  elif echo "$out" | grep -q "FAIL  $want"; then
    echo "  caught  $label"
  else
    echo "  MISSED  $label — red, but not on \"$want\""
    echo "$out" | grep -E "FAIL|Error" | sed 's/^/            /'
    MISSED=$((MISSED+1))
  fi
  restore; resnap
}

ORDER_OLD="        ORDER BY p.is_deal DESC, p.is_featured DESC, p.created_at DESC"
ORDER_NEW_RE="ORDER BY \(COALESCE\(p\.compare_price, p\.price\) - p\.price\) DESC,\n                 p\.is_deal DESC, p\.is_featured DESC, p\.created_at DESC, p\.id DESC"

echo "=== baseline ==="
if node "$GATE" >/dev/null 2>&1; then echo "  ok      baseline green"
else echo "  ABORT   baseline red"; node "$GATE" 2>&1 | grep FAIL; exit 1; fi

echo
echo "=== M1: revert to the old created_at-first order ==="
python3 - "$C" <<'PY'
import sys,re
p=sys.argv[1]; s=open(p,encoding='utf-8').read()
new=("        ORDER BY (COALESCE(p.compare_price, p.price) - p.price) DESC,\n"
     "                 p.is_deal DESC, p.is_featured DESC, p.created_at DESC, p.id DESC")
assert new in s, "M1 anchor missing"
s=s.replace(new,"        ORDER BY p.is_deal DESC, p.is_featured DESC, p.created_at DESC",1)
open(p,'w',encoding='utf-8').write(s)
PY
expect_red "M1 old order restored" "the FIRST sort key is the saving"

echo
echo "=== M2: saving sorted ASCENDING (smallest deal first) ==="
python3 - "$C" <<'PY'
import sys
p=sys.argv[1]; s=open(p,encoding='utf-8').read()
a="(COALESCE(p.compare_price, p.price) - p.price) DESC,"
assert a in s, "M2 anchor missing"
open(p,'w',encoding='utf-8').write(s.replace(a,"(COALESCE(p.compare_price, p.price) - p.price) ASC,",1))
PY
expect_red "M2 ascending" "it sorts the saving DESCENDING"

echo
echo "=== M3: COALESCE dropped — NULL compare_price sorts as NULL ==="
python3 - "$C" <<'PY'
import sys
p=sys.argv[1]; s=open(p,encoding='utf-8').read()
a="(COALESCE(p.compare_price, p.price) - p.price) DESC,"
assert a in s, "M3 anchor missing"
open(p,'w',encoding='utf-8').write(s.replace(a,"(p.compare_price - p.price) DESC,",1))
PY
expect_red "M3 no COALESCE" "NULL compare_price is coalesced"

echo
echo "=== M4: the unique final tiebreak is removed ==="
python3 - "$C" <<'PY'
import sys
p=sys.argv[1]; s=open(p,encoding='utf-8').read()
a="p.created_at DESC, p.id DESC"
assert a in s, "M4 anchor missing"
open(p,'w',encoding='utf-8').write(s.replace(a,"p.created_at DESC",1))
PY
expect_red "M4 no total order" "the order is total"

echo
echo "=== M5: SQL untouched, but the util re-sorts in JS ==="
# This is the regression the static half is blind to: someone adds a sort
# feature and reaches for pool.sort() instead of a second query.
python3 - "$U" <<'PY'
import sys
p=sys.argv[1]; s=open(p,encoding='utf-8').read()
a="  const pages = Math.max(1, Math.ceil(matched.length / PER_PAGE));"
assert a in s, "M5 anchor missing"
s=s.replace(a,"  matched.sort((a,b) => parseFloat(a.price) - parseFloat(b.price));\n"+a,1)
open(p,'w',encoding='utf-8').write(s)
PY
expect_red "M5 util re-sorts by price" "unfiltered: order is preserved exactly"

echo
echo "─────────────────────────────────────────────"
if [ "$MISSED" -eq 0 ]; then
  echo "$RAN mutations, 0 missed — the sale-order gate is real."
  exit 0
else
  echo "$RAN mutations, $MISSED MISSED. Fix the gate."
  exit 1
fi
