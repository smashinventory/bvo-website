#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# rollback_stock_watch.sh — EMERGENCY. Run with:
#     bash rollback_stock_watch.sh
#
# Removes BOTH commits from the 2026-10-20 stock-watch push, newest first:
#     "Orders dashboard: stock watch"
#     "Two red gates cleared, and they were red for different reasons"
# and NOTHING ELSE.
#
# ── WHY THIS ROLLBACK IS CHEAP ──────────────────────────────────────────
# NO MIGRATION, NO SCHEMA CHANGE, NO DATA WRITTEN. Everything added is
# read-only: one aggregate SELECT on the orders list, a strip and a flag in
# the view, and a config module. Reverting restores the previous behaviour
# completely. Nothing to unwind by hand.
#
# ── WHAT YOU LOSE, STATED PLAINLY ───────────────────────────────────────
# The second commit's revert also removes the two GATE REPAIRS and the
# one-line checkout-info.ejs guard. Those were fixes to tests, not to the
# site, with one exception: `old.email` goes back to being unguarded. That
# is not reachable from the live path (takeCheckoutFlash always returns {}),
# so the storefront is unaffected either way — but it is the one line of
# product code that reverts with them.
#
# After this, gate_email_verification and gate_consent_checkboxes go RED
# again. That is expected; they are skipped by name below so this script
# does not refuse its own correct rollback.
#
# ── PARTIAL ROLLBACK ────────────────────────────────────────────────────
# To drop ONLY the feature and keep the gate repairs:
#     git revert --no-edit <sha-of-stock-watch>
# and deploy that. This script does both because they shipped together and
# "roll it all back" is what you want at 2am.
#
# THE SAFETY NET must survive: 0570edd, below both commits in history.
# ─────────────────────────────────────────────────────────────────────────
set -uo pipefail
cd "$(dirname "$0")"

NET_COMMIT=0570edd
FEATURE_SUBJECT="Orders dashboard: stock watch"
GATES_SUBJECT="Two red gates cleared"

echo "=== what we are about to remove ==="
git log -2 --format="  %h  %s" | cat

if ! git log -1 --format=%s HEAD | grep -q "$FEATURE_SUBJECT"; then
  echo
  echo "  ⚠️  HEAD IS NOT THE STOCK-WATCH COMMIT."
  git log -1 --format="      HEAD is: %s"
  echo "      Someone has committed or pulled since. Work out what you actually"
  echo "      want to revert and do it by SHA. STOPPING."
  exit 1
fi
if ! git log -1 --format=%s HEAD~1 | grep -q "$GATES_SUBJECT"; then
  echo
  echo "  ⚠️  HEAD~1 IS NOT THE GATE-REPAIR COMMIT."
  git log -1 --format="      HEAD~1 is: %s" HEAD~1
  echo "      STOPPING — revert by SHA instead."
  exit 1
fi
echo "  ok - both expected commits are at the tip, newest first"

echo
echo "=== pre-flight ==="
git merge-base --is-ancestor "$NET_COMMIT" HEAD 2>/dev/null \
  || { echo "  FAIL - $NET_COMMIT (process safety) is not in this history. STOPPING."; exit 1; }
echo "  ok - the safety net is an ancestor"

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "  FAIL - uncommitted changes present:"; git status --short | sed 's/^/    /'; exit 1
fi
echo "  ok - working tree clean"

echo
echo "=== revert, newest first ==="
git revert --no-edit HEAD   || { echo "  FAIL - could not revert the feature. 'git revert --abort' backs out."; exit 1; }
git revert --no-edit HEAD~1 || { echo "  FAIL - could not revert the gate commit. 'git revert --abort' backs out."; exit 1; }
git log -2 --format="  created %h  %s" | cat

OK=1

echo
echo "=== PROOF 1: the safety net survived ==="
grep -q "process.on('unhandledRejection'" src/server.js || { echo "  FAIL - unhandledRejection gone"; OK=0; }
grep -q "process.on('uncaughtException'"  src/server.js || { echo "  FAIL - uncaughtException gone";  OK=0; }
grep -qE "^\s*attachSql\(bvoPool" src/config/database.js || { echo "  FAIL - query wrapper gone"; OK=0; }
[ "$OK" = "1" ] && echo "  ok - handlers and query wrapper present"

echo
echo "=== PROOF 2: the feature is gone ==="
[ -f src/config/inventoryRisk.js ] \
  && { echo "  FAIL - src/config/inventoryRisk.js still exists"; OK=0; } \
  || echo "  ok - inventoryRisk.js removed"
grep -q "inventoryRisk" src/controllers/ordersController.js \
  && { echo "  FAIL - the controller still references inventoryRisk"; OK=0; } \
  || echo "  ok - the controller no longer queries stock risk"
