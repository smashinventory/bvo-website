#!/usr/bin/env node
/**
 * gate_lookbook_anchors.js
 *
 * /lookbook rendered "Learn More" forty-one times, each pointing at a
 * DIFFERENT product.
 *
 * That was the last instance on the site of the only anchor-text failure
 * that does real damage: identical text competing for different
 * destinations. Forty-one product pages whose entire anchor-text signal
 * from this page was the phrase "Learn More". It was the thin-anchor-text
 * problem at the same time — two failures in one element.
 *
 * The link moved onto the model name, which is unique per card (verified
 * live: 41 cards, 41 distinct names, 41 distinct targets). "Learn More"
 * is now a <span> that looks identical.
 *
 * THE REGRESSION THIS EXISTS TO CATCH IS NOT THE ANCHOR TEXT.
 * It is the three interactive controls inside each card. .card-stretch
 * spreads an invisible ::after over the whole card, and both carousel
 * arrows and both colour swatches sit under it. Without the z-index lift
 * they stop responding — silently, with no error, on a page that still
 * looks and links correctly. A gate is the only thing that notices.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

let fails = 0;
const ok    = m => console.log('  PASS  ' + m);
const bad   = m => { console.log('  FAIL  ' + m); fails++; };
const check = (c, m) => c ? ok(m) : bad(m);

/* Comments stripped before asserting on markup — this file's own comments
   quote the old "Learn More" anchor, and an unstripped scan would find it
   and fail on correct code. That shape of bug has bitten gates here before. */
