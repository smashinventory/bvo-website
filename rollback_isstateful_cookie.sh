#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# rollback_isstateful_cookie.sh — EMERGENCY. Run with:
#     bash rollback_isstateful_cookie.sh
#
# Removes the isStateful cookie fix and NOTHING ELSE.
#
# ── ⚠️ READ THIS BEFORE ROLLING BACK ────────────────────────────────────
# Rolling this back DOES NOT RESTORE WORKING BEHAVIOUR. It restores
#
#     return sess.isNew === false;
#
# and express-session defines no isNew, so the previous state is "every
# client on the site is recorded cookieless, real humans included" and the
# funnel trends to zero as the 10-16 residue ages out. There is no good
# state behind this commit - only a differently broken one.
#
# Roll back only if this change caused something WORSE: the tile inflating
# again (forged cookies being accepted), or an error in the request path.
# If the tile merely looks surprising, read it for an hour first.
#
# ── WHAT IS AND IS NOT REVERSIBLE ───────────────────────────────────────
# ⚠️ THIS COMMIT CHANGED THE WRITE PATH. Rows written while it was live
# carry real session ids for cookie-returning clients. Reverting does NOT
# rewrite them, and it should not: they are the only correct rows in the
# table. The revert changes what gets written from the moment it deploys,
# so the window will contain a mix. That is expected and is data, not
# damage. There is no migration either way.
#
# THE SAFETY NET must survive this: 0570edd, below this commit in history.
# ─────────────────────────────────────────────────────────────────────────
set -uo pipefail
cd "$(dirname "$0")"

TARGET="${1:-}"
NET_COMMIT=0570edd

echo "=== what we are about to remove ==="
if [ -z "$TARGET" ]; then TARGET=$(git rev-parse --short HEAD); fi
git log -1 --format="  %h  %s" "$TARGET" || { echo "  FAIL - no such commit"; exit 1; }

if ! git log -1 --format=%s "$TARGET" | grep -q "express-session has no isNew"; then
  echo
  echo "  ⚠️  THAT COMMIT IS NOT THE isStateful FIX."
  echo "      Expected a subject containing: 'express-session has no isNew'"
  git log -1 --format="      Got: %s" "$TARGET"
  echo "      Pass the right SHA explicitly if you are sure:"
  echo "        bash rollback_isstateful_cookie.sh <sha>"
  echo "      STOPPING."
  exit 1
fi

echo
echo "=== pre-flight: the safety net must stay ==="
git merge-base --is-ancestor "$NET_COMMIT" HEAD 2>/dev/null \
  || { echo "  FAIL - $NET_COMMIT (process safety) is not in this history. STOPPING."; exit 1; }
echo "  ok - $NET_COMMIT is an ancestor of HEAD"
[ "$TARGET" = "$NET_COMMIT" ] && { echo "  FAIL - refusing to revert the safety net."; exit 1; }

echo
echo "=== working tree must be clean ==="
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "  FAIL - uncommitted changes present:"; git status --short | sed 's/^/    /'; exit 1
fi
echo "  ok - clean"

echo
echo "=== revert ==="
git revert --no-edit "$TARGET" || {
  echo "  FAIL - revert did not apply cleanly. 'git revert --abort' backs it out."; exit 1; }
git log -1 --format="  created %h  %s"

OK=1

echo
echo "=== PROOF 1: the safety net survived ==="
grep -q "process.on('unhandledRejection'" src/server.js || { echo "  FAIL - unhandledRejection gone"; OK=0; }
grep -q "process.on('uncaughtException'"  src/server.js || { echo "  FAIL - uncaughtException gone";  OK=0; }
grep -qE "^\s*attachSql\(bvoPool" src/config/database.js || { echo "  FAIL - query wrapper gone"; OK=0; }
[ "$OK" = "1" ] && echo "  ok - handlers and query wrapper present"

echo
echo "=== PROOF 2: the cookie test is gone, and the old one is back ==="
if grep -q "fromCookie === String(sid)" src/services/siteEvents.js; then
  echo "  FAIL - the cookie comparison is still present; the revert did not take"; OK=0
