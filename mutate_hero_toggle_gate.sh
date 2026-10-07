#!/bin/bash
# Negative test for the Default/Manual sizing checks in gate_hero_settings.js.
#
# A gate that cannot fail is decoration. Each mutation below breaks ONE thing
# the gate claims to protect; every one must turn it red. Files are restored
# after each, and the whole run aborts if a restore does not take.
set -u
cd "$(dirname "$0")"

SVC=src/services/themeSettings.js
IDX=views/pages/index.ejs
THM=views/pages/admin/theme.ejs

pass=0; fail=0

mutate () {               # $1 = label, $2 = python snippet
  cp "$SVC" /tmp/m.svc; cp "$IDX" /tmp/m.idx; cp "$THM" /tmp/m.thm
  python3 - "$SVC" "$IDX" "$THM" <<PY
import sys
svc_p, idx_p, thm_p = sys.argv[1], sys.argv[2], sys.argv[3]
svc = open(svc_p).read(); idx = open(idx_p).read(); thm = open(thm_p).read()
$2
open(svc_p,'w').write(svc); open(idx_p,'w').write(idx); open(thm_p,'w').write(thm)
PY
  if [ $? -ne 0 ]; then
    echo "  SKIP $1 — the mutation itself did not apply"
    cp /tmp/m.svc "$SVC"; cp /tmp/m.idx "$IDX"; cp /tmp/m.thm "$THM"
    fail=$((fail+1)); return
  fi
  if node gates/gate_hero_settings.js >/dev/null 2>&1; then
    echo "  MISSED  $1 — gate stayed green"
    fail=$((fail+1))
  else
    echo "  caught  $1"
    pass=$((pass+1))
  fi
  cp /tmp/m.svc "$SVC"; cp /tmp/m.idx "$IDX"; cp /tmp/m.thm "$THM"
  # Prove the restore worked, or every later result is meaningless.
  node gates/gate_hero_settings.js >/dev/null 2>&1 || {
    echo "  ABORT — restore failed, gate red on clean tree"; exit 1; }
}

echo
echo "mutating the Default/Manual sizing guard — every one must be caught"
echo

mutate "sizing_manual default flipped to false" "
assert 'sizing_manual: true' in svc
svc = svc.replace('sizing_manual: true', 'sizing_manual: false')"

mutate "sizing_manual default removed entirely" "
assert 'sizing_manual: true,' in svc
svc = svc.replace('    sizing_manual: true,\n', '')"

mutate "guard changed to === true (drops heights on unsaved installs)" "
assert 'hero.sizing_manual !== false' in idx
idx = idx.replace('hero.sizing_manual !== false', 'hero.sizing_manual === true')"

mutate "guard made truthy (same trap, subtler)" "
assert 'hero.sizing_manual !== false' in idx
idx = idx.replace('if (hero.sizing_manual !== false) {', 'if (hero.sizing_manual) {')"

