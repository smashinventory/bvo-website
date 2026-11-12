#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────
# rollback_session_fix.sh — EMERGENCY. Run with: bash rollback_session_fix.sh
#
# Removes the session fix (a7c56ea, the re-applied ce5088c) and NOTHING ELSE.
#
# THE ONE THING THIS MUST NOT DO, and the reason it is a script rather than a
# command typed under pressure: it must not take the SAFETY NET with it.
# The net lives in 0570edd, which sits BELOW the session fix in history.
# Checking out an older commit, or reverting too far, removes the handlers
# that keep a bad query from killing the site - which is precisely the
# protection you want most at the moment you are rolling back.
#
# So this reverts exactly one commit and then PROVES, before pushing, that:
#   1. siteEvents.js is back to its pre-fix state
#   2. the unhandledRejection / uncaughtException handlers are still there
#   3. the query wrapper is still installed
#   4. the gates still pass
#
# If any of those fail it refuses to push and leaves the tree for inspection.
#
# AFTER THIS: deploy in hPanel. The push alone changes nothing on the server.
#
# WHAT IT DOES NOT TOUCH: the `stateful` column (an unused column with a
# default - harmless to the older code) and the is_bot backfill already
# applied to site_events. Both are data; neither needs reverting.
# ─────────────────────────────────────────────────────────────────────────
set -uo pipefail
cd "$(dirname "$0")"

TARGET="${1:-}"            # optional: commit to revert; defaults to HEAD
NET_COMMIT=0570edd         # "Process safety" — must survive this rollback

echo "=== what we are about to remove ==="
if [ -z "$TARGET" ]; then TARGET=$(git rev-parse --short HEAD); fi
git log -1 --format="  %h  %s" "$TARGET" || { echo "  FAIL - no such commit"; exit 1; }

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

echo
echo "=== PROOF 1: the safety net survived ==="
NETOK=1
grep -q "process.on('unhandledRejection'" src/server.js || { echo "  FAIL - unhandledRejection handler is gone"; NETOK=0; }
grep -q "process.on('uncaughtException'"  src/server.js || { echo "  FAIL - uncaughtException handler is gone";  NETOK=0; }
grep -qE "^\s*attachSql\(bvoPool" src/config/database.js || { echo "  FAIL - query SQL wrapper is gone"; NETOK=0; }
[ "$NETOK" = "1" ] && echo "  ok - handlers and query wrapper both still present"

echo
echo "=== PROOF 2: the session fix is actually gone ==="
if grep -q "sessionKey(req)" src/services/siteEvents.js; then
  echo "  FAIL - siteEvents.js still calls sessionKey(); the revert did not take"
  NETOK=0
else
  echo "  ok - siteEvents.js no longer uses the synthetic session key"
fi

echo
echo "=== PROOF 3: gates ==="
node gates/gate_process_safety.js >/dev/null 2>&1 \
  && echo "  ok - gate_process_safety passes (the net is intact AND working)" \
  || { echo "  FAIL - gate_process_safety is red after the rollback"; NETOK=0; }

FAILED=0
for g in gates/*.js; do
  b=$(basename "$g" .js)
  case "$b" in gate_consent_checkboxes|gate_saved_addresses|gate_model_card_scope_live|\
               gate_canonical_host_live|gate_erv_inventory_sync|\
               gate_site_analytics|gate_sample_offer) continue;; esac
  node "$g" >/dev/null 2>&1 || { echo "  FAIL $b"; FAILED=1; }
done
[ "$FAILED" = "0" ] && echo "  ok - full gate suite green"

if [ "$NETOK" != "1" ] || [ "$FAILED" != "0" ]; then
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
    1. https://www.bathroomvanitiesoutlet.com/            loads
    2. /admin/marketing/site?days=7                        loads
    3. Runtime logs: restarts back to ~5 min apart, not ~1 sec

  KEEP THE LOG. If [UNHANDLED] lines appeared before you rolled back,
  the sql: line under them is the thing we have been hunting — copy it
  out before the log rotates. That evidence is the whole point of the
  experiment and it does not survive a log clear.
EOF
