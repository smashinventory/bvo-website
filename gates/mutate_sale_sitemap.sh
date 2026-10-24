#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# mutate_sale_sitemap.sh
#
# M1 is the original defect: the Deals page absent from the sitemap.
#
# M4 IS THE EXPENSIVE ONE and the reason saleRule.js exists. It gives the
# sitemap its own copy of the WHERE clause. Everything still works today —
# the URL appears, the count is right — and the two definitions drift the
# first time either is edited. That is the Rule 18 trap as a second caller,
# and it is invisible until the page and the sitemap quietly disagree about
# which products are on sale.
#
# M6 is the empty-is-not-zero case, which has already been wrong once in
# this codebase: Number('') is 0, so a cleared Theme Editor box becomes a
# 0% threshold and every discounted product qualifies.
#
# Run from the repo root:  bash gates/mutate_sale_sitemap.sh
# ═══════════════════════════════════════════════════════════════════════

set -uo pipefail
cd "$(dirname "$0")/.."

GATE=gates/gate_sale_sitemap.js
S=src/controllers/sitemapController.js
C=src/controllers/collectionsController.js
R=src/config/saleRule.js

for f in "$S" "$C" "$R"; do cp "$f" "$f.mutbak"; done
restore() { for f in "$S" "$C" "$R"; do [ -f "$f.mutbak" ] && mv -f "$f.mutbak" "$f"; done; }
trap restore EXIT INT TERM
resnap() { for f in "$S" "$C" "$R"; do cp "$f" "$f.mutbak"; done; }

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
echo "=== M1: the original defect — no sale URL at all ==="
py "$S" '    <loc>${escUrl(siteUrl)}/collections/sale</loc>' '    <loc>${escUrl(siteUrl)}/collections/REMOVED</loc>'
expect_red "M1 sale URL gone" "the sale URL is emitted"

echo
echo "=== M2: emitted unconditionally, even with nothing on sale ==="
py "$S" "    if (saleCount > 0) {" "    if (true) {"
expect_red "M2 thin page submitted" "ONLY when something qualifies"

echo
echo "=== M3: a failed count still emits the URL ==="
py "$S" "    let saleCount = 0, saleLastmod = null;" "    let saleCount = 1, saleLastmod = null;"
expect_red "M3 fails open" "defaults to 0"

echo
echo "=== M4: THE EXPENSIVE ONE — sitemap gets its own WHERE clause ==="
py "$S" '          WHERE ${saleRule.SALE_WHERE}`, [frac]' '          WHERE p.is_active = 1 AND p.compare_price IS NOT NULL AND p.compare_price > 0 AND (p.compare_price - p.price) / p.compare_price >= ?`, [frac]'
expect_red "M4 second definition of on-sale" "the sitemap uses the shared predicate"

echo
echo "=== M5: the Deals page re-inlines its own WHERE ==="
py "$C" '        WHERE ${saleRule.SALE_WHERE}' '        WHERE p.is_active = 1 AND (p.compare_price - p.price) / p.compare_price >= ?'
expect_red "M5 page diverges from sitemap" "has no second copy of the discount maths"

echo
echo "=== M6: empty threshold treated as 0 (the cleared-box defect) ==="
py "$R" "  const pct = (raw === '' || raw === null || raw === undefined) ? NaN : Number(raw);" "  const pct = Number(raw);"
expect_red "M6 cleared box = 0% threshold" "EMPTY falls back to the default"

echo
echo "=== M7: an explicit 0 silently overridden ==="
py "$R" "  return (Number.isFinite(pct) && pct >= 0 && pct <= 100)" "  return (Number.isFinite(pct) && pct > 0 && pct <= 100)"
expect_red "M7 deliberate zero ignored" "a deliberate 0 IS honoured"

echo
echo "=== M8: sitemap reads the Theme Editor PREVIEW ==="
py "$S" "        ((themeSettings.get() || {}).seo || {}).deals_min_discount_pct" "        ((res.locals.settings || {}).seo || {}).deals_min_discount_pct"
expect_red "M8 preview leaks into the sitemap" "the live saved settings"

echo
echo "─────────────────────────────────────────────"
if [ "$MISSED" -eq 0 ]; then
  echo "$RAN mutations, 0 missed — the sale-sitemap gate is real."
  exit 0
else
  echo "$RAN mutations, $MISSED MISSED. Fix the gate."
  exit 1
fi
