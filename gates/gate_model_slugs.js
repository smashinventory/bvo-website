#!/usr/bin/env node
/**
 * gate_model_slugs.js
 *
 * Step 1 of turning `?model=X&brand=Y` into `/collections/vanity-models/<slug>`.
 * Nothing is wired up yet — this gate guards the slug rule itself, before
 * any URL depends on it, because once a URL is live the rule cannot change
 * without a redirect.
 *
 * WHAT IT ASSERTS, AND WHY EACH ONE
 *
 *  1. The function is PURE and DETERMINISTIC. The whole design rests on
 *     "same pair, same slug, forever". Called twice, must agree.
 *
 *  2. A slug is never PARSED back into a pair. Model names contain hyphens
 *     — "Mid-Century Modern" gives mid-century-modern — so splitting
 *     mid-century-modern-james-martin-vanities has no unambiguous answer.
 *     resolve() must be a lookup. This is the single most likely way for a
 *     later "simplification" to break this quietly, so it is tested with a
 *     hyphenated model specifically.
 *
 *  3. The brand is ALWAYS in the slug. Not "only when two models collide" —
 *     that rule is order-dependent, and the day a second brand ships a
 *     Brittany, a live URL moves.
 *
 *  4. Slugs are URL-safe with no escaping. If encodeURIComponent changes
 *     the string, the clean URL was never clean.
 *
 *  5. The committed snapshot and the function AGREE. This is the drift
 *     catcher: a model rename changes the derivation, the derivation stops
 *     matching src/config/modelSlugs.json, and the gate goes red instead of
 *     a live URL changing in silence.
 *
 * NOT ASSERTED: the exact slugify spelling. gate_card_badge_anchor had an
 * assertion earlier today demanding parentNode.removeChild by name; the
 * mutation sweep correctly flagged an equivalent rewrite as "passing" and
 * the assertion was deleted rather than the code bent to satisfy it. Same
 * discipline here — these test what the slug rule must GUARANTEE.
 */
'use strict';
const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const M    = require(path.join(ROOT, 'src/utils/modelSlug'));

let fails = 0;
const ok    = m => console.log('  PASS  ' + m);
const bad   = m => { console.log('  FAIL  ' + m); fails++; };
const skip  = m => console.log('  SKIP  ' + m);
const check = (c, m) => c ? ok(m) : bad(m);

console.log('\n=== gate_model_slugs ===\n');

/* ───────────── 1. pure and deterministic ───────────── */
console.log('-- pure and deterministic --');
{
  const a = M.modelSlug('Brittany', 'James Martin Vanities');
  const b = M.modelSlug('Brittany', 'James Martin Vanities');
  check(a === b && a === 'brittany-james-martin-vanities',
        `same pair gives the same slug every time (${a})`);
  check(M.modelSlug('Brittany', 'James Martin Vanities')
        === M.modelSlug('  brittany  ', 'james martin vanities'),
        'case and surrounding whitespace do not change the slug');
  check(M.modelSlug('', 'James Martin Vanities') === null
        && M.modelSlug(null, 'x') === null
        && M.modelSlug(undefined, undefined) === null,
        'no model means no slug, rather than a slug made of nothing');
}

/* ───────────── 2. THE HYPHEN TRAP ─────────────
   The assertion that matters most. A model whose own name contains a hyphen
   must still resolve, which is only possible if resolve() looks up rather
   than splits. */
