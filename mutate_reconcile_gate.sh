#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# mutate_reconcile_gate.sh — negative tests for gates/gate_stripe_reconcile.js
#
#   bash mutate_reconcile_gate.sh
#
# The reconciler runs UNATTENDED on the money path. It has two failure modes
# and this harness exercises both:
#
#   · it stops catching stranded orders — silent, indistinguishable from
#     "nothing was wrong", which is the exact failure it was built to end
#   · it settles something Stripe has NOT authorised — worse than the bug it
#     replaces, because it manufactures an order against money nobody holds,
#     automatically, every fifteen minutes, forever
#
# R1 and R5 are the two that matter most. R5 in particular: if the gate stays
# green while a CANCELED PaymentIntent is treated as settleable, delete the
# gate, because it is actively misleading.
# ─────────────────────────────────────────────────────────────────────────────
set -u
cd "$(dirname "$0")" || exit 1

GATE="gates/gate_stripe_reconcile.js"
JOB="src/jobs/reconcileStripeOrders.js"
CHECKOUT="src/controllers/checkoutController.js"
WRAP="reconcile_stripe.sh"

ALL=("$JOB" "$CHECKOUT" "$WRAP")

BACKUP=$(mktemp -d) || exit 1
for f in "${ALL[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$f")"; cp "$f" "$BACKUP/$f" || { echo "cannot back up $f"; exit 1; }
done
restore() { for f in "${ALL[@]}"; do cp "$BACKUP/$f" "$f"; done; }
trap 'restore; rm -rf "$BACKUP"' EXIT INT TERM

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

echo "── it must keep CATCHING stranded orders ────────────────────────────────"
mutate "R1  'failed' dropped — the original blind spot returns" "$JOB" \
  "const SETTLEABLE_FROM = \['pending', 'failed'\];" \
  "const SETTLEABLE_FROM = ['pending'];"
mutate 'R2  requires_capture dropped from the authorised set' "$JOB" \
  "const AUTHORISED_PI = \['requires_capture', 'succeeded', 'processing'\];" \
  "const AUTHORISED_PI = ['succeeded', 'processing'];"
mutate 'R3  the session-id condition removed (finds nothing)' "$JOB" \
  "         AND stripe_session_id <> ''\n" ""
mutate 'R4  min age raised to a week (nothing recovered same-day)' "$JOB" \
  "const DEFAULT_MIN_AGE_MINUTES = 15;" \
  "const DEFAULT_MIN_AGE_MINUTES = 10080;"
mutate 'R4b max age cut below the 7-day authorisation lifetime' "$JOB" \
  "const DEFAULT_MAX_AGE_DAYS = 10;" \
  "const DEFAULT_MAX_AGE_DAYS = 3;"

echo
echo "── it must NEVER settle an unauthorised payment ─────────────────────────"
mutate "R5  a CANCELED intent becomes settleable  *** the dangerous one ***" "$JOB" \
  "const AUTHORISED_PI = \['requires_capture', 'succeeded', 'processing'\];" \
  "const AUTHORISED_PI = ['requires_capture', 'succeeded', 'processing', 'canceled'];"
mutate 'R6  the PaymentIntent status test removed entirely' "$JOB" \
  "  if \(!AUTHORISED_PI\.includes\(piStatus\)\) \{" \
  "  if (false) {"
mutate 'R7  a DECIDED order can be re-settled' "$JOB" \
  "  if \(!SETTLEABLE_FROM\.includes\(paymentStatus\)\) \{" \
  "  if (false) {"
mutate 'R8  auth_only added to the settleable set' "$JOB" \
  "const SETTLEABLE_FROM = \['pending', 'failed'\];" \
  "const SETTLEABLE_FROM = ['pending', 'failed', 'auth_only'];"
mutate 'R9  refunded added to the settleable set' "$JOB" \
  "const SETTLEABLE_FROM = \['pending', 'failed'\];" \
  "const SETTLEABLE_FROM = ['pending', 'failed', 'refunded'];"

echo
echo "── it must drive the webhook handler, not copy it ───────────────────────"
mutate 'R10 it grows its own payment_status UPDATE' "$JOB" \
  "      const \[\[after\]\] = await bvoPool\.query\(" \
  "      await bvoPool.query('UPDATE orders SET payment_status = ? WHERE id = ?', ['auth_only', row.id]);\n      const [[after]] = await bvoPool.query("