const stripComments = s => s
  .replace(/<%#[\s\S]*?%>/g, '')
  .replace(/<%\/\*[\s\S]*?\*\/%>/g, '')
  .replace(/<!--[\s\S]*?-->/g, '');

const lbRaw = read('views/pages/lookbook.ejs');
const lb    = stripComments(lbRaw);

console.log('\n=== gate_lookbook_anchors ===\n');

/* ───────────── 1. "Learn More" is no longer a link ───────────── */
console.log('-- the competing anchor text is gone --');

/* Bounded [\s\S], never [^>] — the href is an EJS tag and every EJS tag
   carries a ">" inside its closing "%>", so a negated-> class stops inside
   the attribute and matches nothing. That exact trap produced three false
   results in this repo on 2026-10-02 alone, including inside a gate. */
check(!/<a\s[\s\S]{0,200}?class="lb-learn-btn"/.test(lb),
      '"Learn More" is not an <a>');
check(/<span class="lb-learn-btn"/.test(lb),
      '...it is a <span>');
check(!/>Learn More<\/a>/.test(lb),
      'no "Learn More" anchor text anywhere in the template');

/* ───────────── 2. the link moved to the model name ───────────── */
console.log('\n-- the link moved to the unique text --');
/* TARGET CHANGED 2026-10-02: the card now links to the MODEL's collection,
   not one arbitrary SKU. The card summarises a model — name, aggregated
   carousel, every colour the model comes in — so it has to open the model.
   This assertion follows that, and still demands the link sit on the name,
   which is what makes the anchor text unique per card. */
check(/<div class="lb-card-name">[\s\S]{0,200}?<a\s[\s\S]{0,260}?href="\/collections\/bathroom-vanities\?model=/.test(lb),
      'the model name carries the model-collection link');
check(/class="card-stretch"/.test(lb),
      '...with .card-stretch, so the whole card stays clickable');
check(/<a[\s\S]{0,160}?class="card-stretch"><%= product\.model %><\/a>/.test(lb),
      '...and the anchor text is the model name, which differs per card');

/* Exactly one link per card. Two would reintroduce the duplicate — the name
   AND a still-linked button pointing at the same product. */
/* Still exactly one link per card — the name — so a re-linked "Learn More"
   cannot reappear and duplicate it. Counts the MODEL link now, and
   separately asserts the old per-product link has not crept back. */
const modelLinks = (lb.match(/href="\/collections\/bathroom-vanities\?model=/g) || []).length;
check(modelLinks === 1, `exactly one model link per card (found ${modelLinks})`);
check(!/href="\/products\/<%= product\.slug %>"/.test(lb),
      'the card no longer links to a single arbitrary SKU');

/* ───────────── 3. THE CONTROLS STILL WORK ───────────── */
console.log('\n-- the overlay does not break the card controls --');
for (const f of ['public/css/site3.css', 'public/css/site-bundle.css']) {
  const css = read(f);

  /* .card-stretch positions against the nearest POSITIONED ancestor. Without
     this the overlay escapes up the tree and the click target lands
     somewhere else entirely — the card would look right and behave wrongly. */
  check(/\.lb-card\{[^}]*position:relative/.test(css) || /\.lb-card\{position:relative\}/.test(css),
        `${f}: .lb-card is positioned, so the overlay is bounded by the card`);

  /* ── THIS SECTION WAS THE GATE'S OWN FAILURE. Rewritten 2026-10-02. ──
     It used to assert the literal rule I had written:

         .lb-card .lb-arrow,.lb-card .lb-card-swatch{position:relative;z-index:2}

     which is a tautology — it asserts "the line I typed is the line I
     typed" and cannot report that the line is WRONG. And it was: .lb-arrow
     already carried z-index:2 and is position:ABSOLUTE, so that selector
     added nothing and, at higher specificity, forced the arrows out of
     absolute positioning and moved them. Twelve green mutations and a green
     gate, with a live layout bug.

     These assert the CONDITIONS instead, which the rule has to satisfy
     however it is written. */

  /* CSS COMMENTS STRIPPED FIRST. Three of these assertions failed on a
     correct tree because the explanatory comment in site3.css QUOTES the
     broken rule as an example of what not to write, and the scan found the
     quotation. Same shape as the EJS-comment trap that has bitten gates in
     this repo repeatedly: assert on code, never on prose about code. */
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, '');

  /* (a) The arrows must still resolve to position:absolute. Nothing may
         override it — that is what places them over the image, and
         overriding it is exactly the bug that shipped in fa6244b. */
  check(!/\.lb-card\s+\.lb-arrow[^{]*\{[^}]*position:\s*(?!absolute)/.test(rules),
        `${f}: nothing overrides the carousel arrows' position:absolute`);
  check(/\.lb-arrow\{[^}]*position:absolute/.test(rules),
        `${f}: the arrows are still absolutely positioned`);

  /* (b) The arrows must be above the overlay. They already were, by their
         own rule — which is the fact the fix relies on, so it is asserted
         as a fact rather than as a rule of mine.

         Compared as a NUMBER, not matched literally: site3.css says 2 and
         site-bundle.css says 9001. Those two files have drifted, which is
         worth knowing, but both clear the overlay and pinning either value
         would make this red for a difference that does not matter here. */
  {
    const m = rules.match(/\.lb-arrow\{[^}]*z-index:\s*(\d+)/);
    check(!!m && Number(m[1]) > 1,
          `${f}: the arrows sit above the overlay (own z-index ${m ? m[1] : 'NONE'} > 1)`);
  }

  /* (c) The swatches are the only control that genuinely needed lifting:
         they declare no position of their own, and z-index does nothing on
         a static element. Both properties, or it silently fails. */
  check(/\.lb-card \.lb-card-swatch\{position:relative;z-index:2\}/.test(rules),
        `${f}: the colour swatches are lifted above the overlay`);

  check(/\.lb-card-name a\{color:inherit;text-decoration:none\}/.test(rules),
        `${f}: the name link inherits colour, so the card looks unchanged`);
  /* A <span> is inline and ignores the vertical padding .lb-learn-btn was
     written with for an <a>, so the button would visibly collapse. */
  check(/span\.lb-learn-btn\{display:inline-block/.test(rules),
        `${f}: the Learn More span is inline-block, so the button keeps its shape`);
}

/* (d) The overlay's own z-index, asserted ONCE and only where it lives.
       .card-stretch is defined in site-bundle.css alone; asserting it in
       site3.css failed for the honest reason that it is not there. If the
       overlay ever rises above 1, every lift above becomes wrong at once. */
{
  const bundle = read('public/css/site-bundle.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const m = bundle.match(/\.card-stretch::after\{[^}]*z-index:\s*(\d+)/);
  check(!!m && Number(m[1]) === 1,
        `site-bundle.css: the .card-stretch overlay is z-index:${m ? m[1] : 'NONE'}, which is what the lifts assume`);
}

check(/site3\.css\?v=30/.test(read('views/pages/lookbook.ejs')),
      'the site3.css cache buster was bumped, or nobody gets the new rules');

/* ───────────── 4. one version across LIVE templates ───────────── */
console.log('\n-- one stylesheet version across live templates --');
{
  /* .bak-* files and *-1.ejs are gitignored backups and legitimately carry
     old versions; only live templates have to agree. Counting them would
     make this assertion permanently red for no reason. */
  const dir = path.join(ROOT, 'views');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => {
    const p = path.join(d, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
  const live = walk(dir).filter(p => p.endsWith('.ejs') &&
                                     !/\.bak-/.test(p) && !/-1\.ejs$/.test(p));
  const versions = new Set();
  for (const p of live) {
    const m = fs.readFileSync(p, 'utf8').match(/site3\.css\?v=(\d+)/g) || [];
    m.forEach(v => versions.add(v));
  }
  check(versions.size <= 1,
        `every live template requests the same site3.css version (${[...versions].join(', ') || 'none'})`);
}

console.log(`\n${fails ? 'FAILED: ' + fails + ' assertion(s)' : 'All assertions passed.'}\n`);
process.exit(fails ? 1 : 0);
