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
# CRON — LIVE AS OF 2026-10-24 (hPanel → Cron Jobs, UTC):
#   0 7 * * *   /bin/bash /home/u222311468/domains/bathroomvanitiesoutlet.com/hbuilds/current/nodejs/brevo_consent_reconcile.sh
#
# ⚠️ IT POINTS AT THE DEPLOYED COPY, NOT THE DOMAIN ROOT, AND THAT IS
# DELIBERATE — this is the only wrapper that does.
# Every other .sh here was hand-copied to the domain root, and this repo
# already records what that cost: erv_inventory_sync.sh notes that the other
# wrappers still name the dead slategrey-falcon host because their SERVER
# copies were edited after the rename and the repo copies never were, and
# that jmv_rollup.sh once had two copies differing by one line. Pointing the
# cron at hbuilds/current/nodejs means git deploy IS the update and there is
# no second copy to drift. Cost: a run that fires mid-deploy, while `current`
# is being swapped, fails and the next day's is fine.
#
# ⚠️ hPANEL WRAPS THE COMMAND IN `timeout` AND DOES NOT USE A SHELL.
# So `VAR=value /bin/bash script.sh` fails with
#   timeout: failed to run command 'VAR=value': No such file or directory
# because the env-var prefix is shell syntax and there is no shell. To pass
# an environment variable from the hPanel field, front it with a real
# executable: `/usr/bin/env VAR=value /bin/bash script.sh`. Same family of
# trap as the `--` separator at the bottom of this file.
#
# ACTUAL SCHEDULE ON THIS BOX, verified against hPanel 2026-10-24. The first
# version of this comment was wrong on two rows and omitted four jobs; it was
# written from the stale list in erv_inventory_sync.sh rather than checked.
#   */5  * * * *  jm_feed_guard.sh       → JM feed watchdog
#   04:30, 16:30  jmsync.sh              → BVO DB import + archive XLSX (twice)
#   04:59, 17:00  gvssync.sh             → mirror XLSX + csv.gz (twice)
#   05:45 UTC     jmv_rollup.sh          → JMV movement rollup
#   06:15 UTC     erv_inventory_sync.sh  → ER Vanities stock
#   06:30 UTC     bundle_catalogue.sh    → bundle catalogue rebuild
#   07:00 UTC     this script            → nothing else is touching customers
#   13:00, 23:00  shipment_status_poll.sh
#
# FIRST RUN — ALREADY DONE, 2026-10-24 01:57Z, kept as the record.
# The job BACKFILLS: the first run records every address already on Brevo's
# blocklist, not just unsubscribes from that day on. It was therefore run by
# hand with notifications suppressed, so a pile of historical trade
# unsubscribes could not fire a pile of owner emails:
#   /usr/bin/env BREVO_RECONCILE_NOTIFY=0 /bin/bash <path>
# Result: 2 newly blocked, 0 restored, 0 of them trade. Both were the owner's
# own test accounts and both were hardBounce, not unsubscribes — so no
# customer had ever silently lost mail. The suppression was removed from the
# cron immediately afterwards.
#
# BREVO_RECONCILE_NOTIFY defaults to ON and should stay unset. A quiet
# default would mean this runs every night and never tells anyone anything,
# which is indistinguishable from it not running at all.
#
# ⚠️ THE MIGRATION IS A PREREQUISITE: migrations/email_consent_2026-10-23.sql
# (applied 2026-10-23). Without those columns the job dies on an unknown
# column AFTER it has already read Brevo.
#
# NO CREDENTIALS IN THIS FILE — read from the app's own .env inside the node
# call. Same reasoning as erv_inventory_sync.sh.
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
