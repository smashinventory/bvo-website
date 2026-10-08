#!/bin/bash
# Negative test for gate_ga_events.js.
set -u
cd "$(dirname "$0")"
G=src/services/gaEvents.js
P=src/controllers/productsController.js
A=src/controllers/cartController.js
K=src/controllers/checkoutController.js
S=src/server.js
L=views/layouts/main.ejs
pass=0; fail=0
mutate () {
  cp "$G" /tmp/ge.g; cp "$P" /tmp/ge.p; cp "$A" /tmp/ge.a; cp "$K" /tmp/ge.k; cp "$S" /tmp/ge.s; cp "$L" /tmp/ge.l
  python3 - "$G" "$P" "$A" "$K" "$S" "$L" <<PY
import sys
gp,pp,ap,kp,sp,lp = sys.argv[1:7]
g=open(gp).read(); p=open(pp).read(); a=open(ap).read(); k=open(kp).read(); s=open(sp).read(); l=open(lp).read()
$2
open(gp,'w').write(g); open(pp,'w').write(p); open(ap,'w').write(a)
open(kp,'w').write(k); open(sp,'w').write(s); open(lp,'w').write(l)
PY
  if [ $? -ne 0 ]; then echo "  SKIP $1 — mutation did not apply"
    cp /tmp/ge.g "$G"; cp /tmp/ge.p "$P"; cp /tmp/ge.a "$A"; cp /tmp/ge.k "$K"; cp /tmp/ge.s "$S"; cp /tmp/ge.l "$L"
    fail=$((fail+1)); return; fi
  if node gates/gate_ga_events.js >/dev/null 2>&1; then echo "  MISSED  $1"; fail=$((fail+1));
  else echo "  caught  $1"; pass=$((pass+1)); fi
  cp /tmp/ge.g "$G"; cp /tmp/ge.p "$P"; cp /tmp/ge.a "$A"; cp /tmp/ge.k "$K"; cp /tmp/ge.s "$S"; cp /tmp/ge.l "$L"
  node gates/gate_ga_events.js >/dev/null 2>&1 || { echo "  ABORT — restore failed"; exit 1; }
}

echo; echo "mutating the GA4 ecommerce events"; echo

# ── THE ordering bug this gate exists for
mutate "purchase is queued AFTER the cart is cleared (fires with no items)" "
import re
m = re.search(r'\n  /\* GA4 purchase.*?\n  \}\);\n', k, re.S)
assert m
blk = m.group(0)
k = k.replace(blk, '\n')
anchor = '  req.session.cart = { items: [], count: 0, subtotal: 0 };\n\n  /* And the draft handle'
assert anchor in k
k = k.replace(anchor, '  req.session.cart = { items: [], count: 0, subtotal: 0 };\n' + blk + '\n  /* And the draft handle', 1)"

mutate "purchase valued from the cart subtotal instead of Stripe amount_total" "
k = k.replace('value:          req.session.lastOrder.total || 0,', 'value:          req.session.cart.subtotal || 0,')"

mutate "transaction_id dropped, so a refreshed success page double-counts" "
import re
k = re.sub(r'\n    transaction_id: req\.session\.lastOrder\.orderNumber \|\| undefined,', '', k)"

# ── the flush mechanism
mutate "gaFlush becomes an eager value instead of a render-time function" "
s = s.replace(\"res.locals.gaFlush    = () => require('./services/gaEvents').flush(req);\",
              \"res.locals.gaFlush    = require('./services/gaEvents').flush(req);\")"

mutate "the layout stops flushing the queue" "
import re
l = re.sub(r'  <% var _gaQ = .*?\n  <% if \(_gaQ\).*?\n', '', l, flags=re.S)"

mutate "the emitted script loses its CSP nonce" "
l = l.replace('<script nonce=\"<%= cspNonce %>\"><%- _gaQ %></script>', '<script><%- _gaQ %></script>')"

# Anchored on the gtag config block itself. The first version tried to
# re-insert relative to a comment containing box-drawing characters and
# silently did nothing, so the harness reported a MISS against a sound check.
mutate "the flush is emitted before gtag is defined" "
import re
m = re.search(r'  <% var _gaQ = [\\s\\S]*?<% \\} %>\\n', l)
assert m, 'flush block not found'
blk = m.group(0)
l = l.replace(blk, '')
anchor = '  <% if (_gaId && !(typeof gtmId'
assert anchor in l, 'gtag config block not found'
l = l.replace(anchor, blk + anchor, 1)"

mutate "</script> in a product name is no longer escaped" "
g = g.replace(\".replace(/</g, '\\\\\\\\u003c')\", '')"

mutate "the queue is no longer cleared, so events repeat on every page" "
g = g.replace('req.session.gaQueue = [];', '')"

mutate "the queue cap is removed" "
g = g.replace('if (q.length >= MAX_QUEUED) return;', '')"

mutate "an empty cart now queues a purchase with no items" "
g = g.replace('if (!items.length) return;', '')"

mutate "the gtag call is no longer wrapped, so a blocked tag throws in the page" "
g = g.replace(\"'function _bvoGa(n,p){try{' +\", \"'function _bvoGa(n,p){' +\")
g = g.replace(\"'}catch(e){}}' + calls\", \"'}' + calls\")"

mutate "the dataLayer fallback is dropped, breaking the day GTM_ID is set" "
g = g.replace('else if(window.dataLayer){window.dataLayer.push({event:n,ecommerce:p});}', '')"

# ── a recording point going missing
mutate "view_item is no longer sent to GA4" "
import re
p = re.sub(r'\n    gaEvents\.viewItem\(req, product\);', '', p)"

mutate "add_to_cart is no longer sent to GA4" "
import re
a = re.sub(r'\n  gaEvents\.addToCart\(req, \{[^\n]*\n', '\n', a)"

# ── the first-party record must not be replaced by the GA one
mutate "the first-party add_to_cart is dropped in favour of the GA event" "
import re
a = re.sub(r\"\n  siteEvents\.record\(req, 'add_to_cart', \{[\s\S]*?\n  \}\);\n\", '\n', a)"

echo
echo "caught $pass, missed $fail"
if [ "$fail" -eq 0 ]; then echo "All $pass mutations detected. The gate can fail."
else echo "GATE HAS BLIND SPOTS"; exit 1; fi