mutate 'R11 it stops calling the webhook handler' "$JOB" \
  "await checkout\._handleSessionCompleted\(\{" \
  "await Promise.resolve({"
mutate 'R12 checkoutController stops exporting the handler' "$CHECKOUT" \
  "exports\._handleSessionCompleted = handleSessionCompleted;" \
  "/* removed */"
mutate "R13 the handler it drives stops accepting 'failed'" "$CHECKOUT" \
  "payment_authorized_at = NOW\(\)\n        WHERE id = \? AND payment_status IN \('pending', 'failed'\)" \
  "payment_authorized_at = NOW()\n        WHERE id = ? AND payment_status IN ('pending')"

echo
echo "── the cron wrapper must be able to START node ──────────────────────────"
mutate 'R17 wrapper reverts to a bare `node` call' "$WRAP" \
  'OUT=\$\("\$NODE" src/jobs/reconcileStripeOrders\.js \$ARGS 2>&1\)' \
  'OUT=$(node src/jobs/reconcileStripeOrders.js $ARGS 2>&1)'
# Removing ONE alt-nodejs line is not a defect — 20 and 18 still resolve. The
# real failure is losing the Hostinger search altogether, which is what sends
# a cron run back to a bare PATH lookup and exit 127.
mutate 'R18 the Hostinger alt-nodejs search is removed entirely' "$WRAP" \
  '      /opt/alt/alt-nodejs22/root/bin/node \\\n      /opt/alt/alt-nodejs20/root/bin/node \\\n      /opt/alt/alt-nodejs18/root/bin/node \\\n      /opt/alt/alt-nodejs22/root/usr/bin/node \\\n      /opt/alt/alt-nodejs20/root/usr/bin/node \\\n      /opt/alt/alt-nodejs18/root/usr/bin/node \\\n' ''
mutate 'R19 the wrapper stops shouting on a settlement' "$WRAP" \
  'if echo "\$OUT" \| grep -q "SETTLED"; then' \
  'if false; then'

echo
echo "── three live triggers, not one plus a cron ─────────────────────────────"
# The whole point of the return-path settlement. R20 restores the pre-fix
# architecture: webhook-only, with the reconciler as the sole safety net.
mutate 'R20 the return path stops settling (back to webhook-only)' "$CHECKOUT" \
  '      await handleSessionCompleted\(\{ id: s\.id, metadata: \{ order_id: settleId \} \}\);' \
  '      /* no longer settles here */'
mutate 'R21 settlement is not awaited (success page races the write)' "$CHECKOUT" \
  'await handleSessionCompleted\(\{ id: s\.id, metadata: \{ order_id: settleId \} \}\);' \
  'handleSessionCompleted({ id: s.id, metadata: { order_id: settleId } });'
# THE ONE THAT MAKES THREE TRIGGERS SAFE. If the email ever moves above the
# replay guard, every order settled twice emails the customer twice.
mutate 'R22 the confirmation email moves ABOVE the replay guard' "$CHECKOUT" \
  '    if \(upd\.affectedRows === 0\) return;   // replay — already handled' \
  '    sendConfirmation(null, null, null);\n    if (upd.affectedRows === 0) return;   // replay'

echo
echo "── legitimate edits that must NOT trip the gate ─────────────────────────"
mutate 'R14 a comment is reworded' "$JOB" \
  "the backstop for a webhook that never arrived" \
  "the safety net for a webhook that never arrived" allow
mutate 'R15 the authorised statuses are reordered' "$JOB" \
  "const AUTHORISED_PI = \['requires_capture', 'succeeded', 'processing'\];" \
  "const AUTHORISED_PI = ['succeeded', 'processing', 'requires_capture'];" allow
mutate 'R16 min age tuned within a sane band' "$JOB" \
  "const DEFAULT_MIN_AGE_MINUTES = 15;" \
  "const DEFAULT_MIN_AGE_MINUTES = 20;" allow

echo
restore
echo "caught/allowed correctly: $CAUGHT    missed: $MISSED    bad anchors: $BROKEN"
if [ "$MISSED" -eq 0 ] && [ "$BROKEN" -eq 0 ]; then
  echo "RESULT: every mutation handled as intended."
  exit 0
fi
echo "RESULT: the gate does NOT hold. Fix it before pushing."
exit 1
