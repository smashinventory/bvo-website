#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# stock_notify.sh — back-in-stock notices
# ───────────────────────────────────────────────────────────────────────
# Emails the people who asked to be told when an out-of-stock product
# returned. 1,178 of 5,873 feed products (20%) are out of stock at any
# time, 725 of them in Single Sink Vanity With Top — the largest and
# most-searched category.
#
# ⚠️ PREREQUISITE, OR THE JOB FINDS A MISSING TABLE AND DIES:
#   migrations/2026-11-09_stock_notifications_RUNME.sql
# That migration also inserts the `back_in_stock` email template
# is_active = 1, so sending works the moment the table exists.
#
# ── SCHEDULE ───────────────────────────────────────────────────────────
#   25 7 * * *  /bin/bash /home/u222311468/domains/bathroomvanitiesoutlet.com/hbuilds/current/nodejs/stock_notify.sh
#
# ⚠️ 07:25 UTC, AND THE ORDER MATTERS MORE THAN THE TIME.
# erv_inventory_sync.sh runs at 06:30 and is what actually moves
# qty_on_hand from 0 to something. Running before it would scan yesterday's
# stock and tell nobody; 55 minutes after gives the sync room to finish on a
# slow morning without the two jobs contending for the same shared-hosting
# memory ceiling.
#
# Minute 25 because jmv_rollup.sh and brevo_consent_reconcile.sh both fire
# at minute 0 and cart_recovery.sh at minute 12. Cron does NOT queue — it
# forks everything matching the current minute — so staggering is what keeps
# four node processes off each other's throats.
#
# ⚠️ NO SENDING WINDOW, UNLIKE cart_recovery.sh, AND DELIBERATELY SO.
# A recovery email is marketing that interrupts somebody; this is a notice
# the customer explicitly asked for about one item, and stock on these moves.
# Holding it until business hours would mean somebody who asked in March
# watches the vanity sell out again while the email waits for 8am. The window
# variables are left in place but open, so reinstating one is a two-line edit
# rather than a rewrite.
#
# ⚠️ SAFE TO RUN AS OFTEN AS YOU LIKE. The send-once guard is in the UPDATE
# (`WHERE id = ? AND notified_at IS NULL`) and in the table (UNIQUE on
# product_id + email). gate_stock_notify.js asserts both, and
# mutate_stock_notify.js removes each to prove the gate catches it.
#
# ── FIRST RUN: USE --dry-run ───────────────────────────────────────────
#   /bin/bash <path>/stock_notify.sh --dry-run
# Lists who WOULD be emailed and why the rest were skipped. Sends nothing,
# stamps nothing.
#
# NO CREDENTIALS IN THIS FILE — read from the app's own .env inside node.
# ═══════════════════════════════════════════════════════════════════════

set -euo pipefail

BASE=/home/u222311468/domains/bathroomvanitiesoutlet.com

LOG_DIR=$BASE/jmv_sync/logs
mkdir -p "$LOG_DIR"
LOG=$LOG_DIR/stock-notify.log

if [ -f "$LOG" ] && [ "$(stat -c%s "$LOG" 2>/dev/null || echo 0)" -gt 5242880 ]; then
  mv "$LOG" "${LOG}.1"
fi

stamp() { date -u '+%Y-%m-%dT%H:%M:%SZ'; }

# ── SENDING WINDOW ─────────────────────────────────────────────────────
# Hours are UTC, because the server is. 12–23 UTC is roughly 8am–7pm
# Eastern; after US daylight saving ends it becomes 7am–6pm. That drift
# is accepted — an hour either way does not change whether a recovery
# email is welcome, and a DST-aware window would need a timezone library
# in a shell script for no real gain.
#
# ⚠️ --dry-run IGNORES THE WINDOW. The dry run sends nothing, so refusing
# to run it outside working hours would only make the thing you use to
# TEST the job unavailable for most of the day.
SEND_FROM_HOUR=0
SEND_TO_HOUR=23

case " $* " in
  *" --dry-run "*) IN_WINDOW=1 ;;
  *)
    HOUR_NOW=$(date -u +%-H)
    if [ "$HOUR_NOW" -ge "$SEND_FROM_HOUR" ] && [ "$HOUR_NOW" -le "$SEND_TO_HOUR" ]; then
      IN_WINDOW=1
    else
      IN_WINDOW=0
    fi
    ;;
esac

