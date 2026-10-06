#!/usr/bin/env bash
# Negative tests for gate_hero_settings.js. Every mutation reintroduces a
# failure this work was specifically designed to prevent.
set -u
cd "$(dirname "$0")"
BK=$(mktemp -d)
cp src/services/themeSettings.js views/pages/index.ejs \
   views/pages/admin/theme.ejs public/css/site-bundle.css "$BK/"
restore() {
  cp "$BK/themeSettings.js"  src/services/themeSettings.js
  cp "$BK/index.ejs"         views/pages/index.ejs
  cp "$BK/theme.ejs"         views/pages/admin/theme.ejs
  cp "$BK/site-bundle.css"   public/css/site-bundle.css
}
trap restore EXIT
bad=0
try() {
  local label="$1"; shift
  "$@" >/dev/null 2>&1
  if node gates/gate_hero_settings.js >/dev/null 2>&1; then
    echo "  BAD   gate still GREEN after: $label"; bad=$((bad+1))
  else
    echo "  good  gate went RED  after: $label"
  fi
  restore
}

# 1. THE BIG ONE: seed a style default with the RESOLVED value instead of the
#    sentinel. Silently replaces a responsive CSS rule with a fixed px size.
m1() { perl -0pi -e 's/heading_size:    0,/heading_size:    42,/' src/services/themeSettings.js; }
# 2. the badge ships ON — publishes the dormant stored 'Free Shipping'
m2() { perl -0pi -e 's/badge_enabled:   false,/badge_enabled:   true,/' src/services/themeSettings.js; }
# 3. the render accepts a merely-truthy flag, so any stored string enables it
m3() { perl -0pi -e 's/hero\.badge_enabled === true/hero.badge_enabled/' views/pages/index.ejs; }
# 4. THE ORIGINAL BUG: a fixed pixel offset returns to the badge CSS
m4() { perl -0pi -e 's/\.hero-badge--top-left\{top:clamp\(12px,3%,32px\);left:clamp\(12px,3%,32px\)\}/.hero-badge--top-left{top:28px;left:28px}/' public/css/site-bundle.css; }
# 5. the in-box badge stops being in normal flow — collisions return
m5() { perl -0pi -e 's/\.hero-badge--inbox\{position:static/.hero-badge--inbox{position:absolute/' public/css/site-bundle.css; }
# 6. a duplicate key in DEFAULTS — JS keeps the last, discards the first
m6() { perl -0pi -e 's/    badge_radius:    3,/    badge_radius:    3,\n    heading_level:   "h3",/' src/services/themeSettings.js; }
# 7. a default is removed while the editor still renders the field
m7() { perl -0pi -e 's/^    overlay_color:   .#0f1f35.,.*\n//m' src/services/themeSettings.js; }
# 8. an orphan gets quietly wired without updating the plan or the gate
m8() { perl -0pi -e 's/hero\.badge_radius/hero.max_width/' views/pages/admin/theme.ejs; }
# 9. the overlay default drifts from the template fallback — moves the page on
#    any install that has not overridden it
m9() { perl -0pi -e 's/overlay_opacity: 55,/overlay_opacity: 80,/' src/services/themeSettings.js; }

echo
echo "Negative tests for gate_hero_settings"
echo
try "a style default seeded with the RESOLVED value, not the sentinel"  m1
try "the badge ships ON, publishing the stored 'Free Shipping'"         m2
try "the render accepts a merely-truthy enable flag"                    m3
try "a FIXED pixel offset returns to the badge CSS (the original bug)"  m4
try "the in-box badge leaves normal flow — collisions return"           m5
try "a duplicate key added to DEFAULTS"                                 m6
try "a default removed while the editor still renders the field"        m7
try "an orphan wired into the editor without updating the plan"         m8
try "the overlay default drifts from the template fallback"             m9

echo
if [ "$bad" -gt 0 ]; then echo "NEGATIVE TESTS FAILED: $bad undetected"; exit 1; fi
echo "All 9 mutations detected. The gate can fail."
