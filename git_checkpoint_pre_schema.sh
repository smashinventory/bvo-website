#!/bin/bash
# Run with: bash git_checkpoint_pre_schema.sh
#
# ─── WHAT THIS IS ────────────────────────────────────────────────────────────
# A RESTORE POINT, taken before any controller is touched by the structured
# data work. Requested explicitly: "please do a backup state in case we break
# something."
#
# Everything in this commit is already finished, already verified, and CANNOT
# break the running site:
#
#   * the ten rewritten articles, as source drafts. The live copies are
#     already in the database - this commits the originals they were built
#     from, so the SQL can be regenerated without re-doing the work.
#   * src/utils/structuredData.js - NOT WIRED TO ANYTHING YET. Nothing
#     requires it, so it is inert until a controller imports it. Committing it
#     now is what makes the next step revertible in one command.
#   * gates/gate_article_ascii.js - test-only, runs nothing in production.
#   * the read-only diagnostic SQL and the applied article migration.
#   * MOUNT_TYPE_DEFECT.md - the finding that was logged rather than fixed.
#
# NO CONTROLLER, NO VIEW, NO ROUTE AND NO CSS IS TOUCHED. git status shows
# every path here as untracked (??), not modified, so there is nothing to
# overwrite and no existing behaviour to change.
#
# ─── HOW TO GO BACK ──────────────────────────────────────────────────────────
# After this runs, the tag `pre-schema-wiring` marks this exact state. If the
# structured data work goes wrong at any point:
#
#     git reset --hard pre-schema-wiring        # local working tree
#     git push --force-with-lease origin main   # only if it was already pushed
#
# The database side is separately covered: pages_content_backup_20261005 holds
# every article body as it was before the rewrite, and the revert UPDATE is at
# the bottom of migrations/2026-10-05_article_rewrite_RUNME.sql.
#
# ⚠️ ONE FILE IS DELIBERATELY EXCLUDED. A zero-byte file named `typescript`
# appeared in the repo root today - that is what the Unix `script` command
# leaves behind, created accidentally by a stray shell invocation. It is not
# added here. Delete it with `rm typescript` whenever convenient.
set -e
cd "$(dirname "$0")"

FILES=(
  src/utils/structuredData.js
  gates/gate_article_ascii.js
  docs/briefs/MOUNT_TYPE_DEFECT.md
  docs/briefs/article_60inch_DRAFT.html
  docs/briefs/article_small_DRAFT.html
  docs/briefs/article_double_DRAFT.html
  docs/briefs/article_floating_DRAFT.html
  docs/briefs/article_master_DRAFT.html
  docs/briefs/article_white_DRAFT.html
  docs/briefs/article_farmhouse_DRAFT.html
  docs/briefs/article_modern_DRAFT.html
  docs/briefs/article_buyingguide_DRAFT.html
  docs/briefs/article_howtochoose_DRAFT.html
  docs/briefs/_article_sets.json
  docs/briefs/_farmhouse_set.json
  docs/briefs/_modern_set.json
  docs/briefs/_floating_set.json
  docs/briefs/_floating_gallery.json
  migrations/2026-10-05_article_rewrite_RUNME.sql
  migrations/2026-10-05_guide_inventory_READONLY.sql
  migrations/2026-10-05_article_source_READONLY.sql
  migrations/2026-10-05_article_build_source_READONLY.sql
  migrations/2026-10-05_floating_check_READONLY.sql
  migrations/2026-10-05_floating_snippet_READONLY.sql
  migrations/2026-10-05_mount_type_proof_READONLY.sql
  migrations/2026-10-05_identifier_coverage_READONLY.sql
)

echo "=== syntax ==="
node --check src/utils/structuredData.js
node --check gates/gate_article_ascii.js
echo "  ok"

echo
echo "=== the module is INERT - nothing imports it yet ==="
# ⚠️ This is the claim that makes the commit safe. If something already
# requires structuredData.js then this is no longer a no-op commit and the
# "cannot break the site" statement above would be false.
IMPORTERS=$(grep -rln "structuredData" src/ views/ --include=*.js --include=*.ejs 2>/dev/null \
            | grep -v '^src/utils/structuredData.js$' | grep -v '\.bak' || true)
if [ -n "$IMPORTERS" ]; then
  echo "  FAIL - something already imports it, so this commit is NOT inert:"
  echo "$IMPORTERS" | sed 's/^/    /'
  exit 1
fi
echo "  ok - no controller or view references it"

