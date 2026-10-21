#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# mutate_deals_gate.sh — negative tests for gates/gate_deals_banners.js
#
# Run with:  bash mutate_deals_gate.sh
#
# Re-breaks the Deals banners one way at a time and confirms the gate goes RED
# for each. A gate nobody has tried to fool is not a gate — gate_free_order_
# checkout.js PASSED on the broken code it was written to protect, and only the
# harness found it.
#
# TWO RULES THIS SCRIPT ENFORCES ON ITSELF:
#
# 1. ANCHOR-AMBIGUOUS (Rule 17a). Every anchor must match EXACTLY ONCE in its
#    file. A pattern matching two places silently mutates the wrong one and
#    reports MISSED against a gate that is working perfectly. That happened
#    twice on 2026-10-20 and once today — `?,?,?` appears in two INSERTs.
#
# 2. NEVER ANCHOR ON PROSE (Rule 18 corollary). The deals block documents its
#    own past bugs by name, so `loading="lazy"` and `Number(raw)` both appear
#    inside comments explaining why they were wrong. An anchor that matches in
#    a comment edits the documentation, leaves the code intact, and reports
#    MISSED. Anchors below are chosen to exist only in live code.
# ─────────────────────────────────────────────────────────────────────────────
set -u
cd "$(dirname "$0")" || exit 1

GATE="gates/gate_deals_banners.js"
COLLECTION="views/pages/collection.ejs"
CONTROLLER="src/controllers/collectionsController.js"
ADMINCTRL="src/controllers/adminController.js"
PRODEDIT="views/pages/admin/product-edit.ejs"
THEME="views/pages/admin/theme.ejs"
SETTINGS="src/services/themeSettings.js"
FIXTURES="tests/fixtures/collectionLocals.js"
FACETS="src/utils/saleFacets.js"

ALL_FILES=("$COLLECTION" "$CONTROLLER" "$ADMINCTRL" "$PRODEDIT" "$THEME" "$SETTINGS" "$FIXTURES" "$FACETS")

BACKUP=$(mktemp -d) || exit 1
for f in "${ALL_FILES[@]}"; do
  mkdir -p "$BACKUP/$(dirname "$f")"
  cp "$f" "$BACKUP/$f" || { echo "cannot back up $f"; exit 1; }
done
restore() { for f in "${ALL_FILES[@]}"; do cp "$BACKUP/$f" "$f"; done; }
trap 'restore; rm -rf "$BACKUP"' EXIT

CAUGHT=0; MISSED=0; BROKEN=0

# baseline — the gate must be GREEN before any mutation, or every result below
# is meaningless.
if ! node "$GATE" >/dev/null 2>&1; then
  echo "ABORT: the gate is already RED before any mutation."
  node "$GATE" 2>&1 | grep -E '^\s+FAIL' | head -20
  exit 1
fi
echo "baseline: gate GREEN"
echo

