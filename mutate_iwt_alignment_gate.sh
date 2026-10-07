#!/bin/bash
# Negative test for gate_iwt_alignment.js.
set -u
cd "$(dirname "$0")"
I=views/pages/index.ejs
C=public/css/site.css
B=public/css/site-bundle.css
# site2.css carries the overlay rule one mutation edits. It was missing
# from the backup list, so the harness mutated it and never put it back -
# the restore assertion caught that, which is exactly its job.
S2=public/css/site2.css
pass=0; fail=0
mutate () {
  cp "$I" /tmp/iw.i; cp "$C" /tmp/iw.c; cp "$B" /tmp/iw.b; cp "$S2" /tmp/iw.s2
  python3 - "$I" "$C" "$B" <<PY
import sys
ip,cp_,bp = sys.argv[1],sys.argv[2],sys.argv[3]
i=open(ip).read(); c=open(cp_).read(); b=open(bp).read()
$2
open(ip,'w').write(i); open(cp_,'w').write(c); open(bp,'w').write(b)
PY
  if [ $? -ne 0 ]; then echo "  SKIP $1 — mutation did not apply"; cp /tmp/iw.i "$I"; cp /tmp/iw.c "$C"; cp /tmp/iw.b "$B"; cp /tmp/iw.s2 "$S2"; fail=$((fail+1)); return; fi
  if node gates/gate_iwt_alignment.js >/dev/null 2>&1; then echo "  MISSED  $1"; fail=$((fail+1));
  else echo "  caught  $1"; pass=$((pass+1)); fi
  cp /tmp/iw.i "$I"; cp /tmp/iw.c "$C"; cp /tmp/iw.b "$B"; cp /tmp/iw.s2 "$S2"
  node gates/gate_iwt_alignment.js >/dev/null 2>&1 || { echo "  ABORT — restore failed"; exit 1; }
}

echo; echo "mutating the image+text alignment fix"; echo

mutate "the inline text-align comes back on the column (the original bug)" "
old = '<div class=\"iwt-text-col\">'
assert old in i
i = i.replace(old, '<div class=\"iwt-text-col\" style=\"text-align:center\">', 1)"

mutate "the section stops publishing the variables" "
assert 'style=\"<%= _iwtVars %>\"' in i
i = i.replace(' style=\"<%= _iwtVars %>\"', '', 1)"

mutate "the flex map drifts from the samples banner's" "
assert \"var _IWT_FLEX     = { left: 'flex-start', center: 'center', right: 'flex-end' };\" in i
i = i.replace(\"var _IWT_FLEX     = { left: 'flex-start', center: 'center', right: 'flex-end' };\",
              \"var _IWT_FLEX     = { left: 'start', center: 'center', right: 'end' };\")"

mutate "an unknown stored value is interpolated instead of falling back" "
assert \"_IWT_FLEX[_iwtTextAlign] ? _iwtTextAlign : 'left'\" in i
i = i.replace(\"_IWT_FLEX[_iwtTextAlign] ? _iwtTextAlign : 'left'\", '_iwtTextAlign')"

mutate "overlay mode stops resolving to center" "
assert \"_iwtIsOverlay ? 'center'\" in i
i = i.replace(\"_iwtIsOverlay ? 'center'\", \"_iwtIsOverlay ? 'left'\")"

mutate "the CSS stops reading the variables" "
old = 'align-items:var(--iwt-items,flex-start);gap:1.1rem;text-align:var(--iwt-text,left)'
assert old in c
c = c.replace(old, 'align-items:flex-start;gap:1.1rem;text-align:left')
b = b.replace(old, 'align-items:flex-start;gap:1.1rem;text-align:left')"

mutate "the fallbacks change, so a page without the vars would move" "
old = 'align-items:var(--iwt-items,flex-start);gap:1.1rem;text-align:var(--iwt-text,left)'
assert old in c
new = 'align-items:var(--iwt-items,center);gap:1.1rem;text-align:var(--iwt-text,center)'
c = c.replace(old, new); b = b.replace(old, new)"

mutate "site-bundle.css drifts from site.css" "
old = 'align-items:var(--iwt-items,flex-start)'
assert old in b
b = b.replace(old, 'align-items:var(--iwt-items,flex-end)')"

mutate "the samples banner desktop rule is repointed at --iwt-*" "
old = '.sb-banner .iwt-text-col{align-items:var(--sb-items,center);text-align:var(--sb-text,center)}'
assert old in c
c = c.replace(old, '.sb-banner .iwt-text-col{align-items:var(--iwt-items,center);text-align:var(--iwt-text,center)}')"

mutate "the overlay rule loses its second class and stops outranking the base" "
assert '.iwt-overlay-mode .iwt-text-col{' in open('public/css/site2.css').read()
s2 = open('public/css/site2.css').read().replace('.iwt-overlay-mode .iwt-text-col{', '.iwt-text-col-overlay-X{')
open('public/css/site2.css','w').write(s2)"

echo
echo "caught $pass, missed $fail"
if [ "$fail" -eq 0 ]; then echo "All $pass mutations detected. The gate can fail."
else echo "GATE HAS BLIND SPOTS"; exit 1; fi