grep -q "Stock watch" views/pages/admin/orders/index.ejs \
  && { echo "  FAIL - the strip is still in the view"; OK=0; } \
  || echo "  ok - the strip is gone from the orders view"

echo
echo "=== PROOF 3: revenue.js is back to two predicates ==="
if grep -q "IS_REAL" src/config/revenue.js; then
  echo "  FAIL - IS_REAL is still present; the revert did not take"; OK=0
else
  echo "  ok - IS_REAL removed"
fi
node -e "
process.env.DB_PASS=process.env.DB_PASS||'rollback-placeholder';
const r=require('./src/config/revenue').predicates('o');
if(!/payment_captured_at IS NOT NULL/.test(r.IS_COUNTED)) process.exit(1);
if(!/is_test = 0/.test(r.IS_COUNTED)) process.exit(1);
" >/dev/null 2>&1 \
  && echo "  ok - IS_COUNTED still gates on capture and excludes test rows" \
  || { echo "  FAIL - the revenue definition is damaged. DO NOT PUSH."; OK=0; }

echo
echo "=== PROOF 4: the orders list still works ==="
node -e "
process.env.DB_PASS=process.env.DB_PASS||'rollback-placeholder';
const c=require('./src/controllers/ordersController.js');
if(typeof c.list!=='function') process.exit(1);
require('./src/routes/admin.js');
" >/dev/null 2>&1 \
  && echo "  ok - ordersController.list and routes/admin load" \
  || { echo "  FAIL - the orders controller does not load. DO NOT PUSH."; OK=0; }

node -e "
const ejs=require('ejs'),fs=require('fs');
for (const f of ['views/pages/admin/orders/index.ejs','views/pages/checkout-info.ejs']) {
  ejs.compile(fs.readFileSync(f,'utf8'),{filename:f});
}" >/dev/null 2>&1 \
  && echo "  ok - the orders list and checkout page 1 both still compile" \
  || { echo "  FAIL - a template no longer compiles. DO NOT PUSH."; OK=0; }

echo
echo "=== PROOF 5: no migration to unwind ==="
echo "  ok - nothing was ever written; inventory and orders are untouched"

echo
echo "=== PROOF 6: gates ==="
node gates/gate_process_safety.js >/dev/null 2>&1 \
  && echo "  ok - gate_process_safety passes" \
  || { echo "  FAIL - gate_process_safety red"; OK=0; }

FAILED=0
for g in gates/gate_*.js; do
  b=$(basename "$g" .js)
  case "$b" in
    # Pre-existing red, unrelated:
    gate_saved_addresses|gate_erv_inventory_sync|gate_sample_offer) continue;;
    # Need network to the live site:
    gate_model_card_scope_live|gate_canonical_host_live) continue;;
    # ⚠️ EXPECTED RED AFTER THIS ROLLBACK — the revert takes their repairs
    # with it. Skipped by name, with the reason, not silently.
    gate_email_verification|gate_consent_checkboxes) continue;;
    # Removed by the revert; the file will not exist.
    gate_inventory_risk) continue;;
  esac
  node "$g" >/dev/null 2>&1 || { echo "  FAIL $b"; FAILED=1; }
done
[ "$FAILED" = "0" ] && echo "  ok - the rest of the suite is green"

if [ "$OK" != "1" ] || [ "$FAILED" != "0" ]; then
  echo; echo "  NOT PUSHING. Reverts are committed locally but something is wrong."
  echo "  'git reset --hard HEAD~2' undoes both."; exit 1
fi

echo
echo "=== push ==="
git push origin main || { echo "  FAIL - push rejected"; exit 1; }
git log --oneline -4 | cat

cat <<'EOF'

  ───────────────────────────────────────────────────────────────
  NOW DEPLOY IN hPANEL. The push alone changes nothing on the server.
  If Deployments does not list the new commit the webhook did not fire —
  Redeploy re-deploys the PINNED commit and will change nothing.
  ───────────────────────────────────────────────────────────────

  Confirm, in this order:
    1. https://www.bathroomvanitiesoutlet.com/   loads
    2. /admin/orders                             loads, no Stock watch strip
    3. /checkout  with something in the cart     page 1 renders, email field
                                                 present and editable
    4. Runtime logs: restarts ~5 min apart, not ~1 sec

  WHAT IS STILL TRUE AFTER THIS ROLLBACK:
    - No data was written or lost in either direction.
    - gate_email_verification and gate_consent_checkboxes are red again,
      for the reasons in Rule 19 — the diagnosis in CHANGE_LOG_BRIEF.md
      stands and can be re-applied from it.
EOF
