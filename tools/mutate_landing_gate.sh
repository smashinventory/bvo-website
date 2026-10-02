#!/bin/bash
# Run with: bash tools/mutate_landing_gate.sh
#
# Mutation sweep for gates/gate_filter_landing_pages.js.
#
# Every mutation reintroduces a real regression. Each must turn the gate red.
# A mutation the gate survives is a hole, not a pass.
#
# The two regressions that matter most are both SILENT:
#   - a content key that no link emits  -> that page never promotes, forever,
#     with no error anywhere;
#   - a threshold that drops to 0       -> every thin filter floods the index,
#     and nothing looks wrong until traffic falls.
# Several mutations below target exactly those.
set -u
cd "$(dirname "$0")/.."

GATE=gates/gate_filter_landing_pages.js
FILES=(
  src/config/filterLandingPages.js
  src/controllers/collectionsController.js
  src/services/themeSettings.js
  views/pages/collection.ejs
  views/partials/filters/vanity-style.ejs
  views/layouts/main.ejs
  public/css/site.css
  public/css/site-bundle.css
  docs/architecture/VANITY_SIDEBAR_FILTERS.md
)
BAK=$(mktemp -d)
restore() { for f in "${FILES[@]}"; do cp "$BAK/$(echo "$f" | tr / _)" "$f"; done; }
trap 'restore; rm -rf "$BAK"' EXIT
for f in "${FILES[@]}"; do cp "$f" "$BAK/$(echo "$f" | tr / _)"; done

PASSED=0; HOLES=0

# Mutation code is passed through an ENVIRONMENT VARIABLE into a QUOTED
# heredoc, not interpolated into an unquoted one.
#
# The first version did the latter, and bash does not strip a backslash before
# a double quote inside an unquoted heredoc — so every \" in a mutation arrived
# at Python verbatim and five mutations died with SyntaxError. They were then
# reported as "gate still PASSED", which is indistinguishable from a real hole
# and is the worst possible failure for a tool whose entire job is telling you
# whether your gate works. Quoted heredoc + env var means the code reaches
# Python exactly as written.
mutate() {
  local desc="$1" file="$2" code="$3"
  MUT_FILE="$file" MUT_CODE="$code" python3 <<'PY'
import os, sys, re
p = os.environ['MUT_FILE']
t = open(p, encoding='utf-8').read()
before = t
ns = {'t': t, 're': re, 'Q': chr(39)}
exec(os.environ['MUT_CODE'], ns)
t = ns['t']
open(p, 'w', encoding='utf-8').write(t)
sys.exit(0 if t != before else 9)
PY
  local rc=$?
  if [ $rc -eq 9 ]; then
    printf '  ??   %-58s MUTATION DID NOT APPLY (stale pattern)\n' "$desc"
    HOLES=$((HOLES+1)); restore; return
  elif [ $rc -ne 0 ]; then
    printf '  ??   %-58s MUTATION ERRORED\n' "$desc"
    HOLES=$((HOLES+1)); restore; return
  fi
  if node "$GATE" >/dev/null 2>&1; then
    printf '  HOLE %-58s gate still PASSED\n' "$desc"; HOLES=$((HOLES+1))
  else
    printf '  ok   %-58s caught\n' "$desc"; PASSED=$((PASSED+1))
  fi
  restore
}

echo
echo "=== baseline ==="
node "$GATE" >/dev/null 2>&1 && echo "  ok   clean tree passes" || { echo "  ABORT: gate fails before any mutation."; exit 1; }

echo
echo "=== content quality ==="
mutate "a style entry deleted" src/config/filterLandingPages.js \
  't = re.sub(r"  " + Q + "Coastal" + Q + r": \{[\s\S]*?\n  \},\n", "", t, count=1)'
mutate "two pages given the same title" src/config/filterLandingPages.js \
  't = t.replace("Coastal Bathroom Vanities | Light & Airy Designs | BVO", "Farmhouse Bathroom Vanities | Rustic & Shaker | BVO")'
