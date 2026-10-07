#!/bin/bash
# Negative test for gate_button_tokens.js. Each mutation breaks one claim.
set -u
cd "$(dirname "$0")"
BUN=public/css/site-bundle.css; S4=public/css/site4.css; LAY=views/layouts/main.ejs
pass=0; fail=0
mutate () {
  cp "$BUN" /tmp/b.bun; cp "$S4" /tmp/b.s4; cp "$LAY" /tmp/b.lay
  python3 - "$BUN" "$S4" "$LAY" <<PY
import sys
bp,sp,lp = sys.argv[1],sys.argv[2],sys.argv[3]
bun=open(bp,encoding='utf-8').read(); s4=open(sp,encoding='utf-8').read(); lay=open(lp,encoding='utf-8').read()
$2
open(bp,'w',encoding='utf-8').write(bun); open(sp,'w',encoding='utf-8').write(s4); open(lp,'w',encoding='utf-8').write(lay)
PY
  if [ $? -ne 0 ]; then echo "  SKIP $1 — mutation did not apply"; cp /tmp/b.bun "$BUN"; cp /tmp/b.s4 "$S4"; cp /tmp/b.lay "$LAY"; fail=$((fail+1)); return; fi
  if node gates/gate_button_tokens.js >/dev/null 2>&1; then echo "  MISSED  $1"; fail=$((fail+1));
  else echo "  caught  $1"; pass=$((pass+1)); fi
  cp /tmp/b.bun "$BUN"; cp /tmp/b.s4 "$S4"; cp /tmp/b.lay "$LAY"
  node gates/gate_button_tokens.js >/dev/null 2>&1 || { echo "  ABORT — restore failed"; exit 1; }
}

echo; echo "mutating the button token refactor"; echo

mutate "navy fg repointed at the brand white (would follow palette edits)" "
assert '--btn-navy-fg:#fff' in bun
bun = bun.replace('--btn-navy-fg:#fff', '--btn-navy-fg:var(--color-white)')"

mutate "sage bg frozen to a literal (brand edits stop reaching it)" "
assert '--btn-sage-bg:var(--sage)' in bun
bun = bun.replace('--btn-sage-bg:var(--sage)', '--btn-sage-bg:#5A7A5A')"

mutate "navy hover colour changed" "
assert '--btn-navy-hover-bg:#0e1e38' in bun
bun = bun.replace('--btn-navy-hover-bg:#0e1e38', '--btn-navy-hover-bg:#111111')"

mutate "a new variable removed entirely" "
assert ';--btn-sage-hover-bg:var(--sage-deep)' in bun
bun = bun.replace(';--btn-sage-hover-bg:var(--sage-deep)', '')"

mutate "the navy rule reverts to a hardcoded colour" "
old = '.btn-navy{background:var(--btn-navy-bg);color:var(--btn-navy-fg)}'
assert old in bun
bun = bun.replace(old, '.btn-navy{background:var(--navy);color:#fff}')"

mutate "site4 and the bundle drift apart" "
old = '.btn-sage:active,.btn-sage:hover{background:var(--btn-sage-hover-bg)!important;color:var(--btn-sage-fg)!important}'
assert old in s4
s4 = s4.replace(old, '.btn-sage:active,.btn-sage:hover{background:#486854!important;color:#fff!important}')"

mutate "cache bust not moved" "
assert 'site-bundle.css?v=43' in lay
lay = lay.replace('site-bundle.css?v=43', 'site-bundle.css?v=42')"

mutate "a duplicate base rule for navy sneaks in (would kill its variables)" "
old = '.btn-navy{background:var(--btn-navy-bg);color:var(--btn-navy-fg)}'
assert old in bun
bun = bun.replace(old, old + '.btn-navy{background:var(--navy)}')"

mutate "a duplicate amber base rule comes back (tokens go inert again)" "
old = '.btn-amber{background:var(--btn-amber-bg);color:var(--btn-amber-fg)}'
assert old in bun
bun = bun.replace(old, old + '.btn-amber{background:var(--amber);color:#fff}')"

mutate "the amber local --amber pin comes back (brand edits stop reaching it)" "
old = '.btn-amber{background:var(--btn-amber-bg);color:var(--btn-amber-fg)}'
assert old in bun
bun = bun.replace(old, old + '.btn-amber{--amber:#926A21}')"

mutate "amber bg frozen to a literal (brand edits stop reaching it)" "
assert '--btn-amber-bg:var(--amber)' in bun
bun = bun.replace('--btn-amber-bg:var(--amber)', '--btn-amber-bg:#926A21')"

mutate "outline fg repointed away from the original expression" "
assert '--btn-outline-fg:var(--navy)' in bun
bun = bun.replace('--btn-outline-fg:var(--navy)', '--btn-outline-fg:#1a2a44')"

mutate "outline background stops being transparent" "
assert '--btn-outline-bg:transparent' in bun
bun = bun.replace('--btn-outline-bg:transparent', '--btn-outline-bg:#fff')"

mutate "outline hover reverts to a hardcoded #fff" "
old = '.btn-outline:hover{background:var(--btn-outline-hover-bg);color:var(--btn-outline-hover-fg)}'
assert old in bun
bun = bun.replace(old, '.btn-outline:hover{background:var(--navy);color:#fff}')"

echo
echo "caught $pass, missed $fail"
if [ "$fail" -eq 0 ]; then echo "All $pass mutations detected. The gate can fail."
else echo "GATE HAS BLIND SPOTS"; exit 1; fi
