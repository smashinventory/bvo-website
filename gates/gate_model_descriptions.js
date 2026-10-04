#!/usr/bin/env node
/**
 * gate_model_descriptions.js
 *
 * Guards the model landing-page copy added 2026-10-03.
 *
 * WHAT IT IS
 * model_groups.description now holds a benefit-led description per model
 * ("What people love about the Bristol vanity"). collectionsController reads
 * it when a page is narrowed to exactly one (model, brand) pair, and
 * collection.ejs renders it under the H1.
 *
 * THE FAILURE MODES THIS EXISTS TO CATCH, all silent:
 *
 *  1. THE WRONG BRAND'S COPY. 'Bristol' exists under BOTH James Martin
 *     Vanities and ER Vanities. A lookup keyed on model_name alone returns
 *     whichever row MySQL reaches first, so one brand's page describes the
 *     other brand's cabinet — in fluent prose, with no error. This is the
 *     same bug class that already bit mgOverlay and orderMap (see mk() at
 *     the top of collectionsController), which is why it is asserted first.
 *
 *  2. COPY THAT NEVER RENDERS. The description can sit in the database
 *     complete and correct while the template never outputs it — which is
 *     precisely the state this change was made to fix. Asserted by rendering
 *     the REAL template fragment, not by grepping for a class name.
 *
 *  3. AN INJECTION POINT. The Models admin editor writes this column. If the
 *     template ever renders it raw, that editor becomes a way to put script
 *     tags on a public page. Asserted by rendering markup through it.
 *
 *  4. A STALE STYLESHEET. New CSS behind an unbumped ?v= is invisible until
 *     the CDN expires it. The version is asserted as a NUMBER that must
 *     advance, never as a literal, so a later legitimate bump cannot turn
 *     this gate red.
 *
 * It cannot tell you whether the copy is accurate or any good. Accuracy was
 * checked against product_attribute_values when the copy was generated; that
 * is a data question, not a template one.
 */
'use strict';
const fs   = require('fs');
const path = require('path');
const ejs  = require('ejs');

const ROOT = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

let fails = 0;
const ok    = m => console.log('  PASS  ' + m);
const bad   = m => { console.log('  FAIL  ' + m); fails++; };
const check = (c, m) => c ? ok(m) : bad(m);

const ctrl = read('src/controllers/collectionsController.js');
const tmpl = read('views/pages/collection.ejs');
const main = read('views/layouts/main.ejs');

console.log('\ngate_model_descriptions');
console.log('='.repeat(72));

/* ── 1. The lookup is keyed on the PAIR ──────────────────────────────────
   Comments are stripped first. This gate's own rationale above names
   "model_name alone", and a raw scan would match that prose and pass
   itself — a trap this repo has already shipped once. */
console.log('\n1. Lookup is keyed on (model, brand), not model alone');

const code = ctrl
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

const blockMatch = code.match(/const\s+_modelCopy\s*=[\s\S]{0,1200}?\}\)\(\);/);
check(!!blockMatch, '_modelCopy block exists in the controller');

