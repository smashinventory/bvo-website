#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# mutate_payment_gate.sh — negative tests for gates/gate_payment_retry.js
#
#   bash mutate_payment_gate.sh
#
# Re-breaks each invariant and confirms the gate goes RED.
#
# ⚠️ THE FIRST MUTATION, M1, IS THE ACTUAL 2026-10-21 DEFECT RESTORED
# VERBATIM. If the gate does not go red on M1 it is worthless, because M1
# is the code that was live when two orders were stranded with money held
# at Stripe and nothing on the site showing them.
#
# ANCHOR RULES THIS SCRIPT ENFORCES ON ITSELF:
#   · every anchor must match EXACTLY ONCE (Rule 17a)
#   · never anchor on prose. checkoutController and revenue.js now DOCUMENT
#     this defect at length, so the strings "payment_status = 'pending'",
#     "'failed'" and "draft', 'pending'" all appear inside comments as well
#     as in code (Rule 18 corollary: quoting old code in a comment makes it
#     a mutation target). Every anchor below carries enough surrounding
#     syntax to be unambiguous.
# ─────────────────────────────────────────────────────────────────────────────
set -u
cd "$(dirname "$0")" || exit 1

GATE="gates/gate_payment_retry.js"
CHECKOUT="src/controllers/checkoutController.js"
REVENUE="src/config/revenue.js"

ALL=("$CHECKOUT" "$REVENUE")

BACKUP=$(mktemp -d) || exit 1
for f in "${ALL[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$f")"; cp "$f" "$BACKUP/$f" || { echo "cannot back up $f"; exit 1; }
done
restore() { for f in "${ALL[@]}"; do cp "$BACKUP/$f" "$f"; done; }
trap 'restore; rm -rf "$BACKUP"' EXIT

CAUGHT=0; MISSED=0; BROKEN=0

if ! node "$GATE" >/dev/null 2>&1; then
  echo "ABORT: the gate is RED before any mutation."
  node "$GATE" 2>&1 | grep -E '^\s+FAIL' | head -20
  exit 1
fi
echo "baseline: GREEN"; echo

