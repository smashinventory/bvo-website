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
check(/<div class="lb-card-name">[\s\S]{0,160}?<a\s[\s\S]{0,160}?href="\/products\/<%= product\.slug %>"/.test(lb),
      'the model name carries the product link');
check(/class="card-stretch"/.test(lb),
      '...with .card-stretch, so the whole card stays clickable');
check(/<a[\s\S]{0,160}?class="card-stretch"><%= product\.model %><\/a>/.test(lb),
      '...and the anchor text is the model name, which differs per card');

/* Exactly one link per card. Two would reintroduce the duplicate — the name
   AND a still-linked button pointing at the same product. */
const prodLinks = (lb.match(/href="\/products\/<%= product\.slug %>"/g) || []).length;
check(prodLinks === 1, `exactly one product link per card (found ${prodLinks})`);

/* ───────────── 3. THE CONTROLS STILL WORK ───────────── */
console.log('\n-- the overlay does not break the card controls --');
for (const f of ['public/css/site3.css', 'public/css/site-bundle.css']) {
  const css = read(f);

  /* .card-stretch positions against the nearest POSITIONED ancestor. Without
     this the overlay escapes up the tree and the click target lands
     somewhere else entirely — the card would look right and behave wrongly. */
  check(/\.lb-card\{[^}]*position:relative/.test(css) || /\.lb-card\{position:relative\}/.test(css),
        `${f}: .lb-card is positioned, so the overlay is bounded by the card`);

  /* The load-bearing one. Both arrows and both swatches sit under the
     overlay and need lifting, and z-index only applies to a positioned
     element — so position AND z-index, or it silently does nothing. */
  check(/\.lb-card \.lb-arrow,\.lb-card \.lb-card-swatch\{position:relative;z-index:2\}/.test(css),
        `${f}: carousel arrows and colour swatches are lifted above the overlay`);

  check(/\.lb-card-name a\{color:inherit;text-decoration:none\}/.test(css),
        `${f}: the name link inherits colour, so the card looks unchanged`);
  /* A <span> is inline and ignores the vertical padding .lb-learn-btn was
     written with for an <a>, so the button would visibly collapse. */
  check(/span\.lb-learn-btn\{display:inline-block/.test(css),
        `${f}: the Learn More span is inline-block, so the button keeps its shape`);
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