if (blockMatch) {
  const block = blockMatch[0];
  check(/FROM\s+model_groups/i.test(block),
    'reads model_groups');
  check(/model_name\s*=\s*\?[\s\S]{0,40}AND[\s\S]{0,20}brand\s*=\s*\?/i.test(block),
    'WHERE constrains BOTH model_name and brand');
  check(/\[\s*model\s*,\s*brands\[0\]\s*\]/.test(block),
    'binds the model and the single active brand, in that order');
  check(/brands\.length\s*!==\s*1/.test(block),
    'returns null unless exactly one brand is active (a bare ?model= is not a model page)');
  check(/\bif\s*\(\s*!model\b/.test(block),
    'returns null when no model filter is active');
  /* The query must not be able to match on the name alone. */
  check(!/WHERE\s+model_name\s*=\s*\?\s*(?:AND\s+description|LIMIT|\n\s*LIMIT)/i.test(block),
    'no code path queries on model_name without brand');
  check(/modelCopy:\s*_modelCopy/.test(code),
    'the result is passed to the view as modelCopy');
}

/* ── 2. The REAL template fragment renders the copy ──────────────────────
   Sliced out of the shipped file and run through EJS, so this tests the
   markup that ships rather than a restatement of it. Rendering the whole
   page would need ~40 unrelated locals and would break on any of them. */
console.log('\n2. The shipped template actually renders it');

const start = tmpl.indexOf('<% if (typeof modelCopy !==');
const end   = tmpl.indexOf('<% } %>', tmpl.indexOf('</section>'));
const frag  = start >= 0 && end > start ? tmpl.slice(start, end + '<% } %>'.length) : null;
check(!!frag, 'model-copy block located in collection.ejs');

if (frag) {
  const render = locals => ejs.render(frag, locals);

  const out = render({ modelCopy: {
    model_name: 'Bristol', brand: 'ER Vanities',
    description: 'First paragraph here.\n\nSecond paragraph here.',
  }});
  check(/What people love about the Bristol vanity/.test(out),
    'heading names the model');
  check(/<h2[^>]*>/.test(out) && !/<h1/.test(out),
    'heading is an H2 — the page keeps exactly one H1');
  check((out.match(/<p class="model-copy-body"/g) || []).length === 2,
    'blank-line-separated paragraphs render as separate <p> elements');
  check(/First paragraph here\./.test(out) && /Second paragraph here\./.test(out),
    'both paragraphs survive the split');

  /* Absent → the block must not appear at all. An empty <section> on every
     ordinary collection page would be a styling bug nobody notices. */
  check(render({ modelCopy: null }).trim() === '',
    'renders nothing when modelCopy is null');
  check(render({ modelCopy: { model_name: 'X', description: '' } }).trim() === '',
    'renders nothing when the description is empty');

  /* Escaping. The Models admin writes this column. */
  const eviltext = '<script>alert(1)</script>';
  const evil = render({ modelCopy: { model_name: 'X', description: eviltext } });
  check(!evil.includes(eviltext) && evil.includes('&lt;script&gt;'),
    'description is escaped, not rendered as markup');
  const evilName = render({ modelCopy: { model_name: '<img onerror=x>', description: 'a' } });
  check(!evilName.includes('<img onerror'),
    'model name is escaped too');
}

/* ── 3. The CSS ships and is reachable ──────────────────────────────────
   site.css is the source; site-bundle.css is what main.ejs actually links.
   An edit to only one of them is the standard way a style silently never
   arrives in this repo. */
console.log('\n3. Styles present in BOTH files, and the cache key advanced');

for (const f of ['public/css/site.css', 'public/css/site-bundle.css']) {
  check(/\.model-copy\{/.test(read(f)), `${f} carries .model-copy`);
  check(/\.model-copy-body\{/.test(read(f)), `${f} carries .model-copy-body`);
}

const v = main.match(/site-bundle\.css\?v=(\d+)/);
check(!!v, 'main.ejs links site-bundle.css with a ?v=');
check(v && Number(v[1]) >= 31,
  `bundle cache key is >= 31 (found ${v ? v[1] : 'none'}) — numeric, so a later bump stays green`);

/* ── 4. The data migration is complete ──────────────────────────────────
   Counts the tuples quote-aware rather than by counting "','", which a
   description containing that sequence would inflate. */
console.log('\n4. The migration carries all 45 models');

const sqlPath = 'migrations/2026-10-03_model_descriptions.sql';
if (!fs.existsSync(path.join(ROOT, sqlPath))) {
  bad(`${sqlPath} is missing`);
} else {
  const sql  = read(sqlPath);
  const body = sql.split('VALUES\n')[1] ? sql.split('VALUES\n')[1].split('\nON DUPLICATE')[0] : '';
  let n = 0, depth = 0, inStr = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (inStr) {
      if (ch === '\\') { i++; continue; }
      if (ch === "'") inStr = false;
      continue;
    }
    if (ch === "'") inStr = true;
    else if (ch === '(') depth++;
    else if (ch === ')' && --depth === 0) n++;
  }
  check(n === 45, `45 model rows in the migration (found ${n})`);
  check(!inStr && depth === 0, 'every string literal and paren is closed');
  check(/ON DUPLICATE KEY UPDATE/i.test(sql), 're-runnable — ON DUPLICATE KEY UPDATE');
  check(!/\bDROP\b|\bDELETE\b|\bALTER\b|\bTRUNCATE\b/i.test(sql.replace(/^--.*$/gm, '')),
    'no DROP / DELETE / ALTER / TRUNCATE outside comments');

  /* Both Bristols must be present, each under its own brand. */
  check(/\('Bristol','ER Vanities'/.test(body) &&
        /\('Bristol','James Martin Vanities'/.test(body),
    'both Bristols present, one per brand');
}

/* ── 5. The SEO overrides ───────────────────────────────────────────────
   The canonical is the one that decides whether any of this can rank. A
   model page that canonicalises to the parent collection is telling Google
   to index the parent instead, which makes the copy decoration. */
console.log('\n5. Model pages are self-canonical and uniquely titled');

const seoMatch = code.match(/const\s+_modelSeo\s*=[\s\S]{0,1800}?\}\)\(\)\s*:\s*null;/);
check(!!seoMatch, '_modelSeo block exists');

if (seoMatch) {
  const b = seoMatch[0];
  check(/pathFilters\.modelPath\(/.test(b),
    'canonical is built by pathFilters.modelPath — same source as the hrefs');
  check(/canonical:\s*p\s*\?/.test(b),
    'falls back to null when the model is not in the lookup table (no invented URL)');
  check(/\.replace\(\/\\s\+\/g,\s*' '\)/.test(b),
    'meta description is collapsed to a single line');
  check(/155/.test(b), 'meta description is truncated for the SERP');
}

/* Precedence: model must win over landing, in BOTH the controller and the
   template. If they disagree the page canonicalises as one thing and reads
   as another — the exact failure this ordering exists to prevent. */
const canon = code.match(/const\s+effectiveCanonical\s*=[\s\S]{0,400}?;/);
check(!!canon && /_modelSeo[\s\S]{0,80}_landing/.test(canon[0]),
  'controller: _modelSeo is tested BEFORE _landing for the canonical');
check(/pageTitle:\s*_modelSeo\s*\?/.test(code),
  'controller: pageTitle prefers _modelSeo');
check(/metaDesc:\s*_modelSeo\s*\?/.test(code),
  'controller: metaDesc prefers _modelSeo');
check(/modelSeo:\s*_modelSeo/.test(code),
  'controller: modelSeo is passed to the view');

/* EJS comments stripped first. The block's own prose names "filter landing
   page" ABOVE the code, so a raw scan compares a comment against a branch
   and reports the wrong order — the comment-vs-code trap this repo has
   shipped before, caught here by this gate on its first run. */
const tmplCode = tmpl.replace(/<%#[\s\S]*?%>/g, '');
const h1Block  = tmplCode.slice(tmplCode.indexOf('<div class="cat-header">'),
                                tmplCode.indexOf('<!-- Breadcrumb -->'));
check(h1Block.indexOf('modelSeo') >= 0 &&
      h1Block.indexOf('modelSeo') < h1Block.indexOf('landing'),
  'template: modelSeo H1 is tested BEFORE landing — same precedence as the controller');

/* Exactly one H1 may be emitted whichever branch wins. */
{
  const hdrStart = tmpl.indexOf('<div class="cat-header">');
  const hdrEnd   = tmpl.indexOf('<!-- Breadcrumb -->');
  const header   = tmpl.slice(hdrStart, hdrEnd);
  const render = locals => ejs.render(header + '</div></div>', locals);
  const base = { category: { name: 'Bathroom Vanities- All', slug: 'bathroom-vanities', description: 'x' } };
  const cases = [
    ['model page',   { ...base, modelSeo: { label: 'ER Vanities Bristol' }, modelCopy: { model_name: 'Bristol', description: 'a\n\nb' }, landing: null }],
    ['landing page', { ...base, modelSeo: null, modelCopy: null, landing: { h1: 'Farmhouse Vanities', intro: 'i' } }],
    ['plain page',   { ...base, modelSeo: null, modelCopy: null, landing: null }],
  ];
  for (const [name, locals] of cases) {
    const out = render(locals);
    check((out.match(/<h1[\s>]/g) || []).length === 1, `${name}: exactly one H1`);
  }
  check(/ER Vanities Bristol/.test(render(cases[0][1])),
    'model page H1 is the brand + model label');
  check(!/Bathroom Vanities- All<\/h1>/.test(render(cases[0][1])),
    'model page H1 is NOT the parent collection name');
}

console.log('\n' + '='.repeat(72));
console.log(fails === 0 ? 'gate_model_descriptions: PASS\n'
                        : `gate_model_descriptions: ${fails} FAILURE(S)\n`);
process.exit(fails === 0 ? 0 : 1);
