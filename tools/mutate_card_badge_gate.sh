#!/bin/bash
# Run with: bash tools/mutate_card_badge_gate.sh
#
# Mutation sweep for gates/gate_card_badge_anchor.js.
#
# A gate is only worth the lines it occupies if it goes RED when the thing it
# guards is broken. Three gates shipped green over live bugs on 2026-10-02
# because each asserted the markup I had just written rather than the
# condition that had to hold. So each mutation below breaks a CONDITION and
# the gate has to notice.
#
# HARNESS NOTE, learned the hard way: the Python is passed through an
# environment variable into a QUOTED heredoc. An unquoted heredoc has the
# shell interpret the backslashes first, so \" reached Python as a syntax
# error and every mutation reported "gate still PASSED" — the harness itself
# was the thing that was broken, and it said the gate was.
set -u
cd "$(dirname "$0")/.."

GATE=gates/gate_card_badge_anchor.js
FILES="views/pages/index.ejs views/pages/collection.ejs views/pages/search.ejs
       views/pages/account/favorites.ejs views/pages/product.ejs
       public/css/site.css public/css/site-bundle.css
       views/layouts/main.ejs public/js/carousels.js"

TMP=$(mktemp -d)
for f in $FILES; do mkdir -p "$TMP/$(dirname "$f")"; cp "$f" "$TMP/$f"; done
restore() { for f in $FILES; do cp "$TMP/$f" "$f"; done; }
trap 'restore; rm -rf "$TMP"' EXIT

echo "=== baseline: the gate must PASS on a clean tree ==="
if node "$GATE" >/dev/null 2>&1; then echo "  ok  baseline PASSES"
else echo "  BASELINE IS RED — fix the tree before sweeping"; node "$GATE"; exit 1; fi

PASSED=0; CAUGHT=0; N=0

mutate() {  # mutate "<name>" "<python>"
  N=$((N+1))
  MUT_CODE="$2" python3 -c 'import os; exec(os.environ["MUT_CODE"])' 2>/tmp/mut.err
  if [ $? -ne 0 ]; then
    printf '  %2d  %-62s HARNESS ERROR\n' "$N" "$1"; sed 's/^/        /' /tmp/mut.err
    restore; return
  fi
  if node "$GATE" >/dev/null 2>&1; then
    printf '  %2d  %-62s GATE STILL PASSED  <-- HOLE\n' "$N" "$1"; PASSED=$((PASSED+1))
  else
    printf '  %2d  %-62s caught\n' "$N" "$1"; CAUGHT=$((CAUGHT+1))
  fi
  restore
}

sub() {  # helper emitted into each mutation
  :
}

echo
echo "=== mutations ==="

# ---- the defect itself, put back, one template at a time ----
for T in views/pages/index.ejs views/pages/collection.ejs views/pages/search.ejs \
         views/pages/account/favorites.ejs views/pages/product.ejs; do
mutate "badge moved back inside the link ($T)" "
f='$T'
s=open(f,encoding='utf-8').read()
import re
# move the first </a> that closes a product-img-link to AFTER the badge span
i=s.find('class=\"product-img-link\"')
j=s.find('</a>',i)
k=s.find('product-badge',j)
if k==-1: raise SystemExit('no badge in '+f)
e=s.find('</span>',k)+len('</span>')
s=s[:j]+s[j+len('</a>'):e]+'</a>'+s[e:]
open(f,'w',encoding='utf-8').write(s)
"
done

# ---- the anchor swallows the whole box again ----
mutate "anchor wraps .product-img again (index.ejs)" "
f='views/pages/index.ejs'
s=open(f,encoding='utf-8').read()
s=s.replace('''      <div class=\"product-img\">
        <a href=\"/products/<%= product.slug %>\" class=\"product-img-link\" aria-label=\"<%= product.name %>\">''','''      <a href=\"/products/<%= product.slug %>\" class=\"product-img-link\" aria-label=\"<%= product.name %>\">
        <div class=\"product-img\">''',1)
open(f,'w',encoding='utf-8').write(s)
"

# ---- the link stops wrapping the photo ----
mutate "image link wraps nothing (photo moved out, index.ejs)" "
f='views/pages/index.ejs'
s=open(f,encoding='utf-8').read()
i=s.find('class=\"product-img-link\"'); j=s.find('</a>',i)
inner=s[s.find('>',i)+1:j]
s=s[:s.find('>',i)+1]+s[j:j+len('</a>')]+inner+s[j+len('</a>'):]
open(f,'w',encoding='utf-8').write(s)
"

