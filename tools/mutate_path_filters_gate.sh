#!/bin/bash
# Run with: bash tools/mutate_path_filters_gate.sh
#
# Mutation sweep for gates/gate_path_filters.js.
#
# The mutation that matters most is #1. Deleting the req.query assignment
# leaves a clean path that resolves, renders, returns 200, and shows the
# WRONG PRODUCTS — every vanity instead of the 951 Farmhouse ones. Nothing
# errors, nothing logs, the page looks correct. If the gate does not catch
# that one, it is not worth running.
#
# HARNESS NOTE: Python goes through an env var into a QUOTED heredoc. An
# unquoted heredoc lets the shell eat the backslashes first, so \" reached
# Python as a syntax error and every mutation reported "gate still PASSED" —
# the harness breaking looked exactly like the gate being useless.
set -u
cd "$(dirname "$0")/.."

GATE=gates/gate_path_filters.js
FILES="src/config/pathFilters.js src/middleware/pathToFilter.js src/routes/collections.js
       src/config/colorFamilies.js docs/architecture/PATH_FILTERS_ROLLBACK.md"

TMP=$(mktemp -d)
for f in $FILES; do mkdir -p "$TMP/$(dirname "$f")"; cp "$f" "$TMP/$f"; done
restore() { for f in $FILES; do cp "$TMP/$f" "$f"; done; }
trap 'restore; rm -rf "$TMP"' EXIT

echo "=== baseline ==="
node "$GATE" >/dev/null 2>&1 && echo "  ok  baseline PASSES" \
  || { echo "  BASELINE IS RED"; node "$GATE"; exit 1; }

