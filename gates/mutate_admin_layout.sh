#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# mutate_admin_layout.sh — proves audit_admin_layout.js detects the real
# defect rather than agreeing with whatever the tree happens to say.
#
# THE DEFECT IT GUARDS. server.js sets layouts/main (the STOREFRONT layout)
# as the global default. An admin render with no `layout:` therefore throws
# nothing — it quietly serves the admin page wrapped in the customer layout,
# cart drawer included, with zero sidebar items. It reads as a CSS problem.
# Found three times: task #205, then /admin/diagnostics/email,
# /admin/shipping/pickup-addresses and /admin/marketing/site on 2026-10-24.
#
# M4 IS THE ONE THAT MATTERS. It puts the words `layout: 'layouts/admin'`
# in a COMMENT above a render that still has no layout — the Rule 18
# corollary, which has bitten this project twice. If M4 goes green the
# audit has stopped stripping comments and is worthless.
#
# Run from the repo root:  bash gates/mutate_admin_layout.sh
# ═══════════════════════════════════════════════════════════════════════

set -uo pipefail
cd "$(dirname "$0")/.."

AUDIT=gates/audit_admin_layout.js
A=src/controllers/emailDiagnosticsController.js
B=src/controllers/pickupAddressController.js
C=src/controllers/siteAnalyticsController.js

for f in "$A" "$B" "$C"; do cp "$f" "$f.mutbak"; done
restore() { for f in "$A" "$B" "$C"; do [ -f "$f.mutbak" ] && mv -f "$f.mutbak" "$f"; done; }
trap restore EXIT INT TERM
resnap() { for f in "$A" "$B" "$C"; do cp "$f" "$f.mutbak"; done; }

MISSED=0; RAN=0

# $1 = label, $2 = substring that must appear in the audit's failure output
expect_red() {
  RAN=$((RAN+1))
  local label="$1" want="$2" out
  out="$(node "$AUDIT" 2>&1)"
  if [ $? -eq 0 ]; then
    echo "  MISSED  $label — AUDIT STILL PASSED"
    MISSED=$((MISSED+1))
  elif echo "$out" | grep -q "$want"; then
    echo "  caught  $label"
  else
    echo "  MISSED  $label — audit failed, but never named $want"
    echo "$out" | sed 's/^/            /'
    MISSED=$((MISSED+1))
  fi
  restore; resnap
}

echo "=== baseline: all 53 admin renders must carry a layout ==="
if node "$AUDIT" >/dev/null 2>&1; then
  echo "  ok      baseline green"
else
  echo "  ABORT   baseline red — fix the tree before mutating"
  node "$AUDIT" 2>&1 | tail -8
  exit 1
fi

echo
echo "=== M1: email diagnostics loses its layout (the page found 2026-10-24) ==="
perl -0pi -e "s{layout: 'layouts/admin',\n}{}" "$A"
expect_red "M1 diagnostics-email" "diagnostics-email"

echo
echo "=== M2: pickup addresses loses its layout ==="
perl -0pi -e "s{layout:\s*'layouts/admin',\n}{}" "$B"
expect_red "M2 pickup-addresses" "pickup-addresses"

echo
echo "=== M3: site analytics loses its layout ==="
perl -0pi -e "s{layout:\s*'layouts/admin',\n}{}" "$C"
expect_red "M3 site-analytics" "site-analytics"

echo
echo "=== M4: layout named only in a COMMENT (Rule 18 corollary) ==="
perl -0pi -e "s{layout: 'layouts/admin',\n}{/* layout: 'layouts/admin' */\n}" "$A"
expect_red "M4 comment-only layout" "diagnostics-email"

echo
echo "=== M5: all three at once — the audit must report THREE, not one ==="
perl -0pi -e "s{layout:\s*'layouts/admin',\n}{}" "$A" "$B" "$C"
RAN=$((RAN+1))
out="$(node "$AUDIT" 2>&1)"
if echo "$out" | grep -q "3 ADMIN RENDER(S) WITH NO LAYOUT"; then
  echo "  caught  M5 all three reported together"
else
  echo "  MISSED  M5 — expected all three, got:"
  echo "$out" | sed 's/^/            /'
  MISSED=$((MISSED+1))
fi
restore; resnap

echo
echo "─────────────────────────────────────────────"
if [ "$MISSED" -eq 0 ]; then
  echo "$RAN mutations, 0 missed — the layout audit is real."
  exit 0
else
  echo "$RAN mutations, $MISSED MISSED. The audit is decoration. Fix it."
  exit 1
fi
