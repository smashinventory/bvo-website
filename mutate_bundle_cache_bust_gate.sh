#!/bin/bash
# Negative test for gate_bundle_cache_bust.js.
set -u
cd "$(dirname "$0")"
M=views/layouts/main.ejs
B=public/css/site-bundle.css
R=public/css/bundle-version.json
pass=0; fail=0
mutate () {
  cp "$M" /tmp/cb.m; cp "$B" /tmp/cb.b; cp "$R" /tmp/cb.r
  python3 - "$M" "$B" "$R" <<PY
import sys
mp,bp,rp = sys.argv[1],sys.argv[2],sys.argv[3]
m=open(mp).read(); b=open(bp).read(); r=open(rp).read()
$2
open(mp,'w').write(m); open(bp,'w').write(b); open(rp,'w').write(r)
PY
  if [ $? -ne 0 ]; then echo "  SKIP $1 — mutation did not apply"; cp /tmp/cb.m "$M"; cp /tmp/cb.b "$B"; cp /tmp/cb.r "$R"; fail=$((fail+1)); return; fi
  if node gates/gate_bundle_cache_bust.js >/dev/null 2>&1; then echo "  MISSED  $1"; fail=$((fail+1));
  else echo "  caught  $1"; pass=$((pass+1)); fi
  cp /tmp/cb.m "$M"; cp /tmp/cb.b "$B"; cp /tmp/cb.r "$R"
  node gates/gate_bundle_cache_bust.js >/dev/null 2>&1 || { echo "  ABORT — restore failed"; exit 1; }
}

echo; echo "mutating the cache-bust guard"; echo

mutate "the bundle changes and nobody bumps the version (the actual bug)" "
b = b + '\n.a-new-rule{color:red}'"

mutate "the version is bumped but the hash is not re-recorded" "
m = m.replace('site-bundle.css?v=45', 'site-bundle.css?v=46')"

mutate "the hash is re-recorded but main.ejs is left behind" "
import json,hashlib
d=json.loads(r); d['v']=46; r=json.dumps(d,indent=2)"

mutate "a second bundle link tag appears, so one can go stale unnoticed" "
m = m.replace('<link rel=\"stylesheet\" href=\"/css/site-bundle.css?v=45\">',
              '<link rel=\"stylesheet\" href=\"/css/site-bundle.css?v=45\">\n<link rel=\"stylesheet\" href=\"/css/site-bundle.css?v=44\">')"

mutate "the bump is not recorded in the version history comment" "
m = m.replace('v=45 (2026-10-07)', 'v=XX (2026-10-07)')"
echo
echo "caught $pass, missed $fail"
if [ "$fail" -eq 0 ]; then echo "All $pass mutations detected. The gate can fail."
else echo "GATE HAS BLIND SPOTS"; exit 1; fi
