#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────
# mutate_session_identity.sh — negative test for gate_session_identity.js
#
# The session-inflation bug shipped and ran for weeks. It produced a number
# on a dashboard every day, and the number was 40x wrong. Nothing failed, no
# log line appeared, and it was found only by someone comparing the tile
# against GA4 by hand.
#
# That is the precise class of defect a gate is for, and the precise class
# of gate that is worth nothing unless it has been proven able to fail. Each
# mutation below reintroduces the bug, or a near relative of it, in a form
# that would pass code review. Any MISSED line is a hole.
#
# Mutations are grouped by what they attack:
#   1. the collapse itself   — put the per-request id back
#   2. the discrimination    — collapse too much, hiding real traffic
#   3. the rollover          — let the bucket run forever, or reset per-request
#   4. bot detection         — make it trust the user-agent again
#   5. privacy               — put the raw IP in the column
#   6. the test seam         — remove the handle the gate executes through
#   7. the dashboard half    — count rows instead of sessions
#   8. the self-heal         — let the new column miss existing installs
#   9. the backfill          — make it destructive, or silent
# ─────────────────────────────────────────────────────────────────────────
set -uo pipefail
cd "$(dirname "$0")"

GATE=gates/gate_session_identity.js
SVC=src/services/siteEvents.js
CTRL=src/controllers/siteAnalyticsController.js

# Every file any mutation touches MUST be listed here. On the order-delete
# harness two mutations edited a file that was missing from this list and the
# run left the repo dirty; the restore assertion at the bottom was the only
# thing that surfaced it.
FILES=("$SVC" "$CTRL")

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
  node "$GATE" | tail -20
  restore; rm -rf "$TMP"; exit 1
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
" 2>/tmp/mut_sess.err
  if [ $? -ne 0 ]; then
    echo "  SETUP-FAIL  $label  (the mutation did not apply — the needle has drifted)"
    sed 's/^/              /' /tmp/mut_sess.err
    MISS=$((MISS+1)); restore; return
  fi
  if node "$GATE" >/dev/null 2>&1; then
    echo "  MISSED      $label"; MISS=$((MISS+1))
  else
    echo "  caught      $label"; PASS=$((PASS+1))
  fi
  restore
}

echo "──── 1. the collapse itself: putting the bug straight back ────"
# The literal regression. This is the line that was live on 2026-10-15.
mutate "session_id reverts to the raw express-session id" "$SVC" '
s = s.replace("        sessionKey(req),", "        clip(req && req.sessionID, 128),")
'

# The sneakier version: sessionKey is still called, but it no longer does
# anything. This is what a "simplification" refactor actually looks like.
mutate "sessionKey hollowed out to return the raw id" "$SVC" '
s = s.replace("  if (isStateful(req)) return clip(req && req.sessionID, 128);\n  return syntheticSessionId(req);",
              "  return clip(req && req.sessionID, 128);")
'

# isStateful always true routes everyone down the raw-id path.
mutate "isStateful always true — every client keeps its minted id" "$SVC" '
s = s.replace("  return sess.isNew === false;", "  return true;")
'

# An undefined isNew treated as stateful. This is the one that would really
# happen: express-session changes shape, isNew goes missing, and a truthiness
# test quietly readmits every cookieless client.
mutate "isStateful uses !isNew, so a missing isNew counts as stateful" "$SVC" '
s = s.replace("  return sess.isNew === false;", "  return !sess.isNew;")
'

echo
echo "──── 2. the discrimination: collapsing too much ────"
# The opposite failure, and the more dangerous one to ship: a constant key
# means ALL traffic reads as one session and the funnel looks dead rather
# than inflated. Nobody would believe 15,463; plenty of people would believe 1.
mutate "the synthetic key is a constant — all traffic becomes one session" "$SVC" '
i = s.index("function syntheticSessionId(req) {")
j = s.index("\n}", i) + 2
s = s[:i] + "function syntheticSessionId(req) {\n  return \"anon-fixed\";\n}\n" + s[j:]
'