if [ "$IN_WINDOW" -eq 0 ]; then
  # Logged rather than silent: "it did not run" and "it ran and found
  # nothing" must never look the same in this log.
  echo "$(stamp) ── outside sending window (${SEND_FROM_HOUR}-${SEND_TO_HOUR} UTC), skipping ──" >> "$LOG"
  exit 0
fi

echo "$(stamp) ── stock notify started ──────────────────────────────────" >> "$LOG"

cd $BASE/hbuilds/current/nodejs

# Cron's PATH has no node, so a bare `node` exits 127. root/bin/node, NOT
# root/usr/bin/node, is what this server actually uses.
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
    echo "$(stamp) ── stock notify finished  exit=127 ───────────────────"
  } >> "$LOG"
  exit 127
fi

echo "$(stamp) using node: $NODE ($("$NODE" -v 2>/dev/null || echo 'version unknown'))" >> "$LOG"

set +e

"$NODE" -e "
  /* ⚠️ dotenv BEFORE the require, and it matters here. stockNotify.js
     takes its pool lazily, but it reaches brevoService, which does
     \`const { bvoPool } = require('../config/database')\` at MODULE scope —
     requiring it before the env load builds a pool with a blank password,
     which surfaces much later as an access-denied error that looks like a
     credentials problem on the server rather than an ordering mistake in
     this file. Same trap brevo_consent_reconcile.sh and jmv_rollup.sh both
     document. Load first, require after. */
  const fs = require('fs');
  const CANDIDATES = [
    process.env.BVO_ENV_PATH,
    '$BASE/hbuilds/config/.env',
    '$BASE/hbuilds/current/nodejs/.env',
  ].filter(Boolean);

  let envFile = null;
  for (const p of CANDIDATES) {
    if (!fs.existsSync(p)) continue;
    require('dotenv').config({ path: p });
    if (process.env.DB_PASS) { envFile = p; break; }
  }

  if (!process.env.DB_PASS) {
    /* 78 is EX_CONFIG: no file supplied DB_PASS. A WRONG password surfaces
       as a driver error instead, so the two are never confused. */
    console.error('[FATAL] no .env supplied DB_PASS. Tried: ' + CANDIDATES.join(', '));
    process.exit(78);
  }
  console.log('[env] loaded ' + envFile);

  /* Checked separately with its own exit code. Without it the unsubscribe
     links in every email would be unsignable — and unsubscribeToken throws
     rather than emitting a token that verifies nothing, so this would fail
     mid-send having already mailed some people a broken footer. */
  if (!process.env.SESSION_SECRET) {
    console.error('[FATAL] SESSION_SECRET is not set — unsubscribe links cannot be signed.');
    console.error('        Set it in the hPanel environment panel.');
    process.exit(78);
  }

  const dry = process.argv.includes('--dry-run');
  const { run } = require('./src/jobs/stockNotify');

  run({ dryRun: dry }).then(r => {
    /* ⚠️ THIS LINE MUST MATCH WHAT src/jobs/stockNotify.js ACTUALLY RETURNS.
       This wrapper began as a copy of cart_recovery.sh, which reports
       found/emailed/toCall — fields this job has never had. Left unedited it
       printed 'found=undefined emailed=0 toCall=undefined' on every run,
       which reads as a broken job rather than a copy-paste miss. Caught
       before first deploy, 2026-11-09. */
    console.log('[stock-notify] scanned=' + (r.scanned || 0) +
                '  sent=' + (r.sent || 0) +
                '  failed=' + (r.failed || 0) +
                '  expired=' + (r.expired || 0) +
                '  skipped=' + (r.skipped || 0) +
                (r.dryRun ? '  (DRY RUN, would send ' + r.wouldSend + ')' : ''));
    /* A skip is not a failure — most pending requests are simply for things
       still out of stock, which is the normal state. Only a send that threw
       sets ok=false. */
    process.exit(r.ok ? 0 : 1);
  }).catch(err => {
    console.error('[FATAL] ' + (err && err.message));
    process.exit(1);
  });
" -- "$@" >> "$LOG" 2>&1
# THE -- IS LOAD-BEARING. Without it node parses a trailing --dry-run as one
# of its own options and dies with "bad option", exit 9, before a line runs.
# jmv_rollup.sh has this exact bug with $INCLUDE_DIMS, which is why its
# weekly dimension refresh has only ever worked when run by hand.

EXIT=$?
set -e

echo "$(stamp) ── stock notify finished  exit=$EXIT ─────────────────────" >> "$LOG"
exit $EXIT
