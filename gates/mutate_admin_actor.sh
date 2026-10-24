#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# mutate_admin_actor.sh — proves gate_admin_actor.js detects the real bug.
#
# M1 IS THE LIVE DEFECT RESTORED VERBATIM: delete the write and the audit
# trail silently records 'admin' for every action, forever, with nothing
# erroring. That is the state this repo shipped in until 2026-10-24.
#
# M2 AND M3 ARE THE ONES A GREP-BASED GATE WOULD MISS, and they are the
# reason this gate executes the login handler instead of reading it:
#   M2 moves the write BEFORE session.regenerate(), so the line is present,
#      greps fine, and is wiped a microsecond later.
#   M3 makes it an object, so the line is present, greps fine, and puts
#      '[object Object]' into fifteen database columns.
#
# Run from the repo root:  bash gates/mutate_admin_actor.sh
# ═══════════════════════════════════════════════════════════════════════

set -uo pipefail
cd "$(dirname "$0")/.."

GATE=gates/gate_admin_actor.js
A=src/controllers/adminController.js
T=src/controllers/tradeController.js

for f in "$A" "$T"; do cp "$f" "$f.mutbak"; done
restore() { for f in "$A" "$T"; do [ -f "$f.mutbak" ] && mv -f "$f.mutbak" "$f"; done; }
trap restore EXIT INT TERM
resnap() { for f in "$A" "$T"; do cp "$f" "$f.mutbak"; done; }

MISSED=0; RAN=0

expect_red() {
  RAN=$((RAN+1))
  local label="$1" want="$2" out
  out="$(node "$GATE" 2>&1)"
  if echo "$out" | grep -q "ALL GATES PASS"; then
    echo "  MISSED  $label — GATE STILL PASSED"
    MISSED=$((MISSED+1))
  elif echo "$out" | grep -q "FAIL  $want"; then
    echo "  caught  $label"
  else
    echo "  MISSED  $label — went red, but not on \"$want\""
    echo "$out" | grep -E "FAIL|CRASHED" | sed 's/^/            /'
    MISSED=$((MISSED+1))
  fi
  restore; resnap
}

echo "=== baseline ==="
if node "$GATE" >/dev/null 2>&1; then
  echo "  ok      baseline green"
else
  echo "  ABORT   baseline red"
  node "$GATE" 2>&1 | grep -E "FAIL|CRASHED"
  exit 1
fi

echo
echo "=== M1: the live defect — no write at all ==="
perl -0pi -e 's{\n *req\.session\.adminUser = validUser;}{}' "$A"
expect_red "M1 write deleted" "adminUser is set on the session"

echo
echo "=== M2: write moved BEFORE regenerate (greps fine, gets wiped) ==="
# python, not perl: the replacement contains `regenerate((err) => {`, an
# unbalanced brace, and perl's s{}{} delimiters require balanced braces.
# It dies with "Unknown regexp modifier", applies NOTHING, and the gate
# then passes — which looks exactly like a missed mutation. The assert
# below is what makes that failure loud instead of silent.
python3 - "$A" <<'PY'
import re, sys
p = sys.argv[1]
s = open(p, encoding='utf-8').read()
s, n1 = re.subn(r"\n *req\.session\.adminUser = validUser;", "", s, count=1)
assert n1 == 1, "M2: could not remove the post-regenerate write"
pat = re.compile(r"( *)(req\.session\.regenerate\(\(err\) => \{)")
s, n2 = pat.subn(lambda m: m.group(1) + "req.session.adminUser = validUser;\n" + m.group(1) + m.group(2), s, count=1)
assert n2 == 1, "M2: could not insert the pre-regenerate write"
open(p, 'w', encoding='utf-8').write(s)
PY
expect_red "M2 write before regenerate" "adminUser survives session.regenerate()"

echo
echo "=== M3: written as an OBJECT ('[object Object]' in 15 columns) ==="
perl -0pi -e "s{req\.session\.adminUser = validUser;}{req.session.adminUser = { email: validUser };}" "$A"
expect_red "M3 object not string" "adminUser is a primitive string, not an object"

echo
echo "=== M4: wrong value — hardcoded instead of ADMIN_USER ==="
perl -0pi -e "s{req\.session\.adminUser = validUser;}{req.session.adminUser = 'admin';}" "$A"
expect_red "M4 hardcoded value" "adminUser is the configured ADMIN_USER"

echo
echo "=== M5: a .email-shaped read reappears in tradeController ==="
perl -0pi -e "s{const who  = req\.session\?\.adminUser \|\| 'admin';}{const who  = (req.session.adminUser && req.session.adminUser.email) || 'admin';}" "$T"
expect_red "M5 object-shaped read returns" "no read treats adminUser as an object with .email"

echo
echo "=== M6: a SECOND write appears (two sources of truth for the actor) ==="
perl -0pi -e "s{(const who  = req\.session\?\.adminUser \|\| 'admin';)}{req.session.adminUser = 'someone-else';\n    \$1}" "$T"
expect_red "M6 second write" "adminUser is written in exactly one place"

echo
echo "=== M7: a failed login sets the actor anyway ==="
# ⚠️ THERE ARE TWO IDENTICAL `res.render('pages/admin/login'` CALLS — the
# GET form and the failed-login branch. An unanchored substitution hits the
# GET one, which this gate never exercises, so the mutation applies and
# changes nothing observable. Anchor on `error: 'Invalid`, which only the
# failed-login branch has. Same family as every loose-match hole in
# SESSION_HANDOFF §6: the pattern matched something ADJACENT to the target.
# python, not perl: the replacement text contains an unbalanced `{`, and
# perl's s{}{} delimiters require balanced braces — it dies with a
# misleading "Unknown regexp modifier" and applies nothing.
python3 - "$A" <<'PY'
import re, sys
p = sys.argv[1]
s = open(p, encoding='utf-8').read()
# Only the failed-login branch carries error: 'Invalid — the GET form has
# error: null and is never exercised by this gate.
pat = re.compile(r"( *)(res\.render\('pages/admin/login', \{)(?=[\s\S]{0,200}?error: 'Invalid)")
s2, n = pat.subn(lambda m: m.group(1) + "req.session.adminUser = validUser;\n" + m.group(1) + m.group(2), s, count=1)
assert n == 1, f"M7 matched {n} sites, expected 1"
open(p, 'w', encoding='utf-8').write(s2)
PY
[ "$(grep -c 'adminUser = validUser' "$A")" = "2" ] \
  || { echo "  ABORT  M7 did not apply to the failed-login branch"; exit 1; }
expect_red "M7 actor set on failed login" "a wrong password sets no actor"

echo
echo "─────────────────────────────────────────────"
if [ "$MISSED" -eq 0 ]; then
  echo "$RAN mutations, 0 missed — the actor gate is real."
  exit 0
else
  echo "$RAN mutations, $MISSED MISSED. Fix the gate before trusting it."
  exit 1
fi
