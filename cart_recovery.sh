#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# cart_recovery.sh — abandoned-cart outreach, once daily
# ───────────────────────────────────────────────────────────────────────
# Emails people who abandoned a checkout AND consented to marketing.
# Everybody else — declined, never asked, blocked, no address — is printed
# to the log as a CALL LIST with phone numbers, highest value first.
#
# ⚠️ TWO PREREQUISITES. Without either, the job refuses rather than
# half-works:
#   1. migrations/2026-10-27_cart_recovery_RUNME.sql          (the columns)
#   2. migrations/2026-10-27_cart_recovery_template_RUNME.sql (the template,
#      which is INSERTed is_active=0 and sends nothing until you turn it on)
#
# ⚠️ SAFE TO SCHEDULE BEFORE THE TEMPLATE IS ACTIVATED. brevoService looks
# up `is_active = 1`, so until you flip it the job finds carts, prints the
# call list, and sends nothing. That is a useful state, not a broken one:
# the call list is the half a human acts on and it works on day one.
#
# ── SCHEDULE ───────────────────────────────────────────────────────────
# CRON RUNS HOURLY; THE SENDING WINDOW IS ENFORCED BELOW, IN THIS FILE.
#   12 * * * *  /bin/bash /home/u222311468/domains/bathroomvanitiesoutlet.com/hbuilds/current/nodejs/cart_recovery.sh
#
# ⚠️ MINUTE 12, NOT 0, AND NOT ARBITRARILY. jmv_rollup.sh and
# brevo_consent_reconcile.sh both fire at minute 0. Cron does NOT queue
# jobs — it forks every expression that matches the current minute and
# they run concurrently — so three node processes would contend for the
# same shared-hosting memory ceiling and the same MySQL connection pool.
# Staggering costs nothing here: the window below is hour-granular, so
# which minute of the hour this runs on is immaterial to the job.
#
# ⚠️ THE WINDOW IS HERE AND NOT IN THE CRON EXPRESSION ON PURPOSE.
# hPanel's cron form offers a single-value Hour dropdown — it cannot
# express `12-23`. Rather than create twelve separate cron entries, or
# accept sends at 3am, the hour check lives in the script. That also
# means the sending window is in git, visible to whoever reads this file,
# instead of buried in a control panel nobody can diff.
#
# Hourly matters because recovery rates fall off steeply with delay: a
# daily run means somebody who abandons at 3pm hears nothing until the
# next morning. Hourly is SAFE to run because the send-once guard
# (orders.recovery_emailed_at IS NULL) is in the query — no frequency can
# produce a second email. gate_cart_recovery.js asserts that guard and
# mutation M6 removes it to prove the gate catches it.
#
# Combined with MIN_AGE_HOURS = 4 in src/jobs/cartRecovery.js, the worst
# case is about five hours from abandonment to email.
#
# ⚠️ POINTS AT hbuilds/current/nodejs, NOT THE DOMAIN ROOT. Same reasoning
# as brevo_consent_reconcile.sh: every wrapper that was hand-copied to the
# domain root has drifted from its repo copy at least once, and this repo
# records what that cost. Pointing at the deployed tree means git deploy IS
# the update and there is no second copy to go stale.
#
# ── FIRST RUN: USE --dry-run ───────────────────────────────────────────
#   /bin/bash <path>/cart_recovery.sh --dry-run
# Lists what WOULD be emailed and prints the call list. Sends nothing,
# stamps nothing. Do this before the first real run — the upper age bound
# limits the blast to 14 days, but seeing the list beats trusting it.
#
# NO CREDENTIALS IN THIS FILE — read from the app's own .env inside node.
# ═══════════════════════════════════════════════════════════════════════

set -euo pipefail

BASE=/home/u222311468/domains/bathroomvanitiesoutlet.com

LOG_DIR=$BASE/jmv_sync/logs
mkdir -p "$LOG_DIR"
LOG=$LOG_DIR/cart-recovery.log

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
SEND_FROM_HOUR=12
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

echo "$(stamp) ── cart recovery started ──────────────────────────────────" >> "$LOG"

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
    echo "$(stamp) ── cart recovery finished  exit=127 ───────────────────"
  } >> "$LOG"
  exit 127
fi

echo "$(stamp) using node: $NODE ($("$NODE" -v 2>/dev/null || echo 'version unknown'))" >> "$LOG"

set +e

"$NODE" -e "
  /* ⚠️ dotenv BEFORE the require, and it matters here. cartRecovery.js
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
  const { run } = require('./src/jobs/cartRecovery');

  run({ dryRun: dry }).then(r => {
    if (r.reason === 'migration_missing') process.exit(78);
    console.log('[cart-recovery] found=' + r.found + '  emailed=' + (r.emailed || 0) +
                '  toCall=' + r.toCall + (r.dryRun ? '  (DRY RUN)' : ''));
    /* A non-zero toCall is NOT a failure — it is the point. Exit 0 so the
       cron does not report a successful run as broken simply because some
       customers have to be phoned rather than emailed. */
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

echo "$(stamp) ── cart recovery finished  exit=$EXIT ─────────────────────" >> "$LOG"
exit $EXIT
