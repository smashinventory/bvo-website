#!/bin/bash
# Run with: bash tools/mutate_model_slugs_gate.sh
#
# Mutation sweep for gates/gate_model_slugs.js.
#
# This gate guards a rule that cannot be changed later: once a model URL is
# live, the slug rule is frozen by every link and redirect pointing at it.
# So the gate has to be red for every way the rule could be got wrong, and
# the only way to know that is to get it wrong on purpose.
#
# HARNESS NOTE: the Python goes through an environment variable into a
# QUOTED heredoc. An unquoted heredoc lets the shell eat the backslashes
# first, so \" reached Python as a syntax error and every mutation reported
# "gate still PASSED" — the harness breaking looked exactly like the gate
# being useless. Cost an hour on 2026-10-02.
set -u
cd "$(dirname "$0")/.."

GATE=gates/gate_model_slugs.js
FILES="src/utils/modelSlug.js"
SNAP=src/config/modelSlugs.json

TMP=$(mktemp -d)
for f in $FILES; do mkdir -p "$TMP/$(dirname "$f")"; cp "$f" "$TMP/$f"; done
HAD_SNAP=0; [ -f "$SNAP" ] && { HAD_SNAP=1; cp "$SNAP" "$TMP/snap.json"; }
HAD_CONSUMER=0

restore() {
  for f in $FILES; do cp "$TMP/$f" "$f"; done
  if [ "$HAD_SNAP" = 1 ]; then cp "$TMP/snap.json" "$SNAP"; else rm -f "$SNAP"; fi
  [ "$HAD_CONSUMER" = 1 ] && rm -f src/utils/__mut_consumer.js
  HAD_CONSUMER=0
}
trap 'restore; rm -rf "$TMP"' EXIT

echo "=== baseline: the gate must PASS on a clean tree ==="
if node "$GATE" >/dev/null 2>&1; then echo "  ok  baseline PASSES"
else echo "  BASELINE IS RED"; node "$GATE"; exit 1; fi

PASSED=0; CAUGHT=0; N=0

mutate() {
  N=$((N+1))
  MUT_CODE="$2" python3 -c 'import os; exec(os.environ["MUT_CODE"])' 2>/tmp/mut.err
  if [ $? -ne 0 ]; then
    printf '  %2d  %-64s HARNESS ERROR\n' "$N" "$1"; sed 's/^/        /' /tmp/mut.err
    restore; return
  fi
  if node "$GATE" >/dev/null 2>&1; then
    printf '  %2d  %-64s GATE STILL PASSED  <-- HOLE\n' "$N" "$1"; PASSED=$((PASSED+1))
  else
    printf '  %2d  %-64s caught\n' "$N" "$1"; CAUGHT=$((CAUGHT+1))
  fi
  restore
}

S=src/utils/modelSlug.js
echo
echo "=== mutations: the slug rule ==="

mutate "brand dropped from the slug entirely" "
f='$S'; s=open(f,encoding='utf-8').read()
s=s.replace('  return b ? \`\${m}-\${b}\` : m;','  return m;',1)
open(f,'w',encoding='utf-8').write(s)
"

mutate "brand suffixed only on collision (the order-dependent rule)" "
f='$S'; s=open(f,encoding='utf-8').read()
s=s.replace('  return b ? \`\${m}-\${b}\` : m;',
            '''  if (b === 'james-martin-vanities') return m;
  return b ? \`\${m}-\${b}\` : m;''',1)
open(f,'w',encoding='utf-8').write(s)
"

mutate "resolve() SPLITS the slug instead of looking it up" "
f='$S'; s=open(f,encoding='utf-8').read()
i=s.find('function resolve(slug, index)')
j=s.find('\n}', i)
s=s[:i]+'''function resolve(slug, index) {
  if (!slug || !index) return null;
  const parts = String(slug).split('-');
  const model = parts[0];
  for (const [, v] of index) if (v.model.toLowerCase() === model) return v;
  return null;
'''+s[j:]
open(f,'w',encoding='utf-8').write(s)
"

