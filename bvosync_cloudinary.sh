#!/bin/bash
# ---------------------------------------------------------------------------
# ER Vanities -> BVO Cloudinary push wrapper.
#
# CREDENTIALS COME FROM .env, NOT FROM THIS FILE.
#
# gvssync_cloudinary.sh holds its key inline, and jmv_rollup.sh used to as well
# until 759f3e7 moved it to .env. That change happened for a reason worth not
# relearning: this file deploys from the repo, so a hardcoded secret at the
# domain root gets wiped every time the file is re-copied after a deploy — the
# exact "save line 37 first, then restore it" hazard. Reading .env means
# re-copying this script is always safe, and the secret never enters git.
#
# Add to hbuilds/config/.env (the same file the rollup reads):
#   CLOUDINARY_CLOUD_NAME=...
#   CLOUDINARY_API_KEY=...
#   CLOUDINARY_API_SECRET=...
#
#   ./bvosync_cloudinary.sh --dry-run                                what would go
#   ./bvosync_cloudinary.sh --only=Oxford --limit=5 --confirm-upload the pilot
#   ./bvosync_cloudinary.sh --confirm-upload                         the rest
#   ./bvosync_cloudinary.sh --report                                 journal, stop
#
# CRON — full paths only. Cron does not run from this directory.
#   0,30 * * * * /bin/bash /home/u222311468/domains/slategrey-falcon-350174.hostingersite.com/bvosync_cloudinary.sh --confirm-upload
#
# The host kills every process at 30 minutes, so the tool self-limits at 25 and
# resumes from its journal. DELETE THE CRON once --report shows 0 queued.
# ---------------------------------------------------------------------------
set -uo pipefail

BASE=/home/u222311468/domains/slategrey-falcon-350174.hostingersite.com
SYNC=$BASE/jmv_sync
LOG=$SYNC/logs/bvo_cloudinary.log

mkdir -p "$SYNC/logs" "$SYNC/state"
echo "=== $(date) ===" >> "$LOG" 2>&1

# --- locate .env ----------------------------------------------------------
# Same candidate list and same fail-loud behaviour as shipmentStatusPoll.js:
# cron does not inherit hPanel's injected variables, so the file on disk is the
# only source. Failing here with the paths named beats running with a blank key
# and reading 401 from Cloudinary.
ENV_FILE=""
for c in "$BASE/hbuilds/config/.env" \
         "$BASE/hbuilds/current/nodejs/.env" \
         "$BASE/.env"; do
    if [ -r "$c" ]; then ENV_FILE="$c"; break; fi
done

if [ -z "$ENV_FILE" ]; then
    {
      echo "FATAL: no readable .env found. Tried:"
      echo "  $BASE/hbuilds/config/.env"
      echo "  $BASE/hbuilds/current/nodejs/.env"
      echo "  $BASE/.env"
    } >> "$LOG" 2>&1
    echo "Exit: 78" >> "$LOG"
    exit 78
fi
echo "[env] loaded $ENV_FILE" >> "$LOG" 2>&1

# Read only the three keys we need. Parsed rather than sourced so a stray
# command in .env cannot execute, and so quoted values come out clean.
read_env() {
    sed -n "s/^[[:space:]]*$1[[:space:]]*=[[:space:]]*//p" "$ENV_FILE" \
      | tail -n 1 | sed -e 's/^["'\'']//' -e 's/["'\'']$//' -e 's/[[:space:]]*$//'
}
CLOUDINARY_CLOUD_NAME=$(read_env CLOUDINARY_CLOUD_NAME)
CLOUDINARY_API_KEY=$(read_env CLOUDINARY_API_KEY)
CLOUDINARY_API_SECRET=$(read_env CLOUDINARY_API_SECRET)
export CLOUDINARY_CLOUD_NAME CLOUDINARY_API_KEY CLOUDINARY_API_SECRET

# Name what is missing, but never echo a value.
MISSING=""
[ -z "$CLOUDINARY_CLOUD_NAME" ] && MISSING="$MISSING CLOUDINARY_CLOUD_NAME"
[ -z "$CLOUDINARY_API_KEY" ]    && MISSING="$MISSING CLOUDINARY_API_KEY"
[ -z "$CLOUDINARY_API_SECRET" ] && MISSING="$MISSING CLOUDINARY_API_SECRET"
if [ -n "$MISSING" ]; then
    echo "FATAL: missing in $ENV_FILE:$MISSING" >> "$LOG" 2>&1
    echo "Exit: 78" >> "$LOG"
    exit 78
fi

export BVO_MAP=$SYNC/state/ERV_cloudinary_map.csv
export BVO_JOURNAL=$SYNC/state/bvo_cloudinary_journal.csv

if [ ! -r "$BVO_MAP" ]; then
    echo "FATAL: map not found at $BVO_MAP" >> "$LOG" 2>&1
    echo "Exit: 66" >> "$LOG"
    exit 66
fi

/usr/bin/php "$SYNC/bvo_cloudinary_push.php" \
    --map="$BVO_MAP" \
    --journal="$BVO_JOURNAL" \
    --max-minutes=25 \
    "$@" >> "$LOG" 2>&1
echo "Exit: $?" >> "$LOG"
