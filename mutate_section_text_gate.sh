#!/bin/bash
# Negative test for gate_section_text.js. Every mutation must be CAUGHT; a
# MISS means the check is decorative. A SKIP means the mutation did not
# apply, which is just as bad - it proves nothing.
set -u
cd "$(dirname "$0")"
S=src/services/themeSettings.js
I=views/pages/index.ejs
T=views/pages/admin/theme.ejs
pass=0; fail=0

mutate () {
  cp "$S" /tmp/st.s; cp "$I" /tmp/st.i; cp "$T" /tmp/st.t
  python3 - "$S" "$I" "$T" <<PY
import sys
sp,ip,tp = sys.argv[1],sys.argv[2],sys.argv[3]
s=open(sp).read(); i=open(ip).read(); t=open(tp).read()
$2
open(sp,'w').write(s); open(ip,'w').write(i); open(tp,'w').write(t)
PY
  if [ $? -ne 0 ]; then
    echo "  SKIP $1 — mutation did not apply"
    cp /tmp/st.s "$S"; cp /tmp/st.i "$I"; cp /tmp/st.t "$T"; fail=$((fail+1)); return
  fi
  if node gates/gate_section_text.js >/dev/null 2>&1; then
    echo "  MISSED  $1"; fail=$((fail+1))
  else
    echo "  caught  $1"; pass=$((pass+1))
  fi
  cp /tmp/st.s "$S"; cp /tmp/st.i "$I"; cp /tmp/st.t "$T"
  node gates/gate_section_text.js >/dev/null 2>&1 || { echo "  ABORT — restore failed"; exit 1; }
}

echo; echo "mutating Wave 2 — section title and body text"; echo

# ── the no-op is the whole safety story
mutate "a section defaults to Manual instead of Auto" "
assert 'text_manual: false,' in s
s = s.replace('text_manual: false,', 'text_manual: true,', 1)"