console.log('\n-- a slug is looked up, never parsed --');
{
  const pairs = [
    { model: 'Mid-Century Modern', brand: 'James Martin Vanities' },
    { model: 'Brittany',           brand: 'James Martin Vanities' },
    { model: 'Bristol',            brand: 'ER Vanities' },
  ];
  const { index, collisions } = M.buildIndex(pairs);
  check(collisions.length === 0, 'no collisions in the sample set');

  const slug = M.modelSlug('Mid-Century Modern', 'James Martin Vanities');
  check(slug === 'mid-century-modern-james-martin-vanities',
        `a hyphenated model slugifies predictably (${slug})`);

  const got = M.resolve(slug, index);
  check(!!got && got.model === 'Mid-Century Modern'
             && got.brand === 'James Martin Vanities',
        'a hyphenated model round-trips back to the right pair');

  /* Every pair must round-trip, not just the awkward one. */
  let allBack = true;
  for (const p of pairs) {
    const r = M.resolve(M.modelSlug(p.model, p.brand), index);
    if (!r || r.model !== p.model || r.brand !== p.brand) allBack = false;
  }
  check(allBack, 'every pair in the set round-trips');

  check(M.resolve('not-a-real-model', index) === null,
        'an unknown slug resolves to null, so the route can 404 rather than guess');
  check(M.resolve('/Brittany-James-Martin-Vanities/', index) !== null,
        'case and stray slashes still resolve, so the route can 301 to canonical');
}

/* ───────────── 3. the brand is always present ───────────── */
console.log('\n-- the brand is always in the slug --');
{
  const jm = M.modelSlug('Brittany', 'James Martin Vanities');
  const er = M.modelSlug('Brittany', 'ER Vanities');
  check(jm !== er, 'the same model under two brands gives two different slugs');
  check(jm.endsWith('-james-martin-vanities') && er.endsWith('-er-vanities'),
        'both carry their brand, so neither is the privileged bare one');

  /* The order-dependence this rule exists to prevent: adding a second brand
     must not change the FIRST brand's slug. */
  const before = M.buildIndex([{ model: 'Brittany', brand: 'James Martin Vanities' }]);
  const after  = M.buildIndex([{ model: 'Brittany', brand: 'James Martin Vanities' },
                               { model: 'Brittany', brand: 'ER Vanities' }]);
  check(after.collisions.length === 0,
        'a second brand with the same model name does NOT collide');
  check([...before.index.keys()][0] === jm && after.index.has(jm),
        "...and does not move the first brand's URL");
}

/* ───────────── 3b. THE COLLISION DETECTOR ACTUALLY DETECTS ─────────────
   Added after the mutation sweep. Deleting the collision branch from
   buildIndex passed every assertion above, because every pair tested so far
   was collision-FREE — nothing proved the detector worked, only that it
   stayed quiet when it should.

   And a collision IS reachable. Always-suffixing the brand does not
   guarantee uniqueness, because the join is a hyphen and both halves can
   contain one:

       modelSlug('A B', 'C')   -> 'a-b-c'
       modelSlug('A',   'B C') -> 'a-b-c'

   Vanishingly unlikely in this catalogue, impossible to rule out in
   general. The design handles it — buildIndex reports, dumpModelSlugs hard
   stops, and §6 asserts zero in the real snapshot — but a reported-and-
   ignored collision would silently serve one model's page at the other's
   URL. So the detector gets its own test. */
console.log('\n-- the collision detector fires on a real collision --');
{
  const a = M.modelSlug('A B', 'C');
  const b = M.modelSlug('A', 'B C');
  check(a === b, `the hyphen join is genuinely ambiguous (${a} === ${b})`);

  const { index, collisions } = M.buildIndex([
    { model: 'A B', brand: 'C' },
    { model: 'A',   brand: 'B C' },
  ]);
  check(collisions.length === 1, `the collision is REPORTED (${collisions.length})`);
  check(index.size === 1, '...and only one pair holds the slug, deterministically');
  check(collisions[0] && collisions[0].slug === a
        && collisions[0].a.model === 'A B' && collisions[0].b.model === 'A',
        '...naming both pairs, so it can be fixed rather than just noticed');

  /* Returned, not thrown. A collision must fail a gate at build time and
     must not take the storefront down at request time. */
  let threw = false;
  try { M.buildIndex([{ model: 'A B', brand: 'C' }, { model: 'A', brand: 'B C' }]); }
  catch (e) { threw = true; }
  check(!threw, 'a collision does not throw, so a bad row cannot 500 the site');
}

