#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# mutate_pending_bundle.sh — proves gate_pending_bundle.js catches the
# ways a signed-out bundle gets silently lost.
#
# M1 IS THE DANGEROUS ONE. Drop the key from establishSession's carry list
# and EVERYTHING still works: the 401 stashes, the redemption is wired, the
# sign-in succeeds. regenerate() just quietly destroys the bundle in
# between. No error, no log, and the customer sees the owner's exact bug
# report again. It is the same failure that emptied the cart in September
# and lost every offer claim before that.
#
# M2 is its twin: redemption moved BEFORE establishSession, reading a
# session that is about to be wiped.
#
# M6 restores the original defect verbatim — a bare 401 with no stash.
#
# Run from the repo root:  bash gates/mutate_pending_bundle.sh
# ═══════════════════════════════════════════════════════════════════════

set -uo pipefail
cd "$(dirname "$0")/.."

GATE=gates/gate_pending_bundle.js
A=src/controllers/accountController.js
B=src/controllers/bundleController.js
S=src/services/pendingBundle.js

for f in "$A" "$B" "$S"; do cp "$f" "$f.mutbak"; done
restore() { for f in "$A" "$B" "$S"; do [ -f "$f.mutbak" ] && mv -f "$f.mutbak" "$f"; done; }
trap restore EXIT INT TERM
resnap() { for f in "$A" "$B" "$S"; do cp "$f" "$f.mutbak"; done; }

MISSED=0; RAN=0

expect_red() {
  RAN=$((RAN+1))
  local label="$1" want="$2" out
  out="$(node "$GATE" 2>&1)"
  if echo "$out" | grep -q "ALL GATES PASS"; then
    echo "  MISSED  $label — GATE STILL PASSED"
    MISSED=$((MISSED+1))
  elif echo "$out" | grep -q "FAIL.*$want"; then
    echo "  caught  $label"
  else
    echo "  MISSED  $label — red, but not on \"$want\""
    echo "$out" | grep -E "FAIL|Error" | head -4 | sed 's/^/            /'
    MISSED=$((MISSED+1))
  fi
  restore; resnap
}

py() { python3 - "$1" "$2" "$3" <<'PY'
import sys
p, old, new = sys.argv[1], sys.argv[2], sys.argv[3]
s = open(p, encoding='utf-8').read()
assert old in s, "anchor missing in " + p
open(p, 'w', encoding='utf-8').write(s.replace(old, new, 1))
PY
}

echo "=== baseline ==="
if node "$GATE" >/dev/null 2>&1; then echo "  ok      baseline green"
else echo "  ABORT   baseline red"; node "$GATE" 2>&1 | grep FAIL; exit 1; fi

echo
echo "=== M1: key dropped from the carry list (THE silent killer) ==="
py "$A" "    [pendingBundle.PENDING_KEY]: req.session[pendingBundle.PENDING_KEY],
" ""
expect_red "M1 not carried through regenerate" "CARRIED THROUGH regenerate"

echo
echo "=== M2: redemption moved BEFORE establishSession ==="
python3 - "$A" <<'PY'
import sys,re
p=sys.argv[1]; s=open(p,encoding='utf-8').read()
call="    const _bundle = await pendingBundle.settle(req, customer.id);"
assert call in s, "M2 anchor missing"
s=s.replace(call,"",1)
# re-insert ahead of the FIRST establishSession call
i=s.index("        await establishSession(req, known, email);")
s=s[:i]+"        await pendingBundle.settle(req, known.id);\n"+s[i:]
# and remove the recognised-device one so settle never follows establish
s=s.replace("        await pendingBundle.settle(req, known.id);\n\n        const rt = req.body.return_to;","        const rt = req.body.return_to;",1)
open(p,'w',encoding='utf-8').write(s)
PY
expect_red "M2 settle before establishSession" "AFTER establishSession"

echo
echo "=== M3: only the code path redeems, device path forgotten ==="
py "$A" "        await pendingBundle.settle(req, known.id);
" ""
expect_red "M3 one path only" "BOTH sign-in paths redeem"

echo
echo "=== M4: an EMPTY bundle is allowed to become pending ==="
py "$S" "  const hasAnything = !!(row.cabinet_id || row.top_id || row.mirror_id || row.faucet_id);
  return hasAnything ? row : null;" "  return row;"
expect_red "M4 empty bundle accepted" "EMPTY bundle normalises to null"

echo
echo "=== M5: qty cap removed (attacker-supplied value) ==="
py "$S" "return Number.isInteger(n) && n > 0 ? Math.min(n, MAX_QTY) : 1;" "return Number.isInteger(n) && n > 0 ? n : 1;"
expect_red "M5 qty uncapped" "qty is capped"

echo
echo "=== M6: the original defect — bare 401, nothing stashed ==="
py "$B" "      pendingBundle.markPending(req, req.body);
" ""
expect_red "M6 no stash before 401" "stashes before answering 401"

echo
echo "=== M7: settle leaves the key behind on failure ==="
py "$S" "  const row = peek(req);
  clearPending(req);" "  const row = peek(req);"
expect_red "M7 key not cleared" "clears the key even when it cannot save"

echo
echo "=== M8: ?next= guard dropped (open redirect) ==="
py "$A" "  if (_next && /^\\/(?!\\/)/.test(_next)) req.session.returnTo = _next;" "  if (_next) req.session.returnTo = _next;"
expect_red "M8 open redirect" "rejects off-site"

echo
echo "─────────────────────────────────────────────"
if [ "$MISSED" -eq 0 ]; then
  echo "$RAN mutations, 0 missed — the pending-bundle gate is real."
  exit 0
else
  echo "$RAN mutations, $MISSED MISSED. Fix the gate."
  exit 1
fi
