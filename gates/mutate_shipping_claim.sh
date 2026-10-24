#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# mutate_shipping_claim.sh
#
# M1 IS THE INVISIBLE ONE and the reason this gate exists. It restores the
# header fallback to 'Free Shipping on Every Order'. The site looks
# identical — the saved setting says "Most Orders", so the fallback never
# renders — right up until an admin clears the promo message, at which
# point an unsupportable commercial promise appears at the top of every
# page. No amount of looking at the live site finds this.
#
# M4 proves the gate strips comments. The fix comments QUOTE the old
# string to explain the change; a gate that did not strip them would fail
# on its own fix, and the tempting repair is to delete the explanation.
#
# Run from the repo root:  bash gates/mutate_shipping_claim.sh
# ═══════════════════════════════════════════════════════════════════════

set -uo pipefail
cd "$(dirname "$0")/.."

GATE=gates/gate_shipping_claim.js
H=views/partials/header.ejs
I=views/pages/index-1.ejs
F=views/pages/cart.ejs

for f in "$H" "$I" "$F"; do cp "$f" "$f.mutbak"; done
restore() { for f in "$H" "$I" "$F"; do [ -f "$f.mutbak" ] && mv -f "$f.mutbak" "$f"; done; }
trap restore EXIT INT TERM
resnap() { for f in "$H" "$I" "$F"; do cp "$f" "$f.mutbak"; done; }

MISSED=0; RAN=0

expect_red() {
  RAN=$((RAN+1))
  local label="$1" want="$2" out
  out="$(node "$GATE" 2>&1)"
  if echo "$out" | grep -q "ALL GATES PASS"; then
    echo "  MISSED  $label — GATE STILL PASSED"
    MISSED=$((MISSED+1))
  elif echo "$out" | grep -q "FAIL.*$want"; then
    echo "  caught  $label"
  else
    echo "  MISSED  $label — red, but not on \"$want\""
    echo "$out" | grep FAIL | head -3 | sed 's/^/            /'
    MISSED=$((MISSED+1))
  fi
  restore; resnap
}

py() { python3 - "$1" "$2" "$3" <<'PY'
import sys
p, old, new = sys.argv[1], sys.argv[2], sys.argv[3]
s = open(p, encoding='utf-8').read()
assert old in s, "anchor missing in " + p
open(p, 'w', encoding='utf-8').write(s.replace(old, new, 1))
PY
}

echo "=== baseline ==="
if node "$GATE" >/dev/null 2>&1; then echo "  ok      baseline green"
else echo "  ABORT   baseline red"; node "$GATE" 2>&1 | grep FAIL; exit 1; fi

echo
echo "=== M1: the invisible one — fallback back to 'Every Order' ==="
py "$H" "ps.message || 'Free Shipping on Most Orders'" "ps.message || 'Free Shipping on Every Order'"
expect_red "M1 unsupportable fallback restored" "no customer-facing template claims"

echo
echo "=== M2: the fallback deleted entirely (blank promo bar) ==="
py "$H" "<%= ps.message || 'Free Shipping on Most Orders' %>" "<%= ps.message %>"
expect_red "M2 fallback removed" "the fallback still exists at all"

echo
echo "=== M3: the claim reappears in the unused index-1 variant ==="
py "$I" "<p>On most orders — no minimums</p>" "<p>On every order, every time — no minimums</p>"
expect_red "M3 dead file regresses" "no customer-facing template claims"

echo
echo "=== M4: the claim hidden inside a COMMENT must NOT trip the gate ==="
# Comments are stripped, so this must stay GREEN. A gate that fails here
# would fail on its own explanatory comments.
RAN=$((RAN+1))
py "$F" "<%" "<%/* free shipping on every order - historical note */%><%"
if node "$GATE" >/dev/null 2>&1; then
  echo "  caught  M4 comment correctly ignored (gate stayed green)"
else
  echo "  MISSED  M4 — the gate failed on a COMMENT, not on rendered text"
  node "$GATE" 2>&1 | grep FAIL | head -2 | sed 's/^/            /'
  MISSED=$((MISSED+1))
fi
restore; resnap

echo
echo "=== M5: a NEW customer-facing page makes the claim ==="
py "$F" "<%" "<p>Free shipping on every order, no minimums</p><%"
expect_red "M5 new offender detected" "no customer-facing template claims"

echo
echo "─────────────────────────────────────────────"
if [ "$MISSED" -eq 0 ]; then
  echo "$RAN mutations, 0 missed — the shipping-claim gate is real."
  exit 0
else
  echo "$RAN mutations, $MISSED MISSED. Fix the gate."
  exit 1
fi
