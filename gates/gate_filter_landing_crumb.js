#!/usr/bin/env node
'use strict';
/* ─────────────────────────────────────────────────────────────────────────
   gate_filter_landing_crumb.js — the breadcrumb on a filter landing page

   Run:  node gates/gate_filter_landing_crumb.js

   ── WHAT WENT WRONG ───────────────────────────────────────────────────
   /collections/bathroom-vanities/style/farmhouse served its own title, H1,
   meta and self-canonical — and a breadcrumb reading

       Home > Collections > Bathroom Vanities- All

   directly under an H1 reading "Farmhouse Bathroom Vanities". The page
   contradicted itself on screen, and the BreadcrumbList carried the same
   wrong leaf — which is what Google renders in place of the URL on the
   result line. On the 27 highest-intent URLs on the site.

   ── WHY A GATE AND NOT A COMMENT ──────────────────────────────────────
   The trail is written TWICE: once as markup in collection.ejs, once as
   structured data in sdCollectionCtx. The helper's own comment already
   warned that writing it more than once is how the copies drift — and
   then they drifted, in the same direction, because the filter case was
   added to neither. A note did not stop it. This runs.

   The last assertion is the one that matters: it CALLS the real helper and
   checks the resolved leaf, so any correct rewrite passes and any
   regression fails, regardless of how the code is spelled.
   ───────────────────────────────────────────────────────────────────────── */

const fs   = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

let fail = 0;
const ok = (name, cond, detail) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${name}`);
  if (!cond) { fail++; if (detail) console.log(`        ${detail}`); }
};

const flp = require('../src/config/filterLandingPages');

/* ═══ 1. EVERY LANDING VALUE HAS A SHORT CRUMB ═══════════════════════ */
console.log('--- every filter landing value carries a crumb ---');
{
  const src = read('src/config/filterLandingPages.js');
  const block = (name) => src.match(new RegExp('const ' + name + ' = \\{([\\s\\S]*?)\\n\\};'));
  const keys = {
    style:        block('STYLE'),
    color_family: block('COLOR'),
    size_in:      block('SIZE'),
  };
  const missing = [], stutter = [];
  let total = 0;
  for (const [param, block] of Object.entries(keys)) {
    if (!block) { missing.push(param + ' (block not found)'); continue; }
    for (const m of block[1].matchAll(/\n\s*'([^']+)':\s*\{/g)) {
      const entry = flp.lookup(param, m[1]);
      total++;
      if (!entry || !entry.crumb || !String(entry.crumb).trim()) {
        missing.push(`${param}=${m[1]}`);
      } else if (entry.h1 && entry.crumb.trim() === entry.h1.trim()) {
        /* A leaf repeating the full H1 inside a trail that already names the
           category reads as a stutter: "... > Bathroom Vanities > 60 Inch
           Bathroom Vanities". The crumb is deliberately the short form. */
        stutter.push(`${param}=${m[1]}`);
      }
    }
  }
  ok(`all ${total} landing values define a crumb`, missing.length === 0, missing.join(', '));
  ok('no crumb is just a copy of the H1', stutter.length === 0, stutter.join(', '));
}

/* ═══ 2. THE TWO COPIES OF THE TRAIL BOTH HANDLE IT ══════════════════ */
console.log('\n--- the markup and the structured data both take the filter leaf ---');
{
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(?<!:)\/\/.*$/gm, '');
  const ctrl = strip(read('src/controllers/collectionsController.js'));
  const view = read('views/pages/collection.ejs').replace(/<%#[\s\S]*?%>/g, '');

  ok('sdCollectionCtx accepts the landing page',
     /function sdCollectionCtx\([^)]*landing[^)]*\)/.test(ctrl),
     'the helper cannot use what it is not given');

  ok('the structured-data trail pushes the crumb',
     /trail\.push\(\s*\{\s*name:\s*landing\.crumb/.test(ctrl),
     'BreadcrumbList would keep the category as its leaf');

  ok('the VISIBLE trail applies the same parent-label rule',
     /_parentLabel/.test(view) && /All\\s\*\$|All\s*\\s\*\$|All/.test(view),
     'the markup would still print "Bathroom Vanities- All" as the link');

  /* OUTPUT, not merely mentioned. The first version of this check tested
     /landing\.crumb/ — which stayed true when the output tag was swapped back
     to category.name, because the string survives in the `else if` guard.
     A mutation test caught it. Assert the <%= %> tag itself. */
  ok('the VISIBLE trail renders the same crumb',
     /<%=\s*landing\.crumb\s*%>/.test(view),
     'the markup and the schema would disagree, which is the rule that '
     + 'made this worth fixing');

  ok('the main listing passes _landing in',
     /sdCollectionCtx\(res,\s*category,\s*effectiveCanonical,\s*_modelSeo,\s*_landing\)/.test(ctrl),
     'the helper would receive undefined and fall through to the category leaf');
}

/* ═══ 3. THE RESOLVED LEAF — behaviour, not spelling ═════════════════ */
console.log('\n--- the helper, called for real ---');
{
  const src = read('src/controllers/collectionsController.js');
  const m = src.match(/function sdCollectionCtx[\s\S]*?\n\}/);
  ok('sdCollectionCtx is extractable', !!m, 'signature changed shape');
  if (m) {
    const fn  = eval('(' + m[0].replace('function sdCollectionCtx', 'function') + ')');
    const res = { locals: { settings: {} } };
    const cat = { slug: 'bathroom-vanities', name: 'Bathroom Vanities- All' };

    const plain = fn(res, cat, '/collections/bathroom-vanities', null, null);
    ok('with no filter the leaf is still the FULL category name',
       plain.trail[plain.trail.length - 1].name === cat.name,
       'the unfiltered page really is the all-vanities page — it keeps its '
       + 'name, and this is also the proof the change is scoped to filtered views');

    for (const [param, value] of [['style','Farmhouse'], ['size_in','60'], ['color_family','wood_l']]) {
      const l   = flp.lookup(param, value);
      const ctx = fn(res, cat, '/x', null, l);
      const leaf = ctx.trail[ctx.trail.length - 1];
      const prev = ctx.trail[ctx.trail.length - 2];
      ok(`${param}=${value} leaf is "${l && l.crumb}"`,
         leaf && leaf.name === l.crumb, `got "${leaf && leaf.name}"`);
      ok(`${param}=${value} category above it is a LINK`,
         prev && prev.url === `/collections/${cat.slug}`,
         'a trail whose second-to-last step is not clickable is not a trail');
      /* "Bathroom Vanities- All > Farmhouse" says all-of-them then a subset
         of them. As an intermediate step the suffix has to go. */
      ok(`${param}=${value} parent step drops the "- All" suffix`,
         prev && !/[-–—]\s*All\s*$/i.test(prev.name),
         `got "${prev && prev.name}"`);
    }
  }
}

if (fail) { console.log(`\n*** ${fail} GATE(S) FAILED ***`); process.exit(1); }
console.log('\nall filter-landing crumb gates pass');
