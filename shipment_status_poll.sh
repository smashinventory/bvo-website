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
# CRON (hPanel → Cron Jobs, UTC) — twice daily:
#   0 13 * * *   /bin/bash /home/u222311468/domains/slategrey-falcon-350174.hostingersite.com/shipment_status_poll.sh
#   0 23 * * *   /bin/bash /home/u222311468/domains/slategrey-falcon-350174.hostingersite.com/shipment_status_poll.sh
#
# Timing rationale (BVO operates US Eastern):
#   13:00 UTC = 09:00 ET — catches overnight deliveries before the day starts
#   23:00 UTC = 19:00 ET — catches the day's deliveries after carriers close
# LTL carriers rarely update status more than once or twice a day, so this
# is enough resolution without hammering the API.
#
# COST: one WWEX call per active shipment per run. Terminal shipments
# (delivered/voided/cancelled) are never polled, and anything older than
# 45 days is dropped, so the call count tracks shipments actually in motion.
#
# SETUP — before first run:
#   1. Copy this file to the server root:
#      /home/u222311468/domains/slategrey-falcon-350174.hostingersite.com/shipment_status_poll.sh
#   2. Set DB_PASS below (keep on server, never paste into chat).
#   3. Add both cron lines above in hPanel → Cron Jobs.
#   4. Test first with:  bash shipment_status_poll.sh --dry
#      A dry run reports what WOULD change and writes nothing.
#
# NOTE: WWEX credentials come from the app's own .env — this script does not
# need them. If WWEX_CLIENT_ID is unset the job detects stub mode and exits
# cleanly without calling anything.
# ═══════════════════════════════════════════════════════════════════════

set -euo pipefail

BASE=/home/u222311468/domains/slategrey-falcon-350174.hostingersite.com

# ── Database credentials (set DB_PASS — never paste into chat) ──────
export DB_HOST=127.0.0.1
export DB_USER=u222311468_Admin1
export DB_NAME=u222311468_BVO_website
export DB_PASS="YOUR_DB_PASSWORD_HERE"

# ── Logging ─────────────────────────────────────────────────────────
LOG_DIR=$BASE/jmv_sync/logs
mkdir -p "$LOG_DIR"
LOG=$LOG_DIR/shipment-status-poll.log

# Rotate log at 5 MB
if [ -f "$LOG" ] && [ "$(stat -c%s "$LOG" 2>/dev/null || echo 0)" -gt 5242880 ]; then
  mv "$LOG" "${LOG}.1"
fi

stamp() { date -u '+%Y-%m-%dT%H:%M:%SZ'; }

# Pass through --dry so the cron entry can be tested by hand
ARGS="${1:-}"

echo "$(stamp) ── shipment status poll started ${ARGS} ───────────────────" >> "$LOG"

cd $BASE/hbuilds/current/nodejs

set +e
node src/jobs/shipmentStatusPoll.js $ARGS >> "$LOG" 2>&1
EXIT=$?
set -e

echo "$(stamp) ── shipment status poll finished  exit=$EXIT ──────────────" >> "$LOG"
exit $EXIT
