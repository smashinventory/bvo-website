'use strict';
/* THE GUIDE PAGE PICKS ITS PRODUCTS AND ITS RELATED LINKS DETERMINISTICALLY.
 *
 * ⚠️ WHY THIS GATE EXISTS. Both queries on /inspiration/:slug used
 * `ORDER BY RAND()`. Nothing was broken in a way anyone would notice from
 * the page — it rendered four products and four related guides every
 * time — and that is exactly what made it survive. What it actually cost:
 *
 *   * GOOGLE SAW A DIFFERENT PAGE ON EVERY CRAWL. No product image ever
 *     built an association with the guide, so none could surface in
 *     image search; no internal link between two guides was ever stable
 *     enough to count as a signal. For a ten-article library, internal
 *     linking is one of the few structural advantages available, and
 *     random links are not a web.
 *   * NOTHING WAS REPRODUCIBLE. "The farmhouse guide is showing the wrong
 *     vanity" could not be confirmed, screenshotted, or tested twice.
 *   * A RETURNING READER saw different products and different related
 *     guides each visit, which reads as a glitch rather than a choice.
 *
 * (The first version of this gate also asserted that style COULD NOT be
 * matched. That was wrong — see the style section below.)
 *
 * The second RAND() was found only because the first was being fixed.
 * That is the argument for asserting the CONDITION — no randomness in
 * either query — rather than patching the one that was noticed.
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let fail = 0;
const ok = (n, c, d) => {
  console.log((c ? '  ok   ' : '  FAIL ') + n + (c ? '' : '   <- ' + d));
  if (!c) fail += 1;
};

const RAW = fs.readFileSync(path.join(ROOT, 'src/controllers/inspirationController.js'), 'utf8');
/* ⚠️ Comments stripped before every check. This file's own comments
   explain what RAND() used to do and name ER_BAD_FIELD_ERROR, so a
   search over the raw text finds prose, not code. That exact mistake
   produced a false green in another gate today. */
const SRC = RAW.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('--- nothing on the guide page is random ---');
ok('no RAND() anywhere in the controller', !/RAND\s*\(/i.test(SRC),
   'a query reshuffles on every request');
ok('the product query orders by demand, then featured, then id',
   /ORDER BY COALESCE\(p\.demand_score, 0\) DESC, p\.is_featured DESC, p\.id ASC/.test(SRC),
   'the ordering is not total - ties would still float');
ok('the related-guides query orders by date, then sort, then id',
   /ORDER BY \$\{order\}/.test(SRC) && /published_at DESC, sort_order ASC, id ASC/.test(SRC),
   'related links are not stable');

console.log('--- both queries survive the column not existing ---');
/* published_at arrives with the authors migration. An unguarded
   reference is ER_BAD_FIELD_ERROR, which takes the whole page down. */
ok('there are two guarded fetches, not one',
   (SRC.match(/ER_BAD_FIELD_ERROR/g) || []).length >= 2,
   'one of the two queries would 500 the page before the migration');
ok('each falls back to a column set that always existed',
   /_BASE_COLS/.test(SRC) && /_relatedSql\('sort_order ASC, id ASC'\)/.test(SRC),
   'a fallback that names the missing column is not a fallback');

console.log('--- products are matched on real attributes ---');
ok('_slugToProductMatch exists', /function _slugToProductMatch\(/.test(SRC), 'missing');
[['colour',      /LOWER\(p\.color_family\) LIKE \?/],
 ['width',       /p\.width_in >= \?/],
 ['sink count',  /attr_key = 'sink_count'/]]
  .forEach(([what, re]) => ok(`matches on ${what}`, re.test(SRC), `no ${what} filter`));
/* sink_count is EAV, not a column on products - the same place the
   collection filters read it from. */
ok('sink count comes from product_attribute_values, not a column',
   /JOIN product_attribute_values/.test(SRC), 'there is no sink_count column on products');

console.log('--- style IS matched, from the one canonical list ---');
/* ⚠️ I ASSERTED THE OPPOSITE FIRST TIME. The first version of this gate
   checked that the style limitation was "declared, not faked", because I
   had concluded no style attribute existed — from grepping for a COLUMN
   on products rather than for an attr_key, ten minutes after finding
   sink_count that exact way. The owner's screenshot of the "Shop by
   Style" sidebar is what corrected it.

   It is a MULTI-VALUE EAV attribute written by insertStyleAttrs() in the
   James Martin importer. So the gate now asserts the opposite: that
   style is matched, and that the names come from the single source
   rather than a copy. */
ok('_slugToStyle exists', /function _slugToStyle\(/.test(SRC), 'style guides cannot be matched');
ok('the query joins the style attribute',
   /attr_key = 'style'/.test(SRC) && /pav_st\.value_text = \?/.test(SRC),
   'style is resolved but never used');
ok('style names come from filterLandingPages, not a local copy',
   /require\('\.\.\/config\/filterLandingPages'\)/.test(SRC) && /Object\.keys\(STYLE\)/.test(SRC),
   'a second list of style names will drift from the collection filters');
/* The one shortcut that would look like it worked. */
ok('no keyword match against the product name',
   !/p\.name\s+LIKE/i.test(SRC),
   'matching style by product name is a guess dressed as a filter');

/* Prove the mapping, rather than trusting the regex above. */
{
  const { STYLE } = require(path.join(ROOT, 'src/config/filterLandingPages'));
  const block = SRC.match(/const _STYLE_ALIASES[\s\S]*?\nfunction _slugToProductMatch/);
  let resolve = null;
  if (block) {
    try {
      resolve = new Function('STYLE',
        block[0].replace('function _slugToProductMatch', 'return _slugToStyle;//'))(STYLE);
    } catch { /* reported below */ }
  }
  ok('the slug->style map is executable', typeof resolve === 'function', 'could not evaluate it');
  if (typeof resolve === 'function') {
    [['farmhouse-bathroom-vanity-ideas', 'Farmhouse'],
     ['modern-bathroom-vanity-ideas', 'Modern'],
     ['mid-century-modern-bathroom-vanity-ideas', 'Mid-Century Modern'],
     ['contemporary-bathroom-vanity-ideas', 'Modern'],
     ['60-inch-bathroom-vanity-ideas', null],
     ['white-bathroom-vanity-ideas', null]]
      .forEach(([slug, want]) => ok(`${slug} -> ${want || '(none)'}`,
        resolve(slug) === want, `got ${resolve(slug)}`));
    /* Every alias must name a style that actually exists, or the join
       silently returns nothing and the guide shows no products.

       ⚠️ READ THE _STYLE_ALIASES OBJECT, not every quoted pair in the
       file. The first version of this check scraped /'a': 'B'/ across
       the whole source and swallowed _SHOP_LABELS as well, reporting
       White, Gray, Floating and a dozen others as broken style values.
       A regex over source text has to be anchored to the thing it is
       about. */
    const aliasBlock = SRC.match(/const _STYLE_ALIASES = \{([\s\S]*?)\n\};/);
    const aliases = aliasBlock
      ? [...aliasBlock[1].matchAll(/:\s*'([^']+)'/g)].map(m => m[1])
      : [];
    ok('the alias table was found', aliases.length > 0, 'cannot check the aliases at all');
    const unknown = aliases.filter(v => !Object.keys(STYLE).includes(v));
    ok(`all ${aliases.length} aliases map to a real style value`, unknown.length === 0,
       `not in STYLE: ${unknown.join(', ')}`);
  }
}

console.log(fail ? `\n*** ${fail} GATE(S) FAILED ***` : '\nALL GATES PASS');
process.exit(fail ? 1 : 0);