mutate "min-height write changed to a fixed number" "
assert \"'min-height:'+hero.min_height_px+'px;'\" in idx
idx = idx.replace(\"'min-height:'+hero.min_height_px+'px;'\", \"'min-height:520px;'\")"

mutate "max-height write dropped from the guard" "
old = \"    else if (+hero.max_height_px > 0)  _heroStyle += 'max-height:'+hero.max_height_px+'px;';\n\"
assert old in idx
idx = idx.replace(old, '')"

mutate "editor switch removed" "
assert \"teToggle('hero.sizing_manual'\" in thm
import re
thm = re.sub(r\"<%- teToggle\('hero\.sizing_manual'[^\n]*\n\", '', thm)"

mutate "disabled swapped for readonly (still posts, overwrites stored values)" "
assert 'el.disabled = off' in thm
thm = thm.replace('el.disabled = off', 'el.readOnly = off')"

mutate "teSectionLayout no longer called for the hero" "
assert \"teSectionLayout('hero'\" in thm
thm = thm.replace(\"teSectionLayout('hero'\", \"teSectionLayout('hero_DISABLED'\")"

mutate "typography_manual default flipped to false" "
assert 'typography_manual:  true' in svc
svc = svc.replace('typography_manual:  true', 'typography_manual:  false')"

mutate "content_box_manual default flipped to false" "
assert 'content_box_manual: true' in svc
svc = svc.replace('content_box_manual: true', 'content_box_manual: false')"

mutate "typography guard changed to === true" "
assert 'hero.typography_manual !== false' in idx
idx = idx.replace('hero.typography_manual !== false', 'hero.typography_manual === true')"

mutate "typography AUTO falls back to the stylesheet again (the original bug)" "
assert '_typeMan ? hero : _heroDef' in idx
idx = idx.replace('_typeMan ? hero : _heroDef', '_typeMan ? hero : {}')"

mutate "content box AUTO falls back to the stylesheet again" "
old = \"(hero.content_box_manual !== false) ? hero : _heroDef\"
assert old in idx
idx = idx.replace(old, '(hero.content_box_manual !== false) ? hero : {}')"

mutate "a typography default reverted to its pre-tuning value" "
assert 'heading_size:    20,' in svc
svc = svc.replace('heading_size:    20,', 'heading_size:    0,')"

mutate "a content box default reverted to its pre-tuning value" "
assert 'content_box_max' not in svc
assert 'content_max_width:   320,' in svc
svc = svc.replace('content_max_width:   320,', 'content_max_width:   520,')"

mutate "box colour default reverted to navy" "
assert \"content_box_color:   '#ffffff'\" in svc
svc = svc.replace(\"content_box_color:   '#ffffff'\", \"content_box_color:   '#0f1f35'\")"

mutate "the stale != 11 guard comes back (suppresses the tuned eyebrow size)" "
assert '+_heroT.eyebrow_size > 0' in idx
idx = idx.replace('(+_heroT.eyebrow_size > 0)', '(+_heroT.eyebrow_size > 0 && _heroT.eyebrow_size != 11)')"

mutate "DEFAULTS no longer exported, so AUTO has nothing to read" "
assert 'DEFAULTS: Object.freeze(DEFAULTS)' in svc
svc = svc.replace('DEFAULTS: Object.freeze(DEFAULTS)', 'DEFAULTS_DISABLED: Object.freeze(DEFAULTS)')"

mutate "content box guard changed to === true" "
assert 'hero.content_box_manual !== false' in idx
idx = idx.replace('hero.content_box_manual !== false', 'hero.content_box_manual === true')"

mutate "typography switch removed from the editor" "
import re
assert \"teToggle('hero.typography_manual'\" in thm
thm = re.sub(r\"<%- teToggle\('hero\.typography_manual'[^\n]*\n\", '', thm)"

mutate "content box switch removed from the editor" "
import re
assert \"teToggle('hero.content_box_manual'\" in thm
thm = re.sub(r\"<%- teToggle\('hero\.content_box_manual'[^\n]*\n\", '', thm)"

mutate "typography group not wired to lockGroup" "
assert \"lockGroup('hero.typography_manual'\" in thm
thm = thm.replace(\"lockGroup('hero.typography_manual'\", \"noLock('hero.typography_manual'\")"

mutate "a copy field swept into the typography group" "
assert \"'hero.eyebrow_size', 'hero.heading_size'\" in thm
thm = thm.replace(\"'hero.eyebrow_size', 'hero.heading_size'\",
                  \"'hero.heading_line1', 'hero.eyebrow_size', 'hero.heading_size'\")"

mutate "slider companion no longer locked" "
assert 'te4-slider-num' in thm
i = thm.index('function lockGroup')
head, tail = thm[:i], thm[i:]
tail = tail.replace(\"wrap.querySelectorAll('.te4-slider-num')\", \"wrap.querySelectorAll('.te4-nothing')\", 1)
thm = head + tail"

mutate "colour-field sweep removed (brand swatch buttons stay clickable)" "
i = thm.index('function lockGroup')
head, tail = thm[:i], thm[i:]
assert 'te4-color-swatch, .te4-bs' in tail
tail = tail.replace('.te4-color-swatch, .te4-bs', '.te4-nothing')
thm = head + tail"

mutate "data-for swatch lookup removed (the colour picker stays live)" "
i = thm.index('function lockGroup')
head, tail = thm[:i], thm[i:]
assert 'te4-color-swatch[data-for=' in tail
tail = tail.replace('.te4-color-swatch[data-for=', '.te4-nothing[data-for=')
thm = head + tail"

mutate "an Image & Media switch sneaks in" "
assert 'content_box_manual: true' in svc
svc = svc.replace('content_box_manual: true', 'content_box_manual: true,\\n    media_manual: true')
assert \"teToggle('hero.content_box_manual'\" in thm
thm = thm.replace(\"teToggle('hero.content_box_manual'\", \"teToggle('hero.media_manual'\", 1)"

mutate "badge_size swept into typography" "
old = \"'hero.subtext_size', 'hero.sub2_size',\"
assert old in thm
thm = thm.replace(old, \"'hero.subtext_size', 'hero.sub2_size', 'hero.badge_size',\")"

mutate "greyed fields show the stored value again (the bug Sam found)" "
i = thm.index('function sync()')
j = thm.index('cb.addEventListener', i)
head, body, tail = thm[:i], thm[i:j], thm[j:]
assert 'showValue(el, AUTO[n])' in body
body = body.replace('if (off) { if (AUTO[n] !== undefined) showValue(el, AUTO[n]); }', 'if (off) { }')
thm = head + body + tail"

mutate "the manual value is not parked, so toggling loses it" "
assert 'if (el.dataset.manualVal === undefined) el.dataset.manualVal = el.value;' in thm
thm = thm.replace('if (el.dataset.manualVal === undefined) el.dataset.manualVal = el.value;', '')"

mutate "restoreValue stops putting the admin value back" "
assert 'if (el.dataset.manualVal !== undefined) showValue(el, el.dataset.manualVal);' in thm
thm = thm.replace('if (el.dataset.manualVal !== undefined) showValue(el, el.dataset.manualVal);', '')"

mutate "the slider companion no longer mirrors the displayed value" "
i = thm.index('function showValue')
j = thm.index('function lockGroup')
head, body, tail = thm[:i], thm[i:j], thm[j:]
assert 'te4-slider-num' in body
body = body.replace('te4-slider-num', 'te4-nope-num')
thm = head + body + tail"

mutate "the Auto value map is emitted from the stored settings, not the defaults" "
assert 'themeDefaults.hero' in thm
thm = thm.replace('? themeDefaults.hero : {}', '? t.hero : {}')"

mutate "the Auto JSON node is dropped" "
assert 'id=\\\"heroAutoValues\\\"' in thm
thm = thm.replace('id=\\\"heroAutoValues\\\"', 'id=\\\"heroAutoValuesX\\\"')"

echo
echo "caught $pass, missed $fail"
if [ "$fail" -eq 0 ]; then
  echo "All $pass mutations detected. The gate can fail."
else
  echo "GATE HAS BLIND SPOTS"; exit 1
fi
