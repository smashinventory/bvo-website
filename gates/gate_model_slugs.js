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
  const key = (m, b) => { const s = M.modelSlug(m, b); return s ? M.indexKey(s.brand, s.model) : null; };
  const a = key('Brittany', 'James Martin Vanities');
  const b = key('Brittany', 'James Martin Vanities');
  check(a === b && a === 'james-martin-vanities/brittany',
        `same pair gives the same slug pair every time (${a})`);
  check(key('Brittany', 'James Martin Vanities') === key('  brittany  ', 'james martin vanities'),
        'case and surrounding whitespace do not change the slug');
  check(M.modelSlug('', 'James Martin Vanities') === null
        && M.modelSlug(null, 'x') === null
        && M.modelSlug(undefined, undefined) === null,
        'no model means no slug, rather than a slug made of nothing');
  /* Both halves are required now. An empty brand would make the URL shape
     depend on the data, so it is refused rather than collapsed to one
     segment. */
  check(M.modelSlug('Bristol', '') === null && M.modelSlug('Bristol', null) === null,
        'no brand means no slug either — the path shape never varies');
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

  const sl = M.modelSlug('Mid-Century Modern', 'James Martin Vanities');
  const slug = M.indexKey(sl.brand, sl.model);
  check(slug === 'james-martin-vanities/mid-century-modern',
        `a hyphenated model keeps its own segment (${slug})`);

  const got = M.resolve(slug, index);
  check(!!got && got.model === 'Mid-Century Modern'
             && got.brand === 'James Martin Vanities',
        'a hyphenated model round-trips back to the right pair');

  /* Every pair must round-trip, not just the awkward one. */
  let allBack = true;
  for (const p of pairs) {
    const s2 = M.modelSlug(p.model, p.brand);
    const r = M.resolve(M.indexKey(s2.brand, s2.model), index);
    if (!r || r.model !== p.model || r.brand !== p.brand) allBack = false;
  }
  check(allBack, 'every pair in the set round-trips');

  check(M.resolve('james-martin-vanities/not-a-real-model', index) === null,
        'an unknown slug resolves to null, so the route can 404 rather than guess');
  check(M.resolve('/James-Martin-Vanities/Brittany/', index) !== null,
        'case and stray slashes still resolve, so the route can 301 to canonical');
}

/* ───────────── 3. the brand is always present ───────────── */
console.log('\n-- the brand is always in the slug --');
{
  const kk = (m, b) => { const s = M.modelSlug(m, b); return M.indexKey(s.brand, s.model); };
  const jm = kk('Brittany', 'James Martin Vanities');
  const er = kk('Brittany', 'ER Vanities');
  check(jm !== er, 'the same model under two brands gives two different paths');
  check(jm.startsWith('james-martin-vanities/') && er.startsWith('er-vanities/'),
        'the brand leads, so neither model is the privileged bare one');

  /* The order-dependence this rule exists to prevent: adding a second brand
     must not change the FIRST brand's slug. */
  const before = M.buildIndex([{ model: 'Brittany', brand: 'James Martin Vanities' }]);
  const after  = M.buildIndex([{ model: 'Brittany', brand: 'James Martin Vanities' },
                               { model: 'Brittany', brand: 'ER Vanities' }]);
  check(after.collisions.length === 0,
        'a second brand with the same model name does NOT collide');
  check([...before.index.keys()][0] === jm && after.index.has(jm),
        "...and does not move the first brand's URL");
  /* Bristol is the live proof, not a hypothetical: it exists under both
     brands in the catalogue (JMV 300 products, plus ER Vanities). */
  check(kk('Bristol', 'James Martin Vanities') !== kk('Bristol', 'ER Vanities'),
        'Bristol, which really is in both brands, gets two distinct paths');
}

/* ───────────── 3b. THE COLLISION DETECTOR ─────────────
   Rewritten 2026-10-03 when brand and model became SEPARATE path segments.

   The earlier shape joined them with a hyphen into one segment, which was
   not injective — both halves can contain a hyphen, so ('A B','C') and
   ('A','B C') both produced 'a-b-c'. The mutation sweep found the detector
   had never been tested, which is how that flaw surfaced at all.

   With a segment each, that whole class is gone: 'a-b/c' and 'a/b-c' are
   different keys. A collision now requires two models whose names slugify
   identically WITHIN one brand — "Mid Century" and "Mid-Century", say —
   which is a real data problem worth failing on. The detector is still
   tested, because an untested detector is what let the last one through. */
