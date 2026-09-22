#!/bin/bash
# ---------------------------------------------------------------------------
# ER Vanities use manuals -> BVO Cloudinary (raw PDFs).
#
# CREDENTIALS COME FROM .env, NOT FROM THIS FILE.
# Same reasoning as bvosync_cloudinary.sh: this script deploys from the repo,
# so a hardcoded secret gets wiped on every re-copy after a deploy. Reading
# .env means re-copying is always safe and the secret never enters git.
#
# The 23 PDFs must be on the server before this runs — unlike the images,
# Cloudinary cannot fetch them, so the bytes are POSTed from here.
# Put them in:  $SYNC/manuals/
#
#   ./bvosync_manuals.sh --dry-run                 what would go, with sizes
#   ./bvosync_manuals.sh --confirm-upload          the upload
#   ./bvosync_manuals.sh --report                  read journal, stop
#
# CRON — full paths only, leading slash on /bin/bash. Cron does not run from
# this directory, and `bin/bash` fails with "failed to run command".
#   0,30 * * * * /bin/bash /home/u222311468/domains/slategrey-falcon-350174.hostingersite.com/bvosync_manuals.sh --confirm-upload
#
# 23 files at ~2.7 MB each finishes well inside one run; the 25-minute
# self-limit and journal are there so a kill is survivable, not because it is
# expected. DELETE THE CRON once --report shows every row ok.
# ---------------------------------------------------------------------------
set -uo pipefail

BASE=/home/u222311468/domains/slategrey-falcon-350174.hostingersite.com
SYNC=$BASE/jmv_sync
LOG=$SYNC/logs/bvo_manuals.log

mkdir -p "$SYNC/logs" "$SYNC/state" "$SYNC/manuals"
echo "=== $(date) ===" >> "$LOG" 2>&1

# --- locate .env ----------------------------------------------------------
# Cron does not inherit hPanel's injected variables, so the file on disk is the
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

# Parsed rather than sourced, so a stray command in .env cannot execute and
# quoted values come out clean.
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

MAP=$SYNC/state/ERV_manual_map.csv
JOURNAL=$SYNC/state/bvo_manuals_journal.csv
DIR=$SYNC/manuals

if [ ! -r "$MAP" ]; then
    echo "FATAL: map not found at $MAP" >> "$LOG" 2>&1
    echo "Exit: 66" >> "$LOG"
    exit 66
fi

# Count the PDFs before starting. 23 expected; a short count means the transfer
# to $DIR did not finish, and the run would journal the gaps as 'missing'.
FOUND=$(find "$DIR" -maxdepth 1 -name '*.pdf' | wc -l)
echo "[dir] $FOUND pdf(s) in $DIR" >> "$LOG" 2>&1
if [ "$FOUND" -eq 0 ]; then
    echo "FATAL: no PDFs in $DIR — upload them there first" >> "$LOG" 2>&1
    echo "Exit: 66" >> "$LOG"
    exit 66
fi

/usr/bin/php "$SYNC/bvo_manuals_push.php" \
    --map="$MAP" \
    --journal="$JOURNAL" \
    --dir="$DIR" \
    --max-minutes=25 \
    "$@" >> "$LOG" 2>&1
echo "Exit: $?" >> "$LOG"