else
  echo "  ok - the cookie comparison is gone"
fi
if grep -q "sess.isNew === false" src/services/siteEvents.js; then
  echo "  ok - the previous (broken) isNew test is restored, as expected"
  echo "       ⚠️ REMINDER: this means NOTHING can be stateful. The funnel will"
  echo "          trend to zero. That is the state you asked to return to."
else
  echo "  FAIL - neither implementation is present. DO NOT PUSH."; OK=0
fi

echo
echo "=== PROOF 3: the write path is otherwise intact ==="
grep -q "sessionKey(req)" src/services/siteEvents.js \
  && echo "  ok - record() still keys rows through sessionKey(req)" \
  || { echo "  FAIL - sessionKey(req) missing from the INSERT. DO NOT PUSH."; OK=0; }
grep -q "CREATE TABLE IF NOT EXISTS site_events" src/services/siteEvents.js \
  && echo "  ok - the self-healing CREATE TABLE is intact" \
  || { echo "  FAIL - CREATE TABLE gone"; OK=0; }

echo
echo "=== PROOF 4: no migration to unwind ==="
echo "  ok - no schema change either direction; rows already written are kept"

echo
echo "=== PROOF 5: gates ==="
node gates/gate_process_safety.js >/dev/null 2>&1 \
  && echo "  ok - gate_process_safety passes" \
  || { echo "  FAIL - gate_process_safety red"; OK=0; }

FAILED=0
for g in gates/gate_*.js; do
  b=$(basename "$g" .js)
  case "$b" in
    # Pre-existing red, unrelated:
    gate_consent_checkboxes|gate_saved_addresses|gate_erv_inventory_sync|\
    gate_email_verification|gate_sample_offer) continue;;
    # Need network to the live site:
    gate_model_card_scope_live|gate_canonical_host_live) continue;;
    # ⚠️ EXPECTED RED AFTER THIS ROLLBACK. The revert takes the rewritten
    # fixtures with it, restoring a gate that asserts isStateful reads a
    # property express-session never sets. Skipped by name, with the reason.
    gate_session_identity) continue;;
  esac
  node "$g" >/dev/null 2>&1 || { echo "  FAIL $b"; FAILED=1; }
done
[ "$FAILED" = "0" ] && echo "  ok - the rest of the suite is green"

echo
echo "=== PROOF 6: the server still boots ==="
node -e "
process.env.DB_PASS = process.env.DB_PASS || 'rollback-placeholder';
require('./src/services/siteEvents.js');
require('./src/controllers/siteAnalyticsController.js');
require('./src/routes/admin.js');
" >/dev/null 2>&1 \
  && echo "  ok - siteEvents, the controller and routes/admin all load" \
  || { echo "  FAIL - something does not load; the server would not boot"; OK=0; }

if [ "$OK" != "1" ] || [ "$FAILED" != "0" ]; then
  echo; echo "  NOT PUSHING. Committed locally but something is wrong."
  echo "  'git reset --hard HEAD~1' undoes it."; exit 1
fi

echo
echo "=== push ==="
git push origin main || { echo "  FAIL - push rejected"; exit 1; }
git log --oneline -3

cat <<'EOF'

  ───────────────────────────────────────────────────────────────
  NOW DEPLOY IN hPANEL. The push alone changes nothing on the server.
  If Deployments does not list the new commit, the webhook did not fire -
  Redeploy re-deploys the PINNED commit and will change nothing.
  ───────────────────────────────────────────────────────────────

  Confirm, in this order:
    1. https://www.bathroomvanitiesoutlet.com/   loads
    2. /admin/marketing/site?days=7              loads
    3. Add something to the cart on the storefront, then reload the page.
       The cart add must still appear. Recording is the thing this commit
       touched, so it is the one thing worth eyeballing by hand.

  ⚠️ AND REMEMBER WHAT YOU HAVE ROLLED BACK TO: isStateful can no longer
  return true for anyone. "Cookieless" will climb toward 100% and the
  funnel toward zero. The underlying defect is NOT fixed by this rollback -
  it is restored. See Rule 18 in BVO_AUDIT_BRIEF.md.
EOF