mutate "the IP is dropped from the key — one NAT becomes one session" "$SVC" '
q = chr(39)
s = s.replace(".update(ip + " + q + "|" + q, ".update(" + q + q + " + " + q + "|" + q)
'

mutate "the user-agent is dropped from the key" "$SVC" '
q = chr(39)
s = s.replace("(h[" + q + "user-agent" + q + "] || " + q + q + ")", "(" + q + q + ")", 1)
'

# Stateful clients routed into the synthetic bucket merges distinct people.
mutate "stateful clients also get the synthetic key" "$SVC" '
s = s.replace("  if (isStateful(req)) return clip(req && req.sessionID, 128);\n  return syntheticSessionId(req);",
              "  return syntheticSessionId(req);")
'

echo
echo "──── 3. the rollover ────"
# No date: the bucket accumulates for the life of the table, the daily chart
# flattens, and a return visitor is never a second session.
mutate "the day is dropped from the key — the bucket never rolls over" "$SVC" '
s = s.replace("const day = new Date().toISOString().slice(0, 10);", "const day = \"static\";")
'

# A timestamp instead of a date restores the per-request inflation exactly,
# while still looking like a rollover.
mutate "a full timestamp is used instead of a date — inflation returns" "$SVC" '
s = s.replace("new Date().toISOString().slice(0, 10)", "new Date().toISOString()")
'

echo
echo "──── 4. bot detection trusting the user-agent again ────"
mutate "the header heuristic is removed — UA regex only" "$SVC" '
s = s.replace("  return headersLookAutomated(req);", "  return false;")
'

mutate "headersLookAutomated always false" "$SVC" '
q = chr(39)
s = s.replace("  return !h[" + q + "accept-language" + q + "] && !h[" + q + "accept-encoding" + q + "];",
              "  return false;")
'

# OR instead of AND. Reads almost identically and is a false-positive machine:
# it would start discarding real visitors who omit Accept-Language.
mutate "headersLookAutomated uses OR — real browsers get flagged as bots" "$SVC" '
q = chr(39)
old = "  return !h[" + q + "accept-language" + q + "] && !h[" + q + "accept-encoding" + q + "];"
s = s.replace(old, old.replace("&&", "||"))
'

mutate "an absent user-agent is no longer a bot" "$SVC" '
s = s.replace("  if (!ua) return true;", "  if (!ua) return false;")
'

mutate "the HTTP-library names drop out of the regex" "$SVC" '
# chr(92) rather than a typed backslash: the regex contains java\/ and the
# number of escapes needed to carry one backslash through bash, python -c and
# a python string literal is a reliable way to get this silently wrong.
s = s.replace("|scrapy|httpclient|java" + chr(92) + "/|go-http|okhttp", "")
'

mutate "Scrapy alone drops out of the regex" "$SVC" '
s = s.replace("|scrapy|", "|")
'

mutate "okhttp alone drops out of the regex" "$SVC" '
s = s.replace("|okhttp|", "|")
'

echo
echo "──── 5. privacy ────"
# The hash replaced by the thing it exists to avoid. A real visitor IP in a
# column nobody thinks of as personal data is how a privacy incident starts.
mutate "the IP goes into the key unhashed" "$SVC" '
i = s.index("  const hash = crypto.createHash(")
j = s.index("\n  return", i)
s = s[:i] + "  const hash = ip + day;" + s[j:]
'

echo
echo "──── 6. the test seam ────"
# Without the seam the gate degrades to grepping, which is exactly what
# failed to catch this bug the first time. The gate must notice its own
# instrument being removed.
mutate "__sessionInternals removed from the exports" "$SVC" '
s = s.replace("  __sessionInternals: {", "  _notTheSeam: {")
'

mutate "sessionKey dropped from the seam" "$SVC" '
s = s.replace("__sessionInternals: { sessionKey, syntheticSessionId,", "__sessionInternals: { syntheticSessionId,")
'

