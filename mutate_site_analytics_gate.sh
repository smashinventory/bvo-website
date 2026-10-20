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
X=gates/gate_site_analytics.js   # the gate itself, for the fixture mutation
pass=0; fail=0; stale=0
mutate () {
  cp "$S" /tmp/sa.s; cp "$C" /tmp/sa.c; cp "$A" /tmp/sa.a; cp "$P" /tmp/sa.p; cp "$K" /tmp/sa.k; cp "$V" /tmp/sa.v; cp "$G" /tmp/sa.g; cp "$J" /tmp/sa.j; cp "$X" /tmp/sa.x
  python3 - "$S" "$C" "$A" "$P" "$K" "$V" "$G" "$J" "$X" <<PY
import sys
sp,cp_,ap,pp,kp,vp,gp,jp,xp = sys.argv[1:10]
s=open(sp).read(); c=open(cp_).read(); a=open(ap).read(); p=open(pp).read(); k=open(kp).read(); v=open(vp).read(); g=open(gp).read(); j=open(jp).read(); x=open(xp).read()
_before=(s,c,a,p,k,v,g,j,x)
$2
# ANCHOR DETECTION, added 2026-10-19. Without this a mutation whose anchor
# has drifted is a silent no-op: the gate is run against UNMODIFIED source,
# passes, and the harness reports MISSED - indicting the gate for a fault in
# the test. Three anchors here had rotted that way (two from the stateful-
# session change, one from the revenue change) and were being read as gate
# blind spots.
if (s,c,a,p,k,v,g,j,x)==_before:
    sys.stderr.write('ANCHOR NOT FOUND\n'); sys.exit(3)
open(sp,'w').write(s); open(cp_,'w').write(c); open(ap,'w').write(a)
open(pp,'w').write(p); open(kp,'w').write(k); open(vp,'w').write(v)
open(gp,'w').write(g); open(jp,'w').write(j); open(xp,'w').write(x)
PY
  rc=$?
  if [ $rc -eq 3 ]; then echo "  ANCHOR-STALE  $1 — the test is broken, not the gate"
    cp /tmp/sa.s "$S"; cp /tmp/sa.c "$C"; cp /tmp/sa.a "$A"; cp /tmp/sa.p "$P"; cp /tmp/sa.k "$K"; cp /tmp/sa.v "$V"; cp /tmp/sa.g "$G"; cp /tmp/sa.j "$J"; cp /tmp/sa.x "$X"
    stale=$((stale+1)); return; fi
  if [ $rc -ne 0 ]; then echo "  SKIP $1 — mutation did not apply"
    cp /tmp/sa.s "$S"; cp /tmp/sa.c "$C"; cp /tmp/sa.a "$A"; cp /tmp/sa.p "$P"; cp /tmp/sa.k "$K"; cp /tmp/sa.v "$V"; cp /tmp/sa.g "$G"; cp /tmp/sa.j "$J"; cp /tmp/sa.x "$X"
    fail=$((fail+1)); return; fi
  if node gates/gate_site_analytics.js >/dev/null 2>&1; then echo "  MISSED  $1"; fail=$((fail+1));
  else echo "  caught  $1"; pass=$((pass+1)); fi
  cp /tmp/sa.s "$S"; cp /tmp/sa.c "$C"; cp /tmp/sa.a "$A"; cp /tmp/sa.p "$P"; cp /tmp/sa.k "$K"; cp /tmp/sa.v "$V"; cp /tmp/sa.g "$G"; cp /tmp/sa.j "$J"; cp /tmp/sa.x "$X"
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

# ⚠️ ANCHOR REPAIRED 2026-10-19. This read
#     'WHERE is_bot = 0\n       AND occurred_at'
# which targeted funnel(). The stateful-session change inserted
# 'AND ${STATEFUL}' between those two lines, so the anchor stopped matching
# funnel and instead matched cookielessShare() further down - a function that
# had no is_bot assertion, so the run reported MISSED and looked like a gate
# blind spot. Now pinned to funnel by including the intervening line.
mutate "bots are no longer filtered out of the funnel" "
c = c.replace('WHERE is_bot = 0\n       AND \${STATEFUL}', 'WHERE 1=1\n       AND \${STATEFUL}', 1)"

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
# ⚠️ ANCHOR REPAIRED 2026-10-19: cookielessShare(days) joined the
# Promise.all and `anon` joined the destructuring list.
c = c.replace('botShare(days), cookielessShare(days), coverage(), ga4.traffic(days),', 'botShare(days), cookielessShare(days), coverage(),')
c = c.replace('const [f, series, added, leaking, bots, anon, cov, traffic] = await Promise.all([',
              'const traffic = await ga4.traffic(days);\n    const [f, series, added, leaking, bots, anon, cov] = await Promise.all([')"

mutate "a Measurement ID in GA4_PROPERTY_ID is silently accepted" "
g = g.replace(\"const looksLikeMeasurementId = /^(G|UA|AW|GT)-/i.test(id);\", 'const looksLikeMeasurementId = false;')
g = g.replace(\"const looksNumeric           = /^\\\\d+\$/.test(id);\", 'const looksNumeric = true;')"

# ─────────────────────────────────────────────────────────────────────────
# 2026-10-19 — the stateful-session rule. "A client that never returns our
# cookie is not a session." See Rule 17 in BVO_AUDIT_BRIEF.md.
#
# Briefly written as a SEPARATE harness before anyone noticed this file
# already existed. Two harnesses for one gate is how a gate ends up with a
# green run and a red run at the same time, so they live here - which is
# also the pattern gate_order_delete / mutate_order_delete established.
# ─────────────────────────────────────────────────────────────────────────
echo; echo "the stateful-session rule"; echo

# The session-counting queries, ONE AT A TIME. A file-level grep passes
# while any single query has lost the predicate, because the others still
# carry the string - the hole gate_revenue_definition's harness found twice.
mutate "funnel() loses the stateful predicate" "
c = c.replace('  WHERE is_bot = 0\n       AND \${STATEFUL}\n       AND occurred_at >= DATE_SUB(NOW()', '  WHERE is_bot = 0\n       AND occurred_at >= DATE_SUB(NOW()', 1)"

mutate "daily() loses it" "
c = c.replace('      WHERE is_bot = 0\n        AND \${STATEFUL}\n        AND occurred_at >= DATE_SUB(CURDATE()', '      WHERE is_bot = 0\n        AND occurred_at >= DATE_SUB(CURDATE()', 1)"

mutate "topAdded() loses it" "
c = c.replace('      WHERE e.is_bot = 0\n        AND \${STATEFUL_E}', '      WHERE e.is_bot = 0', 1)"

mutate "viewedNotCarted loses it in the VIEWS subquery only" "
c = c.replace(\"WHERE is_bot = 0 AND \${STATEFUL} AND event_name = 'view_item'\", \"WHERE is_bot = 0 AND event_name = 'view_item'\", 1)"

mutate "viewedNotCarted loses it in the ADDS subquery only" "
c = c.replace(\"WHERE is_bot = 0 AND \${STATEFUL} AND event_name = 'add_to_cart'\", \"WHERE is_bot = 0 AND event_name = 'add_to_cart'\", 1)"

mutate "viewedNotCarted loses is_bot = 0, keeping the new predicate" "
c = c.replace('WHERE is_bot = 0 AND \${STATEFUL}', 'WHERE \${STATEFUL}')"

# Its own denominator. The page labels this 'of N unflagged events'; drop
# is_bot and flagged rows join the denominator, understating the share and
# stopping the >=50% banner from firing when it matters most.
mutate "cookielessShare stops filtering bots, corrupting its own denominator" "
i = c.index('async function cookielessShare')
c = c[:i] + c[i:].replace('WHERE is_bot = 0', 'WHERE 1=1', 1)"

# THE CLASSIC HOLE: commented-out code still satisfies a naive grep. Four
# checks fell to exactly this in gate_newsletter_signups on 2026-10-19.
mutate "funnel's predicate is COMMENTED OUT rather than removed" "
c = c.replace('  WHERE is_bot = 0\n       AND \${STATEFUL}\n       AND occurred_at', '  WHERE is_bot = 0\n       /* AND \${STATEFUL} */\n       AND occurred_at', 1)"

# ONE SOURCE for the prefix.
mutate "the controller hard-codes the prefix instead of asking the service" "
c = c.replace(\"const STATEFUL    = siteEvents.statefulPredicate('session_id');\", 'const STATEFUL    = chr(34) + chr(34);', 1).replace('chr(34) + chr(34);', '\\\"session_id NOT LIKE \\'anon-%\\'\\\";', 1)"

mutate "syntheticSessionId returns a literal instead of the constant" "
s = s.replace('return SYNTHETIC_PREFIX + hash;', \"return 'anon-' + hash;\", 1)"

# THE DRIFT. Minting and filtering must agree about one string, and no text
# check can see them disagree - both files still read perfectly. Only
# executing both catches it.
mutate "the prefix drifts: minting says anon-, filtering says anonymous-" "
s = s.replace(\"const SYNTHETIC_PREFIX = 'anon-';\", \"const SYNTHETIC_PREFIX = 'anonymous-';\", 1)
s = s.replace('return SYNTHETIC_PREFIX + hash;', \"return 'anon-' + hash;\", 1)"

mutate "cookielessPredicate is not the complement, it excludes too" "
i = s.index('function cookielessPredicate')
s = s[:i] + s[i:].replace('\${col} LIKE', '\${col} NOT LIKE', 1)"

mutate "statefulPredicate stops validating its column argument" "
import re
i = s.index('function statefulPredicate'); jj = s.index('function cookielessPredicate')
s = s[:i] + re.sub(r'  if \(!/\^\[A-Za-z_\][\s\S]*?\n  }\n', '', s[i:jj], count=1) + s[jj:]"

# The reporting half. Dropping 99% of rows in silence is the failure mode.
mutate "cookielessShare is dropped from the Promise.all" "
c = c.replace('botShare(days), cookielessShare(days), coverage()', 'botShare(days), coverage()', 1)
c = c.replace('const [f, series, added, leaking, bots, anon, cov, traffic]', 'const [f, series, added, leaking, bots, cov, traffic]', 1)"

# THE SILENT POSITIONAL SHIFT. Promise.all is positional: drop one name and
# every local after it binds to the wrong value. No error, no warning - the
# page quietly renders coverage data as its bot share. The only mutation
# here that leaves the file both valid AND running.
mutate "one name is dropped from the destructuring, shifting everything after it" "
c = c.replace('const [f, series, added, leaking, bots, anon, cov, traffic]', 'const [f, series, added, leaking, bots, cov, traffic]', 1)"

mutate "the page stops showing the cookieless share" "
v = v.replace('cookieless.cookieless', 'cookieless.total', 1)
v = v.replace('cookieless.pct === null', 'false', 1)"

# THE FIXTURE REPAIR ITSELF. gate_site_analytics was RED before 2026-10-19
# because its data fixture omitted cspNonce - a local set for EVERY template
# by global middleware (server.js:176). Proves the repair is load-bearing.
mutate "the data fixture loses cspNonce again" "
x = x.replace(\"        cspNonce: 'gate-nonce',\n\", '', 1)"

echo
echo "caught $pass, missed $fail, anchor-stale $stale"
if [ "$fail" -eq 0 ] && [ "$stale" -eq 0 ]; then echo "All $pass mutations detected. The gate can fail."
elif [ "$stale" -gt 0 ]; then echo "STALE ANCHORS — fix the tests above before trusting this run"; exit 1;
else echo "GATE HAS BLIND SPOTS"; exit 1; fi
