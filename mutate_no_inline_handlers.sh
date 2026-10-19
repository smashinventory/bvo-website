#!/usr/bin/env bash
# mutate_no_inline_handlers.sh — prove gate_no_inline_handlers can FAIL.
#
# A gate first observed passing has never been shown to detect anything. This
# breaks the tree in ten specific ways, asserts the gate catches each one, and
# verifies the file is restored byte-identical afterwards.
#
# The two mutations that matter most are 3 and 4: a handler written by
# JavaScript, and the comment-ordering trap. Both were real bugs in the gate's
# own first draft — a markup-only scan reported shipping/create.ejs clean while
# selectRate was dead and no freight could be booked, and a comment containing
# the word "<script>" made the gate miss its own documentation.

set -u
cd "$(dirname "$0")" || exit 1

GATE="gates/gate_no_inline_handlers.js"
PASS=0; FAIL=0

# Files we mutate, with a backup each.
F_MARKUP="views/pages/admin/products.ejs"
F_JS="views/pages/admin/shipping/create.ejs"
F_PARTIAL="views/partials/admin/action-dispatch.ejs"
F_SERVER="src/server.js"

for f in "$F_MARKUP" "$F_JS" "$F_PARTIAL" "$F_SERVER"; do
  cp "$f" "$f.mutbak" || { echo "cannot back up $f"; exit 1; }
done

restore() { for f in "$F_MARKUP" "$F_JS" "$F_PARTIAL" "$F_SERVER"; do cp "$f.mutbak" "$f"; done; }
cleanup() { restore; rm -f "$F_MARKUP.mutbak" "$F_JS.mutbak" "$F_PARTIAL.mutbak" "$F_SERVER.mutbak"; }
trap cleanup EXIT

# green() asserts the gate currently PASSES; red() asserts it FAILS.
green() {
  if node "$GATE" >/dev/null 2>&1; then
    echo "  ok   $1"; PASS=$((PASS+1))
  else
    echo "  MISS $1 — gate failed when it should have passed"; FAIL=$((FAIL+1))
  fi
}
red() {
  if node "$GATE" >/dev/null 2>&1; then
    echo "  MISS $1 — GATE DID NOT CATCH IT"; FAIL=$((FAIL+1))
  else
    echo "  ok   $1"; PASS=$((PASS+1))
  fi
}

echo
echo "mutate_no_inline_handlers — can the gate fail?"
echo
echo "--- baseline ---"
green "clean tree passes"

echo
echo "--- markup handlers ---"

restore
python3 -c "
import io; p='$F_MARKUP'; s=io.open(p,encoding='utf-8').read()
s=s.replace('data-act=\"clearSel\"','onclick=\"clearSel()\"',1)
io.open(p,'w',encoding='utf-8').write(s)"
red "1. a single onclick= in markup"

restore
python3 -c "
import io; p='$F_MARKUP'; s=io.open(p,encoding='utf-8').read()
s=s.replace('data-act=\"submitForm\" data-on=\"change\"','onchange=\"this.form.submit()\"',1)
io.open(p,'w',encoding='utf-8').write(s)"
red "2. an onchange= in markup"

echo
echo "--- the blind spots the first draft had ---"

restore
python3 -c "
import io; p='$F_JS'; s=io.open(p,encoding='utf-8').read()
s=s.replace('data-act=\"selectRate\" data-a1=\\'+chr(39)+' + g.std +'+chr(39)+'\"',
            'onclick=\"selectRate('+chr(92)+chr(39)+'\\'+chr(39)+' + g.std +'+chr(39)+chr(92)+chr(39)+')\"',1)
io.open(p,'w',encoding='utf-8').write(s)" 2>/dev/null \
  || python3 -c "
import io,re; p='$F_JS'; s=io.open(p,encoding='utf-8').read()
s=re.sub(r'data-act=\"selectRate\"', 'onclick=\"selectRate()\" data-x=\"', s, count=1)
io.open(p,'w',encoding='utf-8').write(s)"
red "3. a handler built INSIDE a JS string (the selectRate case)"

restore
python3 -c "
import io; p='$F_PARTIAL'; s=io.open(p,encoding='utf-8').read()
# Put a live handler AFTER the header comment that mentions <script>.
s=s.replace('<script nonce=', '<button onclick=\"x()\"></button>'+chr(10)+'<script nonce=',1)
io.open(p,'w',encoding='utf-8').write(s)"
red "4. a handler after a comment containing the word script"

echo
echo "--- the detector's own exclusions must stay exclusions ---"

restore
python3 -c "
import io; p='$F_MARKUP'; s=io.open(p,encoding='utf-8').read()
s=s.replace('<%','<%# these were onclick=\"x()\" attributes once %>'+chr(10)+'<%',1)
io.open(p,'w',encoding='utf-8').write(s)"
green "5. onclick= inside an EJS comment stays ignored"

restore
python3 -c "
import io; p='$F_MARKUP'; s=io.open(p,encoding='utf-8').read()
s=s.replace('</body>','<div data-onclick=\"nope\"></div></body>',1) if '</body>' in s \
  else s.replace('<%','<div data-onclick=\"nope\"></div>'+chr(10)+'<%',1)
io.open(p,'w',encoding='utf-8').write(s)"
green "6. data-onclick= is not a handler"

echo
echo "--- the policy itself ---"

restore
# ⚠️ TARGET scriptSrcAttr BY NAME, not the first "'none'" in the file.
# The first draft did a plain replace of "'none'" with count=1 and hit
# objectSrc at line 325 instead — a different directive entirely. The gate
# was right and the MUTATION was wrong, which is the failure mode a harness
# is least likely to notice: it reported "GATE DID NOT CATCH IT" about a
# change the gate was never asked to catch. Anchor on the directive name.
python3 -c "
import io,re; p='$F_SERVER'; s=io.open(p,encoding='utf-8').read()
s2=re.sub(r'(scriptSrcAttr\s*:\s*\[)[^\]]*(\])', r'\1\"'+chr(39)+'unsafe-inline'+chr(39)+'\"\2', s, count=1)
assert s2!=s, 'mutation 7 did not apply — scriptSrcAttr not found'
io.open(p,'w',encoding='utf-8').write(s2)"
red "7. relaxing scriptSrcAttr to unsafe-inline is caught"

restore
python3 -c "
import io,re; p='$F_SERVER'; s=io.open(p,encoding='utf-8').read()
s=re.sub(r'scriptSrcAttr:\s*\[[^\]]*\],?', '', s, count=1)
io.open(p,'w',encoding='utf-8').write(s)"
red "8. removing scriptSrcAttr entirely is caught"

echo
echo "--- restoration ---"
restore
for f in "$F_MARKUP" "$F_JS" "$F_PARTIAL" "$F_SERVER"; do
  if cmp -s "$f" "$f.mutbak"; then
    echo "  ok   $f restored byte-identical"; PASS=$((PASS+1))
  else
    echo "  MISS $f NOT restored — fix before committing"; FAIL=$((FAIL+1))
  fi
done
green "9. tree is green again after restore"

echo
if [ "$FAIL" -eq 0 ]; then
  echo "mutate_no_inline_handlers: all $PASS assertions held, 0 missed"
  exit 0
else
  echo "mutate_no_inline_handlers: $FAIL MISSED of $((PASS+FAIL))"
  exit 1
fi
