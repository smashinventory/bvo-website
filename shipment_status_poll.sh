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

cd "$APP"

set +e
node src/jobs/shipmentStatusPoll.js $ARGS >> "$LOG" 2>&1
EXIT=$?
set -e

echo "$(stamp) ── shipment status poll finished  exit=$EXIT ──────────────" >> "$LOG"
exit $EXIT
