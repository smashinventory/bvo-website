#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# mutate_blocklist_nav.sh — proves the reachability checks in
# gate_email_blocklist.js can actually fail.
#
# WHY THIS EXISTS. Every other check in that gate was green for the whole
# life of /admin/diagnostics/email while the page had no sidebar link. The
# gate was not wrong; it simply never asked the question. The checks added
# 2026-10-24 ask it, and these five mutations are the proof that they do —
# because green on correct code proves nothing.
#
# M2 IS THE ONE THAT MATTERS. It leaves the link in the file but moves it
# out of the nav, which is precisely the mistake a loose `indexOf(href)`
# check would wave through. If M2 stops turning the gate red, the slice has
# been loosened and the check is decoration again.
#
# Run from the repo root:  bash gates/mutate_blocklist_nav.sh
# Restores every file on exit, including on Ctrl-C.
# ═══════════════════════════════════════════════════════════════════════

set -uo pipefail
cd "$(dirname "$0")/.."

LAYOUT=views/layouts/admin.ejs
CTRL=src/controllers/emailDiagnosticsController.js
GATE=gates/gate_email_blocklist.js

# Backups are restored by the trap, so an aborted run cannot leave a
# mutated file behind. That has bitten this project before.
cp "$LAYOUT" "$LAYOUT.mutbak"
cp "$CTRL"   "$CTRL.mutbak"
restore() { mv -f "$LAYOUT.mutbak" "$LAYOUT" 2>/dev/null; mv -f "$CTRL.mutbak" "$CTRL" 2>/dev/null; }
trap restore EXIT INT TERM

MISSED=0
RAN=0

# $1 = label, $2 = the check name that MUST go red
expect_red() {
  RAN=$((RAN+1))
  local label="$1" want="$2" out
  out="$(node "$GATE" 2>&1)"
  if echo "$out" | grep -q "GATE(S) FAILED"; then
    if echo "$out" | grep -q "FAIL  $want"; then
      echo "  caught  $label"
    else
      # Red, but not where we aimed. That is still a miss: it means the
      # mutation was caught by accident and the check under test is unproven.
      echo "  MISSED  $label — gate failed, but not on \"$want\""
      echo "$out" | grep "FAIL" | sed 's/^/            /'
      MISSED=$((MISSED+1))
    fi
  else
    echo "  MISSED  $label — GATE STILL PASSED"
    MISSED=$((MISSED+1))
  fi
  restore
  cp "$LAYOUT" "$LAYOUT.mutbak"; cp "$CTRL" "$CTRL.mutbak"
}

echo "=== baseline: unmutated tree must be green ==="
if node "$GATE" >/dev/null 2>&1; then
  echo "  ok      baseline green"
else
  echo "  ABORT   baseline is already red — fix that before mutating"
  node "$GATE" 2>&1 | grep FAIL
  exit 1
fi

echo
echo "=== M1: delete the sidebar link entirely (the original defect) ==="
perl -0pi -e 's{<a href="/admin/diagnostics/email".*?</a>}{}s' "$LAYOUT"
expect_red "M1 link deleted" "the page is linked from the admin layout at all"

echo
echo "=== M2: link present but moved OUT of the nav (slice integrity) ==="
# Lift the anchor out of the Settings group and drop it in the sidebar
# footer, below </nav>. A prefix-matching check passes this happily.
perl -0pi -e '
  if (s{(<a href="/admin/diagnostics/email".*?</a>)}{}s) {
    my $a = $1;
    s{(<div class="admin-sidebar-footer">)}{$1\n$a}s;
  }' "$LAYOUT"
expect_red "M2 link moved below </nav>" "the link sits INSIDE the Settings group"

echo
echo "=== M3: drop the PAGE_GROUP entry (group never expands) ==="
perl -0pi -e "s{\s*'email-diagnostics'\s*:\s*'settings'}{}s" "$LAYOUT"
expect_red "M3 PAGE_GROUP entry removed" "PAGE_GROUP maps 'email-diagnostics' to settings"

echo
echo "=== M4: controller stops setting activePage (nothing highlights) ==="
perl -0pi -e "s{activePage:\s*'email-diagnostics',}{}s" "$CTRL"
expect_red "M4 activePage removed" "the controller sets that exact activePage"

echo
echo "=== M5: only the EXPLANATORY COMMENT survives, no link ==="
# The comment names the page. If the gate did not strip EJS comments this
# mutation would stay green — the Rule 18 corollary, planted on purpose.
perl -0pi -e '
  s{<a href="/admin/diagnostics/email".*?</a>}{<%/* was: href="/admin/diagnostics/email" Email Health */%>}s
' "$LAYOUT"
expect_red "M5 comment only, link gone" "the page is linked from the admin layout at all"

echo
echo "─────────────────────────────────────────────"
if [ "$MISSED" -eq 0 ]; then
  echo "$RAN mutations, 0 missed — the reachability checks are real."
  exit 0
else
  echo "$RAN mutations, $MISSED MISSED. Those checks are decoration. Fix them."
  exit 1
fi