PASSED=0; CAUGHT=0; N=0
mutate() {
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

M=src/middleware/pathToFilter.js
C=src/config/pathFilters.js
R=src/routes/collections.js

echo
echo "=== THE SILENT FAILURE ==="

mutate "req.query NOT set — path resolves, page shows every product" "
f='$M'; s=open(f,encoding='utf-8').read()
i=s.find('  const merged = {};')
j=s.find('  req.pathFilter')
s=s[:i]+s[j:]
open(f,'w',encoding='utf-8').write(s)
"

mutate "req.url NOT rewritten" "
f='$M'; s=open(f,encoding='utf-8').read()
s=s.replace(\"  req.url = \`/\${slug}\${search ? '?' + search : ''}\`;\",'',1)
open(f,'w',encoding='utf-8').write(s)
"

echo
echo "=== wrong values: the page renders, with the wrong products ==="

mutate "a colour family key is wrong (wood_d -> wood_dark)" "
f='$C'; s=open(f,encoding='utf-8').read()
s=s.replace(\"'dark-wood':   'wood_d',\",\"'dark-wood':   'wood_dark',\",1)
open(f,'w',encoding='utf-8').write(s)
"

mutate "a style value is wrong (Mid-Century Modern -> Mid Century Modern)" "
f='$C'; s=open(f,encoding='utf-8').read()
s=s.replace(\"'mid-century-modern':  'Mid-Century Modern',\",\"'mid-century-modern':  'Mid Century Modern',\",1)
open(f,'w',encoding='utf-8').write(s)
"

mutate "a size value is wrong ('84+' -> '84')" "
f='$C'; s=open(f,encoding='utf-8').read()
s=s.replace(\"'84-inch-and-over':  '84+',\",\"'84-inch-and-over':  '84',\",1)
open(f,'w',encoding='utf-8').write(s)
"

mutate "a style value is dropped from the map" "
f='$C'; s=open(f,encoding='utf-8').read()
s=s.replace(\"      'coastal':             'Coastal',\n\",'',1)
open(f,'w',encoding='utf-8').write(s)
"

mutate "the slash value is 'simplified' away" "
f='$C'; s=open(f,encoding='utf-8').read()
s=s.replace(\"'european-old-world':  'European / Old World',\",\"'european-old-world':  'European Old World',\",1)
open(f,'w',encoding='utf-8').write(s)
"

echo
echo "=== slug hygiene ==="

mutate "a slug contains a space (needs escaping, so not a clean URL)" "
f='$C'; s=open(f,encoding='utf-8').read()
s=s.replace(\"'light-wood':  'wood_l',\",\"'light wood':  'wood_l',\",1)
open(f,'w',encoding='utf-8').write(s)
"

mutate "a slug has a doubled hyphen" "
f='$C'; s=open(f,encoding='utf-8').read()
s=s.replace(\"'med-wood':    'wood_m',\",\"'med--wood':    'wood_m',\",1)
open(f,'w',encoding='utf-8').write(s)
"

echo
echo "=== scope: a facet must not apply where it has no meaning ==="

mutate "size becomes valid on /collections/faucets" "
f='$C'; s=open(f,encoding='utf-8').read()
i=s.find('  size: {'); j=s.find('collections:', i); k=s.find(']', j)
s=s[:k]+\", 'faucets'\"+s[k:]
open(f,'w',encoding='utf-8').write(s)
"

mutate "sink config becomes valid on the plain vanities collection" "
f='$C'; s=open(f,encoding='utf-8').read()
i=s.find(\"'sink': {\"); j=s.find('collections:', i); k=s.find(']', j)
s=s[:k]+\", 'bathroom-vanities'\"+s[k:]
open(f,'w',encoding='utf-8').write(s)
"

mutate "an unknown value starts resolving instead of returning null" "
f='$C'; s=open(f,encoding='utf-8').read()
s=s.replace('  if (value === undefined) return null;','  if (value === undefined) return { param: f.param, value: valueSlug };',1)
open(f,'w',encoding='utf-8').write(s)
"

echo
echo "=== brand, which is deliberately NOT converted ==="

mutate "brand is added to the map before the mismatch is checked" "
f='$C'; s=open(f,encoding='utf-8').read()
s=s.replace('const FLAGS = {','''const _BRAND = {
  brand: { param: 'brand', collections: ['bathroom-vanities'],
           values: { 'james-martin': 'James Martin Vanities' } },
};
Object.assign(FACETS, _BRAND);

const FLAGS = {''',1)
open(f,'w',encoding='utf-8').write(s)
"

echo
echo "=== the mount, and the escape hatch ==="

mutate "the middleware is not mounted at all" "
f='$R'; s=open(f,encoding='utf-8').read()
s=s.replace(\"router.use(require('../middleware/pathToFilter'));\",'',1)
open(f,'w',encoding='utf-8').write(s)
"

mutate "mounted AFTER /:slug, so it never runs" "
f='$R'; s=open(f,encoding='utf-8').read()
s=s.replace(\"router.use(require('../middleware/pathToFilter'));\",'',1)
s=s.replace(\"router.get('/:slug', controller.show);\",\"router.get('/:slug', controller.show);\nrouter.use(require('../middleware/pathToFilter'));\",1)
open(f,'w',encoding='utf-8').write(s)
"

mutate "next() is not called — the request hangs" "
f='$M'; s=open(f,encoding='utf-8').read()
s=s.replace('        return next();','        return;',1)
open(f,'w',encoding='utf-8').write(s)
"

mutate "an unresolved path is mangled instead of left alone" "
f='$M'; s=open(f,encoding='utf-8').read()
s=s.replace('''      const hit = pathFilters.resolveFacet(parts[0], parts[1], parts[2]);
      if (hit) {''','''      const hit = pathFilters.resolveFacet(parts[0], parts[1], parts[2]);
      req.url = '/' + parts[0];
      if (hit) {''',1)
open(f,'w',encoding='utf-8').write(s)
"

mutate "existing query params are discarded (sort and page lost)" "
f='$M'; s=open(f,encoding='utf-8').read()
i=s.find('  for (const [k, v] of Object.entries(req.query || {})) {')
j=s.find('  for (const [k, v] of Object.entries(params))')
s=s[:i]+s[j:]
open(f,'w',encoding='utf-8').write(s)
"

mutate "the middleware starts requiring the controller (second filter path)" "
f='$M'; s=open(f,encoding='utf-8').read()
s=s.replace(\"const modelSlug   = require('../utils/modelSlug');\",\"const modelSlug   = require('../utils/modelSlug');\nconst ctrl = require('../controllers/collectionsController');\",1)
open(f,'w',encoding='utf-8').write(s)
"

mutate "the middleware starts querying the database" "
f='$M'; s=open(f,encoding='utf-8').read()
s=s.replace(\"const modelSlug   = require('../utils/modelSlug');\",\"const modelSlug   = require('../utils/modelSlug');\nconst { bvoPool } = require('../config/database');\",1)
open(f,'w',encoding='utf-8').write(s)
"

mutate "a throw escapes the middleware (try/catch removed)" "
f='$M'; s=open(f,encoding='utf-8').read()
s=s.replace('  try {','  if (true) {',1)
i=s.find('  } catch (err) {')
j=s.find('};', i)
s=s[:i]+'  }\n  return next();\n'+s[j:]
open(f,'w',encoding='utf-8').write(s)
"

echo
echo "=== THE SEAL: filtering code must not change ==="

mutate "a sealed filtering file is edited (colorFamilies)" "
f='src/config/colorFamilies.js'; s=open(f,encoding='utf-8').read()
open(f,'w',encoding='utf-8').write(s+'\n/* mutation */\n')
"

echo
echo "=== the rollback doc ==="

mutate "the rollback doc is deleted" "
import os; os.remove('docs/architecture/PATH_FILTERS_ROLLBACK.md')
"

mutate "the rollback doc loses its panic button" "
f='docs/architecture/PATH_FILTERS_ROLLBACK.md'; s=open(f,encoding='utf-8').read()
open(f,'w',encoding='utf-8').write(s.replace('PANIC BUTTON','Notes',1))
"

echo
echo "=== result ==="
echo "  mutations:  $N"
echo "  caught:     $CAUGHT"
echo "  holes:      $PASSED"
[ "$PASSED" -eq 0 ] && echo "  ALL MUTATIONS CAUGHT" || { echo "  GATE HAS HOLES"; exit 1; }
