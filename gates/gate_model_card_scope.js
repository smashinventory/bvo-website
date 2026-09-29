'use strict';
/* Gate: a model card can only be built from products inside its scope.
 * STATIC HALF.  2026-09-29
 *
 * ── WHAT THIS CAN AND CANNOT DO ───────────────────────────────────────
 *
 * This bug has shipped three times (see src/utils/modelScope.js for the
 * dates). Every previous fix was verified by loading the page and
 * looking at it. That proves the fix on the page you opened, at the
 * moment you opened it, with the filters you happened to have — which is
 * why each one was rediscovered on the storefront months later.
 *
 * This file asserts the STRUCTURE: that one scope object exists, that
 * every caller passes it, that the hero SQL carries a category
 * predicate, and that nobody hand-writes the filter beside it.
 *
 * It CANNOT catch a fifth query, written next year, that ignores the
 * helper entirely — which is exactly how this bug has arrived each time.
 * gates/gate_model_card_scope_live.js is the half that can, because it
 * checks the rendered outcome rather than the source. Run both. Neither
 * is sufficient alone, and believing otherwise is the actual root cause
 * of this defect's lifespan.
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
/* Comments are not code. Asserting on the paragraph that explains the
   behaviour rather than the line that implements it has bitten these
   gates repeatedly. */
const executable = src => src
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

let fail = 0;
const ok = (n, c, d) => {
  console.log((c ? '  ok   ' : '  FAIL ') + n + (c ? '' : '   <- ' + d));
  if (!c) fail += 1;
};

const scopeSrc = read('src/utils/modelScope.js');
const scopeX   = executable(scopeSrc);
const heroX    = executable(read('src/utils/modelHero.js'));
const collX    = executable(read('src/controllers/collectionsController.js'));
const homeX    = executable(read('src/controllers/homeController.js'));

/* ═══ 1. THE SCOPE EXISTS AND IS THE ONLY DEFINITION ════════════════ */
console.log('--- one definition of eligibility ---');
ok('modelScope exports createScope', /exports\s*=\s*\{[^}]*createScope/.test(scopeX), 'no shared scope');
ok('and isScope, so callers can refuse to guess',
   /exports\s*=\s*\{[^}]*isScope/.test(scopeX), 'callers cannot validate what they were handed');
ok('the scope emits a category predicate',
   /category_id = \?/.test(scopeX), 'the half that was missing for three fixes');
ok('the scope emits a product_type predicate',
   /product_type IN/.test(scopeX), 'type narrowing lost');
/* isBounded is the whole safety property: a scope that names no category
   and does not admit to being unscoped must not be usable. */
ok('an empty scope is NOT bounded',
   /bounded = unscoped \|\| categoryId != null \|\| categorySlug != null/.test(scopeX),
   'a forgotten scope would read as a valid one');

/* ═══ 2. THE HERO IS SCOPED — THE ACTUAL LEAK ═══════════════════════ */
console.log('\n--- fetchModelHeroes ---');
ok('it takes a scope, not a bare type array',
   /async function fetchModelHeroes\(pool, rows, overrides = \{\}, scope = null\)/.test(heroX),
   'the old signature defaulted to "rank across everything"');
ok('it refuses an unbounded scope',
   /if \(!isScope\(scope\) \|\| !scope\.isBounded\(\)\)/.test(heroX),
   'an unscoped call would rank across the whole catalogue, which is the bug');
ok('and returns {} rather than an unscoped ranking',
   /!scope\.isBounded\(\)\)\s*\{[\s\S]{0,400}return out;/.test(heroX),
   'degrading toward a wrong SKU is what produced this three times');
ok('it says so loudly',
   /REFUSING to rank unscoped/.test(read('src/utils/modelHero.js')),
   'a silent empty result looks identical to "nothing is scored yet"');
/* BOTH queries in the file — the demand ranking AND the hand-picked
   default_sku override. A pinned mirror would otherwise walk straight
   past the fix, and only on curated models, where it is hardest to spot. */