# ---- interactive content nested in the anchor ----
mutate "heart <button> back inside the link (collection.ejs)" "
f='views/pages/collection.ejs'
s=open(f,encoding='utf-8').read()
i=s.find('class=\"product-img-link\"'); j=s.find('</a>',i)
b=s.find('<button class=\"heart-btn'); e=s.find('</button>',b)+len('</button>')
blk=s[b:e]
s=s[:b]+s[e:]
j=s.find('</a>',s.find('class=\"product-img-link\"'))
s=s[:j]+blk+s[j:]
open(f,'w',encoding='utf-8').write(s)
"

# ---- a card disappears, so the count no longer covers the site ----
mutate "one product card deleted (product.ejs) — count drops to 6" "
f='views/pages/product.ejs'
s=open(f,encoding='utf-8').read()
i=s.find('<article class=\"product-card\"')
e=s.find('</article>',i)+len('</article>')
open(f,'w',encoding='utf-8').write(s[:i]+s[e:])
"

# ---- a template that cannot render ----
mutate "index.ejs made uncompilable" "
f='views/pages/index.ejs'
s=open(f,encoding='utf-8').read()
open(f,'w',encoding='utf-8').write(s.replace('<div class=\"product-img\">','<div class=\"product-img\"><% if (nope { %>',1))
"

# ---- CSS: each condition the new tree depends on, removed ----
for F in public/css/site.css public/css/site-bundle.css; do
mutate "flex-shrink:0 off .product-img ($F)" "
f='$F'
s=open(f,encoding='utf-8').read()
import re
s=re.sub(r'(\.product-img\{[^}]*?);flex-shrink:0', r'\1', s, count=1)
open(f,'w',encoding='utf-8').write(s)
"
mutate "position:relative off .product-img ($F)" "
f='$F'
s=open(f,encoding='utf-8').read()
import re
s=re.sub(r'(\.product-img\{[^}]*?)position:relative;', r'\1', s, count=1)
open(f,'w',encoding='utf-8').write(s)
"
mutate ".product-img-link back to display:block ($F)" "
f='$F'
s=open(f,encoding='utf-8').read()
import re
s=re.sub(r'\.product-img-link\{[^}]*\}', '.product-img-link{display:block;flex-shrink:0}', s, count=1)
open(f,'w',encoding='utf-8').write(s)
"
mutate "width/height:100% off .product-img-link ($F)" "
f='$F'
s=open(f,encoding='utf-8').read()
import re
s=re.sub(r'\.product-img-link\{[^}]*\}', '.product-img-link{display:flex;align-items:center;justify-content:center}', s, count=1)
open(f,'w',encoding='utf-8').write(s)
"
mutate "centring off .product-img-link — placeholder svg un-centres ($F)" "
f='$F'
s=open(f,encoding='utf-8').read()
import re
s=re.sub(r'\.product-img-link\{[^}]*\}', '.product-img-link{display:flex;width:100%;height:100%}', s, count=1)
open(f,'w',encoding='utf-8').write(s)
"
mutate "position:absolute off .product-badge ($F)" "
f='$F'
s=open(f,encoding='utf-8').read()
import re
s=re.sub(r'(\.product-badge\{)position:absolute;', r'\1', s, count=1)
open(f,'w',encoding='utf-8').write(s)
"
done

# ---- the edit that reaches no browser ----
mutate "cache buster reverted to v=28 — new markup, old rules" "
f='views/layouts/main.ejs'
s=open(f,encoding='utf-8').read()
open(f,'w',encoding='utf-8').write(s.replace('site-bundle.css?v=29','site-bundle.css?v=28',1))
"

# ---- the in-place colour swap assumes the old nesting again ----
mutate "carousels.js looks for badges inside the image link" "
f='public/js/carousels.js'
s=open(f,encoding='utf-8').read()
s=s.replace('''      var n = card.querySelector(sel);''','''      var n = card.querySelector('.product-img-link').querySelector(sel);''',1)
open(f,'w',encoding='utf-8').write(s)
"
# NOT a mutation any more: swapping parentNode.removeChild(n) for n.remove()
# was in this sweep and the gate "passed" it. The gate was right — n.remove()
# is equally parent-agnostic and equally correct, so the assertion demanding
# that exact spelling was a tautology and has been deleted from the gate.
# Replaced below with a mutation that is a REAL defect: the same lookup, taken
# from the document instead of the clicked card, which strips the badge off
# the first card on the page.
mutate "carousels.js finds badges on the document, not the clicked card" "
f='public/js/carousels.js'
s=open(f,encoding='utf-8').read()
s=s.replace('''      var n = card.querySelector(sel);''','''      var n = document.querySelector(sel);''',1)
open(f,'w',encoding='utf-8').write(s)
"

echo
echo "=== result ==="
echo "  mutations:  $N"
echo "  caught:     $CAUGHT"
echo "  holes:      $PASSED"
[ "$PASSED" -eq 0 ] && echo "  ALL MUTATIONS CAUGHT" || { echo "  GATE HAS HOLES"; exit 1; }
