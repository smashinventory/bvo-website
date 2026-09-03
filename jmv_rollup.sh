#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# jmv_rollup.sh — JMV Nightly Movement Rollup
# ───────────────────────────────────────────────────────────────────────
# Reads the latest JMV XLSX from JM_Feed_Repo/archive/ (or csv.gz from
# jmv_sync/snapshots/), computes inventory deltas, and upserts:
#   jmv_snapshots, jmv_snapshot_validity, jmv_daily_movement, jmv_dimensions
#
# CRON (hPanel → Cron Jobs, UTC):
#   30 5 * * *   /bin/bash /home/u222311468/domains/slategrey-falcon-350174.hostingersite.com/jmv_rollup.sh
#
# Timing rationale:
#   04:30 UTC  jmsync.sh       → BVO DB import + archive XLSX to public_html/JM_Feed/archive/
#   04:59 UTC  gvssync.sh      → mirror XLSX to JM_Feed_Repo/archive/ + csv.gz to jmv_sync/snapshots/
#   05:30 UTC  jmv_rollup.sh   → this script (safe 31-min buffer after gvssync finishes)
#
# The process kill limit on Hostinger is exactly 30 minutes.
# The rollup processes each date in sequence; a typical night (1 new date,
# 5,218 SKUs) completes in ~60 seconds, well within the kill window.
#
# SETUP — before first run:
#   1. Copy this file to the server root:
#      /home/u222311468/domains/slategrey-falcon-350174.hostingersite.com/jmv_rollup.sh
#      That is a PLAIN COPY. There is nothing to edit afterwards — see below.
#   2. Add the cron line above in hPanel → Cron Jobs.
#   3. First run via "↺ Run Rollup" in /admin/marketing/jmv to seed historical dates.
#
# NO CREDENTIALS IN THIS FILE. The DB credentials are read from the app's own
# .env inside the node call, so this copy and the one in hbuilds/ are byte
# identical and the file drop needs no follow-up edit.
#
# Until 2026-09-03 this script exported DB_HOST/USER/NAME/PASS inline. The
# consequence was two copies that differed by exactly one line — the deployed
# copy carried YOUR_DB_PASSWORD_HERE and only the root copy worked — so every
# file drop required remembering to re-paste the password. Forget once and the
# rollup fails at DB connect, which is a log line you only see if you go
# looking. shipment_status_poll.sh already worked this way; this now matches it.
#
# hPanel remains the source of truth for env. It writes hbuilds/config/.env,
# which survives deploys. hPanel injects those vars into the managed app
# process, but CRON DOES NOT INHERIT THAT INJECTION — which is why the file has
# to be read explicitly here.
#
# See ROLLBACK_jmv_rollup_env.md for the full dependency check and revert steps.
# ═══════════════════════════════════════════════════════════════════════

set -euo pipefail

BASE=/home/u222311468/domains/slategrey-falcon-350174.hostingersite.com

# ── Database credentials ─────────────────────────────────────────────
# Intentionally absent. Loaded from hbuilds/config/.env inside the node call
# below, where the load ORDER matters — see the note there before editing.

# ── Data source paths ────────────────────────────────────────────────
# These stay as shell exports ON PURPOSE, unlike the DB credentials.
#
# They are DERIVED from $BASE rather than stored literals. If they were read
# from .env instead and hPanel's stored value ever disagreed with what $BASE
# resolves to, the rollup would run happily against the wrong snapshot
# directory and report success on stale or absent data. $BASE-derived is the
# more correct source, so it wins.
#
# dotenv does not override variables that are already set, so these survive
# even if .env also defines them.

# csv.gz snapshots (created by gvssync.sh nightly)
export JMV_SNAPSHOTS_PATH=$BASE/jmv_sync/snapshots

# XLSX archive (protected mirror — never touched by deploys)
export JMV_FEED_ARCHIVE=$BASE/JM_Feed_Repo/archive

# ── Logging ─────────────────────────────────────────────────────────
LOG_DIR=$BASE/jmv_sync/logs
mkdir -p "$LOG_DIR"
LOG=$LOG_DIR/jmv-rollup.log