ok('both hero queries use the scope fragment',
   (heroX.match(/\$\{scoped\.sql\}/g) || []).length === 2,
   'the demand pick and the default_sku pin must carry the SAME scope');
ok('both pass the scope params',
   (heroX.match(/\.\.\.scoped\.params/g) || []).length === 2, 'param mismatch');
ok('no bare typeSql survives', !/typeSql/.test(heroX),
   'the old type-only filter is still wired up somewhere');
ok('the category join is emitted when the scope needs it',
   /needsCategoryJoin\(\)/.test(heroX) && (heroX.match(/\$\{joinCats\}/g) || []).length === 2,
   'a slug-based scope would reference c.slug with no categories table');

/* ═══ 3. EVERY CALLER PASSES ONE ═══════════════════════════════════ */
console.log('\n--- callers ---');
for (const [name, src] of [['collectionsController', collX], ['homeController', homeX]]) {
  ok(`${name} builds a scope`, /createScope\(\{/.test(src), 'no scope built');
  ok(`${name} passes it to fetchModelHeroes`,
     /fetchModelHeroes\([\s\S]{0,200}(mgScope|heroScope)\)/.test(src), 'scope not passed');
  ok(`${name} labels it`, /label:\s*[`'"]/.test(src),
     'an unlabelled scope makes the refusal log useless');
}
/* The collection page's scope MUST carry the category — that is the
   fix. A type-only scope is what /collections/vanity-models had. */
ok('the collection scope carries categoryId',
   /createScope\(\{[\s\S]{0,200}categoryId:\s*mgProductCatId/.test(collX),
   'type-only scoping is the 2026-09-24 fix that failed');
ok('the homepage scope carries a category or says unscoped',
   /createScope\(\{[\s\S]{0,300}categorySlug:[\s\S]{0,300}unscoped:/.test(homeX),
   'a category-filtered section would rank heroes across everything');

/* ═══ 4. NOBODY HAND-WRITES THE FILTER ═════════════════════════════ */
console.log('\n--- no second definition ---');
/* The point of the helper is that adding a filter changes every query at
   once. A hand-written predicate in the hero file re-opens the drift. */
ok('modelHero has no hand-written category predicate',
   !/category_id\s*=\s*\?/.test(heroX), 'a second definition of eligibility');
ok('modelHero has no hand-written product_type predicate',
   !/product_type IN \(/.test(heroX), 'a second definition of eligibility');

/* ═══ 5. THE LIVE GATE MUST EXIST AND BE WIRED ═════════════════════ */
console.log('\n--- the half this file cannot do ---');
ok('the live gate exists', fs.existsSync(path.join(ROOT, 'gates/gate_model_card_scope_live.js')),
   'a static gate alone cannot see a new query that ignores the helper');
/* Matched on the INVOCATION, not the filename. The first version of this
   assertion matched the name anywhere in the file, so replacing
   `node gates/...live.js` with `true` still passed — the script's own echo
   line mentions the file. A gate that is satisfied by a comment about the
   thing rather than the thing is the trap this whole exercise is about. */
ok('the push script actually RUNS both gates',
   fs.existsSync(path.join(ROOT, 'git_push_model_scope.sh')) &&
   /node\s+gates\/gate_model_card_scope_live\.js/.test(read('git_push_model_scope.sh')) &&
   /node\s+gates\/gate_model_card_scope\.js/.test(read('git_push_model_scope.sh')),
   'the live gate that nobody runs is the same as no live gate');
ok('and refuses to push if either fails',
   (read('git_push_model_scope.sh').match(/not pushing.*exit 1/g) || []).length >= 2,
   'a gate whose failure does not stop the push is decoration');

console.log(fail ? `\n*** ${fail} GATE(S) FAILED ***` : '\nALL GATES PASS');
process.exit(fail ? 1 : 0);
