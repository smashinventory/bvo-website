#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# reconcile_stripe.sh — the backstop for a Stripe webhook that never arrived
# ───────────────────────────────────────────────────────────────────────
# Finds orders that reached Stripe but never became orders here, asks Stripe
# what really happened, and settles ONLY the ones Stripe says are authorised.
# It cannot capture, cannot cancel, and cannot move money. See
# docs/CHECKOUT_PAYMENT_LIFECYCLE.md §4.
#
# CRON (hPanel → Cron Jobs, UTC) — every 15 minutes:
#   */15 * * * *  /bin/bash /home/u222311468/domains/slategrey-falcon-350174.hostingersite.com/reconcile_stripe.sh
#
# ── SETUP ──────────────────────────────────────────────────────────────
#   1. Copy this file to the server root (the cron path above). It must live
#      OUTSIDE hbuilds/ so a deploy cannot overwrite it.
#   2. chmod +x reconcile_stripe.sh
#   3. Dry run first:   bash reconcile_stripe.sh --dry-run
#      Reports what WOULD be settled and writes nothing.
#   4. Add the cron line in hPanel → Cron Jobs.
#
# NO CREDENTIALS IN THIS FILE. The job loads the app's own .env, exactly as
# shipment_status_poll.sh does, so the server copy and the repo copy are byte
# identical and a file drop needs no follow-up edit.
#
# ⚠️ THE BARE `node` CALL IS THE TRAP THIS SCRIPT EXISTS TO AVOID REPEATING.
# The first version of this file ran `node src/jobs/...` with a plain
# `cd "$(dirname "$0")"`. Cron's PATH does not include node, so it would have
# exited 127 — "command not found" — on every single run, writing a line to a
# log nobody reads. A backstop that silently never runs is worse than none,
# because it is believed in. shipment_status_poll.sh had already solved this
# and documented it; this now matches it exactly.
#
# LOG: jmv_sync/logs/reconcile-stripe.log  (rotates at 5 MB)
# ═══════════════════════════════════════════════════════════════════════

set -uo pipefail

# ⚠️ SELF-LOCATING, NOT HARDCODED, AND THAT IS DELIBERATE.
# shipment_status_poll.sh and jmv_rollup.sh both hardcode
#   BASE=/home/u222311468/domains/slategrey-falcon-350174.hostingersite.com
# while the live cron entries invoke them from
#   /home/u222311468/domains/bathroomvanitiesoutlet.com/
# Those are two different directory names for this account and the repo copy
# cannot know which one the server copy will be dropped into. jmv_rollup's own
# header calls out the cost of a script that needs editing after a file drop:
# "forget once and the rollup fails at DB connect, which is a log line you
# only see if you go looking."
#
# So BASE is wherever THIS FILE actually is. The repo copy and the server copy
# are byte identical, the file drop needs no follow-up edit, and moving the
# account to another domain name breaks nothing.
BASE="$(cd "$(dirname "$0")" && pwd)"
APP=$BASE/hbuilds/current/nodejs

# Fallback: if there is no hbuilds/current/nodejs beneath this script, the app
# may BE this directory (a plain deploy rather than the managed-app layout).
if [ ! -d "$APP" ] && [ -f "$BASE/src/jobs/reconcileStripeOrders.js" ]; then
  APP=$BASE
fi

# ── Logging ─────────────────────────────────────────────────────────
LOG_DIR=$BASE/jmv_sync/logs
[ -d "$BASE/jmv_sync" ] || LOG_DIR=$BASE/storage/logs
mkdir -p "$LOG_DIR"
LOG=$LOG_DIR/reconcile-stripe.log

if [ -f "$LOG" ] && [ "$(stat -c%s "$LOG" 2>/dev/null || echo 0)" -gt 5242880 ]; then
  mv "$LOG" "${LOG}.1"
fi

stamp() { date -u '+%Y-%m-%dT%H:%M:%SZ'; }

# Pass through --dry-run so the cron entry can be tested by hand.
ARGS="${1:-}"

echo "$(stamp) ── stripe reconcile started ${ARGS} ───────────────────────" >> "$LOG"

if [ ! -d "$APP" ]; then
  echo "$(stamp) ERROR: app directory not found at $APP" >> "$LOG"
  exit 1
fi

# ── Locate node ─────────────────────────────────────────────────────
# Cron runs with a minimal PATH that does NOT include node, so a bare
# `node` call fails with exit 127. The Hostinger path is
# /opt/alt/alt-nodejsNN/root/bin/node — root/bin, NOT root/usr/bin.
find_node() {
  if command -v node >/dev/null 2>&1; then command -v node; return; fi
  for c in \
      /opt/alt/alt-nodejs22/root/bin/node \
      /opt/alt/alt-nodejs20/root/bin/node \
      /opt/alt/alt-nodejs18/root/bin/node \
      /opt/alt/alt-nodejs22/root/usr/bin/node \
      /opt/alt/alt-nodejs20/root/usr/bin/node \
      /opt/alt/alt-nodejs18/root/usr/bin/node \
      /usr/local/bin/node \
      /usr/bin/node ; do
    [ -x "$c" ] && { echo "$c"; return; }
  done
  for c in "$HOME"/.nvm/versions/node/v*/bin/node; do
    [ -x "$c" ] && NODE_FOUND="$c"
  done
  [ -n "${NODE_FOUND:-}" ] && echo "$NODE_FOUND"
}

NODE="$(find_node || true)"

if [ -z "$NODE" ]; then
  {
    echo "$(stamp) ERROR: node not found. Cron's PATH is: ${PATH}"
    echo "$(stamp)   Searched: /opt/alt/alt-nodejs{22,20,18}, /usr/local/bin, /usr/bin, \$HOME/.nvm"
    echo "$(stamp)   Find it with a one-off cron:  * * * * * which node > $LOG_DIR/node-path.txt 2>&1"
    echo "$(stamp)   Then hardcode that path as NODE= near the top of this script."
  } >> "$LOG"
  exit 127
fi

echo "$(stamp) using node: $NODE ($("$NODE" -v 2>/dev/null || echo 'version unknown'))" >> "$LOG"

cd "$APP" || { echo "$(stamp) ERROR: cannot cd to $APP" >> "$LOG"; exit 1; }

OUT=$("$NODE" src/jobs/reconcileStripeOrders.js $ARGS 2>&1)
EXIT=$?
echo "$OUT" >> "$LOG"

# ⚠️ A SETTLEMENT MEANS THE WEBHOOK FAILED. Shouted in the log rather than
# passed over, because the whole point is that this failure used to be
# invisible. If this line appears, go and look at
# Stripe -> Developers -> Webhooks -> Event deliveries.
if echo "$OUT" | grep -q "SETTLED"; then
  echo "$(stamp) *** ATTENTION: the reconciler settled an order. The WEBHOOK did not do its job. ***" >> "$LOG"
fi

echo "$(stamp) ── stripe reconcile finished  exit=$EXIT ──────────────────" >> "$LOG"
exit $EXIT
