#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# mutate_consent_unblock.sh
#
# M1 IS THE ONE THAT MATTERS. "Unblock whenever someone consents" is the
# obvious one-line version of this feature and it is WRONG: it re-enables
# hard-bounced addresses, and repeatedly sending to a dead mailbox is one
# of the fastest ways to wreck sender reputation — which degrades delivery
# for every other customer. Both addresses currently blocked on this
# account are hardBounce, so this is not hypothetical.
#
# M2 is its sibling: a deny-list instead of an allow-list. It passes every
# test for today's known reasons and silently starts auto-restoring
# whatever Brevo invents next.
#
# Run from the repo root:  bash gates/mutate_consent_unblock.sh
# ═══════════════════════════════════════════════════════════════════════

set -uo pipefail
cd "$(dirname "$0")/.."

GATE=gates/gate_consent_unblock.js
S=src/services/consentUnblock.js
C=src/controllers/checkoutController.js

for f in "$S" "$C"; do cp "$f" "$f.mutbak"; done
restore() { for f in "$S" "$C"; do [ -f "$f.mutbak" ] && mv -f "$f.mutbak" "$f"; done; }
trap restore EXIT INT TERM
resnap() { for f in "$S" "$C"; do cp "$f" "$f.mutbak"; done; }

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
echo "=== M1: unblock on ANY consent (the naive version) ==="
py "$S" "  return /unsubscrib/i.test(r);" "  return true;"
expect_red "M1 restores hard bounces" "REFUSES: hardBounce"

echo
echo "=== M2: deny-list instead of allow-list ==="
py "$S" "  return /unsubscrib/i.test(r);" "  return !/hardBounce|spam/i.test(r);"
expect_red "M2 deny-list lets future reasons through" "REFUSES an unrecognised future reason"

echo
echo "=== M3: a missing reason is treated as restorable ==="
py "$S" "  if (reason === null || reason === undefined) return false;" "  if (reason === null || reason === undefined) return true;"
expect_red "M3 undefined reason restores" "REFUSES a missing reason"

echo
echo "=== M4: reason not consulted at all before unblocking ==="
py "$S" "    if (!mayUnblock(row.email_blocked_reason)) {" "    if (false) {"
expect_red "M4 reason check bypassed" "the reason is consulted before unblocking"

echo
echo "=== M5: local flags cleared BEFORE Brevo confirms ==="
python3 - "$S" <<'PY'
import sys,re
p=sys.argv[1]; s=open(p,encoding='utf-8').read()
i=s.index("    const brevo = require('./brevoService');")
j=s.index("    await pool().query(\n      `UPDATE customers\n          SET email_blocked = 0")
k=s.index("    /* Same audit table", j)
block=s[j:k]
s=s[:j]+s[k:]
s=s[:i]+block+s[i:]
open(p,'w',encoding='utf-8').write(s)
PY
expect_red "M5 clears before confirming" "local flags clear only AFTER"

echo
echo "=== M6: checkout restores even when they DECLINED consent ==="
py "$C" "      if (wantsMarketing) {" "      if (true) {"
expect_red "M6 unblocks people who opted out" "only restores when they actually consented"

echo
echo "─────────────────────────────────────────────"
if [ "$MISSED" -eq 0 ]; then
  echo "$RAN mutations, 0 missed — the consent-unblock gate is real."
  exit 0
else
  echo "$RAN mutations, $MISSED MISSED. Fix the gate."
  exit 1
fi
