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
echo "──── the 2026-10-16 correction: DB errors must not exit ────"
# THE regression. "Be consistent with the other branch" / "simplify the
# handler" both land here, and both restore the crash loop.
mutate "the DB carve-out is removed — every uncaught error exits again" "$SRV" '
s = s.replace("    return;                               // <- the whole point. No exit.", "    process.exit(1);")
'

mutate "isDatabaseError always returns false" "$SRV" '
s = s.replace("  if (isDatabaseError(err)) {", "  if (false) {")
'

# The opposite over-correction: never exiting for anything leaves a process
# that is alive but potentially unsound.
mutate "isDatabaseError always returns true (never exits for anything)" "$DB" '
s = s.replace("function isDatabaseError(err) {\n  if (!err) return false;", "function isDatabaseError(err) {\n  return true;\n  if (!err) return false;")
'

# The production error has no code and no sqlState - the stack test is the
# ONLY thing that identifies it.
mutate "the driver-stack test is dropped from isDatabaseError" "$DB" '
# chr(39)/chr(92) rather than typed quotes and backslashes: this needle is
# a regex literal full of both, and escaping it through bash single-quotes
# broke the whole script on the first attempt.
q = chr(39); b = chr(92)
old = "  return /node_modules[" + b + "/" + b + b + "](mysql2|named-placeholders)[" + b + "/" + b + b + "]/.test(String(err.stack || " + q + q + "));"
assert old in s, "needle drifted"
s = s.replace(old, "  return false;")
'

echo
echo "──── the recent-query ring ────"
mutate "queries are no longer recorded" "$DB" '
s = s.replace("    noteQuery(sql, label);\n", "")
'

mutate "the FATAL path stops printing the ring" "$SRV" '
q = chr(39)
s = s.replace("  _printRecentQueries(" + q + "[FATAL]" + q + ");" + chr(10), "")
'

mutate "the UNHANDLED-DB path stops printing the ring" "$SRV" '
q = chr(39)
s = s.replace("    _printRecentQueries(" + q + "[UNHANDLED-DB]" + q + ");" + chr(10), "")
'

echo
echo "──── the query wrapper ────"
mutate "the wrapper is defined but never applied" "$DB" '
s = s.replace("attachSql(bvoPool, \x27bvo\x27);", "// attachSql(bvoPool, \x27bvo\x27);")
'


mutate "tagError stops attaching err.sql" "$DB" '
s = s.replace("err.sql = sqlText(sql);", "")
'

mutate "only the ASYNC path tags — a sync throw goes unnamed" "$DB" '
# The named-placeholders failure can take the synchronous path. Tagging only
# the promise rejection is exactly the gap that left [FATAL] with no sql line.
s = s.replace("      throw tagError(err, sql, label);", "      throw err;", 1)
'

mutate "pooled connections are no longer wrapped" "$DB" '
q = chr(39)
s = s.replace("wrapQuery(conn, " + q + "bvo:conn" + q + "); conn.__sqlWrapped = true;", "")
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
