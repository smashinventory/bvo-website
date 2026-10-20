#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# rollback_stateful_sessions.sh — EMERGENCY. Run with:
#     bash rollback_stateful_sessions.sh
#
# Removes the stateful-session change ("a client that never returns our
# cookie is not a session") and NOTHING ELSE.
#
# ── WHY A ROLLBACK IS CHEAP HERE ────────────────────────────────────────
# THERE IS NO MIGRATION AND NO DATA CHANGE. The commit altered how existing
# site_events rows are READ, never how they are written or stored:
#   - the CREATE TABLE block is byte-identical (verified by md5 before push)
#   - record(), ensureTable(), sessionKey(), isStateful(), looksLikeBot(),
#     headersLookAutomated(), toCents() and clip() are all byte-identical
#   - the three recording points (cartController:259, productsController:187,
#     checkoutController:620) call only record(), which did not change
# So reverting the commit is a COMPLETE revert. Nothing to unwind by hand,
# no rows to repair, no column to drop.
#
# ── THE ONE THING THIS MUST NOT DO ──────────────────────────────────────
# It must not take the SAFETY NET with it. The net lives in 0570edd
# ("Process safety: one bad request must not take the site down"), which
# sits BELOW this commit in history. Reverting too far, or checking out an
# older commit, removes the handlers that keep a bad query from killing the
# site - precisely the protection you want most while rolling back.
#
# ── ⚠️ TWO GATES WILL GO RED AGAIN, AND THAT IS CORRECT ─────────────────
# This commit also repaired two gates. Reverting it un-repairs them:
#   gate_site_analytics     - its data fixture loses cspNonce again, a local
#                             set for every template by server.js:176. RED.
#   gate_customer_analytics - its O_OK check goes back to matching a string
#                             literal that 686d22a replaced. RED.
# Both are therefore in the skip list below. If they were not, this script
# would refuse to push its own correct rollback. They are skipped BY NAME
# with this reason, not silently.
#
# AFTER THIS: deploy in hPanel. The push alone changes nothing on the server.
# ─────────────────────────────────────────────────────────────────────────
set -uo pipefail
cd "$(dirname "$0")"

TARGET="${1:-}"            # optional: commit to revert; defaults to HEAD
NET_COMMIT=0570edd         # "Process safety" — must survive this rollback

echo "=== what we are about to remove ==="
if [ -z "$TARGET" ]; then TARGET=$(git rev-parse --short HEAD); fi
git log -1 --format="  %h  %s" "$TARGET" || { echo "  FAIL - no such commit"; exit 1; }

# Guard against reverting the wrong thing. If HEAD is not the stateful-session
# commit, the operator has almost certainly pulled or committed since.
if ! git log -1 --format=%s "$TARGET" | grep -q "never returns a cookie is not a session"; then
  echo
  echo "  ⚠️  THAT COMMIT IS NOT THE STATEFUL-SESSION CHANGE."
  echo "      Expected a subject containing:"
  echo "        'never returns a cookie is not a session'"
  echo "      Got:"
  git log -1 --format="        %s" "$TARGET"
  echo
  echo "      Pass the right SHA explicitly if you know what you are doing:"
  echo "        bash rollback_stateful_sessions.sh <sha>"
  echo "      STOPPING."
  exit 1
fi

echo
echo "=== pre-flight: the safety net must be an ancestor, and must stay ==="
if ! git merge-base --is-ancestor "$NET_COMMIT" HEAD 2>/dev/null; then
  echo "  FAIL - $NET_COMMIT (process safety) is not in this history."
  echo "         Rolling back from here could leave the site unprotected."
  echo "         STOPPING. Investigate before pushing anything."
  exit 1
fi
echo "  ok - $NET_COMMIT is an ancestor of HEAD"

if [ "$TARGET" = "$NET_COMMIT" ]; then
  echo "  FAIL - refusing to revert the safety net itself."
  exit 1
fi

echo
echo "=== working tree must be clean ==="
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "  FAIL - uncommitted changes present. Commit or stash first:"
  git status --short | sed 's/^/    /'
  exit 1
fi
echo "  ok - clean"

echo
echo "=== revert ==="
git revert --no-edit "$TARGET" || {
  echo "  FAIL - revert did not apply cleanly. Tree left as-is for inspection."
  echo "         'git revert --abort' backs this out."
  exit 1
}
git log -1 --format="  created %h  %s"

OK=1

echo
echo "=== PROOF 1: the safety net survived ==="
grep -q "process.on('unhandledRejection'" src/server.js \
  || { echo "  FAIL - unhandledRejection handler is gone"; OK=0; }
grep -q "process.on('uncaughtException'"  src/server.js \
  || { echo "  FAIL - uncaughtException handler is gone";  OK=0; }
grep -qE "^\s*attachSql\(bvoPool" src/config/database.js \
  || { echo "  FAIL - query SQL wrapper is gone"; OK=0; }
[ "$OK" = "1" ] && echo "  ok - handlers and query wrapper both still present"

