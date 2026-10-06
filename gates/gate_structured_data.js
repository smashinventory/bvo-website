'use strict';
/* STRUCTURED DATA IS BUILT IN ONE PLACE AND ACTUALLY REACHES THE PAGE.
 *
 * ⚠️ THE BUG THIS EXISTS TO PREVENT, which shipped and went unnoticed:
 *
 * inspirationController and authorsController each built correct JSON-LD and
 * handed it to res.render as `script:`. It never reached a single page.
 *
 * express-ejs-layouts runs with `layout extractScripts` enabled
 * (src/server.js:504). Its extractor does:
 *
 *     locals.script = '';        // express-layouts.js:98  - wipes the controller's value
 *     parseScripts(locals);      // express-layouts.js:99  - refills ONLY from <script>
 *                                //                         tags found in the rendered view
 *
 * So a controller passing `script:` is writing to a variable that is
 * overwritten microseconds later. The page renders fine, the code looks
 * right, the reviewer sees JSON-LD in the controller, and the markup is
 * simply absent. An SEO audit reported "No Schema.org data found" on those
 * pages and it was taken as a request for MORE schema rather than as
 * evidence the existing schema was not rendering.
 *
 * The fix, which this gate locks in: the controller passes `jsonLd`, and the
 * VIEW emits it as a real <script> tag, where the extractor finds it and
 * joins it with the page's own scripts rather than replacing them.
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
let fail = 0;
const ok = (n, c, d) => {
  console.log((c ? '  ok   ' : '  FAIL ') + n + (c ? '' : '   <- ' + d));
  if (!c) fail += 1;
};
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
/* Comments stripped before every check. These files explain the bug at
   length and name the very patterns being searched for, so a scan over raw
   text matches prose. That trap has produced both false reds and a false
   green in this codebase. */
const js  = p => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const ejs = p => read(p).replace(/<%\/\*[\s\S]*?\*\/%>/g, '').replace(/<!--[\s\S]*?-->/g, '');

/* controller -> the view it renders */
const PAIRS = [
  ['src/controllers/homeController.js',        'views/pages/index.ejs'],
  ['src/controllers/inspirationController.js', 'views/pages/inspiration-guide.ejs'],
  ['src/controllers/authorsController.js',     'views/pages/author.ejs'],
];

console.log('--- JSON-LD is never passed as the `script` local ---');
/* The whole point. Matching on ld+json inside a script: assignment rather
   than on `script:` generally, because passing script: '' is a harmless
   no-op that several controllers still do. */