# Rotate log at 5 MB
if [ -f "$LOG" ] && [ "$(stat -c%s "$LOG" 2>/dev/null || echo 0)" -gt 5242880 ]; then
  mv "$LOG" "${LOG}.1"
fi

stamp() { date -u '+%Y-%m-%dT%H:%M:%SZ'; }

echo "$(stamp) ── JMV rollup started ─────────────────────────────────────" >> "$LOG"

# ── Run the rollup ───────────────────────────────────────────────────
# node-cron in server.js fires the same job at 05:30 UTC.
# This shell wrapper runs it directly so cron can trigger it independently
# (useful for back-fill, debugging, or if server.js is restarting).
#
# We pass --include-dimensions once per week (Saturday) to refresh the
# dimension table from the latest XLSX. On other days it's skipped for speed.
DOW=$(date -u '+%u')  # 1=Mon … 7=Sun
INCLUDE_DIMS=""
[ "$DOW" = "6" ] && INCLUDE_DIMS="--include-dimensions"

cd $BASE/hbuilds/current/nodejs

# ── Locate node ─────────────────────────────────────────────────────
# Cron runs with a minimal PATH that does NOT include node, so a bare
# `node` call fails with "node: command not found" (exit 127). This script
# has been failing here on every scheduled run. It went unnoticed because
# node-cron inside server.js fires the same job at 05:30 UTC, so the work
# still got done — the wrapper was dying and the app was covering for it.
#
# The first path below is the one this server actually uses, taken from
# jmsync.sh, the Node cron job that has always worked. Note it is
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
    echo "$(stamp)   Then hardcode that path as NODE= near the top of this script."
    echo "$(stamp) ── JMV rollup finished  exit=127 ──────────────────────────"
  } >> "$LOG"
  exit 127
fi

echo "$(stamp) using node: $NODE ($("$NODE" -v 2>/dev/null || echo 'version unknown'))" >> "$LOG"

# `set -e` would abort the script the instant node exits non-zero, so the
# EXIT capture and the "finished" log line below would never run — a failed
# rollup would leave a log that just stops mid-way with no exit code.
# Disable it around the call so failures are recorded, then restore.
set +e

"$NODE" -e "
  /* ── Load DB credentials ───────────────────────────────────────────
     ORDER IS LOAD-BEARING. config/database.js calls createPool() at module
     top level, and jmvMovementRollup requires it at ITS top level. So by the
     time the require below returns, the pool is already built. dotenv MUST
     run first or the pool is created with a blank password.

     Do not move the require above this block.

     hPanel writes hbuilds/config/.env and it survives deploys. The app gets
     these vars injected by hPanel directly; cron does not inherit that
     injection, hence reading the file. Candidates are tried in order and the
     first one that actually yields DB_PASS wins — dotenv never overwrites an
     already-set variable, so a value exported by the shell still takes
     precedence over the file. */
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
    /* Exit 78 is EX_CONFIG and means exactly one thing: no file supplied
       DB_PASS. A WRONG password surfaces as a driver error instead, so these
       two failures are never confused for one another in the log. */
    console.error('[FATAL] no .env supplied DB_PASS. Tried: ' + CANDIDATES.join(', '));
    process.exit(78);
  }
  console.log('[env] loaded ' + envFile);

  const { runRollup } = require('./src/jobs/jmvMovementRollup');   // AFTER dotenv
  const includeDimensions = process.argv.includes('--include-dimensions');
  runRollup({ includeDimensions }).then(results => {
    results.forEach(r => {
      if (r.type === 'dimensions') {
        console.log('[dims]   upserted=' + r.upserted + (r.notes ? '  notes=' + r.notes : ''));
      } else if (r.error) {
        console.error('[ERROR]  ' + r.date + '  ' + r.error);
      } else {
        console.log('[' + r.date + ']  inserted=' + r.inserted + '  restocks=' + r.restocks +
          '  valid=' + r.isValid + (r.notes ? '  notes=' + r.notes : ''));
      }
    });
    process.exit(0);
  }).catch(err => {
    console.error('[FATAL]', err.message);
    process.exit(1);
  });
" $INCLUDE_DIMS >> "$LOG" 2>&1

EXIT=$?
set -e

echo "$(stamp) ── JMV rollup finished  exit=$EXIT ────────────────────────" >> "$LOG"
exit $EXIT
