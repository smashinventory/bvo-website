#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────
# mutate_named_placeholders.sh — negative test for gate_named_placeholders.js
#
# This gate guards two opposite failures, and both are quiet:
#
#   · the flag creeps back onto the pool — the landmine returns for every
#     query in the app, and nothing breaks until someone writes a SQL
#     comment with a question mark in it, possibly months later
#
#   · the per-query option is dropped while :name placeholders remain — the
#     NIGHTLY JM FEED IMPORT STOPS, loudly, at 04:30 UTC, in a cron log
#     nobody is watching
#
# Neither shows up in a page load, which is exactly why they need a gate
# that has been proven able to fail.
# ─────────────────────────────────────────────────────────────────────────
set -uo pipefail
cd "$(dirname "$0")"

GATE=gates/gate_named_placeholders.js
DB=src/config/database.js
IMP=src/jobs/importJamesMartinFeed.js
FILES=("$DB" "$IMP" "$GATE")

TMP=$(mktemp -d)
for f in "${FILES[@]}"; do
  cp "$f" "$TMP/$(echo "$f" | tr '/' '_')" || { echo "BACKUP FAILED: $f"; exit 1; }
done
restore() {
  for f in "${FILES[@]}"; do
    cp "$TMP/$(echo "$f" | tr '/' '_')" "$f" || { echo "RESTORE FAILED: $f"; exit 1; }
  done
}

if ! node "$GATE" >/dev/null 2>&1; then
  echo "BASELINE IS RED — the gate fails on unmodified code. Fix that first."
  node "$GATE" | tail -20; restore; rm -rf "$TMP"; exit 1
fi
echo "baseline: gate passes on unmodified code"
echo

PASS=0; MISS=0
mutate() {
  local label="$1" file="$2" py="$3"
  python3 -I -c "
import io,sys
p=r'''$file'''
s=io.open(p,encoding='utf-8').read()
before=s
$py
if s==before:
    sys.stderr.write('MUTATION DID NOT APPLY\n'); sys.exit(2)
io.open(p,'w',encoding='utf-8').write(s)
" 2>/tmp/mut_np.err
  if [ $? -ne 0 ]; then
    echo "  SETUP-FAIL  $label  (the needle has drifted)"
    sed 's/^/              /' /tmp/mut_np.err; MISS=$((MISS+1)); restore; return
  fi
  if node "$GATE" >/dev/null 2>&1; then
    echo "  MISSED      $label"; MISS=$((MISS+1))
  else
    echo "  caught      $label"; PASS=$((PASS+1))
  fi
  restore
}

echo "──── failure 1: the flag creeps back onto the pool ────"
mutate "namedPlaceholders: true restored on bvoPool" "$DB" '
s = s.replace("  waitForConnections:   true,", "  namedPlaceholders:    true,\n  waitForConnections:   true,")
'

echo
echo "──── failure 2: the JM import loses its placeholders ────"
# The one that stops the nightly feed. Loud, but loud at 04:30 UTC.
mutate "the per-query option is dropped from upsertProduct" "$IMP" '
s = s.replace("await conn.query({ namedPlaceholders: true, sql: `", "await conn.query({ sql: `")
'

mutate "the option is passed as a THIRD ARGUMENT (no effect)" "$IMP" '
s = s.replace("await conn.query({ namedPlaceholders: true, sql: `", "await conn.query(`")
s = s.replace("  ` }, data);", "  `, data, { namedPlaceholders: true });")
'

mutate "the option stays but the :name placeholders are gone" "$IMP" '
s = s.replace(":sku,", ":removed_sku_marker,", 1)
'

echo
echo "──── the comment landmine itself ────"
# The literal 2026-10-16 bug, reintroduced where it would break the import.
mutate "a question mark appears in a SQL comment in the importer" "$IMP" '
s = s.replace("\n    INSERT INTO products (", "\n    /* which columns does the feed actually fill? */\n    INSERT INTO products (", 1)
'

mutate "a :token appears in a SQL comment in the importer" "$IMP" '
s = s.replace("\n    INSERT INTO products (", "\n    /* see :sku below */\n    INSERT INTO products (", 1)
'

echo
echo "──── the detector must not be neutered ────"
# If the comment scan cannot trip, the two checks above prove nothing.
mutate "the self-test fixture no longer trips the detector" "$GATE" '
s = s.replace("carry it back to us? */", "carry it back to us */")
'

echo
echo "──── restore verification ────"
BAD=0
for f in "${FILES[@]}"; do
  if ! cmp -s "$f" "$TMP/$(echo "$f" | tr '/' '_')"; then echo "  NOT RESTORED: $f"; BAD=1; fi
done
[ "$BAD" = "0" ] && echo "  all files byte-identical to their backups"
if ! node "$GATE" >/dev/null 2>&1; then echo "  GATE RED AFTER RESTORE"; BAD=1; fi
[ "$BAD" = "0" ] && echo "  gate green again after restore"
rm -rf "$TMP"

echo
echo "caught $PASS, missed $MISS"
[ "$MISS" = "0" ] && [ "$BAD" = "0" ] || exit 1