mutate "the helper gate flips to !== false, so undefined falls through to Manual" "
assert \"if (d.text_manual !== true) return '';\" in i
i = i.replace(\"if (d.text_manual !== true) return '';\", \"if (d.text_manual === false) return '';\")"

mutate "the 0 sentinel is allowed to become 0px" "
assert \"var sz = (raw === 0 || raw === '0' || raw == null || raw === '') ? '' : _cssLen(raw);\" in i
i = i.replace(\"var sz = (raw === 0 || raw === '0' || raw == null || raw === '') ? '' : _cssLen(raw);\",
              'var sz = _cssLen(raw);')"

mutate "size validation dropped — raw interpolation into the style attribute" "
assert '_cssLen(raw)' in i
i = i.replace('_cssLen(raw)', 'String(raw)+\\\"px\\\"')"

mutate "colour validation dropped" "
assert '_cssColor(d[colorField])' in i
i = i.replace('_cssColor(d[colorField])', 'String(d[colorField]||\\\"\\\")')"

# ── the seeded values ARE the no-black-text guard
mutate "a title colour is seeded blank again (teColor would show #000000)" "
assert \"heading_color: '#182840',\" in s
s = s.replace(\"heading_color: '#182840',\", \"heading_color: '',\", 1)"

mutate "a body colour is seeded blank again" "
assert \"body_color:    '#6B717F',\" in s
s = s.replace(\"body_color:    '#6B717F',\", \"body_color:    '',\", 1)"

mutate "before_after seeded with the light palette it does not use" "
assert \"heading_size: 36, heading_color: '#FFFFFF',\" in s
s = s.replace(\"heading_size: 36, heading_color: '#FFFFFF',\", \"heading_size: 36, heading_color: '#182840',\", 1)"

mutate "newsletter title size seeded 36 instead of its measured 33" "
assert 'heading_size: 33,' in s
s = s.replace('heading_size: 33,', 'heading_size: 36,')"

# ── call sites
mutate "one of the five identical .section-sub lines loses its hook" "
old = '<p class=\\\"section-sub\\\" style=\\\"<%= _textStyle(_d,\'body_size\',\'body_color\') %>\\\">'
assert i.count(old) >= 2
i = i.replace(old, '<p class=\\\"section-sub\\\">', 1)"

mutate "only ONE sample_banner render path is styled" "
old = \"id=\\\"sb-heading\\\" style=\\\"<%= _textStyle(sb_,'heading_size','heading_color') %>\\\"\"
assert i.count(old) == 2
i = i.replace(old, 'id=\\\"sb-heading\\\"', 1)"

mutate "a title reads the BODY fields by mistake" "
old = \"_textStyle(bt_,'heading_size','heading_color')\"
assert old in i
i = i.replace(old, \"_textStyle(bt_,'body_size','body_color')\")"

mutate "a section reads another section's object" "
old = \"_textStyle(bt_,'body_size','body_color')\"
assert old in i
i = i.replace(old, \"_textStyle(news,'body_size','body_color')\")"

mutate "the newsletter heading hook is removed" "
old = \"id=\\\"news-heading\\\" style=\\\"<%= _textStyle(news,'heading_size','heading_color') %>\\\"\"
assert old in i
i = i.replace(old, 'id=\\\"news-heading\\\"')"

# ── editor
mutate "teTextGroup loses the base-key fallback (copies post 16px black)" "
assert \"var pick = function (f) { return (d[f] !== undefined && d[f] !== '') ? d[f] : b[f]; };\" in t
t = t.replace(\"var pick = function (f) { return (d[f] !== undefined && d[f] !== '') ? d[f] : b[f]; };\",
              'var pick = function (f) { return d[f]; };')"

mutate "a hand-written panel stops passing its base key" "
assert \"teTextGroup('bundle_teaser', t.bundle_teaser||{}, 'bundle_teaser')\" in t
t = t.replace(\"teTextGroup('bundle_teaser', t.bundle_teaser||{}, 'bundle_teaser')\",
              \"teTextGroup('bundle_teaser', t.bundle_teaser||{})\")"

mutate "the group is dropped from a hand-written panel" "
import re
assert \"teTextGroup('featured_models'\" in t
t = re.sub(r\"<%- teTextGroup\('featured_models'[^\n]*\n\", '', t)"

mutate "before_after and testimonials lose the group" "
assert '/^(before_after|testimonials)/.test(pkBase)' in t
t = t.replace('/^(before_after|testimonials)/.test(pkBase)', '/^never_matches_anything/.test(pkBase)')"

mutate "copies of the featured bases lose the group" "
assert '_DUPL_BASE_HAS_OWN_PANEL.has(pkBase) && pk !== pkBase' in t
t = t.replace('_DUPL_BASE_HAS_OWN_PANEL.has(pkBase) && pk !== pkBase', 'false')"

mutate "teTextGroup is ALSO emitted in the image_with_text branch (duplicate names)" "
assert \"<%- teTextSize(pk+'.heading_size', d.heading_size, 'Heading size', 20, 56) %>\" in t
t = t.replace(\"<%- teTextSize(pk+'.heading_size', d.heading_size, 'Heading size', 20, 56) %>\",
              \"<%- teTextSize(pk+'.heading_size', d.heading_size, 'Heading size', 20, 56) %>\n<%- teTextGroup(pk, d, pkBase) %>\")"

mutate "the toggle reflects !== false, disagreeing with the template" "
assert 'd.text_manual === true)' in t
t = t.replace('d.text_manual === true)', 'd.text_manual !== false)', 1)"

# ── lock wiring
# Anchored on the array's own text, not on a bare \"'sample_banner',\" — that
# string also appears in _STATIC_KEYS near the top of the file, so the first
# version of this mutation edited an unrelated list, the gate passed for the
# right reason, and the harness reported a MISS for something never tested.
mutate "a section is dropped from TEXT_GROUP_SECTIONS" "
old = \"'before_after','testimonials','sample_banner',\"
assert old in t
t = t.replace(old, \"'before_after','testimonials',\")"

mutate "lockGroup stops locking the colour fields" "
assert \"s + '.body_size',    s + '.body_color'\" in t
t = t.replace(\"s + '.body_size',    s + '.body_color'\", \"s + '.body_size'\")"

mutate "the copy sweep is removed, so _N copies never lock" "
assert \"['before_after', 'testimonials', 'categories_section',\" in t
t = t.replace(\"['before_after', 'testimonials', 'categories_section',\", \"['before_after', 'testimonials'][0:0].concat([\")"

echo
echo "caught $pass, missed $fail"
if [ "$fail" -eq 0 ]; then echo "All $pass mutations detected. The gate can fail."
else echo "GATE HAS BLIND SPOTS"; exit 1; fi
