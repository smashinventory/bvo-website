#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# bundle_catalogue.sh — nightly bundle-builder catalogue build
# ───────────────────────────────────────────────────────────────────────
# Runs the six catalogue queries once and stores the result in
# bundle_catalogue. The page then reads one row instead of rebuilding.
#
# CRON (hPanel → Cron Jobs, UTC):
#   30 6 * * *   /bin/bash /home/u222311468/domains/slategrey-falcon-350174.hostingersite.com/bundle_catalogue.sh
#
# Timing — the feed chain this has to sit behind:
#   04:30 UTC  jmsync.sh          JM feed → BVO DB
#   04:59 UTC  gvssync.sh         mirror
#   05:30 UTC  jmv_rollup.sh      movement rollup
#   06:30 UTC  bundle_catalogue.sh  ← this  (02:30 US Eastern)
#
# The two-hour gap after jmsync is not padding. This reads products,
# product_attribute_values and product_components — all of which jmsync
# rewrites. Running mid-import snapshots a half-written catalogue, and
# while the writer refuses to store an EMPTY one it cannot detect a
# merely INCOMPLETE one. That would sit wrong for a whole day.
#
# Typical run: a few seconds. Hostinger's process kill limit is 30 min.
#
# SETUP — before first run:
#   1. Copy this file to the server root:
#      /home/u222311468/domains/slategrey-falcon-350174.hostingersite.com/bundle_catalogue.sh
#      Plain copy. Nothing to edit — no credentials live in this file.
#   2. Add the cron line above in hPanel → Cron Jobs.
#
# NO CREDENTIALS HERE, same as jmv_rollup.sh. DB credentials are read from
# the app's own .env inside the node call, so the deployed copy and this
# one are byte identical and a file drop needs no follow-up edit. The
# earlier pattern — exporting DB_PASS inline — meant two copies differing
# by one line, and forgetting to re-paste it produced a failure visible
# only in a log nobody was reading.
#
# node-cron inside server.js fires the same job at 06:30 UTC. Both exist
# on purpose: the timer only fires if the app is awake, and this wrapper
# only fires if cron can find node. Neither alone is reliable here.
# ═══════════════════════════════════════════════════════════════════════

set -uo pipefail

BASE=/home/u222311468/domains/slategrey-falcon-350174.hostingersite.com

LOG_DIR=$BASE/jmv_sync/logs
mkdir -p "$LOG_DIR"
LOG=$LOG_DIR/bundle-catalogue.log

# Rotate at 5 MB
if [ -f "$LOG" ] && [ "$(stat -c%s "$LOG" 2>/dev/null || echo 0)" -gt 5242880 ]; then
  mv "$LOG" "${LOG}.1"
fi

stamp() { date -u '+%Y-%m-%dT%H:%M:%SZ'; }

echo "$(stamp) ── bundle catalogue build started ─────────────────────" >> "$LOG"

cd "$BASE/hbuilds/current/nodejs" || {
  echo "$(stamp) ERROR: app directory missing" >> "$LOG"; exit 66; }

# ── Locate node ─────────────────────────────────────────────────────
# Cron's PATH does not include node, so a bare `node` call exits 127.
# The first candidate is the one this server actually uses — note it is
# root/bin/node, NOT root/usr/bin/node. Copied from jmv_rollup.sh, where
# this exact list was arrived at the hard way.
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
    echo "$(stamp) ── bundle catalogue finished  exit=127 ────────────────"
  } >> "$LOG"
  exit 127
fi

echo "$(stamp) using node: $NODE" >> "$LOG"

"$NODE" -e "
  /* ── Load DB credentials ──────────────────────────────────────────
     ORDER IS LOAD-BEARING. config/database.js builds the pool at module
     top level and bundleController requires it at ITS top level, so by
     the time the require below returns the pool already exists. dotenv
     MUST run first or the pool is created with a blank password.

     Do not move the require above this block.

     hPanel writes hbuilds/config/.env and injects those vars into the
     managed app process. Cron does NOT inherit that injection, hence
     reading the file explicitly. */
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
    /* 78 is EX_CONFIG and means precisely 'no file supplied DB_PASS'.
       A WRONG password surfaces as a driver error instead, so the two
       are never confused in the log. */
    console.error('[FATAL] no .env supplied DB_PASS. Tried: ' + CANDIDATES.join(', '));
    process.exit(78);
  }
  console.log('[env] loaded ' + envFile);

  const { runBundleCatalogueBuild } = require('./src/jobs/buildBundleCatalogue');
  runBundleCatalogueBuild('cron').then(r => {
    if (r.ok) { console.log('[bundle-cron] ok in ' + r.ms + 'ms'); process.exit(0); }
    console.error('[bundle-cron] FAILED after ' + r.ms + 'ms: ' + r.error);
    process.exit(1);
  });
" >> "$LOG" 2>&1

EXIT=$?

echo "$(stamp) ── bundle catalogue finished  exit=$EXIT ──────────────" >> "$LOG"
exit $EXIT
