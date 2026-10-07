#!/bin/bash
# Negative test for gate_site_analytics.js.
set -u
cd "$(dirname "$0")"
S=src/services/siteEvents.js
C=src/controllers/siteAnalyticsController.js
A=src/controllers/cartController.js
P=src/controllers/productsController.js
K=src/controllers/checkoutController.js
V=views/pages/admin/marketing/site-analytics.ejs
G=src/services/ga4.js
J=package.json
pass=0; fail=0
mutate () {
  cp "$S" /tmp/sa.s; cp "$C" /tmp/sa.c; cp "$A" /tmp/sa.a; cp "$P" /tmp/sa.p; cp "$K" /tmp/sa.k; cp "$V" /tmp/sa.v; cp "$G" /tmp/sa.g; cp "$J" /tmp/sa.j
  python3 - "$S" "$C" "$A" "$P" "$K" "$V" "$G" "$J" <<PY
import sys
sp,cp_,ap,pp,kp,vp,gp,jp = sys.argv[1:9]
s=open(sp).read(); c=open(cp_).read(); a=open(ap).read(); p=open(pp).read(); k=open(kp).read(); v=open(vp).read(); g=open(gp).read(); j=open(jp).read()
$2
open(sp,'w').write(s); open(cp_,'w').write(c); open(ap,'w').write(a)
open(pp,'w').write(p); open(kp,'w').write(k); open(vp,'w').write(v)
open(gp,'w').write(g); open(jp,'w').write(j)
PY
  if [ $? -ne 0 ]; then echo "  SKIP $1 — mutation did not apply"
    cp /tmp/sa.s "$S"; cp /tmp/sa.c "$C"; cp /tmp/sa.a "$A"; cp /tmp/sa.p "$P"; cp /tmp/sa.k "$K"; cp /tmp/sa.v "$V"; cp /tmp/sa.g "$G"; cp /tmp/sa.j "$J"
    fail=$((fail+1)); return; fi
  if node gates/gate_site_analytics.js >/dev/null 2>&1; then echo "  MISSED  $1"; fail=$((fail+1));
  else echo "  caught  $1"; pass=$((pass+1)); fi
  cp /tmp/sa.s "$S"; cp /tmp/sa.c "$C"; cp /tmp/sa.a "$A"; cp /tmp/sa.p "$P"; cp /tmp/sa.k "$K"; cp /tmp/sa.v "$V"; cp /tmp/sa.g "$G"; cp /tmp/sa.j "$J"
  node gates/gate_site_analytics.js >/dev/null 2>&1 || { echo "  ABORT — restore failed"; exit 1; }
}

echo; echo "mutating the first-party funnel"; echo

mutate "revenue starts coming from the events table instead of orders" "
c = c.replace('COALESCE(SUM(o.total), 0) AS revenue', 'COALESCE(SUM(e.value_cents)/100, 0) AS revenue')"

