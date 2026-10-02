#!/bin/bash
# Run with: bash tools/mutate_nav_gate.sh
#
# Mutation sweep for gates/gate_nav_single_source.js.
#
# A gate that passes proves nothing on its own - it has to FAIL when the thing
# it guards is actually broken. Every mutation below reintroduces one real
# regression; each one must turn the gate red. A mutation the gate survives is
# a hole, not a pass.
#
# BACKUP DISCIPLINE. An earlier mutation harness in this repo rewrote 16
# templates and its restore covered only 7, which damaged the working tree. So:
# every file is copied to $BAK before anything is touched, the restore is a
# trap on EXIT so it runs even on Ctrl-C or an unexpected error, and the restore
# is verified against git at the end.
set -u
cd "$(dirname "$0")/.."

GATE=gates/gate_nav_single_source.js
FILES=(
  views/partials/header.ejs
  src/services/themeSettings.js
  public/js/site.js
  public/css/site.css
  public/css/site-bundle.css
)
BAK=$(mktemp -d)

restore() {
  for f in "${FILES[@]}"; do
    [ -f "$BAK/$(basename "$f")" ] && cp "$BAK/$(basename "$f")" "$f"
  done
}
trap 'restore; rm -rf "$BAK"' EXIT

for f in "${FILES[@]}"; do cp "$f" "$BAK/$(basename "$f")"; done

PASSED=0; HOLES=0

# $1 = what regression this simulates
# $2 = file
# $3 = python expression body operating on `t` (the file text)
mutate() {
  local desc="$1" file="$2" code="$3"
  python3 - "$file" <<PY
import sys
p=sys.argv[1]; t=open(p,encoding='utf-8').read()
before=t
$code
open(p,'w',encoding='utf-8').write(t)
sys.exit(0 if t!=before else 9)
PY
  local rc=$?
  if [ $rc -eq 9 ]; then
    printf '  ?? %-58s MUTATION DID NOT APPLY (pattern stale)\n' "$desc"
    HOLES=$((HOLES+1)); restore; return
  fi
  if node "$GATE" >/dev/null 2>&1; then
    printf '  HOLE %-56s gate still PASSED\n' "$desc"
    HOLES=$((HOLES+1))
  else
    printf '  ok   %-56s gate caught it\n' "$desc"
    PASSED=$((PASSED+1))
  fi
  restore
}

echo
echo "=== baseline: gate must pass on a clean tree ==="
if node "$GATE" >/dev/null 2>&1; then echo "  ok   clean tree passes"; else
  echo "  ABORT: gate fails before any mutation. Fix that first."; exit 1; fi

echo
echo "=== mutations ==="

# --- the duplicate nav coming back, in its most likely forms ---
mutate "second nav list added" views/partials/header.ejs \
  't=t.replace("</header>", chr(60)+"ul class=\"nav-links\"></ul></header>")'

mutate "#mobile-menu drawer re-added" views/partials/header.ejs \
  't=t.replace("</header>", chr(60)+"div id=\"mobile-menu\"></div></header>")'

mutate ".mobile-sub rows re-added" views/partials/header.ejs \
  't=t.replace("</header>", chr(60)+"li class=\"mobile-sub\"></li></header>")'

mutate "accordion script re-added to header" views/partials/header.ejs \
  't=t.replace("</header>", chr(60)+"script nonce=\"x\"></script></header>")'

# --- the disclosure replaced by the old pattern ---
mutate "summary reverted to an <a> trigger" views/partials/header.ejs \
  't=t.replace(chr(60)+"summary class=\"nav-mega-trigger\"", chr(60)+"a class=\"nav-mega-trigger\"")'

mutate "aria-expanded hand-set on the summary" views/partials/header.ejs \
  't=t.replace(chr(60)+"summary class=\"nav-mega-trigger\"", chr(60)+"summary class=\"nav-mega-trigger\" aria-expanded=\"false\"")'

mutate "aria-haspopup put back on the summary" views/partials/header.ejs \
  't=t.replace(chr(60)+"summary class=\"nav-mega-trigger\"", chr(60)+"summary class=\"nav-mega-trigger\" aria-haspopup=\"true\"")'

mutate "panel collapsed with the global hidden attribute" views/partials/header.ejs \
  't=t.replace("class=\"mega-menu\"", "class=\"mega-menu\" hidden")'

mutate "nav-disclosure class dropped from <details>" views/partials/header.ejs \
  't=t.replace("class=\"nav-disclosure\"", "class=\"nav-disc\"")'

# --- the destination that moved into the panel ---
mutate "Shop All row deleted" views/partials/header.ejs \
  't=t.replace("mega-link mega-link--all", "mega-link")'

mutate "Shop All row hardcoded instead of link.url" views/partials/header.ejs \
  't=t.replace("mega-link--all\" href=\"<%= link.url %>\"", "mega-link--all\" href=\"/collections/bathroom-vanities\"")'

