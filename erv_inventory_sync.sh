#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# erv_inventory_sync.sh — ER Vanities stock, RFLPOS → BVO, once a day
# ───────────────────────────────────────────────────────────────────────
# Pulls sellable quantity for the ER Vanities cabinets from rflpos.com via the
# read-only proxy and writes inventory.qty_on_hand. It writes NOTHING to the
# products table — names, prices, descriptions and images are BVO's, and the
# feed it reads does not even return those columns.
#
# This is NOT the RFLPOS product sync. That one (services/rflposSync.js, routes
# commented out in routes/admin.js) does catalogue import: it creates products
# pending approval and carries content. This does quantity updates on products
# that already exist. Two jobs, deliberately separate — see the header of
# src/jobs/ervInventorySync.js.
#
# CRON (hPanel → Cron Jobs, UTC):
#   30 6 * * *   /bin/bash /home/u222311468/domains/bathroomvanitiesoutlet.com/erv_inventory_sync.sh
#
# Timing rationale — 06:30 UTC sits clear of everything else on this box:
#   04:30 UTC  jmsync.sh        → BVO DB import + archive XLSX
#   04:59 UTC  gvssync.sh       → mirror XLSX + csv.gz
#   05:30 UTC  jmv_rollup.sh    → JMV movement rollup
#   06:30 UTC  this script      → 60-min buffer after the rollup
# 06:30 UTC is ~01:30 ET, so the figures are a day-start snapshot taken before
# the counter opens and before web orders of the day land.
#
# SETUP — before first run:
#   1. Copy this file to the server root:
#      /home/u222311468/domains/bathroomvanitiesoutlet.com/erv_inventory_sync.sh
#      Plain copy, nothing to edit afterwards.
#   2. Upload the updated bvo_sync.php to rflpos.com/public_html/ — this script
#      is useless until the proxy serves action=inventory.
#   3. Dry run first, from the server:
#        cd $BASE/hbuilds/current/nodejs && node src/jobs/ervInventorySync.js --dry
#      That reports what it WOULD write and touches nothing.
#   4. Add the cron line above in hPanel → Cron Jobs.
#
# NO CREDENTIALS IN THIS FILE. DB credentials and BVO_SYNC_TOKEN are read from
# the app's own .env inside the node call, so this copy and the one in hbuilds/
# are byte identical and the file drop needs no follow-up edit. Same reasoning
# as jmv_rollup.sh, which used to carry an inline password and therefore had
# two copies that differed by one line.
# ═══════════════════════════════════════════════════════════════════════

set -euo pipefail

# THE DOMAIN WAS RENAMED. Every other wrapper in this repo still says
# slategrey-falcon-350174.hostingersite.com, which no longer exists on disk —
# their SERVER copies were hand-edited after the rename and the repo copies
# were never updated (see commit 1e498b9 and SERVER_CRON_TOPOLOGY.md on the
# hand-mirroring problem). Copying the old path from jmv_rollup.sh is exactly
# how this script failed its first cron run with "No such file or directory".
# The live crons all use the path below; match them.
BASE=/home/u222311468/domains/bathroomvanitiesoutlet.com

# ── Logging ─────────────────────────────────────────────────────────
LOG_DIR=$BASE/jmv_sync/logs
mkdir -p "$LOG_DIR"
LOG=$LOG_DIR/erv-inventory.log

# Rotate at 5 MB, same as jmv_rollup.sh
if [ -f "$LOG" ] && [ "$(stat -c%s "$LOG" 2>/dev/null || echo 0)" -gt 5242880 ]; then
  mv "$LOG" "${LOG}.1"
fi

stamp() { date -u '+%Y-%m-%dT%H:%M:%SZ'; }

echo "$(stamp) ── ERV inventory sync started ─────────────────────────────" >> "$LOG"

cd $BASE/hbuilds/current/nodejs

# ── Locate node ─────────────────────────────────────────────────────
# Cron runs with a minimal PATH that does not include node, so a bare `node`
# call exits 127. Copied from jmv_rollup.sh, which copied it from jmsync.sh —
# the first candidate is the path this server actually uses, and note it is
# root/bin/node, NOT root/usr/bin/node.
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
    echo "$(stamp) ── ERV inventory sync finished  exit=127 ──────────────────"
  } >> "$LOG"
  exit 127
fi

echo "$(stamp) using node: $NODE ($("$NODE" -v 2>/dev/null || echo 'version unknown'))" >> "$LOG"

# `set -e` would abort before the exit code is logged, so a failed run would
# leave a log that just stops. Disable around the call, then restore.
set +e