/* ───────────── 4. URL-safe, no escaping ───────────── */
console.log('\n-- the slug needs no escaping --');
{
  const cases = [
    ['Brittany',            'James Martin Vanities'],
    ['Mid-Century Modern',  'ER Vanities'],
    ['Café',                'ER Vanities'],      // diacritic folding
    ['36" Wide',            'ER Vanities'],      // quote
    ['A & B',               'ER Vanities'],      // ampersand
    ['  Spaced  Out  ',     'ER Vanities'],
    ['Slash/Name',          'ER Vanities'],      // would break a path segment
    /* ── ADDED AFTER THE MUTATION SWEEP ──────────────────────────────
       Removing the ^-+|-+$ strip from slugifyPart passed this section
       cleanly, because every case above happens to have its punctuation
       in the MIDDLE. trim() removes whitespace, so only a non-alphanumeric
       at the very edge produces an edge hyphen — and then the brand suffix
       turns it into a doubled one. These three reach it. */
    ['Brittany!',           'ER Vanities'],      // trailing punctuation
    ['(Deluxe)',            'ER Vanities'],      // both edges
    ['"Quoted"',            'ER Vanities'],
  ];
  let clean = true, shape = true, details = [];
  for (const [m, b] of cases) {
    const s = M.modelSlug(m, b);
    if (s === null) continue;
    if (encodeURIComponent(s) !== s) { clean = false; details.push(`${m} -> ${s}`); }
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s)) { shape = false; details.push(`${m} -> ${s}`); }
  }
  check(clean, 'no slug needs percent-encoding' + (details.length ? ' — ' + details.join(', ') : ''));
  check(shape, 'no slug has a leading, trailing or doubled hyphen'
               + (details.length ? ' — ' + details.join(', ') : ''));
  check(M.modelSlug('Café', 'ER Vanities').startsWith('cafe-'),
        'an accent folds to its ASCII base rather than being dropped');
  check(M.modelSlug('Slash/Name', 'ER Vanities') === 'slash-name-er-vanities',
        'a slash cannot escape its path segment');
}

/* ───────────── 5. the path builder ───────────── */
console.log('\n-- one place builds the path --');
{
  const p = M.modelPath('Brittany', 'James Martin Vanities');
  check(p === '/collections/vanity-models/brittany-james-martin-vanities',
        `modelPath returns the canonical path (${p})`);
  check(M.modelPath('', 'x') === null,
        'no model means no path, so a template cannot render a broken href');
  /* Nested under the EXISTING /collections/vanity-models page. That reserves
     the namespace against category slugs served by /collections/:slug. */
  check(p.startsWith('/collections/vanity-models/'),
        'the path nests under the model listing page that already exists');
}

/* ───────────── 6. SNAPSHOT DRIFT ─────────────
   Conditional on the snapshot existing: it can only be generated against
   the live DB (scripts/dumpModelSlugs.js), which the gates have no
   credentials for. Loud SKIP rather than a silent pass — a skipped drift
   check is the one thing someone must notice. */