mutate "My Account label removed from icon cluster" views/partials/header.ejs \
  't=t.replace("My Account","Account")'

# --- style links drifting back to two sources ---
mutate "one style label hardcoded in the template again" views/partials/header.ejs \
  't=t.replace("</ul>", chr(60)+"a href=\"/x\">Farmhouse</a></ul>",1)'

mutate "template stops reading style_links from settings" views/partials/header.ejs \
  't=t.replace("_vm.style_links","_vm.style_linx")'

mutate "style_links removed from settings" src/services/themeSettings.js \
  't=t.replace("style_links:","style_linksX:")'

mutate "one style label dropped from settings" src/services/themeSettings.js \
  "t=t.replace(\"'Scandinavian'\",\"'Nordic'\")"

# --- THE ONE THAT WOULD SILENTLY BREAK THE PHONE ---
mutate "900px .mega-menu display:none!important restored (bundle)" public/css/site-bundle.css \
  't=t+"@media (max-width:900px){.mega-menu{display:none!important}}"'

mutate "900px .mega-menu display:none!important restored (source)" public/css/site.css \
  't=t+"@media (max-width:900px){.mega-menu{display:none!important}}"'

mutate ".nav-links force-hidden again (bundle)" public/css/site-bundle.css \
  't=t.replace(".nav-brand{display:none}",".nav-brand,.nav-links{display:none}")'

mutate ".nav-disclosure rules deleted (bundle)" public/css/site-bundle.css \
  't=t.replace(".nav-disclosure",".nav-disc")'

mutate "Safari marker rule deleted (bundle)" public/css/site-bundle.css \
  't=t.replace("::-webkit-details-marker{display:none}","")'

mutate "Firefox/Chrome marker rule deleted (bundle)" public/css/site-bundle.css \
  't=t.replace("summary{list-style:none;cursor:pointer}","summary{cursor:pointer}")'

mutate "dead .mobile-menu CSS reintroduced (bundle)" public/css/site-bundle.css \
  't=t+".mobile-menu{display:none}"'

mutate "over-broad cleanup eats .mobile-filter-btn" public/css/site-bundle.css \
  't=t.replace(".mobile-filter-btn",".mf-btn")'

# --- site.js ---
mutate "hamburger repointed back at #mobile-menu" public/js/site.js \
  't=t.replace("getElementById(\"primary-nav\")","getElementById(\"mobile-menu\")")'

mutate "aria-hidden stamped on the nav again (close)" public/js/site.js \
  't=t.replace("e.setAttribute(\"aria-expanded\",String(n))","e.setAttribute(\"aria-expanded\",String(n)),t.setAttribute(\"aria-hidden\",String(!n))")'

mutate "aria-hidden stamped on outside-click close" public/js/site.js \
  't=t.replace("e.setAttribute(\"aria-expanded\",\"false\")))","e.setAttribute(\"aria-expanded\",\"false\"),t.setAttribute(\"aria-hidden\",\"true\")))")'

mutate "hand-set aria-expanded on the trigger re-added" public/js/site.js \
  't=t+chr(10)+"document.querySelector(\".nav-mega-trigger\");"'

mutate "aria-expanded on the button removed" public/js/site.js \
  't=t.replace("e.setAttribute(\"aria-expanded\",String(n))","0")'

# --- the promo-card escaping bug coming back ---
mutate "promo title tag-stripping removed" views/partials/header.ejs \
  't=t.replace("_plain(_vmp.title, \x27Every Model, Every Finish\x27)","_vmp.title || \x27Every Model, Every Finish\x27")
if t==before: t=t.replace("_plain(_vmp.title","(_vmp.title")
t=t.replace("title:  \x27Every Model, Every Finish\x27","title:  \x27Every Model,<br>Every Finish\x27")'

mutate "br reintroduced into the settings default" src/services/themeSettings.js \
  "t=t.replace(\"title:  'Every Model, Every Finish'\",\"title:  'Every Model,\"+chr(60)+\"br>Every Finish'\")"

echo
echo "=== restore verification ==="
restore
DIRTY=$(git diff --name-only -- "${FILES[@]}" 2>/dev/null | grep -v '^$' || true)
# header.ejs / themeSettings.js / css / js SHOULD be dirty vs HEAD - the rewrite
# is uncommitted. What matters is that they match the pre-mutation backup.
CLEAN=1
for f in "${FILES[@]}"; do
  if ! cmp -s "$f" "$BAK/$(basename "$f")"; then
    echo "  !! $f does NOT match its pre-mutation backup"
    CLEAN=0
  fi
done
[ $CLEAN -eq 1 ] && echo "  ok   all 5 files byte-identical to their pre-mutation state"

echo
echo "=== gate passes again after restore ==="
node "$GATE" >/dev/null 2>&1 && echo "  ok" || echo "  !! gate FAILS after restore - tree is damaged"

echo
echo "caught: $PASSED    holes: $HOLES"
[ $HOLES -eq 0 ] && [ $CLEAN -eq 1 ] || exit 1
