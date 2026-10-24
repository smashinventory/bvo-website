'use strict';
/* ═══════════════════════════════════════════════════════════════════════
   gate_sale_sitemap.js — /collections/sale is in the sitemap, and the
   sitemap and the Deals page agree on what "on sale" means. Task #365.

   THE BUG. sitemapController builds collection URLs by looping over rows
   from `categories`. Sale is a VIRTUAL collection — a query, with no row —
   so the Deals page has never been listed and Google has had no route to
   it. 6,240 URLs in the sitemap and the one page built to convert bargain
   hunters was not among them.

   THE RISK IN FIXING IT, which is what most of this gate guards. The
   sitemap must decide whether the page is worth submitting, and that
   decision is "does anything qualify today". Answering it with a second
   copy of the WHERE clause would have produced two definitions of "on
   sale" that drift the first time either is touched — the Rule 18 trap as
   a second CALLER rather than a second test. Hence src/config/saleRule.js,
   and hence the checks below that both files import it.

   fracFromSetting is pure and exported so this gate runs the real
   threshold logic rather than matching its text (Rule 14). That matters
   because the empty-is-not-zero case has been wrong in this codebase
   before, and getting it wrong dumps the whole catalogue onto the page.
   ═══════════════════════════════════════════════════════════════════════ */

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

let fail = 0;
const ok = (n, c, d) => {
  console.log((c ? '  ok  ' : '  FAIL') + '  ' + n + (c ? '' : '   <- ' + d));
  if (!c) fail++;
};

const rule = require(path.join(ROOT, 'src/config/saleRule.js'));

/* ── 1. THE THRESHOLD, EXECUTED ───────────────────────────────────── */
console.log('--- fracFromSetting ---');

ok('a normal percentage converts', rule.fracFromSetting(25) === 0.25,
   String(rule.fracFromSetting(25)));
ok('a numeric string converts', rule.fracFromSetting('40') === 0.4,
   String(rule.fracFromSetting('40')));

/* ⚠️ THE ONE THAT HAS BEEN WRONG BEFORE. Number('') is 0 — finite, in
   range, and therefore accepted as "0% off", which qualifies every
   discounted product in the catalogue. Clearing a Theme Editor box is the
   most ordinary admin action there is. */
ok('EMPTY falls back to the default, not 0',
   rule.fracFromSetting('') === rule.DEFAULT_DEALS_FRAC,
   'a cleared box would dump the whole catalogue onto the Deals page');
ok('null falls back to the default',
   rule.fracFromSetting(null) === rule.DEFAULT_DEALS_FRAC, 'null became 0');
ok('undefined falls back to the default',
   rule.fracFromSetting(undefined) === rule.DEFAULT_DEALS_FRAC, 'undefined became 0');

/* A deliberate 0 is legitimate — "show everything" — but must be TYPED. */
ok('a deliberate 0 IS honoured', rule.fracFromSetting(0) === 0,
   'an explicit zero was overridden');

ok('out of range falls back', rule.fracFromSetting(150) === rule.DEFAULT_DEALS_FRAC &&
   rule.fracFromSetting(-10) === rule.DEFAULT_DEALS_FRAC, 'range not guarded');
ok('junk falls back', rule.fracFromSetting('abc') === rule.DEFAULT_DEALS_FRAC, 'NaN leaked');

ok('the shipped default is 37.5%', rule.DEFAULT_DEALS_FRAC === 0.375,
   String(rule.DEFAULT_DEALS_FRAC));

/* ── 2. ONE DEFINITION, TWO CALLERS ───────────────────────────────── */
console.log('--- the page and the sitemap share the rule ---');

const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const coll = strip(fs.readFileSync(path.join(ROOT, 'src/controllers/collectionsController.js'), 'utf8'));
const smap = strip(fs.readFileSync(path.join(ROOT, 'src/controllers/sitemapController.js'), 'utf8'));

ok('the Deals page uses the shared predicate',
   /\$\{saleRule\.SALE_WHERE\}/.test(coll),
   'the page has its own copy of the WHERE clause again');
ok('the sitemap uses the shared predicate',
   /\$\{saleRule\.SALE_WHERE\}/.test(smap),
   'the sitemap has its own copy — it will drift from the page');
ok('the Deals page uses the shared threshold',
   /saleRule\.fracFromSetting/.test(coll), 'inline threshold logic returned');
ok('the sitemap uses the shared threshold',
   /saleRule\.fracFromSetting/.test(smap), 'inline threshold logic in the sitemap');

/* Neither may keep a private copy of the discount arithmetic. */
for (const [label, src] of [['collectionsController', coll], ['sitemapController', smap]]) {
  ok(label + ' has no second copy of the discount maths',
     !/compare_price\s*-\s*p?\.?price\)\s*\/\s*p\.compare_price/.test(src),
     'the formula was re-inlined alongside the shared rule');
}

/* ── 3. THE SITEMAP ENTRY ITSELF ──────────────────────────────────── */
console.log('--- the URL ---');

ok('the sale URL is emitted', /\/collections\/sale<\/loc>/.test(smap),
   'the Deals page is still absent from the sitemap');

/* Only when something qualifies: an empty Deals page is a thin page. */
ok('it is emitted ONLY when something qualifies',
   /if\s*\(\s*saleCount\s*>\s*0\s*\)/.test(smap),
   'an empty Deals page would be submitted to Google');

/* A failed count must not take the other 6,240 URLs down with it. */
ok('a failed count degrades instead of throwing',
   /catch\s*\([\s\S]{0,400}?sitemap\]\s*sale count failed/.test(smap),
   'an error here would 500 the whole sitemap');

ok('the count defaults to 0, so a failure OMITS rather than emits',
   /let\s+saleCount\s*=\s*0/.test(smap),
   'a failed count could still emit the URL');

/* Live settings, never the Theme Editor preview. */
ok('the threshold comes from the live saved settings',
   /themeSettings\.get\(\)/.test(smap) && !/res\.locals\.settings/.test(smap),
   'an admin previewing in the Theme Editor would change the sitemap');

console.log(fail ? '\n*** ' + fail + ' GATE(S) FAILED ***' : '\nALL GATES PASS');
process.exit(fail ? 1 : 0);