console.log('\n-- the collision detector fires on a real collision --');
{
  const { index, collisions } = M.buildIndex([
    { model: 'Mid Century',  brand: 'ER Vanities' },
    { model: 'Mid-Century',  brand: 'ER Vanities' },
  ]);
  check(collisions.length === 1,
        `two models slugifying alike within one brand IS reported (${collisions.length})`);
  check(index.size === 1, '...and only one holds the key, deterministically');
  check(collisions[0] && collisions[0].a.model === 'Mid Century'
                      && collisions[0].b.model === 'Mid-Century',
        '...naming both, so it can be fixed rather than just noticed');

  /* The ambiguity the two-segment shape REMOVES. Asserted so a future
     "simplification" back to one joined segment fails here. */
  const x = M.modelSlug('A B', 'C'), y = M.modelSlug('A', 'B C');
  check(M.indexKey(x.brand, x.model) !== M.indexKey(y.brand, y.model),
        "('A B','C') and ('A','B C') no longer collide — separate segments");

  let threw = false;
  try { M.buildIndex([{ model: 'Mid Century', brand: 'ER' }, { model: 'Mid-Century', brand: 'ER' }]); }
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
    const sl = M.modelSlug(m, b);
    if (sl === null) continue;
    for (const seg of [sl.brand, sl.model]) {
      if (encodeURIComponent(seg) !== seg) { clean = false; details.push(`${m} -> ${seg}`); }
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(seg)) { shape = false; details.push(`${m} -> ${seg}`); }
    }
  }
  check(clean, 'no slug needs percent-encoding' + (details.length ? ' — ' + details.join(', ') : ''));
  check(shape, 'no slug has a leading, trailing or doubled hyphen'
               + (details.length ? ' — ' + details.join(', ') : ''));
  check(M.modelSlug('Café', 'ER Vanities').model === 'cafe',
        'an accent folds to its ASCII base rather than being dropped');
  check(M.modelSlug('Slash/Name', 'ER Vanities').model === 'slash-name',
        'a slash cannot escape its path segment');
}

/* ───────────── 5. the path builder ───────────── */
console.log('\n-- one place builds the path --');
{
  const p = M.modelPath('Brittany', 'James Martin Vanities');
  check(p === '/collections/vanity-models/james-martin-vanities/brittany',
        `modelPath returns the canonical path (${p})`);
  check(M.modelPath('', 'x') === null && M.modelPath('x', '') === null,
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
      const drift = pairs.filter(p => {
        const s2 = M.modelSlug(p.model, p.brand);
        return !s2 || s2.brand !== p.brand_slug || s2.model !== p.model_slug
                   || M.modelPath(p.model, p.brand) !== p.path;
      });
      check(drift.length === 0,
            'every committed slug still matches the derivation'
            + (drift.length ? ` — ${drift.length} drifted: `
               + drift.slice(0, 3).map(d =>
                   `"${d.brand}"/"${d.model}" committed ${d.path}, now `
                   + M.modelPath(d.model, d.brand)).join('; ') : ''));

      const slugs = pairs.map(p => p.path);
      check(new Set(slugs).size === slugs.length,
            'no two model pages share a slug');

      const { collisions } = M.buildIndex(pairs);
      check(collisions.length === 0,
            'the real catalogue produces no collisions'
            + (collisions.length ? ` — ${collisions.map(c => c.slug).join(', ')}` : ''));

      const seg = /^[a-z0-9]+(-[a-z0-9]+)*$/;
      const unsafe = pairs.filter(p => !seg.test(p.brand_slug) || !seg.test(p.model_slug));
      check(unsafe.length === 0,
            'every real slug is URL-safe and well-formed'
            + (unsafe.length ? ` — ${unsafe.slice(0, 3).map(p => p.path).join(', ')}` : ''));

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
            'the snapshot is path-sorted, so a diff shows real changes only');
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
