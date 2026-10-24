#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# brevo_consent_reconcile.sh — capture Brevo unsubscribes and blocks, daily
# ───────────────────────────────────────────────────────────────────────
# Task #374. Reads Brevo's blocklist, records who can no longer receive our
# email, withdraws marketing consent for them, and emails the owner when the
# address belongs to a TRADE customer.
#
# It never changes anyone's pricing. Owner decision 2026-10-23: flag for
# review, do not auto-downgrade. Gated (gate_email_consent.js section 10).
#
# WHY A CRON AND NOT A WEBHOOK — the full argument is in the header of
# src/jobs/brevoConsentReconcile.js. Short version: a webhook that flips
# consent flags would be an unauthenticated write to a compliance record
# (Brevo does not sign webhooks the way Stripe does), it would only ever see
# events from the day it was wired up, and it would miss hard bounces and
# spam complaints, which stop delivery just as dead as an unsubscribe.
#
# CRON (hPanel → Cron Jobs, UTC):
#   0 7 * * *   /bin/bash /home/u222311468/domains/bathroomvanitiesoutlet.com/brevo_consent_reconcile.sh
#
# Timing — 07:00 UTC, 30 min after the last existing job:
#   04:30 UTC  jmsync.sh              → BVO DB import + archive XLSX
#   04:59 UTC  gvssync.sh             → mirror XLSX + csv.gz
#   05:30 UTC  jmv_rollup.sh          → JMV movement rollup
#   06:30 UTC  erv_inventory_sync.sh  → ER Vanities stock
#   07:00 UTC  this script            → nothing else is touching customers
#
# ⚠️ FIRST RUN — DO IT BY HAND, WITH NOTIFICATIONS OFF.
# The job BACKFILLS: every address already on Brevo's blocklist is recorded
# on the first run, carrying reasons from months ago. With notifications on
# that could fire one owner email per historical trade unsubscribe. So:
#
#   1. Run the migration first:
#        migrations/email_consent_2026-10-23.sql
#      Without it the job dies on an unknown column, AFTER reading Brevo.
#   2. Backfill run, notifications suppressed:
#        cd $BASE/hbuilds/current/nodejs
#        BREVO_RECONCILE_NOTIFY=0 /bin/bash $BASE/brevo_consent_reconcile.sh
#      Read the log. The 'blocked' count is your existing backlog.
#   3. Look at who it caught before adding the cron — if a trade customer is
#      in there, that is a conversation, not a notification.
#   4. Add the cron line above. Leave BREVO_RECONCILE_NOTIFY unset from then
#      on; the default is ON, deliberately, because a quiet default would
#      mean the feature silently does nothing forever.
#
# NO CREDENTIALS IN THIS FILE — read from the app's own .env inside the node
# call, so this copy and the one in hbuilds/ are byte identical. Same
# reasoning as erv_inventory_sync.sh.
# ═══════════════════════════════════════════════════════════════════════

set -euo pipefail

# The domain was renamed; older wrappers in this repo still name the dead
# slategrey-falcon host. Match the live crons.
BASE=/home/u222311468/domains/bathroomvanitiesoutlet.com

LOG_DIR=$BASE/jmv_sync/logs
mkdir -p "$LOG_DIR"
LOG=$LOG_DIR/brevo-consent.log

if [ -f "$LOG" ] && [ "$(stat -c%s "$LOG" 2>/dev/null || echo 0)" -gt 5242880 ]; then
  mv "$LOG" "${LOG}.1"
fi

stamp() { date -u '+%Y-%m-%dT%H:%M:%SZ'; }

echo "$(stamp) ── Brevo consent reconcile started ────────────────────────" >> "$LOG"

cd $BASE/hbuilds/current/nodejs

# Cron's PATH has no node, so a bare `node` exits 127. Note root/bin/node,
# NOT root/usr/bin/node, is what this server actually uses.
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
    echo "$(stamp) ── Brevo consent reconcile finished  exit=127 ─────────────"
  } >> "$LOG"
  exit 127
fi

echo "$(stamp) using node: $NODE ($("$NODE" -v 2>/dev/null || echo 'version unknown'))" >> "$LOG"

set +e

"$NODE" -e "
  /* ⚠️ THE dotenv LOAD IS LOAD-BEARING HERE, UNLIKE erv_inventory_sync.sh.
     That job requires config/database lazily inside a db() helper, so the
     order could not break it. THIS one reaches brevoService, which does
     \`const { bvoPool } = require('../config/database')\` at module scope —
     the pool is built the moment the job is required. Require before the
     env load and the pool gets a blank password, which surfaces much later
     as an access-denied error that looks like a credentials problem on the
     server rather than an ordering mistake in this file.
     Same trap jmv_rollup.sh documents. Load first, require after. */
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

  /* Checked separately, with its own exit code: 'the database is fine but
     Brevo will not answer' is a different problem with a different fix.
     Without the key fetchBlockedContacts returns ok:false and the job
     correctly aborts having written nothing — but it would do so silently
     every night, which looks identical to 'nobody unsubscribed'. */
  if (!process.env.BREVO_API_KEY) {
    console.error('[FATAL] BREVO_API_KEY is not set — the blocklist cannot be read.');
    console.error('        Set it in the hPanel environment panel, not in a local .env.');
    process.exit(78);
  }

  const { run } = require('./src/jobs/brevoConsentReconcile');

  run().then(r => {
    if (!r.ok) {
      /* A refusal, not a crash. The job declined to write because it could
         not trust what it read. Distinct exit code so a reading failure is
         not mistaken for a transient wobble and ignored. */
      console.error('[REFUSED] blocklist unreadable, nothing written');
      process.exit(3);
    }
    console.log('[consent] blocked=' + r.blocked + '  restored=' + r.restored +
                '  trade=' + r.trade + (r.partial ? '  (LIST TRUNCATED)' : ''));
    /* A truncated list means restores were skipped. Said out loud because
       the consequence is silent: blocked customers stay blocked forever and
       nobody would otherwise know why an unblock never took effect. */
    if (r.partial) {
      console.warn('[consent] Brevo returned more than the page cap. New blocks were');
      console.warn('          recorded; RESTORES WERE SKIPPED. Raise BLOCKLIST_MAX_PAGES');
      console.warn('          in src/services/brevoService.js if this persists.');
    }
    process.exit(0);
  }).catch(err => {
    console.error('[FATAL] ' + (err && err.message));
    process.exit(1);
  });
" -- "$@" >> "$LOG" 2>&1
# THE -- IS LOAD-BEARING. Without it node parses any trailing argument as one
# of its own options and dies with "bad option", exit 9, before a line of the
# script runs. jmv_rollup.sh has this exact bug with $INCLUDE_DIMS, which is
# why its weekly dimension refresh has only ever worked when run by hand.

EXIT=$?
set -e

echo "$(stamp) ── Brevo consent reconcile finished  exit=$EXIT ───────────" >> "$LOG"
exit $EXIT