console.log('\n-- the committed snapshot still agrees with the function --');
{
  const SNAP = path.join(ROOT, 'src/config/modelSlugs.json');
  if (!fs.existsSync(SNAP)) {
    skip('src/config/modelSlugs.json does not exist yet');
    console.log('        Generate it against the live DB before step 2 wires up a route:');
    console.log('          node scripts/dumpModelSlugs.js');
    console.log('        Until it exists, nothing is pinning these slugs and a model');
    console.log('        rename would move a URL unnoticed. That is fine today only');
    console.log('        because no URL uses them yet.');
  } else {
    let snap = null;
    try { snap = JSON.parse(fs.readFileSync(SNAP, 'utf8')); }
    catch (e) { bad('modelSlugs.json is not valid JSON: ' + e.message); }

    if (snap) {
      const pairs = snap.pairs || [];
      check(pairs.length > 0, `the snapshot holds ${pairs.length} model page(s)`);

      /* THE DRIFT ASSERTION. Every committed slug must still be what the
         function produces from its pair. A model rename breaks this. */
      const drift = pairs.filter(p => M.modelSlug(p.model, p.brand) !== p.slug);
      check(drift.length === 0,
            'every committed slug still matches the derivation'
            + (drift.length ? ` — ${drift.length} drifted: `
               + drift.slice(0, 3).map(d =>
                   `"${d.model}"/"${d.brand}" committed ${d.slug}, now `
                   + M.modelSlug(d.model, d.brand)).join('; ') : ''));

      const slugs = pairs.map(p => p.slug);
      check(new Set(slugs).size === slugs.length,
            'no two model pages share a slug');

      const { collisions } = M.buildIndex(pairs);
      check(collisions.length === 0,
            'the real catalogue produces no collisions'
            + (collisions.length ? ` — ${collisions.map(c => c.slug).join(', ')}` : ''));

      const unsafe = slugs.filter(s => encodeURIComponent(s) !== s
                                    || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s));
      check(unsafe.length === 0,
            'every real slug is URL-safe and well-formed'
            + (unsafe.length ? ` — ${unsafe.slice(0, 3).join(', ')}` : ''));

      const noBrand = pairs.filter(p => !p.brand);
      check(noBrand.length === 0,
            'every model page has a brand'
            + (noBrand.length ? ` — ${noBrand.length} without: `
               + noBrand.slice(0, 3).map(p => p.model).join(', ') : ''));

      /* Deterministic output: sorted, and no timestamp. If a re-run on an
         unchanged catalogue produced a different file, `git diff` would stop
         meaning "the catalogue moved" and nobody would read it. */
      const sorted = [...slugs].sort();
      check(slugs.every((s, i) => s === sorted[i]),
            'the snapshot is slug-sorted, so a diff shows real changes only');
      check(!/"generated"|"timestamp"|"dumpedAt"/.test(fs.readFileSync(SNAP, 'utf8')),
            'the snapshot carries no timestamp, so a no-op re-run is a no-op diff');
    }
  }
}

/* ───────────── 7. nothing is wired up yet ─────────────
   Step 1 is deliberately inert. If a template or route starts using this
   before the snapshot exists, the slugs are unpinned and in production at
   the same time. Asserted so the sequencing cannot be skipped by accident. */
console.log('\n-- step 1 is inert: no route or template depends on this yet --');
{
  const SNAP_EXISTS = fs.existsSync(path.join(ROOT, 'src/config/modelSlugs.json'));
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
    const p = path.join(d, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
  const consumers = [...walk(path.join(ROOT, 'views')), ...walk(path.join(ROOT, 'src'))]
    .filter(p => /\.(ejs|js)$/.test(p) && !/\.bak-|-1\.ejs$/.test(p))
    .filter(p => !p.endsWith(path.join('utils', 'modelSlug.js')))
    .filter(p => !p.endsWith('dumpModelSlugs.js'))
    .filter(p => /modelSlug|vanity-models\//.test(fs.readFileSync(p, 'utf8')));

  if (SNAP_EXISTS) {
    skip(`snapshot exists, so wiring is allowed (${consumers.length} consumer(s))`);
  } else {
    check(consumers.length === 0,
          'no consumer yet, which is correct while the snapshot is missing'
          + (consumers.length ? ' — ' + consumers.map(p => path.relative(ROOT, p)).join(', ') : ''));
  }
}

console.log(`\n${fails ? 'FAILED: ' + fails + ' assertion(s)' : 'All assertions passed.'}\n`);
process.exit(fails ? 1 : 0);
