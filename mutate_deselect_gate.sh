#!/usr/bin/env bash
# Negative tests for gate_filter_deselect.js. Each mutation reintroduces a real
# way the deselect bug can come back. The gate must go RED for every one.
set -u
cd "$(dirname "$0")"
BK=$(mktemp -d)
cp public/js/site.js views/pages/collection.ejs src/routes/collections.js \
   src/middleware/publishFilterQuery.js "$BK/"
restore() {
  cp "$BK/site.js" public/js/site.js
  cp "$BK/collection.ejs" views/pages/collection.ejs
  cp "$BK/collections.js" src/routes/collections.js
  cp "$BK/publishFilterQuery.js" src/middleware/publishFilterQuery.js
}
trap restore EXIT

bad=0
try() {
  local label="$1"; shift
  "$@" >/dev/null 2>&1
  if node gates/gate_filter_deselect.js >/dev/null 2>&1; then
    echo "  BAD   gate still GREEN after: $label"; bad=$((bad+1))
  else
    echo "  good  gate went RED  after: $label"
  fi
  restore
}

m1() { perl -0pi -e 's/window\._bvoFilterGo\(o\.toString\(\)\)/window.location.search=o.toString()/' public/js/site.js; }
m2() { perl -0pi -e 's/window\.location\.href=\(b\|\|window\.location\.pathname\)/window.location.href=(window.location.pathname)/' public/js/site.js; }
m3() { perl -0pi -e 's/\Qnew URLSearchParams(q||window.location.search)\E/new URLSearchParams(window.location.search)/' public/js/site.js; }
m4() { python3 - <<'PYX'
import io
p='src/routes/collections.js'
s=io.open(p,encoding='utf-8').read()
a="router.use(require('../middleware/pathToFilter'));"
b="router.use(require('../middleware/publishFilterQuery'));"
assert s.count(a)==1 and s.count(b)==1
assert s.index(a) < s.index(b)
# swap the two mount lines: publisher now runs BEFORE the rewrite
s=s.replace(a,'@@A@@').replace(b,a).replace('@@A@@',b)
io.open(p,'w',encoding='utf-8').write(s)
PYX
}
m5() { perl -0pi -e "s{router.use\(require\('../middleware/publishFilterQuery'\)\);}{}" src/routes/collections.js; }
m6() { perl -0pi -e 's/data-base-path="\/collections\/<%= category.slug %>"/data-base-path="\/collections"/' views/pages/collection.ejs; }
m7() { perl -0pi -e 's/res\.locals\.filterQuery = i === -1 \? .. : u\.slice\(i \+ 1\);/res.locals.filterQuery = "";/' src/middleware/publishFilterQuery.js; }

echo
echo "Negative tests for gate_filter_deselect"
echo
try "a handler goes back to assigning location.search (the original bug)"   m1
try "_bvoFilterGo ignores data-base-path and keeps the current path"        m2
try "_bvoFilterParams stops seeding from the published query"               m3
try "publishFilterQuery mounted BEFORE pathToFilter (req.url not rewritten)" m4
try "publishFilterQuery not mounted at all"                                  m5
try "data-base-path drifts away from the Clear all href"                     m6
try "publishFilterQuery publishes an empty string for every request"         m7

echo
if [ "$bad" -gt 0 ]; then echo "NEGATIVE TESTS FAILED: $bad mutation(s) went undetected"; exit 1; fi
echo "All 7 mutations detected. The gate can fail."