mutate "two pages given the same meta" src/config/filterLandingPages.js \
  'm = re.search(r"meta:  " + Q + "([^" + Q + "]+)" + Q, t); first = m.group(1); t = re.sub(r"meta:  " + Q + "[^" + Q + "]+" + Q, "meta:  " + Q + first + Q, t, count=4)'
mutate "two pages given the same H1" src/config/filterLandingPages.js \
  't = t.replace("h1:    " + Q + "Coastal Bathroom Vanities" + Q, "h1:    " + Q + "Modern Bathroom Vanities" + Q)'
mutate "a title pushed over 60 chars" src/config/filterLandingPages.js \
  't = t.replace("Modern Bathroom Vanities | Clean-Lined Designs | BVO", "Modern Bathroom Vanities | Clean-Lined Contemporary Designs For Any Home | BVO")'
mutate "a meta truncated below the band" src/config/filterLandingPages.js \
  't = re.sub(r"meta:  " + Q + "[^" + Q + "]{110,}" + Q, "meta:  " + Q + "Too short." + Q, t, count=1)'
mutate "an intro replaced with filler" src/config/filterLandingPages.js \
  'f = "Browse our wide selection of quality bathroom vanities at great prices, with something for everyone and fast free shipping on every single order that we send out to our customers today."; t = re.sub(r"intro: " + Q + "[^" + Q + "]+" + Q, "intro: " + Q + f + Q, t, count=1)'
mutate "an intro cut below the word floor" src/config/filterLandingPages.js \
  't = re.sub(r"intro: " + Q + "[^" + Q + "]+" + Q, "intro: " + Q + "Short intro text here." + Q, t, count=1)'

echo
echo "=== keys that silently never match ==="
mutate "a style key mistyped (never promotes)" src/config/filterLandingPages.js \
  't = t.replace(Q + "Mid-Century Modern" + Q + ": {", Q + "Mid Century Modern" + Q + ": {")'
mutate "colour keys switched to display labels" src/config/filterLandingPages.js \
  't = t.replace(Q + "wood_m" + Q + ": {", Q + "Med Wood" + Q + ": {")'
mutate "content for a style the nav never links" src/config/filterLandingPages.js \
  'extra = "  " + Q + "Brutalist" + Q + ": { h1: " + Q + "Brutalist Bathroom Vanities" + Q + ", title: " + Q + "Brutalist Bathroom Vanities | Concrete | BVO" + Q + ", meta: " + Q + "Brutalist bathroom vanities in raw concrete and steel finishes for industrial interiors, in single and double widths with stone tops fitted throughout." + Q + ", intro: " + Q + "Brutalist vanities use raw concrete and exposed steel with heavy slab forms and no applied decoration, which suits loft conversions and warehouse interiors where the architecture is already the main feature of the room itself." + Q + " },\n"; t = t.replace("  " + Q + "Traditional" + Q + ": {", extra + "  " + Q + "Traditional" + Q + ": {", 1)'

echo
echo "=== the threshold ==="
mutate "threshold default dropped to 0" src/services/themeSettings.js \
  't = t.replace("filter_landing_min_products: 25", "filter_landing_min_products: 0")'
mutate "fallback changed from 25 to 0" src/controllers/collectionsController.js \
  't = t.replace("?? 25", "?? 0")'
mutate "threshold check removed entirely" src/controllers/collectionsController.js \
  't = t.replace("if ((result.total || 0) < minProducts) return null;", "")'
mutate "threshold hardcoded, ignoring settings" src/controllers/collectionsController.js \
  't = re.sub(r"const minProducts = Number\([\s\S]*?\);", "const minProducts = 1;", t, count=1)'

echo
echo "=== promotion scope ==="
mutate "multi-filter pages promoted too" src/controllers/collectionsController.js \
  't = t.replace("if (activeFilterGroupCount !== 1) return null;", "")'
mutate "multi-VALUE filters promoted too" src/controllers/collectionsController.js \
  't = t.replace("(attrFilters.style   || []).length === 1", "(attrFilters.style   || []).length >= 1")'
mutate "promotion leaks to non-vanity categories" src/controllers/collectionsController.js \
  't = t.replace("if (!isVanityCategory) return null;", "")'