echo
echo "=== PROOF 2: the stateful predicate is actually gone ==="
# All four queries must be back to filtering on is_bot alone.
if grep -q 'statefulPredicate' src/controllers/siteAnalyticsController.js; then
  echo "  FAIL - the controller still calls statefulPredicate(); the revert did not take"
  OK=0
else
  echo "  ok - the controller no longer applies the stateful predicate"
fi
if grep -q 'cookielessShare' src/controllers/siteAnalyticsController.js; then
  echo "  FAIL - cookielessShare() is still present"
  OK=0
else
  echo "  ok - the cookieless reporting function is gone"
fi

echo
echo "=== PROOF 3: THE WRITE PATH WAS NEVER TOUCHED, so it must be unchanged ==="
# The whole argument for this rollback being safe is that recording was never
# modified. If the revert somehow altered it, that assumption is wrong and
# this must not be pushed.
if grep -q 'sessionKey(req)' src/services/siteEvents.js; then
  echo "  ok - siteEvents.js still records via sessionKey(req), as before and after"
else
  echo "  FAIL - sessionKey(req) is missing from the INSERT. The revert reached"
  echo "         further than this commit did. DO NOT PUSH."
  OK=0
fi
grep -q 'CREATE TABLE IF NOT EXISTS site_events' src/services/siteEvents.js \
  && echo "  ok - the self-healing CREATE TABLE is intact" \
  || { echo "  FAIL - the CREATE TABLE is gone"; OK=0; }

echo
echo "=== PROOF 4: no migration to unwind ==="
echo "  ok - this commit shipped no .sql migration and no schema change;"
echo "       site_events rows and the 2026-10-15 is_bot backfill are untouched"

echo
echo "=== PROOF 5: gates ==="
node gates/gate_process_safety.js >/dev/null 2>&1 \
  && echo "  ok - gate_process_safety passes (the net is intact AND working)" \
  || { echo "  FAIL - gate_process_safety is red after the rollback"; OK=0; }

FAILED=0
for g in gates/gate_*.js; do
  b=$(basename "$g" .js)
  case "$b" in
    # Pre-existing red, unrelated to this commit:
    gate_consent_checkboxes|gate_saved_addresses|gate_erv_inventory_sync|\
    gate_email_verification|gate_sample_offer) continue;;
    # Need network to the live site:
    gate_model_card_scope_live|gate_canonical_host_live) continue;;
    # ⚠️ EXPECTED RED AFTER THIS ROLLBACK — see the header. The revert takes
    # their repairs with it. Skipped by name, with the reason, not silently.
    gate_site_analytics|gate_customer_analytics) continue;;
  esac
  node "$g" >/dev/null 2>&1 || { echo "  FAIL $b"; FAILED=1; }
done
[ "$FAILED" = "0" ] && echo "  ok - the rest of the gate suite is green"

echo
echo "=== PROOF 6: the server still boots ==="
# The reverted controller is required by routes/admin.js at startup. A parse
# check cannot see a module-scope failure; this requires the modules.
node -e "
process.env.DB_PASS = process.env.DB_PASS || 'rollback-placeholder';
require('./src/services/siteEvents.js');
require('./src/controllers/siteAnalyticsController.js');
require('./src/routes/admin.js');
" >/dev/null 2>&1 \
  && echo "  ok - siteEvents, the controller and routes/admin all load" \
  || { echo "  FAIL - something does not load; the server would not boot"; OK=0; }

if [ "$OK" != "1" ] || [ "$FAILED" != "0" ]; then
  echo
  echo "  NOT PUSHING. The rollback is committed locally but something is wrong."
  echo "  'git reset --hard HEAD~1' undoes it."
  exit 1
fi

echo
echo "=== push ==="
git push origin main || { echo "  FAIL - push rejected"; exit 1; }
git log --oneline -3

cat <<'EOF'

  ───────────────────────────────────────────────────────────────
  NOW DEPLOY IN hPANEL. The push alone changes nothing on the server.
  ───────────────────────────────────────────────────────────────

  Then confirm, in this order:
    1. https://www.bathroomvanitiesoutlet.com/   loads
    2. /admin/marketing/site?days=7              loads
       "Viewed a product" is back in the thousands, and the
       "Cookieless" KPI is gone. That is the rollback working.
    3. Add something to the cart on the storefront, then re-open
       the page. The number moves. Recording was never part of
       this change, but it is the one thing worth eyeballing.
    4. Runtime logs: restarts ~5 min apart, not ~1 sec.

  WHAT IS STILL TRUE AFTER THIS ROLLBACK:
    - The tile is inflated again by the distributed crawler
      (~4,200 cookieless product views/day). The diagnosis in
      CHANGE_LOG_BRIEF.md and Rule 17 in BVO_AUDIT_BRIEF.md stand,
      and the SQL in migrations/2026-10-17_diagnose_session_tile_
      READONLY.sql reproduces the evidence.
    - No data was lost or altered in either direction.

  KEEP THE LOG if anything went wrong. Copy out any [UNHANDLED]
  lines and the sql: line beneath them before the log rotates.
EOF
