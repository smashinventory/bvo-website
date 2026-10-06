#!/usr/bin/env bash
# Negative tests for gate_filter_landing_pages.js after the collection re-key.
# Each mutation is a real way this could regress. The gate must go RED for all.
set -u
cd "$(dirname "$0")"
BK=$(mktemp -d)
for f in src/config/filterLandingPages.js src/config/pathFilters.js \
         src/controllers/collectionsController.js src/services/themeSettings.js; do
  cp "$f" "$BK/$(basename "$f")"
done
restore() {
  cp "$BK/filterLandingPages.js"     src/config/filterLandingPages.js
  cp "$BK/pathFilters.js"            src/config/pathFilters.js
  cp "$BK/collectionsController.js"  src/controllers/collectionsController.js
  cp "$BK/themeSettings.js"          src/services/themeSettings.js
}
trap restore EXIT

bad=0
GATE=gates/gate_filter_landing_pages.js
try() {
  local label="$1"; shift
  "$@" >/dev/null 2>&1
  if node "$GATE" >/dev/null 2>&1; then
    echo "  BAD   gate still GREEN after: $label"; bad=$((bad+1))
  else
    echo "  good  gate went RED  after: $label"
  fi
  restore
}

# 1. the duplicate-copy failure: let vanity copy serve the sibling collections
m1() { python3 - <<'PYX'
import io
p='src/config/filterLandingPages.js'
s=io.open(p,encoding='utf-8').read()
s=s.replace("""  'faucets': {""","""  'bathroom-vanities-with-tops': { style: STYLE, color_family: COLOR, size_in: SIZE },
  'faucets': {""",1)
io.open(p,'w',encoding='utf-8').write(s)
PYX
}
# 2. the lookup stops being collection-aware
m2() { perl -0pi -e 's/filterLandingPages\.lookup\(slug, param, value\)/filterLandingPages.lookup("bathroom-vanities", param, value)/' src/controllers/collectionsController.js; }
# 3. product_type keyed off the wrong variable (the trap this nearly fell into)
m3() { perl -0pi -e 's/\Qif ((attrFilters.product_type || []).length === 1) {\E/if ((productTypes || []).length === 1) {/' src/controllers/collectionsController.js
       perl -0pi -e 's/\Qcandidates.push(['"'"'product_type'"'"', attrFilters.product_type[0]]);\E/candidates.push(["product_type", productTypes[0]]);/' src/controllers/collectionsController.js; }
# 4. the two threshold defaults drift apart
m4() { perl -0pi -e 's/filter_landing_min_products: 10,/filter_landing_min_products: 40,/' src/services/themeSettings.js; }
# 5. the fallback becomes 0 — promotes every thin page on a config slip
m5() { perl -0pi -e 's/filter_landing_min_products \?\? 10/filter_landing_min_products ?? 0/' src/controllers/collectionsController.js; }
# 6. copy written but the clean-path slug forgotten
m6() { perl -0pi -e "s/^\s*'tub-fillers':\s*'Tub Fillers',\n//m" src/config/pathFilters.js; }
# 7. the two type facets merged — values leak across collections
m7() { python3 - <<'PYX'
import io,re
p='src/config/pathFilters.js'
s=io.open(p,encoding='utf-8').read()
s=s.replace("    on: ['faucets'],\n    values: {\n      'bathroom-faucets'","    on: ['faucets','accessories'],\n    values: {\n      'bathroom-faucets'",1)
s=s.replace("    on: ['accessories'],\n    values: {\n      'bathroom-accessories'","    on: ['faucets','accessories'],\n    values: {\n      'bathroom-accessories'",1)
io.open(p,'w',encoding='utf-8').write(s)
PYX
}
# 8. the canonical goes back to the ?param= form that redirects to itself
m8() { perl -0pi -e 's/pathFilters\.pathFor\(slug, _landing\.param, _landing\.value\)/null/' src/controllers/collectionsController.js; }
# 9. two entries share a title
m9() { perl -0pi -e "s/'Kitchen Faucets \| Pull-Down Sprayer & Single Handle \| BVO'/'Bathroom Sink Faucets | Centerset & Widespread | BVO'/" src/config/filterLandingPages.js; }

echo
echo "Negative tests for gate_filter_landing_pages (collection re-key)"
echo
try "vanity copy allowed to serve bathroom-vanities-with-tops (duplicate titles)" m1
try "lookup hardcoded to bathroom-vanities instead of the real slug"             m2
try "product_type keyed off productTypes (req.query.type) not attrFilters"       m3
try "themeSettings and controller thresholds drift apart"                        m4
try "the threshold fallback becomes 0"                                           m5
try "copy written for Tub Fillers but the clean-path slug removed"               m6
try "product-type and accessory-type merged — values leak across collections"    m7
try "canonical reverts to the ?param= form that 301s to itself"                  m8
try "two landing entries share a title"                                          m9

# ── the crumb gate ───────────────────────────────────────────────────────
GATE=gates/gate_filter_landing_crumb.js
# 10. a new entry ships without a crumb
m10() { perl -0pi -e "s/^\s*crumb: 'Drains & Pop-Ups',\n//m" src/config/filterLandingPages.js; }
# 11. a crumb duplicates the collection name above it — "Accessories > Accessories"
m11() { perl -0pi -e "s/crumb: 'Drains & Pop-Ups',/crumb: 'Accessories',/" src/config/filterLandingPages.js; }
# 12. crumb and h1 swapped, so the trail carries the long form
m12() { perl -0pi -e "s/crumb: '60\\\"',/crumb: '60 Inch Bathroom Vanities Extra Long',/" src/config/filterLandingPages.js; }

echo
try "a landing entry ships with no crumb"                                        m10
try "a crumb duplicates the collection name above it"                            m11
try "crumb and h1 swapped — the trail carries the long form"                     m12

echo
if [ "$bad" -gt 0 ]; then echo "NEGATIVE TESTS FAILED: $bad mutation(s) undetected"; exit 1; fi
echo "All 12 mutations detected. Both gates can fail."