mutate "unknown values promoted with no copy" src/controllers/collectionsController.js \
  't = t.replace("if (!content) return null;", "if (!content) return {h1: Q, title: Q, meta: Q, intro: Q};".replace("Q", chr(34) + "x" + chr(34)))'
mutate "colour promotes even with exact colour set" src/controllers/collectionsController.js \
  't = t.replace("colorFamilyParam.length === 1 && colorExactParam.length === 0", "colorFamilyParam.length === 1")'

echo
echo "=== canonical and template ==="
mutate "self-canonical loses its query string" src/controllers/collectionsController.js \
  'a = chr(96) + "${canonicalUrl}?${_landing.param}=${encodeURIComponent(_landing.value)}" + chr(96); b = chr(96) + "${canonicalUrl}" + chr(96); t = t.replace(a, b)'
mutate "render reverts to the parent canonical" src/controllers/collectionsController.js \
  't = t.replace("canonicalUrl: effectiveCanonical", "canonicalUrl")'
mutate "landing not passed to the template" src/controllers/collectionsController.js \
  't = t.replace("      landing:      _landing,\n", "")'
mutate "H1 ADDED rather than swapped (two H1s)" views/pages/collection.ejs \
  't = t.replace("    <% } else { %>\n    <h1><%= category.name %></h1>", "    <% } %>\n    <% if (true) { %>\n    <h1><%= category.name %></h1>")'
mutate "intro paragraph dropped" views/pages/collection.ejs \
  't = t.replace(chr(60) + "p class=" + chr(34) + "cat-intro" + chr(34) + chr(62) + "<%= landing.intro %>" + chr(60) + "/p" + chr(62), "")'

echo
echo "=== CSS ==="
mutate "cat-intro rule removed from the bundle" public/css/site-bundle.css \
  't = t.replace(".cat-header .cat-intro{", ".cat-header .cat-introX{")'
mutate "cat-intro rule removed from the source" public/css/site.css \
  't = t.replace(".cat-header .cat-intro{", ".cat-header .cat-introX{")'
mutate "written as a bare .cat-intro (loses on specificity)" public/css/site-bundle.css \
  't = t.replace(".cat-header .cat-intro{", ".cat-intro{")'
mutate "cache buster not bumped" views/layouts/main.ejs \
  't = t.replace("site-bundle.css?v=28", "site-bundle.css?v=27")'

echo
echo "=== the Vanity Style correction ==="
mutate "doc reverts to DOES NOT FILTER" docs/architecture/VANITY_SIDEBAR_FILTERS.md \
  't = t.replace("## 5. \u2705 VANITY STYLE FILTERS \u2014 CORRECTED 2026-10-02", "## 5. \u26a0 VANITY STYLE DOES NOT FILTER")'
mutate "do-not-call-it-working reinstated" docs/architecture/VANITY_SIDEBAR_FILTERS.md \
  't = t.replace("### The lesson worth keeping", "Do not describe this filter as working.\n\n### The lesson worth keeping")'
mutate "sidebar KNOWN GAP comment restored" views/partials/filters/vanity-style.ejs \
  't = t.replace("  * THIS FILTER WORKS", "  * \u26a0 KNOWN GAP \u2014 this filter does not filter yet.\n  * THIS FILTER WORKS")'
mutate "controller claims style unread again" src/controllers/collectionsController.js \
  't = t.replace(" * VANITY STYLE DOES FILTER", " * NOTE: this controller does NOT read req.query.style.\n * VANITY STYLE DOES FILTER")'

echo
echo "=== restore verification ==="
restore
CLEAN=1
for f in "${FILES[@]}"; do
  cmp -s "$f" "$BAK/$(echo "$f" | tr / _)" || { echo "  !! $f does NOT match its pre-mutation backup"; CLEAN=0; }
done
[ $CLEAN -eq 1 ] && echo "  ok   all ${#FILES[@]} files byte-identical to their pre-mutation state"
node "$GATE" >/dev/null 2>&1 && echo "  ok   gate passes again after restore" || echo "  !! gate FAILS after restore"

echo
echo "caught: $PASSED    holes: $HOLES"
[ $HOLES -eq 0 ] && [ $CLEAN -eq 1 ] || exit 1
