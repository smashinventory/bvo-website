#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# mutate_card_stock.sh — proves gate_card_stock.js catches the Deals bug.
#
# M1 IS THE LIVE DEFECT RESTORED VERBATIM. On 2026-10-24 all 22 cards on
# /collections/sale read "QTY: 0" while the same SKUs read 3-6 on the model
# page, because the sale query never joined `inventory` and the view does
# parseInt(product.qty_on_hand || 0). Nothing errored. The owner found it
# from a screenshot, not from a gate.
#
# M3 IS THE SUBTLE ONE: keep the SELECT, drop the JOIN. The column name is
# still in the file, so any gate that only greps for "qty_on_hand" stays
# green while the query is broken.
#
# M5 checks the gate is not satisfied by PROSE — the fix comments discuss
# qty_on_hand and inventory at length right beside the SQL.
#
# Run from the repo root:  bash gates/mutate_card_stock.sh
# ═══════════════════════════════════════════════════════════════════════

set -uo pipefail
cd "$(dirname "$0")/.."

GATE=gates/gate_card_stock.js
C=src/controllers/collectionsController.js
P=src/models/Product.js
V=views/pages/collection.ejs

for f in "$C" "$P" "$V"; do cp "$f" "$f.mutbak"; done
restore() { for f in "$C" "$P" "$V"; do [ -f "$f.mutbak" ] && mv -f "$f.mutbak" "$f"; done; }
trap restore EXIT INT TERM
resnap() { for f in "$C" "$P" "$V"; do cp "$f" "$f.mutbak"; done; }

MISSED=0; RAN=0

expect_red() {
  RAN=$((RAN+1))
  local label="$1" want="$2" out
  out="$(node "$GATE" 2>&1)"
  if echo "$out" | grep -q "ALL GATES PASS"; then
    echo "  MISSED  $label — GATE STILL PASSED"
    MISSED=$((MISSED+1))
  elif echo "$out" | grep -q "$want"; then
    echo "  caught  $label"
  else
    echo "  MISSED  $label — red, but not on \"$want\""
    echo "$out" | grep FAIL | sed 's/^/            /'
    MISSED=$((MISSED+1))
  fi
  restore; resnap
}

echo "=== baseline ==="
if node "$GATE" >/dev/null 2>&1; then echo "  ok      baseline green"
else echo "  ABORT   baseline red"; node "$GATE" 2>&1 | grep FAIL; exit 1; fi

echo
echo "=== M1: the live defect — sale query loses join AND column ==="
python3 - "$C" <<'PY'
import sys
p=sys.argv[1]; s=open(p,encoding='utf-8').read()
a="               COALESCE(inv.qty_on_hand, 0) AS qty_on_hand,\n"
b="        LEFT JOIN inventory inv ON inv.product_id = p.id\n"
assert a in s and b in s, "M1 anchors missing"
open(p,'w',encoding='utf-8').write(s.replace(a,"",1).replace(b,"",1))
PY
expect_red "M1 Deals page back to QTY: 0" "collectionsController.js #1 selects qty_on_hand"

echo
echo "=== M2: Product.js findRelated loses its join and column ==="
python3 - "$P" <<'PY'
import sys,re
p=sys.argv[1]; s=open(p,encoding='utf-8').read()
s,n1=re.subn(r" *COALESCE\(inv\.qty_on_hand, 0\) AS qty_on_hand,\n","",s,count=1)
s,n2=re.subn(r" *LEFT JOIN inventory inv ON inv\.product_id = p\.id\n","",s,count=1)
assert n1==1 and n2==1, f"M2 anchors {n1},{n2}"
open(p,'w',encoding='utf-8').write(s)
PY
expect_red "M2 findRelated stripped" "selects qty_on_hand"

echo
echo "=== M3: THE SUBTLE ONE — keep the SELECT, drop only the JOIN ==="
python3 - "$C" <<'PY'
import sys
p=sys.argv[1]; s=open(p,encoding='utf-8').read()
b="        LEFT JOIN inventory inv ON inv.product_id = p.id\n"
assert b in s, "M3 anchor missing"
open(p,'w',encoding='utf-8').write(s.replace(b,"",1))
PY
expect_red "M3 column without join" "joins the inventory table"

echo
echo "=== M4: the view stops reading the column the gate protects ==="
python3 - "$V" <<'PY'
import sys
p=sys.argv[1]; s=open(p,encoding='utf-8').read()
a="product.qty_on_hand"
assert a in s, "M4 anchor missing"
open(p,'w',encoding='utf-8').write(s.replace(a,"product.stock_level"))
PY
expect_red "M4 view renamed the field" "collection.ejs reads product.qty_on_hand"

echo
echo "=== M5: SQL stripped but the EXPLANATORY COMMENT still names it ==="
# The fix comment mentions qty_on_hand and inventory repeatedly. If the
# gate did not strip comments first, this mutation stays green.
python3 - "$C" <<'PY'
import sys
p=sys.argv[1]; s=open(p,encoding='utf-8').read()
a="               COALESCE(inv.qty_on_hand, 0) AS qty_on_hand,\n"
b="        LEFT JOIN inventory inv ON inv.product_id = p.id\n"
assert a in s and b in s, "M5 anchors missing"
s=s.replace(a,"               /* was: COALESCE(inv.qty_on_hand,0) AS qty_on_hand */\n",1)
s=s.replace(b,"        /* was: LEFT JOIN inventory inv ON inv.product_id = p.id */\n",1)
open(p,'w',encoding='utf-8').write(s)
PY
expect_red "M5 comment-only SQL" "collectionsController.js #1 selects qty_on_hand"

echo
echo "─────────────────────────────────────────────"
if [ "$MISSED" -eq 0 ]; then
  echo "$RAN mutations, 0 missed — the card-stock gate is real."
  exit 0
else
  echo "$RAN mutations, $MISSED MISSED. Fix the gate."
  exit 1
fi
