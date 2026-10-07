#!/bin/bash
# Negative test for gate_button_templates.js.
set -u
cd "$(dirname "$0")"
U=src/utils/buttonStyles.js; S=src/services/themeSettings.js; L=views/layouts/main.ejs
B=public/css/site-bundle.css
I=views/pages/index.ejs
T=views/pages/admin/theme.ejs
A=src/controllers/adminController.js
pass=0; fail=0
mutate () {
  cp "$U" /tmp/t.u; cp "$S" /tmp/t.s; cp "$L" /tmp/t.l; cp "$B" /tmp/t.b; cp "$I" /tmp/t.i; cp "$T" /tmp/t.t; cp "$A" /tmp/t.a
  python3 - "$U" "$S" "$L" "$T" "$A" <<PY
import sys
up,sp,lp,tp,ap = sys.argv[1],sys.argv[2],sys.argv[3],sys.argv[4],sys.argv[5]
u=open(up).read(); s=open(sp).read(); l=open(lp).read(); t=open(tp).read(); a=open(ap).read()
$2
open(up,'w').write(u); open(sp,'w').write(s); open(lp,'w').write(l); open(tp,'w').write(t); open(ap,'w').write(a)
PY
  if [ $? -ne 0 ]; then echo "  SKIP $1 — mutation did not apply"; cp /tmp/t.u "$U"; cp /tmp/t.s "$S"; cp /tmp/t.l "$L"; cp /tmp/t.b "$B"; cp /tmp/t.i "$I"; cp /tmp/t.t "$T"; cp /tmp/t.a "$A"; fail=$((fail+1)); return; fi
  if node gates/gate_button_templates.js >/dev/null 2>&1; then echo "  MISSED  $1"; fail=$((fail+1));
  else echo "  caught  $1"; pass=$((pass+1)); fi
  cp /tmp/t.u "$U"; cp /tmp/t.s "$S"; cp /tmp/t.l "$L"; cp /tmp/t.b "$B"; cp /tmp/t.i "$I"; cp /tmp/t.t "$T"; cp /tmp/t.a "$A"
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

mutate "the winning .btn rule hardcodes a radius again" "
import re
b=open('public/css/site-bundle.css').read()
assert 'border-radius:var(--btn-radius)' in b
b=b.replace('padding:.7rem 1.6rem;border-radius:var(--btn-radius)', 'padding:.7rem 1.6rem;border-radius:5px')
open('public/css/site-bundle.css','w').write(b)"

mutate "buttons.radius reverts to the dead 6px" "
assert \"radius: '5px',\" in s
s = s.replace(\"radius: '5px',\", \"radius: '6px',\")"

mutate "buttons.templates dropped from ARRAY_PREFIXES (deletion silently fails)" "
assert chr(39)+'buttons.templates['+chr(39)+',' in a
a = a.replace(chr(39)+'buttons.templates['+chr(39)+',', '')"

mutate "the array is no longer assigned wholesale" "
assert 'settings.buttons.templates = buttonTemplates' in a
a = a.replace('settings.buttons.templates = buttonTemplates', 'void 0')"

mutate "the length guard goes, so an empty post wipes every style" "
assert 'if (buttonTemplates.length) {' in a
a = a.replace('if (buttonTemplates.length) {', 'if (true) {')"

mutate "the built-in five become deletable" "
import re
assert re.search(r'_locked\s*=\s*\[', t)
t = re.sub(r'_locked\s*=\s*\[[^\]]*\]', '_locked = []', t, count=1)"

mutate "colour slots revert to a raw colour input (brand links get severed)" "
assert 'teBtnColor(' in t
t = t.replace('teBtnColor(n + ', 'teColor(n + ')"

mutate "the renumbering after a delete is removed" "
assert 'function renumber()' in t
t = t.replace('function renumber()', 'function renumberDISABLED()')"

mutate "the Add prototype is dropped" "
assert 'id=' + chr(34) + 'btnTemplateProto' + chr(34) in t
t = t.replace('id=' + chr(34) + 'btnTemplateProto' + chr(34), 'id=' + chr(34) + 'gone' + chr(34))"

mutate "a hero CTA loses its fallback (an unset style would restyle it)" "
import re
assert \"btnClass(hero.cta2_style, 'btn-sage')\" in open('views/pages/index.ejs').read()
x=open('views/pages/index.ejs').read()
x=x.replace(\"btnClass(hero.cta2_style, 'btn-sage')\", 'btnClass(hero.cta2_style)')
open('views/pages/index.ejs','w').write(x)"

mutate "the hero fallback is changed to the wrong class" "
x=open('views/pages/index.ejs').read()
assert \"btnClass(hero.cta1_style, 'btn-navy')\" in x
x=x.replace(\"btnClass(hero.cta1_style, 'btn-navy')\", \"btnClass(hero.cta1_style, 'btn-amber')\")
open('views/pages/index.ejs','w').write(x)"

mutate "a deleted template no longer falls back (section renders unstyled)" "
assert 'return list(settings).some' in u
u = u.replace('return list(settings).some(t => t.key === k) ? ' + chr(39) + 'btn--' + chr(39) + ' + k : fallback;',
              'return ' + chr(39) + 'btn--' + chr(39) + ' + k;')"

# The delegated call was btnClass(v, 'btn-navy') until Wave 1 gave callers
# their own fallback. This mutation went on asserting the OLD literal was
# present - which it still was, inside _btnClass's comment - so the replace
# matched nothing, the gate passed, and the harness reported a MISS for a
# mutation that had never been applied. Anchored on the live text now.
mutate "_btnClass goes back to its own four-key map" "
x=open('views/pages/index.ejs').read()
assert 'btnClass(v, fb)' in x
x=x.replace('btnClass(v, fb)', \"'btn-' + ({navy:1,sage:1,amber:1,outline:1}[v] ? v : 'navy')\")
open('views/pages/index.ejs','w').write(x)"

mutate "the style dropdowns are removed from the hero panel" "
import re
assert \"teButtonStyle('hero.cta1_style'\" in t
t = re.sub(r'<%- teButtonStyle\([^\n]*\n', '', t)"

mutate "cta1_style default stops being the empty sentinel" "
assert \"cta1_style:          ''\" in s
s = s.replace(\"cta1_style:          ''\", \"cta1_style:          'amber'\")"

mutate "the bespoke deferred-only button comes back" "
x=open('views/pages/index.ejs').read()
assert '_btnClass(_ip.btn_style)' in x
x=x.replace('class=\"<%= _btnClass(_ip.btn_style) %>\"', 'class=\"hp-inspo-browse-btn\"')
open('views/pages/index.ejs','w').write(x)"

mutate "inspiration.btn_style default changed off Button 1" "
assert \"btn_style:        'navy',\" in s
s = s.replace(\"btn_style:        'navy',\", \"btn_style:        'amber',\")"

mutate "the inspiration style picker is removed" "
import re
assert \"teButton('inspiration'\" in t
t = re.sub(r'<%- teButton\(.inspiration.[^\n]*\n', '', t)"

echo; echo "mutating Wave 1 - the ten section CTAs"; echo

mutate "featured_section default flipped off the outline it renders today" "
assert \"cta_url: '/collections/bathroom-vanities',\n    cta_style: 'outline',\" in s
s = s.replace(\"cta_style: 'outline',\", \"cta_style: 'navy',\", 1)"

mutate "newsletter default flipped off the amber it renders today" "
assert \"cta_style: 'amber',\" in s
s = s.replace(\"cta_style: 'amber',\", \"cta_style: 'navy',\")"

mutate "parallax CTA 2 default flipped off outline" "
assert \"cta1_style: 'amber', cta2_style: 'outline',\" in s
s = s.replace(\"cta1_style: 'amber', cta2_style: 'outline',\",
              \"cta1_style: 'amber', cta2_style: 'amber',\", 1)"

mutate "a call site drops its fallback entirely" "
x=open('views/pages/index.ejs').read()
assert \"_btnClass(_d.cta_style, 'btn-outline')\" in x
x=x.replace(\"_btnClass(_d.cta_style, 'btn-outline')\", '_btnClass(_d.cta_style)')
open('views/pages/index.ejs','w').write(x)"

mutate "a call site keeps a fallback but the WRONG one (navy on featured products)" "
x=open('views/pages/index.ejs').read()
assert \"_btnClass(_d.cta_style, 'btn-outline')\" in x
x=x.replace(\"_btnClass(_d.cta_style, 'btn-outline')\", \"_btnClass(_d.cta_style, 'btn-navy')\")
open('views/pages/index.ejs','w').write(x)"

mutate "the newsletter submit goes back to a hardcoded class" "
x=open('views/pages/index.ejs').read()
assert \"_btnClass(news.cta_style, 'btn-amber')\" in x
x=x.replace('class=\"<%= _btnClass(news.cta_style, \'btn-amber\') %> newsletter-btn\"',
            'class=\"btn btn-amber newsletter-btn\"')
open('views/pages/index.ejs','w').write(x)"

mutate "_btnClass swallows the caller's fallback" "
x=open('views/pages/index.ejs').read()
assert 'btnClass(v, fb)' in x
x=x.replace('btnClass(v, fb)', \"btnClass(v, 'btn-navy')\")
open('views/pages/index.ejs','w').write(x)"

mutate "_btnClass loses its own btn-navy default for the two legacy callers" "
x=open('views/pages/index.ejs').read()
assert \"fb = fb || 'btn-navy';\" in x
x=x.replace(\"fb = fb || 'btn-navy';\", '')
open('views/pages/index.ejs','w').write(x)"

mutate "the parallax panel goes back to ONE picker for both buttons" "
import re
assert \"teButtonStyle(pk+'.cta1_style'\" in t
t = re.sub(r\"<%- teButtonStyle\(pk\+'\.cta1_style'[^\n]*\n\", '', t)"

mutate "the editor picker is renamed back to the placebo btn_style key" "
assert \"featured_section.cta_style\" in t
t = t.replace('featured_section.cta_style', 'featured_section.btn_style')"

mutate "a Wave 1 picker is removed from the bundle teaser panel" "
import re
assert \"teButtonStyle('bundle_teaser.cta_style'\" in t
t = re.sub(r\"<%- teButtonStyle\('bundle_teaser\.cta_style'[^\n]*\n\", '', t)"

mutate "the placebo teButton select is reinstated alongside the live one" "
assert \"teButtonStyle('newsletter.cta_style'\" in t
t = t.replace(\"<%- teButtonStyle('newsletter.cta_style'\",
              \"<%- teButton('newsletter', t.newsletter||{}) %>\n            <%- teButtonStyle('newsletter.cta_style'\")"

mutate "teButton is stripped from inspiration, which really does read btn_style" "
import re
assert \"teButton('inspiration'\" in t
t = re.sub(r\"<%- teButton\('inspiration'[^\n]*\n\", '', t)"

echo
echo "caught $pass, missed $fail"
if [ "$fail" -eq 0 ]; then echo "All $pass mutations detected. The gate can fail."
else echo "GATE HAS BLIND SPOTS"; exit 1; fi