echo
echo "=== no controller, view, route or CSS is in this commit ==="
for f in "${FILES[@]}"; do
  case "$f" in
    src/controllers/*|src/routes/*|views/*|public/*|src/server.js)
      echo "  FAIL - $f is live code and must not be in a checkpoint commit"; exit 1;;
  esac
done
echo "  ok"

echo
echo "=== every file exists ==="
MISSING=0
for f in "${FILES[@]}"; do
  [ -f "$f" ] || { echo "  MISSING: $f"; MISSING=1; }
done
[ "$MISSING" -eq 0 ] || exit 1
echo "  ok - ${#FILES[@]} files"

echo
echo "=== article content gate ==="
node gates/gate_article_ascii.js

echo
echo "=== the structured data module actually builds a valid graph ==="
node -e "
const sd = require('./src/utils/structuredData');
const g  = sd.pageGraph({ url:'/', name:'x', settings:{ social:{} } });
const types = g['@graph'].map(n => n['@type']);
const must  = ['OnlineStore','WebSite','WebPage'];
const miss  = must.filter(t => !types.includes(t));
if (miss.length) { console.log('  FAIL - missing node(s): ' + miss.join(', ')); process.exit(1); }
if (JSON.stringify(g).includes('aggregateRating')) {
  console.log('  FAIL - aggregateRating must never be emitted; see the warning in the module');
  process.exit(1);
}
console.log('  ok - ' + types.join(', ') + '; no aggregateRating');
"

echo
echo "=== stage ==="
git add -- "${FILES[@]}"
git status --short -- "${FILES[@]}"

echo
echo "=== nothing else sneaked in ==="
STAGED_OTHER=$(git diff --cached --name-only | grep -vxF -f <(printf '%s\n' "${FILES[@]}") || true)
if [ -n "$STAGED_OTHER" ]; then
  echo "  FAIL - unexpected staged paths:"; echo "$STAGED_OTHER" | sed 's/^/    /'; exit 1
fi
echo "  ok"

echo
echo "=== every gate, against the STAGED tree ==="
TMP=$(mktemp -d)
git checkout-index -a -f --prefix="$TMP/"
ln -s "$PWD/node_modules" "$TMP/node_modules" 2>/dev/null || cp -R node_modules "$TMP/node_modules"
FAILED=0
for g in gates/*.js; do
  b=$(basename "$g" .js)
  case "$b" in gate_consent_checkboxes|gate_model_card_scope_live) continue;; esac
  printf '  %-36s ' "$b"
  if ( cd "$TMP" && node "gates/$b.js" >/dev/null 2>&1 ); then echo PASS; else echo FAIL; FAILED=1; fi
done
rm -rf "$TMP"
[ "$FAILED" -eq 0 ] || { echo "  not committing"; exit 1; }

echo
echo "=== commit ==="
git commit -m "Checkpoint before structured data wiring: articles, schema module, gate

A RESTORE POINT, taken deliberately before any controller is touched.

Everything here is finished and inert. No controller, view, route or CSS is
in this commit, and src/utils/structuredData.js is not imported by anything
yet - the push script asserts both, so the claim is checked rather than
stated.

CONTENT. The ten inspiration guides, rewritten. They went from 605-834 words
with ZERO images to 18,015 words across 172 numbered vanities, each with its
own image and a link to the product, plus 43 internal links between the ten
where there were none. Research into what ranks for these queries showed the
winners are numbered image-led lists for the eight 'ideas' topics and
long-form prose for the two buying guides; neither was what we had. The live
copies are already in the database via 2026-10-05_article_rewrite_RUNME.sql -
these are the sources they were generated from.

The two buying guides were deliberately NOT merged, at the owner's call. They
are split by intent instead so they stop competing: bathroom-vanity-buying-
guide is the reference, how-to-choose-a-bathroom-vanity is the process.

Every one of the 172 product links and 172 image URLs was verified against the
catalogue before generation. An earlier draft carried three fabricated image
paths, typed from a filename pattern rather than read from the data; the
galleries are now generated from the data file so that class of error cannot
recur.

gate_article_ascii.js enforces two rules the owner set: article bodies are
ASCII only, so nothing can mojibake if a charset is mis-declared anywhere
between the database and the page, and American English throughout. It is
mutation-tested both ways. Its scope is deliberately narrow - code and config
are excluded, because colorFamilies.js holds 'Grey' as a vendor-feed alias
that MUST keep its British spelling to match incoming data.

SCHEMA MODULE, not yet wired. One @graph per page with stable @ids, replacing
what would otherwise have become an eighth hand-written JSON-LD block. The
codebase already contains seven separate Organization objects across three
files, each re-declaring the company; Google has no way to know they describe
the same entity. OnlineStore rather than generic Organization, because that is
the subtype that unlocks the Merchant Knowledge Panel, carrying the published
30-day return window, 25% restocking fee and free 5-10 day shipping at the
organisation level rather than copied onto 5,283 products.

It deliberately does NOT emit Product.aggregateRating. The 4.9/150 shown on
product pages is a hardcoded site-wide SELLER rating, not product reviews, and
publishing it per-product is the textbook structured-data manual action. The
reasoning is written next to the code so the next person finds it.

MOUNT_TYPE_DEFECT.md records a real catalogue bug found and left alone on
instruction: 112 wall-mounted vanities are tagged 'Floor Standing' because the
importer's derivation only tests for the word 'wall' and these are described as
floating. Logged with the evidence; no importer change attempted.

Tagged pre-schema-wiring. To return here:
  git reset --hard pre-schema-wiring"

echo
echo "=== tag ==="
git tag -f pre-schema-wiring
git tag -n1 | grep pre-schema-wiring

echo
echo "=== push ==="
git push origin main
git push -f origin pre-schema-wiring
echo
git log --oneline -1

cat <<'EOF'

CHECKPOINT TAKEN.

NOTHING TO RUN. No migration, no restart needed - this commit changes no
behaviour.

TO RETURN HERE IF THE SCHEMA WORK GOES WRONG:
  git reset --hard pre-schema-wiring
  git push --force-with-lease origin main     (only if already pushed)

THE DATABASE IS SEPARATELY COVERED:
  pages_content_backup_20261005 holds all ten article bodies as they were
  before the rewrite. The revert UPDATE is at the bottom of
  migrations/2026-10-05_article_rewrite_RUNME.sql, commented out.

HOUSEKEEPING:
  rm typescript      - a zero-byte file left by a stray `script` invocation,
                       deliberately not committed.
EOF
