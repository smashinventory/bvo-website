#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# reconcile_stripe.sh — cron wrapper for the Stripe order reconciler.
#
# Hostinger cron, every 15 minutes:
#   */15 * * * * /bin/bash /home/u222311468/domains/bathroomvanitiesoutlet.com/public_html/reconcile_stripe.sh
#
# WHAT IT DOES: finds orders that reached Stripe but never became orders here
# (a webhook that was never delivered, or was delivered and failed), asks
# Stripe what really happened, and settles only the ones Stripe says are
# authorised. It cannot capture, cancel, or move money.
#
# ⚠️ IF THIS SCRIPT EVER SETTLES ANYTHING, THE WEBHOOK FAILED. That is worth
# investigating. The log line says so explicitly rather than passing silently.
# ─────────────────────────────────────────────────────────────────────────────
set -u
cd "$(dirname "$0")" || exit 1

LOG="storage/logs/reconcile_stripe.log"
mkdir -p "$(dirname "$LOG")"

{
  echo "──────── $(date '+%Y-%m-%d %H:%M:%S %z') ────────"
  node src/jobs/reconcileStripeOrders.js
  echo "exit: $?"
} >> "$LOG" 2>&1

# Keep the log from growing without bound — 2000 lines is weeks of runs.
if [ -f "$LOG" ] && [ "$(wc -l < "$LOG")" -gt 2000 ]; then
  tail -n 1000 "$LOG" > "$LOG.tmp" && mv "$LOG.tmp" "$LOG"
fi
