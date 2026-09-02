#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# shipment_status_poll.sh — WWEX shipment status poll
# ───────────────────────────────────────────────────────────────────────
# Polls WWEX for the carrier status of every ACTIVE shipment and syncs the
# result to both the shipment row and its linked order.
#
# WHY: WWEX sends delivery alerts to the RECEIVER's email, not to us, and
# there is no webhook. Without this, a shipment's status only updates when
# someone clicks Refresh on the Shipments list — so orders sat on "Shipped"
# indefinitely even after the freight had arrived.
#
# NO CREDENTIALS IN THIS FILE. The job loads the app's own .env, so both the
# database and WWEX credentials come from there. Nothing to configure here.
#
# ── CRON (hPanel → Cron Jobs, times are UTC) ───────────────────────────
#   0 13 * * *   /bin/bash /home/u222311468/domains/slategrey-falcon-350174.hostingersite.com/shipment_status_poll.sh
#   0 23 * * *   /bin/bash /home/u222311468/domains/slategrey-falcon-350174.hostingersite.com/shipment_status_poll.sh
#
# Timing (BVO operates US Eastern):
#   13:00 UTC = 09:00 ET — catches overnight deliveries before the day starts
#   23:00 UTC = 19:00 ET — catches the day's deliveries after carriers close
# LTL carriers rarely update more than once or twice a day, so this is enough
# resolution without hammering the API.
#
# COST: one WWEX call per active shipment per run. Terminal shipments
# (delivered/voided/cancelled) are never polled and anything older than 45
# days is dropped, so the call count tracks freight actually in motion.
#
# ── SETUP ──────────────────────────────────────────────────────────────
#   1. Copy this file to the server root (see cron path above). It must live
#      OUTSIDE hbuilds/ so a deploy cannot overwrite it.
#   2. chmod +x shipment_status_poll.sh
#   3. Dry run first:   bash shipment_status_poll.sh --dry
#      Reports what WOULD change and writes nothing.
#   4. Add both cron lines in hPanel → Cron Jobs.
#
# LOG: jmv_sync/logs/shipment-status-poll.log  (rotates at 5 MB)
# ═══════════════════════════════════════════════════════════════════════

set -euo pipefail

BASE=/home/u222311468/domains/slategrey-falcon-350174.hostingersite.com
APP=$BASE/hbuilds/current/nodejs

# ── Logging ─────────────────────────────────────────────────────────
LOG_DIR=$BASE/jmv_sync/logs
mkdir -p "$LOG_DIR"
LOG=$LOG_DIR/shipment-status-poll.log

# Rotate at 5 MB
if [ -f "$LOG" ] && [ "$(stat -c%s "$LOG" 2>/dev/null || echo 0)" -gt 5242880 ]; then
  mv "$LOG" "${LOG}.1"
fi

stamp() { date -u '+%Y-%m-%dT%H:%M:%SZ'; }

# Pass through --dry so the cron entry can be tested by hand
ARGS="${1:-}"

echo "$(stamp) ── shipment status poll started ${ARGS} ───────────────────" >> "$LOG"

if [ ! -d "$APP" ]; then
  echo "$(stamp) ERROR: app directory not found at $APP" >> "$LOG"
  exit 1
fi

# ── Locate node ─────────────────────────────────────────────────────
# Cron runs with a minimal PATH that does NOT include node, so a bare
# `node` call fails with "node: command not found" (exit 127). It works
# interactively because a login shell sources the profile that adds it.
#
# NOTE: jmv_rollup.sh has the same bare `node` call and the same latent
# problem. It goes unnoticed because node-cron inside server.js runs that
# job too, so the app does the work even when the shell wrapper fails.
#
# The FIRST path below is the one this server actually uses — taken from
# jmsync.sh, the existing Node cron job that works:
#     /opt/alt/alt-nodejs18/root/bin/node
# Note it is root/bin/node, NOT root/usr/bin/node. Getting that wrong is why
# a guessed path list would still have failed.
#
# Newer alt-nodejs versions are checked first in case the server is upgraded,
# then the known-good 18, then generic locations, then nvm.
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
  # nvm — newest version last, so the final match wins
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

cd "$APP"

set +e
"$NODE" src/jobs/shipmentStatusPoll.js $ARGS >> "$LOG" 2>&1
EXIT=$?
set -e

echo "$(stamp) ── shipment status poll finished  exit=$EXIT ──────────────" >> "$LOG"
exit $EXIT