mutate "slugify stops folding diacritics (Cafe -> caf)" "
f='$S'; s=open(f,encoding='utf-8').read()
s=s.replace(\"    .normalize('NFD')\n\",'',1)
s=s.replace('    .replace(/[\\\\u0300-\\\\u036f]/g, \\'\\')\n','',1)
open(f,'w',encoding='utf-8').write(s)
"

mutate "slugify leaves leading/trailing hyphens" "
f='$S'; s=open(f,encoding='utf-8').read()
s=s.replace(\"    .replace(/^-+|-+\$/g, '');\",'    ;',1)
open(f,'w',encoding='utf-8').write(s)
"

mutate "slugify keeps the slash (escapes its path segment)" "
f='$S'; s=open(f,encoding='utf-8').read()
s=s.replace(\"    .replace(/[^a-z0-9]+/g, '-')\",\"    .replace(/[^a-z0-9\\\\/]+/g, '-')\",1)
open(f,'w',encoding='utf-8').write(s)
"

mutate "modelSlug becomes non-deterministic" "
f='$S'; s=open(f,encoding='utf-8').read()
s=s.replace('  const m = slugifyPart(model);',
            '  const m = slugifyPart(model) + (Date.now() % 2 ? \\'\\' : \\'-x\\');',1)
open(f,'w',encoding='utf-8').write(s)
"

mutate "empty model returns '' instead of null" "
f='$S'; s=open(f,encoding='utf-8').read()
s=s.replace('  if (!m) return null;','  if (!m) return \\'\\';',1)
open(f,'w',encoding='utf-8').write(s)
"

mutate "buildIndex silently overwrites on collision (reports none)" "
f='$S'; s=open(f,encoding='utf-8').read()
s=s.replace('''    if (prev) {
      collisions.push({ slug, a: prev, b: { model: p.model, brand: p.brand } });
      continue;                            // first one wins, deterministically
    }''','',1)
open(f,'w',encoding='utf-8').write(s)
"

mutate "resolve() stops normalising case and slashes" "
f='$S'; s=open(f,encoding='utf-8').read()
s=s.replace(\"  const key = String(slug).trim().replace(/^\\\\/+|\\\\/+\$/g, '').toLowerCase();\",
            '  const key = String(slug);',1)
open(f,'w',encoding='utf-8').write(s)
"

mutate "modelPath escapes the /collections/vanity-models namespace" "
f='$S'; s=open(f,encoding='utf-8').read()
s=s.replace('\`/collections/vanity-models/\${slug}\`','\`/collections/\${slug}\`',1)
open(f,'w',encoding='utf-8').write(s)
"

echo
echo "=== mutations: the committed snapshot (drift catcher) ==="

mutate "snapshot drifts — a model was renamed, slug not regenerated" "
import json
json.dump({'pairs':[
  {'model':'Brittany','brand':'James Martin Vanities','slug':'brittany-james-martin-vanities'},
  {'model':'Bellamy RENAMED','brand':'James Martin Vanities','slug':'bellamy-james-martin-vanities'},
]}, open('$SNAP','w'), indent=2)
"

mutate "snapshot has two pages on one slug" "
import json
json.dump({'pairs':[
  {'model':'Brittany','brand':'James Martin Vanities','slug':'brittany-james-martin-vanities'},
  {'model':'Brittany','brand':'James Martin Vanities','slug':'brittany-james-martin-vanities'},
]}, open('$SNAP','w'), indent=2)
"

mutate "snapshot carries a model with no brand" "
import json
json.dump({'pairs':[{'model':'Orphan','brand':'','slug':'orphan'}]}, open('$SNAP','w'), indent=2)
"

mutate "snapshot is unsorted — a diff stops meaning anything" "
import json
json.dump({'pairs':[
  {'model':'Zeta','brand':'ER Vanities','slug':'zeta-er-vanities'},
  {'model':'Alpha','brand':'ER Vanities','slug':'alpha-er-vanities'},
]}, open('$SNAP','w'), indent=2)
"

mutate "snapshot gains a timestamp — every re-run looks like a change" "
import json
json.dump({'generated':'2026-10-02T00:00:00Z','pairs':[
  {'model':'Alpha','brand':'ER Vanities','slug':'alpha-er-vanities'},
]}, open('$SNAP','w'), indent=2)
"

mutate "snapshot holds a slug that needs percent-encoding" "
import json
json.dump({'pairs':[{'model':'A B','brand':'ER Vanities','slug':'a b-er-vanities'}]},
          open('$SNAP','w'), indent=2)
"

mutate "snapshot is not valid JSON" "
open('$SNAP','w').write('{ pairs: [ not json ')
"

mutate "snapshot is empty" "
import json
json.dump({'pairs':[]}, open('$SNAP','w'), indent=2)
"

echo
echo "=== mutation: the sequencing guard ==="

N=$((N+1))
cat > src/utils/__mut_consumer.js <<'JS'
'use strict';
/* a route wired up before the snapshot exists — slugs unpinned AND live */
const { modelPath } = require('./modelSlug');
module.exports = modelPath;
JS
HAD_CONSUMER=1
if node "$GATE" >/dev/null 2>&1; then
  printf '  %2d  %-64s GATE STILL PASSED  <-- HOLE\n' "$N" "wired up before the snapshot exists"; PASSED=$((PASSED+1))
else
  printf '  %2d  %-64s caught\n' "$N" "wired up before the snapshot exists"; CAUGHT=$((CAUGHT+1))
fi
restore

echo
echo "=== result ==="
echo "  mutations:  $N"
echo "  caught:     $CAUGHT"
echo "  holes:      $PASSED"
[ "$PASSED" -eq 0 ] && echo "  ALL MUTATIONS CAUGHT" || { echo "  GATE HAS HOLES"; exit 1; }
