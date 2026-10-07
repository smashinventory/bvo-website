#!/bin/bash
# Negative test for gate_button_templates.js.
set -u
cd "$(dirname "$0")"
U=src/utils/buttonStyles.js; S=src/services/themeSettings.js; L=views/layouts/main.ejs
pass=0; fail=0
mutate () {
  cp "$U" /tmp/t.u; cp "$S" /tmp/t.s; cp "$L" /tmp/t.l
  python3 - "$U" "$S" "$L" <<PY
import sys
up,sp,lp = sys.argv[1],sys.argv[2],sys.argv[3]
u=open(up).read(); s=open(sp).read(); l=open(lp).read()
$2
open(up,'w').write(u); open(sp,'w').write(s); open(lp,'w').write(l)
PY
  if [ $? -ne 0 ]; then echo "  SKIP $1 — mutation did not apply"; cp /tmp/t.u "$U"; cp /tmp/t.s "$S"; cp /tmp/t.l "$L"; fail=$((fail+1)); return; fi
  if node gates/gate_button_templates.js >/dev/null 2>&1; then echo "  MISSED  $1"; fail=$((fail+1));
  else echo "  caught  $1"; pass=$((pass+1)); fi
  cp /tmp/t.u "$U"; cp /tmp/t.s "$S"; cp /tmp/t.l "$L"
  node gates/gate_button_templates.js >/dev/null 2>&1 || { echo "  ABORT — restore failed"; exit 1; }
}

echo; echo "mutating the button template model"; echo

mutate "hover border-color emitted unconditionally (the 2px ring bug)" "
import re
assert re.search(r'const bord = t\.border !==', u)
u = re.sub(r'const bord = t\.border !== .transparent.', 'const bord = true', u, count=1)"

mutate "hover rules lose !important (dead on navy, sage, outline)" "
assert \"const imp = isLegacy(t.key) ? '!important' : '';\" in u
u = u.replace(\"const imp = isLegacy(t.key) ? '!important' : '';\", \"const imp = '';\")"

mutate "a seeded background frozen to a hex (brand edits stop reaching it)" "
assert \"bg:'var(--sage)'\" in s
s = s.replace(\"bg:'var(--sage)'\", \"bg:'#5A7A5A'\")"

mutate "amber hover switched to swap (loses the live brightness filter)" "
assert \"hover_bg:'#A87040', hover_fg:'#fff', hover_effect:'darken'\" in s
s = s.replace(\"hover_bg:'#A87040', hover_fg:'#fff', hover_effect:'darken'\",
              \"hover_bg:'#A87040', hover_fg:'#fff', hover_effect:'swap'\")"

mutate "a seeded border set to a colour (a ring appears today)" "
assert \"bg:'var(--navy)',  border:'transparent'\" in s
s = s.replace(\"bg:'var(--navy)',  border:'transparent'\", \"bg:'var(--navy)',  border:'#926A21'\")"

mutate "the value grammar opens up to any string" "
assert 'const SAFE_VALUE =' in u
import re
u = re.sub(r'const SAFE_VALUE = /\\^.*\\\$/;', 'const SAFE_VALUE = /^.*\$/;', u, count=1)"

mutate "the key grammar opens up (empty selectors become possible)" "
assert 'const SAFE_KEY =' in u
import re
u = re.sub(r'const SAFE_KEY = /\\^.*\\\$/;', 'const SAFE_KEY = /^.*\$/;', u, count=1)"

mutate "duplicate keys are no longer dropped" "
assert 'if (!n || seen.has(n.key)) continue;' in u
u = u.replace('if (!n || seen.has(n.key)) continue;', 'if (!n) continue;')"

mutate "a new template stops getting its own class" "
assert \"if (!isLegacy(t.key)) {\" in u
u = u.replace(\"if (!isLegacy(t.key)) {\", \"if (false) {\")"

mutate "--btn-radius no longer emitted (the shared corner goes dead again)" "
assert '--btn-radius: <%= _btnRadius %>;' in l
l = l.replace('--btn-radius: <%= _btnRadius %>;', '')"

mutate "the var block is not emitted at all" "
assert '<%- buttonVars %>' in l
l = l.replace('<%- buttonVars %>', '')"

mutate "a template is dropped from the seed" "
assert \"{ key:'primary', name:'Button 3\" in s
i = s.index(\"{ key:'primary', name:'Button 3\")
j = s.index(\"{ key:'amber'\", i)
s = s[:i] + s[j:]"

echo
echo "caught $pass, missed $fail"
if [ "$fail" -eq 0 ]; then echo "All $pass mutations detected. The gate can fail."
else echo "GATE HAS BLIND SPOTS"; exit 1; fi
