#!/bin/bash
# Negative test for gate_align_single_source.js.
set -u
cd "$(dirname "$0")"
T=views/pages/admin/theme.ejs
pass=0; fail=0

mutate () {
  cp "$T" /tmp/al.t
  python3 - "$T" <<PY
import sys
tp = sys.argv[1]
t = open(tp).read()
$2
open(tp,'w').write(t)
PY
  if [ $? -ne 0 ]; then
    echo "  SKIP $1 — mutation did not apply"; cp /tmp/al.t "$T"; fail=$((fail+1)); return
  fi
  if node gates/gate_align_single_source.js >/dev/null 2>&1; then
    echo "  MISSED  $1"; fail=$((fail+1))
  else
    echo "  caught  $1"; pass=$((pass+1))
  fi
  cp /tmp/al.t "$T"
  node gates/gate_align_single_source.js >/dev/null 2>&1 || { echo "  ABORT — restore failed"; exit 1; }
}

echo; echo "mutating the alignment single-source fix"; echo

# ── the bug itself coming back
mutate "teSectionLayout emits an alignment control again (the original bug)" "
old = \"  var h = '<div class=\\\"te4-section-label\\\">Layout</div>';\"
assert old in t
t = t.replace(old, old + \"\n  h += teAlignment(pk + '.text_align', d.text_align);\", 1)"

mutate "a panel gets a second literal alignment control" "
old = \"<%- teAlignment('bundle_teaser.text_align', (t.bundle_teaser||{}).text_align || 'left') %>\"
assert old in t
t = t.replace(old, old + '\n' + old)"

mutate "the image_with_text branch gets a second one" "
old = \"<%- teAlignment(pk+'.text_align', d.text_align || 'left') %>\"
assert t.count(old) >= 1
i = t.index(old)
t = t[:i] + old + '\n' + t[i:]"

# ── a panel losing its only control
mutate "scrolling_ticker loses the control it just gained" "
import re
assert \"teAlignment('scrolling_ticker.text_align'\" in t
t = re.sub(r\"<%- teAlignment\('scrolling_ticker\.text_align'[^\n]*\n\", '', t)"

mutate "value_bar loses its control" "
import re
assert \"teAlignment('value_bar.text_align'\" in t
t = re.sub(r\"<%- teAlignment\('value_bar\.text_align'[^\n]*\n\", '', t)"

mutate "video_text loses the control it never had before this fix" "
import re
assert \"d.text_align || 'left') %>\" in t
t = re.sub(r\"<%- teAlignment\(pk\+'\.text_align', d\.text_align \|\| 'left'\) %>\n\", '', t, count=1)"

mutate "trust_band loses its new control" "
import re
assert \"d.text_align || 'center') %>\" in t
t = re.sub(r\"<%- teAlignment\(pk\+'\.text_align', d\.text_align \|\| 'center'\) %>\n\", '', t, count=1)"

mutate "hero loses its alignment control" "
import re
assert \"teAlignment('hero.text_align'\" in t
t = re.sub(r\"<%- teAlignment\('hero\.text_align'[^\n]*\n\", '', t)"

mutate "sample_banner's hand-rolled select is removed" "
assert 'name=\"sample_banner.text_align\"' in t
t = t.replace('name=\"sample_banner.text_align\"', 'name=\"sample_banner.text_align_DISABLED\"')"

mutate "teFeaturedBody stops emitting one, orphaning three sections and all copies" "
assert \"teAlignment(pk+'.text_align',d.text_align||'center')\" in t
t = t.replace(\"+ teAlignment(pk+'.text_align',d.text_align||'center')\", '', 1)"

# ── the seeded defaults must stay truthful to what the page renders
mutate "bundle_teaser seeded 'center' when it renders left" "
assert \"(t.bundle_teaser||{}).text_align || 'left'\" in t
t = t.replace(\"(t.bundle_teaser||{}).text_align || 'left'\", \"(t.bundle_teaser||{}).text_align || 'center'\")"

mutate "value_bar seeded 'left' when it renders center" "
assert \"(t.value_bar||{}).text_align || 'center'\" in t
t = t.replace(\"(t.value_bar||{}).text_align || 'center'\", \"(t.value_bar||{}).text_align || 'left'\")"

mutate "scrolling_ticker seeded 'center' when it renders left" "
assert \"(t.scrolling_ticker||{}).text_align || 'left'\" in t
t = t.replace(\"(t.scrolling_ticker||{}).text_align || 'left'\", \"(t.scrolling_ticker||{}).text_align || 'center'\")"

mutate "brand_logos seeded 'left' against its stylesheet" "
assert \"(t.brand_logos||{}).text_align || 'center'\" in t
t = t.replace(\"(t.brand_logos||{}).text_align || 'center'\", \"(t.brand_logos||{}).text_align || 'left'\")"

# Deletes the line rather than commenting it. Commenting leaves the text in
# place, so a check that counts \"h += teField(\" still saw three - the
# mutation proved nothing and reported a MISS against a sound check.
mutate "teSectionLayout loses one of the three controls it SHOULD still emit" "
import re
assert \"pk + '.max_width'\" in t
t = re.sub(r\"  h \\+= teField\\('text', pk \\+ '\\.max_width'[^\\n]*\\n\", '', t, count=1)"

echo
echo "caught $pass, missed $fail"
if [ "$fail" -eq 0 ]; then echo "All $pass mutations detected. The gate can fail."
else echo "GATE HAS BLIND SPOTS"; exit 1; fi