"$NODE" -e "
  /* ── Load credentials ──────────────────────────────────────────────
     hPanel writes hbuilds/config/.env and it survives deploys. The managed
     app process gets these injected by hPanel; CRON DOES NOT INHERIT THAT
     INJECTION, which is why the file is read explicitly. Candidates are tried
     in order and the first that yields DB_PASS wins; dotenv never overwrites
     an already-set variable, so a shell export still takes precedence.

     ORDER IS LESS FRAGILE HERE THAN IN jmv_rollup.sh, on purpose.
     jmvMovementRollup requires config/database at its top level, which builds
     the pool on require — so dotenv there MUST run before the require or the
     pool gets a blank password. ervInventorySync requires the database
     LAZILY, inside a db() helper, so it cannot be broken that way. The load
     still happens first because it is correct, not because it is load-bearing. */
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
    /* 78 is EX_CONFIG and means precisely: no file supplied DB_PASS. A WRONG
       password surfaces as a driver error instead, so the two are never
       confused in the log. */
    console.error('[FATAL] no .env supplied DB_PASS. Tried: ' + CANDIDATES.join(', '));
    process.exit(78);
  }
  console.log('[env] loaded ' + envFile);

  /* The token is what makes the proxy answer at all. Checked separately from
     DB_PASS and with its own exit code, because 'the database is fine but
     rflpos.com will refuse us' is a different problem with a different fix. */
  if (!process.env.BVO_SYNC_TOKEN) {
    console.error('[FATAL] BVO_SYNC_TOKEN is not set — the proxy will return 403.');
    console.error('        Set it in hPanel env, matching SetEnv BVO_SYNC_TOKEN on rflpos.com.');
    process.exit(78);
  }

  const { run } = require('./src/jobs/ervInventorySync');
  const dryRun  = process.argv.includes('--dry');

  run({ dryRun }).then(s => {
    console.log('[erv] feed=' + s.feedRows + '  matched=' + s.matched +
                '  written=' + s.written + '  zero=' + s.zeroed +
                (dryRun ? '  (DRY RUN)' : ''));
    /* Named, because these are the ones that vanish from the bundle builder.
       A count alone tells you something changed but not what to go look at. */
    if (s.zeroSkus.length) {
      console.log('[erv] at zero sellable stock (' + s.zeroSkus.length + '):');
      s.zeroSkus.forEach(l => console.log('        ' + l));
    }
    /* Quantities BVO now holds that RFLPOS never actually sent. This log is
       the only place anyone reads them, so the wrapper prints them itself —
       formatSummary() lists them too, but that string goes to the
       rflpos_sync_log row, not to the cron mail. Keeping the two formatters in
       step is gated; they diverged once already. */
    if (s.negativeQty && s.negativeQty.length) {
      console.log('[erv] NEGATIVE AT SOURCE, written as 0 (' + s.negativeQty.length + '):');
      s.negativeQty.forEach(l => console.log('        ' + l));
    }
    if (s.flooredQty && s.flooredQty.length) {
      console.log('[erv] fractional at source, floored (' + s.flooredQty.length + '):');
      s.flooredQty.forEach(l => console.log('        ' + l));
    }
    if (s.notInBvo.length)     console.log('[erv] in RFLPOS, no BVO product: ' + s.notInBvo.length);
    if (s.notInFeed.length)    console.log('[erv] in BVO, absent from feed:  ' + s.notInFeed.join(', '));
    if (s.rejected.length)     console.error('[erv] rejected rows: ' + s.rejected.join(' | '));
    if (s.duplicateSku.length) console.error('[erv] MULTI-VARIATION, skipped: ' + s.duplicateSku.join(', '));
    /* The local-vs-all gap is the is_local audit. Every line here is stock
       that exists at Factory INV or In-Ocean INV and is deliberately NOT being
       published. Lines appearing for a SKU you expected to be sellable mean a
       location flag is wrong, not that the sync is wrong. */
    if (s.localVsAll.length) {
      console.log('[erv] sellable vs all locations (' + s.localVsAll.length + '):');
      s.localVsAll.forEach(l => console.log('        ' + l));
    }
    process.exit(0);
  }).catch(err => {
    /* A GUARD abort is a refusal, not a crash: the job declined to write
       because what it received did not look like real data. Flagged
       distinctly so it is not read as a transient network failure and
       ignored — a guard firing means something upstream needs looking at. */
    if (/^GUARD/.test(err.message)) {
      console.error('[REFUSED] ' + err.message);
      process.exit(3);
    }
    console.error('[FATAL] ' + err.message);
    process.exit(1);
  });
" -- "$@" >> "$LOG" 2>&1
# THE -- IS LOAD-BEARING. Without it, `node -e "script" --dry` makes node
# parse --dry as one of ITS OWN options and die with "bad option: --dry",
# exit 9, before a line of the script runs. The separator tells node that
# everything after it belongs to the script, where process.argv picks it up.
#
# jmv_rollup.sh has this exact bug with $INCLUDE_DIMS and nobody noticed,
# because that variable is empty six days a week. On Saturdays the wrapper
# dies the same way — which is why the weekly dimension refresh has only ever
# worked when run by hand from the admin UI.

EXIT=$?
set -e

echo "$(stamp) ── ERV inventory sync finished  exit=$EXIT ────────────────" >> "$LOG"
exit $EXIT