echo
echo "──── 7. the dashboard half ────"
# Collapsing the ids is pointless if the query starts counting rows. Either
# change alone re-inflates the tile, which is why both halves are gated here.
mutate "the funnel counts raw rows instead of distinct sessions" "$CTRL" '
s = s.replace("COUNT(DISTINCT CASE WHEN event_name = \"view_item\"      THEN session_id END)".replace(chr(34), chr(39)),
              "COUNT(CASE WHEN event_name = \"view_item\" THEN 1 END)".replace(chr(34), chr(39)))
'

mutate "add_to_cart counts rows instead of sessions" "$CTRL" '
s = s.replace("COUNT(DISTINCT CASE WHEN event_name = \"add_to_cart\"    THEN session_id END)".replace(chr(34), chr(39)),
              "COUNT(CASE WHEN event_name = \"add_to_cart\" THEN 1 END)".replace(chr(34), chr(39)))
'

mutate "the funnel stops excluding bots" "$CTRL" '
s = s.replace("     WHERE is_bot = 0\n       AND occurred_at", "     WHERE 1 = 1\n       AND occurred_at")
'

# daily() feeds the chart under the tile. Breaking only daily() left the first
# draft of the gate green, because its regexes matched funnel() instead.
mutate "daily() counts rows instead of sessions" "$CTRL" '
q = chr(39)
s = s.replace("COUNT(DISTINCT CASE WHEN event_name = " + q + "view_item" + q + "   THEN session_id END)",
              "COUNT(CASE WHEN event_name = " + q + "view_item" + q + " THEN 1 END)")
'

mutate "daily() stops excluding bots" "$CTRL" '
s = s.replace("      WHERE is_bot = 0\n        AND occurred_at >= DATE_SUB(CURDATE()",
              "      WHERE 1 = 1\n        AND occurred_at >= DATE_SUB(CURDATE()")
'

echo
echo "──── 8. the regressions that caused the two outages ────"
# The column was never read by any query, and its ALTER took a page down.
mutate "the stateful column comes back" "$SVC" '
s = s.replace("      is_bot       TINYINT(1)   NOT NULL DEFAULT 0,", "      is_bot       TINYINT(1)   NOT NULL DEFAULT 0,\n      stateful     TINYINT(1)   NOT NULL DEFAULT 0,")
'

mutate "an ALTER TABLE comes back" "$SVC" '
q = chr(39)
s = s.replace("  _ready = true;", "  await bvoPool.query(" + q + "ALTER TABLE site_events ADD COLUMN stateful TINYINT(1) NOT NULL DEFAULT 0" + q + ");\n  _ready = true;")
'

# THE one. A single character in a comment, which killed the process on every
# boot and was invisible to every static search we ran.
mutate "a question mark reappears in a SQL comment" "$SVC" '
s = s.replace("      is_bot       TINYINT(1)   NOT NULL DEFAULT 0,", "      /* is this one a bot? */\n      is_bot       TINYINT(1)   NOT NULL DEFAULT 0,", 1)
'

mutate "a question mark in a comment anywhere in the file" "$SVC" '
s = s.replace("/* Deliberately coarse.", "/* Deliberately coarse. Why?", 1)
'

echo
echo "──── restore verification ────"
BAD=0
for f in "${FILES[@]}"; do
  if ! cmp -s "$f" "$TMP/$(echo "$f" | tr '/' '_')"; then
    echo "  NOT RESTORED: $f"; BAD=1
  fi
done
[ "$BAD" = "0" ] && echo "  all ${#FILES[@]} files byte-identical to their backups"
if ! node "$GATE" >/dev/null 2>&1; then
  echo "  GATE RED AFTER RESTORE — the tree is dirty, check the files above"; BAD=1
fi
[ "$BAD" = "0" ] && echo "  gate green again after restore"
rm -rf "$TMP"

echo
echo "caught $PASS, missed $MISS"
[ "$MISS" = "0" ] && [ "$BAD" = "0" ] || exit 1
