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
#   2. Set your DB password in the DB_PASS line below (keep on server, never in chat).
#   3. Add the cron line above in hPanel → Cron Jobs.
#   4. First run via "↺ Run Rollup" in /admin/marketing/jmv to seed historical dates.
# ═══════════════════════════════════════════════════════════════════════

set -euo pipefail

BASE=/home/u222311468/domains/slategrey-falcon-350174.hostingersite.com

# ── Database credentials (set DB_PASS — never paste into chat) ──────
export DB_HOST=127.0.0.1
export DB_USER=u222311468_Admin1
export DB_NAME=u222311468_BVO_website
export DB_PASS="YOUR_DB_PASSWORD_HERE"

# ── Data source paths ────────────────────────────────────────────────
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
  process.env.JMV_SNAPSHOTS_PATH = process.env.JMV_SNAPSHOTS_PATH;
  process.env.JMV_FEED_ARCHIVE   = process.env.JMV_FEED_ARCHIVE;
  const { runRollup, upsertDimensions } = require('./src/jobs/jmvMovementRollup');
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
