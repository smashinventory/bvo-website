#!/usr/bin/env bash
# Negative test for gate_sample_offer.js — specifically the alignment block
# rewritten 2026-10-20 (#7-3).
#
# WHY THIS EXISTS. The assertion it replaces was `.section-sub carries NO
# inline style`, which went red on Wave 2's style="<%- _textStyle(...) %>"
# even though that renders EMPTY in Auto. The replacement tests for an
# inline ALIGNMENT declaration instead. A relaxation is only safe if it is
# proven to still catch what it was protecting — which is what M1-M4 do.
# M5 is the converse: the legitimate markup must NOT be flagged.
#
# ⚠️ EVERY ANCHOR MUST MATCH EXACTLY ONCE, and the mutator enforces it
# (ANCHOR-AMBIGUOUS). Two separate anchors had to be fixed while writing
# this, and both failures looked like gate holes rather than script bugs:
#
#   1. `<div class="iwt-text-col">` appears TWICE in index.ejs — 2149 in
#      image_with_text and 2570 in the sample banner. A replace(a,b,1) took
#      2149, a section this gate never reads, so the mutation reported
#      MISSED against a gate that was working correctly.
#   2. The .section-sub line appears twice too — 2573 and 2587 — because the
#      banner has TWO render paths (with image, without). They differ only
#      in INDENTATION: 6 spaces inside .iwt-text-col, 4 inside
#      .section-header. Hence the leading newline in every anchor below;
#      without it, 4 spaces is a substring of 6 and the anchor is ambiguous.
#
# A non-unique anchor does not fail loudly. It silently mutates the wrong
# thing and indicts the gate, which is the most expensive kind of green.
set -uo pipefail
cd "$(dirname "$0")"

IDX="views/pages/index.ejs"
BAK="/tmp/mutate_sample_offer_$$.bak"
cp "$IDX" "$BAK"
trap 'cp "$BAK" "$IDX"; rm -f "$BAK"' EXIT

fail=0; n=0

if ! node gates/gate_sample_offer.js >/dev/null 2>&1; then
  echo "ABORT — gate_sample_offer is RED before any mutation."; exit 1
fi
echo "baseline: gate_sample_offer green"
echo

# mut <label> <catch|allow> <from> <to>
mut () {
  local label="$1" expect="$2" from="$3" to="$4"
  n=$((n+1))
  cp "$BAK" "$IDX"

  local af="/tmp/mso_a_$$" bf="/tmp/mso_b_$$" res
  printf '%s' "$from" > "$af"
  printf '%s' "$to"   > "$bf"
  res="$(python3 -I - "$IDX" "$af" "$bf" <<'PY'
import sys
path, af, bf = sys.argv[1:4]
s = open(path, encoding='utf-8').read()
a = open(af, encoding='utf-8').read()
b = open(bf, encoding='utf-8').read()
c = s.count(a)
if c == 0:
    print('STALE')
elif c > 1:
    print('AMBIGUOUS(%d)' % c)
else:
    open(path, 'w', encoding='utf-8').write(s.replace(a, b, 1))
    print('OK')
PY
)"
  rm -f "$af" "$bf"

  case "$res" in
    STALE)      echo "  ANCHOR-STALE  $label"; fail=$((fail+1)); cp "$BAK" "$IDX"; return ;;
    AMBIGUOUS*) echo "  ANCHOR-$res  $label — not unique, refusing to guess"
                fail=$((fail+1)); cp "$BAK" "$IDX"; return ;;
  esac

  if node gates/gate_sample_offer.js >/dev/null 2>&1; then
    if [ "$expect" = allow ]; then echo "  correctly allowed  $label"
    else echo "  MISSED  $label"; fail=$((fail+1)); fi
  else
    if [ "$expect" = allow ]; then echo "  FALSE POSITIVE  $label"; fail=$((fail+1))
    else echo "  caught  $label"; fi
  fi
  cp "$BAK" "$IDX"
}

# The NO-IMAGE render path (4-space indent, inside .section-header). This is
# the branch the gate's `full` fixture renders, and the leading newline is
# what makes 4 spaces distinguishable from the with-image branch's 6.
SUB=$'\n    <% if (sb_.subtitle) { %><p class="section-sub" style="<%= _textStyle(sb_,\'body_size\',\'body_color\') %>">'
SUBP=$'\n    <% if (sb_.subtitle) { %>'

# The banner's own .iwt-text-col, pinned by the sb_-specific line after it.
TXTCOL=$'<div class="iwt-text-col">\n      <% if (sb_.eyebrow) { %>'

# ── M1: the original defect. text-align inline on .section-sub — inline beats
#    the mobile media query, so the banner stops centring below 769px.
mut "inline text-align on .section-sub (the original defect)" catch \
  "$SUB" "$SUBP"'<p class="section-sub" style="text-align:left">'

# ── M2: the same defect on the flex container, where it bites hardest.
#    .iwt-text-col is display:flex;column, so align-items IS the horizontal
#    axis — the property two earlier attempts at this control got wrong.
mut "inline align-items on the banner's .iwt-text-col" catch \
  "$TXTCOL" $'<div class="iwt-text-col" style="align-items:flex-start">\n      <% if (sb_.eyebrow) { %>'

# ── M3: a left/right margin, the third way to defeat it. The stylesheet
#    centres .section-sub with margin-left/right:auto, so an inline
#    margin-left:0 pins it left on mobile just as text-align would.
mut "inline margin-left on .section-sub" catch \
  "$SUB" "$SUBP"'<p class="section-sub" style="margin-left:0;margin-right:auto">'

# ── M4: THE BLIND SPOT THE OLD REGEX HAD. Its pattern ended `" style=`,
#    requiring style to be the very next attribute after class. Any other
#    attribute between them made the defect invisible. This is the reason
#    the rewrite is not merely a relaxation.
mut "inline alignment hidden behind another attribute" catch \
  "$SUB" "$SUBP"'<p class="section-sub" data-x="1" style="text-align:left">'

# ── M5: must NOT fire. A non-empty inline font-size and colour is exactly
#    what manual mode legitimately emits, and what the old assertion wrongly
#    rejected. If this is flagged, the rewrite has over-corrected and the
#    gate is back to crying wolf about its own product's markup.
mut "non-empty font-size + colour (the legitimate Wave 2 markup)" allow \
  "$SUB" "$SUBP"'<p class="section-sub" style="font-size:18px;color:#333333">'

echo
if [ "$fail" -eq 0 ]; then
  echo "ALL $n MUTATIONS BEHAVED (4 caught, 1 correctly allowed)"
else
  echo "*** $fail of $n MUTATIONS MISBEHAVED ***"; exit 1
fi