for (const [c] of PAIRS.concat([['src/controllers/pagesController.js']])) {
  const src = js(c);
  ok(`${c.split('/').pop()} does not pass JSON-LD as script:`,
     !/script\s*:\s*[`'"]\s*<script[^>]*ld\+json/i.test(src),
     'express-ejs-layouts discards this; the markup will never render');
}

console.log('--- every wired controller passes jsonLd, and its view emits it ---');
for (const [c, v] of PAIRS) {
  const cs = js(c), vs = ejs(v);
  ok(`${c.split('/').pop()} passes jsonLd`, /\n\s*jsonLd,/.test(cs),
     'the render call does not include the local');
  ok(`${v.split('/').pop()} emits it`, /<%-\s*jsonLd\s*%>/.test(vs),
     'nothing renders the tag, so extraction finds nothing');
  /* An undefined local is a hard EJS error. index.ejs is also rendered by
     the Theme Editor preview path, which does not go through the
     controller. */
  ok(`${v.split('/').pop()} guards on typeof`,
     /typeof\s+jsonLd\s*!==\s*['"]undefined['"]/.test(vs),
     'an undefined local throws rather than rendering empty');
}

console.log('--- one source for the organisation ---');
const MOD = 'src/utils/structuredData.js';
ok('the module exists', fs.existsSync(path.join(ROOT, MOD)), 'missing');
const mod = js(MOD);
ok('it declares OnlineStore, not generic Organization',
   /'@type':\s*'OnlineStore'/.test(mod),
   'OnlineStore is the subtype that unlocks the merchant knowledge panel');
ok('the company name is defined once', (mod.match(/const ORG_NAME/g) || []).length === 1, 'duplicated');
/* The reason the module was written. If a controller hardcodes the name or
   logo again, the graph stops being one entity. */
for (const [c] of PAIRS) {
  const src = js(c);
  ok(`${c.split('/').pop()} does not hardcode the logo path`,
     !/BVOLOGOSQ/.test(src), 'the logo belongs in structuredData.js only');
}

console.log('--- the manual-action guard ---');
/* The product page displays a site-wide Google SELLER rating (4.9/150, from
   themeSettings). Attaching it to Product.aggregateRating would publish an
   identical rating across thousands of products, which is the textbook
   structured-data manual action. */
ok('the module never emits aggregateRating', !/aggregateRating/.test(mod),
   'see the warning block in structuredData.js');
{
  const sd = require(path.join(ROOT, 'src/utils/structuredData'));
  const g  = sd.pageGraph({ url: '/', name: 'x', settings: { social: {} } });
  ok('a built graph contains no aggregateRating',
     !JSON.stringify(g).includes('aggregateRating'), 'it leaked in at runtime');

  const types = g['@graph'].map(n => n['@type']);
  ok('the root graph carries OnlineStore + WebSite + WebPage',
     ['OnlineStore', 'WebSite', 'WebPage'].every(t => types.includes(t)),
     `got ${types.join(', ')}`);

  /* Every @id referenced must resolve to a node defined somewhere in the
     document, or the references are decoration rather than a connected
     entity graph.
     ⚠️ IDs ARE COLLECTED RECURSIVELY, NOT JUST FROM TOP-LEVEL @graph
     MEMBERS. The first version of this check walked only g['@graph'] and
     failed on the Organization's own logo, which is a nested node carrying
     its own @id. Nesting does not make a node undefined - JSON-LD resolves
     an @id wherever it appears - so the gate was wrong, not the module.
     A definition is any object with @id and at least one other key; a
     reference is an object whose ONLY key is @id. */
  const ids = new Set();
  const refs = [];
  (function walk(v) {
    if (Array.isArray(v)) return v.forEach(walk);
    if (!v || typeof v !== 'object') return;
    const keys = Object.keys(v);
    if (v['@id']) {
      if (keys.length === 1) refs.push(v['@id']);
      else ids.add(v['@id']);
    }
    keys.forEach(k => walk(v[k]));
  })(g['@graph']);
  const dangling = refs.filter(r => !ids.has(r));
  ok(`all ${refs.length} @id references resolve to a defined node`,
     dangling.length === 0, `dangling: ${dangling.join(', ')}`);

  /* A single-item trail is not a breadcrumb. */
  ok('a one-item trail yields no BreadcrumbList',
     sd.breadcrumbList('/x', [{ name: 'Home', url: '/' }]) === null,
     'a malformed one-item list would be emitted');

  /* Product names come from a vendor feed. A name containing "</script>"
     would otherwise close the tag early and inject the remainder as markup. */
  ok('the script tag escapes a hostile string',
     !sd.scriptTag(sd.graph([{ '@type': 'Thing', name: 'x</script><img src=y>' }]))
        .includes('</script><img'),
     'JSON-LD can be broken out of');
}

console.log('--- the product page emits one graph, not islands ---');
{
  const pv = ejs('views/pages/product.ejs');
  const pc = js('src/controllers/productsController.js');
  /* product.ejs assembles its own graph because the Product and
     VideoObject nodes derive from view-local data (image array, in-stock
     flag, YouTube id parsing). The controller supplies sd + sdCtx. */
  ok('productsController passes sd and sdCtx', /\n\s*sd,/.test(pc) && /sdCtx\s*:/.test(pc),
     'the view cannot build the graph without them');
  ok('product.ejs emits exactly one ld+json script',
     (pv.match(/sd\.scriptTag\(/g) || []).length === 1
       && !/application\/ld\+json/.test(pv),
     'a hand-written block survived, so something is published twice');
  ok('VideoObjects are nodes in that graph, not separate tags',
     /_pdNodes\.push\(_v\)/.test(pv), 'videos are emitted standalone again');
}

console.log('--- no offer is published on a zero-priced item ---');
/* An Offer with price 0 is INVALID to Google, not free: merchant listings
   report the item as an error. Free samples and unpriced feed rows both
   reach the product page at zero. */
{
  const pv = ejs('views/pages/product.ejs');
  ok('the offer is built behind a price guard', /if\s*\(\s*_pdHasPrice\s*\)/.test(pv),
     'offers is emitted unconditionally');
  /* ⚠️ The guard MUST coerce. product.price arrives from MySQL DECIMAL as a
     string, so `if (product.price)` is true for "0.00" and would emit the
     exact invalid offer this exists to prevent. */
  ok('the guard coerces with Number() before comparing',
     /_pdPrice\s*=\s*Number\(product\.price\)/.test(pv)
       && /Number\.isFinite\(_pdPrice\)\s*&&\s*_pdPrice\s*>\s*0/.test(pv),
     'a truthiness check passes on the string "0.00"');

  /* Prove the predicate rather than trusting the regex. */
  const hasPrice = p => { const n = Number(p); return Number.isFinite(n) && n > 0; };
  const cases = [['1902.78', true], ['0.00', false], ['0', false], [0, false],
                 [null, false], [undefined, false], ['', false], ['abc', false], ['-5', false]];
  const wrong = cases.filter(([v, want]) => hasPrice(v) !== want);
  ok(`the price predicate is correct for all ${cases.length} forms`,
     wrong.length === 0, `wrong: ${wrong.map(w => JSON.stringify(w[0])).join(', ')}`);
}

console.log('--- collection pages: one helper, all three render sites ---');
{
  const cc = js('src/controllers/collectionsController.js');
  const cv = ejs('views/pages/collection.ejs');
  /* ⚠️ pages/collection is rendered from THREE places - the sale
     pseudo-category, model-group mode, and the main listing. Wiring them
     separately is how two of them drift apart later. */
  const sites = (cc.match(/res\.render\('pages\/collection'/g) || []).length;
  const wired = (cc.match(/sdCtx:\s*sdCollectionCtx\(/g) || []).length;
  ok(`all ${sites} collection render sites are wired`, sites > 0 && wired === sites,
     `${wired} of ${sites} pass sdCtx`);
  ok('they share one trail builder', /function sdCollectionCtx\(/.test(cc),
     'the breadcrumb is written out per site and will diverge');
  ok('collection.ejs emits one graph', (cv.match(/sd\.scriptTag\(/g) || []).length === 1,
     'zero or duplicated structured data');
  /* Model-group mode renders the same template with `models`, not
     `products`, so an ItemList must not be invented for it. */
  /* ⚠️ The guard is `(typeof products !== 'undefined' && Array.isArray(products))
     ? products : []`, so there is a CLOSING PAREN between the isArray call
     and the `?`. The first version of this check omitted it and went red
     against correct code - a spelling-pin rather than a condition, which is
     the recurring mistake in this repo's gates. Asserting both halves of
     the condition, tolerant of the parens around them. */
  ok('the ItemList is built only from a real products array',
     /typeof\s+products\s*!==\s*['"]undefined['"]/.test(cv)
       && /Array\.isArray\(products\)/.test(cv)
       && /\?\s*products\s*:\s*\[\]/.test(cv),
     'model-group mode would emit an empty or wrong ItemList');
}

console.log('--- breadcrumbs describe trails that are actually visible ---');
/* Google requires BreadcrumbList to match what the user sees. author.ejs
   renders no trail, so authorsController must not emit the node - and the
   only /authors route is the admin one, so a middle crumb would 404. */
ok('author.ejs renders no visible breadcrumb',
   !/class="[a-z-]*breadcrumb/i.test(ejs('views/pages/author.ejs')),
   'if a trail was added, the schema node should be added with it');
ok('authorsController emits no BreadcrumbList',
   !/trail\s*:/.test(js('src/controllers/authorsController.js')),
   'it would describe a trail the user cannot see');
ok('inspiration-guide.ejs DOES render a visible trail',
   /class="inspo-breadcrumb"/.test(ejs('views/pages/inspiration-guide.ejs')),
   'its BreadcrumbList would then be unsupported');
ok('inspirationController emits a matching trail',
   /trail\s*:/.test(js('src/controllers/inspirationController.js')),
   'the visible trail is unmarked');

console.log(fail ? `\n*** ${fail} GATE(S) FAILED ***` : '\nALL GATES PASS');
process.exit(fail ? 1 : 0);
