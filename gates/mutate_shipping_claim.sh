#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# mutate_shipping_claim.sh — harness for gate_shipping_claim.js (93 checks).
#
# The gate's own header references "Mutation M10" but no harness survived
# in gates/. This is that harness, written 2026-10-24 against the real
# gate rather than a reconstruction of it.
#
# M2 IS M10 — the cheapest way to "fix" a failing run is to delete the
# offending file from SURFACES. The gate goes green, the claim stays live,
# and nothing in the diff looks alarming. That is why the surface list is
# itself under test.
#
# M3 IS THE DOCUMENTED PAST MISS. The first version of the FORBIDDEN
# patterns used a single \s+ and "Shipping on every single order" walked
# straight through it, in two theme defaults and an index.ejs fallback.
# The gate was green and the live homepage carried the claim in three
# places. If M3 stops failing, that hole is back.
#
# M5 IS THE OTHER HALF — "absence is not compliance". A page can lose its
# QUALIFIED claim entirely and a forbid-only gate stays silent.
#
# Run from the repo root:  bash gates/mutate_shipping_claim.sh
# ═══════════════════════════════════════════════════════════════════════

set -uo pipefail
cd "$(dirname "$0")/.."

GATE=gates/gate_shipping_claim.js
H=views/partials/header.ejs
I=views/pages/index.ejs
F=views/partials/footer.ejs

for f in "$GATE" "$H" "$I" "$F"; do cp "$f" "$f.mutbak"; done
restore() { for f in "$GATE" "$H" "$I" "$F"; do [ -f "$f.mutbak" ] && mv -f "$f.mutbak" "$f"; done; }
trap restore EXIT INT TERM
resnap() { for f in "$GATE" "$H" "$I" "$F"; do cp "$f" "$f.mutbak"; done; }

MISSED=0; RAN=0

expect_red() {
  RAN=$((RAN+1))
  local label="$1" want="$2" out
  out="$(node "$GATE" 2>&1)"
  if echo "$out" | grep -qE "^GREEN"; then
    echo "  MISSED  $label — GATE STILL GREEN"
    MISSED=$((MISSED+1))
  elif echo "$out" | grep -q "$want"; then
    echo "  caught  $label"
  else
    echo "  MISSED  $label — failed, but not on \"$want\""
    echo "$out" | grep "FAIL" | head -3 | sed 's/^/            /'
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
if node "$GATE" 2>&1 | grep -qE "^GREEN"; then echo "  ok      baseline green"
else echo "  ABORT   baseline red"; node "$GATE" 2>&1 | grep FAIL | head -5; exit 1; fi

echo
echo "=== M1: the promo-strip fallback returns to 'Every Order' ==="
py "$H" "'Free Shipping on Most Orders'" "'Free Shipping on Every Order'"
expect_red "M1 header fallback regresses" "FAIL views/partials/header.ejs"

echo
echo "=== M2 (the old M10): header.ejs quietly dropped from SURFACES ==="
py "$GATE" "  'views/partials/header.ejs'," "  "
expect_red "M2 surface list shortened" "views/partials/header.ejs is still in the surface list"

echo
echo "=== M3: the 'every SINGLE order' variant, which once slipped through ==="
py "$H" "'Free Shipping on Most Orders'" "'Free Shipping on every single order'"
expect_red "M3 word-between variant" "FAIL views/partials/header.ejs"

echo
echo "=== M4: the 'always free shipping' phrasing ==="
py "$H" "'Free Shipping on Most Orders'" "'Shipping is always free'"
expect_red "M4 always-free phrasing" "FAIL views/partials/header.ejs"

echo
echo "=== M5: ABSENCE IS NOT COMPLIANCE — footer loses its qualifier ==="
python3 - "$F" <<'PY'
import sys, re
p = sys.argv[1]; s = open(p, encoding='utf-8').read()
s2 = re.sub(r'(?i)most orders', 'orders', s, count=0)
assert s2 != s, "footer had no 'most orders' to remove"
open(p, 'w', encoding='utf-8').write(s2)
PY
expect_red "M5 qualified claim removed" "still makes the qualified claim"

echo
echo "=== M6: a FORBIDDEN pattern deleted from the gate ==="
py "$GATE" "  { re: /every\\s+order,\\s*every\\s+time/i," "  { re: /__never_matches__/i,"
# With the pattern gone, plant the phrasing it existed to catch.
py "$I" "<%" "<p>Free shipping, every order, every time</p><%"
expect_red "M6 pattern removed and phrasing planted" "FAIL views/pages/index.ejs"

echo
echo "─────────────────────────────────────────────"
if [ "$MISSED" -eq 0 ]; then
  echo "$RAN mutations, 0 missed — the shipping-claim gate is real."
  exit 0
else
  echo "$RAN mutations, $MISSED MISSED. Fix the gate."
  exit 1
fi