# mutate <label> <file> <python-regex-find> <replace> <expect: catch|allow>
mutate() {
  local label="$1" file="$2" find="$3" repl="$4" expect="$5"
  restore

  local n
  n=$(FIND="$find" python3 -c "
import os,re,sys
pat=os.environ['FIND']
src=open(sys.argv[1],encoding='utf-8').read()
print(len(re.findall(pat,src)))
" "$file")

  if [ "$n" != "1" ]; then
    printf 'ANCHOR  %-54s matched %s times (need exactly 1)\n' "$label" "$n"
    BROKEN=$((BROKEN+1)); return
  fi

  FIND="$find" REPL="$repl" python3 -c "
import os,re,sys
src=open(sys.argv[1],encoding='utf-8').read()
src=re.sub(os.environ['FIND'],lambda m: os.environ['REPL'],src,count=1)
open(sys.argv[1],'w',encoding='utf-8').write(src)
" "$file"

  if node "$GATE" >/dev/null 2>&1; then
    if [ "$expect" = "allow" ]; then
      printf 'ok      %-54s correctly ALLOWED\n' "$label"; CAUGHT=$((CAUGHT+1))
    else
      printf 'MISSED  %-54s gate stayed GREEN\n' "$label"; MISSED=$((MISSED+1))
    fi
  else
    if [ "$expect" = "allow" ]; then
      printf 'FALSE+  %-54s gate went RED on a legitimate edit\n' "$label"; MISSED=$((MISSED+1))
    else
      printf 'ok      %-54s caught\n' "$label"; CAUGHT=$((CAUGHT+1))
    fi
  fi
}

echo "── LCP / CLS ────────────────────────────────────────────────────────────"
# Anchored on the attribute pair, which only the live <img> carries — the word
# "lazy" on its own appears in the comment above it explaining the old bug.
mutate 'M1  image back to loading="lazy"' "$COLLECTION" \
  'loading="eager" fetchpriority="high"' 'loading="lazy"' catch
mutate 'M2  drop fetchpriority' "$COLLECTION" \
  ' fetchpriority="high"' '' catch
mutate 'M3  drop width/height (CLS)' "$COLLECTION" \
  '           width="900" height="900">' '           >' catch

echo
echo "── SEO ──────────────────────────────────────────────────────────────────"
mutate 'M4  member headline back to an <h2>' "$COLLECTION" \
  '<p class="deals-offer-head"><%= _dbm\.heading' '<h2 class="deals-offer-head"><%= _dbm.heading' catch
mutate 'M5  drop the member aria-label' "$COLLECTION" \
  ' aria-label="New customer offer"' '' catch

echo
echo "── CSP ──────────────────────────────────────────────────────────────────"
mutate 'M6  hardcode the style nonce' "$COLLECTION" \
  '<style nonce="<%= cspNonce %>">' '<style nonce="static123">' catch

echo
echo "── the render guard ─────────────────────────────────────────────────────"
# A prefix match would pull the banners onto /collections/sales and SALE.
# ⚠️ The `) {` suffix is load-bearing. Bare `category.slug === 'sale'` matches
# THREE times: twice inside the comments that document why the test is exact,
# and once in the live guard. Mutating a comment leaves the code working and
# reports MISSED against a gate that is fine. Rule 18 corollary, in the wild.
mutate 'M7  exact slug match -> includes()' "$COLLECTION" \
  "category\.slug === 'sale'\) \{" "category.slug.includes('sale')) {" catch
# Dropping the typeof is the ReferenceError class — a 500, not a cosmetic bug.
mutate 'M8  typeof guard -> bare truthiness' "$COLLECTION" \
  "typeof category !== 'undefined' && category &&" 'category &&' catch
mutate 'M9  member toggle always on' "$COLLECTION" \
  '_dbm\.enabled !== false' 'true' catch
mutate 'M10 trade toggle always on' "$COLLECTION" \
  '_dbt\.enabled !== false' 'true' catch

echo
echo "── the threshold ────────────────────────────────────────────────────────"
# Anchored on the ternary, not on the string "Number(" — the comment above it
# quotes the old broken line verbatim.
mutate 'M11 empty-string test removed (Number("")===0)' "$CONTROLLER" \
  "\(_dealsRaw === '' \|\| _dealsRaw === null \|\| _dealsRaw === undefined\)\n        \? NaN\n        : Number\(_dealsRaw\)" \
  'Number(_dealsRaw)' catch
mutate 'M12 range guard removed' "$CONTROLLER" \
  'Number\.isFinite\(dealsPct\) && dealsPct >= 0 && dealsPct <= 100' 'true' catch
mutate 'M13 default drifts from themeSettings' "$CONTROLLER" \
  ': 0\.375;' ': 0.20;' catch

echo
echo "── the hand-pick, end to end ────────────────────────────────────────────"
mutate 'M14 compare_price > 0 removed (div by zero)' "$CONTROLLER" \
  '\n              AND p\.compare_price > 0' '' catch
mutate 'M15 hand-picks no longer sort first' "$CONTROLLER" \
  'ORDER BY p\.is_deal DESC, ' 'ORDER BY ' catch
mutate 'M16 silent catch restored on the sale query' "$CONTROLLER" \
  "console\.error\('\[collections\] sale query FAILED:'" "void(('')" catch
mutate 'M17 is_deal dropped from the UPDATE' "$ADMINCTRL" \
  'is_new=\?, is_deal=\?' 'is_new=?' catch
mutate 'M18 extractor uses === "1" (unchecked box sends no key)' "$ADMINCTRL" \
  "is_deal:           body\.is_deal      \? 1 : 0," "is_deal:           body.is_deal === '1' ? 1 : 0," catch
mutate 'M19 INSERT loses one placeholder (bind shift)' "$ADMINCTRL" \
  '\?,\?,\?,\?, \?,\?, \$\{IMG_URL_COLS' '?,?,?, ?,?, ${IMG_URL_COLS' catch
mutate 'M20 checkbox removed from the product form' "$PRODEDIT" \
  'name="is_deal"' 'name="is_deal_DISABLED"' catch

echo
echo "── Rule 5, both directions ──────────────────────────────────────────────"
mutate 'M21 editor loses a field the storefront reads' "$THEME" \
  'deals_banners\.member\.footnote' 'deals_banners.member.footnote_TYPO' catch
mutate 'M22 default removed for a live field' "$SETTINGS" \
  "      consent_note:  '" "      consent_note_TYPO:  '" catch

echo
echo "── the fixture itself ───────────────────────────────────────────────────"
mutate 'M23 SALE fixture renamed (coverage silently lost)' "$FIXTURES" \
  "'SALE \(virtual\)'" "'SALE_disabled'" catch
# Re-anchored 2026-10-21: the previous anchor was the hand-written
# total/page/perPage line, which no longer exists — the SALE fixture now
# derives those by calling the real buildSaleView. The harness anchor broke
# because the thing it pointed at was deliberately deleted, which is the
# stale-anchor case Rule 17a describes.
mutate 'M24 fixture invents a tradeMeter the controller never passes' "$FIXTURES" \
  '    availFinishes:\[\], availColorFamilies:\[\], colorFamiliesConfig:\[\],' \
  '    availFinishes:[], availColorFamilies:[], colorFamiliesConfig:[], tradeMeter:{target:20000,pct:40,spentLabel:"x",targetLabel:"y",remainingLabel:"z"},' allow

echo
echo "── sidebar facets ───────────────────────────────────────────────────────"
# The null-width guard. Without it Number(null) === 0 lands every widthless
# row — every faucet, every accessory — in the `20-` bucket.
mutate 'M25 null-width guard removed (Number(null)===0)' "$FACETS" \
  "  if \(width == null \|\| width === ''\) return false;\n" '' catch
# Rule 10: a facet must exclude its OWN filter, or it collapses to the one
# value just picked and the shopper cannot change their mind.
mutate 'M26 Brand facet stops excluding its own filter' "$FACETS" \
  'rows\.filter\(p => okType\(p\) && okSize\(p\) && okPrice\(p\)\)' \
  'rows.filter(p => okBrand(p) && okType(p) && okSize(p) && okPrice(p))' catch
mutate 'M27 Size facet stops excluding its own filter' "$FACETS" \
  'const sizeRows = rows\.filter\(p => okBrand\(p\) && okType\(p\) && okPrice\(p\)\);' \
  'const sizeRows = rows.filter(p => okBrand(p) && okType(p) && okSize(p) && okPrice(p));' catch
# numOrNull is what stops Number('') === 0 becoming a real price bound.
# ⚠️ EXPECTATION IS `allow`, AND THAT IS NOT A CONCESSION.
# Removing the `v === ''` guard changes nothing: parseFloat('') is NaN, which
# the Number.isFinite check below already rejects, so numOrNull('') returns
# null either way. The guard is belt-and-braces, not load-bearing, and a
# harness that demanded the gate catch a harmless edit would be training the
# gate to fire on correct code — the Rule 22 failure, where a gate cried wolf
# about its own product and got switched off.
#
# The LOAD-BEARING protection against Number('') === 0 is numOrNull existing
# at all rather than a bare Number() call. M28b below is that mutation.
mutate 'M28 numOrNull drops its redundant empty-string guard' "$FACETS" \
  "  if \(v == null \|\| v === ''\) return null;" '  if (v == null) return null;' allow

mutate 'M28b numOrNull replaced by a bare Number()' "$FACETS" \
  "  if \(v == null \|\| v === ''\) return null;\n  const n = parseFloat\(v\);\n  return Number\.isFinite\(n\) \? n : null;" \
  '  return Number(v);' catch
# An unpriced row must survive a price filter rather than vanish silently.
mutate 'M29 unpriced rows dropped by a price filter' "$FACETS" \
  '    if \(!Number\.isFinite\(v\)\) return true;' '    if (!Number.isFinite(v)) return false;' catch
mutate 'M30 price bounds narrow as the shopper filters' "$FACETS" \
  'const prices = rows\.map' 'const prices = matched0.map' catch
mutate 'M31 paging truncates the total to one page' "$FACETS" \
  'total: matched\.length,' 'total: products.length,' catch

echo
echo "── canonical / noindex ──────────────────────────────────────────────────"
mutate 'M32 canonical carries the query string' "$CONTROLLER" \
  'const saleCanonical = `\$\{_saleSiteUrl\}/collections/sale`;' \
  'const saleCanonical = `${_saleSiteUrl}/collections/sale?${require("querystring").stringify(req.query)}`;' catch
mutate 'M33 noindex never trips' "$CONTROLLER" \
  'saleView\.activeGroups >= 2' 'false' catch
mutate 'M34 canonical dropped from the render' "$CONTROLLER" \
  '        canonicalUrl: saleCanonical,\n' '' catch
mutate 'M35 pool truncated back to one page' "$CONTROLLER" \
  'LIMIT 300' 'LIMIT 48' catch
mutate 'M36 facet columns dropped from the SELECT' "$CONTROLLER" \
  '               p\.product_type, p\.width_in,\n' '' catch

echo
echo "── the three defects that actually shipped (4984ce4) ────────────────────"
# Every one of these was live. 108 gate checks were green over all three,
# because every check asserted what the markup SAYS and none followed a link,
# clicked a control, or looked at a width.
# Re-anchored: Phase 2 moved the member CTA to /account/login, which is
# what records the pending claim — /account/register is a bare redirect
# and the query string dies there.
mutate 'M37 CTA back to the dead /account/join' "$SETTINGS" \
  "cta_url:       '/account/login\?offer=platinum'," \
  "cta_url:       '/account/join?offer=platinum'," catch
mutate 'M38 trade sign-in back to the dead /account/signin' "$SETTINGS" \
  "signin_url:  '/account/login'," "signin_url:  '/account/signin'," catch
# /trade/apply is a REAL route now, so the dead-URL mutation has to use a
# URL that is still dead. Rule 19: the old assertion encoded a decision
# that Phase 2 reversed.
mutate 'M39 trade fallback pointed at a route that does not exist' "$COLLECTION" \
  "<%= _dbt\.cta_url \|\| '/trade/apply' %>" \
  "<%= _dbt.cta_url || '/trade/signup' %>" catch
mutate 'M40 checkbox back to a decorative span' "$COLLECTION" \
  '<input type="checkbox" name="optin" value="1" checked\n                 class="deals-consent-box">' \
  '<span class="deals-consent-box" aria-hidden="true"></span>' catch
mutate 'M41 optin loses its name (tick submits nothing)' "$COLLECTION" \
  '<input type="checkbox" name="optin" value="1" checked' \
  '<input type="checkbox" value="1" checked' catch
mutate 'M42 offer param moved onto the GET action (silently dropped)' "$COLLECTION" \
  'action="<%= _ctaPath %>"' 'action="<%= _ctaRaw %>"' catch
mutate 'M43 horizontal padding removed (full-bleed layout)' "$COLLECTION" \
  ';padding:28px 64px 0\}' '}' catch
mutate 'M44 media height cap removed (3500px image sets the height)' "$COLLECTION" \
  '\n\.deals-offer-media\{max-height:320px\}' '' catch

echo
echo "── control: a legitimate edit must NOT go red ───────────────────────────"
mutate 'C1  banner copy reworded' "$SETTINGS" \
  "heading:       'Your first order, 10% off\.'" "heading:       'Save 10% on your first order.'" allow
mutate 'C2  a CSS value tweaked' "$COLLECTION" \
  'gap:14px' 'gap:18px' allow

echo
echo "═════════════════════════════════════════════════════════════════════════"
echo "caught/allowed correctly: $CAUGHT    missed: $MISSED    bad anchors: $BROKEN"
if [ "$MISSED" -ne 0 ] || [ "$BROKEN" -ne 0 ]; then
  echo "RESULT: the gate has holes, or this harness has stale anchors. Both need fixing."
  exit 1
fi
echo "RESULT: every mutation handled as intended."