mutate "orders stop excluding test and cancelled rows" "
c = c.replace(\"o.is_test = 0 AND o.status <> 'cancelled'\", '1=1')"

# Moves the block ABOVE the guard. The first version moved it above
# `const qty = ...`, which is itself already past the guard - so the
# ordering the gate checks was never actually broken and the harness
# reported a MISS against a sound check.
mutate "add_to_cart is recorded BEFORE the \$0 price guard" "
import re
m = re.search(r'\n  /\* RECORDED HERE.*?\n  siteEvents\.record\(req, .add_to_cart.*?\}\);\n', a, re.S)
assert m
block = m.group(0)
a = a.replace(block, '\n')
anchor = '  if (!Number.isFinite(pricef) || pricef <= 0) {'
assert anchor in a
a = a.replace(anchor, block + anchor, 1)"

mutate "the cart add records a client-supplied value instead of the DB price" "
a = a.replace('value:      pricef * qty,', 'value:      req.body.price,')"

mutate "a recording point is dropped (view_item)" "
import re
p = re.sub(r'\n    siteEvents\.record\(req, .view_item.[\s\S]*?\}\);\n', '\n', p)"

mutate "begin_checkout moves to the email gate instead of checkout-info" "
import re
m = re.search(r'\n  /\* begin_checkout[\s\S]*?\n  \}\);\n', k)
assert m
blk = m.group(0)
k = k.replace(blk, '\n')
k = k.replace(\"  return res.render('pages/checkout-identify'\", blk + \"  return res.render('pages/checkout-identify'\", 1)"

mutate "record() is awaited, so a slow DB stalls the cart" "
a = a.replace('  siteEvents.record(req, \'add_to_cart\'', '  await siteEvents.record(req, \'add_to_cart\'')"

mutate "record() stops swallowing errors" "
s = s.replace('  } catch (err) {', '  } catch (err) { throw err; } finally { if(false) {')
s = s.replace(\"    console.error('[siteEvents] record failed (ignored):', err && err.message);\", '')
s = s.replace('  }\n}\n\nmodule.exports', '  } }\n}\n\nmodule.exports')"

mutate "the funnel counts raw events instead of distinct sessions" "
c = c.replace('COUNT(DISTINCT CASE WHEN event_name', 'COUNT(CASE WHEN event_name')"

mutate "bots are no longer filtered out of the funnel" "
c = c.replace('WHERE is_bot = 0\n       AND occurred_at', 'WHERE 1=1\n       AND occurred_at', 1)"

mutate "bot volume stops being reported" "
c = c.replace('SUM(is_bot = 1) AS bot', '0 AS bot')"

mutate "the empty state shows zeros instead of saying recording has not begun" "
v = v.replace('No events recorded yet', 'All quiet')"

mutate "the empty state renders a 0% rate" "
v = v.replace(\"<% if (s.rate === null) { %><span class=\\\"sa-muted\\\"><%= s.of %></span>\",
              \"<% if (s.rate === null) { %><strong>0%</strong>\")"

mutate "the chart is drawn even with nothing to plot" "
v = v.replace('<% if (coverage.total === 0) { %>', '<% if (false) { %>', 1)"

mutate "money is stored as a float column" "
s = s.replace('value_cents  INT', 'value_cents  FLOAT')"

mutate "the table stops self-healing, so a fresh server has no table" "
s = s.replace('CREATE TABLE IF NOT EXISTS site_events', 'SELECT 1 FROM site_events')"

echo; echo "mutating the GA4 half"; echo

mutate "a Google client library is added as a dependency" "
import json
d = json.loads(j)
d.setdefault('dependencies', {})['@google-analytics/data'] = '^4.0.0'
j = json.dumps(d, indent=2)"

mutate "the read-only scope is widened to edit" "
g = g.replace('auth/analytics.readonly', 'auth/analytics.edit')"

mutate "a failing GA4 call propagates instead of being caught" "
g = g.replace(\"    console.error('[ga4] traffic failed (ignored):', err && err.message);\", '    throw err;')"

mutate "an unconfigured GA4 throws instead of returning ok:false" "
g = g.replace('    return { ok: false, configured: false,', '    throw new Error(')"

mutate "the response cache is removed, so refreshing burns GA quota" "
g = g.replace('const TTL_MS = 10 * 60 * 1000;', 'const TTL_MS = 0;')
g = g.replace('const _cache = new Map();', '')"

mutate "the private key is read from theme settings instead of env" "
g = g.replace(\"(process.env.GA4_SA_KEY      || '')\", \"(require('./themeSettings').get().seo.ga_key || '')\")"

mutate "traffic is awaited separately, stalling the local queries" "
c = c.replace('botShare(days), coverage(), ga4.traffic(days),', 'botShare(days), coverage(),')
c = c.replace('const [f, series, added, leaking, bots, cov, traffic] = await Promise.all([',
              'const traffic = await ga4.traffic(days);\n    const [f, series, added, leaking, bots, cov] = await Promise.all([')"

mutate "a Measurement ID in GA4_PROPERTY_ID is silently accepted" "
g = g.replace(\"const looksLikeMeasurementId = /^(G|UA|AW|GT)-/i.test(id);\", 'const looksLikeMeasurementId = false;')
g = g.replace(\"const looksNumeric           = /^\\\\d+\$/.test(id);\", 'const looksNumeric = true;')"

echo
echo "caught $pass, missed $fail"
if [ "$fail" -eq 0 ]; then echo "All $pass mutations detected. The gate can fail."
else echo "GATE HAS BLIND SPOTS"; exit 1; fi