mutate() {
  local label="$1" file="$2" find="$3" repl="$4" expect="${5:-catch}"
  restore
  local n
  n=$(FIND="$find" python3 -c "
import os,re,sys
print(len(re.findall(os.environ['FIND'], open(sys.argv[1],encoding='utf-8').read())))
" "$file")
  if [ "$n" != "1" ]; then
    printf 'ANCHOR  %-58s matched %s times (need 1)\n' "$label" "$n"; BROKEN=$((BROKEN+1)); return
  fi
  FIND="$find" REPL="$repl" python3 -c "
import os,re,sys
s=open(sys.argv[1],encoding='utf-8').read()
s=re.sub(os.environ['FIND'], lambda m: os.environ['REPL'], s, count=1)
open(sys.argv[1],'w',encoding='utf-8').write(s)
" "$file"
  if node "$GATE" >/dev/null 2>&1; then
    if [ "$expect" = "allow" ]; then printf 'ok      %-58s correctly ALLOWED\n' "$label"; CAUGHT=$((CAUGHT+1));
    else printf 'MISSED  %-58s gate stayed GREEN\n' "$label"; MISSED=$((MISSED+1)); fi
  else
    if [ "$expect" = "allow" ]; then printf 'FALSE+  %-58s went RED on a legitimate edit\n' "$label"; MISSED=$((MISSED+1));
    else printf 'ok      %-58s caught\n' "$label"; CAUGHT=$((CAUGHT+1)); fi
  fi
}

echo "── the authorisation guard — the live defect ────────────────────────────"
# THE BUG ITSELF. Anchored on payment_authorized_at = NOW() immediately
# above, because "payment_status IN ('pending', 'failed')" alone also
# matches setOrderDetails.
mutate "M1  THE 2026-10-21 DEFECT RESTORED ('pending' only)" "$CHECKOUT" \
  "payment_authorized_at = NOW\(\)\n        WHERE id = \? AND payment_status IN \('pending', 'failed'\)" \
  "payment_authorized_at = NOW()\n        WHERE id = ? AND payment_status IN ('pending')"
mutate "M2  guard widened to re-open an authorised order" "$CHECKOUT" \
  "payment_authorized_at = NOW\(\)\n        WHERE id = \? AND payment_status IN \('pending', 'failed'\)" \
  "payment_authorized_at = NOW()\n        WHERE id = ? AND payment_status IN ('pending', 'failed', 'auth_only')"
mutate "M3  guard widened to resurrect a refunded order" "$CHECKOUT" \
  "payment_authorized_at = NOW\(\)\n        WHERE id = \? AND payment_status IN \('pending', 'failed'\)" \
  "payment_authorized_at = NOW()\n        WHERE id = ? AND payment_status IN ('pending', 'failed', 'refunded')"

echo
echo "── terminal events must name their own PaymentIntent ────────────────────"
mutate 'M4  the PaymentIntent condition dropped entirely' "$CHECKOUT" \
  "    piClause = ' AND \(payment_transaction_id IS NULL OR payment_transaction_id = \?\)';" \
  "    piClause = '';"
mutate 'M5  the PI condition matches ANY intent (always true)' "$CHECKOUT" \
  'OR payment_transaction_id = \?\)' \
  'OR 1 = 1)'
mutate 'M6  cancel event stops passing the PI id' "$CHECKOUT" \
  "'canceled', CANCELABLE_FROM, event\.data\.object\.id\);" \
  "'canceled', CANCELABLE_FROM);"
mutate 'M7  failed event stops passing the PI id' "$CHECKOUT" \
  "'failed', OPEN_PAYMENT_STATES, event\.data\.object\.id\);" \
  "'failed', OPEN_PAYMENT_STATES);"
mutate 'M8  a late failure may clobber an authorised order' "$CHECKOUT" \
  "const OPEN_PAYMENT_STATES = \['pending', 'failed'\];" \
  "const OPEN_PAYMENT_STATES = ['pending', 'failed', 'auth_only'];"
mutate 'M9  a second decline is silently discarded' "$CHECKOUT" \
  "const OPEN_PAYMENT_STATES = \['pending', 'failed'\];" \
  "const OPEN_PAYMENT_STATES = ['pending'];"

echo
echo "── the checkout keeps the order while the buyer retries ─────────────────"
mutate "M10 EDITABLE drops 'failed' — declined buyer loses the form" "$CHECKOUT" \
  "const EDITABLE = \"payment_status IN \('draft','pending','failed'\)\";" \
  "const EDITABLE = \"payment_status IN ('draft','pending')\";"
mutate "M11 EDITABLE lets a buyer edit an AUTHORISED order" "$CHECKOUT" \
  "const EDITABLE = \"payment_status IN \('draft','pending','failed'\)\";" \
  "const EDITABLE = \"payment_status IN ('draft','pending','failed','auth_only')\";"
mutate "M12 setOrderDetails drops 'failed'" "$CHECKOUT" \
  "UPDATE orders SET \\\$\{sets\.join\(', '\)\}\n        WHERE id = \? AND payment_status IN \('pending', 'failed'\)" \
  "UPDATE orders SET \${sets.join(', ')}\n        WHERE id = ? AND payment_status IN ('pending')"
mutate "M13 the outage revert drops 'failed'" "$CHECKOUT" \
  "payment_status = 'draft'\n        WHERE id = \? AND payment_status IN \('pending', 'failed'\)" \
  "payment_status = 'draft'\n        WHERE id = ? AND payment_status IN ('pending')"

echo
echo "── a decline is neither revenue nor money in flight ─────────────────────"
mutate "M14 'failed' counts as a real order again" "$REVENUE" \
  "const PLACEHOLDER_PAYMENT = \"\('draft', 'pending', 'failed'\)\";" \
  "const PLACEHOLDER_PAYMENT = \"('draft', 'pending')\";"
mutate 'M15 the placeholder list is emptied' "$REVENUE" \
  "const PLACEHOLDER_PAYMENT = \"\('draft', 'pending', 'failed'\)\";" \
  "const PLACEHOLDER_PAYMENT = \"('draft')\";"
# The drift this module exists to stop: the JS twin stops deriving from the
# SQL constant and carries its own list again.
mutate 'M16 the JS twin re-hardcodes its own state list' "$REVENUE" \
  "      && !PLACEHOLDER_LIST\.includes\(row\.payment_status\)\n      && !row\.payment_captured_at;" \
  "      \&\& !['draft', 'pending'].includes(row.payment_status)\n      \&\& !row.payment_captured_at;"

echo
echo "── legitimate edits that must NOT trip the gate ─────────────────────────"
# A gate that fires on a harmless change gets edited away. Both of these
# are real things someone might do.
mutate 'M17 a comment above the guard is reworded' "$CHECKOUT" \
  "A declined first attempt is ordinary behaviour, not an error state\." \
  "A declined first attempt is normal, not an error state." allow
mutate 'M18 the allowed-from states are reordered' "$CHECKOUT" \
  "const OPEN_PAYMENT_STATES = \['pending', 'failed'\];" \
  "const OPEN_PAYMENT_STATES = ['failed', 'pending'];" allow

echo
restore
echo "caught/allowed correctly: $CAUGHT    missed: $MISSED    bad anchors: $BROKEN"
if [ "$MISSED" -eq 0 ] && [ "$BROKEN" -eq 0 ]; then
  echo "RESULT: every mutation handled as intended."
  exit 0
fi
echo "RESULT: the gate does NOT hold. Fix it before pushing."
exit 1
