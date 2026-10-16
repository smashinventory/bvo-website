#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────
# mutate_process_safety.sh — negative test for gate_process_safety.js
#
# This gate protects a safety net. A net nobody has tried to tear is not
# known to hold, and the failure mode is the worst kind: everything looks
# fine until the day it is needed, which is the day the site goes down.
#
# Each mutation below removes or inverts part of the net in a way that
# would pass code review, then asserts the gate catches it.
# ─────────────────────────────────────────────────────────────────────────
set -uo pipefail
cd "$(dirname "$0")"

GATE=gates/gate_process_safety.js
SRV=src/server.js
DB=src/config/database.js
FILES=("$SRV" "$DB")

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
" 2>/tmp/mut_ps.err
  if [ $? -ne 0 ]; then
    echo "  SETUP-FAIL  $label  (the needle has drifted)"
    sed 's/^/              /' /tmp/mut_ps.err; MISS=$((MISS+1)); restore; return
  fi
  if node "$GATE" >/dev/null 2>&1; then
    echo "  MISSED      $label"; MISS=$((MISS+1))
  else
    echo "  caught      $label"; PASS=$((PASS+1))
  fi
  restore
}

echo "──── the net itself ────"
mutate "the unhandledRejection handler is removed entirely" "$SRV" '
i = s.index("process.on(\x27unhandledRejection\x27")
j = s.index("process.on(\x27uncaughtException\x27")
s = s[:i] + s[j:]
'

# The regression that matters most. Adding an exit here looks like tidying
# up - "be consistent with the other handler" - and silently restores the
# exact behaviour that caused the outage.
mutate "process.exit(1) creeps into unhandledRejection" "$SRV" '
i = s.index("process.on(\x27unhandledRejection\x27")
j = s.index("});", i) + 3
s = s[:j-3] + "  process.exit(1);\n" + s[j-3:]
'

mutate "uncaughtException stops exiting (alive but unsound)" "$SRV" '
s = s.replace("setTimeout(() => process.exit(1), 100).unref();", "/* no exit */")
'

mutate "the handlers move BELOW the requires" "$SRV" '
i = s.index("process.on(\x27unhandledRejection\x27")
j = s.index("const express")
block = s[i:j]
s = s[:i] + s[j:]
k = s.index("const app  = express();")
s = s[:k] + block + s[k:]
'

echo
echo "──── the logging that makes a recurrence diagnosable ────"
mutate "the [UNHANDLED] prefix is dropped" "$SRV" '
s = s.replace("[UNHANDLED] ", "")
'

mutate "the [FATAL] prefix is dropped" "$SRV" '
s = s.replace("[FATAL] ", "")
'

mutate "err.sql stops being printed" "$SRV" '
s = s.replace("if (err.sql)  console.error(\x27[UNHANDLED] sql: \x27 + String(err.sql).replace(/\\s+/g, \x27 \x27).slice(0, 500));", "")
'

# Without the flush delay the most important line is the one that is lost,
# because the process exits before stderr drains.
mutate "the flush delay is removed, so the FATAL log is lost on exit" "$SRV" '
s = s.replace("setTimeout(() => process.exit(1), 100).unref();", "process.exit(1);")
'

echo
echo "──── the query wrapper ────"
mutate "the wrapper is defined but never applied" "$DB" '
s = s.replace("attachSql(bvoPool, \x27bvo\x27);", "// attachSql(bvoPool, \x27bvo\x27);")
'

mutate "the wrapper stops attaching err.sql" "$DB" '
s = s.replace("err.sql  = typeof sql === \x27string\x27 ? sql : (sql && sql.sql) || String(sql);", "")
'

mutate "the wrapper throws a NEW error, losing the code/stack" "$DB" '
s = s.replace("        throw err;\n      });", "        throw new Error(err.message);\n      });", 1)
'

echo
echo "──── restore verification ────"
BAD=0
for f in "${FILES[@]}"; do
  if ! cmp -s "$f" "$TMP/$(echo "$f" | tr '/' '_')"; then echo "  NOT RESTORED: $f"; BAD=1; fi
done
[ "$BAD" = "0" ] && echo "  all ${#FILES[@]} files byte-identical to their backups"
if ! node "$GATE" >/dev/null 2>&1; then echo "  GATE RED AFTER RESTORE"; BAD=1; fi
[ "$BAD" = "0" ] && echo "  gate green again after restore"
rm -rf "$TMP"

echo
echo "caught $PASS, missed $MISS"
[ "$MISS" = "0" ] && [ "$BAD" = "0" ] || exit 1
