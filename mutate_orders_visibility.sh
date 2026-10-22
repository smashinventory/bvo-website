#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# mutate_orders_visibility.sh — negative tests for gates/gate_orders_visibility.js
#
#   bash mutate_orders_visibility.sh
#
# V1 restores the 2026-10-22 defect verbatim: the default order list silently
# excluding draft and pending. That is what hid two PAID orders holding live
# Stripe authorisations. If V1 ever stops turning the gate red, delete the gate.
#
# ANCHOR RULES: every anchor matches EXACTLY ONCE (Rule 17a), and never on
# prose — both files now DOCUMENT the old predicate at length, so the literal
# NOT IN ('draft','pending') appears inside comments as well as in code.
# ─────────────────────────────────────────────────────────────────────────────
set -u
cd "$(dirname "$0")" || exit 1

GATE="gates/gate_orders_visibility.js"
CTRL="src/controllers/ordersController.js"
CFG="src/config/orderStatuses.js"
VIEW="views/pages/admin/orders/index.ejs"

ALL=("$CTRL" "$CFG" "$VIEW")

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

# ⚠️ THE 6th ARGUMENT IS THE EXPECTED MATCH COUNT, DEFAULT 1.
# Rule 17a says an anchor matching more than once indicts the mutation, not
# the gate — because you do not know what you just edited. It does NOT say
# every anchor must be unique: some values are legitimately set at two render
# sites, and mutating one of two is a WEAKER test, not a stronger one (the
# gate stays green on the surviving copy and reports MISSED for the wrong
# reason). Declaring the count keeps the rule's intent — you must KNOW how
# many — while letting a deliberate both-sites mutation say so out loud.
# Found by V7: isAbandonedStatus is passed at both render sites.
mutate() {
  local label="$1" file="$2" find="$3" repl="$4" expect="${5:-catch}" want="${6:-1}"
  restore
  local n
  n=$(FIND="$find" python3 -c "
import os,re,sys
print(len(re.findall(os.environ['FIND'], open(sys.argv[1],encoding='utf-8').read())))
" "$file")
  if [ "$n" != "$want" ]; then
    printf 'ANCHOR  %-58s matched %s times (need %s)\n' "$label" "$n" "$want"; BROKEN=$((BROKEN+1)); return
  fi
  FIND="$find" REPL="$repl" WANT="$want" python3 -c "
import os,re,sys
s=open(sys.argv[1],encoding='utf-8').read()
s=re.sub(os.environ['FIND'], lambda m: os.environ['REPL'], s, count=int(os.environ['WANT']))
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

echo "── the default list must never hide a row ───────────────────────────────"
mutate "V1  THE 2026-10-22 DEFECT RESTORED (default hides draft+pending)" "$CTRL" \
  '    if \(status === ACTIVE_ONLY\) \{' \
  "    if (!status) { where += \" AND o.status NOT IN ('draft','pending')\"; }\n    else if (status === ACTIVE_ONLY) {"
mutate 'V2  ACTIVE_ONLY collapses back to the empty string' "$CFG" \
  "const ACTIVE_ONLY = 'active';" \
  "const ACTIVE_ONLY = '';"
mutate "V3  'pending' dropped from the abandoned set" "$CFG" \
  "const ABANDONED_STATUSES = \['draft', 'pending'\];" \
  "const ABANDONED_STATUSES = ['draft'];"

echo
echo "── abandoned rows must be MARKED, not merely present ────────────────────"
mutate 'V4  the badge is removed from the list' "$VIEW" \
  '            <% if \(isAbandonedStatus\(o\.status\)\) \{ %>' \
  '            <% if (false) { %>'
mutate 'V5  the reached-Stripe distinction is dropped' "$VIEW" \
  '              <% if \(o\.stripe_session_id\) \{ %>' \
  '              <% if (false) { %>'

echo
echo "── every column the template reads must be SELECTed ─────────────────────"
mutate 'V6  stripe_session_id dropped from the list query' "$CTRL" \
  '              o\.stripe_session_id,\n' ''
# Passed at BOTH render sites; removing one leaves the other and proves
# nothing. Count declared so the mutation removes both deliberately.
mutate 'V7  isAbandonedStatus not passed to the template (both sites)' "$CTRL" \
  '      isAbandonedStatus,   // marks draft/pending rows in the list\n' '' catch 2

echo
echo "── the RAG strip must keep meaning ──────────────────────────────────────"
mutate 'V8  abandoned rows counted as work again' "$CTRL" \
  'orders\.forEach\(o => \{ if \(!isAbandonedStatus\(o\.status\)\) ragCounts\[o\.rag\]\+\+; \}\);' \
  'orders.forEach(o => ragCounts[o.rag]++);'

echo
echo "── legitimate edits that must NOT trip the gate ─────────────────────────"
mutate 'V9  the abandoned list is reordered' "$CFG" \
  "const ABANDONED_STATUSES = \['draft', 'pending'\];" \
  "const ABANDONED_STATUSES = ['pending', 'draft'];" allow
mutate 'V10 ACTIVE_ONLY is renamed to another non-empty value' "$CFG" \
  "const ACTIVE_ONLY = 'active';" \
  "const ACTIVE_ONLY = 'open';" allow
mutate 'V11 a comment quoting the old predicate is reworded' "$CTRL" \
  'Sound reasoning, and it hid two PAID orders for days\.' \
  'Sound reasoning, and it concealed two PAID orders for days.' allow

echo
restore
echo "caught/allowed correctly: $CAUGHT    missed: $MISSED    bad anchors: $BROKEN"
if [ "$MISSED" -eq 0 ] && [ "$BROKEN" -eq 0 ]; then
  echo "RESULT: every mutation handled as intended."
  exit 0
fi
echo "RESULT: the gate does NOT hold. Fix it before pushing."
exit 1
